import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom"
import { ArrowRight, BadgeCheck, BookOpenCheck, CheckCircle2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"
import { studentCoursePath } from "@/lib/routes"

export function CheckoutSuccess() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session, profile, loading } = useAuth()
  const productId = searchParams.get("product_id") ?? ""
  const sessionId = searchParams.get("session_id") ?? ""
  const mode = searchParams.get("mode") ?? "stripe"
  const courseHref = productId ? studentCoursePath(productId) : ROUTES.DASHBOARD
  const redirectPath = `${location.pathname}${location.search}`
  const loginRedirectHref = `${ROUTES.LOGIN}?redirect=${encodeURIComponent(redirectPath)}`

  if (loading) {
    return <div className="p-8 text-center">A validar o teu acesso...</div>
  }

  if (!session || !profile || profile.status !== "active") {
    return <Navigate to={loginRedirectHref} replace />
  }

  return (
    <div className="bg-[#f5fafc] px-4 py-14 text-[#171c1e] md:py-20">
      <section
        className="container"
        data-conversion-event="checkout_success"
        data-checkout-provider={mode === "free" ? "internal" : "stripe"}
        data-stripe-session-id={sessionId}
        data-product-id={productId}
      >
        <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-[#dee3e5] bg-white shadow-[0_20px_70px_-45px_rgba(15,18,44,0.45)]">
          <div className="bg-[#242742] px-6 py-10 text-white md:px-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e9bf94]">
                  Checkout concluido
                </p>
                <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl">
                  A tua inscricao foi recebida com sucesso.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/78">
                  O acesso ao curso sera apresentado na area do aluno assim que a confirmacao de pagamento estiver
                  refletida na plataforma.
                </p>
              </div>
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#e9bf94]">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-[1fr_0.85fr] md:p-10">
            <div className="space-y-5">
              <div className="rounded-lg border border-[#dee3e5] bg-[#f5fafc] p-5">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-[#3a618b]" />
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#0f122c]">Proximo passo</h2>
                    <p className="mt-2 text-sm leading-7 text-[#46464d]">
                      Entra diretamente no curso para verificar o acesso e continuar a tua jornada de estudo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#dee3e5] p-4">
                  <BookOpenCheck className="h-5 w-5 text-[#3a618b]" />
                  <p className="mt-3 text-sm font-bold text-[#0f122c]">Curso organizado</p>
                  <p className="mt-1 text-sm leading-6 text-[#46464d]">
                    Aulas e materiais ficam reunidos na area do aluno.
                  </p>
                </div>
                <div className="rounded-lg border border-[#dee3e5] p-4">
                  <ShieldCheck className="h-5 w-5 text-[#3a618b]" />
                  <p className="mt-3 text-sm font-bold text-[#0f122c]">Acesso protegido</p>
                  <p className="mt-1 text-sm leading-6 text-[#46464d]">
                    A liberacao e validada pelo backend e pelo Stripe.
                  </p>
                </div>
              </div>
            </div>

            <aside className="rounded-lg bg-[#eef4f6] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#46464d]">Acesso rapido</p>
              <div className="mt-5 space-y-3">
                <Button asChild className="h-12 w-full rounded-lg bg-[#B8926A] text-white hover:bg-[#a6825d]">
                  <Link to={courseHref}>
                    Ir para o curso
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 w-full rounded-lg bg-white">
                  <Link to={ROUTES.DASHBOARD}>Abrir area do aluno</Link>
                </Button>
              </div>
              <p className="mt-5 text-xs leading-6 text-[#46464d]">
                Se o curso ainda nao aparecer, aguarda alguns segundos e atualiza a area do aluno. A confirmacao depende
                do retorno do Stripe.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
