import { useQueries } from "@tanstack/react-query"
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Cog,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
import {
  useCreateAdminProductModule,
  useCreateAdminProductAssessment,
  useCreateAdminProductLesson,
  useCreateAdminModuleAsset,
  useAdminProductAssessments,
  useAdminProductModules,
  useAdminProducts,
  useDeleteAdminProductAssessment,
  useDeleteAdminProductLesson,
  useDeleteAdminProductModule,
  useUpdateAdminProductAssessment,
  useUpdateAdminProductModule,
} from "@/hooks/useAdmin"
import {
  adminCourseAssessmentsPath,
  adminCourseBuilderPath,
  adminCourseFinalAssessmentPath,
  adminCourseLessonPath,
  adminCourseModuleAssessmentPath,
  adminCourseModulePath,
  adminCoursePublicPagePath,
  adminCourseReleasesPath,
  adminCourseSettingsPath,
  publicCoursePath,
} from "@/lib/routes"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import { BUILD_VERSION } from "@/lib/build"
import { fetchAdminModuleAssets, fetchAdminProductLessons } from "@/services"
import type {
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { AdminCourseBuilderContext } from "./AdminCourseBuilderContext"
import {
  exportCourseToJson,
  makeCourseExportFileName,
  normalizeCourseImport,
  parseJsonInput,
  type ExportedCourseModule,
} from "@/lib/course-json-import-export"

function triggerJsonDownload(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminCourseBuilderLayout() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(courseId)
  const assessmentsQuery = useAdminProductAssessments(courseId)
  const createModule = useCreateAdminProductModule()
  const createLesson = useCreateAdminProductLesson()
  const createAssessment = useCreateAdminProductAssessment()
  const createModuleAsset = useCreateAdminModuleAsset()
  const deleteModule = useDeleteAdminProductModule()
  const deleteLesson = useDeleteAdminProductLesson()
  const deleteAssessment = useDeleteAdminProductAssessment()
  const updateModule = useUpdateAdminProductModule()
  const updateAssessment = useUpdateAdminProductAssessment()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [builderError, setBuilderError] = useState<string | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importJson, setImportJson] = useState("")
  const [importMode, setImportMode] = useState<"append" | "replace_module">("append")
  const [clearCourseBeforeImport, setClearCourseBeforeImport] = useState(false)
  const [replaceModuleId, setReplaceModuleId] = useState<string>("")
  const [isImporting, setIsImporting] = useState(false)

  const product = useMemo(() => {
    const products = productsQuery.data ?? []
    return products.find((item) => item.id === courseId) ?? null
  }, [courseId, productsQuery.data])

  const modules = modulesQuery.data ?? []
  const lessonQueries = useQueries({
    queries: modules.map((module) => ({
      queryKey: ["admin", "modules", module.id, "lessons"],
      queryFn: () => fetchAdminProductLessons(module.id),
      staleTime: 60_000,
      enabled: Boolean(module.id),
    })),
  })

  if (
    productsQuery.isLoading ||
    modulesQuery.isLoading ||
    assessmentsQuery.isLoading ||
    lessonQueries.some((query) => query.isLoading)
  ) {
    return <LoadingState message="A carregar o builder do curso..." />
  }

  const lessonError = lessonQueries.find((query) => query.isError)?.error
  const error = productsQuery.error ?? modulesQuery.error ?? assessmentsQuery.error ?? lessonError
  if (
    productsQuery.isError ||
    modulesQuery.isError ||
    assessmentsQuery.isError ||
    lessonQueries.some((query) => query.isError)
  ) {
    return (
      <ErrorState
        title="Nao foi possivel abrir o builder"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void productsQuery.refetch()
          void modulesQuery.refetch()
          void assessmentsQuery.refetch()
        }}
      />
    )
  }

  if (!courseId || !product) {
    return (
      <EmptyState
        title="Curso nao encontrado"
        message="Este curso nao esta disponivel no catalogo administrativo."
      />
    )
  }

  const assessments = assessmentsQuery.data ?? []
  const lessonsByModule = modules.reduce<Record<string, ProductLessonSummary[]>>((accumulator, module, index) => {
    accumulator[module.id] = (lessonQueries[index]?.data as ProductLessonSummary[] | undefined) ?? []
    return accumulator
  }, {})
  const totalLessons = Object.values(lessonsByModule).reduce(
    (count, lessons) => count + lessons.length,
    0,
  )

  const handleCreateModule = async () => {
    if (!courseId) return

    setBuilderError(null)
    try {
      const position = modules.length + 1
      const createdModule = await createModule.mutateAsync({
        productId: courseId,
        title: `Modulo ${position}`,
        description: null,
        module_type: "mixed",
        access_type: "paid_only",
        position,
        sort_order: position,
        is_preview: false,
        is_required: true,
        status: "draft",
      })

      navigate(adminCourseModulePath(courseId, createdModule.id))
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel criar o modulo.")
    }
  }

  const handleCreateLesson = async (module: ProductModuleSummary) => {
    setBuilderError(null)
    try {
      const nextPosition = (lessonsByModule[module.id]?.length ?? 0) + 1
      const createdLesson = await createLesson.mutateAsync({
        moduleId: module.id,
        title: `Aula ${nextPosition}`,
        description: null,
        position: nextPosition,
        is_required: true,
        lesson_type: "text",
        youtube_url: null,
        text_content: null,
        estimated_minutes: 10,
        starts_at: null,
        ends_at: null,
        status: "draft",
      })

      navigate(adminCourseLessonPath(courseId, module.id, createdLesson.id))
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel criar a aula.")
    }
  }

  const handleCreateModuleAssessment = async (module: ProductModuleSummary) => {
    setBuilderError(null)
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
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel criar o quiz.")
    }
  }

  const handleOpenFinalAssessment = async () => {
    setBuilderError(null)

    const existingFinalAssessment = finalAssessments[0]
    if (existingFinalAssessment) {
      navigate(adminCourseFinalAssessmentPath(courseId))
      return
    }

    try {
      await createAssessment.mutateAsync({
        productId: courseId,
        moduleId: null,
        assessmentType: "final",
        title: "Avaliacao final",
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 20,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })

      navigate(adminCourseFinalAssessmentPath(courseId))
    } catch (error) {
      setBuilderError(
        error instanceof Error ? error.message : "Nao foi possivel preparar a avaliacao final.",
      )
    }
  }

  const context: AdminCourseBuilderContext = {
    courseId,
    product,
    modules,
    assessments,
    lessonsByModule,
    totalLessons,
  }

  const finalAssessments = assessments.filter((assessment) => assessment.assessment_type === "final")

  const handleDeleteModule = async (module: ProductModuleSummary) => {
    if (!window.confirm(`Excluir o modulo "${module.title}"? Esta acao remove a estrutura ligada a ele.`)) {
      return
    }

    setBuilderError(null)
    try {
      await deleteModule.mutateAsync(module.id)
      if (location.pathname.includes(module.id)) {
        navigate(adminCourseBuilderPath(courseId))
      }
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel excluir o modulo.")
    }
  }

  const handleDeleteLesson = async (module: ProductModuleSummary, lesson: ProductLessonSummary) => {
    if (!window.confirm(`Excluir a aula "${lesson.title}"?`)) {
      return
    }

    setBuilderError(null)
    try {
      await deleteLesson.mutateAsync(lesson.id)
      if (location.pathname.includes(lesson.id)) {
        navigate(adminCourseModulePath(courseId, module.id))
      }
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel excluir a aula.")
    }
  }

  const handleDeleteAssessment = async (assessment: ProductAssessmentSummary) => {
    if (!window.confirm(`Excluir a avaliacao "${assessment.title}"?`)) {
      return
    }

    setBuilderError(null)
    try {
      await deleteAssessment.mutateAsync(assessment.id)
      if (location.pathname.includes(assessment.id)) {
        navigate(assessment.module_id ? adminCourseModulePath(courseId, assessment.module_id) : adminCourseAssessmentsPath(courseId))
      }
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel excluir a avaliacao.")
    }
  }

  const handleExportCourseContent = async () => {
    setBuilderError(null)
    try {
      const modulePayload = await Promise.all(
        modules.map(async (module) => {
          const assets = await fetchAdminModuleAssets(module.id)
          return {
            ...module,
            lessons: lessonsByModule[module.id] ?? [],
            assets,
          } satisfies ExportedCourseModule
        }),
      )

      const payload = exportCourseToJson(product, modulePayload, assessments)
      triggerJsonDownload(makeCourseExportFileName(product), payload)
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel exportar o conteudo do curso.")
    }
  }

  const recreateModuleContent = async (targetModuleId: string, moduleData: ExportedCourseModule) => {
    const orderedLessons = [...(moduleData.lessons ?? [])].sort(
      (left, right) => left.position - right.position,
    )

    for (const lesson of orderedLessons) {
      await createLesson.mutateAsync({
        moduleId: targetModuleId,
        title: lesson.title,
        description: lesson.description,
        position: lesson.position,
        is_required: lesson.is_required,
        lesson_type: lesson.lesson_type,
        youtube_url: lesson.youtube_url,
        text_content: lesson.text_content,
        estimated_minutes: lesson.estimated_minutes,
        starts_at: lesson.starts_at,
        ends_at: lesson.ends_at,
        status: lesson.status,
      })
    }

    for (const asset of moduleData.assets ?? []) {
      await createModuleAsset.mutateAsync({
        moduleId: targetModuleId,
        asset_type: asset.asset_type,
        title: asset.title,
        sort_order_asset: asset.sort_order,
        storage_bucket: asset.storage_bucket,
        storage_path: asset.storage_path,
        external_url: asset.external_url,
        mime_type: asset.mime_type,
        file_size_bytes: asset.file_size_bytes,
        allow_download: asset.allow_download,
        allow_stream: asset.allow_stream,
        watermark_enabled: asset.watermark_enabled,
        asset_status: asset.status,
      })
    }
  }

  const handleImportCourseContent = async () => {
    if (!importJson.trim()) {
      setBuilderError("Cole o JSON de importacao antes de iniciar.")
      return
    }

    if (importMode === "replace_module" && !replaceModuleId && !clearCourseBeforeImport) {
      setBuilderError("Selecione o modulo que sera substituido.")
      return
    }

    setIsImporting(true)
    setBuilderError(null)
    try {
      const parsed = parseJsonInput(importJson)
      const normalized = normalizeCourseImport(parsed)
      const structure = normalized.importedStructure

      if (!structure || (structure.modules.length === 0 && structure.assessments.length === 0)) {
        throw new Error("O JSON nao contem modulos ou avaliacoes importaveis.")
      }

      if (clearCourseBeforeImport) {
        for (const assessment of assessments.filter((item) => item.assessment_type === "final")) {
          await deleteAssessment.mutateAsync(assessment.id)
        }
        for (const module of modules) {
          await deleteModule.mutateAsync(module.id)
        }
      }

      const moduleIdMap = new Map<string, string>()
      let importedModules = [...structure.modules]

      if (!clearCourseBeforeImport && importMode === "replace_module" && replaceModuleId) {
        const targetModule = modules.find((item) => item.id === replaceModuleId) ?? null
        if (!targetModule) {
          throw new Error("Modulo selecionado para substituicao nao encontrado.")
        }

        for (const lesson of lessonsByModule[targetModule.id] ?? []) {
          await deleteLesson.mutateAsync(lesson.id)
        }
        for (const assessment of assessments.filter((item) => item.module_id === targetModule.id)) {
          await deleteAssessment.mutateAsync(assessment.id)
        }

        const firstImported = importedModules[0]
        if (firstImported) {
          await updateModule.mutateAsync({
            moduleId: targetModule.id,
            title: firstImported.title,
            description: firstImported.description ?? null,
            module_type: firstImported.module_type,
            access_type: firstImported.access_type,
            is_preview: firstImported.is_preview,
            is_required: firstImported.is_required,
            starts_at: firstImported.starts_at,
            ends_at: firstImported.ends_at,
            release_days_after_enrollment: firstImported.release_days_after_enrollment,
            status: firstImported.status,
          })
          moduleIdMap.set(firstImported.id, targetModule.id)
          await recreateModuleContent(targetModule.id, firstImported)
          importedModules = importedModules.slice(1)
        }
      }

      let nextPosition =
        Math.max(
          0,
          ...(clearCourseBeforeImport ? [] : modules.map((module) => Math.max(module.position, module.sort_order))),
        ) + 1

      for (const moduleData of importedModules) {
        const createdModule = await createModule.mutateAsync({
          productId: courseId,
          title: moduleData.title,
          description: moduleData.description ?? null,
          module_type: moduleData.module_type,
          access_type: moduleData.access_type,
          position: nextPosition,
          sort_order: nextPosition,
          is_preview: moduleData.is_preview,
          is_required: moduleData.is_required,
          starts_at: moduleData.starts_at,
          ends_at: moduleData.ends_at,
          release_days_after_enrollment: moduleData.release_days_after_enrollment,
          module_pdf_storage_path: moduleData.module_pdf_storage_path,
          module_pdf_file_name: moduleData.module_pdf_file_name,
          module_pdf_uploaded_at: moduleData.module_pdf_uploaded_at,
          status: moduleData.status,
        })

        moduleIdMap.set(moduleData.id, createdModule.id)
        await recreateModuleContent(createdModule.id, moduleData)
        nextPosition += 1
      }

      const moduleAssessments = structure.assessments.filter(
        (item) => item.assessment_type === "module" && item.module_id,
      )
      for (const assessmentData of moduleAssessments) {
        const resolvedModuleId = moduleIdMap.get(assessmentData.module_id as string)
        if (!resolvedModuleId) continue
        await createAssessment.mutateAsync({
          productId: courseId,
          moduleId: resolvedModuleId,
          assessmentType: "module",
          title: assessmentData.title,
          description: assessmentData.description,
          isRequired: assessmentData.is_required,
          passingScore: assessmentData.passing_score,
          maxAttempts: assessmentData.max_attempts,
          estimatedMinutes: assessmentData.estimated_minutes,
          isActive: assessmentData.is_active,
          builderPayload: assessmentData.builder_payload,
        })
      }

      const importedFinalAssessment =
        structure.assessments.find((item) => item.assessment_type === "final") ?? null
      if (importedFinalAssessment) {
        const existingFinal =
          clearCourseBeforeImport
            ? null
            : assessments.find((item) => item.assessment_type === "final") ?? null

        if (existingFinal) {
          await updateAssessment.mutateAsync({
            assessmentId: existingFinal.id,
            productId: courseId,
            moduleId: null,
            assessmentType: "final",
            title: importedFinalAssessment.title,
            description: importedFinalAssessment.description,
            isRequired: importedFinalAssessment.is_required,
            passingScore: importedFinalAssessment.passing_score,
            maxAttempts: importedFinalAssessment.max_attempts,
            estimatedMinutes: importedFinalAssessment.estimated_minutes,
            isActive: importedFinalAssessment.is_active,
            builderPayload: importedFinalAssessment.builder_payload,
          })
        } else {
          await createAssessment.mutateAsync({
            productId: courseId,
            moduleId: null,
            assessmentType: "final",
            title: importedFinalAssessment.title,
            description: importedFinalAssessment.description,
            isRequired: importedFinalAssessment.is_required,
            passingScore: importedFinalAssessment.passing_score,
            maxAttempts: importedFinalAssessment.max_attempts,
            estimatedMinutes: importedFinalAssessment.estimated_minutes,
            isActive: importedFinalAssessment.is_active,
            builderPayload: importedFinalAssessment.builder_payload,
          })
        }
      }

      setIsImportModalOpen(false)
      setImportJson("")
      setClearCourseBeforeImport(false)
      setImportMode("append")
      setReplaceModuleId("")
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel importar o conteudo do curso.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="rounded-full text-slate-500 hover:text-slate-900">
            <Link to="/admin/cursos">Voltar</Link>
          </Button>
          <div className="h-5 border-l border-slate-200" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setIsSidebarOpen((value) => !value)}
          >
            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-bold text-slate-800">{product.title}</p>
              <StatusBadge
                label={
                  product.status === "published"
                    ? "Publicado"
                    : product.status === "draft"
                      ? "Rascunho"
                      : "Arquivado"
                }
                tone={
                  product.status === "published"
                    ? "success"
                    : product.status === "draft"
                      ? "warning"
                      : "danger"
                }
              />
            </div>
            <p className="hidden text-xs uppercase tracking-[0.28em] text-slate-500 md:block">
              Builder do curso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex">
            <Link to={adminCourseSettingsPath(courseId)}>Configuracoes</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to={publicCoursePath(product.slug, product.id)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Visualizar
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`hidden shrink-0 border-r border-slate-200 bg-white transition-all duration-300 lg:flex lg:flex-col ${
            isSidebarOpen ? "w-[252px]" : "w-[86px]"
          }`}
        >
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className="grid gap-3">
              <NavLink
                to={adminCourseBuilderPath(courseId)}
                end
                title="Visao Geral do Curso"
                className={({ isActive }) =>
                  `flex items-center rounded-lg border text-sm font-semibold transition ${
                    isSidebarOpen ? "gap-2.5 px-3 py-4" : "justify-center px-0 py-3"
                  } ${
                    isActive
                      ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <div className="rounded-md bg-blue-100 p-1.5 text-blue-700">
                  <BookOpen className="h-4 w-4 shrink-0" />
                </div>
                {isSidebarOpen ? "Visao Geral do Curso" : null}
              </NavLink>
            </nav>

            <div className={`mt-5 ${isSidebarOpen ? "" : "px-0"}`}>
              <div className="space-y-2">
                {modules.length === 0 ? (
                  isSidebarOpen ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                      Sem modulos ainda. Cria a estrutura pedagogica para comecar o builder.
                    </p>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Vazio
                    </div>
                  )
                ) : (
                  modules.map((module, index) => {
                    const moduleLessons = lessonsByModule[module.id] ?? []
                    const moduleAssessments = assessments.filter((assessment) => assessment.module_id === module.id)

                    return (
                      <div key={module.id} className="group pt-1">
                        <div className="flex items-center gap-1">
                          <NavLink
                            to={adminCourseModulePath(courseId, module.id)}
                            title={module.title}
                            className={({ isActive }) =>
                              `flex min-w-0 flex-1 items-center rounded-lg transition ${
                                isSidebarOpen ? "gap-2 px-2 py-2.5" : "justify-center px-2 py-3"
                              } ${
                                isActive
                                  ? "bg-slate-50 text-slate-950"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`
                            }
                          >
                            {isSidebarOpen ? (
                              <>
                                <List className="h-4 w-4 shrink-0 text-slate-300" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="w-5 text-center text-[10px] font-extrabold uppercase text-slate-400">
                                      M{index + 1}
                                    </span>
                                    <span className="truncate text-sm font-bold">{module.title}</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-bold">M{index + 1}</span>
                            )}
                          </NavLink>
                          {isSidebarOpen ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteModule(module)}
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                              title={`Excluir modulo ${module.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>

                        {isSidebarOpen ? (
                          <div className="ml-9 mt-1 space-y-1 border-l-2 border-slate-100 pl-3">
                            {moduleLessons.map((lesson) => (
                              <div key={lesson.id} className="flex items-center gap-1">
                                <NavLink
                                  to={`${adminCourseModulePath(courseId, module.id)}/aulas/${lesson.id}`}
                                  className={({ isActive }) =>
                                    `flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-[13px] font-medium transition ${
                                      isActive
                                        ? "bg-slate-100 text-slate-950"
                                        : "text-slate-700 hover:bg-slate-50"
                                    }`
                                  }
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{lesson.title}</span>
                                </NavLink>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteLesson(module, lesson)}
                                  className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                                  title={`Excluir aula ${lesson.title}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            {moduleAssessments.map((assessment) => (
                              <div key={assessment.id} className="flex items-center gap-1">
                                <NavLink
                                  to={`${adminCourseModulePath(courseId, module.id)}/avaliacoes/${assessment.id}`}
                                  className={({ isActive }) =>
                                    `flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-[13px] font-medium transition ${
                                      isActive
                                        ? "bg-amber-50 text-amber-700"
                                        : "text-amber-700/90 hover:bg-amber-50/50"
                                    }`
                                  }
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                  <span className="truncate">Quiz: {assessment.title}</span>
                                </NavLink>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAssessment(assessment)}
                                  className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                                  title={`Excluir quiz ${assessment.title}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            <div className="flex items-center gap-1 pt-1">
                              <button
                                type="button"
                                onClick={() => void handleCreateLesson(module)}
                                disabled={createLesson.isPending}
                                className="flex flex-1 items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Plus className="h-3 w-3" />
                                Aula
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCreateModuleAssessment(module)}
                                disabled={createAssessment.isPending}
                                className="flex flex-1 items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-amber-50 hover:text-amber-700"
                              >
                                <Plus className="h-3 w-3" />
                                Quiz
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {isSidebarOpen ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-2 px-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Avaliacao final
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleOpenFinalAssessment()}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                    title={finalAssessments.length > 0 ? "Abrir avaliacao final" : "Criar avaliacao final"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {finalAssessments.length > 0 ? (
                    finalAssessments.map((assessment) => (
                      <div key={assessment.id} className="flex items-center gap-1">
                        <NavLink
                          to={adminCourseFinalAssessmentPath(courseId)}
                          className={({ isActive }) =>
                            `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium transition ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-emerald-700/90 hover:bg-emerald-50/60"
                            }`
                          }
                        >
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate">{assessment.title}</span>
                        </NavLink>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAssessment(assessment)}
                          className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                          title={`Excluir avaliacao final ${assessment.title}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleOpenFinalAssessment()}
                      disabled={createAssessment.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {createAssessment.isPending
                        ? "A criar avaliacao final..."
                        : "Criar avaliacao final"}
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-5">
              <button
                type="button"
                onClick={() => void handleCreateModule()}
                disabled={createModule.isPending}
                className={`flex w-full items-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 text-sm font-black text-blue-700 transition hover:bg-blue-100 ${
                  isSidebarOpen ? "gap-2 px-3 py-3" : "justify-center px-2 py-3"
                }`}
              >
                <div className="rounded-md bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] p-1 text-white">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                {isSidebarOpen ? (createModule.isPending ? "A criar modulo..." : "Novo Modulo") : null}
              </button>
            </div>

            {builderError && isSidebarOpen ? (
              <p className="mt-4 text-sm text-rose-700">{builderError}</p>
            ) : null}
          </div>

          <div className="border-t border-slate-100 px-3 py-3">
            <div className="grid gap-2">
              <NavLink
                to={adminCourseSettingsPath(courseId)}
                className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isSidebarOpen ? "gap-2.5" : "justify-center"
                }`}
              >
                <Cog className="h-4 w-4 shrink-0 text-slate-400" />
                {isSidebarOpen ? "Configuracoes do Curso" : null}
              </NavLink>
              <NavLink
                to={adminCoursePublicPagePath(courseId)}
                className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isSidebarOpen ? "gap-2.5" : "justify-center"
                }`}
              >
                <Globe2 className="h-4 w-4 shrink-0 text-slate-400" />
                {isSidebarOpen ? "Pagina Publica" : null}
              </NavLink>
              <NavLink
                to={adminCourseReleasesPath(courseId)}
                className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isSidebarOpen ? "gap-2.5" : "justify-center"
                }`}
              >
                <UsersRound className="h-4 w-4 shrink-0 text-slate-400" />
                {isSidebarOpen ? "Atribuir a Alunos e Grupos" : null}
              </NavLink>
              <NavLink
                to={adminCourseAssessmentsPath(courseId)}
                className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                  isSidebarOpen ? "gap-2.5" : "justify-center"
                }`}
              >
                <ClipboardCheck className="h-4 w-4 shrink-0 text-slate-400" />
                {isSidebarOpen ? "Gerenciar Avaliacoes" : null}
              </NavLink>
              <button
                type="button"
                onClick={() => void handleExportCourseContent()}
                className={`flex items-center rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-50 ${
                  isSidebarOpen ? "gap-2.5" : "justify-center"
                }`}
              >
                <Download className="h-4 w-4 shrink-0 text-slate-400" />
                {isSidebarOpen ? "Exportar Conteudo" : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBuilderError(null)
                  setReplaceModuleId(modules[0]?.id ?? "")
                  setIsImportModalOpen(true)
                }}
                className={`flex items-center rounded-xl border border-blue-200 bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] px-3 py-3 text-sm font-black text-white transition hover:opacity-95 ${
                  isSidebarOpen ? "gap-2.5" : "justify-center"
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                {isSidebarOpen ? "Importar Conteudo (IA)" : null}
              </button>
            </div>
          </div>
        </aside>

        <main className="relative flex-1 h-full w-full overflow-y-auto border-t border-slate-100 bg-slate-50/50 shadow-inner">
          <div className="absolute inset-0 p-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <Outlet context={context} />
          </div>
        </main>
      </div>

      {isImportModalOpen ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-8">
              <div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Importacao em Massa (IA)</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Cole o JSON gerado pela sua IA favorita abaixo.
                </p>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
                onClick={() => {
                  if (isImporting) return
                  setIsImportModalOpen(false)
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-8">
              <div className="space-y-2">
                <span className="pl-1 text-xs font-black uppercase tracking-widest text-slate-400">
                  Codigo JSON Estruturado
                </span>
                <textarea
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                  className="h-80 w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 font-mono text-xs text-emerald-400 transition-all focus:ring-4 focus:ring-blue-100"
                  placeholder='[ { "title": "Modulo 1", "lessons": [...] } ]'
                />
              </div>

              <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
                <button
                  type="button"
                  className={`flex-1 rounded-xl px-4 py-3 text-xs font-black transition-all ${
                    importMode === "append"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setImportMode("append")}
                >
                  Adicionar Novos Modulos
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl px-4 py-3 text-xs font-black transition-all ${
                    importMode === "replace_module"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setImportMode("replace_module")}
                  disabled={modules.length === 0}
                >
                  Substituir Modulo Existente
                </button>
              </div>

              {importMode === "replace_module" && !clearCourseBeforeImport ? (
                <div className="space-y-2">
                  <span className="pl-1 text-xs font-black uppercase tracking-widest text-slate-400">
                    Modulo alvo
                  </span>
                  <select
                    value={replaceModuleId}
                    onChange={(event) => setReplaceModuleId(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-400"
                  >
                    <option value="">Selecione um modulo</option>
                    {modules.map((module, index) => (
                      <option key={module.id} value={module.id}>
                        Modulo {index + 1}: {module.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <label className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 transition-colors hover:bg-amber-50">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded-lg border-amber-200 text-amber-600 focus:ring-amber-500"
                  checked={clearCourseBeforeImport}
                  onChange={(event) => setClearCourseBeforeImport(event.target.checked)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-amber-900">Limpar TODO o curso primeiro</span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="mt-0.5 text-[11px] font-bold text-amber-600">
                    Apaga absolutamente todos os modulos atuais e recomeca o curso do zero.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-4 border-t border-slate-100 bg-slate-50/50 p-8">
              <Button
                type="button"
                variant="ghost"
                className="h-14 flex-1 rounded-2xl font-bold text-slate-500"
                onClick={() => {
                  if (isImporting) return
                  setIsImportModalOpen(false)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-14 flex-[2] rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100"
                disabled={isImporting || !importJson.trim()}
                onClick={() => void handleImportCourseContent()}
              >
                {isImporting ? "Importando..." : "Iniciar Importacao"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-4 right-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Build {BUILD_VERSION}
      </div>
    </div>
  )
}
