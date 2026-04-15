import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-8 text-center">Validando acesso administrativo...</div>
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    )
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return <>{children}</>
}
