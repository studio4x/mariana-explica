import { useEffect, useRef, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
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
  }, [loading, profile, recovering, refreshSession, session])

  if (session && profile && isAdmin) {
    return <>{children}</>
  }

  if (!session) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  if (profile && !isAdmin) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  if (session && !profile && (loading || recovering || !recoveryAttemptedRef.current)) {
    return <div className="p-8 text-center">A validar acesso administrativo...</div>
  }

  return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
}
