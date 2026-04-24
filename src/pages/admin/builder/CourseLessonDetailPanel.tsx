import { Link, useNavigate, useParams } from "react-router-dom"
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { CheckCircle2, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { LessonContentBlocksEditor, StatusBadge } from "@/components/common"
import type { LessonContentBlocksEditorHandle } from "@/components/common/LessonContentBlocksEditor"
import {
  useAdminProductLessons,
  useCreateAdminModuleAsset,
  useDeleteAdminProductLesson,
  useUpdateAdminProductLesson,
  useUploadAdminModuleAssetFile,
} from "@/hooks/useAdmin"
import { adminCourseLessonMaterialsPath, adminCourseModulePath } from "@/lib/routes"
import type { ModuleAssetSummary, ProductLessonSummary } from "@/types/app.types"

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
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{label}</div>
      {children}
      {helper ? <p className="text-sm text-slate-500">{helper}</p> : null}
    </div>
  )
}

function SaveConfirmationModal({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_32px_80px_rgba(15,23,42,0.26)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold text-[#15323b]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5F7077]">{message}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#5F7077] transition hover:bg-[#F2F7F9] hover:text-[#15323b]"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]" onClick={onClose}>
            Continuar
          </Button>
        </div>
      </div>
    </div>
  )
}

const LESSON_TYPE_OPTIONS: Array<{
  value: ProductLessonSummary["lesson_type"]
  title: string
  description: string
}> = [
  { value: "video", title: "Apenas Video", description: "A aula depende do player de video." },
  { value: "text", title: "Apenas Texto", description: "A aula fica orientada a leitura e apoio escrito." },
  { value: "hybrid", title: "Video + Texto", description: "Combina video, leitura e contexto editorial." },
  { value: "file", title: "Apenas Ficheiro", description: "O consumo principal fica concentrado nos materiais protegidos." },
]

function inferAssetType(file: File): ModuleAssetSummary["asset_type"] {
  if (file.type.startsWith("video/")) {
    return "video_file"
  }

  return "pdf"
}

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
  const uploadAssetFile = useUploadAdminModuleAssetFile()
  const createAsset = useCreateAdminModuleAsset()
  const [error, setError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<ProductLessonSummary>>({})
  const descriptionEditorRef = useRef<LessonContentBlocksEditorHandle | null>(null)
  const textContentEditorRef = useRef<LessonContentBlocksEditorHandle | null>(null)
  const lessons = lessonsQuery.data ?? []
  const lesson = useMemo(
    () => lessons.find((item) => item.id === lessonId) ?? null,
    [lessonId, lessons],
  )

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

    const latestDescription = descriptionEditorRef.current?.flush()
    const latestTextContent = textContentEditorRef.current?.flush()
    const descriptionToSave = latestDescription ?? values.description
    const textContentToSave = latestTextContent ?? values.text_content

    const normalizedYoutube =
      values.lesson_type === "video" || values.lesson_type === "hybrid" ? values.youtube_url?.trim() || null : null
    const normalizedText =
      values.lesson_type === "text" || values.lesson_type === "hybrid" ? textContentToSave?.trim() || null : null

    try {
      const updatedLesson = await updateLesson.mutateAsync({
        lessonId: lesson.id,
        title: values.title?.trim(),
        description: descriptionToSave?.trim() || null,
        position: Number(values.position),
        lesson_type: values.lesson_type,
        youtube_url: normalizedYoutube,
        text_content: normalizedText,
        estimated_minutes: Number(values.estimated_minutes || 0),
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
        is_required: Boolean(values.is_required),
        status: values.status,
      })
      setForm({})
      setSaveSuccessMessage(`A aula "${updatedLesson.title}" foi guardada com sucesso.`)
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

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    setError(null)
    setUploadMessage(null)

    try {
      const upload = await uploadAssetFile.mutateAsync({ moduleId, file })
      await createAsset.mutateAsync({
        moduleId,
        asset_type: inferAssetType(file),
        title: `${values.title?.trim() || lesson.title} - ${upload.file_name.replace(/\.[^.]+$/, "")}`,
        sort_order_asset: Date.now(),
        storage_bucket: upload.bucket,
        storage_path: upload.path,
        external_url: null,
        mime_type: upload.mime_type,
        file_size_bytes: upload.file_size_bytes,
        allow_download: true,
        allow_stream: true,
        watermark_enabled: false,
        asset_status: "active",
      })
      setUploadMessage("Ficheiro enviado com sucesso. Ele ja esta disponivel na area de materiais deste modulo.")
      setForm((prev) => ({ ...prev, lesson_type: "file" }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar o ficheiro.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Aula do modulo</p>
            <h1 className="font-display text-3xl font-extrabold text-slate-950">Editor de Aula</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Define identidade, formato pedagogico, conteudo principal e janela de liberacao desta aula.
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

            <LessonField label="Descricao curta / area de texto">
              <LessonContentBlocksEditor
                ref={(instance) => {
                  descriptionEditorRef.current = instance
                }}
                value={String(values.description)}
                onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="Resumo rapido da aula."
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
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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

          {(values.lesson_type === "video" || values.lesson_type === "hybrid") ? (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
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
            </section>
          ) : null}

          {(values.lesson_type === "text" || values.lesson_type === "hybrid") ? (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 04: Conteudo em Texto
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Corpo textual da aula</h2>
              </div>

              <LessonField
                label="Texto principal / area de texto"
                helper="Conteudo editorial principal apresentado ao aluno."
              >
                <LessonContentBlocksEditor
                  ref={(instance) => {
                    textContentEditorRef.current = instance
                  }}
                  value={String(values.text_content)}
                  onChange={(value) => setForm((prev) => ({ ...prev, text_content: value }))}
                  placeholder="Escreve o conteudo textual da aula."
                />
              </LessonField>
            </section>
          ) : null}

          {values.lesson_type === "file" ? (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 04: Ficheiro Principal
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Upload do material protegido</h2>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Enviar ficheiro</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  O upload cria um material protegido dentro do modulo atual e a aula passa a depender desse ficheiro no player.
                </p>
                <input
                  type="file"
                  accept="application/pdf,video/mp4,video/webm,image/png,image/jpeg"
                  onChange={handleFileSelection}
                  className="mt-4 text-sm"
                />
                {uploadMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {uploadMessage}
                  </div>
                ) : null}
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={adminCourseLessonMaterialsPath(courseId, moduleId, lesson.id)}>
                    Abrir gestor de materiais
                  </Link>
                </Button>
              </div>
            </section>
          ) : null}

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
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
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-sky-50/70 p-5">
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

      <SaveConfirmationModal
        open={Boolean(saveSuccessMessage)}
        title="Alteracoes guardadas"
        message={saveSuccessMessage ?? ""}
        onClose={() => setSaveSuccessMessage(null)}
      />
    </div>
  )
}
