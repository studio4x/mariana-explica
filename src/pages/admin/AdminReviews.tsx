import { useMemo, useState, type FormEvent } from "react"
import { BookOpen, CheckCircle2, Clock3, Sparkles, UserRound, XCircle } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { StarRating } from "@/components/reviews"
import { useAdminProducts, useAdminUsers } from "@/hooks/useAdmin"
import { useAdminReviews, useCreateAdminCourseReview, useModerateCourseReview } from "@/hooks/useReviews"

const statusTone = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
} as const

type AuthorMode = "user" | "manual"

export function AdminReviews() {
  const reviewsQuery = useAdminReviews()
  const productsQuery = useAdminProducts()
  const usersQuery = useAdminUsers()
  const createReview = useCreateAdminCourseReview()
  const moderateReview = useModerateCourseReview()

  const [productId, setProductId] = useState("")
  const [authorMode, setAuthorMode] = useState<AuthorMode>("user")
  const [authorId, setAuthorId] = useState("")
  const [manualAuthorName, setManualAuthorName] = useState("")
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loading = reviewsQuery.isLoading || productsQuery.isLoading || usersQuery.isLoading
  const error = reviewsQuery.isError || productsQuery.isError || usersQuery.isError

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data])

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  if (loading) {
    return <LoadingState message="A carregar reviews, materiais e utilizadores..." />
  }

  if (error) {
    return (
      <ErrorState
        title="Nao foi possivel carregar reviews"
        message={
          reviewsQuery.error instanceof Error
            ? reviewsQuery.error.message
            : productsQuery.error instanceof Error
              ? productsQuery.error.message
              : usersQuery.error instanceof Error
                ? usersQuery.error.message
                : "Tenta novamente dentro de instantes."
        }
        onRetry={() => {
          void reviewsQuery.refetch()
          void productsQuery.refetch()
          void usersQuery.refetch()
        }}
      />
    )
  }

  const pendingCount = reviews.filter((review) => review.moderation_status === "pending").length
  const approvedCount = reviews.filter((review) => review.moderation_status === "approved").length
  const rejectedCount = reviews.filter((review) => review.moderation_status === "rejected").length

  const handleCreateReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)

    try {
      const response = await createReview.mutateAsync({
        productId,
        authorId: authorMode === "user" ? authorId.trim() || null : null,
        authorName: authorMode === "manual" ? manualAuthorName.trim() : null,
        rating,
        title,
        content,
        isVerifiedPurchase,
      })

      setTitle("")
      setContent("")
      setManualAuthorName("")
      setRating(5)
      setIsVerifiedPurchase(false)
      setFeedback(response.saved_as === "updated" ? "Review atualizada e publicada." : "Review criada e publicada.")
    } catch {
      // A mensagem vem do estado de erro da mutation.
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">Moderacao</p>
            <h1 className="mt-2 font-display text-3xl font-black">Reviews dos materiais</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">
              Aprova, rejeita e cria avaliacoes manuais para manter a vitrine publica confiavel.
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleCreateReview} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Criação manual</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Publicar review no admin</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Escolhe o material, seleciona um usuario ou informa apenas o nome do aluno, e publica a review ja
                aprovada.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Material</span>
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">Seleciona um material</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title} {product.status !== "published" ? `(${product.status})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Autor da review</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthorMode("user")
                    setFeedback(null)
                  }}
                  className={`h-10 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.14em] transition ${
                    authorMode === "user"
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  Selecionar usuario
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthorMode("manual")
                    setAuthorId("")
                    setFeedback(null)
                  }}
                  className={`h-10 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.14em] transition ${
                    authorMode === "manual"
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  Inserir nome
                </button>
              </div>
            </label>

            {authorMode === "user" ? (
              <label className="grid gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Usuario opcional</span>
                <select
                  value={authorId}
                  onChange={(event) => setAuthorId(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">Usar a conta do admin</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} - {user.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Nome do aluno (sem vinculo de usuario)
                </span>
                <input
                  value={manualAuthorName}
                  onChange={(event) => setManualAuthorName(event.target.value)}
                  placeholder="Ex: Joana Silva"
                  minLength={2}
                  maxLength={120}
                  required={authorMode === "manual"}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </label>
            )}

            {authorMode === "manual" ? (
              <p className="text-xs leading-5 text-slate-500">
                Este modo publica a review com nome manual e sem ligar a um perfil real de aluno.
              </p>
            ) : null}

            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Rating</span>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <StarRating value={rating} onChange={setRating} size="lg" />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Titulo</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Resumo da experiencia"
                minLength={3}
                maxLength={100}
                required
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Conteudo</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                minLength={3}
                maxLength={3000}
                required
                placeholder="Detalha a experiencia do aluno, a utilidade do material e o impacto percebido."
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isVerifiedPurchase}
                onChange={(event) => setIsVerifiedPurchase(event.target.checked)}
                className="h-4 w-4 accent-sky-600"
              />
              Compra verificada
            </label>
          </div>

          {feedback ? <p className="mt-4 text-sm font-semibold text-emerald-700">{feedback}</p> : null}
          {createReview.error instanceof Error ? (
            <p className="mt-3 text-sm text-red-600">{createReview.error.message}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="submit"
              className="rounded-full"
              disabled={
                createReview.isPending ||
                !productId ||
                (authorMode === "manual" && manualAuthorName.trim().length < 2)
              }
            >
              {createReview.isPending ? "A publicar..." : "Publicar review"}
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-950">Resumo rapido</h2>
              <p className="mt-1 text-sm text-slate-600">Materiais e autores disponiveis para vincular a review.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Materiais</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{products.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Usuarios</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{users.length}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {products.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{product.title}</p>
                  <p className="text-xs text-slate-500">{product.status}</p>
                </div>
                <StatusBadge label={product.product_type} tone={product.status === "published" ? "success" : "warning"} />
              </div>
            ))}
            {products.length === 0 ? (
              <EmptyState title="Sem materiais" message="Nao ha materiais disponiveis para associar reviews." />
            ) : null}
          </div>
        </div>
      </section>

      {reviews.length === 0 ? (
        <EmptyState title="Sem reviews" message="Ainda nao existem avaliacoes enviadas pelos alunos." />
      ) : (
        <section className="grid gap-4">
          {reviews.map((review) => {
            const authorName = review.author_name?.trim() || review.profiles?.full_name?.trim() || "Aluno"
            const courseTitle = productMap.get(review.target_id)?.title ?? review.target_id
            const courseStatus = productMap.get(review.target_id)?.status
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
                    <p className="mt-1 text-sm text-slate-500">
                      Material: <span className="font-semibold text-slate-700">{courseTitle}</span>
                      {courseStatus ? <span className="ml-2 text-xs uppercase tracking-[0.12em]">{courseStatus}</span> : null}
                    </p>
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
                      onClick={() =>
                        void moderateReview.mutateAsync({
                          reviewId: review.id,
                          action: "reject",
                          reason: "Rejeitado manualmente no admin",
                        })
                      }
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">{review.content}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    <UserRound className="h-3.5 w-3.5" />
                    Autor: {authorName}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    <BookOpen className="h-3.5 w-3.5" />
                    Material: {courseTitle}
                  </div>
                </div>
                {!isPending && review.moderation_reason ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
