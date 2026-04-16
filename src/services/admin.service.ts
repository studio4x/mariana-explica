import { supabase } from "@/integrations/supabase"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"
import type {
  AdminAffiliateReferralSummary,
  AdminAffiliateSummary,
  AdminDashboardOverview,
  AdminDashboardMetrics,
  AdminEmailDeliverySummary,
  AdminJobRunSummary,
  AdminNotificationSummary,
  AdminOperationsOverview,
  AdminOrderViewSummary,
  AdminOrderSummary,
  AdminCouponSummary,
  AdminCouponUsageSummary,
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
  const response = await invokeAdminFunction<{ success: true; users: AdminUserSummary[] }>("admin-users", {
    action: "list",
  })
  return response.users ?? []
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

export async function fetchAdminOrdersView() {
  const response = await invokeAdminFunction<{
    success: true
    summary: {
      totalOrders: number
      pendingCount: number
      refundedCount: number
    }
    orders: AdminOrderViewSummary[]
  }>("admin-orders-view", {
    action: "list",
  })

  return {
    summary: response.summary,
    orders: response.orders ?? [],
  }
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

export async function fetchAdminNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminNotificationSummary[]
}

export async function fetchAdminAffiliates() {
  const { data, error } = await supabase
    .from("affiliates")
    .select("id,user_id,affiliate_code,status,commission_type,commission_value,created_at,updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminAffiliateSummary[]
}

export async function fetchAdminAffiliateReferrals() {
  const { data, error } = await supabase
    .from("affiliate_referrals")
    .select("id,affiliate_id,user_id,product_id,order_id,referral_code,status,commission_cents,tracked_at,converted_at,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminAffiliateReferralSummary[]
}

export async function fetchAdminCoupons() {
  const { data, error } = await supabase
    .from("coupons")
    .select("id,code,title,discount_type,discount_value,status,starts_at,expires_at,max_uses,max_uses_per_user,current_uses,minimum_order_cents,created_at,updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminCouponSummary[]
}

export async function fetchAdminCouponUsages() {
  const { data, error } = await supabase
    .from("coupon_usages")
    .select("id,coupon_id,user_id,order_id,discount_cents,used_at")
    .order("used_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminCouponUsageSummary[]
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

export async function fetchAdminOperations(): Promise<AdminOperationsOverview> {
  const response = await invokeAdminFunction<{
    success: true
    summary: {
      queuedEmails: number
      failedEmails: number
      failedJobs: number
      deliveredEmails: number
    }
    emailDeliveries: AdminEmailDeliverySummary[]
    jobRuns: AdminJobRunSummary[]
  }>("admin-operations", {
    action: "list",
  })

  return {
    queuedEmails: response.summary.queuedEmails,
    failedEmails: response.summary.failedEmails,
    failedJobs: response.summary.failedJobs,
    deliveredEmails: response.summary.deliveredEmails,
    emailDeliveries: response.emailDeliveries ?? [],
    jobRuns: response.jobRuns ?? [],
  }
}

export async function fetchAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const response = await invokeAdminFunction<{
    success: true
    metrics: AdminDashboardMetrics
    recentOrders: AdminDashboardOverview["recentOrders"]
    alerts: AdminDashboardOverview["alerts"]
  }>("admin-dashboard", {
    action: "overview",
  })

  return {
    metrics: response.metrics,
    recentOrders: response.recentOrders ?? [],
    alerts: response.alerts,
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

export function retryAdminEmailDelivery(emailDeliveryId: string) {
  return invokeAdminFunction<{
    success: true
    emailDelivery: AdminEmailDeliverySummary
  }>("admin-operations", {
    action: "retry_email",
    emailDeliveryId,
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

export function createAdminNotification(input: {
  audience: "single" | "role" | "all"
  userId?: string
  role?: AdminUserSummary["role"]
  status?: AdminUserSummary["status"]
  type: AdminNotificationSummary["type"]
  title: string
  message: string
  link?: string | null
  sentViaEmail?: boolean
  sentViaInApp?: boolean
}) {
  return invokeAdminFunction<{ success: true; inserted_count: number }>("admin-notifications", input)
}

export function createAdminAffiliate(input: {
  userId: string
  affiliateCode: string
  commissionType: AdminAffiliateSummary["commission_type"]
  commissionValue: number
  status?: AdminAffiliateSummary["status"]
}) {
  return invokeAdminFunction<{ success: true; affiliate: AdminAffiliateSummary }>("admin-affiliates", {
    action: "create",
    ...input,
  })
}

export function updateAdminAffiliate(input: {
  affiliateId: string
  affiliateCode?: string
  commissionType?: AdminAffiliateSummary["commission_type"]
  commissionValue?: number
  status?: AdminAffiliateSummary["status"]
}) {
  return invokeAdminFunction<{ success: true; affiliate: AdminAffiliateSummary }>("admin-affiliates", {
    action: "update",
    ...input,
  })
}

export function createAdminCoupon(input: {
  code: string
  title?: string | null
  discountType: AdminCouponSummary["discount_type"]
  discountValue: number
  status?: AdminCouponSummary["status"]
  startsAt?: string | null
  expiresAt?: string | null
  maxUses?: number | null
  maxUsesPerUser?: number | null
  minimumOrderCents?: number | null
}) {
  return invokeAdminFunction<{ success: true; coupon: AdminCouponSummary }>("admin-coupons", {
    action: "create",
    ...input,
  })
}

export function updateAdminCoupon(input: {
  couponId: string
  code?: string
  title?: string | null
  discountType?: AdminCouponSummary["discount_type"]
  discountValue?: number
  status?: AdminCouponSummary["status"]
  startsAt?: string | null
  expiresAt?: string | null
  maxUses?: number | null
  maxUsesPerUser?: number | null
  minimumOrderCents?: number | null
}) {
  return invokeAdminFunction<{ success: true; coupon: AdminCouponSummary }>("admin-coupons", {
    action: "update",
    ...input,
  })
}
