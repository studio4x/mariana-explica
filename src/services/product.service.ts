import { publicSupabase, supabase } from "@/integrations/supabase"
import type { ProductAssessmentSummary, ProductLessonSummary, ProductModuleSummary } from "@/types/app.types"
import type { ProductCategorySummary, ProductDetails, ProductSummary } from "@/types/product.types"

export interface PublishedCourseOutline {
  modules: ProductModuleSummary[]
  lessonsByModule: Record<string, ProductLessonSummary[]>
  assessments: ProductAssessmentSummary[]
}

const productSelectWithCategories = `
  id,
  slug,
  title,
  short_description,
  description,
  product_type,
  status,
  price_cents,
  currency,
  cover_image_url,
  launch_date,
  is_public,
  creator_id,
  creator_commission_percent,
  workload_minutes,
  has_linear_progression,
  quiz_type_settings,
  public_page_content,
  sales_page_enabled,
  requires_auth,
  is_featured,
  allow_affiliate,
  sort_order,
  category_id,
  published_at
`

const productSelectLegacy = `
  id,
  slug,
  title,
  short_description,
  description,
  product_type,
  status,
  price_cents,
  currency,
  cover_image_url,
  launch_date,
  is_public,
  creator_id,
  creator_commission_percent,
  workload_minutes,
  has_linear_progression,
  quiz_type_settings,
  public_page_content,
  sales_page_enabled,
  requires_auth,
  is_featured,
  allow_affiliate,
  sort_order,
  published_at
`

const productModuleSelect = `
  id,
  product_id,
  title,
  description,
  module_type,
  access_type,
  sort_order,
  position,
  is_preview,
  is_required,
  starts_at,
  ends_at,
  release_days_after_enrollment,
  module_pdf_storage_path,
  module_pdf_file_name,
  module_pdf_uploaded_at,
  status
`

const productLessonSelect = `
  id,
  module_id,
  title,
  description,
  position,
  is_required,
  lesson_type,
  youtube_url,
  text_content,
  estimated_minutes,
  starts_at,
  ends_at,
  status
`

const productAssessmentSelect = `
  id,
  product_id,
  module_id,
  assessment_type,
  title,
  description,
  is_required,
  passing_score,
  max_attempts,
  estimated_minutes,
  is_active,
  builder_payload,
  created_by,
  created_at,
  updated_at
`

const productCategorySelect = `
  id,
  slug,
  title,
  description,
  sort_order,
  is_active,
  created_at,
  updated_at
`

function isSchemaMismatch(error: unknown, hint: string) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()

  if (fullText.includes("schema cache") || fullText.includes("does not exist") || fullText.includes("not found")) {
    return true
  }

  return fullText.includes(hint.toLowerCase())
}

function withCategoryFallback(items: Omit<ProductSummary, "category_id">[]): ProductSummary[] {
  return items.map((item) => ({ ...item, category_id: null }))
}

function groupLessonsByModule(lessons: ProductLessonSummary[]) {
  return lessons.reduce<Record<string, ProductLessonSummary[]>>((accumulator, lesson) => {
    const list = accumulator[lesson.module_id] ?? []
    list.push(lesson)
    accumulator[lesson.module_id] = list
    return accumulator
  }, {})
}

async function fetchCourseOutlineByProductId(
  client: typeof publicSupabase,
  productId: string,
  publishedOnly: boolean,
): Promise<PublishedCourseOutline> {
  let modulesQuery = client
    .from("product_modules")
    .select(productModuleSelect)
    .eq("product_id", productId)

  if (publishedOnly) {
    modulesQuery = modulesQuery.eq("status", "published")
  }

  const { data: modulesData, error: modulesError } = await modulesQuery
    .order("position", { ascending: true })
    .order("sort_order", { ascending: true })

  if (modulesError) {
    throw modulesError
  }

  const modules = (modulesData ?? []) as ProductModuleSummary[]
  const moduleIds = modules.map((module) => module.id)

  let lessonsQuery = moduleIds.length
    ? client
        .from("product_lessons")
        .select(productLessonSelect)
        .in("module_id", moduleIds)
    : null

  if (lessonsQuery && publishedOnly) {
    lessonsQuery = lessonsQuery.eq("status", "published")
  }

  let assessmentsQuery = client
    .from("product_assessments")
    .select(productAssessmentSelect)
    .eq("product_id", productId)

  if (publishedOnly) {
    assessmentsQuery = assessmentsQuery.eq("is_active", true)
  }

  const [{ data: lessonsData, error: lessonsError }, { data: assessmentsData, error: assessmentsError }] =
    await Promise.all([
      lessonsQuery ? lessonsQuery.order("position", { ascending: true }) : Promise.resolve({ data: [], error: null }),
      assessmentsQuery.order("created_at", { ascending: true }),
    ])

  if (lessonsError) {
    throw lessonsError
  }

  if (assessmentsError) {
    throw assessmentsError
  }

  return {
    modules,
    lessonsByModule: groupLessonsByModule((lessonsData ?? []) as ProductLessonSummary[]),
    assessments: (assessmentsData ?? []) as ProductAssessmentSummary[],
  }
}

export async function fetchPublishedProducts() {
  const { data, error } = await publicSupabase
    .from("products")
    .select(productSelectWithCategories)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })

  if (error && isSchemaMismatch(error, "category_id")) {
    const legacy = await publicSupabase
      .from("products")
      .select(productSelectLegacy)
      .eq("status", "published")
      .eq("sales_page_enabled", true)
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })

    if (legacy.error) {
      throw legacy.error
    }

    return withCategoryFallback((legacy.data ?? []) as Omit<ProductSummary, "category_id">[])
  }

  if (error) throw error

  return (data ?? []) as ProductSummary[]
}

