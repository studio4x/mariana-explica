import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"
import { AdminSessionRecovery } from "./AdminSessionRecovery"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { session, profile, loading, isAdmin, refreshSession } = useAuth()
  const location = useLocation()
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryFailed, setRecoveryFailed] = useState(false)

  useEffect(() => {
    if (!session || profile || loading || isRecovering || recoveryFailed) {
      return
    }

    let cancelled = false

    const recover = async () => {
      setIsRecovering(true)
      const refreshed = await refreshSession()
      if (!cancelled) {
        setRecoveryFailed(!refreshed)
        setIsRecovering(false)
      }
    }

    void recover()

    return () => {
      cancelled = true
    }
  }, [session, profile, loading, isRecovering, recoveryFailed, refreshSession])

  if (loading && !session) {
    return <div className="p-8 text-center">Validando acesso administrativo...</div>
  }

  if (session && (loading || isRecovering)) {
    return <div className="p-8 text-center">A recarregar sessao administrativa...</div>
  }

  if (session && isAdmin) {
    return <>{children}</>
  }

  if (!session) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    )
  }

  if (!profile || profile.status !== "active" || profile.is_admin !== true || profile.role !== "admin") {
    if (!profile && !recoveryFailed) {
      return <div className="p-8 text-center">A recarregar sessao administrativa...</div>
    }

    if (!profile) {
      return <AdminSessionRecovery />
    }

    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
