import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CalendarClock,
  FileText,
  GraduationCap,
  ShieldCheck,
} from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminModuleAssets,
  useAdminProductAssessments,
  useAdminProductLessons,
  useAdminProductModules,
  useAdminProducts,
  useCreateAdminModuleAsset,
  useCreateAdminProductLesson,
  useCreateAdminProductModule,
  useDeleteAdminModuleAsset,
  useDeleteAdminProductLesson,
  useDeleteAdminProductModule,
  useUpdateAdminModuleAsset,
  useUpdateAdminProduct,
  useUpdateAdminProductLesson,
  useUpdateAdminProductModule,
} from "@/hooks/useAdmin"
import { publicCoursePath } from "@/lib/routes"
import type {
  ModuleAssetSummary,
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"

const moduleTypeLabels: Record<ProductModuleSummary["module_type"], string> = {
  pdf: "Leitura guiada",
  video: "Video aula",
  external_link: "Recurso externo",
  mixed: "Modulo misto",
}

const accessTypeLabels: Record<ProductModuleSummary["access_type"], string> = {
  public: "Publico",
  registered: "Registado",
  paid_only: "Pago",
}

const assetTypeLabels: Record<ModuleAssetSummary["asset_type"], string> = {
  pdf: "PDF",
  video_file: "Video",
  video_embed: "Video embed",
  external_link: "Link externo",
}

const lessonTypeLabels: Record<ProductLessonSummary["lesson_type"], string> = {
  video: "Video",
  text: "Texto",
  hybrid: "Hibrida",
}

const lessonStatusLabels: Record<ProductLessonSummary["status"], string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
}

