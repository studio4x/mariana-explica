import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { supabase } from "@/integrations/supabase"
import type { Session, User } from "@supabase/supabase-js"

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_admin: boolean
  status: string
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,is_admin,status")
    .eq("id", userId)
    .single()

  if (error || !data) {
    return null
  }

  return data as UserProfile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) {
        return
      }

      const currentSession = data.session
      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        const userProfile = await fetchProfile(currentSession.user.id)
        if (mounted) {
          setProfile(userProfile)
        }
      }

      setLoading(false)
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) {
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          const userProfile = await fetchProfile(session.user.id)
          if (mounted) {
            setProfile(userProfile)
          }
        } else {
          setProfile(null)
        }
      },
    )

    initializeAuth()

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
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
      isAuthenticated: Boolean(user),
      isAdmin: profile?.is_admin === true,
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
