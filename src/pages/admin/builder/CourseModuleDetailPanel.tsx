import { Link, useParams } from "react-router-dom"
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import {
  useAdminProductLessons,
  useAdminModuleAssets,
  useUploadAdminModulePdf,
  useUpdateAdminProductModule,
} from "@/hooks/useAdmin"
import {
  adminCourseLessonPath,
  adminCourseLessonMaterialsPath,
  adminCourseModuleAssessmentPath,
} from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"
import type { ProductModuleSummary } from "@/types/app.types"

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export function CourseModuleDetailPanel() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>()
  const { modules, assessments } = useAdminCourseBuilderContext()
  const module = useMemo(
    () => modules.find((item) => item.id === moduleId) ?? null,
    [moduleId, modules],
  )
  const lessonsQuery = useAdminProductLessons(moduleId)
  const assetsQuery = useAdminModuleAssets(moduleId)
  const updateModule = useUpdateAdminProductModule()
  const uploadModulePdf = useUploadAdminModulePdf()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<ProductModuleSummary>>({})
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null)

  if (!moduleId || !courseId) {
    return <EmptyState title="Modulo invalido" message="Seleciona um modulo valido na arvore lateral." />
  }

  if (lessonsQuery.isLoading || assetsQuery.isLoading) {
    return <LoadingState message="A carregar workspace do modulo..." />
  }

  if (lessonsQuery.isError || assetsQuery.isError) {
    const queryError = lessonsQuery.error ?? assetsQuery.error
    return (
      <ErrorState
        title="Nao foi possivel abrir o modulo"
        message={queryError instanceof Error ? queryError.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void lessonsQuery.refetch()
          void assetsQuery.refetch()
        }}
      />
    )
  }

  if (!module) {
    return <EmptyState title="Modulo nao encontrado" message="Este modulo nao esta ligado ao curso atual." />
  }

  const lessons = lessonsQuery.data ?? []
  const assets = assetsQuery.data ?? []
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
    module_pdf_file_name: form.module_pdf_file_name ?? module.module_pdf_file_name ?? "",
    is_preview: form.is_preview ?? module.is_preview,
    is_required: form.is_required ?? module.is_required,
    status: form.status ?? module.status,
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await updateModule.mutateAsync({
        moduleId: module.id,
        title: values.title?.trim(),
        description: values.description?.trim() || null,
        position: Number(values.position),
        access_type: values.access_type,
        starts_at: values.starts_at || null,
        ends_at: values.ends_at || null,
        release_days_after_enrollment:
          values.release_days_after_enrollment === ""
            ? null
            : Number(values.release_days_after_enrollment),
        module_pdf_storage_path: values.module_pdf_storage_path?.trim() || null,
        module_pdf_file_name: values.module_pdf_file_name?.trim() || null,
        module_pdf_uploaded_at:
          values.module_pdf_storage_path || values.module_pdf_file_name ? new Date().toISOString() : null,
        is_preview: Boolean(values.is_preview),
        is_required: Boolean(values.is_required),
        status: values.status,
      })
      setForm({})
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel guardar o modulo.")
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
        module_pdf_file_name: upload.file_name,
        module_pdf_uploaded_at: upload.uploaded_at,
      }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel subir o PDF base.")
    } finally {
      event.target.value = ""
      setPendingPdfFile(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={module.title}
          description="Editor dedicado do modulo com agenda, regras de acesso e atalhos para aulas, materiais e quizzes."
        />

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={String(values.title)}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titulo do modulo"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={String(values.position)}
            onChange={(event) => setForm((prev) => ({ ...prev, position: Number(event.target.value || 0) }))}
            placeholder="Posicao"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <select
            value={String(values.access_type)}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                access_type: event.target.value as ProductModuleSummary["access_type"],
              }))
            }
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="public">Publico</option>
            <option value="registered">Registado</option>
            <option value="paid_only">Pago</option>
          </select>
          <select
            value={String(values.status)}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value as ProductModuleSummary["status"],
              }))
            }
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
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
          <input
            value={String(values.release_days_after_enrollment)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, release_days_after_enrollment: event.target.value as never }))
            }
            placeholder="Dias apos inscricao"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <div className="md:col-span-2 rounded-2xl border bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">PDF base do modulo</p>
                <p className="mt-1 text-sm text-slate-600">
                  Upload privado para o storage do curso. O aluno recebe acesso licenciado por URL assinada.
                </p>
              </div>
              {values.module_pdf_file_name ? <StatusBadge label="PDF configurado" tone="success" /> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input type="file" accept="application/pdf" onChange={handlePdfSelection} className="text-sm" />
              <Button type="button" variant="outline" className="rounded-full" disabled={uploadModulePdf.isPending || !pendingPdfFile}>
                {uploadModulePdf.isPending ? "A enviar..." : "Seleciona um PDF"}
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
            {values.module_pdf_file_name ? (
              <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-950">{values.module_pdf_file_name}</p>
                <p className="mt-1 break-all text-slate-500">{values.module_pdf_storage_path}</p>
              </div>
            ) : null}
          </div>
          <textarea
            value={String(values.description)}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={5}
            placeholder="Descricao do modulo"
            className="md:col-span-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(values.is_preview)}
              onChange={(event) => setForm((prev) => ({ ...prev, is_preview: event.target.checked }))}
            />
            Preview publico
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(values.is_required)}
              onChange={(event) => setForm((prev) => ({ ...prev, is_required: event.target.checked }))}
            />
            Modulo obrigatorio
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-full" disabled={updateModule.isPending}>
              {updateModule.isPending ? "A guardar..." : "Guardar modulo"}
            </Button>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>
        </form>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Aulas do modulo</h2>
              <p className="mt-1 text-sm text-slate-600">Cada aula abre o editor dedicado por rota.</p>
            </div>
            <StatusBadge label={`${lessons.length} aulas`} tone="info" />
          </div>

          <div className="mt-4 space-y-3">
            {lessons.length === 0 ? (
              <EmptyState title="Sem aulas" message="Cria aulas no fluxo existente e depois edita cada uma pela rota dedicada." />
            ) : (
              lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-2xl border bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{lesson.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{lesson.description ?? "Aula sem descricao curta."}</p>
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

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Materiais e quizzes</h2>
              <p className="mt-1 text-sm text-slate-600">Atalhos operacionais para o modulo atual.</p>
            </div>
            <StatusBadge label={`${assets.length} materiais`} tone="warning" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border bg-slate-50/80 p-4">
              <p className="font-semibold text-slate-950">Materiais do modulo</p>
              <p className="mt-1 text-sm text-slate-600">
                {assets.length > 0
                  ? `${assets.length} material(is) configurado(s) para este modulo.`
                  : "Sem materiais configurados neste modulo."}
              </p>
              {lessons[0] ? (
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={adminCourseLessonMaterialsPath(courseId, module.id, lessons[0].id)}>Abrir gestor de materiais</Link>
                </Button>
              ) : null}
            </div>

            {moduleAssessments.map((assessment) => (
              <div key={assessment.id} className="rounded-2xl border bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{assessment.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {assessment.description ?? "Quiz ligado a este modulo."}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to={adminCourseModuleAssessmentPath(courseId, module.id, assessment.id)}>Abrir avaliacao</Link>
                  </Button>
                </div>
              </div>
            ))}

            {moduleAssessments.length === 0 ? (
              <EmptyState title="Sem quizzes do modulo" message="Quando houver avaliacao ligada ao modulo, ela aparece aqui." />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
