import { supabase } from "@/integrations/supabase"
import { uploadStorageFile } from "@/features/storage/r2-upload"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { isValidNif, stripNifDigits } from "@/lib/nif"
import { getFreshFunctionAuthContext, getFunctionAuthHeaders } from "@/services/supabase-auth"
import type {
  AccessGrantSummary,
  AssessmentAttemptState,
  CourseAssessmentNavigationSummary,
  CourseLessonNavigationSummary,
  CourseModuleNavigationSummary,
  DashboardOverviewData,
  DashboardProductSummary,
  DownloadableItem,
  LessonNoteSummary,
  LessonProgressSummary,
  ModuleAssetSummary,
  NotificationItem,
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
  ProfilePreferences,
  ProfileAvatarUploadResult,
  StudentPaymentSummary,
  StudentCourseNavigationData,
  SupportTicketMessage,
  SupportTicketSummary,
  SupportAttachmentUploadResult,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id

  if (!userId) {
    throw new Error("Sessão inválida")
  }

  return userId
}

async function getCurrentProfileSummary() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,is_admin,status")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const profile = data && typeof data === "object" ? (data as { is_admin?: boolean; role?: string; status?: string }) : null

  return {
    userId,
    isAdmin: Boolean(profile?.is_admin === true && profile?.role === "admin" && profile?.status === "active"),
  }
}

async function fetchProductsByIds(productIds: string[]) {
  if (productIds.length === 0) {
    return [] as ProductSummary[]
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,cover_image_storage_bucket,cover_image_storage_path,cover_image_storage_provider,launch_date,is_public,creator_id,creator_commission_percent,workload_minutes,has_linear_progression,quiz_type_settings,public_page_content,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,published_at",
    )
    .in("id", productIds)

  if (error) {
    throw error
  }

  return (data ?? []) as ProductSummary[]
}

async function fetchModulesByProductIds(productIds: string[]) {
  if (productIds.length === 0) {
    return [] as ProductModuleSummary[]
  }

  const { data, error } = await supabase
    .from("product_modules")
    .select("id,product_id,title,description,module_type,access_type,sort_order,position,is_preview,is_required,starts_at,ends_at,release_days_after_enrollment,module_pdf_storage_path,module_pdf_storage_provider,module_pdf_file_name,module_pdf_uploaded_at,status")
    .in("product_id", productIds)
    .order("position", { ascending: true })
    .order("sort_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductModuleSummary[]
}

async function fetchLessonsByModuleIds(moduleIds: string[]) {
  if (moduleIds.length === 0) {
    return [] as ProductLessonSummary[]
  }

  const { data, error } = await supabase
    .from("product_lessons")
    .select(
      "id,module_id,title,description,position,is_required,lesson_type,youtube_url,text_content,lesson_file_storage_bucket,lesson_file_storage_path,lesson_file_storage_provider,lesson_file_name,lesson_file_mime_type,lesson_file_size_bytes,estimated_minutes,starts_at,ends_at,status",
    )
    .in("module_id", moduleIds)
    .order("position", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductLessonSummary[]
}

async function fetchLessonProgressByProductIds(productIds: string[]) {
  if (productIds.length === 0) {
    return [] as LessonProgressSummary[]
  }

  const { data, error } = await supabase
    .from("lesson_progress")
    .select(
      "id,user_id,lesson_id,product_id,module_id,status,progress_percent,started_at,completed_at,last_accessed_at",
    )
    .in("product_id", productIds)

  if (error) {
    throw error
  }

  return (data ?? []) as LessonProgressSummary[]
}

export async function fetchUnreadNotificationsCount(userId?: string) {
  const targetUserId = userId ?? (await getCurrentUserId())
  const response = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetUserId)
    .eq("status", "unread")

  const error = "error" in response ? response.error : null
  if (error) {
    throw error
  }

  const rawCount = "count" in response ? response.count : 0
  return Number(rawCount ?? 0)
}

async function requireCurrentUserId() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  if (!session?.user) {
    throw new Error("Sessão expirada")
  }

  return session.user.id
}

function mutableTable(table: string) {
  return (supabase as unknown as {
    from: (name: string) => {
      upsert: (...args: unknown[]) => {
        select: (...args: unknown[]) => {
          single: () => Promise<{ data: unknown; error: unknown }>
        }
      }
    }
  }).from(table)
}

