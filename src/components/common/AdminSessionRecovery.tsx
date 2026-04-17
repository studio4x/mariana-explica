import { AlertTriangle, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"

export function AdminSessionRecovery() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { refreshSession, signOut } = useAuth()
  const navigate = useNavigate()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setErrorMessage(null)

    const refreshed = await refreshSession()
    setIsRefreshing(false)

    if (refreshed) {
      navigate(ROUTES.ADMIN, { replace: true })
      return
    }

    setErrorMessage("Nao foi possivel recuperar a sessao agora. Tenta novamente em instantes.")
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-[2rem] border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950">Sessao do admin precisa ser recarregada</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          A validacao do perfil falhou, mas a tua sessao pode ainda estar valida. Recarrega a sessao para tentar
          recuperar o acesso sem te enviar diretamente para o login.
        </p>
        {errorMessage ? <p className="mt-4 text-sm text-rose-600">{errorMessage}</p> : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => void handleRefresh()} disabled={isRefreshing} className="rounded-full">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "A recarregar..." : "Recarregar sessao"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void signOut()}
            disabled={isRefreshing}
            className="rounded-full"
          >
            Ir para login
          </Button>
        </div>
      </div>
    </div>
  )
}
