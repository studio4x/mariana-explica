import { Link, useNavigate, useParams } from "react-router-dom"
import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
import {
  useAdminProductLessons,
  useDeleteAdminProductLesson,
  useUpdateAdminProductLesson,
} from "@/hooks/useAdmin"
import { adminCourseLessonMaterialsPath, adminCourseModulePath } from "@/lib/routes"
import type { ProductLessonSummary } from "@/types/app.types"

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function LessonField({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{label}</span>
      {children}
      {helper ? <p className="text-sm text-slate-500">{helper}</p> : null}
    </label>
  )
}

const LESSON_TYPE_OPTIONS: Array<{
  value: ProductLessonSummary["lesson_type"]
  title: string
  description: string
}> = [
  { value: "video", title: "Apenas Video", description: "A aula depende do player e pode omitir o corpo textual." },
  { value: "text", title: "Apenas Texto", description: "A aula fica orientada a leitura e narração." },
  { value: "hybrid", title: "Video + Texto", description: "Combina video, leitura e apoio escrito." },
]

export function CourseLessonDetailPanel() {
  const navigate = useNavigate()
  const { courseId, moduleId, lessonId } = useParams<{
    courseId: string
    moduleId: string
    lessonId: string
  }>()
  const lessonsQuery = useAdminProductLessons(moduleId)
  const updateLesson = useUpdateAdminProductLesson()
  const deleteLesson = useDeleteAdminProductLesson()
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

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Excluir a aula "${lesson.title}"? Esta acao remove o conteudo ligado a ela.`,
    )
    if (!confirmed) return

    setError(null)
    try {
      await deleteLesson.mutateAsync(lesson.id)
      navigate(adminCourseModulePath(courseId, moduleId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir a aula.")
    }
  }

  const showAudioModeration = values.lesson_type === "text" || values.lesson_type === "hybrid"

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Aula do modulo</p>
            <h1 className="font-display text-3xl font-extrabold text-slate-950">Editor de Aula</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Define identidade, formato pedagogico, conteudo multimodal e janela de liberacao desta aula.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={values.status === "published" ? "Publicada" : values.status === "archived" ? "Arquivada" : "Rascunho"}
              tone={values.status === "published" ? "success" : values.status === "archived" ? "warning" : "info"}
            />
            <StatusBadge label={`${values.estimated_minutes || 0} min`} tone="warning" />
            <Button asChild variant="outline" className="rounded-full">
              <Link to={adminCourseLessonMaterialsPath(courseId, moduleId, lesson.id)}>Botoes e URLs da Aula</Link>
            </Button>
          </div>
        </div>
      </section>

      {showAudioModeration ? (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Audio e narracao</p>
            <h2 className="mt-3 text-lg font-bold text-slate-950">Player administrativo da narracao</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              O spec do builder preve um player de audio e controle operacional de narracao nesta aula. A area visual
              ja fica reservada aqui para manter a mesma hierarquia do construtor.
            </p>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Nenhum player administrativo ligado nesta implementacao atual.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Moderacao</p>
            <h2 className="mt-3 text-lg font-bold text-slate-950">Solicitacoes de narracao</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              O documento descreve fila administrativa de revisao, resposta e encerramento. O backend ainda nao expoe
              esse fluxo, por isso a tela fica como placeholder estrutural.
            </p>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Sem integracao de moderacao disponivel nesta versao.
            </div>
          </div>
        </section>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="space-y-6 p-6 md:p-8">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Bloco 01: Identificacao da Aula
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Base editorial</h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <LessonField label="Titulo obrigatorio">
                <input
                  value={String(values.title)}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex.: Boas-vindas"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                />
              </LessonField>

              <div className="grid gap-5 sm:grid-cols-2">
                <LessonField label="Posicao">
                  <input
                    value={String(values.position)}
                    onChange={(event) => setForm((prev) => ({ ...prev, position: Number(event.target.value || 0) }))}
                    placeholder="1"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </LessonField>
                <LessonField label="Status">
                  <select
                    value={String(values.status)}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as ProductLessonSummary["status"],
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicada</option>
                    <option value="archived">Arquivada</option>
                  </select>
                </LessonField>
              </div>
            </div>

            <LessonField label="Descricao curta opcional">
              <textarea
                value={String(values.description)}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                placeholder="Resumo rapido da aula."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300"
              />
            </LessonField>
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Bloco 02: Formato Pedagogico
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Escolhe como a aula sera consumida</h2>
            </div>

            <div className="rounded-2xl bg-slate-100/80 p-1.5">
              <div className="grid gap-2 md:grid-cols-3">
                {LESSON_TYPE_OPTIONS.map((option) => {
                  const isActive = values.lesson_type === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, lesson_type: option.value }))}
                      className={[
                        "rounded-[1.15rem] px-4 py-4 text-left transition",
                        isActive
                          ? "bg-white text-slate-950 shadow-sm ring-1 ring-sky-200"
                          : "text-slate-500 hover:bg-white/70",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-bold">{option.title}</span>
                      <span className="mt-1 block text-sm leading-6">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 03: Conteudo em Video
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Fonte audiovisual</h2>
              </div>

              <LessonField
                label="URL do video"
                helper="Aceita o link atual do YouTube usado pelo player administrativo."
              >
                <input
                  value={String(values.youtube_url)}
                  onChange={(event) => setForm((prev) => ({ ...prev, youtube_url: event.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                />
              </LessonField>
            </div>

            <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 04: Conteudo em Texto
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Corpo textual da aula</h2>
              </div>

              <LessonField
                label="Texto principal"
                helper="Mantem o conteudo base desta aula para player, narracao e futuras evolucoes editoriais."
              >
                <textarea
                  value={String(values.text_content)}
                  onChange={(event) => setForm((prev) => ({ ...prev, text_content: event.target.value }))}
                  rows={12}
                  placeholder="Escreve o conteudo textual da aula."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300"
                />
              </LessonField>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 05: Duracao e liberacao
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Agenda operacional</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <LessonField label="Minutos estimados">
                  <input
                    value={String(values.estimated_minutes)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, estimated_minutes: Number(event.target.value || 0) }))
                    }
                    placeholder="0"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </LessonField>
                <LessonField label="Liberar em">
                  <input
                    type="datetime-local"
                    value={String(values.starts_at)}
                    onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </LessonField>
                <LessonField label="Expirar em">
                  <input
                    type="datetime-local"
                    value={String(values.ends_at)}
                    onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </LessonField>
              </div>
            </div>

            <div className="space-y-5 rounded-2xl border border-slate-200 bg-sky-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 06: Regras pedagogicas
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Obrigatoriedade e apoio</h2>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(values.is_required)}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_required: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Aula obrigatoria</span>
                  <span className="mt-1 block text-slate-500">
                    Mantem esta aula dentro do percurso minimo para concluir o modulo.
                  </span>
                </span>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Preview dos botoes do rodape</p>
                <p className="mt-1">
                  O acesso detalhado a botoes e URLs fica na rota dedicada de materiais da aula.
                </p>
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={adminCourseLessonMaterialsPath(courseId, moduleId, lesson.id)}>Abrir configuracao de materiais</Link>
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 md:px-8">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={handleDelete}
            disabled={deleteLesson.isPending}
          >
            {deleteLesson.isPending ? "A excluir..." : "Excluir Aula"}
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <Button type="submit" className="rounded-full" disabled={updateLesson.isPending}>
              {updateLesson.isPending ? "A guardar..." : "Salvar Alteracoes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
