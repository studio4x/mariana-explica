import { Link } from "react-router-dom"
import { ArrowRight, BadgeCheck, BookOpenCheck, CheckCircle2, Sparkles, Target, TimerReset } from "lucide-react"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { useFeaturedProducts } from "@/hooks/useProducts"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { publicCoursePath } from "@/lib/routes"

const pillars = [
  {
    title: "Explicacao clara",
    text: "Sem excesso de teoria solta. O foco e perceber rapido e aplicar melhor.",
    icon: BookOpenCheck,
  },
  {
    title: "Plano objetivo",
    text: "Sabes o que estudar primeiro e como manter ritmo ate ao exame.",
    icon: Target,
  },
  {
    title: "Acesso organizado",
    text: "Tudo fica na tua conta: cursos, materiais e historico de apoio.",
    icon: TimerReset,
  },
]

const journey = [
  {
    step: "01",
    title: "Escolhe o curso certo",
    text: "Compara os cursos e encontra o formato ideal para o teu momento.",
  },
  {
    step: "02",
    title: "Ativa ou compra",
    text: "Checkout simples, sem ruido e com proximos passos claros.",
  },
  {
    step: "03",
    title: "Continua no dashboard",
    text: "Acede aos conteudos e segue o teu estudo com mais consistencia.",
  },
]

export function Home() {
  const { session } = useAuth()
  const { data: featuredProducts, isLoading, isError, error, refetch } = useFeaturedProducts()
  const { data: enrolledCourses } = useMyProducts({ enabled: Boolean(session) })
  const hasFeaturedProducts = (featuredProducts?.length ?? 0) > 0

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-[#d9e8ef]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,58,84,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(97,168,210,0.2),transparent_44%),linear-gradient(180deg,#f7fcff_0%,#edf7fc_52%,#ffffff_100%)]" />
        <div className="container relative grid gap-10 py-14 md:py-20 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#cde0ea] bg-white px-4 py-2 text-sm font-semibold text-[#1f4f6b]">
              <Sparkles className="h-4 w-4" />
              Exames nacionais com mais clareza e menos ansiedade
            </span>

            <div className="space-y-4">
              <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-[#0f2736] md:text-6xl">
                Tens dificuldades a Portugues ou Filosofia?
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#345669] md:text-xl">
                Aprende com um metodo mais direto: curso certo, compra simples e uma area do aluno preparada para continuares sem te perderes.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-[#123f59] hover:bg-[#0f3247]">
                <Link to={ROUTES.COURSES}>
                  Ver cursos agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-full border-[#bcd6e3] text-[#14384d]">
                <Link to={ROUTES.REGISTER}>Criar conta</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {pillars.map((item) => (
                <div key={item.title} className="rounded-[1.3rem] border border-[#d7e8f0] bg-white p-4 shadow-sm">
                  <item.icon className="h-5 w-5 text-[#134663]" />
                  <p className="mt-3 text-sm font-bold text-[#14384d]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#45667b]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d3e5ef] bg-white p-5 shadow-[0_24px_60px_rgba(17,64,93,0.14)]">
            <div className="rounded-[1.6rem] bg-[linear-gradient(145deg,#133f59_0%,#1f668f_100%)] p-7 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/75">Metodo Mariana Explica</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
                Menos confusao no que estudar. Mais foco no que realmente sai no exame.
              </h2>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-white/12 p-4">
                  <p className="font-semibold">Portuguese e Filosofia com orientacao pratica</p>
                  <p className="mt-1 text-sm text-white/80">Conteudo pensado para leitura rapida e revisao inteligente.</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4">
                  <p className="font-semibold">Compra e acesso no mesmo fluxo</p>
                  <p className="mt-1 text-sm text-white/80">Do catalogo ao dashboard sem passos quebrados.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#567085]">Cursos em destaque</p>
            <h2 className="font-display text-3xl font-bold text-[#112e40] md:text-4xl">Comeca pelo curso que resolve a tua dificuldade agora.</h2>
          </div>
          <Button variant="outline" asChild className="hidden rounded-full border-[#c9dbe6] md:inline-flex">
            <Link to={ROUTES.COURSES}>Catalogo completo</Link>
          </Button>
        </div>

        {isLoading ? <LoadingState message="A carregar cursos em destaque..." /> : null}
        {isError ? (
          <ErrorState
            title="Nao foi possivel carregar os cursos"
            message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
            onRetry={() => void refetch()}
          />
        ) : null}

        {!isLoading && !isError && hasFeaturedProducts ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredProducts?.map((product) => {
              const enrolledAction = getEnrolledCourseAction(findEnrolledCourse(product.id, enrolledCourses))

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  actionLabel={enrolledAction?.label ?? "Ver detalhes"}
                  actionTo={enrolledAction?.to ?? publicCoursePath(product.slug, product.id)}
                />
              )
            })}
          </div>
        ) : null}

        {!isLoading && !isError && !hasFeaturedProducts ? (
          <div className="rounded-[1.4rem] border border-[#d7e8f0] bg-white p-6">
            <p className="text-[#45667b]">Ainda nao existem cursos em destaque. Explora o catalogo completo.</p>
            <Button asChild className="mt-4 rounded-full bg-[#123f59] hover:bg-[#0f3247]">
              <Link to={ROUTES.COURSES}>Ver catalogo</Link>
            </Button>
          </div>
        ) : null}
      </section>

      <section className="border-y border-[#d9e8ef] bg-[#f8fcff]">
        <div className="container py-14 md:py-20">
          <div className="mb-8 space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#567085]">Como funciona</p>
            <h2 className="font-display text-3xl font-bold text-[#112e40] md:text-4xl">Um percurso simples para estudar com continuidade.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {journey.map((item) => (
              <div key={item.step} className="rounded-[1.4rem] border border-[#d6e7ef] bg-white p-6 shadow-sm">
                <span className="inline-flex rounded-full bg-[#e8f4fb] px-3 py-1 text-xs font-black tracking-[0.14em] text-[#0f3a53]">
                  PASSO {item.step}
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-[#14384d]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#4a6a7f]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="rounded-[2rem] border border-[#d4e6ef] bg-[linear-gradient(135deg,#103a52_0%,#1f6288_100%)] p-8 text-white shadow-xl md:p-10">
          <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">Pronto para comecar</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
                Estuda com direcao, compra com confianca e continua no teu ritmo.
              </h2>
              <div className="mt-6 space-y-3">
                <p className="flex items-start gap-2 text-sm text-white/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Fluxo pensado para exames nacionais, sem linguagem confusa.
                </p>
                <p className="flex items-start gap-2 text-sm text-white/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Compra, acesso e suporte no mesmo ecossistema.
                </p>
                <p className="flex items-start gap-2 text-sm text-white/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Experiencia forte no telemovel e consistente no desktop.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button asChild size="lg" className="w-full rounded-full bg-white text-[#103a52] hover:bg-white/90">
                <Link to={ROUTES.COURSES}>Explorar cursos</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20">
                <Link to={ROUTES.REGISTER}>Criar conta</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full rounded-full text-white hover:bg-white/15">
                <Link to={ROUTES.SUPPORT}>
                  Tirar duvidas no suporte
                  <BadgeCheck className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
