import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, MessageCircleHeart } from "lucide-react"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import { StarRating } from "@/components/reviews"
import { ROUTES } from "@/lib/constants"
import { useHomepageReviews } from "@/hooks/useReviews"
import homeHeroIllustration from "@/assets/home-hero-illustration.svg"
import { PublicManagedPage } from "./PublicManagedPage"

const featureBlocks = [
  {
    eyebrow: "EM BREVE - AULAS GRAVADAS",
    text: "Domina temas complexos ao teu ritmo, com aulas organizadas e flexíveis, prontas quando tu estiveres.",
  },
  {
    eyebrow: "EXPLICAÇÕES",
    text: "Acompanhamento personalizado e focado nas tuas dúvidas específicas para garantires resultados.",
  },
  {
    eyebrow: "MATERIAIS DIGITAIS",
    text: "Resumos visuais e esquemas claros para simplificar o teu estudo e garantires a nota máxima sem complicações.",
  },
  {
    eyebrow: "MATERIAIS DIGITAIS - GRATUITOS",
    text: "Dicas flash e recursos rápidos para descarregar e dares um boost imediato no teu estudo.",
  },
]

const steps = [
  {
    eyebrow: "ENCONTRA O TEU APOIO",
    text: "Explora as sebentas e materiais disponíveis. Cada material foi criado para resolver uma dor específica, por isso vais perceber logo qual é o ideal para o teu momento.",
  },
  {
    eyebrow: "ACESSO RÁPIDO E SEGURO",
    text: "O processo é direto e transparente. Sem taxas escondidas ou passos desnecessários. Pagas de forma segura e o material é teu no segundo seguinte.",
  },
  {
    eyebrow: "FOCA-TE NO QUE IMPORTA",
    text: "Tudo fica organizado na tua Área do Aluno. Podes aceder aos PDFs e aulas sempre que quiseres, ao teu ritmo, e retomar o estudo exatamente onde paraste.",
  },
]

const trustPointsLeft = [
  {
    title: "Linguagem Direta:",
    text: "Falamos a mesma língua. Esquece os termos impossíveis dos manuais e entende a matéria à primeira.",
  },
  {
    title: "Foco no Exame:",
    text: "Materiais desenhados apenas com o que realmente sai. Sem distrações.",
  },
  {
    title: "Resumos Visuais:",
    text: "Esquemas e cores pensados para quem precisa de organizar ideias rapidamente.",
  },
]

