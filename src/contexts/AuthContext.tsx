/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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

async function refreshProfileState(
  userId: string,
  requestId: number,
  options: {
    mountedRef: MutableRefObject<boolean>
    requestIdRef: MutableRefObject<number>
    setProfile: Dispatch<SetStateAction<UserProfile | null>>
    setLoading: Dispatch<SetStateAction<boolean>>
    silent?: boolean
    preserveCurrentOnFailure?: boolean
  },
) {
  const timeout = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), 8000)
  })

  if (!options.silent) {
    options.setLoading(true)
  }

  const userProfile = await Promise.race([fetchProfile(userId), timeout])

  if (requestId !== options.requestIdRef.current || !options.mountedRef.current) {
    return
  }

  if (userProfile) {
    options.setProfile(userProfile)
  } else if (!options.preserveCurrentOnFailure) {
    options.setProfile(null)
  }
  options.setLoading(false)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  const syncSession = async (
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

    if (!shouldRefreshProfile) {
      setLoading(false)
      return
    }

    try {
      await refreshProfileState(nextSession.user.id, requestId, {
        mountedRef,
        requestIdRef,
        setProfile,
        setLoading,
        preserveCurrentOnFailure,
      })
    } catch {
      if (mountedRef.current && requestId === requestIdRef.current) {
        if (!preserveCurrentOnFailure) {
          setProfile(null)
        }
        setLoading(false)
      }
    }
  }

  useEffect(() => {
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
  }, [])

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
        setLoading,
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

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore sign-out failures when Supabase is unavailable.
    }
    setProfile(null)
    setUser(null)
    setSession(null)
  }

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
    }),
    [user, profile, session, loading],
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