export async function fetchMyAccessGrants() {
  const { data, error } = await supabase
    .from("access_grants")
    .select("id,product_id,source_order_id,granted_at,expires_at,revoked_at,status")
    .eq("status", "active")
    .order("granted_at", { ascending: false })

  if (error) {
    throw error
  }

  const now = Date.now()
  const grants = ((data ?? []) as Array<AccessGrantSummary & { revoked_at: string | null }>)
    .filter((grant) => {
      if (grant.revoked_at) {
        return false
      }

      if (!grant.expires_at) {
        return true
      }

      return new Date(grant.expires_at).getTime() > now
    })
    .map((grant) => ({
      id: grant.id,
      product_id: grant.product_id,
      source_order_id: grant.source_order_id,
      granted_at: grant.granted_at,
      expires_at: grant.expires_at,
      status: grant.status,
    }))

  return grants
}

export async function fetchMyProducts(): Promise<DashboardProductSummary[]> {
  const { isAdmin } = await getCurrentProfileSummary()
  if (isAdmin) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,cover_image_storage_bucket,cover_image_storage_path,cover_image_storage_provider,launch_date,is_public,creator_id,creator_commission_percent,workload_minutes,has_linear_progression,quiz_type_settings,public_page_content,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,published_at,updated_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    const products = (data ?? []) as Array<ProductSummary & { updated_at?: string | null }>
    const modules = await fetchModulesByProductIds(products.map((product) => product.id))
    const lessons = await fetchLessonsByModuleIds(modules.map((module) => module.id))
    const assets = await fetchModuleAssets(modules.map((module) => module.id))
    const modulesByProduct = new Map<string, ProductModuleSummary[]>()
    const assetsByModule = new Map<string, ModuleAssetSummary[]>()
    const lessonsByModule = new Map<string, ProductLessonSummary[]>()

    for (const module of modules) {
      const list = modulesByProduct.get(module.product_id) ?? []
      list.push(module)
      modulesByProduct.set(module.product_id, list)
    }

    for (const asset of assets) {
      const list = assetsByModule.get(asset.module_id) ?? []
      list.push(asset)
      assetsByModule.set(asset.module_id, list)
    }

    for (const lesson of lessons) {
      const list = lessonsByModule.get(lesson.module_id) ?? []
      list.push(lesson)
      lessonsByModule.set(lesson.module_id, list)
    }

    return products.map((product) => {
      const productModules = modulesByProduct.get(product.id) ?? []
      const productLessons = productModules.flatMap((module) => lessonsByModule.get(module.id) ?? [])
      const productAssets = productModules.flatMap((module) => assetsByModule.get(module.id) ?? [])
      const modulePdfCount = productModules.filter(
        (module) => Boolean(module.module_pdf_storage_path && module.module_pdf_file_name),
      ).length
      const previewGrantedAt = product.published_at ?? product.updated_at ?? new Date().toISOString()

      return {
        ...product,
        grant_id: `admin-preview-${product.id}`,
        granted_at: previewGrantedAt,
        expires_at: null,
        module_count: productModules.length,
        lesson_count: productLessons.length,
        asset_count: productAssets.length + modulePdfCount,
        preview_count: productModules.filter((module) => module.is_preview).length,
        download_count: productAssets.filter((asset) => asset.allow_download).length + modulePdfCount,
        completed_lessons: 0,
        progress_percent: 0,
      }
    })
  }

  const grants = await fetchMyAccessGrants()
  const productIds = grants.map((grant) => grant.product_id)
  const [products, modules] = await Promise.all([
    fetchProductsByIds(productIds),
    fetchModulesByProductIds(productIds),
  ])
  const [lessons, assets, progress] = await Promise.all([
    fetchLessonsByModuleIds(modules.map((module) => module.id)),
    fetchModuleAssets(modules.map((module) => module.id)),
    fetchLessonProgressByProductIds(productIds),
  ])
  const productMap = new Map(products.map((product) => [product.id, product]))
  const modulesByProduct = new Map<string, ProductModuleSummary[]>()
  const assetsByModule = new Map<string, ModuleAssetSummary[]>()
  const lessonsByModule = new Map<string, ProductLessonSummary[]>()
  const progressByProduct = new Map<string, LessonProgressSummary[]>()

  for (const module of modules) {
    const list = modulesByProduct.get(module.product_id) ?? []
    list.push(module)
    modulesByProduct.set(module.product_id, list)
  }

  for (const asset of assets) {
    const list = assetsByModule.get(asset.module_id) ?? []
    list.push(asset)
    assetsByModule.set(asset.module_id, list)
  }

  for (const lesson of lessons) {
    const list = lessonsByModule.get(lesson.module_id) ?? []
    list.push(lesson)
    lessonsByModule.set(lesson.module_id, list)
  }

  for (const item of progress) {
    const list = progressByProduct.get(item.product_id) ?? []
    list.push(item)
    progressByProduct.set(item.product_id, list)
  }

  return grants
    .map((grant) => {
      const product = productMap.get(grant.product_id)
      if (!product) return null

      const productModules = modulesByProduct.get(product.id) ?? []
      const productLessons = productModules.flatMap((module) => lessonsByModule.get(module.id) ?? [])
      const productAssets = productModules.flatMap((module) => assetsByModule.get(module.id) ?? [])
      const modulePdfCount = productModules.filter(
        (module) => Boolean(module.module_pdf_storage_path && module.module_pdf_file_name),
      ).length
      const productProgress = progressByProduct.get(product.id) ?? []
      const completedLessons = productProgress.filter((item) => item.status === "completed").length
      const progressPercent =
        productLessons.length > 0 ? Math.round((completedLessons / productLessons.length) * 100) : 0

      return {
        ...product,
        grant_id: grant.id,
        granted_at: grant.granted_at,
        expires_at: grant.expires_at,
        module_count: productModules.length,
        lesson_count: productLessons.length,
        asset_count: productAssets.length + modulePdfCount,
        preview_count: productModules.filter((module) => module.is_preview).length,
        download_count: productAssets.filter((asset) => asset.allow_download).length + modulePdfCount,
        completed_lessons: completedLessons,
        progress_percent: progressPercent,
      }
    })
    .filter((item): item is DashboardProductSummary => Boolean(item))
}

