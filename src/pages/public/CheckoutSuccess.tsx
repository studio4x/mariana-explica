import { useEffect, useRef, useState } from "react"
import { Navigate, useLocation, useSearchParams } from "react-router-dom"
import { BadgeCheck, BookOpenCheck, CheckCircle2, ShieldCheck } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"
import { studentCoursePath } from "@/lib/routes"
import { createCheckoutAutologin } from "@/services"
import {
  EditableButton,
  EditableText,
  SiteContentScope,
  VisualEditorProvider,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type CheckoutSuccessVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"

function CheckoutSuccessPageContent() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { session, profile, loading } = useAuth()
  const { document } = useVisualEditorPage()
  const visualDocument =
    (document as CheckoutSuccessVisualEditorDocument | undefined) ?? CHECKOUT_SUCCESS_VISUAL_EDITOR_DEFAULT_DOCUMENT
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

  if (loading || autologinInProgress || (shouldTryAutologin && !autologinAttempted)) {
    return <div className="min-h-[35vh]" aria-hidden="true" />
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
          <SiteContentScope title="Hero" description="Mensagem de confirmação e resumo">
            <div className="bg-[#242742] px-6 py-10 text-white md:px-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <EditableText
                    fieldKey="hero.eyebrow"
                    as="p"
                    fallback={visualDocument.hero.eyebrow}
                    className="text-xs font-bold uppercase tracking-[0.24em] text-[#e9bf94]"
                  />
                  <EditableText
                    fieldKey="hero.title"
                    as="h1"
                    fallback={visualDocument.hero.title}
                    className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl"
                  />
                  <EditableText
                    fieldKey="hero.lead"
                    as="p"
                    fallback={visualDocument.hero.lead}
                    className="mt-4 max-w-2xl text-base leading-8 text-white/78"
                  />
                </div>
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#e9bf94]">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>
            </div>
          </SiteContentScope>

          <div className="grid gap-6 p-6 md:grid-cols-[1fr_0.85fr] md:p-10">
            <SiteContentScope title="Próximo passo" description="Resumo de acesso e confirmação">
              <div className="space-y-5">
                <div className="rounded-lg border border-[#dee3e5] bg-[#f5fafc] p-5">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-[#3a618b]" />
                    <div>
                      <EditableText
                        fieldKey="nextStep.title"
                        as="h2"
                        fallback={visualDocument.nextStep.title}
                        className="font-display text-xl font-bold text-[#0f122c]"
                      />
                      <EditableText
                        fieldKey="nextStep.lead"
                        as="p"
                        fallback={visualDocument.nextStep.lead}
                        className="mt-2 text-sm leading-7 text-[#46464d]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#dee3e5] p-4">
                    <BookOpenCheck className="h-5 w-5 text-[#3a618b]" />
                    <EditableText
                      fieldKey="benefits.firstTitle"
                      as="p"
                      fallback={visualDocument.benefits.firstTitle}
                      className="mt-3 text-sm font-bold text-[#0f122c]"
                    />
                    <EditableText
                      fieldKey="benefits.firstLead"
                      as="p"
                      fallback={visualDocument.benefits.firstLead}
                      className="mt-1 text-sm leading-6 text-[#46464d]"
                    />
                  </div>
                  <div className="rounded-lg border border-[#dee3e5] p-4">
                    <ShieldCheck className="h-5 w-5 text-[#3a618b]" />
                    <EditableText
                      fieldKey="benefits.secondTitle"
                      as="p"
                      fallback={visualDocument.benefits.secondTitle}
                      className="mt-3 text-sm font-bold text-[#0f122c]"
                    />
                    <EditableText
                      fieldKey="benefits.secondLead"
                      as="p"
                      fallback={visualDocument.benefits.secondLead}
                      className="mt-1 text-sm leading-6 text-[#46464d]"
                    />
                  </div>
                </div>
              </div>
            </SiteContentScope>

            <SiteContentScope title="Acesso rápido" description="Botões de navegação final">
              <aside className="rounded-lg bg-[#eef4f6] p-6">
                <EditableText
                  fieldKey="access.eyebrow"
                  as="p"
                  fallback={visualDocument.access.eyebrow}
                  className="text-xs font-bold uppercase tracking-[0.2em] text-[#46464d]"
                />
                <div className="mt-5 space-y-3">
                  <EditableButton
                    fieldKey="access.primaryCtaLabel"
                    fallback={{ label: visualDocument.access.primaryCtaLabel, href: courseHref }}
                    className="h-12 w-full rounded-lg bg-[#B8926A] text-white hover:bg-[#a6825d]"
                  />
                  <EditableButton
                    fieldKey="access.secondaryCtaLabel"
                    fallback={{ label: visualDocument.access.secondaryCtaLabel, href: ROUTES.DASHBOARD }}
                    variant="secondary"
                    className="h-12 w-full rounded-lg bg-white"
                  />
                </div>
                <EditableText
                  fieldKey="access.note"
                  as="p"
                  fallback={visualDocument.access.note}
                  className="mt-5 text-xs leading-6 text-[#46464d]"
                />
              </aside>
            </SiteContentScope>
          </div>
        </div>
      </section>
    </div>
  )
}

export function CheckoutSuccess() {
  return (
    <VisualEditorProvider pageKey="checkout-success">
      <CheckoutSuccessPageContent />
    </VisualEditorProvider>
  )
}
