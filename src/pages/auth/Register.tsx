import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { ROUTES, APP_NAME } from "@/lib/constants"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"

type SignUpResult = {
  user?: {
    email?: string | null
  } | null
}

function buildAuthCallbackUrl() {
  const normalizedBase = (import.meta.env.VITE_BASE_URL || "/").replace(/\/$/, "")
  const callbackPath = `${normalizedBase}${ROUTES.AUTH_CALLBACK}`.replace(/\/{2,}/g, "/")
  return `${window.location.origin}${callbackPath}`
}

export function Register() {
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && !pendingVerificationEmail) {
      navigate(isAdmin ? ROUTES.ADMIN : ROUTES.DASHBOARD, { replace: true })
    }
  }, [isAdmin, isAuthenticated, navigate, pendingVerificationEmail])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("As palavras-passe nao coincidem.")
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo: buildAuthCallbackUrl(),
      },
    })

    setLoading(false)

    if (error) {
      setError(mapAuthErrorMessage(error.message))
      return
    }

    const signUpData = data as SignUpResult | null
    setPendingVerificationEmail(signUpData?.user?.email ?? email)
    setPassword("")
    setConfirmPassword("")
    setName("")
    setEmail("")
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Criar conta</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
            Abre a tua conta na {APP_NAME}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            Cria a tua conta para comprar, receber acesso aos cursos e acompanhar tudo num unico lugar.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Nome completo
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="O seu nome"
              className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Palavra-passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                Confirmar
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="********"
                className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

          <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
            {loading ? "A criar conta..." : "Criar conta"}
          </Button>
        </form>

        <div className="text-center text-sm text-slate-600">
          Ja tens conta?{" "}
          <Link to={ROUTES.LOGIN} className="font-semibold underline underline-offset-4 hover:text-primary">
            Entrar
          </Link>
        </div>
      </div>

      {pendingVerificationEmail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Conta pendente de verificacao</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-950">
              Enviamos um email para ativares a tua conta
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              A conta foi criada e ficou pendente de verificacao. Enviamos um email para{" "}
              <span className="font-semibold text-slate-950">{pendingVerificationEmail}</span>.
              Clica no botao de validacao desse email para ativares a conta e entrares automaticamente no dashboard.
            </p>
            <div className="mt-6 space-y-3">
              <Button asChild className="w-full rounded-full" size="lg">
                <Link to={ROUTES.LOGIN}>Ir para o login</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                size="lg"
                onClick={() => setPendingVerificationEmail(null)}
              >
                Fechar aviso
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
