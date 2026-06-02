import { Link, useNavigate, useParams } from "react-router-dom"
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { LessonContentBlocksEditor, LessonPrimaryMedia, OperationFeedbackModal, StatusBadge } from "@/components/common"
import type { LessonContentBlocksEditorHandle } from "@/components/common/LessonContentBlocksEditor"
import {
  useAdminModuleAssetUploadLimit,
  useCreateAdminModuleAssetSignedUpload,
  useAdminProductLessons,
  useCreateAdminModuleAsset,
  useDeleteAdminProductLesson,
  useUpdateAdminProductLesson,
  useUploadAdminModuleAssetFile,
} from "@/hooks/useAdmin"
import { supabase } from "@/integrations/supabase"
import { makeLessonVideoAssetValue } from "@/lib/lesson-video"
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

const LESSON_TYPE_OPTIONS: Array<{
  value: ProductLessonSummary["lesson_type"]
  title: string
  description: string
}> = [
  { value: "video", title: "Apenas Vídeo", description: "A aula depende do player de vídeo." },
  { value: "text", title: "Apenas Texto", description: "A aula fica orientada a leitura e apoio escrito." },
  { value: "hybrid", title: "Vídeo + Texto", description: "Combina vídeo, leitura e contexto editorial." },
  { value: "file", title: "Apenas Ficheiro", description: "O consumo principal fica concentrado nos materiais protegidos." },
]

function inferAssetType(file: File): ModuleAssetSummary["asset_type"] {
  if (file.type.startsWith("video/")) {
    return "video_file"
  }

  return "pdf"
}

function buildAssetSortOrder() {
  // `module_assets.sort_order` is an integer column; epoch seconds stay within range.
  return Math.floor(Date.now() / 1000)
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const precision = exponent <= 1 ? 0 : exponent === 2 ? 1 : 2
  return `${value.toFixed(precision)} ${units[exponent]}`
}

function buildProtectedVideoTooLargeMessage(limitBytes?: number | null) {
  if (limitBytes && Number.isFinite(limitBytes) && limitBytes > 0) {
    const maxMb = limitBytes / (1024 * 1024)
    const mbLabel = Number.isInteger(maxMb) ? String(maxMb) : maxMb.toFixed(1)
    return `O vídeo excede o limite permitido (${mbLabel} MB). Reduz o ficheiro ou aumenta o limite global de upload em Storage > Settings no Supabase.`
  }

  return "O vídeo excede o limite de tamanho permitido neste projeto. Reduz o ficheiro ou aumenta o limite global de upload em Storage > Settings no Supabase."
}

function getProtectedVideoLimitInstruction(limitBytes?: number | null) {
  if (limitBytes && Number.isFinite(limitBytes) && limitBytes > 0) {
    const maxMb = limitBytes / (1024 * 1024)
    const mbLabel = Number.isInteger(maxMb) ? String(maxMb) : maxMb.toFixed(1)
    return `Limite máximo atual no Supabase: ${mbLabel} MB por ficheiro.`
  }

  return "Limite máximo por ficheiro definido no Storage do Supabase. O valor pode variar por configuração do projeto."
}

function normalizeProtectedVideoUploadErrorMessage(error: unknown, limitBytes?: number | null) {
  const rawMessage = error instanceof Error ? error.message : "Não foi possível enviar o vídeo."
  const normalized = rawMessage.toLowerCase()

  if (
    normalized.includes("exceeded the maximum allowed size")
    || normalized.includes("file too large")
    || normalized.includes("payload too large")
    || normalized.includes("entity too large")
  ) {
    return buildProtectedVideoTooLargeMessage(limitBytes)
  }

  return rawMessage
}

