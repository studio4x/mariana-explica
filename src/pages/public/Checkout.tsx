import { useCallback, useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Lock,
  LogIn,
  ShieldCheck,
  UserCircle,
  UserPlus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui"
import { FooterCopyright } from "@/components/common"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { claimFreeProduct, createCheckoutSession, isFreeProduct } from "@/services"
import { formatProductPrice } from "@/utils/currency"
import { richTextToPlainText } from "@/lib/rich-text"

const CHECKOUT_DRAFT_STORAGE_KEY = "mariana-explica:checkout-draft"
const CHECKOUT_INTENT_STORAGE_KEY = "mariana-explica:checkout-intent"

interface CheckoutDraft {
  fullName: string
  email: string
  confirmEmail: string
  invoiceWithNif: boolean
  nif: string
  contentUpdatesConsent: boolean
  acceptTerms: boolean
}

type AuthTarget = "login" | "register"

const emptyDraft: CheckoutDraft = {
  fullName: "",
  email: "",
  confirmEmail: "",
  invoiceWithNif: false,
  nif: "",
  contentUpdatesConsent: false,
  acceptTerms: false,
}

function loadCheckoutDraft() {
  if (typeof window === "undefined") {
    return emptyDraft
  }

  const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)
  if (!raw) {
    return emptyDraft
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft> | null
    if (!parsed || typeof parsed !== "object") {
      return emptyDraft
    }

    return {
      fullName: String(parsed.fullName ?? ""),
      email: String(parsed.email ?? ""),
      confirmEmail: String(parsed.confirmEmail ?? ""),
      invoiceWithNif: Boolean(parsed.invoiceWithNif),
      nif: String(parsed.nif ?? ""),
      contentUpdatesConsent: Boolean(parsed.contentUpdatesConsent),
      acceptTerms: Boolean(parsed.acceptTerms),
    }
  } catch {
    return emptyDraft
  }
}

function persistCheckoutDraft(draft: CheckoutDraft) {
  window.sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

function clearCheckoutDraft() {
  window.sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY)
}

function persistCheckoutIntent(target: AuthTarget) {
  window.sessionStorage.setItem(CHECKOUT_INTENT_STORAGE_KEY, target)
}

function clearCheckoutIntent() {
  window.sessionStorage.removeItem(CHECKOUT_INTENT_STORAGE_KEY)
}

function readCheckoutIntent() {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.sessionStorage.getItem(CHECKOUT_INTENT_STORAGE_KEY)
  return value === "login" || value === "register" ? value : null
}

function preloadAuthPages() {
  void import("@/pages/auth")
}

function getCheckoutBadge(productType: string) {
  if (productType === "free") return "MATERIAL GRATUITO"
  if (productType === "external_service") return "APOIO PERSONALIZADO"
  return "CURSO COMPLETO"
}

function stripDigits(value: string) {
  return value.replace(/\D/g, "")
}