export async function fetchDashboardOverview(): Promise<DashboardOverviewData> {
  const [products, recentNotifications, unreadNotificationsCount, supportTickets] = await Promise.all([
    fetchMyProducts(),
    fetchNotifications(4),
    fetchUnreadNotificationsCount(),
    fetchSupportTickets(),
  ])

  return { products, recentNotifications, unreadNotificationsCount, supportTickets }
}

export async function fetchProductModules(productId: string) {
  const { data, error } = await supabase
    .from("product_modules")
    .select("id,product_id,title,description,module_type,access_type,sort_order,position,is_preview,is_required,starts_at,ends_at,release_days_after_enrollment,module_pdf_storage_path,module_pdf_storage_provider,module_pdf_file_name,module_pdf_uploaded_at,status")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .order("sort_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductModuleSummary[]
}

export async function fetchProductLessons(moduleIds: string[]) {
  return fetchLessonsByModuleIds(moduleIds)
}

export async function fetchModuleAssetsByModule(moduleId: string) {
  const assets = await fetchModuleAssets([moduleId])
  return assets.filter((asset) => asset.module_id === moduleId)
}

export async function requestModulePdfAccess(moduleId: string) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/generate-module-pdf-access`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: auth.headers.Authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        moduleId,
        access_token: auth.accessToken,
      }),
    },
  )

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return data as {
    success: true
    mode: "signed_url"
    url: string
    expires_in_seconds: number
    file_name: string
  }
}

export async function fetchAccessibleLesson(lessonId: string) {
  const { data, error } = await supabase
    .from("product_lessons")
    .select(
      "id,module_id,title,description,position,is_required,lesson_type,youtube_url,text_content,estimated_minutes,starts_at,ends_at,status",
    )
    .eq("id", lessonId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as ProductLessonSummary | null
}

export async function fetchLessonProgress(productId: string) {
  const { data, error } = await supabase
    .from("lesson_progress")
    .select(
      "id,user_id,lesson_id,product_id,module_id,status,progress_percent,started_at,completed_at,last_accessed_at",
    )
    .eq("product_id", productId)

  if (error) {
    throw error
  }

  return (data ?? []) as LessonProgressSummary[]
}

export async function fetchProductAssessments(productId: string) {
  const { data, error } = await supabase
    .from("product_assessments")
    .select(
      "id,product_id,module_id,assessment_type,title,description,is_required,passing_score,max_attempts,estimated_minutes,is_active,builder_payload,created_by,created_at,updated_at",
    )
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductAssessmentSummary[]
}

export async function fetchAccessibleAssessment(assessmentId: string) {
  const { data, error } = await supabase
    .from("product_assessments")
    .select(
      "id,product_id,module_id,assessment_type,title,description,is_required,passing_score,max_attempts,estimated_minutes,is_active,builder_payload,created_by,created_at,updated_at",
    )
    .eq("id", assessmentId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as ProductAssessmentSummary | null
}

async function invokeStudentAssessmentFunction<TResponse>(body: unknown) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/student-assessment-attempts`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: auth.headers.Authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(typeof body === "object" && body !== null ? body : {}),
        access_token: auth.accessToken,
      }),
    },
  )

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return data as TResponse
}

