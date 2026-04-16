import { supabase } from "@/integrations/supabase"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"
import type {
  AdminDashboardMetrics,
  AdminOrderSummary,
  AdminSupportTicketSummary,
  AdminUserSummary,
  SupportTicketMessage,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

async function invokeAdminFunction<TResponse>(name: string, body: unknown) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessao expirada")
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`, {
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

export async function fetchAdminUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,full_name,email,role,is_admin,status,phone,last_login_at,created_at,notifications_enabled,marketing_consent",
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminUserSummary[]
}

export async function fetchAdminProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,published_at",
    )
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductSummary[]
}

export async function fetchAdminOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,user_id,product_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_reference,checkout_session_id,paid_at,refunded_at,created_at",
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminOrderSummary[]
}

export async function fetchAdminSupportTickets() {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,user_id,subject,message,status,priority,assigned_admin_id,last_reply_at,created_at,updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminSupportTicketSummary[]
}

export async function fetchAdminSupportTicketMessages(ticketId: string) {
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

export async function fetchAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [users, products, orders] = await Promise.all([
    fetchAdminUsers(),
    fetchAdminProducts(),
    fetchAdminOrders(),
  ])

  return {
    totalUsers: users.length,
    totalPublishedProducts: products.filter((product) => product.status === "published").length,
    totalPaidOrders: orders.filter((order) => order.status === "paid").length,
    revenueCents: orders
      .filter((order) => order.status === "paid")
      .reduce((sum, order) => sum + order.final_price_cents, 0),
  }
}

export function createAdminUser(input: {
  fullName: string
  email: string
  password: string
  role: AdminUserSummary["role"]
}) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "create",
    ...input,
  })
}

export function updateAdminUser(input: {
  userId: string
  fullName?: string
  email?: string
  role?: AdminUserSummary["role"]
  status?: AdminUserSummary["status"]
  notificationsEnabled?: boolean
  marketingConsent?: boolean
}) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "update",
    ...input,
  })
}

export function deleteAdminUser(userId: string) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "delete",
    userId,
  })
}

export function createAdminProduct(input: {
  slug: string
  title: string
  shortDescription?: string | null
  description?: string | null
  productType: ProductSummary["product_type"]
  priceCents: number
  currency?: string
  salesPageEnabled?: boolean
  requiresAuth?: boolean
  isFeatured?: boolean
  allowAffiliate?: boolean
  sortOrder?: number
}) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "create",
    ...input,
  })
}

export function updateAdminProduct(input: {
  productId: string
  slug?: string
  title?: string
  shortDescription?: string | null
  description?: string | null
  productType?: ProductSummary["product_type"]
  status?: ProductSummary["status"]
  priceCents?: number
  currency?: string
  salesPageEnabled?: boolean
  requiresAuth?: boolean
  isFeatured?: boolean
  allowAffiliate?: boolean
  sortOrder?: number
}) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "update",
    ...input,
  })
}

export function publishAdminProduct(productId: string) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "publish",
    productId,
  })
}

export function archiveAdminProduct(productId: string) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "archive",
    productId,
  })
}

export function markAdminOrderPaid(orderId: string, paymentReference?: string | null) {
  return invokeAdminFunction("admin-orders", { action: "mark_paid", orderId, paymentReference })
}

export function markAdminOrderRefunded(orderId: string, reason?: string | null) {
  return invokeAdminFunction("admin-orders", { action: "mark_refunded", orderId, reason })
}

export function markAdminOrderCancelled(orderId: string, reason?: string | null) {
  return invokeAdminFunction("admin-orders", { action: "mark_cancelled", orderId, reason })
}

export function reconcileAdminOrder(orderId: string) {
  return invokeAdminFunction("reconcile-orders", { orderId })
}

export function replyAdminSupportTicket(input: {
  ticketId: string
  message: string
  status?: AdminSupportTicketSummary["status"]
  priority?: AdminSupportTicketSummary["priority"]
}) {
  return invokeAdminFunction<{ success: true; message: SupportTicketMessage }>("support-ticket-reply", input)
}
