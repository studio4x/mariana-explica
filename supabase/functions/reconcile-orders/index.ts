import { badRequest, conflict } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  ensureActiveGrant,
  extractRequestAuditContext,
  getStripeCheckoutSession,
  requireAdmin,
  revokeActiveGrantForOrder,
  updateOrderStatus,
  writeAuditLog,
} from "../_shared/mod.ts"

interface ReconcileOrdersInput {
  orderId: string
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("MÃ©todo nÃ£o suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<ReconcileOrdersInput>(req)
    if (!body.orderId) {
      throw badRequest("orderId Ã© obrigatÃ³rio")
    }

    const { data: order, error } = await context.serviceClient
      .from("orders")
      .select(
        "id,user_id,product_id,status,currency,final_price_cents,checkout_session_id,payment_reference,paid_at,refunded_at",
      )
      .eq("id", body.orderId)
      .single()

    if (error) {
      throw error
    }

    if (!order.checkout_session_id) {
      throw badRequest("Pedido sem checkout_session_id para reconciliaÃ§Ã£o")
    }

    const session = await getStripeCheckoutSession(order.checkout_session_id)
    if (
      session.amount_total !== null &&
      session.amount_total !== undefined &&
      session.amount_total !== order.final_price_cents
    ) {
      throw conflict("Total externo diverge do pedido interno")
    }

    if (session.currency && session.currency.toUpperCase() !== order.currency.toUpperCase()) {
      throw conflict("Moeda externa diverge do pedido interno")
    }

    let updatedOrder = order
    let grants: unknown[] = []

    if (session.payment_status === "paid" && session.status === "complete") {
      updatedOrder = await updateOrderStatus(context.serviceClient, {
        orderId: order.id,
        status: "paid",
        paymentReference: session.payment_intent ?? session.id,
        paidAt: order.paid_at ?? new Date().toISOString(),
      })

      const grant = await ensureActiveGrant(context.serviceClient, {
        userId: order.user_id,
        productId: order.product_id,
        sourceType: "purchase",
        sourceOrderId: order.id,
      })
      grants = [grant.grant]
    } else if (session.status === "expired") {
      updatedOrder = await updateOrderStatus(context.serviceClient, {
        orderId: order.id,
        status: "failed",
        paymentReference: session.payment_intent ?? session.id,
      })
      grants = await revokeActiveGrantForOrder(context.serviceClient, {
        orderId: order.id,
        reason: "Acesso revogado durante reconciliaÃ§Ã£o de pedido expirado",
      })
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.order_reconciled",
      entityType: "order",
      entityId: order.id,
      metadata: {
        checkout_session_id: order.checkout_session_id,
        stripe_status: session.status,
        stripe_payment_status: session.payment_status,
        resulting_status: updatedOrder.status,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      order: updatedOrder,
      grants,
      stripe: session,
    })
  } catch (error) {
    logError("Order reconciliation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
