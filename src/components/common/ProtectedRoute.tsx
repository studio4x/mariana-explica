import { useEffect, useRef, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, profile, loading, isAdmin, refreshSession } = useAuth()
  const location = useLocation()
  const recoveryAttemptedRef = useRef(false)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!session || profile || loading || recoveryAttemptedRef.current || recovering) {
      return
    }

    recoveryAttemptedRef.current = true
    setRecovering(true)

    void (async () => {
      try {
        await refreshSession()
      } finally {
        setRecovering(false)
      }
    })()
  }, [loading, profile, refreshSession, recovering, session])

  if (session && profile) {
    if (isAdmin) {
      return <Navigate to={ROUTES.ADMIN} replace />
    }

    if (profile.status !== "active") {
      return <Navigate to={ROUTES.HOME} replace />
    }

    return <>{children}</>
  }

  if (loading) {
    return <div className="p-8 text-center">Carregando sessão...</div>
  }

  if (recovering) {
    return <div className="p-8 text-center">A validar o teu acesso...</div>
  }

  if (!session) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
}
