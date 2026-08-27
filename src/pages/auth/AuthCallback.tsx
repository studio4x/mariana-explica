import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import type { EmailOtpType } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { ROUTES } from "@/lib/constants"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"

type CallbackStatus = "verifying" | "finalizing" | "error"

const loadingMessages: Record<Exclude<CallbackStatus, "error">, string[]> = {
  verifying: [
    "A validar o link de confirmação...",
    "A confirmar o teu email...",
    "A criar uma sessão segura...",
  ],
  finalizing: [
    "Email confirmado. A preparar o teu perfil...",
    "A organizar a tua área do aluno...",
    "Quase pronto. A entrar automaticamente...",
  ],
}

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

async function waitForSession() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      return data.session
    }

    await sleep(300)
  }

  return null
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
  const [loadingProgress, setLoadingProgress] = useState<{
    status: Exclude<CallbackStatus, "error">
    index: number
  }>({ status: "verifying", index: 0 })
  const [error, setError] = useState<string | null>(null)
  const handledRef = useRef(false)
  const navigatedRef = useRef(false)
  const silentMode = searchParams.get("silent") === "1"

  const nextPath = useMemo(() => {
    const next = searchParams.get("next")
    if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
      return ROUTES.DASHBOARD
    }

    return next
  }, [searchParams])
  const loadingMessageIndex =
    status !== "error" && loadingProgress.status === status ? loadingProgress.index : 0

  useEffect(() => {
    if (status === "error") {
      return
    }

    const messageCount = loadingMessages[status].length
    const intervalId = window.setInterval(() => {
      setLoadingProgress((current) => ({
        status,
        index: Math.min((current.status === status ? current.index : 0) + 1, messageCount - 1),
      }))
    }, 1_800)

    return () => window.clearInterval(intervalId)
  }, [status])

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
          return
        }

        const resolvedSession = await waitForSession()
        if (!resolvedSession) {
          setStatus("error")
          setError("A tua conta foi confirmada, mas a sessão não ficou pronta. Tenta abrir novamente o link do email.")
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
          return
        }

        const resolvedSession = await waitForSession()
        if (!resolvedSession) {
          setStatus("error")
          setError("A tua conta foi confirmada, mas a sessão não ficou pronta. Tenta abrir novamente o link do email.")
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
          return
        }

        const resolvedSession = await waitForSession()
        if (!resolvedSession) {
          setStatus("error")
          setError("A tua conta foi confirmada, mas a sessão não ficou pronta. Tenta abrir novamente o link do email.")
        }
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setStatus("error")
        setError("Não foi possível validar o teu acesso. Pede um novo email de confirmação.")
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
        setError("A tua conta foi confirmada, mas o perfil ainda não ficou pronto. Tenta entrar novamente dentro de instantes.")
        return
      }

      if (resolvedProfile.status !== "active") {
        setStatus("error")
        setError("A tua conta foi validada, mas ainda não esta com acesso ativo. Se precisares, fala com o suporte.")
        return
      }

      window.sessionStorage.setItem(
        "mariana-explica:auth-flash",
        "Email confirmado com sucesso. Já tens acesso ativo ao teu painel.",
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

  useEffect(() => {
    if (!silentMode || status !== "error" || navigatedRef.current) {
      return
    }

    navigatedRef.current = true
    navigate(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(nextPath)}`, { replace: true })
  }, [navigate, nextPath, silentMode, status])

  if (silentMode && status !== "error") {
    return <div className="min-h-[30vh]" aria-hidden="true" />
  }

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Verificação da conta</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
          {status === "error"
            ? "Não foi possível concluir a verificação"
            : status === "verifying"
              ? "Estamos a confirmar o teu email"
              : "Estamos a preparar o teu acesso"}
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          {status === "verifying"
            ? "Estamos a validar o link enviado para o teu email."
            : status === "finalizing"
              ? "A tua conta na Mariana Explica está quase pronta. Estamos a preparar a sessão para entrares automaticamente na tua área do aluno."
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
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600"
        >
          <div className="flex flex-col items-center">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-sky-200/70 motion-safe:animate-ping"
              />
              <Loader2 aria-hidden="true" className="relative h-7 w-7 motion-safe:animate-spin" />
            </div>

            <p className="mt-4 font-semibold text-slate-800">
              {loadingMessages[status][loadingMessageIndex]}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Este processo pode demorar alguns segundos. Mantém esta página aberta.
            </p>

            <div aria-hidden="true" className="mt-4 flex items-center gap-2">
              {loadingMessages[status].map((message, index) => (
                <span
                  key={message}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    index <= loadingMessageIndex ? "w-6 bg-sky-600" : "w-1.5 bg-slate-300"
                  }`}
                />
              ))}
            </div>

            <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              Não precisas de fazer login manualmente. Quando terminarmos, vais entrar automaticamente na tua área do aluno.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
