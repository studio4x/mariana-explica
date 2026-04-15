import { Link, useParams } from "react-router-dom"
import { CheckCircle2, Shield, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { ROUTES } from "@/lib/constants"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { formatProductPrice } from "@/utils/currency"

export function Product() {
  const { slug } = useParams<{ slug: string }>()
  const { data: product, isLoading, isError, error, refetch } = usePublishedProductBySlug(slug)

  if (isLoading) {
    return <LoadingState message="Carregando produto..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível abrir o produto"
        message={error instanceof Error ? error.message : "Tente novamente em instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!product) {
    return (
      <EmptyState
        title="Produto não encontrado"
        message="O produto solicitado não está publicado ou não existe."
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={product.title}
        description={product.short_description ?? product.description ?? undefined}
        backTo={ROUTES.PRODUCTS}
      />

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white shadow-xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                {product.product_type}
              </span>
              {product.is_featured ? (
                <span className="rounded-full bg-amber-300/95 px-3 py-1 text-xs font-semibold text-amber-950">
                  Destaque
                </span>
              ) : null}
            </div>
            <h2 className="mt-6 text-3xl font-semibold leading-tight md:text-5xl">
              {product.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 md:text-lg">
              {product.description ?? product.short_description ?? "Produto digital publicado e pronto para compra."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Shield, title: "RLS ativo" },
                { icon: CheckCircle2, title: "Acesso por grant" },
                { icon: Sparkles, title: "Checkout seguro" },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <item.icon className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Entrega",
                text: "Acesso controlado pelo backend com grant real.",
              },
              {
                title: "Preço",
                text: formatProductPrice(product.price_cents, product.currency),
              },
              {
                title: "Afiliados",
                text: product.allow_affiliate ? "Permitidos" : "Não disponíveis",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border bg-white p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Checkout</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {formatProductPrice(product.price_cents, product.currency)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Selecione o botão abaixo para seguir para a rota dedicada de compra.
            </p>

            <div className="mt-6 space-y-3">
              <Button asChild className="w-full" size="lg">
                <Link to={`${ROUTES.CHECKOUT}?slug=${product.slug}`}>
                  Ir para checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link to={ROUTES.PRODUCTS}>Voltar ao catálogo</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border bg-slate-50 p-6">
            <h3 className="text-lg font-semibold text-slate-900">O que acontece depois?</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>• O checkout carrega o produto correto pelo slug.</li>
              <li>• Produtos gratuitos liberam o acesso diretamente no backend.</li>
              <li>• Produtos pagos usam a Edge Function de checkout antes de redirecionar para o Stripe.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
