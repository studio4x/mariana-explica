import { badRequest } from "../_shared/errors.ts"
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
  requireAdmin,
  revokeActiveGrantForOrder,
  updateOrderStatus,
  writeAuditLog,
} from "../_shared/mod.ts"

type AdminOrdersInput =
  | { action: "mark_paid"; orderId: string; paymentReference?: string | null }
  | { action: "mark_refunded"; orderId: string; reason?: string | null }
  | { action: "mark_cancelled"; orderId: string; reason?: string | null }

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
    const body = await readJsonBody<AdminOrdersInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    const { data: order, error: orderError } = await context.serviceClient
      .from("orders")
      .select("id,user_id,product_id,status,payment_reference")
      .eq("id", body.orderId)
      .single()

    if (orderError) {
      throw orderError
    }

    if (body.action === "mark_paid") {
      const updatedOrder = await updateOrderStatus(context.serviceClient, {
        orderId: body.orderId,
        status: "paid",
        paymentReference: body.paymentReference ?? order.payment_reference,
        paidAt: new Date().toISOString(),
      })

      const grant = await ensureActiveGrant(context.serviceClient, {
        userId: updatedOrder.user_id,
        productId: updatedOrder.product_id,
        sourceType: "manual_adjustment",
        sourceOrderId: updatedOrder.id,
        notes: "Acesso liberado manualmente pelo admin",
      })

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.order_mark_paid",
        entityType: "order",
        entityId: updatedOrder.id,
        metadata: {
          payment_reference: updatedOrder.payment_reference,
          grant_id: grant.grant.id,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, order: updatedOrder, grant: grant.grant })
    }

    const targetStatus = body.action === "mark_refunded" ? "refunded" : "cancelled"
    const updatedOrder = await updateOrderStatus(context.serviceClient, {
      orderId: body.orderId,
      status: targetStatus,
      refundedAt: targetStatus === "refunded" ? new Date().toISOString() : null,
    })

    const revokedGrants = await revokeActiveGrantForOrder(context.serviceClient, {
      orderId: updatedOrder.id,
      reason:
        "reason" in body && body.reason
          ? body.reason
          : `Acesso revogado apÃ³s pedido ${targetStatus}`,
    })

    await writeAuditLog(context.serviceClient, context, {
      action: `admin.order_${targetStatus}`,
      entityType: "order",
      entityId: updatedOrder.id,
      metadata: {
        revoked_grant_ids: revokedGrants.map((grant) => grant.id),
      },
      ...auditMeta,
    })

    return jsonResponse({ success: true, request_id: requestId, order: updatedOrder, revoked_grants: revokedGrants })
  } catch (error) {
    logError("Admin orders action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
