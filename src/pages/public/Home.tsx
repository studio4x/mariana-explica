import { Link } from "react-router-dom"
import { ArrowRight, CheckCircle2, MessageCircleHeart, Target } from "lucide-react"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import homeHeroIllustration from "@/assets/home-hero-illustration.svg"
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
      <section className="relative overflow-hidden border-b border-[#d9e8ef] bg-[#dbeef7]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.5),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.34),transparent_26%),linear-gradient(180deg,#dff0f8_0%,#d7eaf4_100%)]" />
        <div className="container relative grid gap-8 py-10 md:py-14 xl:grid-cols-[0.94fr_1.06fr] xl:items-center xl:gap-16 xl:py-16">
          <figure className="order-1 flex justify-center xl:justify-start">
            <div className="w-full max-w-[520px] rounded-[2.2rem] bg-white p-4 shadow-[0_24px_60px_rgba(17,64,93,0.12)] ring-1 ring-white/75 md:p-5">
              <img
                src={homeHeroIllustration}
                alt="Ilustração de cadernos, livros e apontamentos para Português e Filosofia"
                className="h-full w-full object-contain"
                loading="eager"
              />
            </div>
          </figure>

          <div className="order-2 max-w-3xl space-y-8 xl:pt-6">
            <div className="space-y-5">
              <h1 className="max-w-[10ch] font-display text-5xl font-bold leading-[0.93] tracking-[-0.04em] text-[#2a2d4f] md:text-6xl xl:text-[4.95rem]">
                Tens dificuldades a Português ou Filosofia?
              </h1>
              <div className="space-y-4 text-[#2d3555]">
                <p className="max-w-[13ch] font-display text-3xl font-bold leading-[1.05] md:text-[3.1rem]">
                  Nunca tiveste a disciplina e vais fazer exame?
                </p>
                <p className="max-w-[14ch] font-display text-3xl font-bold leading-[1.05] md:text-[3.1rem]">
                  Então fica aqui que este local é para ti!
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="min-w-[240px] rounded-full bg-[#2a2d4f] px-10 py-7 text-base font-medium uppercase tracking-[0.08em] text-white hover:bg-[#23263f]"
              >
                <Link to={ROUTES.COURSES}>
                  Começar!
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Link
                to={ROUTES.LOGIN}
                className="text-sm font-semibold text-[#2a2d4f] underline-offset-4 transition hover:underline"
              >
                Já tens conta? Entrar
              </Link>
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
