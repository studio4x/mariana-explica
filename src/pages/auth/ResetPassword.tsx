import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui"
import { APP_NAME, ROUTES } from "@/lib/constants"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"

type ResetStatus = "verifying" | "ready" | "submitting" | "error"

function readRecoveryParams() {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const read = (key: string) => searchParams.get(key) ?? hashParams.get(key)

  return {
    type: read("type"),
    accessToken: read("access_token"),
    refreshToken: read("refresh_token"),
    tokenHash: read("token_hash"),
    code: read("code"),
    errorDescription: read("error_description"),
  }
}

export function ResetPassword() {
  const navigate = useNavigate()
  const { session, profile, loading } = useAuth()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<ResetStatus>("verifying")
  const [error, setError] = useState<string | null>(null)
  const handledRef = useRef(false)

  const hasRecoveryHash = useMemo(() => {
    if (typeof window === "undefined") {
      return false
    }

    return window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery")
  }, [])

  useEffect(() => {
    if (handledRef.current) {
      return
    }

    handledRef.current = true

    async function prepareRecoverySession() {
      const { type, accessToken, refreshToken, tokenHash, code, errorDescription } = readRecoveryParams()

      if (errorDescription) {
        setStatus("error")
        setError(mapAuthErrorMessage(errorDescription))
        return
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setStatus("error")
          setError(mapAuthErrorMessage(exchangeError.message))
          return
        }

        setStatus("ready")
        return
      }

      if (tokenHash && type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })

        if (verifyError) {
          setStatus("error")
          setError(mapAuthErrorMessage(verifyError.message))
          return
        }

        setStatus("ready")
        return
      }

      if (type === "recovery" && accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          setStatus("error")
          setError(mapAuthErrorMessage(sessionError.message))
          return
        }

        setStatus("ready")
        return
      }

      if (session?.user) {
        setStatus("ready")
        return
      }

      setStatus("error")
      setError("O link de redefinicao e invalido ou expirou. Pede um novo email para continuar.")
    }

    void prepareRecoverySession()
  }, [session])

  const blockedAccountMessage =
    status === "ready" && !loading && session?.user && profile && profile.status !== "active"
      ? "A tua conta existe, mas ainda nao esta com acesso ativo. Se precisares, fala com o suporte."
      : null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("A nova palavra-passe precisa de ter pelo menos 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("As palavras-passe nao coincidem.")
      return
    }

    setStatus("submitting")

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setStatus("ready")
      setError(mapAuthErrorMessage(updateError.message))
      return
    }

    window.sessionStorage.setItem(
      "mariana-explica:password-flash",
      "Palavra-passe redefinida com sucesso. O teu acesso ja ficou atualizado.",
    )

    navigate(
      profile?.is_admin && profile.role === "admin" ? ROUTES.ADMIN : ROUTES.DASHBOARD,
      { replace: true },
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Recuperacao de acesso</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          Redefine a tua palavra-passe na {APP_NAME}
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          {status === "verifying"
            ? "Estamos a validar o link enviado para o teu email."
            : "Define uma nova palavra-passe para voltares a entrar com seguranca."}
        </p>
      </div>

      {status === "error" || blockedAccountMessage ? (
        <div className="space-y-4">
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {blockedAccountMessage ?? error}
          </p>
          <Button asChild className="w-full rounded-full" size="lg">
            <Link to={ROUTES.LOGIN}>Voltar ao login</Link>
          </Button>
        </div>
      ) : status === "verifying" ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 text-sm leading-7 text-slate-600">
          Estamos a preparar um acesso seguro para redefinires a tua palavra-passe.
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!hasRecoveryHash && !session?.user ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Este acesso precisa de partir do link enviado para o teu email.
            </p>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Nova palavra-passe
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
              Confirmar nova palavra-passe
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

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

          <Button type="submit" className="w-full rounded-full" size="lg" disabled={status === "submitting"}>
            {status === "submitting" ? "A atualizar..." : "Guardar nova palavra-passe"}
          </Button>

          <div className="text-center text-sm text-slate-600">
            <Link to={ROUTES.LOGIN} className="font-semibold underline underline-offset-4 hover:text-primary">
              Voltar ao login
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
