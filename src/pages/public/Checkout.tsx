import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Lock,
  LogIn,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui"
import { FooterCopyright } from "@/components/common"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { ROUTES } from "@/lib/constants"
import { formatNif, isValidNif, stripNifDigits } from "@/lib/nif"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useProfilePreferences } from "@/hooks/useDashboard"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { claimFreeProduct, createCheckoutSession, isFreeProduct } from "@/services"
import { richTextToPlainText } from "@/lib/rich-text"
import { useRef } from "react"

const CHECKOUT_DRAFT_STORAGE_KEY = "mariana-explica:checkout-draft"

interface CheckoutDraft {
  fullName: string
  email: string
  confirmEmail: string
  invoiceWithNif: boolean
  nif: string
  contentUpdatesConsent: boolean
  acceptTerms: boolean
}

type AuthTab = "login" | "register"

type SignUpResult = {
  user?: {
    id?: string | null
    email?: string | null
  } | null
  session?: unknown
}

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

function buildAuthCallbackUrl(nextPath: string) {
  const normalizedBase = (import.meta.env.VITE_BASE_URL || "/").replace(/\/$/, "")
  const callbackPath = `${normalizedBase}${ROUTES.AUTH_CALLBACK}`.replace(/\/{2,}/g, "/")
  const callbackUrl = new URL(`${window.location.origin}${callbackPath}`)
  callbackUrl.searchParams.set("next", nextPath)
  return callbackUrl.toString()
}

