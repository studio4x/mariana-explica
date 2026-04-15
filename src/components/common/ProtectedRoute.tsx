import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-8 text-center">Carregando sessão...</div>
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    )
  }

  return <>{children}</>
}