export async function fetchAssessmentAttemptState(assessmentId: string) {
  return invokeStudentAssessmentFunction<AssessmentAttemptState & { success: true }>({
    action: "get_state",
    assessmentId,
  })
}

export async function saveAssessmentAttemptDraft(input: {
  attemptId: string
  answersPayload: Record<string, unknown>
}) {
  return invokeStudentAssessmentFunction<AssessmentAttemptState & { success: true }>({
    action: "save_draft",
    ...input,
  })
}

export async function submitAssessmentAttempt(input: {
  attemptId: string
  answersPayload: Record<string, unknown>
}) {
  return invokeStudentAssessmentFunction<AssessmentAttemptState & { success: true }>({
    action: "submit",
    ...input,
  })
}

export async function fetchLessonNotes(lessonId: string) {
  const { data, error } = await supabase
    .from("lesson_notes")
    .select("id,user_id,lesson_id,note_text,created_at,updated_at")
    .eq("lesson_id", lessonId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as LessonNoteSummary | null
}

export async function saveLessonNote(input: { lessonId: string; noteText: string }) {
  const userId = await requireCurrentUserId()
  const { data, error } = await mutableTable("lesson_notes")
    .upsert(
      {
        user_id: userId,
        lesson_id: input.lessonId,
        note_text: input.noteText,
      },
      { onConflict: "user_id,lesson_id" },
    )
    .select("id,user_id,lesson_id,note_text,created_at,updated_at")
    .single()

  if (error) {
    throw error
  }

  return data as LessonNoteSummary
}

export async function upsertLessonProgress(input: {
  lessonId: string
  productId: string
  moduleId: string
  status: LessonProgressSummary["status"]
  progressPercent: number
}) {
  const userId = await requireCurrentUserId()
  const { data, error } = await mutableTable("lesson_progress")
    .upsert(
      {
        user_id: userId,
        lesson_id: input.lessonId,
        product_id: input.productId,
        module_id: input.moduleId,
        status: input.status,
        progress_percent: input.progressPercent,
        started_at: input.status !== "not_started" ? new Date().toISOString() : null,
        completed_at: input.status === "completed" ? new Date().toISOString() : null,
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    )
    .select(
      "id,user_id,lesson_id,product_id,module_id,status,progress_percent,started_at,completed_at,last_accessed_at",
    )
    .single()

  if (error) {
    throw error
  }

  return data as LessonProgressSummary
}

export async function fetchModuleAssets(moduleIds: string[]) {
  if (moduleIds.length === 0) {
    return [] as ModuleAssetSummary[]
  }

  const { data, error } = await supabase
    .from("module_assets")
    .select(
      "id,module_id,asset_type,title,sort_order,storage_bucket,storage_path,storage_provider,external_url,mime_type,file_size_bytes,allow_download,allow_stream,watermark_enabled,status",
    )
    .in("module_id", moduleIds)
    .order("sort_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ModuleAssetSummary[]
}

export async function fetchDashboardProductContent(productId: string) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/student-course-navigation`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: auth.headers.Authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId,
        access_token: auth.accessToken,
      }),
    },
  )

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  const payload = data as {
    success: true
    product: DashboardProductSummary | null
    modules: CourseModuleNavigationSummary[]
    lessons: CourseLessonNavigationSummary[]
    assessments: CourseAssessmentNavigationSummary[]
    progress: StudentCourseNavigationData["progress"]
  }

  return {
    product: payload.product,
    modules: payload.modules ?? [],
    lessons: payload.lessons ?? [],
    assessments: payload.assessments ?? [],
    progress: payload.progress ?? [],
  } satisfies StudentCourseNavigationData
}

export async function requestAssetAccess(assetId: string) {
  const headers = await getFunctionAuthHeaders()
  const { data, error } = await supabase.functions.invoke("generate-asset-access", {
    body: { assetId },
    headers,
  })

  if (error) {
    throw error
  }

  return data as {
    success: true
    mode: "external_url" | "signed_url"
    url: string
    allow_download: boolean
    allow_stream: boolean
    watermark_enabled: boolean
    expires_in_seconds?: number
  }
}

export async function fetchDownloads(): Promise<DownloadableItem[]> {
  const products = await fetchMyProducts()
  const productIds = products.map((product) => product.id)
  const modules = await Promise.all(productIds.map((productId) => fetchProductModules(productId)))
  const flatModules = modules.flat()
  const assets = await fetchModuleAssets(flatModules.map((module) => module.id))
  const moduleMap = new Map(flatModules.map((module) => [module.id, module]))
  const productMap = new Map(products.map((product) => [product.id, product]))

  const assetItems = assets
    .filter((asset) => asset.allow_download)
    .map((asset) => {
      const module = moduleMap.get(asset.module_id)
      const product = module ? productMap.get(module.product_id) : null
      if (!module || !product) return null

      return {
        kind: "asset" as const,
        asset,
        module,
        product,
      }
    })
    .filter((item): item is Extract<DownloadableItem, { kind: "asset" }> => Boolean(item))

  const modulePdfItems = flatModules
    .filter((module) => module.module_pdf_storage_path && module.module_pdf_file_name)
    .map((module) => {
      const product = productMap.get(module.product_id)
      if (!product) return null

      return {
        kind: "module_pdf" as const,
        module,
        product,
      }
    })
    .filter((item): item is Extract<DownloadableItem, { kind: "module_pdf" }> => Boolean(item))

  return [...modulePdfItems, ...assetItems]
}

export async function fetchNotifications(limit?: number, includeArchived = false, userId?: string) {
  const targetUserId = userId ?? (await getCurrentUserId())
  const baseQuery = supabase
    .from("notifications")
    .select("id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })

  const query = includeArchived ? baseQuery : baseQuery.neq("status", "archived")
  const limitedQuery = limit ? query.limit(limit) : query

  const { data, error } = await limitedQuery

  if (error) {
    throw error
  }

  return (data ?? []) as NotificationItem[]
}

export async function fetchPaymentHistory(): Promise<StudentPaymentSummary[]> {
  type PaymentOrderRow = {
    id: string
    product_id: string
    status: StudentPaymentSummary["status"]
    currency: string
    base_price_cents: number
    discount_cents: number
    final_price_cents: number
    payment_provider: string | null
    payment_reference: string | null
    checkout_session_id: string | null
    payment_environment: "test" | "live" | null
    paid_at: string | null
    refunded_at: string | null
    created_at: string
    products: { title: string | null } | Array<{ title: string | null }> | null
  }

  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,product_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id,payment_environment,paid_at,refunded_at,created_at,products:product_id(title)",
    )
    .eq("user_id", userId)
    .in("status", ["paid", "refunded"])
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as PaymentOrderRow[]).map((order) => {
    const product = Array.isArray(order.products) ? order.products[0] : order.products

    return {
      id: order.id,
      product_id: order.product_id,
      product_title: product?.title ?? null,
      status: order.status,
      currency: order.currency,
      base_price_cents: order.base_price_cents,
      discount_cents: order.discount_cents,
      final_price_cents: order.final_price_cents,
      payment_provider: order.payment_provider,
      payment_reference: order.payment_reference,
      checkout_session_id: order.checkout_session_id,
      payment_environment: order.payment_environment,
      paid_at: order.paid_at,
      refunded_at: order.refunded_at,
      created_at: order.created_at,
    } as StudentPaymentSummary
  })
}

async function invokeStudentOrderAction<TResponse>(body: unknown) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/student-order-actions`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(typeof body === "object" && body !== null ? body : {}),
      access_token: auth.accessToken,
    }),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return data as TResponse
}

