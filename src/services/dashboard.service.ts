import { supabase } from "@/integrations/supabase"
import { getFunctionAuthHeaders } from "@/services/supabase-auth"
import type {
  AccessGrantSummary,
  DashboardOverviewData,
  DashboardProductSummary,
  ModuleAssetSummary,
  NotificationItem,
  ProductModuleSummary,
  ProfilePreferences,
  SupportTicketMessage,
  SupportTicketSummary,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

async function fetchProductsByIds(productIds: string[]) {
  if (productIds.length === 0) {
    return [] as ProductSummary[]
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,published_at",
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
    .select("id,product_id,title,description,module_type,access_type,sort_order,is_preview,status")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductModuleSummary[]
}

async function fetchUnreadNotificationsCount() {
  const response = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread")

  const error = "error" in response ? response.error : null
  if (error) {
    throw error
  }

  const rawCount = "count" in response ? response.count : 0
  return Number(rawCount ?? 0)
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
  const grants = await fetchMyAccessGrants()
  const productIds = grants.map((grant) => grant.product_id)
  const [products, modules] = await Promise.all([
    fetchProductsByIds(productIds),
    fetchModulesByProductIds(productIds),
  ])
  const assets = await fetchModuleAssets(modules.map((module) => module.id))
  const productMap = new Map(products.map((product) => [product.id, product]))
  const modulesByProduct = new Map<string, ProductModuleSummary[]>()
  const assetsByModule = new Map<string, ModuleAssetSummary[]>()

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

  return grants
    .map((grant) => {
      const product = productMap.get(grant.product_id)
      if (!product) return null

      const productModules = modulesByProduct.get(product.id) ?? []
      const productAssets = productModules.flatMap((module) => assetsByModule.get(module.id) ?? [])

      return {
        ...product,
        grant_id: grant.id,
        granted_at: grant.granted_at,
        expires_at: grant.expires_at,
        module_count: productModules.length,
        asset_count: productAssets.length,
        preview_count: productModules.filter((module) => module.is_preview).length,
        download_count: productAssets.filter((asset) => asset.allow_download).length,
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
    .select("id,product_id,title,description,module_type,access_type,sort_order,is_preview,status")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductModuleSummary[]
}

export async function fetchModuleAssets(moduleIds: string[]) {
  if (moduleIds.length === 0) {
    return [] as ModuleAssetSummary[]
  }

  const { data, error } = await supabase
    .from("module_assets")
    .select(
      "id,module_id,asset_type,title,storage_bucket,storage_path,external_url,mime_type,file_size_bytes,allow_download,allow_stream,watermark_enabled,status",
    )
    .in("module_id", moduleIds)

  if (error) {
    throw error
  }

  return (data ?? []) as ModuleAssetSummary[]
}

export async function fetchDashboardProductContent(productId: string) {
  const products = await fetchMyProducts()
  const product = products.find((entry) => entry.id === productId) ?? null

  if (!product) {
    return { product: null, modules: [], assets: [] }
  }

  const modules = await fetchProductModules(productId)
  const assets = await fetchModuleAssets(modules.map((module) => module.id))

  return { product, modules, assets }
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

export async function fetchDownloads() {
  const products = await fetchMyProducts()
  const productIds = products.map((product) => product.id)
  const modules = await Promise.all(productIds.map((productId) => fetchProductModules(productId)))
  const flatModules = modules.flat()
  const assets = await fetchModuleAssets(flatModules.map((module) => module.id))
  const moduleMap = new Map(flatModules.map((module) => [module.id, module]))
  const productMap = new Map(products.map((product) => [product.id, product]))

  return assets
    .filter((asset) => asset.allow_download)
    .map((asset) => {
      const module = moduleMap.get(asset.module_id)
      const product = module ? productMap.get(module.product_id) : null
      return {
        asset,
        module,
        product,
      }
    })
    .filter((item) => Boolean(item.module && item.product))
}

export async function fetchNotifications(limit?: number) {
  let query = supabase
    .from("notifications")
    .select("id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")
    .order("created_at", { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as NotificationItem[]
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

export async function fetchSupportTickets() {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,subject,message,status,priority,assigned_admin_id,last_reply_at,created_at,updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as SupportTicketSummary[]
}

export async function fetchSupportTicketMessages(ticketId: string) {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id,ticket_id,sender_user_id,sender_role,message,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as SupportTicketMessage[]
}

export async function createSupportTicket(input: { subject: string; message: string }) {
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,avatar_url,notifications_enabled,marketing_consent,role,status")
    .single()

  if (error) {
    throw error
  }

  return data as ProfilePreferences
}

export async function updateProfilePreferences(input: {
  fullName: string
  phone?: string | null
  notificationsEnabled: boolean
  marketingConsent: boolean
}) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      notifications_enabled: input.notificationsEnabled,
      marketing_consent: input.marketingConsent,
    })
    .select("id,full_name,email,phone,avatar_url,notifications_enabled,marketing_consent,role,status")
    .single()

  if (error) {
    throw error
  }

  return data as ProfilePreferences
}
