import { Link } from "react-router-dom"
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { ROUTES, APP_NAME } from "@/lib/constants"
import { useFeaturedProducts } from "@/hooks/useProducts"

const benefits = [
  {
    title: "Explicacoes claras",
    text: "Conteudos pensados para simplificar o estudo e reduzir a sensacao de confusao.",
    icon: GraduationCap,
  },
  {
    title: "Compra sem friccao",
    text: "Da descoberta ao acesso, tudo acontece num fluxo curto, claro e confiavel.",
    icon: Sparkles,
  },
  {
    title: "Acesso seguro",
    text: "Os teus materiais ficam organizados numa area protegida e sempre disponivel.",
    icon: ShieldCheck,
  },
]

const trustPoints = [
  "Materiais organizados por produto e modulos",
  "Experiencia optimizada para telemovel",
  "Compra simples com acesso imediato quando aplicavel",
]

export function Home() {
  const { data: featuredProducts, isLoading, isError, error, refetch } = useFeaturedProducts()

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-white/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,39,66,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(54,93,135,0.14),transparent_34%),linear-gradient(180deg,#f6fbfd_0%,#eef8fb_52%,#ffffff_100%)]" />
        <div className="container relative grid gap-10 py-16 md:py-24 xl:grid-cols-[1.05fr_0.95fr] xl:items-center xl:py-28">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              Ensino estruturado, compra simples e acesso organizado
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
                Aprende com mais clareza, compra com confianca e acede a tudo no mesmo lugar.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                {APP_NAME} junta explicacoes diretas, materiais organizados e uma experiencia pensada para ajudar o aluno a estudar melhor, sem complicacao.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full">
                <Link to={ROUTES.PRODUCTS}>
                  Ver produtos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-full">
                <Link to={ROUTES.REGISTER}>Criar conta</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {benefits.map((item) => (
                <div key={item.title} className="rounded-[1.5rem] border border-white/70 bg-white/82 p-4 shadow-sm backdrop-blur">
                  <item.icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-2xl shadow-slate-200/60 backdrop-blur">
            <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white">
              <p className="text-sm uppercase tracking-[0.3em] text-white/70">Feito para estudar</p>
              <h2 className="mt-4 max-w-md font-display text-3xl font-bold leading-tight">
                Uma plataforma simples para quem quer focar no conteudo.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/82">
                Descobre o produto certo, conclui a compra sem distracoes e continua o estudo numa area do aluno clara, organizada e pronta para acompanhar o teu ritmo.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <Smartphone className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">Confortavel no telemovel</p>
                  <p className="mt-2 text-sm text-white/75">Leitura facil e navegacao simples em qualquer ecra.</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">Acesso organizado</p>
                  <p className="mt-2 text-sm text-white/75">Produtos, modulos e downloads no mesmo painel.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Produtos em destaque</p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                Escolhe o material certo para continuar a evoluir.
              </h2>
              <p className="max-w-2xl text-slate-600">
                Produtos publicados, com informacao clara e um caminho de compra simples desde o primeiro clique.
              </p>
            </div>
            <Button variant="outline" asChild className="hidden rounded-full md:inline-flex">
              <Link to={ROUTES.PRODUCTS}>Ver catalogo completo</Link>
            </Button>
          </div>

          {isLoading ? <LoadingState message="A carregar produtos em destaque..." /> : null}
          {isError ? (
            <ErrorState
              title="Nao foi possivel carregar os produtos"
              message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
              onRetry={() => void refetch()}
            />
          ) : null}
          {!isLoading && !isError && (featuredProducts?.length ?? 0) === 0 ? (
            <EmptyState
              title="Ainda sem produtos em destaque"
              message="Assim que novos produtos forem publicados, eles vao aparecer aqui."
            />
          ) : null}

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredProducts?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                actionLabel="Ver detalhes"
                actionTo={`/produto/${product.slug}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white/70">
        <div className="container py-16 md:py-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "1. Escolhe o produto",
                text: "Analisa o que cada material entrega, compara com calma e percebe rapidamente se faz sentido para ti.",
              },
              {
                title: "2. Finaliza a compra",
                text: "O checkout foi pensado para ser direto, previsivel e sem excesso de passos.",
              },
              {
                title: "3. Continua a estudar",
                text: "Depois da confirmacao, o teu acesso fica organizado na area do aluno para continuares quando quiseres.",
              },
            ].map((step) => (
              <div key={step.title} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Como funciona</p>
                <h3 className="mt-3 font-display text-2xl font-bold text-slate-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Porque transmite confianca</p>
            <h2 className="mt-4 font-display text-3xl font-bold text-slate-950">
              Menos ruido, mais contexto e uma experiencia previsivel do inicio ao acesso.
            </h2>
            <div className="mt-6 space-y-4">
              {trustPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-primary" />
                  <p className="text-sm leading-7 text-slate-700">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">Pronto para comecar</p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
              Encontra o teu proximo produto e comeca a estudar com mais clareza hoje.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-white/82">
              A proposta da plataforma e simples: ajudar o aluno a compreender melhor, comprar com seguranca e aceder ao conteudo sem se perder.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="rounded-full bg-white text-slate-950 hover:bg-white/90">
                <Link to={ROUTES.PRODUCTS}>Explorar produtos</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/15">
                <Link to={ROUTES.REGISTER}>Criar conta</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