function nextOrder(items: Array<{ sort_order?: number; position?: number }>) {
  if (items.length === 0) return 1
  return (
    Math.max(
      ...items.map((item) => {
        const sortValue = Number(item.sort_order ?? 0)
        const positionValue = Number(item.position ?? 0)
        return Math.max(sortValue, positionValue)
      }),
    ) + 1
  )
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function getScheduleSummary(module: ProductModuleSummary) {
  if (module.starts_at && module.ends_at) return "Janela com inicio e fim definidos"
  if (module.starts_at) return "Liberacao por data"
  if (module.release_days_after_enrollment !== null) {
    return `Abre ${module.release_days_after_enrollment} dia(s) apos a inscricao`
  }
  return "Disponivel conforme grant e regras do curso"
}

function getAssessmentTone(assessment: ProductAssessmentSummary): "success" | "warning" | "neutral" {
  if (!assessment.is_active) return "neutral"
  if (assessment.assessment_type === "final") return "success"
  return "warning"
}

export function AdminProductContent() {
  const { id, courseId, moduleId, lessonId } = useParams<{
    id?: string
    courseId?: string
    moduleId?: string
    lessonId?: string
  }>()
  const productId = id ?? courseId
  const navigate = useNavigate()

  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(productId)

  const product = useMemo(() => {
    const list = productsQuery.data ?? []
    return list.find((entry) => entry.id === productId) ?? null
  }, [productId, productsQuery.data])

  const modules = modulesQuery.data ?? []
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const selectedModuleIdSafe = selectedModuleId ?? modules[0]?.id ?? null
  const selectedModule = modules.find((module) => module.id === selectedModuleIdSafe) ?? null

  const assetsQuery = useAdminModuleAssets(selectedModuleIdSafe ?? undefined)
  const lessonsQuery = useAdminProductLessons(selectedModuleIdSafe ?? undefined)
  const assessmentsQuery = useAdminProductAssessments(productId)

  const assets = assetsQuery.data ?? []
  const lessons = lessonsQuery.data ?? []
  const assessments = assessmentsQuery.data ?? []

  const createModule = useCreateAdminProductModule()
  const updateModule = useUpdateAdminProductModule()
  const deleteModule = useDeleteAdminProductModule()
  const updateProduct = useUpdateAdminProduct()
  const createAsset = useCreateAdminModuleAsset()
  const updateAsset = useUpdateAdminModuleAsset()
  const deleteAsset = useDeleteAdminModuleAsset()
  const createLesson = useCreateAdminProductLesson()
  const updateLesson = useUpdateAdminProductLesson()
  const deleteLesson = useDeleteAdminProductLesson()

  const [moduleDraft, setModuleDraft] = useState({
    title: "",
    description: "",
    module_type: "mixed" as ProductModuleSummary["module_type"],
    access_type: "paid_only" as ProductModuleSummary["access_type"],
    position: 0,
    is_preview: false,
    is_required: true,
    starts_at: "",
    ends_at: "",
    release_days_after_enrollment: "",
    module_pdf_storage_path: "",
    module_pdf_file_name: "",
    status: "published" as ProductModuleSummary["status"],
  })
  const [assetDraft, setAssetDraft] = useState({
    title: "",
    asset_type: "pdf" as ModuleAssetSummary["asset_type"],
    source: "storage" as "storage" | "external",
    storage_bucket: "",
    storage_path: "",
    external_url: "",
    allow_download: false,
    allow_stream: true,
    watermark_enabled: false,
    status: "active" as ModuleAssetSummary["status"],
  })
  const [lessonDraft, setLessonDraft] = useState({
    title: "",
    description: "",
    position: 0,
    is_required: true,
    lesson_type: "text" as ProductLessonSummary["lesson_type"],
    youtube_url: "",
    text_content: "",
    estimated_minutes: "0",
    starts_at: "",
    ends_at: "",
    status: "published" as ProductLessonSummary["status"],
  })
  const [courseDraft, setCourseDraft] = useState<{
    title: string
    slug: string
    shortDescription: string
    launchDate: string
    workloadMinutes: string
    creatorCommissionPercent: string
    isPublic: boolean
    hasLinearProgression: boolean
    quizEssayAi: boolean
    quizSingleChoice: boolean
    quizCaseStudy: boolean
  } | null>(null)

  const [moduleSubmitError, setModuleSubmitError] = useState<string | null>(null)
  const [assetSubmitError, setAssetSubmitError] = useState<string | null>(null)
  const [lessonSubmitError, setLessonSubmitError] = useState<string | null>(null)
  const [courseSubmitError, setCourseSubmitError] = useState<string | null>(null)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModule, setEditingModule] = useState<Partial<ProductModuleSummary>>({})
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<
    Partial<ModuleAssetSummary> & { source?: "storage" | "external" }
  >({})
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<Partial<ProductLessonSummary>>({})

  const isLoading =
    productsQuery.isLoading ||
    modulesQuery.isLoading ||
    assetsQuery.isLoading ||
    lessonsQuery.isLoading ||
    assessmentsQuery.isLoading

  const isError =
    productsQuery.isError ||
    modulesQuery.isError ||
    assetsQuery.isError ||
    lessonsQuery.isError ||
    assessmentsQuery.isError

  const error =
    productsQuery.error ??
    modulesQuery.error ??
    assetsQuery.error ??
    lessonsQuery.error ??
    assessmentsQuery.error ??
    null

  const selectedModuleAssessments = assessments.filter(
    (assessment) => assessment.module_id === selectedModuleIdSafe,
  )
  const finalAssessments = assessments.filter((assessment) => assessment.assessment_type === "final")
  const selectedModuleEstimatedMinutes = lessons.reduce(
    (sum, lesson) => sum + Number(lesson.estimated_minutes ?? 0),
    0,
  )

  const courseForm = courseDraft ?? {
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    shortDescription: product?.short_description ?? "",
    launchDate: product?.launch_date ?? "",
    workloadMinutes: String(product?.workload_minutes ?? 0),
    creatorCommissionPercent:
      product?.creator_commission_percent !== null && product?.creator_commission_percent !== undefined
        ? String(product.creator_commission_percent)
        : "",
    isPublic: product?.is_public ?? true,
    hasLinearProgression: product?.has_linear_progression ?? false,
    quizEssayAi: product?.quiz_type_settings?.essay_ai !== false,
    quizSingleChoice: product?.quiz_type_settings?.single_choice !== false,
    quizCaseStudy: product?.quiz_type_settings?.case_study_ai !== false,
  }

  const updateCourseDraftField = (
    field: keyof typeof courseForm,
    value: (typeof courseForm)[keyof typeof courseForm],
  ) => {
    setCourseDraft((prev) => ({
      ...(prev ?? courseForm),
      [field]: value,
    }))
  }

  useEffect(() => {
    if (moduleId) {
      setSelectedModuleId(moduleId)
    }
  }, [moduleId])

  useEffect(() => {
    if (lessonId) {
      setEditingLessonId(lessonId)
    }
  }, [lessonId])

  const handleCreateModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setModuleSubmitError(null)

    if (!productId) {
      setModuleSubmitError("Curso invalido.")
      return
    }

    const title = moduleDraft.title.trim()
    if (!title) {
      setModuleSubmitError("Titulo do modulo e obrigatorio.")
      return
    }

    try {
      const created = await createModule.mutateAsync({
        productId,
        title,
        description: moduleDraft.description.trim() || null,
        module_type: moduleDraft.module_type,
        access_type: moduleDraft.access_type,
        position: moduleDraft.position || nextOrder(modules),
        sort_order: nextOrder(modules),
        is_preview: moduleDraft.is_preview,
        is_required: moduleDraft.is_required,
        starts_at: moduleDraft.starts_at || null,
        ends_at: moduleDraft.ends_at || null,
        release_days_after_enrollment: moduleDraft.release_days_after_enrollment
          ? Number(moduleDraft.release_days_after_enrollment)
          : null,
        module_pdf_storage_path: moduleDraft.module_pdf_storage_path.trim() || null,
        module_pdf_file_name: moduleDraft.module_pdf_file_name.trim() || null,
        module_pdf_uploaded_at: moduleDraft.module_pdf_storage_path.trim() ? new Date().toISOString() : null,
        status: moduleDraft.status,
      })

      setSelectedModuleId(created.id)
      setModuleDraft({
        title: "",
        description: "",
        module_type: "mixed",
        access_type: "paid_only",
        position: 0,
        is_preview: false,
        is_required: true,
        starts_at: "",
        ends_at: "",
        release_days_after_enrollment: "",
        module_pdf_storage_path: "",
        module_pdf_file_name: "",
        status: "published",
      })
    } catch (err) {
      setModuleSubmitError(err instanceof Error ? err.message : "Nao foi possivel criar o modulo.")
    }
  }

  const startEditModule = (module: ProductModuleSummary) => {
    setEditingModuleId(module.id)
    setEditingModule({
      title: module.title,
      description: module.description,
      module_type: module.module_type,
      access_type: module.access_type,
      position: module.position,
      sort_order: module.sort_order,
      is_preview: module.is_preview,
      is_required: module.is_required,
      starts_at: toDateTimeLocal(module.starts_at),
      ends_at: toDateTimeLocal(module.ends_at),
      release_days_after_enrollment: module.release_days_after_enrollment,
      module_pdf_storage_path: module.module_pdf_storage_path,
      module_pdf_file_name: module.module_pdf_file_name,
      module_pdf_uploaded_at: module.module_pdf_uploaded_at,
      status: module.status,
    })
  }

  const handleSaveModule = async () => {
    if (!editingModuleId) return
    setModuleSubmitError(null)

    try {
      await updateModule.mutateAsync({
        moduleId: editingModuleId,
        title: editingModule.title?.trim() ?? undefined,
        description:
          editingModule.description !== undefined
            ? editingModule.description?.trim() || null
            : undefined,
        module_type: editingModule.module_type,
        access_type: editingModule.access_type,
        position: editingModule.position,
        sort_order: editingModule.sort_order,
        is_preview: editingModule.is_preview,
        is_required: editingModule.is_required,
        starts_at: editingModule.starts_at || null,
        ends_at: editingModule.ends_at || null,
        release_days_after_enrollment: editingModule.release_days_after_enrollment ?? null,
        module_pdf_storage_path: editingModule.module_pdf_storage_path || null,
        module_pdf_file_name: editingModule.module_pdf_file_name || null,
        module_pdf_uploaded_at:
          editingModule.module_pdf_storage_path || editingModule.module_pdf_file_name
            ? editingModule.module_pdf_uploaded_at ?? new Date().toISOString()
            : null,
        status: editingModule.status,
      })

      setEditingModuleId(null)
      setEditingModule({})
    } catch (err) {
      setModuleSubmitError(err instanceof Error ? err.message : "Nao foi possivel guardar o modulo.")
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    const confirmed = window.confirm(
      "Queres remover este modulo? As aulas e materiais ligados a ele tambem saem da estrutura.",
    )
    if (!confirmed) return

    setModuleSubmitError(null)

    try {
      await deleteModule.mutateAsync(moduleId)
      if (selectedModuleIdSafe === moduleId) {
        setSelectedModuleId(null)
      }
    } catch (err) {
      setModuleSubmitError(err instanceof Error ? err.message : "Nao foi possivel remover o modulo.")
    }
  }

  const handleCreateLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLessonSubmitError(null)

    if (!selectedModuleIdSafe) {
      setLessonSubmitError("Seleciona um modulo primeiro.")
      return
    }

    const title = lessonDraft.title.trim()
    if (!title) {
      setLessonSubmitError("Titulo da aula e obrigatorio.")
      return
    }

    try {
      await createLesson.mutateAsync({
        moduleId: selectedModuleIdSafe,
        title,
        description: lessonDraft.description.trim() || null,
        position: lessonDraft.position || nextOrder(lessons),
        is_required: lessonDraft.is_required,
        lesson_type: lessonDraft.lesson_type,
        youtube_url: lessonDraft.youtube_url.trim() || null,
        text_content: lessonDraft.text_content.trim() || null,
        estimated_minutes: Number(lessonDraft.estimated_minutes || 0),
        starts_at: lessonDraft.starts_at || null,
        ends_at: lessonDraft.ends_at || null,
        status: lessonDraft.status,
      })

      setLessonDraft({
        title: "",
        description: "",
        position: 0,
        is_required: true,
        lesson_type: "text",
        youtube_url: "",
        text_content: "",
        estimated_minutes: "0",
        starts_at: "",
        ends_at: "",
        status: "published",
      })
    } catch (err) {
      setLessonSubmitError(err instanceof Error ? err.message : "Nao foi possivel criar a aula.")
    }
  }

  const startEditLesson = (lesson: ProductLessonSummary) => {
    setEditingLessonId(lesson.id)
    setEditingLesson({
      title: lesson.title,
      description: lesson.description,
      position: lesson.position,
      is_required: lesson.is_required,
      lesson_type: lesson.lesson_type,
      youtube_url: lesson.youtube_url,
      text_content: lesson.text_content,
      estimated_minutes: lesson.estimated_minutes,
      starts_at: toDateTimeLocal(lesson.starts_at),
      ends_at: toDateTimeLocal(lesson.ends_at),
      status: lesson.status,
    })
  }

  const handleSaveLesson = async () => {
    if (!editingLessonId) return
    setLessonSubmitError(null)

    try {
      await updateLesson.mutateAsync({
        lessonId: editingLessonId,
        title: editingLesson.title?.trim() ?? undefined,
        description:
          editingLesson.description !== undefined
            ? editingLesson.description?.trim() || null
            : undefined,
        position: editingLesson.position,
        is_required: editingLesson.is_required,
        lesson_type: editingLesson.lesson_type,
        youtube_url: editingLesson.youtube_url?.trim() || null,
        text_content: editingLesson.text_content?.trim() || null,
        estimated_minutes: editingLesson.estimated_minutes,
        starts_at: editingLesson.starts_at || null,
        ends_at: editingLesson.ends_at || null,
        status: editingLesson.status,
      })

      setEditingLessonId(null)
      setEditingLesson({})
    } catch (err) {
      setLessonSubmitError(err instanceof Error ? err.message : "Nao foi possivel guardar a aula.")
    }
  }

  const handleDeleteLesson = async (lessonId: string) => {
    const confirmed = window.confirm("Queres remover esta aula?")
    if (!confirmed) return

    setLessonSubmitError(null)

    try {
      await deleteLesson.mutateAsync(lessonId)
    } catch (err) {
      setLessonSubmitError(err instanceof Error ? err.message : "Nao foi possivel remover a aula.")
    }
  }

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAssetSubmitError(null)

    if (!selectedModuleIdSafe) {
      setAssetSubmitError("Seleciona um modulo primeiro.")
      return
    }

    const title = assetDraft.title.trim()
    if (!title) {
      setAssetSubmitError("Titulo do material e obrigatorio.")
      return
    }

    const payload =
      assetDraft.source === "external"
        ? { external_url: assetDraft.external_url.trim() }
        : {
            storage_bucket: assetDraft.storage_bucket.trim(),
            storage_path: assetDraft.storage_path.trim(),
          }

    try {
      await createAsset.mutateAsync({
        moduleId: selectedModuleIdSafe,
        title,
        asset_type: assetDraft.asset_type,
        sort_order_asset: nextOrder(assets),
        allow_download: assetDraft.allow_download,
        allow_stream: assetDraft.allow_stream,
        watermark_enabled: assetDraft.watermark_enabled,
        asset_status: assetDraft.status,
        ...payload,
      })

      setAssetDraft({
        title: "",
        asset_type: "pdf",
        source: "storage",
        storage_bucket: "",
        storage_path: "",
        external_url: "",
        allow_download: false,
        allow_stream: true,
        watermark_enabled: false,
        status: "active",
      })
    } catch (err) {
      setAssetSubmitError(err instanceof Error ? err.message : "Nao foi possivel criar o material.")
    }
  }

  const startEditAsset = (asset: ModuleAssetSummary) => {
    setEditingAssetId(asset.id)
    setEditingAsset({
      title: asset.title,
      asset_type: asset.asset_type,
      sort_order: asset.sort_order,
      source: asset.external_url ? "external" : "storage",
      external_url: asset.external_url ?? "",
      storage_bucket: asset.storage_bucket ?? "",
      storage_path: asset.storage_path ?? "",
      allow_download: asset.allow_download,
      allow_stream: asset.allow_stream,
      watermark_enabled: asset.watermark_enabled,
      status: asset.status,
    })
  }

  const handleSaveAsset = async () => {
    if (!editingAssetId) return
    setAssetSubmitError(null)

    const source = editingAsset.source ?? (editingAsset.external_url ? "external" : "storage")
    const payload =
      source === "external"
        ? { external_url: String(editingAsset.external_url ?? "").trim() }
        : {
            storage_bucket: String(editingAsset.storage_bucket ?? "").trim(),
            storage_path: String(editingAsset.storage_path ?? "").trim(),
          }

    try {
      await updateAsset.mutateAsync({
        assetId: editingAssetId,
        title: editingAsset.title?.trim() ?? undefined,
        asset_type: editingAsset.asset_type,
        sort_order_asset: editingAsset.sort_order,
        allow_download: editingAsset.allow_download,
        allow_stream: editingAsset.allow_stream,
        watermark_enabled: editingAsset.watermark_enabled,
        asset_status: editingAsset.status,
        ...payload,
      })

      setEditingAssetId(null)
      setEditingAsset({})
    } catch (err) {
      setAssetSubmitError(err instanceof Error ? err.message : "Nao foi possivel guardar o material.")
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    const confirmed = window.confirm("Queres remover este material?")
    if (!confirmed) return

    setAssetSubmitError(null)

    try {
      await deleteAsset.mutateAsync(assetId)
    } catch (err) {
      setAssetSubmitError(err instanceof Error ? err.message : "Nao foi possivel remover o material.")
    }
  }

  const handleSaveCourse = async () => {
    if (!productId) return
    setCourseSubmitError(null)

    try {
      await updateProduct.mutateAsync({
        productId,
        title: courseForm.title.trim(),
        slug: courseForm.slug.trim(),
        shortDescription: courseForm.shortDescription.trim() || null,
        launchDate: courseForm.launchDate || null,
        workloadMinutes: Number(courseForm.workloadMinutes || 0),
        creatorCommissionPercent: courseForm.creatorCommissionPercent
          ? Number(courseForm.creatorCommissionPercent)
          : null,
        isPublic: courseForm.isPublic,
        hasLinearProgression: courseForm.hasLinearProgression,
        quizTypeSettings: {
          essay_ai: courseForm.quizEssayAi,
          single_choice: courseForm.quizSingleChoice,
          case_study_ai: courseForm.quizCaseStudy,
        },
      })
    } catch (err) {
      setCourseSubmitError(err instanceof Error ? err.message : "Nao foi possivel guardar as configuracoes do curso.")
    }
  }

  if (isLoading) {
    return <LoadingState message="A carregar builder do curso..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar a estrutura do curso"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void productsQuery.refetch()
          void modulesQuery.refetch()
          void assetsQuery.refetch()
          void lessonsQuery.refetch()
          void assessmentsQuery.refetch()
        }}
      />
    )
  }

  if (!id || !product) {
    return (
      <EmptyState
        title="Curso nao encontrado"
        message="Volta a lista de cursos e abre um item valido para continuar."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Builder do curso: ${product.title}`}
        description="Organiza o curso como trilha academica, com modulos, aulas, materiais e regras de liberacao por etapa."
        backTo="/admin/cursos"
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate(publicCoursePath(product.slug))}
          >
            Ver pagina publica
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Modulos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{modules.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Base da trilha academica e comercial do curso.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <GraduationCap className="h-4 w-4" />
            <p className="text-sm font-medium text-slate-500">Aulas no modulo atual</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-950">{lessons.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Conteudo sequenciado por posicao, tipo e agenda.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <FileText className="h-4 w-4" />
            <p className="text-sm font-medium text-slate-500">Materiais no modulo atual</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-950">{assets.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">PDFs, videos e links adicionais servidos com protecao.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-white">
            <CalendarClock className="h-4 w-4" />
            <p className="text-sm font-medium text-white/70">Avaliacoes mapeadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold">{assessments.length}</p>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Quizzes por modulo e prova final associados ao curso.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Configuracoes do curso</p>
            <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Identidade academica e comercial</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Ajusta os campos centrais do curso sem sair do builder: titulo, slug, carga horaria, lancamento,
              progressao linear e tipos de quiz permitidos.
            </p>
          </div>
          <Button type="button" className="rounded-full" onClick={() => void handleSaveCourse()} disabled={updateProduct.isPending}>
            {updateProduct.isPending ? "A guardar..." : "Guardar configuracoes"}
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={courseForm.title}
            onChange={(event) => updateCourseDraftField("title", event.target.value)}
            placeholder="Titulo do curso"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={courseForm.slug}
            onChange={(event) => updateCourseDraftField("slug", event.target.value)}
            placeholder="slug-do-curso"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            type="date"
            value={courseForm.launchDate}
            onChange={(event) => updateCourseDraftField("launchDate", event.target.value)}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={courseForm.workloadMinutes}
            onChange={(event) => updateCourseDraftField("workloadMinutes", event.target.value)}
            placeholder="Carga horaria em minutos"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={courseForm.creatorCommissionPercent}
            onChange={(event) => updateCourseDraftField("creatorCommissionPercent", event.target.value)}
            placeholder="Comissao do criador (%)"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={courseForm.shortDescription}
            onChange={(event) => updateCourseDraftField("shortDescription", event.target.value)}
            placeholder="Descricao curta"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:col-span-2 xl:col-span-3"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={courseForm.isPublic}
              onChange={(event) => updateCourseDraftField("isPublic", event.target.checked)}
            />
            Curso publico no catalogo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={courseForm.hasLinearProgression}
              onChange={(event) => updateCourseDraftField("hasLinearProgression", event.target.checked)}
            />
            Progressao linear
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={courseForm.quizSingleChoice}
              onChange={(event) => updateCourseDraftField("quizSingleChoice", event.target.checked)}
            />
            Quiz de multipla escolha
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={courseForm.quizEssayAi}
              onChange={(event) => updateCourseDraftField("quizEssayAi", event.target.checked)}
            />
            Resposta discursiva com IA
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={courseForm.quizCaseStudy}
              onChange={(event) => updateCourseDraftField("quizCaseStudy", event.target.checked)}
            />
            Estudo de caso
          </label>
        </div>

        {courseSubmitError ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {courseSubmitError}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Estrutura lateral</p>
              <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Modulos do curso</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Esta coluna funciona como o mapa do curso. Define ordem, agenda, acesso e o modulo ativo do
                builder.
              </p>
            </div>
            <StatusBadge label={`${modules.length} modulos`} tone="neutral" />
          </div>

          <form onSubmit={handleCreateModule} className="mt-6 rounded-[1.5rem] border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Novo modulo</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={moduleDraft.title}
                onChange={(event) => setModuleDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Titulo do modulo"
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <input
                value={String(moduleDraft.position)}
                onChange={(event) =>
                  setModuleDraft((prev) => ({ ...prev, position: Number(event.target.value || 0) }))
                }
                placeholder="Posicao"
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <select
                value={moduleDraft.module_type}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    module_type: event.target.value as ProductModuleSummary["module_type"],
                  }))
                }
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                {Object.entries(moduleTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={moduleDraft.access_type}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    access_type: event.target.value as ProductModuleSummary["access_type"],
                  }))
                }
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                {Object.entries(accessTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={moduleDraft.description}
              onChange={(event) => setModuleDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Descricao e objetivo deste modulo"
              rows={4}
              className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                type="datetime-local"
                value={moduleDraft.starts_at}
                onChange={(event) => setModuleDraft((prev) => ({ ...prev, starts_at: event.target.value }))}
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <input
                type="datetime-local"
                value={moduleDraft.ends_at}
                onChange={(event) => setModuleDraft((prev) => ({ ...prev, ends_at: event.target.value }))}
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <input
                value={moduleDraft.release_days_after_enrollment}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    release_days_after_enrollment: event.target.value,
                  }))
                }
                placeholder="Dias apos inscricao"
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <select
                value={moduleDraft.status}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    status: event.target.value as ProductModuleSummary["status"],
                  }))
                }
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                <option value="published">Publicado</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={moduleDraft.module_pdf_storage_path}
                onChange={(event) =>
                  setModuleDraft((prev) => ({ ...prev, module_pdf_storage_path: event.target.value }))
                }
                placeholder="Path do PDF base do modulo"
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <input
                value={moduleDraft.module_pdf_file_name}
                onChange={(event) =>
                  setModuleDraft((prev) => ({ ...prev, module_pdf_file_name: event.target.value }))
                }
                placeholder="Nome do ficheiro PDF"
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={moduleDraft.is_preview}
                  onChange={(event) => setModuleDraft((prev) => ({ ...prev, is_preview: event.target.checked }))}
                />
                Preview publico
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={moduleDraft.is_required}
                  onChange={(event) => setModuleDraft((prev) => ({ ...prev, is_required: event.target.checked }))}
                />
                Obrigatorio
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" className="rounded-full" disabled={createModule.isPending}>
                {createModule.isPending ? "A criar..." : "Criar modulo"}
              </Button>
              {moduleSubmitError ? <p className="text-sm text-rose-700">{moduleSubmitError}</p> : null}
            </div>
          </form>

          {modules.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Sem modulos ainda"
                message="Cria o primeiro modulo para comecar a montar a arvore academica do curso."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {modules.map((module) => {
                const isSelected = module.id === selectedModuleIdSafe
                const isEditing = module.id === editingModuleId

                return (
                  <div
                    key={module.id}
                    className={`rounded-[1.5rem] border p-4 transition ${
                      isSelected ? "border-slate-900 bg-slate-900 text-white" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{module.title}</p>
                            <StatusBadge label={moduleTypeLabels[module.module_type]} tone="info" />
                            <StatusBadge label={accessTypeLabels[module.access_type]} tone="neutral" />
                            {module.is_preview ? <StatusBadge label="Preview" tone="warning" /> : null}
                            {module.is_required ? <StatusBadge label="Obrigatorio" tone="success" /> : null}
                          </div>
                          <p className={`mt-2 text-sm leading-6 ${isSelected ? "text-white/78" : "text-slate-600"}`}>
                            {module.description ?? "Modulo sem descricao detalhada."}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={isSelected ? "secondary" : "outline"}
                            className="rounded-full"
                            onClick={() => setSelectedModuleId(module.id)}
                          >
                            Abrir
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className={`rounded-full ${isSelected ? "border-white/20 bg-white/10 text-white" : ""}`}
                            onClick={() => startEditModule(module)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className={`rounded-full ${isSelected ? "border-white/20 bg-white/10 text-white" : ""}`}
                            onClick={() => void handleDeleteModule(module.id)}
                            disabled={deleteModule.isPending}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={`Posicao ${module.position}`} tone="neutral" />
                        <StatusBadge
                          label={module.status === "published" ? "Publicado" : module.status === "draft" ? "Rascunho" : "Arquivado"}
                          tone={
                            module.status === "published"
                              ? "success"
                              : module.status === "draft"
                                ? "warning"
                                : "danger"
                          }
                        />
                        {module.module_pdf_file_name ? (
                          <StatusBadge label={`PDF: ${module.module_pdf_file_name}`} tone="info" />
                        ) : null}
                      </div>

                      <p className={`text-xs uppercase tracking-[0.18em] ${isSelected ? "text-white/55" : "text-slate-500"}`}>
                        {getScheduleSummary(module)}
                      </p>

                      {isEditing ? (
                        <div
                          className={`rounded-[1.5rem] border p-4 ${
                            isSelected ? "border-white/15 bg-white/10" : "bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                              isSelected ? "text-white/60" : "text-slate-600"
                            }`}
                          >
                            Editar modulo
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={String(editingModule.title ?? "")}
                              onChange={(event) =>
                                setEditingModule((prev) => ({ ...prev, title: event.target.value }))
                              }
                              placeholder="Titulo"
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                            <input
                              value={String(editingModule.position ?? module.position)}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  position: Number(event.target.value || 0),
                                }))
                              }
                              placeholder="Posicao"
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                            <select
                              value={String(editingModule.module_type ?? module.module_type)}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  module_type: event.target.value as ProductModuleSummary["module_type"],
                                }))
                              }
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            >
                              {Object.entries(moduleTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={String(editingModule.access_type ?? module.access_type)}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  access_type: event.target.value as ProductModuleSummary["access_type"],
                                }))
                              }
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            >
                              {Object.entries(accessTypeLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <textarea
                            value={String(editingModule.description ?? "")}
                            onChange={(event) =>
                              setEditingModule((prev) => ({ ...prev, description: event.target.value }))
                            }
                            rows={4}
                            placeholder="Descricao"
                            className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                          />

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              type="datetime-local"
                              value={String(editingModule.starts_at ?? "")}
                              onChange={(event) =>
                                setEditingModule((prev) => ({ ...prev, starts_at: event.target.value }))
                              }
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                            <input
                              type="datetime-local"
                              value={String(editingModule.ends_at ?? "")}
                              onChange={(event) =>
                                setEditingModule((prev) => ({ ...prev, ends_at: event.target.value }))
                              }
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                            <input
                              value={String(editingModule.release_days_after_enrollment ?? "")}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  release_days_after_enrollment: event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                }))
                              }
                              placeholder="Dias apos inscricao"
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                            <select
                              value={String(editingModule.status ?? module.status)}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  status: event.target.value as ProductModuleSummary["status"],
                                }))
                              }
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            >
                              <option value="published">Publicado</option>
                              <option value="draft">Rascunho</option>
                              <option value="archived">Arquivado</option>
                            </select>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={String(editingModule.module_pdf_storage_path ?? "")}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  module_pdf_storage_path: event.target.value,
                                }))
                              }
                              placeholder="Path do PDF"
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                            <input
                              value={String(editingModule.module_pdf_file_name ?? "")}
                              onChange={(event) =>
                                setEditingModule((prev) => ({
                                  ...prev,
                                  module_pdf_file_name: event.target.value,
                                }))
                              }
                              placeholder="Nome do ficheiro"
                              className="h-11 rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                            />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <label className={`flex items-center gap-2 ${isSelected ? "text-white/85" : "text-slate-700"}`}>
                              <input
                                type="checkbox"
                                checked={Boolean(editingModule.is_preview)}
                                onChange={(event) =>
                                  setEditingModule((prev) => ({ ...prev, is_preview: event.target.checked }))
                                }
                              />
                              Preview
                            </label>
                            <label className={`flex items-center gap-2 ${isSelected ? "text-white/85" : "text-slate-700"}`}>
                              <input
                                type="checkbox"
                                checked={Boolean(editingModule.is_required)}
                                onChange={(event) =>
                                  setEditingModule((prev) => ({ ...prev, is_required: event.target.checked }))
                                }
                              />
                              Obrigatorio
                            </label>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="rounded-full"
                              onClick={() => void handleSaveModule()}
                              disabled={updateModule.isPending}
                            >
                              {updateModule.isPending ? "A guardar..." : "Guardar modulo"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={`rounded-full ${isSelected ? "border-white/20 bg-white/10 text-white" : ""}`}
                              onClick={() => {
                                setEditingModuleId(null)
                                setEditingModule({})
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          {selectedModule ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Workspace do modulo</p>
                  <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">{selectedModule.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {selectedModule.description ?? "Usa este espaco para desenhar a experiencia do aluno neste modulo."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={moduleTypeLabels[selectedModule.module_type]} tone="info" />
                  <StatusBadge label={accessTypeLabels[selectedModule.access_type]} tone="neutral" />
                  {selectedModule.is_preview ? <StatusBadge label="Preview" tone="warning" /> : null}
                  {selectedModule.module_pdf_file_name ? <StatusBadge label="PDF base" tone="success" /> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.5rem] border bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <GraduationCap className="h-4 w-4" />
                    <p className="text-sm font-medium">Aulas</p>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-950">{lessons.length}</p>
                </div>
                <div className="rounded-[1.5rem] border bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <FileText className="h-4 w-4" />
                    <p className="text-sm font-medium">Materiais</p>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-950">{assets.length}</p>
                </div>
                <div className="rounded-[1.5rem] border bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <CalendarClock className="h-4 w-4" />
                    <p className="text-sm font-medium">Agenda</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{getScheduleSummary(selectedModule)}</p>
                </div>
                <div className="rounded-[1.5rem] border bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <ShieldCheck className="h-4 w-4" />
                    <p className="text-sm font-medium">Carga estimada</p>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-950">{selectedModuleEstimatedMinutes} min</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="space-y-4">
                  <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Aulas</p>
                        <h3 className="mt-2 font-display text-xl font-bold text-slate-950">Nova aula</h3>
                      </div>
                      <StatusBadge label={`${lessons.length} aulas`} tone="neutral" />
                    </div>

                    <form onSubmit={handleCreateLesson} className="mt-4 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={lessonDraft.title}
                          onChange={(event) => setLessonDraft((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="Titulo da aula"
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          value={lessonDraft.position}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({ ...prev, position: Number(event.target.value || 0) }))
                          }
                          placeholder="Posicao"
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                        <select
                          value={lessonDraft.lesson_type}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({
                              ...prev,
                              lesson_type: event.target.value as ProductLessonSummary["lesson_type"],
                            }))
                          }
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        >
                          {Object.entries(lessonTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          value={lessonDraft.estimated_minutes}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({
                              ...prev,
                              estimated_minutes: event.target.value,
                            }))
                          }
                          placeholder="Duracao estimada em minutos"
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                      </div>

                      <textarea
                        value={lessonDraft.description}
                        onChange={(event) => setLessonDraft((prev) => ({ ...prev, description: event.target.value }))}
                        rows={3}
                        placeholder="Descricao curta da aula"
                        className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                      />

                      {lessonDraft.lesson_type !== "text" ? (
                        <input
                          value={lessonDraft.youtube_url}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({ ...prev, youtube_url: event.target.value }))
                          }
                          placeholder="URL do YouTube"
                          className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                      ) : null}

                      {lessonDraft.lesson_type !== "video" ? (
                        <textarea
                          value={lessonDraft.text_content}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({ ...prev, text_content: event.target.value }))
                          }
                          rows={5}
                          placeholder="Conteudo textual serializado da aula"
                          className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          type="datetime-local"
                          value={lessonDraft.starts_at}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({ ...prev, starts_at: event.target.value }))
                          }
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          type="datetime-local"
                          value={lessonDraft.ends_at}
                          onChange={(event) => setLessonDraft((prev) => ({ ...prev, ends_at: event.target.value }))}
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={lessonDraft.is_required}
                            onChange={(event) =>
                              setLessonDraft((prev) => ({ ...prev, is_required: event.target.checked }))
                            }
                          />
                          Obrigatoria
                        </label>
                        <select
                          value={lessonDraft.status}
                          onChange={(event) =>
                            setLessonDraft((prev) => ({
                              ...prev,
                              status: event.target.value as ProductLessonSummary["status"],
                            }))
                          }
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        >
                          <option value="published">Publicada</option>
                          <option value="draft">Rascunho</option>
                          <option value="archived">Arquivada</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" className="rounded-full" disabled={createLesson.isPending}>
                          {createLesson.isPending ? "A criar..." : "Criar aula"}
                        </Button>
                        {lessonSubmitError ? <p className="text-sm text-rose-700">{lessonSubmitError}</p> : null}
                      </div>
                    </form>
                  </div>

                  <div className="space-y-3">
                    {lessons.length === 0 ? (
                      <EmptyState
                        title="Sem aulas neste modulo"
                        message="Cria a primeira aula para comecar a experiencia do aluno dentro do curso."
                      />
                    ) : (
                      lessons.map((lesson) => {
                        const isEditing = editingLessonId === lesson.id

                        return (
                          <div key={lesson.id} className="rounded-[1.5rem] border bg-white p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-950">{lesson.title}</p>
                                    <StatusBadge label={lessonTypeLabels[lesson.lesson_type]} tone="info" />
                                    <StatusBadge label={lessonStatusLabels[lesson.status]} tone="neutral" />
                                    {lesson.is_required ? <StatusBadge label="Obrigatoria" tone="success" /> : null}
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {lesson.description ?? "Aula sem descricao curta."}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => startEditLesson(lesson)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => void handleDeleteLesson(lesson.id)}
                                    disabled={deleteLesson.isPending}
                                  >
                                    Remover
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <StatusBadge label={`Posicao ${lesson.position}`} tone="neutral" />
                                <StatusBadge label={`${lesson.estimated_minutes} min`} tone="warning" />
                                {lesson.youtube_url ? <StatusBadge label="YouTube" tone="info" /> : null}
                                {lesson.text_content ? <StatusBadge label="Texto" tone="success" /> : null}
                              </div>

                              {isEditing ? (
                                <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                    Editar aula
                                  </p>
                                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <input
                                      value={String(editingLesson.title ?? "")}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({ ...prev, title: event.target.value }))
                                      }
                                      placeholder="Titulo"
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                    <input
                                      value={String(editingLesson.position ?? lesson.position)}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({
                                          ...prev,
                                          position: Number(event.target.value || 0),
                                        }))
                                      }
                                      placeholder="Posicao"
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                    <select
                                      value={String(editingLesson.lesson_type ?? lesson.lesson_type)}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({
                                          ...prev,
                                          lesson_type: event.target.value as ProductLessonSummary["lesson_type"],
                                        }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    >
                                      {Object.entries(lessonTypeLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      value={String(editingLesson.estimated_minutes ?? lesson.estimated_minutes)}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({
                                          ...prev,
                                          estimated_minutes: Number(event.target.value || 0),
                                        }))
                                      }
                                      placeholder="Minutos"
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                  </div>

                                  <textarea
                                    value={String(editingLesson.description ?? "")}
                                    onChange={(event) =>
                                      setEditingLesson((prev) => ({ ...prev, description: event.target.value }))
                                    }
                                    rows={3}
                                    className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                                  />

                                  {(editingLesson.lesson_type ?? lesson.lesson_type) !== "text" ? (
                                    <input
                                      value={String(editingLesson.youtube_url ?? "")}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({ ...prev, youtube_url: event.target.value }))
                                      }
                                      placeholder="URL do YouTube"
                                      className="mt-3 h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                  ) : null}

                                  {(editingLesson.lesson_type ?? lesson.lesson_type) !== "video" ? (
                                    <textarea
                                      value={String(editingLesson.text_content ?? "")}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({ ...prev, text_content: event.target.value }))
                                      }
                                      rows={5}
                                      className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                                    />
                                  ) : null}

                                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <input
                                      type="datetime-local"
                                      value={String(editingLesson.starts_at ?? "")}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({ ...prev, starts_at: event.target.value }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                    <input
                                      type="datetime-local"
                                      value={String(editingLesson.ends_at ?? "")}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({ ...prev, ends_at: event.target.value }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(editingLesson.is_required)}
                                        onChange={(event) =>
                                          setEditingLesson((prev) => ({
                                            ...prev,
                                            is_required: event.target.checked,
                                          }))
                                        }
                                      />
                                      Obrigatoria
                                    </label>
                                    <select
                                      value={String(editingLesson.status ?? lesson.status)}
                                      onChange={(event) =>
                                        setEditingLesson((prev) => ({
                                          ...prev,
                                          status: event.target.value as ProductLessonSummary["status"],
                                        }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    >
                                      <option value="published">Publicada</option>
                                      <option value="draft">Rascunho</option>
                                      <option value="archived">Arquivada</option>
                                    </select>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      className="rounded-full"
                                      onClick={() => void handleSaveLesson()}
                                      disabled={updateLesson.isPending}
                                    >
                                      {updateLesson.isPending ? "A guardar..." : "Guardar aula"}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="rounded-full"
                                      onClick={() => {
                                        setEditingLessonId(null)
                                        setEditingLesson({})
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Materiais</p>
                        <h3 className="mt-2 font-display text-xl font-bold text-slate-950">Novo material</h3>
                      </div>
                      <StatusBadge label={`${assets.length} itens`} tone="neutral" />
                    </div>

                    <form onSubmit={handleCreateAsset} className="mt-4 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={assetDraft.title}
                          onChange={(event) => setAssetDraft((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="Titulo"
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                        <select
                          value={assetDraft.asset_type}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              asset_type: event.target.value as ModuleAssetSummary["asset_type"],
                            }))
                          }
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        >
                          {Object.entries(assetTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={assetDraft.source}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              source: event.target.value as "storage" | "external",
                            }))
                          }
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        >
                          <option value="storage">Storage</option>
                          <option value="external">URL externa</option>
                        </select>
                        <select
                          value={assetDraft.status}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              status: event.target.value as ModuleAssetSummary["status"],
                            }))
                          }
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                        </select>
                      </div>

                      {assetDraft.source === "external" ? (
                        <input
                          value={assetDraft.external_url}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({ ...prev, external_url: event.target.value }))
                          }
                          placeholder="https://..."
                          className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={assetDraft.storage_bucket}
                            onChange={(event) =>
                              setAssetDraft((prev) => ({ ...prev, storage_bucket: event.target.value }))
                            }
                            placeholder="Bucket"
                            className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                          />
                          <input
                            value={assetDraft.storage_path}
                            onChange={(event) =>
                              setAssetDraft((prev) => ({ ...prev, storage_path: event.target.value }))
                            }
                            placeholder="Path"
                            className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={assetDraft.allow_download}
                            onChange={(event) =>
                              setAssetDraft((prev) => ({ ...prev, allow_download: event.target.checked }))
                            }
                          />
                          Download
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={assetDraft.allow_stream}
                            onChange={(event) =>
                              setAssetDraft((prev) => ({ ...prev, allow_stream: event.target.checked }))
                            }
                          />
                          Abrir na plataforma
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={assetDraft.watermark_enabled}
                            onChange={(event) =>
                              setAssetDraft((prev) => ({ ...prev, watermark_enabled: event.target.checked }))
                            }
                          />
                          Watermark
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" className="rounded-full" disabled={createAsset.isPending}>
                          {createAsset.isPending ? "A criar..." : "Criar material"}
                        </Button>
                        {assetSubmitError ? <p className="text-sm text-rose-700">{assetSubmitError}</p> : null}
                      </div>
                    </form>
                  </div>

                  <div className="space-y-3">
                    {assets.length === 0 ? (
                      <EmptyState
                        title="Sem materiais neste modulo"
                        message="Liga PDFs, videos ou links protegidos para completar esta etapa do curso."
                      />
                    ) : (
                      assets.map((asset) => {
                        const isEditing = editingAssetId === asset.id
                        const currentSource = editingAsset.source ?? (editingAsset.external_url ? "external" : "storage")

                        return (
                          <div key={asset.id} className="rounded-[1.5rem] border bg-white p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-950">{asset.title}</p>
                                    <StatusBadge label={assetTypeLabels[asset.asset_type]} tone="info" />
                                    <StatusBadge
                                      label={asset.status === "active" ? "Ativo" : "Inativo"}
                                      tone={asset.status === "active" ? "success" : "warning"}
                                    />
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {asset.external_url
                                      ? `URL externa: ${asset.external_url}`
                                      : `Storage: ${asset.storage_bucket ?? "-"} / ${asset.storage_path ?? "-"}`}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => startEditAsset(asset)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => void handleDeleteAsset(asset.id)}
                                    disabled={deleteAsset.isPending}
                                  >
                                    Remover
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <StatusBadge label={`Ordem ${asset.sort_order}`} tone="neutral" />
                                {asset.allow_download ? <StatusBadge label="Download" tone="success" /> : null}
                                {asset.allow_stream ? <StatusBadge label="Abrir" tone="info" /> : null}
                                {asset.watermark_enabled ? <StatusBadge label="Watermark" tone="warning" /> : null}
                              </div>

                              {isEditing ? (
                                <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                    Editar material
                                  </p>
                                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <input
                                      value={String(editingAsset.title ?? "")}
                                      onChange={(event) =>
                                        setEditingAsset((prev) => ({ ...prev, title: event.target.value }))
                                      }
                                      placeholder="Titulo"
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                    <input
                                      value={String(editingAsset.sort_order ?? asset.sort_order)}
                                      onChange={(event) =>
                                        setEditingAsset((prev) => ({
                                          ...prev,
                                          sort_order: Number(event.target.value || 0),
                                        }))
                                      }
                                      placeholder="Ordem"
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                    <select
                                      value={String(editingAsset.asset_type ?? asset.asset_type)}
                                      onChange={(event) =>
                                        setEditingAsset((prev) => ({
                                          ...prev,
                                          asset_type: event.target.value as ModuleAssetSummary["asset_type"],
                                        }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    >
                                      {Object.entries(assetTypeLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={String(editingAsset.status ?? asset.status)}
                                      onChange={(event) =>
                                        setEditingAsset((prev) => ({
                                          ...prev,
                                          status: event.target.value as ModuleAssetSummary["status"],
                                        }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    >
                                      <option value="active">Ativo</option>
                                      <option value="inactive">Inativo</option>
                                    </select>
                                    <select
                                      value={currentSource}
                                      onChange={(event) =>
                                        setEditingAsset((prev) => ({
                                          ...prev,
                                          source: event.target.value as "storage" | "external",
                                        }))
                                      }
                                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    >
                                      <option value="storage">Storage</option>
                                      <option value="external">URL externa</option>
                                    </select>
                                  </div>

                                  {currentSource === "external" ? (
                                    <input
                                      value={String(editingAsset.external_url ?? "")}
                                      onChange={(event) =>
                                        setEditingAsset((prev) => ({ ...prev, external_url: event.target.value }))
                                      }
                                      placeholder="https://..."
                                      className="mt-3 h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                    />
                                  ) : (
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      <input
                                        value={String(editingAsset.storage_bucket ?? "")}
                                        onChange={(event) =>
                                          setEditingAsset((prev) => ({
                                            ...prev,
                                            storage_bucket: event.target.value,
                                          }))
                                        }
                                        placeholder="Bucket"
                                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                      />
                                      <input
                                        value={String(editingAsset.storage_path ?? "")}
                                        onChange={(event) =>
                                          setEditingAsset((prev) => ({ ...prev, storage_path: event.target.value }))
                                        }
                                        placeholder="Path"
                                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                      />
                                    </div>
                                  )}

                                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(editingAsset.allow_download)}
                                        onChange={(event) =>
                                          setEditingAsset((prev) => ({
                                            ...prev,
                                            allow_download: event.target.checked,
                                          }))
                                        }
                                      />
                                      Download
                                    </label>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(editingAsset.allow_stream)}
                                        onChange={(event) =>
                                          setEditingAsset((prev) => ({
                                            ...prev,
                                            allow_stream: event.target.checked,
                                          }))
                                        }
                                      />
                                      Abrir
                                    </label>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(editingAsset.watermark_enabled)}
                                        onChange={(event) =>
                                          setEditingAsset((prev) => ({
                                            ...prev,
                                            watermark_enabled: event.target.checked,
                                          }))
                                        }
                                      />
                                      Watermark
                                    </label>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      className="rounded-full"
                                      onClick={() => void handleSaveAsset()}
                                      disabled={updateAsset.isPending}
                                    >
                                      {updateAsset.isPending ? "A guardar..." : "Guardar material"}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="rounded-full"
                                      onClick={() => {
                                        setEditingAssetId(null)
                                        setEditingAsset({})
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-[1.5rem] border bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Avaliacoes ligadas ao curso</p>
                    <h3 className="mt-2 font-display text-xl font-bold text-slate-950">Resumo de quizzes</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      A avaliacao final e os quizzes por modulo continuam centralizados no backend.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={`${selectedModuleAssessments.length} do modulo`} tone="warning" />
                    <StatusBadge label={`${finalAssessments.length} finais`} tone="success" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {assessments.length === 0 ? (
                    <div className="md:col-span-2">
                      <EmptyState
                        title="Sem avaliacoes mapeadas"
                        message="Quando os quizzes forem criados no builder, o resumo aparece aqui."
                      />
                    </div>
                  ) : (
                    assessments.map((assessment) => (
                      <div key={assessment.id} className="rounded-[1.25rem] border bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{assessment.title}</p>
                          <StatusBadge
                            label={assessment.assessment_type === "final" ? "Final" : "Modulo"}
                            tone={getAssessmentTone(assessment)}
                          />
                          {assessment.is_required ? <StatusBadge label="Obrigatoria" tone="success" /> : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {assessment.description ?? "Avaliacao sem descricao curta."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge label={`Minimo ${assessment.passing_score}%`} tone="info" />
                          <StatusBadge
                            label={
                              assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"
                            }
                            tone="neutral"
                          />
                          <StatusBadge label={`${assessment.estimated_minutes} min`} tone="warning" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <EmptyState
              title="Seleciona um modulo"
              message="Abre um modulo na coluna da esquerda para editar aulas, materiais e resumo de quizzes."
            />
          )}
        </section>
      </div>
    </div>
  )
}
