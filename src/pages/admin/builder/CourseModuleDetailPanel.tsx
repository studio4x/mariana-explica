import { Link, useNavigate, useParams } from "react-router-dom"
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { LessonContentBlocksEditor, OperationFeedbackModal, StatusBadge } from "@/components/common"
import type { LessonContentBlocksEditorHandle } from "@/components/common/LessonContentBlocksEditor"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import {
  useAdminModuleAssetUploadLimit,
  useAdminProductLessons,
  useAdminModuleAssets,
  useCreateAdminProductLesson,
  useCreateAdminProductAssessment,
  useDeleteAdminProductAssessment,
  useDeleteAdminProductLesson,
  useDeleteAdminProductModule,
  useUploadAdminModulePdf,
  useUpdateAdminProductLesson,
  useUpdateAdminProductModule,
} from "@/hooks/useAdmin"
import {
  adminCourseBuilderPath,
  adminCourseLessonMaterialsPath,
  adminCourseLessonPath,
  adminCourseModuleAssessmentPath,
} from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"
import type { ProductModuleSummary } from "@/types/app.types"
import {
  exportModuleToJson,
  normalizeModuleImportForReplace,
  parseJsonInput,
} from "@/lib/course-json-import-export"

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function ModuleField({
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

export function CourseModuleDetailPanel() {
  const navigate = useNavigate()
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const { modules, assessments } = useAdminCourseBuilderContext()
  const module = useMemo(
    () => modules.find((item) => item.id === moduleId) ?? null,
    [moduleId, modules],
  )
  const lessonsQuery = useAdminProductLessons(moduleId)
  const assetsQuery = useAdminModuleAssets(moduleId)
  const moduleAssetUploadLimitQuery = useAdminModuleAssetUploadLimit(moduleId)
  const createAssessment = useCreateAdminProductAssessment()
  const createLesson = useCreateAdminProductLesson()
  const deleteAssessment = useDeleteAdminProductAssessment()
  const deleteLesson = useDeleteAdminProductLesson()
  const updateLesson = useUpdateAdminProductLesson()
  const updateModule = useUpdateAdminProductModule()
  const deleteModule = useDeleteAdminProductModule()
  const uploadModulePdf = useUploadAdminModulePdf()
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string; title?: string } | null>(
    null,
  )
  const [form, setForm] = useState<Partial<ProductModuleSummary>>({})
  const descriptionEditorRef = useRef<LessonContentBlocksEditorHandle | null>(null)
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null)
  const [jsonImport, setJsonImport] = useState("")
  const [importPending, setImportPending] = useState(false)
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null)

  if (!moduleId || !courseId) {
    return <EmptyState title="Módulo inválido" message="Seleciona um módulo válido na Árvore lateral." />
  }

  if (lessonsQuery.isLoading || assetsQuery.isLoading) {
    return <LoadingState message="A carregar workspace do módulo..." />
  }

  if (lessonsQuery.isError || assetsQuery.isError) {
    const queryError = lessonsQuery.error ?? assetsQuery.error
    return (
      <ErrorState
        title="Não foi possível abrir o módulo"
        message={queryError instanceof Error ? queryError.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void lessonsQuery.refetch()
          void assetsQuery.refetch()
        }}
      />
    )
  }

  if (!module) {
    return <EmptyState title="Módulo não encontrado" message="Este módulo não esta ligado ao material atual." />
  }

  const lessons = lessonsQuery.data ?? []
  const assets = assetsQuery.data ?? []
  const maxVideoUploadBytes = moduleAssetUploadLimitQuery.data?.max_file_size_bytes ?? null
  const moduleAssessments = assessments.filter((assessment) => assessment.module_id === module.id)
  const values = {
    title: form.title ?? module.title,
    description: form.description ?? module.description ?? "",
    position: form.position ?? module.position,
    access_type: form.access_type ?? module.access_type,
    starts_at: String(form.starts_at ?? toDateTimeLocal(module.starts_at)),
    ends_at: String(form.ends_at ?? toDateTimeLocal(module.ends_at)),
    release_days_after_enrollment:
      form.release_days_after_enrollment ?? module.release_days_after_enrollment ?? "",
    module_pdf_storage_path: form.module_pdf_storage_path ?? module.module_pdf_storage_path ?? "",
    module_pdf_storage_provider: form.module_pdf_storage_provider ?? module.module_pdf_storage_provider ?? "r2",
    module_pdf_file_name: form.module_pdf_file_name ?? module.module_pdf_file_name ?? "",
    is_preview: form.is_preview ?? module.is_preview,
    is_required: form.is_required ?? module.is_required,
    status: form.status ?? module.status,
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const latestDescription = descriptionEditorRef.current?.flush()

    try {
      const updatedModule = await updateModule.mutateAsync({
        moduleId: module.id,
        title: values.title?.trim(),
        description: (latestDescription ?? values.description)?.trim() || null,
        position: Number(values.position),
        access_type: values.access_type,
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
        release_days_after_enrollment:
          values.release_days_after_enrollment === ""
            ? null
            : Number(values.release_days_after_enrollment),
        module_pdf_storage_path: values.module_pdf_storage_path?.trim() || null,
        module_pdf_storage_provider: values.module_pdf_storage_provider ?? "r2",
        module_pdf_file_name: values.module_pdf_file_name?.trim() || null,
        module_pdf_uploaded_at:
          values.module_pdf_storage_path || values.module_pdf_file_name ? new Date().toISOString() : null,
        is_preview: Boolean(values.is_preview),
        is_required: Boolean(values.is_required),
        status: values.status,
      })
      setForm({})
      setFeedback({ tone: "success", message: `O módulo "${updatedModule.title}" foi guardado com sucesso.` })
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Não foi possível guardar o módulo.",
      })
    }
  }

  const persistModuleAfterUpload = async (overrides: {
    description?: string | null
    module_pdf_storage_path?: string | null
    module_pdf_storage_provider?: ProductModuleSummary["module_pdf_storage_provider"]
    module_pdf_file_name?: string | null
    module_pdf_uploaded_at?: string | null
  }) => {
    const latestDescription = descriptionEditorRef.current?.flush()
    const updatedModule = await updateModule.mutateAsync({
      moduleId: module.id,
      title: values.title?.trim(),
      description: (overrides.description ?? latestDescription ?? values.description)?.trim() || null,
      position: Number(values.position),
      access_type: values.access_type,
      starts_at: values.starts_at || null,
      ends_at: values.ends_at || null,
      release_days_after_enrollment:
        values.release_days_after_enrollment === ""
          ? null
          : Number(values.release_days_after_enrollment),
      module_pdf_storage_path:
        overrides.module_pdf_storage_path !== undefined
          ? overrides.module_pdf_storage_path?.trim() || null
          : values.module_pdf_storage_path?.trim() || null,
      module_pdf_storage_provider: overrides.module_pdf_storage_provider ?? values.module_pdf_storage_provider ?? "r2",
      module_pdf_file_name:
        overrides.module_pdf_file_name !== undefined
          ? overrides.module_pdf_file_name?.trim() || null
          : values.module_pdf_file_name?.trim() || null,
      module_pdf_uploaded_at:
        overrides.module_pdf_uploaded_at !== undefined
          ? overrides.module_pdf_uploaded_at
          : values.module_pdf_storage_path || values.module_pdf_file_name
            ? new Date().toISOString()
            : null,
      is_preview: Boolean(values.is_preview),
      is_required: Boolean(values.is_required),
      status: values.status,
    })
    setForm({})
    setFeedback({ tone: "success", message: `O módulo "${updatedModule.title}" foi guardado automaticamente.` })
    return updatedModule
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Excluir o módulo "${module.title}"? Esta ação remove a estrutura ligada a ele.`,
    )
    if (!confirmed) return

    setError(null)
    try {
      await deleteModule.mutateAsync(module.id)
      navigate(adminCourseBuilderPath(courseId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o módulo.")
    }
  }

  const handlePdfSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setPendingPdfFile(file)
    if (!file) return

    setError(null)
    try {
      const upload = await uploadModulePdf.mutateAsync({
        moduleId: module.id,
        file,
        replacePath: values.module_pdf_storage_path || null,
      })

      setForm((prev) => ({
        ...prev,
        module_pdf_storage_path: upload.path,
        module_pdf_storage_provider: upload.storage_provider ?? "r2",
        module_pdf_file_name: upload.file_name,
        module_pdf_uploaded_at: upload.uploaded_at,
      }))
      await persistModuleAfterUpload({
        module_pdf_storage_path: upload.path,
        module_pdf_storage_provider: upload.storage_provider ?? "r2",
        module_pdf_file_name: upload.file_name,
        module_pdf_uploaded_at: upload.uploaded_at,
      })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível subir o PDF base.")
    } finally {
      event.target.value = ""
      setPendingPdfFile(null)
    }
  }

  const handleCreateModuleAssessment = async () => {
    setError(null)

    try {
      const createdAssessment = await createAssessment.mutateAsync({
        productId: courseId,
        moduleId: module.id,
        assessmentType: "module",
        title: `Quiz: ${module.title}`,
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 15,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })

      navigate(adminCourseModuleAssessmentPath(courseId, module.id, createdAssessment.id))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar o quiz do módulo.")
    }
  }

  const handleExportModuleJson = () => {
    const payload = exportModuleToJson(module, lessons, moduleAssessments)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${module.title.toLowerCase().replace(/\s+/g, "-") || "modulo"}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportModuleJson = async () => {
    if (!jsonImport.trim()) {
      setFeedback({ tone: "error", message: "Cole o JSON do módulo para importar." })
      return
    }

    setError(null)
    setImportPending(true)
    try {
      const parsed = parseJsonInput(jsonImport)
      const normalized = normalizeModuleImportForReplace(parsed, module.id, courseId)

      await updateModule.mutateAsync({
        moduleId: module.id,
        title: normalized.module.title,
        description: normalized.module.description ?? null,
      })

      for (const assessment of moduleAssessments) {
        await deleteAssessment.mutateAsync(assessment.id)
      }

      for (const lesson of lessons) {
        await deleteLesson.mutateAsync(lesson.id)
      }

      for (const lesson of normalized.lessons) {
        await createLesson.mutateAsync({
          moduleId: module.id,
          title: lesson.title,
          description: lesson.description ?? null,
          position: lesson.position,
          is_required: lesson.is_required,
          lesson_type: lesson.lesson_type,
          youtube_url: lesson.youtube_url,
          text_content: lesson.text_content,
          estimated_minutes: lesson.estimated_minutes,
          starts_at: null,
          ends_at: null,
          status: "draft",
        })
      }

      for (const assessment of normalized.assessments) {
        await createAssessment.mutateAsync({
          productId: courseId,
          moduleId: module.id,
          assessmentType: "module",
          title: assessment.title,
          description: assessment.description,
          isRequired: assessment.is_required,
          passingScore: assessment.passing_score,
          maxAttempts: assessment.max_attempts,
          estimatedMinutes: assessment.estimated_minutes,
          isActive: assessment.is_active,
          builderPayload: assessment.builder_payload,
        })
      }

      setJsonImport("")
      setFeedback({
        tone: "success",
        title: "Importacao realizada",
        message: `O módulo "${normalized.module.title}" foi importado com sucesso.`,
      })
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Não foi possível importar o módulo em JSON.",
      })
    } finally {
      setImportPending(false)
    }
  }

  const handleLessonReorder = async (sourceLessonId: string, targetLessonId: string) => {
    if (sourceLessonId === targetLessonId) return

    const sourceIndex = lessons.findIndex((lesson) => lesson.id === sourceLessonId)
    const targetIndex = lessons.findIndex((lesson) => lesson.id === targetLessonId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const reordered = [...lessons]
    const [movedLesson] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, movedLesson)

    setError(null)
    try {
      for (const [index, currentLesson] of reordered.entries()) {
        const nextPosition = index + 1
        if (currentLesson.position === nextPosition) continue
        await updateLesson.mutateAsync({
          lessonId: currentLesson.id,
          position: nextPosition,
        })
      }
    } catch (reorderError) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : "Não foi possível reordenar as aulas deste módulo.",
      )
    }
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Módulo do material</p>
            <h1 className="font-display text-3xl font-extrabold text-slate-950">Configurações do Módulo</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Atualiza os metadados, as restricoes de liberação e o PDF base licenciado deste módulo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={values.status === "published" ? "Publicado" : values.status === "archived" ? "Arquivado" : "Rascunho"} tone={values.status === "published" ? "success" : values.status === "archived" ? "warning" : "info"} />
            <StatusBadge label={`${lessons.length} aulas`} tone="info" />
            <StatusBadge label={`${moduleAssessments.length} quizzes`} tone="warning" />
          </div>
        </div>
      </section>

      <form
        id="course-module-form"
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="space-y-6 p-6 md:p-8">
          <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
            <ModuleField label="Capa / Título do Módulo" helper="Nome principal usado na Árvore lateral e no mapa do material.">
              <input
                value={String(values.title)}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex.: Primeiros passos"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
              />
            </ModuleField>

            <div className="grid gap-5 sm:grid-cols-2">
              <ModuleField label="Posicao">
                <input
                  value={String(values.position)}
                  onChange={(event) => setForm((prev) => ({ ...prev, position: Number(event.target.value || 0) }))}
                  placeholder="1"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </ModuleField>
              <ModuleField label="Status">
                <select
                  value={String(values.status)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      status: event.target.value as ProductModuleSummary["status"],
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-sky-300 focus:bg-white"
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </select>
              </ModuleField>
            </div>
          </section>

          <ModuleField
            label="Descrição Organizacional"
            helper="Resumo interno do papel deste módulo dentro da trilha pedagógica."
          >
            <LessonContentBlocksEditor
              ref={(instance) => {
                descriptionEditorRef.current = instance
              }}
              moduleId={moduleId}
              productId={courseId}
              maxVideoUploadBytes={maxVideoUploadBytes}
              value={String(values.description)}
              onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
              onUploadComplete={async (value) => {
                await persistModuleAfterUpload({ description: value })
              }}
              placeholder="Descreve a finalidade do módulo."
            />
          </ModuleField>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Regra pedagogica
              </p>
              <div className="mt-3 space-y-3">
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(values.is_required)}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_required: event.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-slate-950">Exigir conclusão deste módulo</span>
                    <span className="mt-1 block text-slate-500">
                      Mantem o módulo na trilha linear e influencia a progressao do aluno.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(values.is_preview)}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_preview: event.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-slate-950">Preview público</span>
                    <span className="mt-1 block text-slate-500">
                      Permite exibir este módulo como amostra sem depender de grant completo.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-sky-50/70 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Acesso comercial</p>
              <ModuleField
                label="Tipo de acesso"
                helper="Define se o módulo pode ser aberto publicamente, apenas por registados ou apenas por pagantes."
              >
                <select
                  value={String(values.access_type)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      access_type: event.target.value as ProductModuleSummary["access_type"],
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                >
                  <option value="public">Público</option>
                  <option value="registered">Registado</option>
                  <option value="paid_only">Pago</option>
                </select>
              </ModuleField>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Liberação Programada</p>
              <p className="mt-2 text-sm text-slate-500">
                Se houver data e também atraso por inscrição, as condições são cumulativas.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ModuleField label="Liberar em">
                  <input
                    type="datetime-local"
                    value={String(values.starts_at)}
                    onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </ModuleField>
                <ModuleField label="Expirar em">
                  <input
                    type="datetime-local"
                    value={String(values.ends_at)}
                    onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                  />
                </ModuleField>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-amber-50/70 p-5">
              <ModuleField
                label="Liberar após X dias da inscrição"
                helper="Ex.: 7 significa que o módulo só abre sete dias depois do grant."
              >
                <input
                  value={String(values.release_days_after_enrollment)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, release_days_after_enrollment: event.target.value as never }))
                  }
                  placeholder="0"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300"
                />
              </ModuleField>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">PDF base do módulo</p>
                <p className="mt-2 text-sm text-slate-500">
                  O aluno recebe uma versão licenciada por URL assinada, com marca d&após;agua sobre o PDF base.
                </p>
              </div>
              {values.module_pdf_file_name ? <StatusBadge label="PDF configurado" tone="success" /> : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input type="file" accept="application/pdf" onChange={handlePdfSelection} className="text-sm" />
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={uploadModulePdf.isPending || !pendingPdfFile}
              >
                {uploadModulePdf.isPending ? "A enviar..." : "Enviar PDF"}
              </Button>
              {values.module_pdf_file_name ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      module_pdf_storage_path: null,
                      module_pdf_file_name: null,
                      module_pdf_uploaded_at: null,
                    }))
                  }
                >
                  Remover PDF
                </Button>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {values.module_pdf_file_name ? (
                <>
                  <p className="font-semibold text-slate-950">{values.module_pdf_file_name}</p>
                  <p className="mt-1 break-all text-slate-500">{values.module_pdf_storage_path}</p>
                </>
              ) : (
                <p className="text-slate-500">Nenhum PDF base configurado para este módulo.</p>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 md:px-8">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={handleDelete}
            disabled={deleteModule.isPending}
          >
            {deleteModule.isPending ? "A excluir..." : "Excluir Módulo"}
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <Button type="submit" className="rounded-full" disabled={updateModule.isPending}>
              {updateModule.isPending ? "A guardar..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Aulas do módulo</h2>
              <p className="mt-1 text-sm text-slate-600">Cada aula abre o editor dedicado por rota.</p>
            </div>
            <StatusBadge label={`${lessons.length} aulas`} tone="info" />
          </div>

          <div className="mt-4 space-y-3">
            {lessons.length === 0 ? (
              <EmptyState title="Sem aulas" message="Cria aulas no fluxo existente e depois edita cada uma pela rota dedicada." />
            ) : (
              lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={() => setDraggedLessonId(lesson.id)}
                  onDragEnd={() => setDraggedLessonId(null)}
                  onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                  onDrop={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault()
                    if (!draggedLessonId) return
                    void handleLessonReorder(draggedLessonId, lesson.id)
                    setDraggedLessonId(null)
                  }}
                  className={`rounded-2xl border p-4 transition ${
                    draggedLessonId === lesson.id
                      ? "border-sky-300 bg-sky-50/70"
                      : "border-slate-200 bg-slate-50/80"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        Arrastar para ordenar
                      </p>
                      <p className="font-semibold text-slate-950">{lesson.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{lesson.description ?? "Aula sem descrição curta."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="rounded-full">
                        <Link to={adminCourseLessonPath(courseId, module.id, lesson.id)}>Editar aula</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full">
                        <Link to={adminCourseLessonMaterialsPath(courseId, module.id, lesson.id)}>Materiais</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Materiais e quizzes</h2>
              <p className="mt-1 text-sm text-slate-600">Atalhos operacionais para o módulo atual.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={`${assets.length} materiais`} tone="warning" />
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={createAssessment.isPending}
                onClick={() => void handleCreateModuleAssessment()}
              >
                {createAssessment.isPending ? "A criar quiz..." : "Criar quiz do módulo"}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="font-semibold text-slate-950">Materiais do módulo</p>
              <p className="mt-1 text-sm text-slate-600">
                {assets.length > 0
                  ? `${assets.length} material(is) configurado(s) para este módulo.`
                  : "Sem materiais configurados neste módulo."}
              </p>
              {lessons[0] ? (
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={adminCourseLessonMaterialsPath(courseId, module.id, lessons[0].id)}>Abrir gestor de materiais</Link>
                </Button>
              ) : null}
            </div>

            {moduleAssessments.map((assessment) => (
              <div key={assessment.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{assessment.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {assessment.description ?? "Quiz ligado a este módulo."}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to={adminCourseModuleAssessmentPath(courseId, module.id, assessment.id)}>Abrir avaliação</Link>
                  </Button>
                </div>
              </div>
            ))}

            {moduleAssessments.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  title="Sem quizzes do módulo"
                  message="Crie o primeiro quiz deste módulo e continue direto no editor profundo da avaliação."
                />
                <div className="flex justify-center">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={createAssessment.isPending}
                    onClick={() => void handleCreateModuleAssessment()}
                  >
                    {createAssessment.isPending ? "A criar quiz..." : "Criar primeiro quiz"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Importacao e exportacao JSON</h2>
            <p className="mt-1 text-sm text-slate-600">
              Exporta este módulo no contrato da spec. Na importacao, o módulo atual e substituido (aulas + quizzes).
            </p>
          </div>
          <Button type="button" variant="outline" className="rounded-full" onClick={handleExportModuleJson}>
            Exportar módulo em JSON
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={jsonImport}
            onChange={(event) => setJsonImport(event.target.value)}
            rows={10}
            placeholder="Cole aqui o JSON do módulo ou de material (será usado o primeiro módulo)."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="rounded-full"
              disabled={importPending}
              onClick={() => void handleImportModuleJson()}
            >
              {importPending ? "A importar..." : "Importar e substituir módulo"}
            </Button>
            <p className="text-sm text-slate-500">
              Materiais existentes do módulo são preservados. Aulas e quizzes são recriados.
            </p>
          </div>
        </div>
      </section>

      <OperationFeedbackModal
        open={Boolean(feedback)}
        tone={feedback?.tone ?? "success"}
        title={feedback?.title}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />

      <div className="fixed bottom-6 right-6 z-30">
        <Button
          type="submit"
          form="course-module-form"
          className="rounded-full bg-[#1398B7] px-6 py-6 font-black shadow-[0_20px_40px_rgba(19,152,183,0.28)] hover:bg-[#0A3640]"
          disabled={updateModule.isPending}
        >
          {updateModule.isPending ? "A guardar..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  )
}
