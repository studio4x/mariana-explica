import { Link } from "react-router-dom"
import { CheckCircle2, MessageCircleHeart } from "lucide-react"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import { StarRating } from "@/components/reviews"
import { ROUTES } from "@/lib/constants"
import { useHomepageReviews } from "@/hooks/useReviews"
import {
  HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type HomeVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"
import { VisualEditorProvider, useVisualEditorPage } from "@/features/site-editor/visual-editor"
import homeHeroIllustration from "@/assets/home-hero-illustration.svg"
import { PublicManagedPage } from "./PublicManagedPage"

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function HomePageContent() {
  const reviewsQuery = useHomepageReviews(6)
  const reviews = reviewsQuery.data ?? []
  const { document } = useVisualEditorPage()
  const visualDocument = (document as HomeVisualEditorDocument | undefined) ?? HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT
  const hero = visualDocument.hero
  const objective = visualDocument.objective
  const featureBlocks = visualDocument.featureBlocks
  const steps = visualDocument.steps
  const trust = visualDocument.trust
  const reviewsCopy = visualDocument.reviews

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
              <span className="inline-flex rounded-full bg-[#242742] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                {hero.eyebrow}
              </span>
              <h1 className="max-w-[12ch] font-display text-5xl font-bold leading-[1.1] tracking-[-0.02em] text-[#0f122c] lg:text-6xl">
                {hero.title}
              </h1>
              <h2 className="max-w-[14ch] font-display text-3xl font-bold leading-[1.3] tracking-[-0.02em] text-[#0f122c]/80 lg:text-4xl">
                {hero.subtitle}
              </h2>
              <p className="max-w-[18ch] font-sans text-xl leading-[1.6] text-[#46464d]">{hero.lead}</p>
            </div>

            <Button
              asChild
              className="rounded-full bg-[#242742] px-12 py-6 text-sm font-bold uppercase tracking-widest text-white shadow-lg hover:bg-[#1d2036]"
            >
              <Link to={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="bg-[rgba(239,244,246,0.5)] py-24">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
          <div className="flex flex-col items-center rounded border border-[rgba(71,71,77,0.12)] bg-white p-12 text-center shadow-sm">
            <span className="mb-8 inline-flex rounded-full bg-[#242742] px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-white">
              {objective.eyebrow}
            </span>
            <p className="max-w-2xl font-display text-2xl leading-relaxed text-[#0f122c]">{objective.text}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {Object.values(featureBlocks).map((block) => (
              <div
                key={block.eyebrow}
                className="flex flex-col items-center rounded border border-[rgba(71,71,77,0.12)] bg-white p-8 text-center shadow-sm"
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
            {Object.values(steps).map((step) => (
              <div
                key={step.eyebrow}
                className="flex flex-col rounded border border-[rgba(71,71,77,0.12)] bg-white p-10 shadow-sm"
              >
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
              {trust.leftTitle}
            </h3>
            <ul className="space-y-8">
              {[trust.leftPoint1, trust.leftPoint2, trust.leftPoint3].map((point) => (
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
                {trust.rightTitle}
              </h3>
              <ul className="space-y-6">
                {[trust.rightPoint1, trust.rightPoint2, trust.rightPoint3].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 text-xs text-[#242742]">•</span>
                    <span className="text-sm font-medium leading-6 text-[#242742]">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12 flex flex-wrap gap-4">
              <Button
                asChild
                variant="outline"
                className="rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm"
              >
                <Link to={trust.primaryCta.href}>{trust.primaryCta.label}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm"
              >
                <Link to={trust.secondaryCta.href}>{trust.secondaryCta.label}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5fafc] py-24">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#567085] shadow-sm ring-1 ring-black/5">
              <MessageCircleHeart className="h-4 w-4 text-[#242742]" />
              {reviewsCopy.eyebrow}
            </div>
            <h2 className="mt-4 font-display text-5xl font-bold tracking-[-0.02em] text-[#0f122c]">
              {reviewsCopy.title}
            </h2>
            <p className="mt-4 text-base leading-7 text-[#46464d]">{reviewsCopy.lead}</p>
          </div>

          {reviewsQuery.isLoading ? <LoadingState message="A carregar avaliações..." /> : null}
          {reviewsQuery.isError ? (
            <ErrorState
              title="Nao foi possivel carregar as avaliacoes"
              message={
                reviewsQuery.error instanceof Error
                  ? reviewsQuery.error.message
                  : "Tenta novamente dentro de instantes."
              }
              onRetry={() => void reviewsQuery.refetch()}
            />
          ) : null}

          {!reviewsQuery.isLoading && !reviewsQuery.isError && reviews.length === 0 ? (
            <div className="mt-16 rounded-xl border border-[rgba(71,71,77,0.08)] bg-white p-8 text-left shadow-sm">
              <p className="text-sm leading-7 text-[#46464d]">Ainda não existem reviews publicadas para mostrar aqui.</p>
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
                  <article
                    key={review.id}
                    className="rounded-xl border border-[rgba(71,71,77,0.08)] bg-white p-6 shadow-sm"
                  >
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
    </div>
  )
}

function LegacyHome() {
  return (
    <VisualEditorProvider pageKey="home">
      <HomePageContent />
    </VisualEditorProvider>
  )
}

export function Home() {
  return <PublicManagedPage slug="home" fallback={<LegacyHome />} />
}
