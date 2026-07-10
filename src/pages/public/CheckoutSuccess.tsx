import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui"
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom"
import { BadgeCheck, BookOpenCheck, CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { resolveCheckoutSuccessCopy } from "@/lib/checkout-copy"
import { ROUTES } from "@/lib/constants"
import { studentCoursePath } from "@/lib/routes"
import { createCheckoutAutologin } from "@/services"
import {
  EditableContainer,
  SiteContentScope,
  VisualEditorProvider,
  useOptionalVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type CheckoutSuccessVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"

function CheckoutProcessingModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f122c]/55 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-processing-title"
        aria-describedby="checkout-processing-description"
        className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 text-center shadow-[0_24px_80px_-40px_rgba(15,18,44,0.7)] sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#242742]/10 text-[#242742]">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[#8c6a45]">
          Compra em processamento
        </p>
        <h2 id="checkout-processing-title" className="mt-3 font-display text-2xl font-bold text-[#0f122c]">
          A tua compra está a ser processada
        </h2>
        <p id="checkout-processing-description" className="mt-3 text-sm leading-7 text-[#46464d]">
          Estamos a confirmar o pagamento e a preparar o teu acesso. Mantém esta página aberta enquanto tudo fica
          pronto.
        </p>
      </div>
    </div>
  )
}

function CheckoutSuccessPageContent() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session, profile, loading } = useAuth()
  const visualEditorPage = useOptionalVisualEditorPage()
  const visualDocument =
    (visualEditorPage?.document as CheckoutSuccessVisualEditorDocument | undefined) ??
    CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT
  const productId = searchParams.get("product_id") ?? ""
  const sessionId = searchParams.get("session_id") ?? ""
  const mode = searchParams.get("mode") ?? "stripe"
  const courseHref = productId ? studentCoursePath(productId) : ROUTES.DASHBOARD
  const redirectPath = `${location.pathname}${location.search}`
  const loginRedirectHref = `${ROUTES.LOGIN}?redirect=${encodeURIComponent(redirectPath)}`
  const autologinAttemptedRef = useRef(false)
  const [autologinInProgress, setAutologinInProgress] = useState(false)
  const [autologinAttempted, setAutologinAttempted] = useState(false)
  const shouldTryAutologin = !session && mode === "stripe" && Boolean(sessionId)
  const isProcessingCheckout = loading || autologinInProgress || (shouldTryAutologin && !autologinAttempted)
  const successCopy = resolveCheckoutSuccessCopy(visualDocument, mode)

  useEffect(() => {
    if (loading || (session && profile?.status === "active")) {
      return
    }

    if (autologinAttemptedRef.current) {
      return
    }

    if (!sessionId || mode !== "stripe") {
      return
    }

    autologinAttemptedRef.current = true
    setAutologinAttempted(true)
    setAutologinInProgress(true)

    void (async () => {
      try {
        const response = await createCheckoutAutologin({
          checkoutSessionId: sessionId,
          productId: productId || undefined,
          nextPath: redirectPath,
        })

        window.location.assign(response.autologin_url)
      } catch {
        // fallback para o login manual abaixo
      } finally {
        setAutologinInProgress(false)
      }
    })()
  }, [loading, mode, productId, profile?.status, redirectPath, session, sessionId])

  if (isProcessingCheckout) {
    return <CheckoutProcessingModal />
  }

  if (!session || !profile || profile.status !== "active") {
    return <Navigate to={loginRedirectHref} replace />
  }

  return (
    <SiteContentScope title="Espaco da pagina" description="Ajusta o respiro entre o header e o conteudo">
      <EditableContainer fieldKey="layout.pageFrame" as="div" className="bg-[#f5fafc] px-4 py-14 text-[#171c1e] md:py-20">
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
                  {successCopy.hero.eyebrow}
                </p>
                <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl">
                  {successCopy.hero.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/78">{successCopy.hero.lead}</p>
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
                    <h2 className="font-display text-xl font-bold text-[#0f122c]">
                      {successCopy.nextStep.title}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[#46464d]">{successCopy.nextStep.lead}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#dee3e5] p-4">
                  <BookOpenCheck className="h-5 w-5 text-[#3a618b]" />
                  <p className="mt-3 text-sm font-bold text-[#0f122c]">{successCopy.benefits.firstTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-[#46464d]">{successCopy.benefits.firstLead}</p>
                </div>
                <div className="rounded-lg border border-[#dee3e5] p-4">
                  <ShieldCheck className="h-5 w-5 text-[#3a618b]" />
                  <p className="mt-3 text-sm font-bold text-[#0f122c]">{successCopy.benefits.secondTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-[#46464d]">{successCopy.benefits.secondLead}</p>
                </div>
              </div>
            </div>

            <aside className="rounded-lg bg-[#eef4f6] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#46464d]">
                {successCopy.access.eyebrow}
              </p>
              <div className="mt-5 space-y-3">
                <Button asChild className="h-12 w-full rounded-lg bg-[#B8926A] text-white hover:bg-[#a6825d]">
                  <Link to={courseHref}>{successCopy.access.primaryCtaLabel}</Link>
                </Button>
                <Button asChild variant="secondary" className="h-12 w-full rounded-lg bg-white">
                  <Link to={ROUTES.DASHBOARD}>{successCopy.access.secondaryCtaLabel}</Link>
                </Button>
              </div>
              <p className="mt-5 text-xs leading-6 text-[#46464d]">{successCopy.access.note}</p>
            </aside>
          </div>
        </div>
        </section>
      </EditableContainer>
    </SiteContentScope>
  )
}

export function CheckoutSuccess() {
  return (
    <VisualEditorProvider pageKey="checkout-success">
      <CheckoutSuccessPageContent />
    </VisualEditorProvider>
  )
}
