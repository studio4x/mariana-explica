import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  findReconcilableOrder,
  reconcileOrderWithStripe,
  requireAdmin,
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
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<ReconcileOrdersInput>(req)
    if (!body.orderId) {
      throw badRequest("orderId e obrigatorio")
    }

    const order = await findReconcilableOrder(context.serviceClient, body.orderId)
    const result = await reconcileOrderWithStripe(context.serviceClient, order)

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.order_reconciled",
      entityType: "order",
      entityId: order.id,
      metadata: {
        checkout_session_id: order.checkout_session_id,
        stripe_status: result.stripe.status,
        stripe_payment_status: result.stripe.payment_status,
        resulting_status: result.order.status,
        reconciliation_action: result.action,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      order: result.order,
      grants: result.grants,
      stripe: result.stripe,
      action: result.action,
    })
  } catch (error) {
    logError("Order reconciliation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
