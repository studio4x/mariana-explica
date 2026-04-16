import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import type { EmailOtpType } from "@supabase/supabase-js"
import { Button } from "@/components/ui"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { ROUTES } from "@/lib/constants"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"

type CallbackStatus = "verifying" | "finalizing" | "error"

const supportedOtpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
])

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getAuthCallbackParams(searchParams: URLSearchParams) {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))

  const read = (key: string) => searchParams.get(key) ?? hashParams.get(key)

  return {
    code: read("code"),
    tokenHash: read("token_hash"),
    type: read("type"),
    accessToken: read("access_token"),
    refreshToken: read("refresh_token"),
    errorCode: read("error_code"),
    errorDescription: read("error_description"),
  }
}

async function waitForProfile(userId: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,role,is_admin,status")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) {
      return data as {
        id: string
        role: "student" | "affiliate" | "admin"
        is_admin: boolean
        status: "active" | "inactive" | "blocked" | "pending_review"
      }
    }

    await sleep(500)
  }

  return null
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, profile, loading } = useAuth()
  const [status, setStatus] = useState<CallbackStatus>("verifying")
  const [error, setError] = useState<string | null>(null)
  const handledRef = useRef(false)
  const navigatedRef = useRef(false)

  const nextPath = useMemo(() => {
    const next = searchParams.get("next")
    if (!next || !next.startsWith("/")) {
      return ROUTES.DASHBOARD
    }

    return next
  }, [searchParams])

  useEffect(() => {
    if (handledRef.current) {
      return
    }

    handledRef.current = true

    const { code, tokenHash, type, accessToken, refreshToken, errorDescription } = getAuthCallbackParams(searchParams)

    async function handleCallback() {
      setStatus("verifying")
      setError(null)

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
        }
        return
      }

      if (tokenHash && type && supportedOtpTypes.has(type as EmailOtpType)) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        })

        if (otpError) {
          setStatus("error")
          setError(mapAuthErrorMessage(otpError.message))
        }
        return
      }

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (setSessionError) {
          setStatus("error")
          setError(mapAuthErrorMessage(setSessionError.message))
        }
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setStatus("error")
        setError("Nao foi possivel validar o teu acesso. Pede um novo email de confirmacao.")
      }
    }

    void handleCallback()
  }, [searchParams])

  useEffect(() => {
    if (!session || navigatedRef.current) {
      return
    }

    const currentSession = session
    let cancelled = false

    async function finalizeAccess() {
      setStatus("finalizing")

      if (loading) {
        return
      }

      const resolvedProfile =
        profile ??
        (await waitForProfile(currentSession.user.id))

      if (cancelled || navigatedRef.current) {
        return
      }

      if (!resolvedProfile) {
        setStatus("error")
        setError("A tua conta foi confirmada, mas o perfil ainda nao ficou pronto. Tenta entrar novamente dentro de instantes.")
        return
      }

      if (resolvedProfile.status !== "active") {
        setStatus("error")
        setError("A tua conta foi validada, mas ainda nao esta com acesso ativo. Se precisares, fala com o suporte.")
        return
      }

      window.sessionStorage.setItem(
        "mariana-explica:auth-flash",
        "Email confirmado com sucesso. Ja tens acesso ativo ao teu painel.",
      )
      navigatedRef.current = true
      navigate(
        resolvedProfile.is_admin && resolvedProfile.role === "admin"
          ? ROUTES.ADMIN
          : nextPath,
        { replace: true },
      )
    }

    void finalizeAccess()

    return () => {
      cancelled = true
    }
  }, [loading, navigate, nextPath, profile, session])

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Validacao da conta</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          {status === "error" ? "Nao foi possivel concluir a validacao" : "A confirmar o teu acesso"}
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          {status === "verifying"
            ? "Estamos a validar o link enviado para o teu email."
            : status === "finalizing"
              ? "A tua conta foi confirmada. Estamos a preparar a sessao para entrares diretamente no dashboard."
              : error}
        </p>
      </div>

      {status === "error" ? (
        <div className="space-y-3">
          <Button asChild className="w-full rounded-full" size="lg">
            <Link to={ROUTES.LOGIN}>Voltar ao login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full" size="lg">
            <Link to={ROUTES.REGISTER}>Criar conta novamente</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 text-sm leading-7 text-slate-600">
          Nao precisas de fazer login manualmente. Assim que a validacao terminar, vais entrar automaticamente.
        </div>
      )}
    </div>
  )
}
