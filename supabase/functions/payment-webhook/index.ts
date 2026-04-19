import {
  buildPurchaseConfirmedEmail,
  calculateAffiliateCommission,
  cancelAffiliateReferralForOrder,
  ensureActiveGrant,
  extractRequestAuditContext,
  findOrderForCheckoutSession,
  getStripeCharge,
  markOrderFailed,
  queueEmailDelivery,
  recordAffiliateReferral,
  recordCouponUsage,
  revokeActiveGrantForOrder,
  updateOrderAfterPayment,
  updateOrderStatus,
  writeAuditLog,
} from "../_shared/mod.ts"
import { badRequest, conflict, internalError, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { verifyStripeWebhookSignature } from "../_shared/payments.ts"

interface StripeEventObject {
  id: string
  livemode?: boolean
  status?: string
  payment_status?: string
  amount_total?: number | null
  currency?: string | null
  payment_intent?: string | null
  client_reference_id?: string | null
  metadata?: Record<string, string | undefined>
  refunded?: boolean
  amount?: number | null
  amount_refunded?: number | null
  charge?: string | null
  reason?: string | null
}

interface StripeEvent {
  id: string
  type: string
  data: {
    object: StripeEventObject
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
      throw notFound("Pedido nao encontrado")
    }

    const { data, error } = await client
      .from("orders")
      .select(
        "id,user_id,product_id,coupon_id,affiliate_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id,payment_environment",
      )
      .eq("id", reference)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw notFound("Pedido nao encontrado")
    }

    return data
  }
}

async function findOrderByPaymentReference(
  client: ReturnType<typeof createServiceClient>,
  paymentReference: string,
) {
  const { data, error } = await client
    .from("orders")
    .select(
      "id,user_id,product_id,coupon_id,affiliate_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id,payment_environment",
    )
    .eq("payment_reference", paymentReference)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Pedido nao encontrado para a referencia de pagamento")
  }

  return data
}

