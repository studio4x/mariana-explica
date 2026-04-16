import { badRequest } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireAdmin } from "../_shared/mod.ts"

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)

    const [
      usersCount,
      publishedProducts,
      paidOrders,
      recentOrders,
      supportTickets,
      notifications,
      emailDeliveries,
      jobRuns,
    ] = await Promise.all([
      context.serviceClient.from("profiles").select("id", { count: "exact", head: true }),
      context.serviceClient
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      context.serviceClient
        .from("orders")
        .select("final_price_cents", { count: "exact" })
        .eq("status", "paid"),
      context.serviceClient
        .from("orders")
        .select("id,status,currency,final_price_cents,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      context.serviceClient
        .from("support_tickets")
        .select("id,status,priority")
        .order("updated_at", { ascending: false })
        .limit(30),
      context.serviceClient
        .from("notifications")
        .select("id,status")
        .order("created_at", { ascending: false })
        .limit(30),
      context.serviceClient
        .from("email_deliveries")
        .select("id,status")
        .order("created_at", { ascending: false })
        .limit(30),
      context.serviceClient
        .from("job_runs")
        .select("id,status")
        .order("started_at", { ascending: false })
        .limit(30),
    ])

    const errors = [
      usersCount.error,
      publishedProducts.error,
      paidOrders.error,
      recentOrders.error,
      supportTickets.error,
      notifications.error,
      emailDeliveries.error,
      jobRuns.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      throw errors[0]
    }

    const paidOrderRows = paidOrders.data ?? []
    const revenueCents = paidOrderRows.reduce((sum, order) => sum + order.final_price_cents, 0)

    return jsonResponse({
      success: true,
      request_id: requestId,
      metrics: {
        totalUsers: usersCount.count ?? 0,
        totalPublishedProducts: publishedProducts.count ?? 0,
        totalPaidOrders: paidOrders.count ?? 0,
        revenueCents,
      },
      recentOrders: recentOrders.data ?? [],
      alerts: {
        openSupportTickets: (supportTickets.data ?? []).filter((ticket) => ticket.status !== "closed").length,
        highPrioritySupportTickets: (supportTickets.data ?? []).filter((ticket) => ticket.priority === "high").length,
        unreadNotifications: (notifications.data ?? []).filter((notification) => notification.status === "unread")
          .length,
        failedEmails: (emailDeliveries.data ?? []).filter(
          (delivery) => delivery.status === "failed" || delivery.status === "bounced",
        ).length,
        failedJobs: (jobRuns.data ?? []).filter((job) => job.status === "failed").length,
      },
    })
  } catch (error) {
    logError("Admin dashboard action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