export function fetchStudentOrderReceiptUrl(orderId: string) {
  return invokeStudentOrderAction<{
    success: true
    receipt_url: string
    payment_intent: string
    charge_id: string
  }>({
    action: "receipt",
    orderId,
  })
}

export function requestStudentOrderRefund(input: { orderId: string; message?: string | null }) {
  return invokeStudentOrderAction<{
    success: true
    replayed?: boolean
    order_id?: string
    ticket?: SupportTicketSummary
  }>({
    action: "request_refund",
    ...input,
  })
}

export async function requestLessonFileAccess(lessonId: string) {
  const headers = await getFunctionAuthHeaders()
  const { data, error } = await supabase.functions.invoke("generate-asset-access", {
    body: { lessonId },
    headers,
  })

  if (error) throw error

  return data as {
    success: true
    mode: "signed_url"
    url: string
    file_name: string | null
    allow_download: boolean
    allow_stream: boolean
    watermark_enabled: boolean
    expires_in_seconds: number
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select("id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")
    .single()

  if (error) {
    throw error
  }

  return data as NotificationItem
}

export async function markAllNotificationsAsRead() {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "archived",
      read_at: new Date().toISOString(),
    })
    .neq("status", "archived")
    .select("id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")

  if (error) {
    throw error
  }

  return (data ?? []) as NotificationItem[]
}

