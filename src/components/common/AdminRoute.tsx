import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (session && profile) {
    if (profile.status !== "active" || profile.is_admin !== true || profile.role !== "admin") {
      return <Navigate to={ROUTES.HOME} replace />
    }

    return <>{children}</>
  }

  if (loading) {
    return <div className="p-8 text-center">Validando acesso administrativo...</div>
  }

  if (!session) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <div className="p-8 text-center">A preparar o acesso administrativo...</div>
}
