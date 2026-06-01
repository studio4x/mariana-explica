import { CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { useHomepageReviews } from "@/hooks/useReviews"
import { ROUTES } from "@/lib/constants"
import { StarRating } from "./StarRating"

interface HomeReviewsFeedProps {
  limit?: number
  className?: string
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function HomeReviewsFeed({ limit = 6, className }: HomeReviewsFeedProps) {
  const reviewsQuery = useHomepageReviews(limit)
  const reviews = reviewsQuery.data ?? []
  const rootClassName = ["mt-16", className].filter(Boolean).join(" ")

  if (reviewsQuery.isLoading) {
    return (
      <div className={rootClassName}>
        <LoadingState message="A carregar avaliacoes..." />
      </div>
    )
  }

  if (reviewsQuery.isError) {
    return (
      <div className={rootClassName}>
        <ErrorState
          title="Nao foi possivel carregar as avaliacoes"
          message={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : "Tenta novamente dentro de instantes."}
          onRetry={() => void reviewsQuery.refetch()}
        />
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className={`${rootClassName} rounded-xl border border-[rgba(71,71,77,0.08)] bg-white p-8 text-left shadow-sm`}>
        <p className="text-sm leading-7 text-[#46464d]">Ainda nao existem reviews publicadas para mostrar aqui.</p>
        <Button asChild className="mt-5 rounded-full bg-[#242742] hover:bg-[#1d2036]">
          <Link to={ROUTES.COURSES}>Explorar materiais</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={`${rootClassName} grid gap-6 text-left md:grid-cols-2 xl:grid-cols-3`}>
      {reviews.map((review) => {
        const authorName = review.author_name?.trim() || review.profiles?.full_name?.trim() || "Aluno Mariana Explica"

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
  )
}
