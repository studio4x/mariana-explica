import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Lock,
  ShieldCheck,
  UserCircle,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui"
import { FooterCopyright } from "@/components/common"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { claimFreeProduct, createCheckoutSession, isFreeProduct } from "@/services"
import { formatProductPrice } from "@/utils/currency"
import { richTextToPlainText } from "@/lib/rich-text"

function getCheckoutBadge(productType: string) {
  if (productType === "free") return "MATERIAL GRATUITO"
  if (productType === "external_service") return "APOIO PERSONALIZADO"
  return "CURSO COMPLETO"
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
  const loginRedirectState = {
    from: {
      pathname: location.pathname,
      search: location.search,
    },
  }
  const loginHref = `${ROUTES.LOGIN}?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`

  const handleCheckout = async () => {
    if (!product) return

    if (!session || profile?.status !== "active") {
      navigate(loginHref, { state: loginRedirectState })
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isFreeProduct(product)) {
        await claimFreeProduct({ productId: product.id })
        navigate(`${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product.id)}&slug=${encodeURIComponent(checkoutIdentifier)}&mode=free`, { replace: true })
        return
      }

      const result = await createCheckoutSession({
        productId: product.id,
        successUrl,
        cancelUrl: `${window.location.origin}${location.pathname}${location.search}&checkout=cancelled`,
      })

      if (result.mode === "stripe" && result.checkout_url) {
        window.location.assign(result.checkout_url)
        return
      }

      navigate(`${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product.id)}&slug=${encodeURIComponent(checkoutIdentifier)}&mode=internal`, { replace: true })
    } catch (checkoutError) {
      setSubmitError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Nao foi possivel iniciar o pagamento. Tenta novamente dentro de instantes.",
      )
    } finally {
      setSubmitting(false)
    }
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

  const canPurchase = Boolean(session && profile?.status === "active")
  const isFree = isFreeProduct(product)
  const productDescription =
    richTextToPlainText(product.short_description) ||
    richTextToPlainText(product.description) ||
    "Conteudo digital pronto para ser ativado na tua conta Mariana Explica."
  const priceLabel = formatProductPrice(product.price_cents, product.currency)
  const totalLabel = isFree ? formatProductPrice(0, product.currency) : priceLabel
  const checkoutIdentifier = product.slug?.trim() || product.id
  const successUrl = `${window.location.origin}${ROUTES.CHECKOUT_SUCCESS}?product_id=${encodeURIComponent(product.id)}&slug=${encodeURIComponent(checkoutIdentifier)}&session_id={CHECKOUT_SESSION_ID}`

  return (
    <div className="bg-[#f5fafc] text-[#171c1e]">
      <div className="container py-12 md:py-20">
        <div className="mb-10 flex flex-col gap-4 border-b border-[#dee3e5]/50 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-[#0f122c]">Mariana Explica</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#46464d]">
              Ambiente de inscricao seguro
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
                Quase la! Vamos finalizar sua inscricao.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[#46464d]">
                Voce esta prestes a acessar um conteudo curado para transformar sua rotina de estudo com mais clareza.
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#dee3e5]/60 bg-white/60 p-8">
                <Lock className="mb-3 h-6 w-6 text-[#3a618b]" />
                <h3 className="mb-2 font-display text-lg font-bold text-[#0f122c]">Pagamento seguro</h3>
                <p className="text-sm leading-6 text-[#46464d]">
                  Seus dados sao processados com seguranca. Pagamentos pagos seguem pelo Stripe.
                </p>
              </div>
              <div className="rounded-lg border border-[#dee3e5]/60 bg-white/60 p-8">
                <UserCircle className="mb-3 h-6 w-6 text-[#3a618b]" />
                <h3 className="mb-2 font-display text-lg font-bold text-[#0f122c]">Conta vinculada</h3>
                <p className="text-sm leading-6 text-[#46464d]">
                  O conteudo sera liberado na conta {profile?.email ? `associada a ${profile.email}` : "usada no login"}.
                </p>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5">
            <div className="sticky top-28 space-y-4">
              <div className="rounded-lg bg-[#242742] p-8 text-white shadow-[0_4px_20px_-2px_rgba(15,18,44,0.22)]">
                <div className="mb-8 flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#8c8eae]">Resumo financeiro</p>
                    <h3 className="font-display text-2xl font-bold text-white">
                      {isFree ? "Ativacao gratuita" : "Investimento unico"}
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
                        {isFree ? "sem pagamento" : "pagamento unico"}
                      </span>
                    </div>
                  </div>
                </div>

                {!canPurchase ? (
                  <div className="mb-5 rounded-lg border border-[#e9bf94]/40 bg-[#ffddbb]/10 p-4 text-sm leading-6 text-[#ffddbb]">
                    Precisas entrar com uma conta ativa para continuar.
                  </div>
                ) : null}

                {submitError ? (
                  <div className="mb-5 rounded-lg border border-red-200/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                    {submitError}
                  </div>
                ) : null}

                {canPurchase ? (
                  <Button
                    className="h-14 w-full rounded-lg bg-[#B8926A] text-base font-bold text-white shadow-lg shadow-black/20 transition hover:bg-[#a6825d] active:scale-[0.99]"
                    size="lg"
                    onClick={() => void handleCheckout()}
                    disabled={submitting}
                  >
                    {submitting ? "A processar..." : isFree ? "Confirmar acesso" : "Continuar para pagamento"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <Button asChild className="h-14 w-full rounded-lg bg-[#B8926A] text-base font-bold text-white hover:bg-[#a6825d]" size="lg">
                    <Link to={loginHref} state={loginRedirectState}>
                      Entrar para continuar
                      <Lock className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                )}

                <div className="mt-8 flex flex-col items-center gap-3 text-center">
                  <p className="max-w-[280px] text-xs font-bold uppercase tracking-[0.12em] text-[#8c8eae]">
                    {isFree
                      ? "Ao confirmar, o material sera ativado diretamente na tua area do aluno."
                      : "Ao clicar, voce sera redirecionado para concluir o pagamento com total seguranca."}
                  </p>
                  <div className="flex gap-2 opacity-75">
                    <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">Stripe</span>
                    <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">Visa</span>
                    <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">Mastercard</span>
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
  )
}
