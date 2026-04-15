import {
  assertPaidProduct,
  calculateOrderTotals,
  createOrderWithItems,
  ensureActiveGrant,
  getProductByIdentifier,
} from "../_shared/mod.ts"
import { badRequest, internalError } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/auth.ts"

interface ClaimFreeProductInput {
  productId?: string
  productSlug?: string
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Método não suportado")
    }

    const context = await requireActiveUser(req)
    const body = await readJsonBody<ClaimFreeProductInput>(req)
    const identifier = body.productId ?? body.productSlug

    if (!identifier) {
      throw badRequest("Informe productId ou productSlug")
    }

    const product = await getProductByIdentifier(context.serviceClient, identifier)
    assertPaidProduct(product)

    if (product.product_type !== "free") {
      throw badRequest("Somente produtos gratuitos podem ser reivindicados aqui")
    }

    const totals = calculateOrderTotals(product.price_cents, 0)
    const order = await createOrderWithItems(context.serviceClient, {
      userId: context.user.id,
      product,
      totals,
      paymentProvider: "internal",
      paymentReference: `free:${crypto.randomUUID()}`,
      status: "paid",
      paidAt: new Date().toISOString(),
    })

    const grant = await ensureActiveGrant(context.serviceClient, {
      userId: context.user.id,
      productId: product.id,
      sourceType: "free_claim",
      sourceOrderId: order.id,
    })

    logInfo("Free product claimed", {
      request_id: requestId,
      user_id: context.user.id,
      product_id: product.id,
      order_id: order.id,
      grant_id: grant.grant.id,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      order_id: order.id,
      grant_id: grant.grant.id,
      mode: "free_claim",
    })
  } catch (error) {
    logError("Free product claim failed", { request_id: requestId, error: String(error) })

    if (error instanceof Error && error.message.includes("STRIPE_SECRET_KEY")) {
      return errorResponse(internalError("Integração Stripe não configurada"), requestId)
    }

    return errorResponse(error, requestId)
  }
})

