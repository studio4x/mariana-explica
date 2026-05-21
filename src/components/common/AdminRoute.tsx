import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { session, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (session && profile && isAdmin) {
    return <>{children}</>
  }

  if (!session) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  if (profile && !isAdmin) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  if (loading) {
    return null
  }

  return null
}
