import { Link } from "react-router-dom"
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Files,
  GraduationCap,
  Headphones,
  Layers3,
  LibraryBig,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { ROUTES, APP_NAME } from "@/lib/constants"
import { useFeaturedProducts } from "@/hooks/useProducts"

const benefits = [
  {
    title: "Clareza para estudar melhor",
    text: "Materiais organizados para explicar sem ruido e ajudar a ganhar confianca na revisao.",
    icon: GraduationCap,
  },
  {
    title: "Compra curta e previsivel",
    text: "Do produto ao checkout, o caminho foi desenhado para reduzir duvidas e passos desnecessarios.",
    icon: Sparkles,
  },
  {
    title: "Acesso organizado na conta",
    text: "Os produtos ficam reunidos numa area do aluno simples, preparada para continuar o estudo.",
    icon: ShieldCheck,
  },
]

const offerTracks = [
  {
    title: "Packs completos",
    text: "Para quem prefere resolver varios temas num so produto, com menos dispersao.",
    icon: Layers3,
  },
  {
    title: "Sebentas individuais",
    text: "Materiais de apoio focados por disciplina, com leitura mais clara e direta.",
    icon: LibraryBig,
  },
  {
    title: "Materiais gratuitos",
    text: "Boas entradas para conhecer a plataforma e comecar com apoio util desde logo.",
    icon: Files,
  },
  {
    title: "Explicacoes online",
    text: "Opcao para quem precisa de apoio mais acompanhado e orientado ao momento do aluno.",
    icon: Headphones,
  },
]

const trustPoints = [
  "Fluxo pensado para exames nacionais, com materiais claros e proposta objetiva.",
  "Compra e acesso associados a conta para manter tudo organizado no mesmo lugar.",
  "Experiencia pensada primeiro para telemovel, sem perder leitura e hierarquia no desktop.",
]

const studyFlow = [
  {
    step: "1",
    title: "Escolhe o produto certo",
    text: "Entras no catalogo, comparas rapidamente e percebes para quem serve cada material.",
  },
  {
    step: "2",
    title: "Ativa ou compra sem ruina visual",
    text: "O processo foi desenhado para ser curto, claro e sem excesso de ruido entre a decisao e a compra.",
  },
  {
    step: "3",
    title: "Continua no dashboard",
    text: "Depois da confirmacao, o acesso fica reunido na tua area do aluno para retomares quando quiseres.",
  },
]

const reassuranceCards = [
  {
    title: "Compra simples",
    text: "Checkout direto, leitura clara do produto e proximos passos bem definidos.",
  },
  {
    title: "Area do aluno organizada",
    text: "Modulos, downloads e materiais reunidos para reduzir dispersao depois da compra.",
  },
  {
    title: "Experiencia confiavel",
    text: "Permissoes, grants e acesso controlado pela plataforma em vez de depender da interface.",
  },
]

export function Home() {
  const { data: featuredProducts, isLoading, isError, error, refetch } = useFeaturedProducts()
  const hasFeaturedProducts = (featuredProducts?.length ?? 0) > 0

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-white/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,39,66,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(54,93,135,0.14),transparent_34%),linear-gradient(180deg,#f6fbfd_0%,#eef8fb_52%,#ffffff_100%)]" />
        <div className="container relative grid gap-10 py-16 md:py-24 xl:grid-cols-[1.05fr_0.95fr] xl:items-center xl:py-28">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              Materiais para exames nacionais, compra simples e acesso organizado
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
                Aprende com mais clareza, escolhe o material certo e continua a estudar no mesmo lugar.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                {APP_NAME} junta sebentas, packs, materiais gratuitos e apoio organizado numa plataforma pensada para reduzir friccao, melhorar a compreensao e manter o estudo acessivel.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full">
                <Link to={ROUTES.PRODUCTS}>
                  Explorar produtos
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
              <p className="text-sm uppercase tracking-[0.3em] text-white/70">Estrutura orientada ao aluno</p>
              <h2 className="mt-4 max-w-md font-display text-3xl font-bold leading-tight">
                Uma experiencia simples para comprar, aceder e retomar o estudo sem te perderes.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/82">
                A plataforma foi pensada para sair do modelo de site solto: aqui encontras uma area publica mais clara, checkout direto e uma area do aluno organizada para continuar de onde paraste.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <Smartphone className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">Mobile primeiro</p>
                  <p className="mt-2 text-sm text-white/75">Leitura confortavel, navegacao simples e CTA claros no telemovel.</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">Acesso centralizado</p>
                  <p className="mt-2 text-sm text-white/75">Produtos, modulos, downloads e suporte reunidos no mesmo painel.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3 rounded-[1.75rem] border bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Oferta principal</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              Escolhe a forma de estudar que faz mais sentido para o teu momento.
            </h2>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              A plataforma foi desenhada para acomodar produtos diferentes sem parecer um catalogo confuso. Em vez de uma lista fria, o objetivo e ajudar-te a encontrar o formato certo mais depressa.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {offerTracks.map((track) => (
              <div key={track.title} className="rounded-[1.75rem] border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <track.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-display text-2xl font-bold text-slate-950">{track.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{track.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Produtos em destaque</p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                Comeca pelo produto que melhor responde ao teu objetivo.
              </h2>
              <p className="max-w-2xl text-slate-600">
                Produtos publicados com copy mais clara, diferenciacao por formato e um caminho curto entre descoberta, compra e acesso.
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

          {!isLoading && !isError && hasFeaturedProducts ? (
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
          ) : null}

          {!isLoading && !isError && !hasFeaturedProducts ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Ver packs completos",
                  text: "Para quem quer concentrar os materiais centrais num so percurso.",
                  to: ROUTES.PRODUCTS,
                },
                {
                  title: "Explorar sebentas",
                  text: "Materiais individuais com leitura mais direta por disciplina.",
                  to: ROUTES.PRODUCTS,
                },
                {
                  title: "Comecar pelos gratuitos",
                  text: "Boa forma de conhecer a experiencia antes de comprar outros produtos.",
                  to: ROUTES.PRODUCTS,
                },
                {
                  title: "Entrar na area do aluno",
                  text: "Se ja tens acesso, o teu proximo passo esta no dashboard.",
                  to: ROUTES.DASHBOARD,
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="rounded-[1.75rem] border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  <h3 className="mt-4 font-display text-2xl font-bold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white/70">
        <div className="container py-16 md:py-20">
          <div className="mb-8 max-w-3xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Como funciona</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              Do interesse ao acesso, o percurso foi desenhado para ser simples.
            </h2>
            <p className="text-base leading-8 text-slate-600">
              A logica da plataforma e comercial, mas a experiencia foi pensada com foco em clareza: perceber o produto, decidir com confianca e continuar a estudar sem friccao.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {studyFlow.map((step) => (
              <div key={step.title} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Passo {step.step}</p>
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
              Menos cara de template, mais contexto real de compra e estudo.
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

          <div className="space-y-6 rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white shadow-xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">Pronto para comecar</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
                A proposta e simples: menos duvida na compra, mais clareza depois do acesso.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-white/82">
                A plataforma foi desenhada para vender melhor sem ficar agressiva, e para ensinar melhor sem parecer tecnica demais.
              </p>
            </div>

            <div className="grid gap-3">
              {reassuranceCards.map((card) => (
                <div key={card.title} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{card.text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
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
