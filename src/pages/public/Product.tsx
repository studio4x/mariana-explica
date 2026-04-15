import { Link, useParams } from "react-router-dom"
import { ArrowRight, CheckCircle2, FileText, PlayCircle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { ROUTES } from "@/lib/constants"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { formatProductPrice } from "@/utils/currency"

const productTypeLabel: Record<string, string> = {
  paid: "Produto pago",
  free: "Produto gratuito",
  hybrid: "Conteudo hibrido",
  external_service: "Servico externo",
}

export function Product() {
  const { slug } = useParams<{ slug: string }>()
  const { data: product, isLoading, isError, error, refetch } = usePublishedProductBySlug(slug)

  if (isLoading) {
    return <LoadingState message="A carregar produto..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel abrir este produto"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!product) {
    return (
      <EmptyState
        title="Produto nao encontrado"
        message="O produto pedido nao esta publicado ou deixou de estar disponivel."
      />
    )
  }

  const whatYouReceive = [
    "Acesso organizado na tua area de aluno",
    product.product_type === "free"
      ? "Activacao simples para comecares sem demora"
      : "Fluxo de compra curto e claro, com encaminhamento direto para o pagamento",
    "Conteudos reunidos num unico lugar para continuares quando quiseres",
  ]

  const formatHints = [
    { icon: FileText, title: "Materiais digitais", text: "Conteudos organizados por produto e por modulos." },
    { icon: PlayCircle, title: "Aprendizagem guiada", text: "Estrutura pensada para facilitar a leitura e o consumo." },
    { icon: ShieldCheck, title: "Acesso confiavel", text: "Tudo fica associado a tua conta para voltares quando precisares." },
  ]

  return (
    <div className="container space-y-8 py-10 md:py-12">
      <PageHeader
        title={product.title}
        description={product.short_description ?? product.description ?? undefined}
        backTo={ROUTES.PRODUCTS}
      />

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white shadow-xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                {productTypeLabel[product.product_type] ?? "Produto digital"}
              </span>
              {product.is_featured ? (
                <span className="rounded-full bg-amber-300/95 px-3 py-1 text-xs font-semibold text-amber-950">
                  Destaque
                </span>
              ) : null}
            </div>
            <h2 className="mt-6 max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">
              {product.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
              {product.description ?? product.short_description ?? "Produto digital pronto para compra e acesso."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {formatHints.map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <item.icon className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Ideal para",
                text: "Quem quer estudar com mais clareza e menos dispersao.",
              },
              {
                title: "Formato",
                text: product.product_type === "external_service" ? "Entrega externa" : "Material digital organizado",
              },
              {
                title: "Acesso",
                text: product.product_type === "free" ? "Activacao simples" : "Disponivel apos confirmacao da compra",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-slate-950">O que recebes</h3>
            <ul className="mt-5 space-y-3">
              {whatYouReceive.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border bg-white p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Investimento</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {formatProductPrice(product.price_cents, product.currency)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Le o resumo, confirma se este produto faz sentido para o teu momento e segue para um checkout claro e direto.
            </p>

            <div className="mt-6 space-y-3">
              <Button asChild className="w-full rounded-full" size="lg">
                <Link to={`${ROUTES.CHECKOUT}?slug=${product.slug}`}>
                  Comprar agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full rounded-full">
                <Link to={ROUTES.PRODUCTS}>Voltar ao catalogo</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border bg-slate-50/80 p-6">
            <h3 className="font-display text-2xl font-bold text-slate-900">Perguntas rapidas</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">Como acedo depois da compra?</p>
                <p className="mt-1">O produto fica associado a tua conta e aparece na area do aluno.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Posso voltar mais tarde?</p>
                <p className="mt-1">Sim. O acesso foi pensado para continuares o estudo com previsibilidade.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
