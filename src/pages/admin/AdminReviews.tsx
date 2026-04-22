import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { StarRating } from "@/components/reviews"
import { useAdminReviews, useModerateCourseReview } from "@/hooks/useReviews"

const statusTone = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
} as const

export function AdminReviews() {
  const reviewsQuery = useAdminReviews()
  const moderateReview = useModerateCourseReview()

  if (reviewsQuery.isLoading) {
    return <LoadingState message="A carregar reviews..." />
  }

  if (reviewsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar reviews"
        message={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void reviewsQuery.refetch()}
      />
    )
  }

  const reviews = reviewsQuery.data ?? []
  const pendingCount = reviews.filter((review) => review.moderation_status === "pending").length
  const approvedCount = reviews.filter((review) => review.moderation_status === "approved").length
  const rejectedCount = reviews.filter((review) => review.moderation_status === "rejected").length

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">Moderacao</p>
            <h1 className="mt-2 font-display text-3xl font-black">Reviews dos cursos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">
              Aprova ou rejeita avaliacoes antes de manter a vitrine publica confiavel.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <Clock3 className="h-5 w-5 text-amber-200" />
            <p className="mt-2 text-2xl font-black">{pendingCount}</p>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">Pendentes</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-200" />
            <p className="mt-2 text-2xl font-black">{approvedCount}</p>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">Aprovados</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <XCircle className="h-5 w-5 text-red-200" />
            <p className="mt-2 text-2xl font-black">{rejectedCount}</p>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">Rejeitados</p>
          </div>
        </div>
      </section>

      {reviews.length === 0 ? (
        <EmptyState title="Sem reviews" message="Ainda nao existem avaliacoes enviadas pelos alunos." />
      ) : (
        <section className="grid gap-4">
          {reviews.map((review) => {
            const authorName = review.profiles?.full_name?.trim() || "Aluno"
            const isPending = review.moderation_status === "pending"
            return (
              <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={review.moderation_status} tone={statusTone[review.moderation_status]} />
                      {review.is_verified_purchase ? (
                        <StatusBadge label="compra verificada" tone="success" />
                      ) : (
                        <StatusBadge label="sem compra verificada" tone="warning" />
                      )}
                    </div>
                    <h2 className="mt-3 text-xl font-black text-slate-950">{review.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{authorName}</p>
                    <div className="mt-2">
                      <StarRating value={review.rating} readonly size="sm" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={moderateReview.isPending || review.moderation_status === "approved"}
                      onClick={() => void moderateReview.mutateAsync({ reviewId: review.id, action: "approve" })}
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={moderateReview.isPending || review.moderation_status === "rejected"}
                      onClick={() => void moderateReview.mutateAsync({
                        reviewId: review.id,
                        action: "reject",
                        reason: "Rejeitado manualmente no admin",
                      })}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">{review.content}</p>
                {!isPending && review.moderation_reason ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {review.moderation_reason}
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