export async function fetchPublishedProductCategories() {
  const { data, error } = await publicSupabase
    .from("product_categories")
    .select(productCategorySelect)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error && isSchemaMismatch(error, "product_categories")) {
    return []
  }

  if (error) throw error

  return (data ?? []) as ProductCategorySummary[]
}

export async function fetchFeaturedProducts() {
  const { data, error } = await publicSupabase
    .from("products")
    .select(productSelectWithCategories)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(3)

  if (error && isSchemaMismatch(error, "category_id")) {
    const legacy = await publicSupabase
      .from("products")
      .select(productSelectLegacy)
      .eq("status", "published")
      .eq("sales_page_enabled", true)
      .eq("is_featured", true)
      .order("sort_order", { ascending: true })
      .limit(3)

    if (legacy.error) {
      throw legacy.error
    }

    return withCategoryFallback((legacy.data ?? []) as Omit<ProductSummary, "category_id">[])
  }

  if (error) throw error

  return (data ?? []) as ProductSummary[]
}

export async function fetchPublishedProductBySlug(slug: string): Promise<ProductSummary | null> {
  const identifier = slug?.trim()
  const isUuid =
    Boolean(identifier) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)

  if (isUuid) {
    const { data, error } = await publicSupabase
      .from("products")
      .select(productSelectWithCategories)
      .eq("status", "published")
      .eq("sales_page_enabled", true)
      .eq("id", identifier)
      .maybeSingle()

    if (error && isSchemaMismatch(error, "category_id")) {
      const legacy = await publicSupabase
        .from("products")
        .select(productSelectLegacy)
        .eq("status", "published")
        .eq("sales_page_enabled", true)
        .eq("id", identifier)
        .maybeSingle()

      if (legacy.error) throw legacy.error
      return legacy.data ? ({ ...legacy.data, category_id: null } as ProductSummary) : null
    }

    if (error) throw error

    return (data ?? null) as ProductSummary | null
  }

  const { data, error } = await publicSupabase
    .from("products")
    .select(productSelectWithCategories)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .eq("slug", slug)
    .maybeSingle()

  if (error && isSchemaMismatch(error, "category_id")) {
    const legacy = await publicSupabase
      .from("products")
      .select(productSelectLegacy)
      .eq("status", "published")
      .eq("sales_page_enabled", true)
      .eq("slug", slug)
      .maybeSingle()

    if (legacy.error) throw legacy.error
    return legacy.data ? ({ ...legacy.data, category_id: null } as ProductSummary) : null
  }

  if (error) throw error

  return (data ?? null) as ProductSummary | null
}

export async function fetchAdminPreviewProductBySlug(slug: string): Promise<ProductSummary | null> {
  const identifier = slug?.trim()
  const isUuid =
    Boolean(identifier) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)

  if (isUuid) {
    const { data, error } = await publicSupabase
      .from("products")
      .select(productSelectWithCategories)
      .eq("id", identifier)
      .maybeSingle()

    if (error && isSchemaMismatch(error, "category_id")) {
      const legacy = await publicSupabase
        .from("products")
        .select(productSelectLegacy)
        .eq("id", identifier)
        .maybeSingle()

      if (legacy.error) throw legacy.error
      return legacy.data ? ({ ...legacy.data, category_id: null } as ProductSummary) : null
    }

    if (error) throw error

    return (data ?? null) as ProductSummary | null
  }

  const { data, error } = await supabase
    .from("products")
    .select(productSelectWithCategories)
    .eq("slug", slug)
    .maybeSingle()

  if (error && isSchemaMismatch(error, "category_id")) {
    const legacy = await supabase
      .from("products")
      .select(productSelectLegacy)
      .eq("slug", slug)
      .maybeSingle()

    if (legacy.error) throw legacy.error
    return legacy.data ? ({ ...legacy.data, category_id: null } as ProductSummary) : null
  }

  if (error) throw error

  return (data ?? null) as ProductSummary | null
}

export async function fetchPublishedCourseOutlineByProductId(productId: string): Promise<PublishedCourseOutline> {
  return fetchCourseOutlineByProductId(publicSupabase, productId, true)
}

export async function fetchAdminPreviewCourseOutlineByProductId(productId: string): Promise<PublishedCourseOutline> {
  return fetchCourseOutlineByProductId(supabase, productId, false)
}

export async function fetchPublishedProductDetailsBySlug(slug: string): Promise<ProductDetails | null> {
  const { data, error } = await publicSupabase
    .from("products")
    .select(productSelectWithCategories)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .eq("slug", slug)
    .maybeSingle()

  if (error && isSchemaMismatch(error, "category_id")) {
    const legacy = await publicSupabase
      .from("products")
      .select(productSelectLegacy)
      .eq("status", "published")
      .eq("sales_page_enabled", true)
      .eq("slug", slug)
      .maybeSingle()

    if (legacy.error) throw legacy.error
    return legacy.data ? ({ ...legacy.data, category_id: null } as ProductDetails) : null
  }

  if (error) throw error

  return (data ?? null) as ProductDetails | null
}

export function isFreeProduct(product: Pick<ProductSummary, "product_type" | "price_cents">) {
  return product.product_type === "free" || product.price_cents === 0
}
