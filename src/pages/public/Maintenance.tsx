import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Lock, ShieldCheck, Wrench, X } from "lucide-react"
import { SiteLogo } from "@/components/common/SiteLogo"
import { ROUTES, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { supabase } from "@/integrations/supabase"

interface MaintenancePageProps {
  message: string
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "")
  }

  return "Não foi possível concluir o login agora."
}

function isNetworkLikeAuthError(message: string) {
  const normalized = message.trim().toLowerCase()
  return (
    normalized.includes("networkerror when attempting to fetch resource") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed")
  )
}

async function fallbackPasswordGrant(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload
        ? String(
            (payload as { msg?: unknown; error_description?: unknown; error?: unknown }).msg ??
              (payload as { error_description?: unknown }).error_description ??
              (payload as { error?: unknown }).error ??
              `Erro ${response.status}`,
          )
        : typeof payload === "string" && payload
          ? payload
          : `Erro ${response.status}`

    throw new Error(message)
  }

  const data = payload as { access_token?: string; refresh_token?: string }
  const accessToken = String(data.access_token ?? "").trim()
  const refreshToken = String(data.refresh_token ?? "").trim()

  if (!accessToken || !refreshToken) {
    throw new Error("Sessão de autenticação inválida. Tenta novamente.")
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    throw error
  }
}

export function MaintenancePage({ message }: MaintenancePageProps) {
  const navigate = useNavigate()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const normalizedEmail = email.trim()
      const normalizedPassword = password.trim()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      })

      if (signInError) {
        if (isNetworkLikeAuthError(signInError.message)) {
          await fallbackPasswordGrant(normalizedEmail, normalizedPassword)
        } else {
          throw signInError
        }
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!userId) {
        throw new Error("Sessão não foi criada. Tenta novamente.")
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin,role,status")
        .eq("id", userId)
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      const isAdmin =
        profile &&
        typeof profile === "object" &&
        (profile as { is_admin?: unknown }).is_admin === true &&
        (profile as { role?: unknown }).role === "admin" &&
        (profile as { status?: unknown }).status === "active"

      if (!isAdmin) {
        await supabase.auth.signOut()
        setError("Este acesso é exclusivo para administradores ativos.")
        return
      }

      setShowLoginModal(false)
      navigate(ROUTES.ADMIN, { replace: true })
    } catch (authError) {
      const message = extractErrorMessage(authError)
      setError(mapAuthErrorMessage(message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,44,64,0.16),transparent_34%),linear-gradient(180deg,#eef7fb_0%,#e3f0f6_52%,#f9fcfe_100%)] px-4 py-6 sm:px-6">
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <section className="w-full max-w-5xl rounded-[2rem] border border-[#d7e6ee] bg-white p-7 shadow-[0_30px_80px_rgba(18,63,89,0.12)] sm:p-10">
          <SiteLogo variant="dark" imageClassName="h-12 max-w-[220px]" />

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#cfe2eb] bg-[#eef7fb] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#24506a]">
            <Wrench className="h-3.5 w-3.5" />
            Modo manutenção
          </div>

          <h1 className="mt-5 font-display text-3xl font-bold leading-tight text-[#112f45] sm:text-4xl">
            Estamos a preparar melhorias na plataforma
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#456173]">{message}</p>

          <div className="mt-8 grid gap-3 text-sm text-[#36576b] sm:grid-cols-3">
            <div className="rounded-2xl border border-[#d9e8ef] bg-[#f7fbfd] p-4">
              <ShieldCheck className="h-4 w-4 text-[#0f5f74]" />
              <p className="mt-2 font-bold text-[#163d56]">Segurança preservada</p>
              <p className="mt-1 leading-6">A estrutura e os dados ficam protegidos durante os ajustes.</p>
            </div>
            <div className="rounded-2xl border border-[#d9e8ef] bg-[#f7fbfd] p-4">
              <Lock className="h-4 w-4 text-[#0f5f74]" />
              <p className="mt-2 font-bold text-[#163d56]">Acesso restrito</p>
              <p className="mt-1 leading-6">Apenas administradores autenticados conseguem operar normalmente.</p>
            </div>
            <div className="rounded-2xl border border-[#d9e8ef] bg-[#f7fbfd] p-4">
              <Wrench className="h-4 w-4 text-[#0f5f74]" />
              <p className="mt-2 font-bold text-[#163d56]">Retorno breve</p>
              <p className="mt-1 leading-6">Assim que concluir, o acesso público volta automaticamente.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#123f59] px-6 text-sm font-bold text-white transition hover:bg-[#0f3247]"
            >
              Login de admin
            </button>
          </div>
        </section>
      </div>

      {showLoginModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Acesso administrativo</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Entrar como admin</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false)
                  setError(null)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Fechar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              Usa as credenciais de administrador para aceder ao painel durante a manutenção.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleAdminLogin}>
              <div className="space-y-2">
                <label htmlFor="maintenance-admin-email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="maintenance-admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@email.com"
                  className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="maintenance-admin-password" className="text-sm font-medium text-slate-700">
                  Palavra-passe
                </label>
                <input
                  id="maintenance-admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  className="flex h-12 w-full rounded-xl border border-input bg-slate-50 px-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                />
              </div>

              {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#123f59] px-6 text-sm font-bold text-white transition hover:bg-[#0f3247] disabled:opacity-60"
              >
                {loading ? "A entrar..." : "Entrar no admin"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}



