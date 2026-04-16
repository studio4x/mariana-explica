import {
  assertPaidProduct,
  buildFreeProductClaimedEmail,
  calculateOrderTotals,
  createOrderWithItems,
  ensureActiveGrant,
  extractRequestAuditContext,
  findActiveGrantForProduct,
  getProductByIdentifier,
  queueEmailDelivery,
  writeAuditLog,
} from "../_shared/mod.ts"
import { badRequest, internalError, unprocessable } from "../_shared/errors.ts"
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

    const existingGrant = await findActiveGrantForProduct(context.serviceClient, {
      userId: context.user.id,
      productId: product.id,
    })
    if (existingGrant) {
      throw unprocessable("VocÃª jÃ¡ ativou este produto")
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

    const { data: notification, error: notificationError } = await context.serviceClient
      .from("notifications")
      .insert({
        user_id: context.user.id,
        type: "transactional",
        title: "Produto gratuito ativado",
        message: `O produto "${product.title}" ja esta disponivel no teu dashboard.`,
        link: "/dashboard/produtos",
        status: "unread",
        sent_via_email: Boolean(context.profile.email),
        sent_via_in_app: true,
      })
      .select("id")
      .single()

    if (notificationError) {
      throw notificationError
    }

    if (context.profile.email) {
      const email = buildFreeProductClaimedEmail({
        fullName: context.profile.full_name,
        productTitle: product.title,
        dashboardUrl: "/dashboard/produtos",
      })

      await queueEmailDelivery(context.serviceClient, {
        userId: context.user.id,
        notificationId: notification.id,
        emailTo: context.profile.email,
        templateKey: "free_product_claimed",
        subject: email.subject,
        html: email.html,
        text: email.text,
        metadata: {
          order_id: order.id,
          product_id: product.id,
        },
      })
    }

    logInfo("Free product claimed", {
      request_id: requestId,
      user_id: context.user.id,
      product_id: product.id,
      order_id: order.id,
      grant_id: grant.grant.id,
    })

    await writeAuditLog(
      context.serviceClient,
      context,
      {
        action: "product.free_claimed",
        entityType: "order",
        entityId: order.id,
        metadata: {
          product_id: product.id,
          grant_id: grant.grant.id,
        },
        ...extractRequestAuditContext(req),
      },
    )

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
