/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react"
import { supabase } from "@/integrations/supabase"
import type { Session, User } from "@supabase/supabase-js"
import { SUPABASE_URL } from "@/lib/constants"

export type UserRole = "student" | "affiliate" | "admin"
export type UserStatus = "active" | "inactive" | "blocked" | "pending_review"

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  is_admin: boolean
  status: UserStatus
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const PROFILE_CACHE_KEY = "mariana-explica:auth-profile"

function getSupabaseStorageKey() {
  if (!SUPABASE_URL) {
    return null
  }

  try {
    const hostname = new URL(SUPABASE_URL).hostname
    const projectRef = hostname.split(".")[0]
    return projectRef ? `sb-${projectRef}-auth-token` : null
  } catch {
    return null
  }
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") {
    return null
  }

  const storageKey = getSupabaseStorageKey()
  if (!storageKey) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Session
    const expiresAt = typeof parsed?.expires_at === "number" ? parsed.expires_at : null

    if (!parsed?.access_token || !parsed?.user?.id) {
      return null
    }

    if (expiresAt && expiresAt * 1000 <= Date.now()) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,is_admin,status")
      .eq("id", userId)
      .single()

    if (error || !data) {
      return null
    }

    return data as UserProfile
  } catch {
    return null
  }
}

function readCachedProfile(userId: string): UserProfile | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) {
      return null
    }

    const cached = JSON.parse(raw) as UserProfile
    return cached?.id === userId ? cached : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile: UserProfile | null) {
  if (typeof window === "undefined") {
    return
  }

  if (!profile) {
    window.sessionStorage.removeItem(PROFILE_CACHE_KEY)
    return
  }

  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
}

async function refreshProfileState(
  userId: string,
  requestId: number,
  options: {
    mountedRef: MutableRefObject<boolean>
    requestIdRef: MutableRefObject<number>
    setProfile: Dispatch<SetStateAction<UserProfile | null>>
    silent?: boolean
    preserveCurrentOnFailure?: boolean
  },
) {
  const timeout = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), 8000)
  })

  const userProfile = await Promise.race([fetchProfile(userId), timeout])

  if (requestId !== options.requestIdRef.current || !options.mountedRef.current) {
    return
  }

  if (userProfile) {
    options.setProfile(userProfile)
  } else if (!options.preserveCurrentOnFailure) {
    options.setProfile(null)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const optimisticSession = useMemo(() => readStoredSession(), [])
  const optimisticProfile = useMemo(
    () => (optimisticSession ? readCachedProfile(optimisticSession.user.id) : null),
    [optimisticSession],
  )
  const [session, setSession] = useState<Session | null>(optimisticSession)
  const [user, setUser] = useState<User | null>(optimisticSession?.user ?? null)
  const [profile, setProfile] = useState<UserProfile | null>(optimisticProfile)
  const [loading, setLoading] = useState(!optimisticSession)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)
  const profileRef = useRef<UserProfile | null>(optimisticProfile)

  useEffect(() => {
    profileRef.current = profile
    writeCachedProfile(profile)
  }, [profile])

  const syncSession = useCallback(async (
    nextSession: Session | null,
    shouldRefreshProfile: boolean,
    preserveCurrentOnFailure = false,
  ) => {
    if (!mountedRef.current) {
      return
    }

    const requestId = ++requestIdRef.current

    setSession(nextSession)
    setUser(nextSession?.user ?? null)

    if (!nextSession?.user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const cachedProfile = readCachedProfile(nextSession.user.id)
    if (cachedProfile) {
      setProfile(cachedProfile)
    }

    // `loading` representa apenas o bootstrap inicial da sessao.
    // Se a sessao ja existe, a app pode sair do spinner global e
    // aguardar o profile nos guards sem travar a navegacao inteira.
    setLoading(false)

    if (!shouldRefreshProfile) {
      return
    }

    const keepCurrentProfile =
      preserveCurrentOnFailure ||
      Boolean(cachedProfile) ||
      Boolean(profileRef.current && profileRef.current.id === nextSession.user.id)

    try {
      await refreshProfileState(nextSession.user.id, requestId, {
        mountedRef,
        requestIdRef,
        setProfile,
        preserveCurrentOnFailure: keepCurrentProfile,
      })
    } catch {
      if (
        mountedRef.current &&
        requestId === requestIdRef.current &&
        !keepCurrentProfile
      ) {
        if (!keepCurrentProfile) {
          setProfile(null)
        }
      }
    }
  }, [setLoading, setProfile, setSession, setUser])

  useEffect(() => {
    mountedRef.current = true

    async function initializeAuth() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mountedRef.current) {
          return
        }

        await syncSession(data.session, Boolean(data.session?.user))
      } catch {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event: string, nextSession: Session | null) => {
        if (!mountedRef.current) {
          return
        }

        const shouldRefreshProfile =
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "USER_UPDATED" ||
          event === "PASSWORD_RECOVERY"

        const preserveCurrentOnFailure = event === "TOKEN_REFRESHED"

        await syncSession(nextSession, shouldRefreshProfile, preserveCurrentOnFailure)
      },
    )

    initializeAuth()

    return () => {
      mountedRef.current = false
      listener.subscription.unsubscribe()
    }
  }, [syncSession])

  useEffect(() => {
    if (!session?.user) {
      return
    }

    const refreshSessionProfile = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }

      const requestId = ++requestIdRef.current
      void refreshProfileState(session.user.id, requestId, {
        mountedRef,
        requestIdRef,
        setProfile,
        silent: true,
        preserveCurrentOnFailure: true,
      })
    }

    window.addEventListener("focus", refreshSessionProfile)
    document.addEventListener("visibilitychange", refreshSessionProfile)

    return () => {
      window.removeEventListener("focus", refreshSessionProfile)
      document.removeEventListener("visibilitychange", refreshSessionProfile)
    }
  }, [session])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore sign-out failures when Supabase is unavailable.
    }
    setProfile(null)
    setUser(null)
    setSession(null)
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        return false
      }

      await syncSession(data.session, Boolean(data.session?.user), true)
      return Boolean(data.session?.user)
    } catch {
      return false
    }
  }, [syncSession])

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      loading,
      isAuthenticated: Boolean(session && profile && profile.status === "active"),
      isAdmin: Boolean(
        profile?.is_admin === true &&
          profile?.role === "admin" &&
          profile.status === "active",
      ),
      signOut,
      refreshSession,
    }),
    [user, profile, session, loading, signOut, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
