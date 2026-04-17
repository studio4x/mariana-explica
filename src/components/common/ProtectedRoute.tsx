import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

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
    return <div className="p-8 text-center">Carregando sessao...</div>
  }

  if (!session) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  return <div className="p-8 text-center">A preparar o teu acesso...</div>
}
