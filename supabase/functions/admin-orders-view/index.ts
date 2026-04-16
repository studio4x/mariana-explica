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

    const { data: orders, error } = await context.serviceClient
      .from("orders")
      .select(
        "id,user_id,product_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_reference,checkout_session_id,paid_at,refunded_at,created_at",
      )
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    const userIds = [...new Set((orders ?? []).map((order) => order.user_id))]
    const productIds = [...new Set((orders ?? []).map((order) => order.product_id))]

    const [{ data: users, error: usersError }, { data: products, error: productsError }] = await Promise.all([
      userIds.length
        ? context.serviceClient
            .from("profiles")
            .select("id,full_name,email")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? context.serviceClient
            .from("products")
            .select("id,title")
            .in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (usersError) {
      throw usersError
    }

    if (productsError) {
      throw productsError
    }

    const userMap = new Map((users ?? []).map((user) => [user.id, user]))
    const productMap = new Map((products ?? []).map((product) => [product.id, product]))

    const enrichedOrders = (orders ?? []).map((order) => ({
      ...order,
      user_name: userMap.get(order.user_id)?.full_name ?? null,
      user_email: userMap.get(order.user_id)?.email ?? null,
      product_title: productMap.get(order.product_id)?.title ?? null,
    }))

    return jsonResponse({
      success: true,
      request_id: requestId,
      summary: {
        totalOrders: enrichedOrders.length,
        pendingCount: enrichedOrders.filter((order) => order.status === "pending").length,
        refundedCount: enrichedOrders.filter((order) => order.status === "refunded").length,
      },
      orders: enrichedOrders,
    })
  } catch (error) {
    logError("Admin orders view failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