function assertMatchingEnvironment(
  order: { payment_environment: "test" | "live" | null | undefined },
  livemode?: boolean,
) {
  const expectedEnv = livemode ? "live" : "test"
  if (order.payment_environment && order.payment_environment !== expectedEnv) {
    throw conflict("Evento Stripe recebido de ambiente diferente do pedido interno")
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

  assertMatchingEnvironment(order, session.livemode)

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

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,full_name,email")
    .eq("id", paidOrder.user_id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  const { data: product, error: productError } = await client
    .from("products")
    .select("title")
    .eq("id", paidOrder.product_id)
    .maybeSingle()

  if (productError) {
    throw productError
  }

  const { data: notification, error: notificationError } = await client
    .from("notifications")
    .insert({
      user_id: paidOrder.user_id,
      type: "transactional",
      title: "Pagamento confirmado",
      message: "O teu acesso foi liberado com sucesso.",
      link: "/dashboard",
      status: "unread",
      sent_via_email: Boolean(profile?.email),
      sent_via_in_app: true,
    })
    .select("id")
    .single()

  if (notificationError) {
    throw notificationError
  }

  if (profile?.email) {
    const email = buildPurchaseConfirmedEmail({
      fullName: profile.full_name,
      productTitle: product?.title ?? "o teu produto",
      dashboardUrl: "/dashboard",
    })

    await queueEmailDelivery(client, {
      userId: paidOrder.user_id,
      notificationId: notification.id,
      emailTo: profile.email,
      templateKey: "purchase_confirmed",
      subject: email.subject,
      html: email.html,
      text: email.text,
      metadata: {
        order_id: paidOrder.id,
        product_id: paidOrder.product_id,
      },
    })
  }

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

  assertMatchingEnvironment(order, session.livemode)

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

async function handleOrderRevocation(params: {
  event: StripeEvent
  req: Request
  paymentReference: string
  livemode?: boolean
  reason: string
  action: "payment.refunded" | "payment.chargeback"
  eventCategory: "refund" | "chargeback"
}) {
  const client = createServiceClient()
  const order = await findOrderByPaymentReference(client, params.paymentReference)

  assertMatchingEnvironment(order, params.livemode)

  if (order.status === "refunded") {
    return { replayed: true, order_id: order.id, revoked_grants: 0, cancelled_referrals: 0 }
  }

  const refundedOrder = await updateOrderStatus(client, {
    orderId: order.id,
    status: "refunded",
    paymentReference: params.paymentReference,
    refundedAt: new Date().toISOString(),
  })

  const revokedGrants = await revokeActiveGrantForOrder(client, {
    orderId: refundedOrder.id,
    reason: params.reason,
  })

  const cancelledReferrals = await cancelAffiliateReferralForOrder(client, {
    orderId: refundedOrder.id,
  })

  await writeAuditLog(
    client,
    null,
    {
      action: params.action,
      entityType: "order",
      entityId: refundedOrder.id,
      metadata: {
        stripe_event_id: params.event.id,
        payment_reference: params.paymentReference,
        reason: params.reason,
        revoked_grant_ids: revokedGrants.map((grant) => grant.id),
        cancelled_referral_ids: cancelledReferrals.map((referral) => referral.id),
        event_category: params.eventCategory,
      },
      ...extractRequestAuditContext(params.req),
    },
  )

  logInfo("Payment access revoked", {
    order_id: refundedOrder.id,
    payment_reference: params.paymentReference,
    event_type: params.event.type,
    event_category: params.eventCategory,
    revoked_grants: revokedGrants.length,
    cancelled_referrals: cancelledReferrals.length,
  })

  return {
    replayed: false,
    order_id: refundedOrder.id,
    revoked_grants: revokedGrants.length,
    cancelled_referrals: cancelledReferrals.length,
  }
}

async function handleChargeRefunded(event: StripeEvent, req: Request) {
  const charge = event.data.object

  const isFullyRefunded =
    charge.refunded === true ||
    (typeof charge.amount === "number" &&
      typeof charge.amount_refunded === "number" &&
      charge.amount > 0 &&
      charge.amount_refunded >= charge.amount)

  if (!isFullyRefunded || !charge.payment_intent) {
    return {
      ignored: true,
      reason: !isFullyRefunded ? "partial_refund" : "missing_payment_intent",
    }
  }

  return await handleOrderRevocation({
    event,
    req,
    paymentReference: charge.payment_intent,
    livemode: charge.livemode,
    reason: "Acesso revogado automaticamente apos refund confirmado pela Stripe",
    action: "payment.refunded",
    eventCategory: "refund",
  })
}

async function handleChargeDispute(event: StripeEvent, req: Request) {
  const dispute = event.data.object
  let paymentReference = dispute.payment_intent ?? null

  if (!paymentReference && dispute.charge) {
    const charge = await getStripeCharge(dispute.charge, {
      mode: dispute.livemode ? "live" : "test",
    })
    paymentReference = charge.payment_intent
  }

  if (!paymentReference) {
    return { ignored: true, reason: "missing_payment_intent" }
  }

  return await handleOrderRevocation({
    event,
    req,
    paymentReference,
    livemode: dispute.livemode,
    reason: "Acesso revogado automaticamente apos chargeback/disputa Stripe",
    action: "payment.chargeback",
    eventCategory: "chargeback",
  })
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

    if (event.type === "charge.refunded") {
      const result = await handleChargeRefunded(event, req)
      return jsonResponse({ success: true, request_id: requestId, event_type: event.type, ...result })
    }

    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.funds_withdrawn") {
      const result = await handleChargeDispute(event, req)
      return jsonResponse({ success: true, request_id: requestId, event_type: event.type, ...result })
    }

    logInfo("Webhook ignored", { request_id: requestId, event_type: event.type })
    return jsonResponse({ success: true, request_id: requestId, ignored: true, event_type: event.type })
  } catch (error) {
    logError("Webhook failed", { request_id: requestId, error: String(error) })

    if (error instanceof Error && error.message.includes("STRIPE_WEBHOOK_SECRET")) {
      return errorResponse(internalError("Webhook Stripe nao configurado"), requestId)
    }

    return errorResponse(error, requestId)
  }
})
