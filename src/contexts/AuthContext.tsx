/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  const syncSession = async (nextSession: Session | null, refreshProfile: boolean) => {
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

    if (!refreshProfile) {
      setLoading(false)
      return
    }

    setLoading(true)
    const userProfile = await fetchProfile(nextSession.user.id)

    if (requestId !== requestIdRef.current) {
      return
    }

    if (!mountedRef.current) {
      return
    }

    setProfile(userProfile)
    setLoading(false)
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

        await syncSession(nextSession, shouldRefreshProfile)
      },
    )

    initializeAuth()

    return () => {
      mountedRef.current = false
      listener.subscription.unsubscribe()
    }
  }, [])

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
      isAdmin: Boolean(profile?.is_admin === true && profile.status === "active"),
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
