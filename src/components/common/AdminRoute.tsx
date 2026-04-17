import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"
import { AdminSessionRecovery } from "./AdminSessionRecovery"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { session, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading && !session) {
    return <div className="p-8 text-center">Validando acesso administrativo...</div>
  }

  if (session && (loading || isAdmin)) {
    return <>{children}</>
  }

  if (!session) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    )
  }

  if (!profile || profile.status !== "active" || profile.is_admin !== true || profile.role !== "admin") {
    if (!profile) {
      return <AdminSessionRecovery />
    }

    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
