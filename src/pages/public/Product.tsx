import { Link, useParams } from "react-router-dom"
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { ROUTES } from "@/lib/constants"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { formatProductPrice } from "@/utils/currency"
import { getProductNarrative } from "@/lib/product-presentation"

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

  const narrative = getProductNarrative(product)

  const formatHints = [
    { icon: FileText, title: "Formato", text: narrative.formatLabel },
    { icon: PlayCircle, title: "Para quem e", text: narrative.audience },
    { icon: ShieldCheck, title: "Como acedes", text: narrative.accessLabel },
  ]
  const courseSignals = [
    product.workload_minutes > 0 ? `${product.workload_minutes} minutos estimados de estudo` : "Carga organizada por modulos e aulas",
    product.launch_date ? `Lancamento previsto para ${new Date(product.launch_date).toLocaleDateString("pt-PT")}` : "Ativacao imediata depois da confirmacao",
    product.has_linear_progression ? "Jornada pensada para seguir em ordem" : "Podes retomar os blocos conforme o teu ritmo",
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
                {narrative.typeLabel}
              </span>
              {product.is_featured ? (
                <span className="rounded-full bg-amber-300/95 px-3 py-1 text-xs font-semibold text-amber-950">
                  Destaque
                </span>
              ) : null}
            </div>
            <p className="mt-6 text-sm uppercase tracking-[0.3em] text-white/70">{narrative.eyebrow}</p>
            <h2 className="mt-6 max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">
              {product.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
              {product.description ?? narrative.benefit}
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
                text: narrative.audience,
              },
              {
                title: "Formato",
                text: narrative.formatLabel,
              },
              {
                title: "Acesso",
                text: narrative.accessLabel,
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-slate-950">O que vais encontrar</h3>
            <ul className="mt-5 space-y-3">
              {narrative.receiveItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl font-bold text-slate-950">Estrutura deste curso</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {courseSignals.map((signal) => (
                <div key={signal} className="rounded-2xl bg-slate-50/80 p-4 text-sm leading-7 text-slate-700">
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-display text-2xl font-bold text-slate-950">Como acedes</h3>
              </div>
              <div className="mt-5 space-y-4">
                {narrative.accessSteps.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-2xl bg-slate-50/80 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-7 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-primary" />
                <h3 className="font-display text-2xl font-bold text-slate-950">Porque faz sentido</h3>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-700">{narrative.valueLine}</p>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo rapido</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{narrative.cardSummary}</p>
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border bg-white p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Investimento</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {formatProductPrice(product.price_cents, product.currency)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{narrative.sidebarNote}</p>

            <div className="mt-5 rounded-2xl bg-slate-50/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">O que vais encontrar</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{narrative.valueLine}</p>
            </div>

            <div className="mt-6 space-y-3">
              <Button asChild className="w-full rounded-full" size="lg">
                <Link to={`${ROUTES.CHECKOUT}?slug=${product.slug}`}>
                  {narrative.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full rounded-full">
                <Link to={ROUTES.PRODUCTS}>Voltar ao catalogo</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border bg-slate-50/80 p-6">
            <h3 className="font-display text-2xl font-bold text-slate-900">Perguntas frequentes</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              {narrative.faqs.map((item) => (
                <div key={item.question}>
                  <p className="font-semibold text-slate-900">{item.question}</p>
                  <p className="mt-1">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