const trustPointsRight = [
  "Suporte Real: Não recebes só um PDF. Tens uma \"amiga\" (eu!) nas DMs para te apoiar sempre que precisares.",
  "Tudo Organizado: Esquece o caos do WhatsApp. Os teus materiais ficam sempre guardados na tua Área do Aluno.",
  "Pés na Terra: Filosofia e Português deixam de ser abstratos e passam a ser ferramentas que dominas com segurança.",
]

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function HomeReviewsSection() {
  const reviewsQuery = useHomepageReviews(6)
  const reviews = reviewsQuery.data ?? []

  return (
    <section className="bg-[#f5fafc] py-24">
      <div className="mx-auto max-w-[1200px] px-6 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#567085] shadow-sm ring-1 ring-black/5">
            <MessageCircleHeart className="h-4 w-4 text-[#242742]" />
            Reviews
          </div>
          <h2 className="mt-4 font-display text-5xl font-bold tracking-[-0.02em] text-[#0f122c]">
            E o que dizem os nossos alunos?
          </h2>
          <p className="mt-4 text-base leading-7 text-[#46464d]">Avaliacoes reais publicadas no modulo de Reviews.</p>
        </div>

        {reviewsQuery.isLoading ? <LoadingState message="A carregar avaliacoes..." /> : null}
        {reviewsQuery.isError ? (
          <ErrorState
            title="Nao foi possivel carregar as avaliacoes"
            message={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : "Tenta novamente dentro de instantes."}
            onRetry={() => void reviewsQuery.refetch()}
          />
        ) : null}

        {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length === 0 ? (
          <div className="mt-16 rounded-xl border border-[rgba(71,71,77,0.08)] bg-white p-8 text-left shadow-sm">
            <p className="text-sm leading-7 text-[#46464d]">
              Ainda nao existem reviews publicadas para mostrar aqui.
            </p>
            <Button asChild className="mt-5 rounded-full bg-[#242742] hover:bg-[#1d2036]">
              <Link to={ROUTES.COURSES}>Explorar materiais</Link>
            </Button>
          </div>
        ) : null}

        {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length > 0 ? (
          <div className="mt-16 grid gap-6 text-left md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((review) => {
              const authorName = review.profiles?.full_name?.trim() || "Aluno Mariana Explica"

              return (
                <article key={review.id} className="rounded-xl border border-[rgba(71,71,77,0.08)] bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl font-bold text-[#0f122c]">{authorName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StarRating value={review.rating} readonly size="sm" />
                        <span className="text-xs font-semibold text-[#6b7280]">{formatReviewDate(review.created_at)}</span>
                        {review.is_verified_purchase ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Compra verificada
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold text-[#0f122c]">{review.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#46464d]">{review.content}</p>
                </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function HomeReviewsWidgetPlaceholder() {
  return (
    <section data-me-widget="home-reviews" className="bg-[#f5fafc] py-24">
      <div className="mx-auto max-w-[1200px] px-6 text-center">
        <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-[rgba(71,71,77,0.25)] bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#567085]">Widget dinamico</p>
          <h3 className="mt-3 font-display text-2xl font-bold text-[#0f122c]">Reviews da Home</h3>
          <p className="mt-2 text-sm leading-7 text-[#46464d]">
            Este bloco e renderizado dinamicamente no site publico.
          </p>
        </div>
      </div>
    </section>
  )
}

function HomeStaticSections({ reviewsNode }: { reviewsNode: ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="bg-[#f5fafc] py-20 lg:py-32">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="aspect-[4/5] w-full rounded-xl bg-white shadow-sm ring-1 ring-black/5 lg:aspect-square">
              <img
                src={homeHeroIllustration}
                alt="Ilustração de materiais de estudo para Português e Filosofia"
                className="h-full w-full rounded-xl object-contain p-6"
                loading="eager"
              />
            </div>
          </div>

          <div className="order-1 space-y-8 lg:order-2">
            <div className="space-y-4">
              <h1 className="max-w-[12ch] font-display text-5xl font-bold leading-[1.1] tracking-[-0.02em] text-[#0f122c] lg:text-6xl">
                Tens dificuldades a Português ou Filosofia?
              </h1>
              <h2 className="max-w-[14ch] font-display text-3xl font-bold leading-[1.3] tracking-[-0.02em] text-[#0f122c]/80 lg:text-4xl">
                Nunca tiveste a disciplina e vais fazer exame?
              </h2>
              <p className="max-w-[18ch] font-sans text-xl leading-[1.6] text-[#46464d]">
                Então fica aqui que este local é para ti!
              </p>
            </div>

            <Button
              asChild
              className="rounded-full bg-[#242742] px-12 py-6 text-sm font-bold uppercase tracking-widest text-white shadow-lg hover:bg-[#1d2036]"
            >
              <Link to={ROUTES.COURSES}>Explorar materiais</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="bg-[rgba(239,244,246,0.5)] py-24">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
          <div className="flex flex-col items-center rounded shadow-sm border border-[rgba(71,71,77,0.12)] bg-white p-12 text-center">
            <span className="mb-8 inline-flex rounded-full bg-[#242742] px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-white">
              Objetivo Principal
            </span>
            <p className="max-w-2xl font-display text-2xl leading-relaxed text-[#0f122c]">
              Criei este espaço para te dar o apoio que os manuais não dão: leveza, clareza e uma estratégia real para
              brilhares nos exames de Filosofia e Português. Vamo-nos simplificar?
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {featureBlocks.map((block) => (
              <div
                key={block.eyebrow}
                className="flex flex-col items-center rounded shadow-sm border border-[rgba(71,71,77,0.12)] bg-white p-8 text-center"
              >
                <span className="mb-4 inline-flex rounded-full bg-[#242742] px-4 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white">
                  {block.eyebrow}
                </span>
                <p className="text-xs leading-relaxed text-[#46464d]">{block.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#eff4f6] py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-16 max-w-2xl">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-[-0.02em] text-[#0f122c]">
              O teu caminho para o sucesso é simples
            </h2>
            <p className="text-lg leading-8 text-[#46464d]">
              Esquece as complicações burocráticas. Aqui, o foco é o teu estudo. Em três passos rápidos, tens tudo o
              que precisas para começar a brilhar.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.eyebrow} className="flex flex-col rounded border border-[rgba(71,71,77,0.12)] bg-white p-10 shadow-sm">
                <span className="mb-8 inline-flex self-start rounded-full bg-[#242742] px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-white">
                  {step.eyebrow}
                </span>
                <p className="text-base leading-7 text-[#46464d]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[rgba(239,244,246,0.5)] py-24">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
          <div className="rounded border border-[rgba(71,71,77,0.12)] bg-white p-12 shadow-sm">
            <h3 className="mb-12 inline-flex rounded-full bg-[rgba(169,207,255,0.35)] px-6 py-2 text-lg font-display text-[#0f122c]">
              Vantagens de trabalhares comigo
            </h3>
            <ul className="space-y-8">
              {trustPointsLeft.map((point) => (
                <li key={point.title} className="flex items-start gap-3">
                  <span className="mt-1 text-xs text-[#242742]">•</span>
                  <div>
                    <span className="block text-base font-bold text-[#242742]">{point.title}</span>
                    <span className="text-sm text-[#46464d]">{point.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-between rounded bg-[rgba(169,207,255,0.2)] p-12">
            <div>
              <h3 className="mb-12 inline-flex rounded-full bg-white px-6 py-2 text-lg font-display text-[#0f122c]">
                Leveza e Confiança em cada passo
              </h3>
              <ul className="space-y-6">
                {trustPointsRight.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 text-xs text-[#242742]">•</span>
                    <span className="text-sm font-medium leading-6 text-[#242742]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12 flex flex-wrap gap-4">
              <Button asChild variant="outline" className="rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm">
                <Link to={ROUTES.COURSES}>Explorar materiais</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm">
                <Link to={ROUTES.REGISTER}>Criar Conta</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {reviewsNode}
    </div>
  )
}

export function HomeFallback() {
  return <HomeStaticSections reviewsNode={<HomeReviewsSection />} />
}

export function HomeEditorBaseline() {
  return <HomeStaticSections reviewsNode={<HomeReviewsWidgetPlaceholder />} />
}

export function Home() {
  return (
    <PublicManagedPage
      slug="home"
      fallback={<HomeFallback />}
      widgets={[
        {
          key: "home-reviews",
          node: <HomeReviewsSection />,
        },
      ]}
    />
  )
}