function getVideoSourceSummary(mode: "url" | "upload", source: string | null | undefined) {
  const trimmed = source?.trim() ?? ""
  const hasAsset = trimmed.toLowerCase().startsWith("asset:")

  if (mode === "upload") {
    if (hasAsset) {
      return {
        label: "Vídeo protegido na plataforma",
        message: "Este ficheiro usa storage privado e o player recebe apenas URL assinada temporaria.",
        tone: "success" as const,
      }
    }

    return {
      label: "Upload protegido selecionado",
      message: "Seleciona um ficheiro e clica em Enviar vídeo protegido para concluir esta aula sem depender de link externo.",
      tone: "neutral" as const,
    }
  }

  if (!trimmed) {
    return {
      label: "Sem URL de vídeo",
      message: "Define um link do YouTube ou de um vídeo direto enquanto o modo de URL estiver ativo.",
      tone: "neutral" as const,
    }
  }

  if (hasAsset) {
    return {
      label: "Vídeo protegido na plataforma",
      message: "Este ficheiro usa storage privado e o player recebe apenas URL assinada temporaria.",
      tone: "success" as const,
    }
  }

  return {
    label: "URL externa configurada",
    message:
      "Links externos podem ser partilhados fora da plataforma. Use upload protegido para o nível mais alto de controlo disponível.",
    tone: "warning" as const,
  }
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
  const moduleAssetUploadLimitQuery = useAdminModuleAssetUploadLimit(moduleId)
  const createSignedVideoUpload = useCreateAdminModuleAssetSignedUpload()
  const createAsset = useCreateAdminModuleAsset()
  const [error, setError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [videoUploadStatus, setVideoUploadStatus] = useState<{
    tone: "info" | "success" | "error"
    message: string
  } | null>(null)
  const [form, setForm] = useState<Partial<ProductLessonSummary>>({})
  const [videoSourceMode, setVideoSourceMode] = useState<"url" | "upload">("url")
  const [videoUrlDraft, setVideoUrlDraft] = useState("")
  const [uploadedVideoAssetValue, setUploadedVideoAssetValue] = useState<string | null>(null)
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null)
  const [resolvedProtectedVideoMaxBytes, setResolvedProtectedVideoMaxBytes] = useState<number | null>(null)
  const descriptionEditorRef = useRef<LessonContentBlocksEditorHandle | null>(null)
  const textContentEditorRef = useRef<LessonContentBlocksEditorHandle | null>(null)
  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data])
  const lesson = useMemo(
    () => lessons.find((item) => item.id === lessonId) ?? null,
    [lessonId, lessons],
  )
  const pendingVideoPreviewUrl = useMemo(
    () => (pendingVideoFile ? URL.createObjectURL(pendingVideoFile) : null),
    [pendingVideoFile],
  )

  useEffect(() => {
    return () => {
      if (pendingVideoPreviewUrl) {
        URL.revokeObjectURL(pendingVideoPreviewUrl)
      }
    }
  }, [pendingVideoPreviewUrl])

  useEffect(() => {
    if (!lesson) {
      return
    }

    const currentSource = lesson.youtube_url?.trim() ?? ""
    const hasUploadedVideo = currentSource.toLowerCase().startsWith("asset:")

    setVideoSourceMode(hasUploadedVideo ? "upload" : "url")
    setVideoUrlDraft(hasUploadedVideo ? "" : currentSource)
    setUploadedVideoAssetValue(hasUploadedVideo ? currentSource : null)
    setPendingVideoFile(null)
  }, [lesson])

  if (!courseId || !moduleId || !lessonId) {
    return <EmptyState title="Aula inválida" message="Seleciona uma aula válida na Árvore do builder." />
  }

  if (lessonsQuery.isLoading) {
    return <LoadingState message="A carregar editor da aula..." />
  }

  if (lessonsQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível abrir a aula"
        message={lessonsQuery.error instanceof Error ? lessonsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void lessonsQuery.refetch()}
      />
    )
  }

  if (!lesson) {
    return <EmptyState title="Aula não encontrada" message="Esta aula não esta ligada ao módulo atual." />
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
  const protectedVideoMaxBytes =
    resolvedProtectedVideoMaxBytes
    ?? moduleAssetUploadLimitQuery.data?.max_file_size_bytes
    ?? null
  const currentStoredVideoSource = String(values.youtube_url ?? "").trim()
  const activeVideoSource =
    videoSourceMode === "upload"
      ? uploadedVideoAssetValue
        ?? pendingVideoPreviewUrl
        ?? (currentStoredVideoSource.toLowerCase().startsWith("asset:") ? currentStoredVideoSource : "")
      : videoUrlDraft
  const videoSourceSummary = getVideoSourceSummary(videoSourceMode, activeVideoSource)

  const handleVideoSourceModeChange = (nextMode: "url" | "upload") => {
    setError(null)
    setUploadMessage(null)

    if (nextMode === "upload") {
      const currentValue = String(form.youtube_url ?? lesson.youtube_url ?? "").trim()
      if (currentValue && !currentValue.toLowerCase().startsWith("asset:")) {
        setVideoUrlDraft(currentValue)
      }
    }

    setVideoSourceMode(nextMode)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const latestDescription = descriptionEditorRef.current?.flush()
    const latestTextContent = textContentEditorRef.current?.flush()
    const descriptionToSave = latestDescription ?? values.description
    const textContentToSave = latestTextContent ?? values.text_content

    const normalizedYoutube =
      values.lesson_type === "video" || values.lesson_type === "hybrid"
        ? videoSourceMode === "upload"
          ? uploadedVideoAssetValue ?? (values.youtube_url?.trim().toLowerCase().startsWith("asset:") ? values.youtube_url.trim() : null)
          : videoUrlDraft.trim() || null
        : null
    const normalizedText =
      values.lesson_type === "text" || values.lesson_type === "hybrid" ? textContentToSave?.trim() || null : null

    if ((values.lesson_type === "video" || values.lesson_type === "hybrid") && videoSourceMode === "upload" && !normalizedYoutube) {
      setFeedback({ tone: "error", message: "Seleciona o ficheiro e clica em Enviar vídeo protegido antes de guardar." })
      return
    }

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
      const savedSource = updatedLesson.youtube_url?.trim() ?? ""
      const savedSourceIsAsset = savedSource.toLowerCase().startsWith("asset:")
      setForm({ youtube_url: savedSource })
      setFeedback({ tone: "success", message: `A aula "${updatedLesson.title}" foi guardada com sucesso.` })
      setVideoSourceMode(savedSourceIsAsset ? "upload" : "url")
      setVideoUrlDraft(savedSourceIsAsset ? "" : savedSource)
      setUploadedVideoAssetValue(savedSourceIsAsset ? savedSource : null)
      setPendingVideoFile(null)
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Não foi possível guardar a aula.",
      })
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Excluir a aula "${lesson.title}"? Esta ação remove o conteúdo ligado a ela.`,
    )
    if (!confirmed) return

    setError(null)
    try {
      await deleteLesson.mutateAsync(lesson.id)
      navigate(adminCourseModulePath(courseId, moduleId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a aula.")
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
        sort_order_asset: buildAssetSortOrder(),
        storage_bucket: upload.bucket,
        storage_path: upload.path,
        external_url: null,
        mime_type: upload.mime_type,
        file_size_bytes: upload.file_size_bytes,
        allow_download: !file.type.startsWith("video/"),
        allow_stream: true,
        watermark_enabled: false,
        asset_status: "active",
      })
      setUploadMessage("Ficheiro enviado com sucesso. Ele já esta disponível na Área de materiais deste módulo.")
      setForm((prev) => ({ ...prev, lesson_type: "file" }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar o ficheiro.")
    } finally {
      event.target.value = ""
    }
  }

  const handleVideoUploadSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    setError(null)
    setUploadMessage(null)

    if (protectedVideoMaxBytes && file.size > protectedVideoMaxBytes) {
      const message = buildProtectedVideoTooLargeMessage(protectedVideoMaxBytes)
      setPendingVideoFile(null)
      setFeedback({ tone: "error", message })
      setVideoUploadStatus({
        tone: "error",
        message,
      })
      event.target.value = ""
      return
    }

    setPendingVideoFile(file)
    setVideoUploadStatus({
      tone: "info",
      message: `Ficheiro selecionado: ${file.name} (${formatBytes(file.size)}). Clica em "Enviar vídeo protegido" para concluir o envio.`,
    })
    event.target.value = ""
  }

  const handleInsertProtectedVideo = async () => {
    const file = pendingVideoFile
    if (!file) {
      setFeedback({ tone: "error", message: "Seleciona um ficheiro de vídeo antes de enviar." })
      setVideoUploadStatus({
        tone: "error",
        message: "Nenhum ficheiro selecionado. Escolhe um vídeo antes de enviar.",
      })
      return
    }

    setError(null)
    setUploadMessage(null)
    setVideoUploadStatus({
      tone: "info",
      message: `A enviar "${file.name}" para storage protegido...`,
    })

    try {
      const signedUpload = await createSignedVideoUpload.mutateAsync({
        moduleId,
        fileName: file.name,
        mimeType: file.type || "video/mp4",
      })
      setResolvedProtectedVideoMaxBytes(
        typeof signedUpload.max_file_size_bytes === "number" && Number.isFinite(signedUpload.max_file_size_bytes)
          ? signedUpload.max_file_size_bytes
          : null,
      )
      if (
        signedUpload.max_file_size_bytes
        && Number.isFinite(signedUpload.max_file_size_bytes)
        && file.size > signedUpload.max_file_size_bytes
      ) {
        throw new Error(buildProtectedVideoTooLargeMessage(signedUpload.max_file_size_bytes))
      }
      const signed = signedUpload.signed_upload
      const { error: signedUploadError } = await supabase.storage
        .from(signedUpload.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || "video/mp4",
          upsert: false,
        })

      if (signedUploadError) {
        throw signedUploadError
      }

      const asset = await createAsset.mutateAsync({
        moduleId,
        asset_type: "video_file",
        title: `${values.title?.trim() || lesson.title} - vídeo principal`,
        sort_order_asset: buildAssetSortOrder(),
        storage_bucket: signedUpload.bucket,
        storage_path: signedUpload.path,
        external_url: null,
        mime_type: file.type || signedUpload.mime_type,
        file_size_bytes: file.size,
        allow_download: false,
        allow_stream: true,
        watermark_enabled: false,
        asset_status: "active",
      })

      const assetValue = makeLessonVideoAssetValue(asset.id)
      setForm((prev) => ({ ...prev, youtube_url: assetValue }))
      setUploadedVideoAssetValue(assetValue)
      setVideoSourceMode("upload")
      setPendingVideoFile(null)
      setUploadMessage("Vídeo protegido enviado. Agora clica em Guardar aula para persistir esta configuração.")
      setFeedback({
        tone: "success",
        message: "Vídeo protegido inserido com sucesso no preview. Guarda a aula para concluir.",
      })
      setVideoUploadStatus({
        tone: "success",
        message: "Envio concluido com sucesso. O vídeo protegido já esta pronto no preview desta aula.",
      })
    } catch (uploadError) {
      const uploadErrorMessage = normalizeProtectedVideoUploadErrorMessage(uploadError, protectedVideoMaxBytes)
      setError(uploadErrorMessage)
      setFeedback({ tone: "error", message: uploadErrorMessage })
      setVideoUploadStatus({
        tone: "error",
        message: `Falha no envio: ${uploadErrorMessage}`,
      })
    }
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Aula do módulo</p>
            <h1 className="font-display text-3xl font-extrabold text-slate-950">Editor de Aula</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Define identidade, formato pedagogico, conteúdo principal e janela de liberação desta aula.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={values.status === "published" ? "Publicada" : values.status === "archived" ? "Arquivada" : "Rascunho"}
              tone={values.status === "published" ? "success" : values.status === "archived" ? "warning" : "info"}
            />
            <StatusBadge label={`${values.estimated_minutes || 0} min`} tone="warning" />
            <Button asChild variant="outline" className="rounded-full">
              <Link to={adminCourseLessonMaterialsPath(courseId, moduleId, lesson.id)}>Botões e URLs da Aula</Link>
            </Button>
          </div>
        </div>
      </section>

      <form
        id="course-lesson-form"
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
              <LessonField label="Título obrigatório">
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

            <LessonField label="Descrição curta / Área de texto">
              <LessonContentBlocksEditor
                ref={(instance) => {
                  descriptionEditorRef.current = instance
                }}
                value={String(values.description)}
                onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="Resumo rápido da aula."
              />
            </LessonField>
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Bloco 02: Formato Pedagogico
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Escolhe como a aula será consumida</h2>
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
                  Bloco 03: Conteúdo em Vídeo
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Fonte audiovisual</h2>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-1.5">
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleVideoSourceModeChange("url")}
                    className={[
                      "rounded-[1.1rem] px-4 py-4 text-left transition",
                      videoSourceMode === "url"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-bold">Usar URL do vídeo</span>
                    <span className="mt-1 block text-sm leading-6">
                      Usa YouTube ou outro link direto quando queres apontar para um ficheiro externo.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVideoSourceModeChange("upload")}
                    className={[
                      "rounded-[1.1rem] px-4 py-4 text-left transition",
                      videoSourceMode === "upload"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-bold">Usar upload protegido</span>
                    <span className="mt-1 block text-sm leading-6">
                      Envia o vídeo para a plataforma e pública apenas a URL assinada temporaria.
                    </span>
                  </button>
                </div>
              </div>

              <div
                className={[
                  "rounded-2xl border px-4 py-3 text-sm",
                  videoSourceSummary.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : videoSourceSummary.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white text-slate-700",
                ].join(" ")}
              >
                <p className="font-semibold">{videoSourceSummary.label}</p>
                <p className="mt-1 leading-6">{videoSourceSummary.message}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Preview do vídeo</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Esta visualização usa a origem selecionada no toggle acima.
                    </p>
                  </div>
                  <StatusBadge
                    label={videoSourceMode === "upload" ? "Upload protegido" : "URL externa"}
                    tone={videoSourceMode === "upload" ? "success" : "info"}
                  />
                </div>

                {activeVideoSource ? (
                  <div className="mt-4">
                    <LessonPrimaryMedia source={activeVideoSource} title="Preview do vídeo da aula" />
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Ainda não existe vídeo para pre-visualizar neste modo.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Nota de proteção</p>
                <p className="mt-1 leading-6">
                  Nenhum player web garante proteção total contra pirataria. O upload protegido reduz bastante o risco com bucket privado,
                  URL assinada temporaria e player sem download explicito. Links externos continuam dependentes da segurança do provedor de origem.
                </p>
              </div>

              {videoSourceMode === "url" ? (
                <LessonField
                  label="URL do vídeo"
                  helper="Aceita links do YouTube ou URLs diretas de ficheiro de vídeo como .mp4, .webm, .mov e .m4v."
                >
                  <input
                    value={videoUrlDraft}
                    onChange={(event) => setVideoUrlDraft(event.target.value)}
                    placeholder="https://youtube.com/watch?v=... ou https://cdn.exemplo.com/video.mp4"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </LessonField>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Upload protegido de vídeo</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Recomendado para aulas pagas. O vídeo fica em storage privado e o aluno recebe apenas acesso temporario assinado no player.
                  </p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    {getProtectedVideoLimitInstruction(protectedVideoMaxBytes)}
                  </p>
                  <input
                    type="file"
                    accept="v?deo/mp4,v?deo/webm,v?deo/ogg,v?deo/quicktime,v?deo/x-m4v"
                    onChange={handleVideoUploadSelection}
                    className="mt-4 text-sm"
                  />
                  <Button
                    type="button"
                    className="mt-4 rounded-full"
                    onClick={() => void handleInsertProtectedVideo()}
                    disabled={createSignedVideoUpload.isPending || !pendingVideoFile}
                  >
                    {createSignedVideoUpload.isPending ? "A enviar..." : "Enviar vídeo protegido"}
                  </Button>
                  {pendingVideoFile ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Ficheiro selecionado: <span className="font-medium">{pendingVideoFile.name}</span>
                    </p>
                  ) : null}
                  {videoUploadStatus ? (
                    <p
                      className={[
                        "mt-3 text-sm",
                        videoUploadStatus.tone === "success"
                          ? "text-emerald-700"
                          : videoUploadStatus.tone === "error"
                            ? "text-rose-700"
                            : "text-slate-600",
                      ].join(" ")}
                    >
                      {videoUploadStatus.message}
                    </p>
                  ) : null}
                  {uploadMessage ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      {uploadMessage}
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {(values.lesson_type === "text" || values.lesson_type === "hybrid") ? (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  Bloco 04: Conteúdo em Texto
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">Corpo textual da aula</h2>
              </div>

              <LessonField
                label="Texto principal / Área de texto"
                helper="Conteúdo editorial principal apresentado ao aluno."
              >
                <LessonContentBlocksEditor
                  ref={(instance) => {
                    textContentEditorRef.current = instance
                  }}
                  value={String(values.text_content)}
                  onChange={(value) => setForm((prev) => ({ ...prev, text_content: value }))}
                  placeholder="Escreve o conteúdo textual da aula."
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
                  O upload cria um material protegido dentro do módulo atual e a aula passa a depender desse ficheiro no player.
                </p>
                <input
                  type="file"
                  accept="application/pdf,v?deo/mp4,v?deo/webm,image/png,image/jpeg"
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
                Bloco 05: Duracao e liberação
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
                <span className="block font-semibold text-slate-950">Aula obrigatória</span>
                <span className="mt-1 block text-slate-500">
                  Mantem esta aula dentro do percurso mínimo para concluir o material.
                </span>
              </span>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Preview dos botões do rodape</p>
              <p className="mt-1">
                O acesso detalhado a botões e URLs fica na rota dedicada de materiais da aula.
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-full">
                <Link to={adminCourseLessonMaterialsPath(courseId, moduleId, lesson.id)}>Abrir configuração de materiais</Link>
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
              {updateLesson.isPending ? "A guardar..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </form>

      <OperationFeedbackModal
        open={Boolean(feedback)}
        tone={feedback?.tone ?? "success"}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />

      <div className="fixed bottom-6 right-6 z-30">
        <Button
          type="submit"
          form="course-lesson-form"
          className="rounded-full bg-[#1398B7] px-6 py-6 font-black shadow-[0_20px_40px_rgba(19,152,183,0.28)] hover:bg-[#0A3640]"
          disabled={updateLesson.isPending}
        >
          {updateLesson.isPending ? "A guardar..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  )
}
