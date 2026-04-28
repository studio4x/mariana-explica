import { Link } from "react-router-dom"
import { ArrowRight, CheckCircle2, MessageCircleHeart, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { useFeaturedProducts } from "@/hooks/useProducts"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { publicCoursePath } from "@/lib/routes"

const steps = [
  {
    title: "Encontra o teu apoio",
    text: "Explora as sebentas e cursos disponiveis. Cada material resolve uma dor especifica.",
  },
  {
    title: "Acesso rapido e seguro",
    text: "Processo direto e transparente, sem passos desnecessarios. Tudo fica na tua area do aluno.",
  },
  {
    title: "Foca-te no que importa",
    text: "Retoma o estudo ao teu ritmo, com PDFs e aulas sempre organizados na conta.",
  },
]

const advantages = [
  {
    title: "Materiais",
    points: [
      "Resumos visuais e esquemas claros para simplificar o estudo.",
      "Foco no exame com o que realmente sai, sem distracoes.",
      "Filosofia e Portugues explicados com linguagem direta.",
    ],
  },
  {
    title: "Suporte",
    points: [
      "Acompanhamento real para as tuas duvidas especificas.",
      "Tens apoio continuo para manter ritmo e confianca.",
      "Os materiais ficam sempre guardados na tua area do aluno.",
    ],
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
        <div className="container relative grid gap-10 py-14 md:py-20 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#cde0ea] bg-white px-4 py-2 text-sm font-semibold text-[#1f4f6b]">
              <Sparkles className="h-4 w-4" />
              O teu caminho para o sucesso e simples
            </span>
            <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-[#0f2736] md:text-6xl">
              Tens dificuldades a Portugues ou Filosofia?
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#345669] md:text-xl">
              Nunca tiveste a disciplina e vais fazer exame? Entao fica aqui que este espaco e para ti.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-[#123f59] hover:bg-[#0f3247]">
                <Link to={ROUTES.COURSES}>
                  Comecar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-full border-[#bcd6e3] text-[#14384d]">
                <Link to={ROUTES.LOGIN}>Entrar</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d3e5ef] bg-white p-5 shadow-[0_24px_60px_rgba(17,64,93,0.14)]">
            <div className="rounded-[1.6rem] bg-[linear-gradient(145deg,#133f59_0%,#1f668f_100%)] p-7 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/75">Objetivo principal</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
                Domina temas complexos ao teu ritmo com aulas gravadas e materiais digitais.
              </h2>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-white/12 p-4">
                  <p className="font-semibold">Materiais digitais</p>
                  <p className="mt-1 text-sm text-white/80">Resumos visuais, esquemas claros e recursos rapidos.</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4">
                  <p className="font-semibold">Em breve: aulas gravadas e explicacoes</p>
                  <p className="mt-1 text-sm text-white/80">Acompanhamento personalizado para garantir resultados.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#567085]">O teu caminho em 3 passos</p>
          <h2 className="font-display text-3xl font-bold text-[#112e40] md:text-4xl">
            Esquece complicacoes: o foco e o teu estudo.
          </h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {steps.map((item, index) => (
            <div key={item.title} className="rounded-[1.4rem] border border-[#d6e7ef] bg-white p-6 shadow-sm">
              <span className="inline-flex rounded-full bg-[#e8f4fb] px-3 py-1 text-xs font-black tracking-[0.14em] text-[#0f3a53]">
                PASSO {index + 1}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold text-[#14384d]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#4a6a7f]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d9e8ef] bg-[#f8fcff]">
        <div className="container py-14 md:py-20">
          <div className="mb-8 flex items-center gap-3">
            <Target className="h-6 w-6 text-[#123f59]" />
            <h2 className="font-display text-3xl font-bold text-[#112e40] md:text-4xl">Vantagens de trabalhares comigo</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {advantages.map((block) => (
              <div key={block.title} className="rounded-[1.5rem] border border-[#d6e7ef] bg-white p-7 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#567085]">{block.title}</p>
                <div className="mt-4 space-y-3">
                  {block.points.map((point) => (
                    <p key={point} className="flex items-start gap-2 text-sm leading-7 text-[#3f6278]">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#1f668f]" />
                      {point}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="mb-8 flex items-center gap-3">
          <MessageCircleHeart className="h-6 w-6 text-[#123f59]" />
          <h2 className="font-display text-3xl font-bold text-[#112e40] md:text-4xl">E o que dizem os nossos alunos?</h2>
        </div>

        {isLoading ? <LoadingState message="A carregar materiais em destaque..." /> : null}
        {isError ? (
          <ErrorState
            title="Nao foi possivel carregar os materiais"
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
                  actionLabel={enrolledAction?.label ?? "Explorar sebenta"}
                  actionTo={enrolledAction?.to ?? publicCoursePath(product.slug, product.id)}
                />
              )
            })}
          </div>
        ) : null}

        {!isLoading && !isError && !hasFeaturedProducts ? (
          <div className="rounded-[1.4rem] border border-[#d7e8f0] bg-white p-6">
            <p className="text-[#45667b]">Ainda nao existem materiais em destaque. Explora o catalogo completo.</p>
            <Button asChild className="mt-4 rounded-full bg-[#123f59] hover:bg-[#0f3247]">
              <Link to={ROUTES.COURSES}>Explorar sebentas</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
