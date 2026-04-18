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
  BookOpen,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminProducts,
  useCreateAdminProduct,
  useDeleteAdminProduct,
  useUpdateAdminProduct,
} from "@/hooks/useAdmin"
import { supabase } from "@/integrations/supabase"
import { adminCourseBuilderPath } from "@/lib/routes"
import {
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

const statusTones: Record<ProductSummary["status"], "warning" | "success" | "danger"> = {
  draft: "warning",
  published: "success",
  archived: "danger",
}

const typeLabels: Record<ProductSummary["product_type"], string> = {
  paid: "Pago",
  free: "Gratuito",
  hybrid: "Hibrido",
  external_service: "Servico externo",
}

function formatWorkloadMinutes(minutes: number) {
  if (minutes <= 0) return "Carga por definir"
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}min`
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
      <PageHeader
        title="Cursos"
        description="Catalogo academico central com criacao, edicao basica e entrada direta no construtor LMS."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-[1.5rem] bg-slate-100" />
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
      const { error } = await supabase.from("product_assessments").insert(
        importedStructure.assessments.map((assessment) => ({
          product_id: courseId,
          module_id: assessment.module_id ? moduleIdMap.get(assessment.module_id) ?? null : null,
          assessment_type: assessment.assessment_type,
          title: assessment.title,
          description: assessment.description,
          is_required: assessment.is_required,
          passing_score: assessment.passing_score,
          max_attempts: assessment.max_attempts,
          estimated_minutes: assessment.estimated_minutes,
          is_active: assessment.is_active,
          builder_payload: assessment.builder_payload,
        })),
      )

      if (error) {
        throw error
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
      <PageHeader
        title="Cursos"
        description="Ponto inicial do admin para gerir o catalogo academico, editar dados basicos e abrir o construtor LMS."
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar JSON
            </Button>
            <Button type="button" className="rounded-full" onClick={() => openCreateEditor()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo curso
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total de cursos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cursos publicados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{publishedCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cursos em rascunho</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{draftCount}</p>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Lista de cursos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Cada curso mostra capa, estado, carga horaria, preco, visibilidade, ordem e acoes administrativas.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por titulo, slug ou estado"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:w-80"
            />
            <StatusBadge
              label={deferredQuery.trim() ? "Drag and drop pausado" : "Drag and drop ativo"}
              tone={deferredQuery.trim() ? "warning" : "success"}
            />
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
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {filteredCourses.map((course) => (
              <article
                key={course.id}
                draggable={!deferredQuery.trim() && !reorderPending}
                onDragStart={() => setDraggingCourseId(course.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDropReorder(course.id)}
                className="rounded-[1.5rem] border bg-slate-50/80 p-4 transition hover:border-slate-300"
              >
                <div className="flex gap-4">
                  <div className="h-28 w-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-slate-200">
                    {course.cover_image_url ? (
                      <img
                        src={course.cover_image_url}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_50%,#e2e8f0_100%)] text-slate-500">
                        <BookOpen className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-lg font-semibold text-slate-950">{course.title}</p>
                          <StatusBadge label={statusLabels[course.status]} tone={statusTones[course.status]} />
                          <StatusBadge label={course.is_public ? "Publico" : "Privado"} tone={course.is_public ? "info" : "neutral"} />
                        </div>
                        <p className="mt-2 text-sm text-slate-600">/{course.slug}</p>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400">
                        <GripVertical className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.18em]">Ordem {course.sort_order}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Carga horaria</p>
                        <p className="mt-2 font-medium text-slate-950">{formatWorkloadMinutes(course.workload_minutes)}</p>
                      </div>
                      <div className="rounded-2xl border bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Preco</p>
                        <p className="mt-2 font-medium text-slate-950">
                          {formatProductPrice(course.price_cents, course.currency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge label={typeLabels[course.product_type]} tone="neutral" />
                      {course.launch_date ? (
                        <StatusBadge label={`Lancamento ${course.launch_date}`} tone="warning" />
                      ) : null}
                    </div>

                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {course.description ?? "Curso sem descricao detalhada definida."}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => openEditEditor(course)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button asChild variant="outline" className="rounded-full">
                        <Link to={adminCourseBuilderPath(course.id)}>Abrir construtor</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => void handleExportCourse(course)}
                        disabled={exportingCourseId === course.id}
                      >
                        <ArrowDownToLine className="mr-2 h-4 w-4" />
                        {exportingCourseId === course.id ? "A exportar..." : "Exportar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => void handleDeleteCourse(course)}
                        disabled={deleteCourse.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
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
