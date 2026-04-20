import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminProducts,
  useCreateAdminProduct,
  useDeleteAdminProduct,
  useUpdateAdminProduct,
} from "@/hooks/useAdmin"
import { adminCourseBuilderPath } from "@/lib/routes"
import {
  createAdminProductAssessment,
  createAdminModuleAsset,
  createAdminProductLesson,
  createAdminProductModule,
  fetchAdminModuleAssets,
  fetchAdminProductAssessments,
  fetchAdminProductLessons,
  fetchAdminProductModules,
} from "@/services"
import type {
  ModuleAssetSummary,
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"
import { formatProductPrice } from "@/utils/currency"

interface CourseDraft {
  title: string
  slug: string
  coverImageUrl: string
  status: ProductSummary["status"]
  launchDate: string
  price: string
  currency: string
  isPublic: boolean
  description: string
  workloadMinutes: string
  sortOrder: string
  productType: ProductSummary["product_type"]
}

interface ExportedCourseModule extends ProductModuleSummary {
  lessons: ProductLessonSummary[]
  assets: ModuleAssetSummary[]
}

interface ExportedCoursePackage {
  modules: ExportedCourseModule[]
  assessments: ProductAssessmentSummary[]
}

interface CourseEditorState {
  mode: "create" | "edit" | "import"
  courseId: string | null
  draft: CourseDraft
  importedStructure: ExportedCoursePackage | null
}

const statusLabels: Record<ProductSummary["status"], string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
}

const typeLabels: Record<ProductSummary["product_type"], string> = {
  paid: "Pago",
  free: "Gratuito",
  hybrid: "Hibrido",
  external_service: "Servico externo",
}

const cardAccentClasses: Record<ProductSummary["status"], string> = {
  draft: "border-sky-300 shadow-[0_18px_45px_rgba(14,165,233,0.08)]",
  published: "border-emerald-300 shadow-[0_18px_45px_rgba(16,185,129,0.08)]",
  archived: "border-slate-300 shadow-[0_18px_45px_rgba(15,23,42,0.06)]",
}

