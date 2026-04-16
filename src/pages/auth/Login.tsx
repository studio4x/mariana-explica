import { useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { ROUTES, APP_NAME } from "@/lib/constants"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isAdmin } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? ROUTES.ADMIN : ROUTES.DASHBOARD, { replace: true })
    }
  }, [isAdmin, isAuthenticated, navigate])

  const redirectPath =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    (isAdmin ? ROUTES.ADMIN : ROUTES.DASHBOARD)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(mapAuthErrorMessage(error.message))
      return
    }

    navigate(isAdmin ? ROUTES.ADMIN : redirectPath, { replace: true })
  }

  const handleOpenForgotPassword = () => {
    setForgotPasswordEmail(email)
    setForgotPasswordMessage(null)
    setShowForgotPassword(true)
  }

  const handleSendRecovery = async () => {
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordMessage("Indica primeiro o teu email para receber o link de recuperacao.")
      return
    }

    setForgotPasswordLoading(true)
    setForgotPasswordMessage(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail.trim(), {
      redirectTo: `${window.location.origin}${ROUTES.RESET_PASSWORD}`,
    })

    setForgotPasswordLoading(false)

    if (resetError) {
      setForgotPasswordMessage(mapAuthErrorMessage(resetError.message))
      return
    }

    setForgotPasswordMessage(
      "Enviamos um email de recuperacao. Abre o link recebido para redefinires a tua palavra-passe com seguranca.",
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Entrar</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          Continua o teu acesso na {APP_NAME}
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Entra para abrir os teus produtos, downloads e notificacoes sem perder o contexto do estudo.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Palavra-passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
          {loading ? "A entrar..." : "Entrar"}
        </Button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={handleOpenForgotPassword}
          className="text-sm font-semibold text-slate-700 underline underline-offset-4 transition hover:text-primary"
        >
          Esqueci a minha palavra-passe
        </button>
      </div>

      <div className="text-center text-sm text-slate-600">
        Ainda nao tens conta?{" "}
        <Link to={ROUTES.REGISTER} className="font-semibold underline underline-offset-4 hover:text-primary">
          Criar conta
        </Link>
      </div>

      {showForgotPassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Recuperar acesso</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-950">
              Enviamos um link seguro para redefinires a tua palavra-passe
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Confirma o email da tua conta. Se existir acesso associado, enviamos um link que te leva diretamente para a redefinicao.
            </p>

            <div className="mt-5 space-y-2">
              <label htmlFor="forgotPasswordEmail" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="forgotPasswordEmail"
                type="email"
                autoComplete="email"
                value={forgotPasswordEmail}
                onChange={(event) => setForgotPasswordEmail(event.target.value)}
                placeholder="seu@email.com"
                className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {forgotPasswordMessage ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {forgotPasswordMessage}
              </p>
            ) : null}

            <div className="mt-6 space-y-3">
              <Button
                type="button"
                className="w-full rounded-full"
                size="lg"
                disabled={forgotPasswordLoading}
                onClick={() => void handleSendRecovery()}
              >
                {forgotPasswordLoading ? "A enviar..." : "Enviar link de recuperacao"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                size="lg"
                onClick={() => setShowForgotPassword(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
