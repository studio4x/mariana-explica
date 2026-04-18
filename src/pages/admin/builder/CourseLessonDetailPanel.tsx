import { Link, useParams } from "react-router-dom"
import { useMemo, useState, type FormEvent } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import { useAdminProductLessons, useUpdateAdminProductLesson } from "@/hooks/useAdmin"
import { adminCourseLessonMaterialsPath } from "@/lib/routes"
import type { ProductLessonSummary } from "@/types/app.types"

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export function CourseLessonDetailPanel() {
  const { courseId, moduleId, lessonId } = useParams<{
    courseId: string
    moduleId: string
    lessonId: string
  }>()
  const lessonsQuery = useAdminProductLessons(moduleId)
  const updateLesson = useUpdateAdminProductLesson()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<ProductLessonSummary>>({})

  if (!courseId || !moduleId || !lessonId) {
    return <EmptyState title="Aula invalida" message="Seleciona uma aula valida na arvore do builder." />
  }

  if (lessonsQuery.isLoading) {
    return <LoadingState message="A carregar editor da aula..." />
  }

  if (lessonsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel abrir a aula"
        message={lessonsQuery.error instanceof Error ? lessonsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void lessonsQuery.refetch()}
      />
    )
  }

  const lessons = lessonsQuery.data ?? []
  const lesson = useMemo(
    () => lessons.find((item) => item.id === lessonId) ?? null,
    [lessonId, lessons],
  )

  if (!lesson) {
    return <EmptyState title="Aula nao encontrada" message="Esta aula nao esta ligada ao modulo atual." />
  }

  const values = {
    title: form.title ?? lesson.title,
    description: form.description ?? lesson.description ?? "",
    position: form.position ?? lesson.position,
    lesson_type: form.lesson_type ?? lesson.lesson_type,
    youtube_url: form.youtube_url ?? lesson.youtube_url ?? "",
    text_content: form.text_content ?? lesson.text_content ?? "",
    estimated_minutes: form.estimated_minutes ?? lesson.estimated_minutes,
    starts_at: String(form.starts_at ?? toDateTimeLocal(lesson.starts_at)),
    ends_at: String(form.ends_at ?? toDateTimeLocal(lesson.ends_at)),
    is_required: form.is_required ?? lesson.is_required,
    status: form.status ?? lesson.status,
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await updateLesson.mutateAsync({
        lessonId: lesson.id,
        title: values.title?.trim(),
        description: values.description?.trim() || null,
        position: Number(values.position),
        lesson_type: values.lesson_type,
        youtube_url: values.youtube_url?.trim() || null,
        text_content: values.text_content?.trim() || null,
        estimated_minutes: Number(values.estimated_minutes || 0),
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
        is_required: Boolean(values.is_required),
        status: values.status,
      })
      setForm({})
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel guardar a aula.")
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={lesson.title}
          description="Editor dedicado da aula com tipo, agenda, conteudo e acesso rapido aos materiais."
        />

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={String(values.title)}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titulo da aula"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={String(values.position)}
            onChange={(event) => setForm((prev) => ({ ...prev, position: Number(event.target.value || 0) }))}
            placeholder="Posicao"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <select
            value={String(values.lesson_type)}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                lesson_type: event.target.value as ProductLessonSummary["lesson_type"],
              }))
            }
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="video">Video</option>
            <option value="text">Texto</option>
            <option value="hybrid">Hibrida</option>
          </select>
          <select
            value={String(values.status)}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value as ProductLessonSummary["status"],
              }))
            }
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicada</option>
            <option value="archived">Arquivada</option>
          </select>
          <input
            value={String(values.youtube_url)}
            onChange={(event) => setForm((prev) => ({ ...prev, youtube_url: event.target.value }))}
            placeholder="URL do YouTube"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:col-span-2"
          />
          <input
            value={String(values.estimated_minutes)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, estimated_minutes: Number(event.target.value || 0) }))
            }
            placeholder="Minutos estimados"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            type="datetime-local"
            value={String(values.starts_at)}
            onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            type="datetime-local"
            value={String(values.ends_at)}
            onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <textarea
            value={String(values.description)}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={4}
            placeholder="Descricao curta"
            className="md:col-span-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <textarea
            value={String(values.text_content)}
            onChange={(event) => setForm((prev) => ({ ...prev, text_content: event.target.value }))}
            rows={10}
            placeholder="Conteudo textual"
            className="md:col-span-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(values.is_required)}
              onChange={(event) => setForm((prev) => ({ ...prev, is_required: event.target.checked }))}
            />
            Aula obrigatoria
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={`${lesson.estimated_minutes} min`} tone="warning" />
            <Button asChild variant="outline" className="rounded-full">
              <Link to={adminCourseLessonMaterialsPath(courseId, moduleId, lesson.id)}>Abrir materiais</Link>
            </Button>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-full" disabled={updateLesson.isPending}>
              {updateLesson.isPending ? "A guardar..." : "Guardar aula"}
            </Button>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>
        </form>
      </section>
    </div>
  )
}