function formatWorkloadMinutes(minutes: number) {
  if (minutes <= 0) return "Carga por definir"
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}min`
}

function clampDescription(value: string | null | undefined) {
  const text = value?.trim() || "Curso sem descricao detalhada definida."
  if (text.length <= 108) return text
  return `${text.slice(0, 105).trimEnd()}...`
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function formatPriceInput(priceCents: number) {
  return (priceCents / 100).toFixed(2)
}

function parsePriceInput(value: string) {
  const normalized = value.replace(",", ".").trim()
  const parsed = Number(normalized || "0")
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function buildCourseDraft(product?: ProductSummary | null): CourseDraft {
  return {
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    coverImageUrl: product?.cover_image_url ?? "",
    status: product?.status ?? "draft",
    launchDate: product?.launch_date ?? "",
    price: product ? formatPriceInput(product.price_cents) : "0.00",
    currency: product?.currency ?? "EUR",
    isPublic: product?.is_public ?? true,
    description: product?.description ?? product?.short_description ?? "",
    workloadMinutes:
      product?.workload_minutes !== undefined ? String(product.workload_minutes) : "0",
    sortOrder: product?.sort_order !== undefined ? String(product.sort_order) : "",
    productType: product?.product_type ?? "paid",
  }
}

function buildDefaultCourseDraft(sortOrder: number): CourseDraft {
  return {
    title: "",
    slug: "",
    coverImageUrl: "",
    status: "draft",
    launchDate: "",
    price: "0.00",
    currency: "EUR",
    isPublic: true,
    description: "",
    workloadMinutes: "0",
    sortOrder: String(sortOrder),
    productType: "paid",
  }
}

function triggerJsonDownload(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

function normalizeImportedCourse(raw: unknown): {
  draft: CourseDraft
  importedStructure: ExportedCoursePackage | null
} {
  const payload = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
  const course =
    typeof payload.course === "object" && payload.course !== null
      ? (payload.course as Record<string, unknown>)
      : typeof payload.product === "object" && payload.product !== null
        ? (payload.product as Record<string, unknown>)
        : payload

  const modules = Array.isArray(payload.modules)
    ? (payload.modules as ExportedCourseModule[])
    : []
  const assessments = Array.isArray(payload.assessments)
    ? (payload.assessments as ProductAssessmentSummary[])
    : []

  return {
    draft: {
      title: String(course.title ?? ""),
      slug: String(course.slug ?? ""),
      coverImageUrl: String(course.cover_image_url ?? course.coverImageUrl ?? ""),
      status:
        course.status === "published" || course.status === "archived"
          ? course.status
          : "draft",
      launchDate: String(course.launch_date ?? course.launchDate ?? ""),
      price: formatPriceInput(Number(course.price_cents ?? course.priceCents ?? 0)),
      currency: String(course.currency ?? "EUR"),
      isPublic: Boolean(course.is_public ?? course.isPublic ?? true),
      description: String(course.description ?? course.short_description ?? ""),
      workloadMinutes: String(course.workload_minutes ?? course.workloadMinutes ?? 0),
      sortOrder: String(course.sort_order ?? course.sortOrder ?? ""),
      productType:
        course.product_type === "free" ||
        course.product_type === "hybrid" ||
        course.product_type === "external_service"
          ? course.product_type
          : Number(course.price_cents ?? 0) > 0
            ? "paid"
            : "free",
    },
    importedStructure:
      modules.length > 0 || assessments.length > 0 ? { modules, assessments } : null,
  }
}

function AdminCoursesSkeleton() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-5 h-12 w-72 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-5 w-96 animate-pulse rounded-full bg-slate-100" />
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-[1.2rem] bg-slate-100" />
              <div className="flex-1">
                <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-3 h-10 w-20 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[1.6rem] border border-slate-100 bg-slate-50">
              <div className="h-72 animate-pulse bg-slate-100" />
              <div className="space-y-4 p-5">
                <div className="h-6 w-2/3 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function AdminProducts() {
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const productsQuery = useAdminProducts()
  const createCourse = useCreateAdminProduct()
  const updateCourse = useUpdateAdminProduct()
  const deleteCourse = useDeleteAdminProduct()
  const [query, setQuery] = useState("")
  const [draggingCourseId, setDraggingCourseId] = useState<string | null>(null)
  const [reorderPending, setReorderPending] = useState(false)
  const [exportingCourseId, setExportingCourseId] = useState<string | null>(null)
  const [editorState, setEditorState] = useState<CourseEditorState | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  const products = useMemo(() => {
    const items = [...(productsQuery.data ?? [])]
    return items.sort(
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.title.localeCompare(right.title),
    )
  }, [productsQuery.data])

  const filteredCourses = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return products

    return products.filter((course) =>
      [
        course.title,
        course.slug,
        course.description ?? "",
        course.status,
        course.currency,
        course.product_type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [deferredQuery, products])

  if (productsQuery.isLoading) {
    return <AdminCoursesSkeleton />
  }

  if (productsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os cursos"
        message={
          productsQuery.error instanceof Error
            ? productsQuery.error.message
            : "Tenta novamente dentro de instantes."
        }
        onRetry={() => void productsQuery.refetch()}
      />
    )
  }

  const publishedCount = products.filter((course) => course.status === "published").length
  const draftCount = products.filter((course) => course.status === "draft").length

  const openCreateEditor = (draft?: CourseDraft, importedStructure?: ExportedCoursePackage | null) => {
    setSubmitError(null)
    setEditorState({
      mode: importedStructure ? "import" : "create",
      courseId: null,
      draft: draft ?? buildDefaultCourseDraft(products.length + 1),
      importedStructure: importedStructure ?? null,
    })
  }

  const openEditEditor = (course: ProductSummary) => {
    setSubmitError(null)
    setEditorState({
      mode: "edit",
      courseId: course.id,
      draft: buildCourseDraft(course),
      importedStructure: null,
    })
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const imported = normalizeImportedCourse(parsed)
      openCreateEditor(imported.draft, imported.importedStructure)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel ler o JSON do curso.")
    } finally {
      event.target.value = ""
    }
  }

  const handleEditorDraft = <TKey extends keyof CourseDraft>(field: TKey, value: CourseDraft[TKey]) => {
    setEditorState((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              [field]: value,
            },
          }
        : current,
    )
  }

  const handleExportCourse = async (course: ProductSummary) => {
    setExportingCourseId(course.id)

    try {
      const modules = await fetchAdminProductModules(course.id)
      const modulePayload = await Promise.all(
        modules.map(async (module) => {
          const [lessons, assets] = await Promise.all([
            fetchAdminProductLessons(module.id),
            fetchAdminModuleAssets(module.id),
          ])

          return {
            ...module,
            lessons,
            assets,
          } satisfies ExportedCourseModule
        }),
      )
      const assessments = await fetchAdminProductAssessments(course.id)

      triggerJsonDownload(
        `${course.slug || slugify(course.title) || "curso"}.json`,
        {
          version: 1,
          exported_at: new Date().toISOString(),
          course,
          modules: modulePayload,
          assessments,
        },
      )
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel exportar o curso.")
    } finally {
      setExportingCourseId(null)
    }
  }

  const importStructureIntoCourse = async (
    courseId: string,
    importedStructure: ExportedCoursePackage | null,
  ) => {
    if (!importedStructure) return

    const moduleIdMap = new Map<string, string>()

    for (const module of importedStructure.modules) {
      const createdModule = await createAdminProductModule({
        productId: courseId,
        title: module.title,
        description: module.description,
        module_type: module.module_type,
        access_type: module.access_type,
        position: module.position,
        sort_order: module.sort_order,
        is_preview: module.is_preview,
        is_required: module.is_required,
        starts_at: module.starts_at,
        ends_at: module.ends_at,
        release_days_after_enrollment: module.release_days_after_enrollment,
        module_pdf_storage_path: module.module_pdf_storage_path,
        module_pdf_file_name: module.module_pdf_file_name,
        module_pdf_uploaded_at: module.module_pdf_uploaded_at,
        status: module.status,
      })

      moduleIdMap.set(module.id, createdModule.id)

      for (const lesson of module.lessons ?? []) {
        await createAdminProductLesson({
          moduleId: createdModule.id,
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

      for (const asset of module.assets ?? []) {
        await createAdminModuleAsset({
          moduleId: createdModule.id,
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

    if (importedStructure.assessments.length > 0) {
      for (const assessment of importedStructure.assessments) {
        await createAdminProductAssessment({
          productId: courseId,
          moduleId: assessment.module_id ? moduleIdMap.get(assessment.module_id) ?? null : null,
          assessmentType: assessment.assessment_type,
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
    }
  }

  const handleSaveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editorState) return

    setSubmitError(null)
    const draft = editorState.draft
    const title = draft.title.trim()
    const slug = slugify(draft.slug || draft.title)

    if (!title || !slug) {
      setSubmitError("Titulo e slug do curso sao obrigatorios.")
      return
    }

    const priceCents = parsePriceInput(draft.price)
    const productType: ProductSummary["product_type"] =
      draft.productType === "external_service" || draft.productType === "hybrid"
        ? draft.productType
        : priceCents > 0
          ? "paid"
          : "free"
    const payload = {
      title,
      slug,
      coverImageUrl: draft.coverImageUrl.trim() || null,
      description: draft.description.trim() || null,
      shortDescription: draft.description.trim().slice(0, 160) || null,
      productType,
      priceCents,
      currency: draft.currency.trim().toUpperCase() || "EUR",
      launchDate: draft.launchDate || null,
      isPublic: draft.isPublic,
      workloadMinutes: Number(draft.workloadMinutes || 0),
      sortOrder: Number(draft.sortOrder || products.length + 1),
      salesPageEnabled: true,
      requiresAuth: true,
      allowAffiliate: true,
    }

    try {
      if (editorState.mode === "edit" && editorState.courseId) {
        await updateCourse.mutateAsync({
          productId: editorState.courseId,
          ...payload,
          status: draft.status,
        })
        setEditorState(null)
        return
      }

      const createdResponse = await createCourse.mutateAsync(payload)
      const createdCourseId = createdResponse.product.id

      if (draft.status !== "draft") {
        await updateCourse.mutateAsync({
          productId: createdCourseId,
          status: draft.status,
        })
      }

      await importStructureIntoCourse(createdCourseId, editorState.importedStructure)
      setEditorState(null)
      navigate(adminCourseBuilderPath(createdCourseId))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel guardar o curso.")
    }
  }

  const handleDeleteCourse = async (course: ProductSummary) => {
    const confirmed = window.confirm(
      `Queres excluir o curso "${course.title}"? Esta acao remove o curso apenas quando nao existem pedidos vinculados.`,
    )
    if (!confirmed) return

    setSubmitError(null)

    try {
      await deleteCourse.mutateAsync(course.id)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel excluir o curso.")
    }
  }

  const handleDropReorder = async (targetCourseId: string) => {
    if (!draggingCourseId || draggingCourseId === targetCourseId || reorderPending || deferredQuery.trim()) {
      setDraggingCourseId(null)
      return
    }

    const fromIndex = products.findIndex((course) => course.id === draggingCourseId)
    const toIndex = products.findIndex((course) => course.id === targetCourseId)
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingCourseId(null)
      return
    }

    const reordered = moveItem(products, fromIndex, toIndex)
    setReorderPending(true)
    setSubmitError(null)

    try {
      for (const [index, course] of reordered.entries()) {
        const nextSortOrder = index + 1
        if (course.sort_order === nextSortOrder) continue

        await updateCourse.mutateAsync({
          productId: course.id,
          sortOrder: nextSortOrder,
        })
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel reordenar os cursos.")
    } finally {
      setDraggingCourseId(null)
      setReorderPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">Catalogo academico</p>
            <div className="space-y-2">
              <h1 className="font-display text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                Catalogo de Cursos
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-600">
                Gerencie seu curriculo, organize a ordem de exibicao e acompanhe rapidamente o status de cada treinamento.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-5 text-slate-700 shadow-sm hover:bg-white"
              onClick={() => importInputRef.current?.click()}
            >
              <Sparkles className="mr-2 h-4 w-4 text-sky-600" />
              Importar estrutura
            </Button>
            <Button
              type="button"
              className="h-12 rounded-2xl bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] px-6 text-white shadow-[0_18px_32px_rgba(18,89,111,0.28)] hover:opacity-95"
              onClick={() => openCreateEditor()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar novo curso
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-slate-50 text-slate-500">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Total</p>
              <p className="mt-1 text-4xl font-bold text-slate-950">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(180deg,#f8fffb_0%,#f3fdf7_100%)] p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">Publicados</p>
              <p className="mt-1 text-4xl font-bold text-slate-950">{publishedCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-sky-300 bg-[linear-gradient(180deg,#fafdff_0%,#f1f9ff_100%)] p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-sky-100 text-sky-700">
              <Clock3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Em rascunho</p>
              <p className="mt-1 text-4xl font-bold text-slate-950">{draftCount}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Ordem de exibicao dos cursos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Recurso recolhido por padrao para nao ocupar a tela. Arraste os cards para reposicionar quando a pesquisa estiver vazia.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative md:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar por titulo, slug ou estado"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>
            <StatusBadge
              label={deferredQuery.trim() ? "Drag and drop pausado" : "Drag and drop ativo"}
              tone={deferredQuery.trim() ? "warning" : "success"}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl border-sky-600 px-5 text-sky-700"
              onClick={() => setQuery("")}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Organizar exibicao
            </Button>
          </div>
        </div>

        {submitError ? (
          <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        ) : null}

        {filteredCourses.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Sem cursos nesta vista"
              message="Cria um novo curso, ajusta a pesquisa ou importa um JSON para comecar."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <article
                key={course.id}
                draggable={!deferredQuery.trim() && !reorderPending}
                onDragStart={() => setDraggingCourseId(course.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDropReorder(course.id)}
                className={`group overflow-hidden rounded-[1.55rem] border bg-white transition hover:-translate-y-0.5 ${cardAccentClasses[course.status]}`}
              >
                <div className="relative h-[18.5rem] overflow-hidden bg-slate-200">
                  <div className="absolute left-4 top-4 z-10">
                    <span className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-sm">
                      {statusLabels[course.status]}
                    </span>
                  </div>
                  <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md bg-slate-950/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
                    <GripVertical className="h-3.5 w-3.5" />
                    Ordem {course.sort_order}
                  </div>
                  <div className="absolute inset-0">
                    {course.cover_image_url ? (
                      <img
                        src={course.cover_image_url}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#1a91af_0%,#155d73_55%,#123845_100%)] text-white/85">
                        <div className="rounded-[1.2rem] bg-white/95 px-12 py-6 shadow-[0_20px_40px_rgba(15,23,42,0.18)]">
                          <BookOpen className="h-8 w-8 text-sky-700" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.22)_34%,rgba(15,23,42,0.86)_100%)] px-4 pb-4 pt-20">
                    <p className="font-display text-[2rem] font-bold leading-none text-sky-300 drop-shadow-[0_2px_12px_rgba(15,23,42,0.8)]">
                      {course.title}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-md bg-slate-950/78 px-3 py-2 text-sm font-semibold text-white shadow-lg">
                        <Clock3 className="h-4 w-4 text-sky-400" />
                        {formatWorkloadMinutes(course.workload_minutes)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{course.is_public ? "Publico" : "Privado"}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{typeLabels[course.product_type]}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{formatProductPrice(course.price_cents, course.currency)}</span>
                  </div>

                  <p className="min-h-[72px] text-[1.02rem] leading-8 text-slate-600">
                    {clampDescription(course.description ?? course.short_description)}
                  </p>

                  <div className="grid grid-cols-[1.15fr_1.15fr_repeat(3,52px)] gap-2">
                    <div className="rounded-[1rem] border border-slate-100 bg-slate-50 px-3 py-3 text-center shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Catalogo</p>
                      <p className="mt-2 text-xs font-bold uppercase text-sky-700">
                        {course.is_public ? "Publico" : "Privado"}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-slate-100 bg-slate-50 px-3 py-3 text-center shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Builder</p>
                      <p className="mt-2 text-xs font-bold uppercase text-slate-700">LMS</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-[52px] rounded-[1rem] border-slate-100 bg-slate-50 px-0 text-sky-700 shadow-sm hover:bg-white"
                      onClick={() => void handleExportCourse(course)}
                      disabled={exportingCourseId === course.id}
                      title="Exportar curso"
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-[52px] rounded-[1rem] border-slate-100 bg-slate-50 px-0 text-slate-700 shadow-sm hover:bg-white"
                      onClick={() => openEditEditor(course)}
                      title="Editar curso"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-[52px] rounded-[1rem] border-slate-100 bg-slate-50 px-0 text-rose-600 shadow-sm hover:bg-white"
                      onClick={() => void handleDeleteCourse(course)}
                      disabled={deleteCourse.isPending}
                      title="Excluir curso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-11 flex-1 rounded-[1rem] border-slate-200 bg-white">
                      <Link to={adminCourseBuilderPath(course.id)}>Abrir construtor</Link>
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-[1rem] bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] px-5 text-white hover:opacity-95"
                      onClick={() => openEditEditor(course)}
                    >
                      Ajustar
                    </Button>
                  </div>

                  {course.launch_date ? (
                    <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Lancamento programado para {course.launch_date}.
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editorState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {editorState.mode === "edit"
                    ? "Edicao basica"
                    : editorState.mode === "import"
                      ? "Importacao JSON"
                      : "Criacao de curso"}
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold text-slate-950">
                  {editorState.mode === "edit" ? "Editar curso" : "Novo curso"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Dados basicos do curso no catalogo. O conteudo real de LMS continua no construtor.
                </p>
              </div>
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => setEditorState(null)}>
                Fechar
              </Button>
            </div>

            {editorState.importedStructure ? (
              <div className="mt-5 rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">
                O JSON importado vai recriar o curso com modulos, aulas, materiais e avaliacoes assim que o cadastro basico for confirmado.
              </div>
            ) : null}

            <form onSubmit={handleSaveCourse} className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                value={editorState.draft.title}
                onChange={(event) => {
                  handleEditorDraft("title", event.target.value)
                  if (!editorState.draft.slug) {
                    handleEditorDraft("slug", slugify(event.target.value))
                  }
                }}
                placeholder="Titulo do curso"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={editorState.draft.slug}
                onChange={(event) => handleEditorDraft("slug", slugify(event.target.value))}
                placeholder="slug-do-curso"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={editorState.draft.coverImageUrl}
                onChange={(event) => handleEditorDraft("coverImageUrl", event.target.value)}
                placeholder="Imagem de capa (URL)"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:col-span-2"
              />
              <select
                value={editorState.draft.status}
                onChange={(event) =>
                  handleEditorDraft("status", event.target.value as ProductSummary["status"])
                }
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
              <input
                type="date"
                value={editorState.draft.launchDate}
                onChange={(event) => handleEditorDraft("launchDate", event.target.value)}
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={editorState.draft.price}
                onChange={(event) => handleEditorDraft("price", event.target.value)}
                placeholder="Valor de venda"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={editorState.draft.currency}
                onChange={(event) => handleEditorDraft("currency", event.target.value.toUpperCase())}
                placeholder="Moeda"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={editorState.draft.workloadMinutes}
                onChange={(event) => handleEditorDraft("workloadMinutes", event.target.value)}
                placeholder="Carga horaria em minutos"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={editorState.draft.sortOrder}
                onChange={(event) => handleEditorDraft("sortOrder", event.target.value)}
                placeholder="Ordem de exibicao"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />

              <label className="md:col-span-2 flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editorState.draft.isPublic}
                  onChange={(event) => handleEditorDraft("isPublic", event.target.checked)}
                />
                Visivel no catalogo publico
              </label>

              <textarea
                value={editorState.draft.description}
                onChange={(event) => handleEditorDraft("description", event.target.value)}
                rows={8}
                placeholder="Descricao detalhada do curso"
                className="md:col-span-2 rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  className="rounded-full"
                  disabled={createCourse.isPending || updateCourse.isPending}
                >
                  {createCourse.isPending || updateCourse.isPending
                    ? "A guardar..."
                    : editorState.mode === "edit"
                      ? "Guardar curso"
                      : "Criar curso"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setEditorState(null)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
