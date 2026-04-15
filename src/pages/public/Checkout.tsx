import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom"
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { claimFreeProduct, createCheckoutSession, isFreeProduct } from "@/services"
import { formatProductPrice } from "@/utils/currency"

export function Checkout() {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get("slug") ?? undefined
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile } = useAuth()
  const { data: product, isLoading, isError, error, refetch } = usePublishedProductBySlug(slug)
  const [submitting, setSubmitting] = useState(false)

  const handleCheckout = async () => {
    if (!product) return

    if (!session || profile?.status !== "active") {
      navigate(ROUTES.LOGIN, {
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
          },
        },
      })
      return
    }

    setSubmitting(true)
    try {
      if (isFreeProduct(product)) {
        await claimFreeProduct({ productId: product.id })
        navigate(`${ROUTES.DASHBOARD}?checkout=success`, { replace: true })
        return
      }

      const result = await createCheckoutSession({
        productId: product.id,
        successUrl: `${window.location.origin}${ROUTES.DASHBOARD}?checkout=success`,
        cancelUrl: `${window.location.origin}${location.pathname}${location.search}&checkout=cancelled`,
      })

      if (result.mode === "stripe" && result.checkout_url) {
        window.location.assign(result.checkout_url)
        return
      }

      navigate(`${ROUTES.DASHBOARD}?checkout=success`, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  if (!slug) {
    return (
      <EmptyState
        title="Checkout sem produto"
        message="Abre um produto primeiro e segue para o checkout para continuar."
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
        title="Produto nao encontrado"
        message="O item escolhido nao esta publicado ou deixou de estar disponivel."
      />
    )
  }

  const canPurchase = Boolean(session && profile?.status === "active")

  return (
    <div className="container space-y-8 py-10 md:py-12">
      <PageHeader
        title="Checkout"
        description="Confirma o produto, valida os dados principais e segue para concluir a compra."
        backTo={`${ROUTES.PRODUCT}/${product.slug}`}
      />

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white shadow-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-white/70">Resumo do produto</p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">{product.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
              {product.short_description ?? product.description ?? "Produto digital pronto para ser activado na tua conta."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Fluxo claro" },
                { icon: CheckCircle2, title: "Dados organizados" },
                { icon: Lock, title: "Conta protegida" },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <item.icon className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-slate-900">O que acontece depois</h3>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
              <li>• Concluis a compra sem sair do fluxo principal.</li>
              <li>• O acesso fica associado a tua conta para consultares quando quiseres.</li>
              <li>• Se o produto for gratuito, a activacao e ainda mais rapida.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border bg-white p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Pagamento</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {formatProductPrice(product.price_cents, product.currency)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {isFreeProduct(product)
                ? "Este produto e gratuito. Basta confirmar para o adicionares a tua area."
                : "Vais seguir para a conclusao da compra com um fluxo simples e seguro."}
            </p>

            {!canPurchase ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Precisas de entrar com uma conta ativa para continuar a compra.
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {canPurchase ? (
                <Button className="w-full rounded-full" size="lg" onClick={() => void handleCheckout()} disabled={submitting}>
                  {submitting ? "A processar..." : isFreeProduct(product) ? "Confirmar acesso" : "Continuar para pagamento"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button asChild className="w-full rounded-full" size="lg">
                  <Link to={ROUTES.LOGIN} state={{ from: { pathname: location.pathname, search: location.search } }}>
                    Entrar para continuar
                    <Lock className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}

              <Button asChild variant="outline" className="w-full rounded-full">
                <Link to={`${ROUTES.PRODUCT}/${product.slug}`}>Voltar ao produto</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