function getCheckoutBadge(productType: string) {
  if (productType === "free") return "MATERIAL GRATUITO"
  if (productType === "external_service") return "APOIO PERSONALIZADO"
  return "CURSO COMPLETO"
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
  const { session, profile: authProfile } = useAuth()
  const profileQuery = useProfilePreferences({ enabled: Boolean(session) })
  const { data: product, isLoading, isError, error, refetch } = usePublishedProductBySlug(slug)
  const [activeAuthTab, setActiveAuthTab] = useState<AuthTab>("login")
  const [submitting, setSubmitting] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
  const [loginPassword, setLoginPassword] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("")
  const [draft, setDraft] = useState<CheckoutDraft>(() => loadCheckoutDraft())
  const nifDirtyRef = useRef(false)
  const syncedProfileNifRef = useRef<string | null>(null)

  const profile = profileQuery.data ?? authProfile

  useEffect(() => {
    persistCheckoutDraft(draft)
  }, [draft])

  useEffect(() => {
    if (!profile) {
      return
    }

    const profileNif = profile.nif?.trim() || ""

    setDraft((current) => {
      const previousSyncedNif = syncedProfileNifRef.current ?? ""
      const currentNif = current.nif.trim()
      const shouldSyncNif = !nifDirtyRef.current || currentNif === previousSyncedNif
      const nextNif = shouldSyncNif ? profileNif : currentNif

      syncedProfileNifRef.current = profileNif || null

      return {
        ...current,
        fullName: current.fullName || profile.full_name || "",
        email: current.email || profile.email || "",
        confirmEmail: current.confirmEmail || profile.email || current.email || "",
        invoiceWithNif: shouldSyncNif ? Boolean(profileNif) : current.invoiceWithNif,
        nif: nextNif,
        contentUpdatesConsent: current.contentUpdatesConsent || profile.content_updates_consent || false,
      }
    })
  }, [profile])

  const checkoutIdentifier = product?.slug?.trim() || product?.id || ""
  const successUrl = checkoutIdentifier
    ? `${window.location.origin}${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product?.id ?? "")}&slug=${encodeURIComponent(checkoutIdentifier)}&session_id={CHECKOUT_SESSION_ID}`
    : ""
  const cancelUrl = checkoutIdentifier
    ? `${window.location.origin}${location.pathname}${location.search}&checkout=cancelled`
    : ""

  const isAuthenticatedAndActive = Boolean(session && profile?.status === "active")
  const hasSession = Boolean(session)
  const trimmedName = draft.fullName.trim()
  const trimmedEmail = draft.email.trim()
  const trimmedConfirmEmail = draft.confirmEmail.trim()
  const emailMatches = trimmedEmail.toLowerCase() === trimmedConfirmEmail.toLowerCase()
  const resolvedFullName = trimmedName || profile?.full_name?.trim() || ""
  const resolvedEmail = trimmedEmail || profile?.email?.trim() || ""
  const canSubmitCheckout =
    hasSession &&
    Boolean(resolvedFullName) &&
    isValidEmail(resolvedEmail) &&
    emailMatches &&
    (!draft.invoiceWithNif || isValidNif(draft.nif)) &&
    draft.acceptTerms
  const formError = authError ?? submitError

  useEffect(() => {
    if (hasSession) {
      setAuthError(null)
    }
  }, [hasSession])

  const continueCheckout = useCallback(async (pendingUserId?: string | null) => {
    if (!product) {
      return
    }

    setSubmitError(null)

    const nameToUse = draft.fullName.trim() || profile?.full_name?.trim() || ""
    const emailToUse = draft.email.trim() || profile?.email?.trim() || ""
    const confirmEmailToUse = draft.confirmEmail.trim()
    const emailMatchesCurrent = emailToUse.toLowerCase() === confirmEmailToUse.toLowerCase()

    if (!nameToUse) {
      setSubmitError("Indica o teu nome completo.")
      return
    }

    if (!isValidEmail(emailToUse)) {
      setSubmitError("Indica um email válido.")
      return
    }

    if (!emailMatchesCurrent) {
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

    if (!isAuthenticatedAndActive && !pendingUserId) {
      setAuthError("Entra ou cria conta para continuar com o pagamento.")
      return
    }

    setSubmitting(true)

    try {
      if (isFreeProduct(product)) {
        await claimFreeProduct({ productId: product.id, pendingUserId: pendingUserId ?? null })
        clearCheckoutDraft()
        navigate(
          `${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product.id)}&slug=${encodeURIComponent(checkoutIdentifier)}&mode=free`,
          { replace: true },
        )
        return
      }

      const result = await createCheckoutSession({
        productId: product.id,
        customerEmail: emailToUse,
        pendingUserId: pendingUserId ?? null,
        customerNif: draft.invoiceWithNif ? stripNifDigits(draft.nif) : null,
        invoiceWithNif: draft.invoiceWithNif,
        contentUpdatesConsent: draft.contentUpdatesConsent,
        successUrl,
        cancelUrl,
      })

      if (result.mode === "stripe" && result.checkout_url) {
        clearCheckoutDraft()
        window.location.assign(result.checkout_url)
        return
      }

      clearCheckoutDraft()
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
    draft.confirmEmail,
    draft.email,
    draft.fullName,
    draft.invoiceWithNif,
    draft.nif,
    isAuthenticatedAndActive,
    navigate,
    product,
    profile?.email,
    profile?.full_name,
    successUrl,
  ])

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError(null)
    setSubmitError(null)

    const email = draft.email.trim()
    if (!isValidEmail(email)) {
      setAuthError("Indica um email válido.")
      return
    }

    if (!loginPassword.trim()) {
      setAuthError("Indica a tua palavra-passe.")
      return
    }

    setDraft((current) => ({
      ...current,
      confirmEmail: current.email,
    }))

    setAuthLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: loginPassword,
    })

    setAuthLoading(false)

    if (error) {
      setAuthError(mapAuthErrorMessage(error.message))
      return
    }
  }

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError(null)
    setSubmitError(null)

    const fullName = draft.fullName.trim()
    const email = draft.email.trim()
    const confirmEmail = draft.confirmEmail.trim()

    if (!fullName) {
      setAuthError("Indica o teu nome completo.")
      return
    }

    if (!isValidEmail(email)) {
      setAuthError("Indica um email válido.")
      return
    }

    if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
      setAuthError("O email e a confirmação de email precisam de coincidir.")
      return
    }

    if (!registerPassword.trim()) {
      setAuthError("Cria uma palavra-passe.")
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      setAuthError("As palavras-passe nao coincidem.")
      return
    }

    if (draft.invoiceWithNif && !isValidNif(draft.nif)) {
      setAuthError("Indica um NIF válido.")
      return
    }

    if (!draft.acceptTerms) {
      setAuthError("Aceita os termos e condições para continuar.")
      return
    }

    setAuthLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password: registerPassword,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: buildAuthCallbackUrl(`${location.pathname}${location.search}`),
      },
    })

    setAuthLoading(false)

    if (error) {
      setAuthError(mapAuthErrorMessage(error.message))
      return
    }

    const signUpData = data as SignUpResult | null
    const signedUpEmail = signUpData?.user?.email ?? email
    const pendingUserId = signUpData?.user?.id ?? null

    setPendingVerificationEmail(signedUpEmail)
    await continueCheckout(pendingUserId)
  }

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

  const productDescription =
    richTextToPlainText(product.short_description) ||
    richTextToPlainText(product.description) ||
    "Conteudo digital pronto para ser ativado na tua conta Mariana Explica."

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
                  Quase lá! Vamos finalizar sua inscrição.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-[#46464d]">
                  Preenche os dados de checkout e segue para o pagamento com segurança.
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

            </section>

            <aside className="lg:col-span-5">
              <div className="sticky top-28 space-y-4">
                <div className="rounded-lg bg-[#242742] p-8 text-white shadow-[0_4px_20px_-2px_rgba(15,18,44,0.22)]">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#8c8eae]">
                        Acesso e pagamento
                      </p>
                      <h3 className="font-display text-2xl font-bold text-white">
                        {hasSession
                          ? "Confirma os teus dados"
                          : activeAuthTab === "login"
                            ? "Ja tenho conta"
                            : "Quero me cadastrar"}
                      </h3>
                    </div>
                    <Lock className="h-10 w-10 text-[#af8962]" />
                  </div>

                  {!hasSession ? (
                    <>
                      <div className="rounded-full border border-white/10 bg-white/5 p-1">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAuthTab("login")
                              setAuthError(null)
                              setSubmitError(null)
                            }}
                            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition ${
                              activeAuthTab === "login"
                                ? "bg-white text-[#242742] shadow-lg"
                                : "text-white/65 hover:bg-white/10"
                            }`}
                          >
                            <LogIn className="h-4 w-4" />
                            Ja tenho conta
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAuthTab("register")
                              setAuthError(null)
                              setSubmitError(null)
                            }}
                            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition ${
                              activeAuthTab === "register"
                                ? "bg-white text-[#242742] shadow-lg"
                                : "text-white/65 hover:bg-white/10"
                            }`}
                          >
                            <UserPlus className="h-4 w-4" />
                            Quero me cadastrar
                          </button>
                        </div>
                      </div>

                      <form
                        className="mt-6 space-y-4"
                        onSubmit={activeAuthTab === "login" ? handleLoginSubmit : handleRegisterSubmit}
                      >
                        {activeAuthTab === "register" ? (
                          <div className="space-y-4">
                            <label className="grid gap-2">
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                Nome completo
                              </span>
                              <input
                                value={draft.fullName}
                                onChange={(event) =>
                                  setDraft((current) => ({ ...current, fullName: event.target.value }))
                                }
                                placeholder="O teu nome"
                                autoComplete="name"
                                className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                              />
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                  E-mail
                                </span>
                                <input
                                  value={draft.email}
                                  onChange={(event) =>
                                    setDraft((current) => ({ ...current, email: event.target.value }))
                                  }
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
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                  Palavra-passe
                                </span>
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  value={registerPassword}
                                  onChange={(event) => setRegisterPassword(event.target.value)}
                                  placeholder="Crie uma senha"
                                  className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                                />
                              </label>

                              <label className="grid gap-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                  Confirmar senha
                                </span>
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  value={registerConfirmPassword}
                                  onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                                  placeholder="Repita a senha"
                                  className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                                />
                              </label>
                            </div>

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
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                  NIF
                                </span>
                                <input
                                  value={formatNif(draft.nif)}
                                  onChange={(event) => {
                                    nifDirtyRef.current = true
                                    setDraft((current) => ({ ...current, nif: stripNifDigits(event.target.value) }))
                                  }}
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

                            {pendingVerificationEmail ? (
                              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-6 text-white/75">
                                Criámos a conta para{" "}
                                <span className="font-semibold text-white">{pendingVerificationEmail}</span> e enviámos
                                o email de confirmação sem travar o checkout.
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <label className="grid gap-2">
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                E-mail
                              </span>
                              <input
                                value={draft.email}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    email: event.target.value,
                                    confirmEmail: event.target.value,
                                  }))
                                }
                                placeholder="seu@email.com"
                                autoComplete="email"
                                className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                                Palavra-passe
                              </span>
                              <input
                                type="password"
                                autoComplete="current-password"
                                value={loginPassword}
                                onChange={(event) => setLoginPassword(event.target.value)}
                                placeholder="Digite a sua senha"
                                className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                              />
                            </label>
                          </div>
                        )}

                        {formError ? (
                          <div className="rounded-lg border border-red-200/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                            {formError}
                          </div>
                        ) : null}

                        <Button
                          type="submit"
                          className="h-14 w-full rounded-lg bg-[#B8926A] text-base font-bold text-white shadow-lg shadow-black/20 transition hover:bg-[#a6825d] active:scale-[0.99]"
                          size="lg"
                          disabled={authLoading || submitting}
                        >
                          {authLoading
                            ? "A processar..."
                            : activeAuthTab === "login"
                              ? "Entrar e continuar"
                              : "Criar conta e continuar"}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>

                        <p className="text-center text-xs font-bold uppercase tracking-[0.12em] text-[#8c8eae]">
                          {activeAuthTab === "login"
                            ? "Ao entrar, usaremos a tua conta para abrir o checkout."
                            : "Ao criar a conta, avançamos para o pagamento sem sair desta página."}
                        </p>
                      </form>
                    </>
                  ) : (
                    <form
                      className="mt-6 space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void continueCheckout()
                      }}
                    >
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

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                              E-mail
                            </span>
                            <input
                              value={draft.email}
                              onChange={(event) =>
                                setDraft((current) => ({ ...current, email: event.target.value }))
                              }
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
                        </div>

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
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">
                              NIF
                            </span>
                            <input
                              value={formatNif(draft.nif)}
                              onChange={(event) => {
                                nifDirtyRef.current = true
                                setDraft((current) => ({ ...current, nif: stripNifDigits(event.target.value) }))
                              }}
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

                      {formError ? (
                        <div className="rounded-lg border border-red-200/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                          {formError}
                        </div>
                      ) : null}

                      <Button
                        className="h-14 w-full rounded-lg bg-[#B8926A] text-base font-bold text-white shadow-lg shadow-black/20 transition hover:bg-[#a6825d] active:scale-[0.99]"
                        size="lg"
                        onClick={() => void continueCheckout()}
                        disabled={submitting || !canSubmitCheckout}
                      >
                        {submitting ? "A processar..." : "Ir para pagamento"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </form>
                  )}
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


