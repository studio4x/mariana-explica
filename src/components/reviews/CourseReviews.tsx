import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import {
  useApprovedCourseReviews,
  useCourseReviewStats,
  useCreateCourseReview,
  useMyCourseReview,
  useVoteCourseReview,
} from "@/hooks/useReviews"
import type { CourseReviewSummary } from "@/types/app.types"
import { StarRating } from "./StarRating"

interface CourseReviewsProps {
  productId: string
}

function ratingDistributionPercent(count: number, total: number) {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function ReviewCard({
  review,
  onVote,
  voting,
}: {
  review: CourseReviewSummary
  onVote: (reviewId: string, isHelpful: boolean) => void
  voting: boolean
}) {
  const authorName = review.profiles?.full_name?.trim() || "Aluno Mariana Explica"

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{authorName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StarRating value={review.rating} readonly size="sm" />
            <span className="text-xs font-semibold text-slate-500">{formatReviewDate(review.created_at)}</span>
            {review.is_verified_purchase ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Compra verificada
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{review.title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{review.content}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full px-3 text-xs"
          onClick={() => onVote(review.id, true)}
          disabled={voting}
        >
          <ThumbsUp className="mr-2 h-4 w-4" />
          Util ({review.helpful_count})
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full px-3 text-xs"
          onClick={() => onVote(review.id, false)}
          disabled={voting}
        >
          <ThumbsDown className="mr-2 h-4 w-4" />
          Nao util ({review.unhelpful_count})
        </Button>
      </div>
    </article>
  )
}

export function CourseReviews({ productId }: CourseReviewsProps) {
  const { isAuthenticated } = useAuth()
  const statsQuery = useCourseReviewStats(productId)
  const reviewsQuery = useApprovedCourseReviews(productId)
  const myReviewQuery = useMyCourseReview(productId)
  const createReview = useCreateCourseReview(productId)
  const voteReview = useVoteCourseReview(productId)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [loadedReviewId, setLoadedReviewId] = useState<string | null>(null)
  const stats = statsQuery.data
  const reviews = reviewsQuery.data ?? []

  useEffect(() => {
    if (!myReviewQuery.data || loadedReviewId === myReviewQuery.data.id) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the editable draft from the user's existing review.
    setLoadedReviewId(myReviewQuery.data.id)
    setRating(myReviewQuery.data.rating)
    setTitle(myReviewQuery.data.title)
    setContent(myReviewQuery.data.content)
  }, [loadedReviewId, myReviewQuery.data])

  const distribution = useMemo(() => {
    const values = stats?.rating_distribution ?? { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: values[String(star) as "1" | "2" | "3" | "4" | "5"] ?? 0,
    }))
  }, [stats?.rating_distribution])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    const response = await createReview.mutateAsync({ productId, rating, title, content })
    setMessage(
      response.needs_moderation
        ? "Avaliacao enviada para moderacao."
        : "Avaliacao publicada. Obrigada por partilhares a tua experiencia.",
    )
  }

  const handleVote = (reviewId: string, isHelpful: boolean) => {
    void voteReview.mutateAsync({ reviewId, isHelpful })
  }

  return (
    <section className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Reviews</p>
          <h2 className="mt-2 font-display text-3xl font-black text-slate-950">Avaliacoes dos alunos</h2>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-right shadow-sm">
          <p className="text-3xl font-black text-slate-950">{Number(stats?.avg_rating ?? 0).toFixed(1)}</p>
          <StarRating value={Number(stats?.avg_rating ?? 0)} readonly size="sm" />
          <p className="mt-1 text-xs font-semibold text-slate-500">{stats?.total_reviews ?? 0} avaliacoes</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            {distribution.map((item) => (
              <div key={item.star} className="grid grid-cols-[44px_1fr_42px] items-center gap-3 text-sm">
                <span className="font-bold text-slate-700">{item.star} estrelas</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${ratingDistributionPercent(item.count, stats?.total_reviews ?? 0)}%` }}
                  />
                </div>
                <span className="text-right font-semibold text-slate-500">{item.count}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <MessageSquareText className="h-4 w-4 text-sky-700" />
              Deixar avaliacao
            </div>
            {!isAuthenticated ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                <Link to={ROUTES.LOGIN} className="font-bold text-sky-700 underline underline-offset-4">
                  Faz login
                </Link>{" "}
                para avaliar um curso que ja esta na tua area do aluno.
              </p>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                <StarRating value={rating} onChange={setRating} />
                <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Titulo
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={3}
                    maxLength={100}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none focus:border-sky-500"
                    placeholder={myReviewQuery.data ? "Atualizar titulo" : "Resumo da experiencia"}
                    required
                  />
                </label>
                <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Comentario
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    minLength={3}
                    maxLength={3000}
                    rows={4}
                    className="mt-1 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-950 outline-none focus:border-sky-500"
                    placeholder="Conta o que foi mais util no curso."
                    required
                  />
                </label>
                <Button type="submit" className="w-full rounded-md" disabled={createReview.isPending}>
                  {createReview.isPending ? "A enviar..." : myReviewQuery.data ? "Atualizar avaliacao" : "Enviar avaliacao"}
                </Button>
                {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
                {createReview.isError ? (
                  <p className="text-sm font-semibold text-red-700">
                    {createReview.error instanceof Error ? createReview.error.message : "Nao foi possivel enviar."}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </aside>

        <div className="space-y-4">
          {reviewsQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
              A carregar avaliacoes...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
              Ainda nao existem avaliacoes publicadas para este curso.
            </div>
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onVote={handleVote}
                voting={voteReview.isPending}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
