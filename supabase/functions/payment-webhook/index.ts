import {
  calculateAffiliateCommission,
  ensureActiveGrant,
  extractRequestAuditContext,
  findOrderForCheckoutSession,
  markOrderFailed,
  recordAffiliateReferral,
  recordCouponUsage,
  updateOrderAfterPayment,
  writeAuditLog,
} from "../_shared/mod.ts"
import { badRequest, conflict, internalError, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { verifyStripeWebhookSignature } from "../_shared/payments.ts"

interface StripeEvent {
  id: string
  type: string
  data: {
    object: {
      id: string
      status?: string
      payment_status?: string
      amount_total?: number | null
      currency?: string | null
      payment_intent?: string | null
      client_reference_id?: string | null
      metadata?: Record<string, string | undefined>
    }
  }
}

async function findOrderByReferenceOrSession(
  client: ReturnType<typeof createServiceClient>,
  sessionId: string,
  reference?: string | null,
) {
  try {
    return await findOrderForCheckoutSession(client, sessionId)
  } catch {
    if (!reference) {
      throw notFound("Pedido não encontrado")
    }

    const { data, error } = await client
      .from("orders")
      .select(
        "id,user_id,product_id,coupon_id,affiliate_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id",
      )
      .eq("id", reference)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw notFound("Pedido não encontrado")
    }

    return data
  }
}

async function handleCheckoutCompleted(event: StripeEvent, requestId: string, req: Request) {
  const session = event.data.object
  const client = createServiceClient()
  const order = await findOrderByReferenceOrSession(
    client,
    session.id,
    session.metadata?.order_id ?? session.client_reference_id,
  )

  if (order.status === "paid") {
    return { replayed: true, order_id: order.id }
  }

  if (session.amount_total !== undefined && session.amount_total !== null) {
    if (session.amount_total !== order.final_price_cents) {
      throw conflict("Total recebido da Stripe diverge do pedido interno")
    }
  }

  if (session.currency && session.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw conflict("Moeda recebida da Stripe diverge do pedido interno")
  }

  const paidAt = new Date().toISOString()
  const paymentReference = session.payment_intent ?? session.id
  const paidOrder = await updateOrderAfterPayment(client, {
    orderId: order.id,
    paymentReference,
    paidAt,
  })

  const grant = await ensureActiveGrant(client, {
    userId: paidOrder.user_id,
    productId: paidOrder.product_id,
    sourceType: "purchase",
    sourceOrderId: paidOrder.id,
  })

  if (paidOrder.coupon_id) {
    await recordCouponUsage(client, {
      couponId: paidOrder.coupon_id,
      userId: paidOrder.user_id,
      orderId: paidOrder.id,
      discountCents: paidOrder.discount_cents,
    })
  }

  if (paidOrder.affiliate_id) {
    const { data: affiliate, error } = await client
      .from("affiliates")
      .select("id,user_id,affiliate_code,status,commission_type,commission_value")
      .eq("id", paidOrder.affiliate_id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (affiliate && affiliate.status === "active") {
      await recordAffiliateReferral(client, {
        affiliateId: affiliate.id,
        userId: paidOrder.user_id,
        productId: paidOrder.product_id,
        orderId: paidOrder.id,
        referralCode: affiliate.affiliate_code,
        commissionCents: calculateAffiliateCommission(affiliate, paidOrder.final_price_cents),
      })
    }
  }

  await client.from("notifications").insert({
    user_id: paidOrder.user_id,
    type: "transactional",
    title: "Pagamento confirmado",
    message: "Seu acesso foi liberado com sucesso.",
    link: "/dashboard",
    status: "unread",
    sent_via_email: false,
    sent_via_in_app: true,
  })

  logInfo("Payment confirmed", {
    request_id: requestId,
    order_id: paidOrder.id,
    user_id: paidOrder.user_id,
    grant_id: grant.grant.id,
  })

  await writeAuditLog(
    client,
    null,
    {
      action: "payment.confirmed",
      entityType: "order",
      entityId: paidOrder.id,
      metadata: {
        grant_id: grant.grant.id,
        payment_reference: paymentReference,
        stripe_event_id: event.id,
      },
      ...extractRequestAuditContext(req),
    },
  )

  return { replayed: false, order_id: paidOrder.id, grant_id: grant.grant.id }
}

async function handleCheckoutFailed(event: StripeEvent, req: Request) {
  const session = event.data.object
  const client = createServiceClient()
  const order = await findOrderByReferenceOrSession(
    client,
    session.id,
    session.metadata?.order_id ?? session.client_reference_id,
  )

  const failedOrder = await markOrderFailed(client, {
    orderId: order.id,
    paymentReference: session.payment_intent ?? session.id,
  })

  await writeAuditLog(
    client,
    null,
    {
      action: "payment.failed",
      entityType: "order",
      entityId: failedOrder.id,
      metadata: {
        stripe_event_id: event.id,
        payment_reference: session.payment_intent ?? session.id,
      },
      ...extractRequestAuditContext(req),
    },
  )

  return { order_id: failedOrder.id }
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

    const rawBody = await req.text()
    await verifyStripeWebhookSignature(rawBody, req.headers.get("stripe-signature"))
    const event = JSON.parse(rawBody) as StripeEvent

    if (event.type === "checkout.session.completed") {
      const result = await handleCheckoutCompleted(event, requestId, req)
      return jsonResponse({ success: true, request_id: requestId, event_type: event.type, ...result })
    }

    if (event.type === "checkout.session.expired") {
      const result = await handleCheckoutFailed(event, req)
      return jsonResponse({ success: true, request_id: requestId, event_type: event.type, ...result })
    }

    logInfo("Webhook ignored", { request_id: requestId, event_type: event.type })
    return jsonResponse({ success: true, request_id: requestId, ignored: true, event_type: event.type })
  } catch (error) {
    logError("Webhook failed", { request_id: requestId, error: String(error) })

    if (error instanceof Error && error.message.includes("STRIPE_WEBHOOK_SECRET")) {
      return errorResponse(internalError("Webhook Stripe não configurado"), requestId)
    }

    return errorResponse(error, requestId)
  }
})