export async function fetchSupportTickets() {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,product_id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_storage_provider,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as SupportTicketSummary[]
}

export async function fetchSupportTicket(ticketId: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,product_id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_storage_provider,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
    .eq("id", ticketId)
    .single()

  if (error) {
    throw error
  }

  return data as SupportTicketSummary
}

export async function fetchSupportTicketMessages(ticketId: string) {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id,ticket_id,sender_user_id,sender_role,message,attachment_bucket,attachment_path,attachment_storage_provider,attachment_name,attachment_mime_type,attachment_size_bytes,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as SupportTicketMessage[]
}

export async function createSupportTicket(input: {
  subject: string
  message: string
  productId?: string | null
  category?: SupportTicketSummary["category"]
  priority?: SupportTicketSummary["priority"]
  attachment?: SupportAttachmentUploadResult | null
}) {
  const headers = await getFunctionAuthHeaders()
  const { data, error } = await supabase.functions.invoke("create-support-ticket", {
    body: input,
    headers,
  })

  if (error) {
    throw error
  }

  return (data as { success: true; ticket: SupportTicketSummary }).ticket
}

export async function replySupportTicket(input: {
  ticketId: string
  message: string
  status?: SupportTicketSummary["status"]
  priority?: SupportTicketSummary["priority"]
  attachment?: SupportAttachmentUploadResult | null
}) {
  const headers = await getFunctionAuthHeaders()
  const { data, error } = await supabase.functions.invoke("support-ticket-reply", {
    body: input,
    headers,
  })

  if (error) {
    throw error
  }

  return data as { success: true; message: SupportTicketMessage }
}

export async function fetchProfilePreferences() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,nif,avatar_url,notifications_enabled,marketing_consent,content_updates_consent,role,status")
    .eq("id", userId)
    .single()

  if (error) {
    throw error
  }

  return data as ProfilePreferences
}

export async function updateProfilePreferences(input: {
  fullName: string
  phone?: string | null
  nif?: string | null
  avatarUrl?: string | null
  notificationsEnabled: boolean
  marketingConsent: boolean
}) {
  const userId = await getCurrentUserId()
  const rawNif = input.nif === undefined ? undefined : String(input.nif ?? "").trim()
  if (rawNif && !isValidNif(rawNif)) {
    throw new Error("Indica um NIF válido.")
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      ...(rawNif !== undefined ? { nif: rawNif ? stripNifDigits(rawNif) : null } : {}),
      ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
      notifications_enabled: input.notificationsEnabled,
      marketing_consent: input.marketingConsent,
    })
    .eq("id", userId)
    .select("id,full_name,email,phone,nif,avatar_url,notifications_enabled,marketing_consent,content_updates_consent,role,status")
    .single()

  if (error) {
    throw error
  }

  return data as ProfilePreferences
}

export async function uploadProfileAvatar(input: {
  file: File
  replacePath?: string | null
}) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  const upload = await uploadStorageFile({
    upload_kind: "profile_avatar",
    file: input.file,
    file_name: input.file.name,
    mime_type: input.file.type || "image/png",
    file_size_bytes: input.file.size,
    replace_path: input.replacePath ?? null,
  })

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/profile-avatar-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucket: upload.bucket,
      path: upload.path,
      storage_provider: upload.storage_provider ?? "r2",
      public_url: upload.public_url ?? null,
      file_name: upload.file_name,
      mime_type: upload.mime_type,
      file_size_bytes: upload.file_size_bytes,
      access_token: auth.accessToken,
    }),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return data as { success: true; avatar: ProfileAvatarUploadResult; profile: ProfilePreferences }
}

export async function updateAccountPassword(input: { password: string }) {
  const password = input.password.trim()
  if (password.length < 8) {
    throw new Error("A nova senha deve ter pelo menos 8 caracteres.")
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    throw error
  }
}
