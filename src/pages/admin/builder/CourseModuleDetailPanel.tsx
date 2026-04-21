import { Link, useNavigate, useParams } from "react-router-dom"
import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { RichTextEditor, StatusBadge } from "@/components/common"
import {
  useAdminProductLessons,
  useAdminModuleAssets,
  useDeleteAdminProductModule,
  useUploadAdminModulePdf,
  useUpdateAdminProductModule,
} from "@/hooks/useAdmin"
import {
  adminCourseBuilderPath,
  adminCourseLessonMaterialsPath,
  adminCourseLessonPath,
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
    <label className="space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{label}</span>
      {children}
      {helper ? <p className="text-sm text-slate-500">{helper}</p> : null}
    </label>
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
  const updateModule = useUpdateAdminProductModule()
  const deleteModule = useDeleteAdminProductModule()
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

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Excluir o modulo "${module.title}"? Esta acao remove a estrutura ligada a ele.`,
    )
    if (!confirmed) return

    setError(null)
    try {
      await deleteModule.mutateAsync(module.id)
      navigate(adminCourseBuilderPath(courseId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir o modulo.")
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
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Modulo do curso</p>
            <h1 className="font-display text-3xl font-extrabold text-slate-950">Configuracoes do Modulo</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Atualiza os metadados, as restricoes de liberacao e o PDF base licenciado deste modulo.
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
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="space-y-6 p-6 md:p-8">
          <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
            <ModuleField label="Capa / Titulo do Modulo" helper="Nome principal usado na arvore lateral e no mapa do curso.">
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
            label="Descricao Organizacional"
            helper="Resumo interno do papel deste modulo dentro da trilha pedagógica."
          >
            <RichTextEditor
              value={String(values.description)}
              onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
              placeholder="Descreve a finalidade do modulo."
              minHeightClassName="min-h-[180px]"
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
                    <span className="block font-semibold text-slate-950">Exigir conclusao deste modulo</span>
                    <span className="mt-1 block text-slate-500">
                      Mantem o modulo na trilha linear e influencia a progressao do aluno.
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
                    <span className="block font-semibold text-slate-950">Preview publico</span>
                    <span className="mt-1 block text-slate-500">
                      Permite exibir este modulo como amostra sem depender de grant completo.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-sky-50/70 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Acesso comercial</p>
              <ModuleField
                label="Tipo de acesso"
                helper="Define se o modulo pode ser aberto publicamente, apenas por registados ou apenas por pagantes."
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
                  <option value="public">Publico</option>
                  <option value="registered">Registado</option>
                  <option value="paid_only">Pago</option>
                </select>
              </ModuleField>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Liberacao Programada</p>
              <p className="mt-2 text-sm text-slate-500">
                Se houver data e tambem atraso por inscricao, as condicoes sao cumulativas.
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
                label="Liberar apos X dias da inscricao"
                helper="Ex.: 7 significa que o modulo so abre sete dias depois do grant."
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
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">PDF base do modulo</p>
                <p className="mt-2 text-sm text-slate-500">
                  O aluno recebe uma versao licenciada por URL assinada, com marca d&apos;agua sobre o PDF base.
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
                <p className="text-slate-500">Nenhum PDF base configurado para este modulo.</p>
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
            {deleteModule.isPending ? "A excluir..." : "Excluir Modulo"}
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            <Button type="submit" className="rounded-full" disabled={updateModule.isPending}>
              {updateModule.isPending ? "A guardar..." : "Salvar Alteracoes"}
            </Button>
          </div>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <div key={lesson.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Materiais e quizzes</h2>
              <p className="mt-1 text-sm text-slate-600">Atalhos operacionais para o modulo atual.</p>
            </div>
            <StatusBadge label={`${assets.length} materiais`} tone="warning" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
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
              <div key={assessment.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
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