function formatNif(value: string) {
  const digits = stripDigits(value).slice(0, 9)
  return digits
    .replace(/^(\d{3})(\d)/, "$1 $2")
    .replace(/^(\d{3}) (\d{3})(\d)/, "$1 $2 $3")
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidNif(value: string) {
  const digits = stripDigits(value)
  if (digits.length !== 9) {
    return false
  }

  if (/^(\d)\1{8}$/.test(digits)) {
    return false
  }

  return true
}

function TermsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Termos e condições</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Antes de avançar</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-6 text-sm leading-7 text-slate-600">
          <p>
            Ao continuar, confirmas que leste e aceitas os termos de uso, a política de privacidade e as condições
            comerciais apresentadas para este curso.
          </p>
          <ul className="space-y-2">
            <li>• O pagamento é processado pela Stripe e validado no backend.</li>
            <li>• O acesso ao conteúdo depende da confirmação do pagamento.</li>
            <li>• Os teus dados são tratados para operacionalizar a compra e o acesso.</li>
          </ul>
          <p>
            Podes rever o texto completo na página oficial de termos antes de concluir.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className="rounded-full">
              <Link to={ROUTES.TERMS}>Ler termos completos</Link>
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Checkout() {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get("slug") ?? undefined
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile } = useAuth()
  const { data: product, isLoading, isError, error, refetch } = usePublishedProductBySlug(slug)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [draft, setDraft] = useState<CheckoutDraft>(() => loadCheckoutDraft())

  const loginHref = `${ROUTES.LOGIN}?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`
  const registerHref = `${ROUTES.REGISTER}?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`

  useEffect(() => {
    persistCheckoutDraft(draft)
  }, [draft])

  useEffect(() => {
    preloadAuthPages()
  }, [])

  useEffect(() => {
    if (!profile) {
      return
    }

    setDraft((current) => ({
      ...current,
      fullName: current.fullName || profile.full_name || "",
      email: current.email || profile.email || "",
      confirmEmail: current.confirmEmail || profile.email || current.email || "",
      invoiceWithNif: current.invoiceWithNif || Boolean(profile.nif),
      nif: current.nif || profile.nif || "",
      contentUpdatesConsent: current.contentUpdatesConsent || profile.content_updates_consent || false,
    }))
  }, [profile])

  const checkoutIdentifier = product?.slug?.trim() || product?.id || ""
  const successUrl = checkoutIdentifier
    ? `${window.location.origin}${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product?.id ?? "")}&slug=${encodeURIComponent(checkoutIdentifier)}&session_id={CHECKOUT_SESSION_ID}`
    : ""
  const cancelUrl = checkoutIdentifier
    ? `${window.location.origin}${location.pathname}${location.search}&checkout=cancelled`
    : ""

  const isAuthenticatedAndActive = Boolean(session && profile?.status === "active")
  const trimmedName = draft.fullName.trim()
  const trimmedEmail = draft.email.trim()
  const trimmedConfirmEmail = draft.confirmEmail.trim()
  const emailMatches = trimmedEmail.toLowerCase() === trimmedConfirmEmail.toLowerCase()
  const canSubmitCheckout =
    Boolean(trimmedName) &&
    isValidEmail(trimmedEmail) &&
    emailMatches &&
    (!draft.invoiceWithNif || isValidNif(draft.nif)) &&
    draft.acceptTerms

  const handleAuthNavigation = useCallback(
    (target: AuthTarget) => {
      persistCheckoutIntent(target)
      navigate(target === "login" ? loginHref : registerHref, {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
          },
          checkoutDraft: {
            fullName: draft.fullName,
            email: draft.email,
            invoiceWithNif: draft.invoiceWithNif,
            nif: draft.nif,
            contentUpdatesConsent: draft.contentUpdatesConsent,
          },
        },
      })
    },
    [
      draft.contentUpdatesConsent,
      draft.email,
      draft.fullName,
      draft.invoiceWithNif,
      draft.nif,
      location.pathname,
      location.search,
      loginHref,
      navigate,
      registerHref,
    ],
  )

  const handleCheckout = useCallback(async () => {
    if (!product) {
      return
    }

    setSubmitError(null)

    if (!trimmedName) {
      setSubmitError("Indica o teu nome completo.")
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setSubmitError("Indica um email válido.")
      return
    }

    if (!emailMatches) {
      setSubmitError("O email e a confirmação de email precisam de coincidir.")
      return
    }

    if (draft.invoiceWithNif && !isValidNif(draft.nif)) {
      setSubmitError("Indica um NIF válido.")
      return
    }

    if (!draft.acceptTerms) {
      setSubmitError("Aceita os termos e condições para continuar.")
      return
    }

    if (!isAuthenticatedAndActive) {
      handleAuthNavigation("login")
      return
    }

    setSubmitting(true)

    try {
      if (isFreeProduct(product)) {
        await claimFreeProduct({ productId: product.id })
        clearCheckoutDraft()
        clearCheckoutIntent()
        navigate(
          `${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product.id)}&slug=${encodeURIComponent(checkoutIdentifier)}&mode=free`,
          { replace: true },
        )
        return
      }

      const result = await createCheckoutSession({
        productId: product.id,
        customerEmail: trimmedEmail,
        customerNif: draft.invoiceWithNif ? stripDigits(draft.nif) : null,
        invoiceWithNif: draft.invoiceWithNif,
        contentUpdatesConsent: draft.contentUpdatesConsent,
        successUrl,
        cancelUrl,
      })

      if (result.mode === "stripe" && result.checkout_url) {
        clearCheckoutDraft()
        clearCheckoutIntent()
        window.location.assign(result.checkout_url)
        return
      }

      clearCheckoutDraft()
      clearCheckoutIntent()
      navigate(
        `${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product.id)}&slug=${encodeURIComponent(checkoutIdentifier)}&mode=internal`,
        { replace: true },
      )
    } catch (checkoutError) {
      setSubmitError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Nao foi possivel iniciar o pagamento. Tenta novamente dentro de instantes.",
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    cancelUrl,
    checkoutIdentifier,
    draft.acceptTerms,
    draft.contentUpdatesConsent,
    draft.invoiceWithNif,
    draft.nif,
    handleAuthNavigation,
    isAuthenticatedAndActive,
    emailMatches,
    navigate,
    product,
    successUrl,
    trimmedEmail,
    trimmedName,
  ])

  useEffect(() => {
    if (!product || !isAuthenticatedAndActive || submitting || !canSubmitCheckout) {
      return
    }

    if (readCheckoutIntent() !== "login" && readCheckoutIntent() !== "register") {
      return
    }

    clearCheckoutIntent()
    void handleCheckout()
  }, [canSubmitCheckout, handleCheckout, isAuthenticatedAndActive, product, submitting])

  if (!slug) {
    return (
      <EmptyState
        title="Checkout sem curso"
        message="Abre um curso primeiro e segue para o checkout para continuar."
      />
    )
  }

  if (isLoading) {
    return <LoadingState message="A preparar checkout..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel preparar o checkout"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!product) {
    return (
      <EmptyState
        title="Curso nao encontrado"
        message="O item escolhido nao esta publicado ou deixou de estar disponivel."
      />
    )
  }

  const isFree = isFreeProduct(product)
  const productDescription =
    richTextToPlainText(product.short_description) ||
    richTextToPlainText(product.description) ||
    "Conteudo digital pronto para ser ativado na tua conta Mariana Explica."
  const priceLabel = formatProductPrice(product.price_cents, product.currency)
  const totalLabel = isFree ? formatProductPrice(0, product.currency) : priceLabel

  return (
    <>
      <div className="bg-[#f5fafc] text-[#171c1e]">
        <div className="container py-12 md:py-20">
          <div className="mb-10 flex flex-col gap-4 border-b border-[#dee3e5]/50 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-[#0f122c]">Mariana Explica</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#46464d]">
                Ambiente de inscrição seguro
              </p>
            </div>
            <Link
              to={`${ROUTES.COURSE}/${product.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3a618b] transition hover:opacity-80"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao curso
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <section className="space-y-8 lg:col-span-7">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#af8962]">
                  Confirmacao de pedido
                </span>
                <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-[#0f122c] md:text-5xl">
                  Quase la! Vamos finalizar sua inscrição.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-[#46464d]">
                  Preenche os dados de checkout, entra na tua conta se já tens cadastro e abre o pagamento com segurança.
                </p>
              </div>

              <div className="relative flex flex-col gap-8 overflow-hidden rounded-lg border border-[#dee3e5]/40 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,18,44,0.05)] md:flex-row">
                <div className="aspect-[3/4] w-full overflow-hidden rounded bg-[#eaeff1] md:w-1/3">
                  {product.cover_image_url ? (
                    <img src={product.cover_image_url} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#dfe0ff_0%,#d1e4ff_100%)] p-8 text-center">
                      <p className="font-display text-2xl font-bold text-[#242742]">{product.title}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center space-y-4">
                  <div>
                    <span className="mb-2 inline-block rounded-full bg-[#d1e4ff]/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#315882]">
                      {getCheckoutBadge(product.product_type)}
                    </span>
                    <h2 className="font-display text-3xl font-bold leading-tight text-[#0f122c]">{product.title}</h2>
                  </div>
                  <p className="text-base leading-7 text-[#46464d]">{productDescription}</p>
                  <div className="flex flex-wrap items-center gap-4 border-t border-[#dee3e5]/40 py-3">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-5 w-5 text-[#af8962]" />
                      <span className="text-xs font-bold uppercase tracking-[0.12em]">Acesso na conta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-[#af8962]" />
                      <span className="text-xs font-bold uppercase tracking-[0.12em]">Ambiente seguro</span>
                    </div>
                  </div>
                </div>
              </div>

              {!isAuthenticatedAndActive ? (
                <section className="rounded-lg border border-[#dee3e5]/60 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,18,44,0.04)]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#d1e4ff]/60 p-3 text-[#315882]">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-[#0f122c]">Já tens cadastro?</h2>
                      <p className="mt-2 text-sm leading-7 text-[#46464d]">
                        Entra para usar a conta já existente ou cria uma nova conta e continuamos com os dados já
                        preenchidos.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-lg border-[#bcd1de] bg-white text-[#315882]"
                      onClick={() => handleAuthNavigation("login")}
                      onMouseEnter={preloadAuthPages}
                      onFocus={preloadAuthPages}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Já tenho conta
                    </Button>
                    <Button
                      type="button"
                      className="h-12 rounded-lg bg-[#B8926A] text-white hover:bg-[#a6825d]"
                      onClick={() => handleAuthNavigation("register")}
                      onMouseEnter={preloadAuthPages}
                      onFocus={preloadAuthPages}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Quero criar conta
                    </Button>
                  </div>
                </section>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#dee3e5]/60 bg-white/60 p-8">
                  <UserCircle className="mb-3 h-6 w-6 text-[#3a618b]" />
                  <h3 className="mb-2 font-display text-lg font-bold text-[#0f122c]">Conta vinculada</h3>
                  <p className="text-sm leading-6 text-[#46464d]">
                    {isAuthenticatedAndActive
                      ? `O conteúdo será liberado na conta ${profile?.email ? `associada a ${profile.email}` : "usada no login"}.`
                      : "Faz login ou cria a conta para abrir o pagamento e vincular o acesso corretamente."}
                  </p>
                </div>
                <div className="rounded-lg border border-[#dee3e5]/60 bg-white/60 p-8">
                  <Lock className="mb-3 h-6 w-6 text-[#3a618b]" />
                  <h3 className="mb-2 font-display text-lg font-bold text-[#0f122c]">Termos confirmados</h3>
                  <p className="text-sm leading-6 text-[#46464d]">
                    O botão de pagamento só fica disponível depois de confirmares os dados e aceitares os termos.
                  </p>
                </div>
              </div>
            </section>

            <aside className="lg:col-span-5">
              <div className="sticky top-28 space-y-4">
                <div className="rounded-lg bg-[#242742] p-8 text-white shadow-[0_4px_20px_-2px_rgba(15,18,44,0.22)]">
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#8c8eae]">
                        Resumo financeiro
                      </p>
                      <h3 className="font-display text-2xl font-bold text-white">
                        {isFree ? "Ativação gratuita" : "Investimento único"}
                      </h3>
                    </div>
                    <CreditCard className="h-10 w-10 text-[#af8962]" />
                  </div>

                  <div className="mb-8 space-y-4">
                    <div className="flex justify-between text-base text-white/80">
                      <span>Valor do curso</span>
                      <span>{priceLabel}</span>
                    </div>
                    {isFree ? (
                      <div className="flex justify-between text-base text-[#e9bf94]">
                        <span>Desconto aplicado</span>
                        <span>- {priceLabel}</span>
                      </div>
                    ) : null}
                    <div className="flex items-baseline justify-between border-t border-[#8c8eae]/30 pt-4">
                      <span className="font-display text-2xl text-white">Total</span>
                      <div className="text-right">
                        <span className="block font-display text-4xl font-bold text-white">{totalLabel}</span>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#8c8eae]">
                          {isFree ? "sem pagamento" : "pagamento único"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <label className="grid gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                          Nome completo
                        </span>
                        <input
                          value={draft.fullName}
                          onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
                          placeholder="O teu nome"
                          autoComplete="name"
                          className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">E-mail</span>
                        <input
                          value={draft.email}
                          onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                          placeholder="seu@email.com"
                          autoComplete="email"
                          className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                          Confirmar e-mail
                        </span>
                        <input
                          value={draft.confirmEmail}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, confirmEmail: event.target.value }))
                          }
                          placeholder="repete o e-mail"
                          autoComplete="email"
                          className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                        />
                      </label>

                      <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={draft.invoiceWithNif}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              invoiceWithNif: event.target.checked,
                              nif: event.target.checked ? current.nif : "",
                            }))
                          }
                          className="mt-1 h-4 w-4 accent-[#e9bf94]"
                        />
                        <span className="leading-6">Pretendo receber fatura com NIF</span>
                      </label>

                      {draft.invoiceWithNif ? (
                        <label className="grid gap-2">
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">NIF</span>
                          <input
                            value={formatNif(draft.nif)}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, nif: stripDigits(event.target.value) }))
                            }
                            placeholder="Número de Identificação Fiscal"
                            inputMode="numeric"
                            autoComplete="off"
                            className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                          />
                        </label>
                      ) : null}

                      <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={draft.contentUpdatesConsent}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, contentUpdatesConsent: event.target.checked }))
                          }
                          className="mt-1 h-4 w-4 accent-[#e9bf94]"
                        />
                        <span className="leading-6">
                          Quero saber quando os resumos sao melhorados ou saem novas disciplinas e recursos.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={draft.acceptTerms}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, acceptTerms: event.target.checked }))
                          }
                          className="mt-1 h-4 w-4 accent-[#e9bf94]"
                        />
                        <span className="leading-6">
                          Confirmo que li e aceito os{" "}
                          <button
                            type="button"
                            onClick={() => setTermsOpen(true)}
                            className="font-semibold text-[#e9bf94] underline underline-offset-4"
                          >
                            termos e condições
                          </button>
                          .
                        </span>
                      </label>
                    </div>
                  </div>

                  {!isAuthenticatedAndActive ? (
                    <div className="mt-5 rounded-lg border border-[#e9bf94]/40 bg-[#ffddbb]/10 p-4 text-sm leading-6 text-[#ffddbb]">
                      Faz login ou cria a conta para abrir o Stripe com o pedido já validado.
                    </div>
                  ) : null}

                  {submitError ? (
                    <div className="mt-5 rounded-lg border border-red-200/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                      {submitError}
                    </div>
                  ) : null}

                  <Button
                    className="mt-5 h-14 w-full rounded-lg bg-[#B8926A] text-base font-bold text-white shadow-lg shadow-black/20 transition hover:bg-[#a6825d] active:scale-[0.99]"
                    size="lg"
                    onClick={() => void handleCheckout()}
                    disabled={submitting}
                  >
                    {submitting ? "A processar..." : "Ir para pagamento"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <div className="mt-8 flex flex-col items-center gap-3 text-center">
                    <p className="max-w-[280px] text-xs font-bold uppercase tracking-[0.12em] text-[#8c8eae]">
                      {isFree
                        ? "Ao confirmar, o material será ativado diretamente na tua área do aluno."
                        : "Ao clicar, serás redirecionado para concluir o pagamento com total segurança."}
                    </p>
                    <div className="flex gap-2 opacity-75">
                      <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                        Stripe
                      </span>
                      <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                        Visa
                      </span>
                      <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                        Mastercard
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#dee3e5]/60 bg-[#e4e9eb]/50 p-6 text-center">
                  <blockquote className="mb-3 font-display text-base italic text-[#0f122c]">
                    "A Mariana explica de um jeito que deixa o estudo mais leve e organizado."
                  </blockquote>
                  <cite className="text-xs font-bold uppercase tracking-[0.14em] text-[#46464d]">
                    Aluna Mariana Explica
                  </cite>
                </div>
              </div>
            </aside>
          </div>
        </div>
        <footer className="border-t border-slate-200/70 bg-[#f5fafc]">
          <div className="container py-6">
            <FooterCopyright className="border-t-0 pt-0" />
          </div>
        </footer>
      </div>

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </>
  )
}
