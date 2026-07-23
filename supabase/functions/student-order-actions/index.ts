import { badRequest, forbidden, notFound, unprocessable } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  cancelAffiliateReferralForOrder,
  createStripeRefund,
  getStripeCharge,
  getStripeChargeByPaymentIntent,
  extractRequestAuditContext,
  getStripeCheckoutSession,
  getStripeInvoice,
  getStripePaymentIntent,
  queueFiscalAdjustmentReview,
  revokeActiveGrantForOrder,
  requireActiveUser,
  updateOrderStatus,
  writeAuditLog,
} from "../_shared/mod.ts"

type StudentOrderActionInput =
  | {
      action: "receipt"
      orderId: string
    }
  | {
      action: "request_refund"
      orderId: string
      message?: string | null
    }

type StudentOrderRow = {
  id: string
  user_id: string
  product_id: string
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
  currency: string
  final_price_cents: number
  payment_reference: string | null
  checkout_session_id: string | null
  payment_environment: "test" | "live"
  stripe_invoice_id: string | null
  paid_at: string | null
  refunded_at: string | null
  created_at: string
  products: { title: string | null } | Array<{ title: string | null }> | null
}

const REFUND_WINDOW_DAYS = 7

function getProductTitle(order: StudentOrderRow) {
  const product = Array.isArray(order.products) ? order.products[0] : order.products
  return product?.title ?? "Material"
}

function assertRefundWindow(order: StudentOrderRow) {
  if (order.status !== "paid") {
    throw unprocessable("Este pedido nao esta elegivel para solicitacao de reembolso.")
  }

  const start = order.paid_at ?? order.created_at
  const paidAt = new Date(start).getTime()
  if (!Number.isFinite(paidAt)) {
    throw unprocessable("Nao foi possivel validar a janela de reembolso deste pedido.")
  }

  const expiresAt = paidAt + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000
  if (Date.now() > expiresAt) {
    throw forbidden("A janela de reembolso de 7 dias ja terminou.")
  }
}

async function fetchOwnedOrder(
  serviceClient: Awaited<ReturnType<typeof requireActiveUser>>["serviceClient"],
  userId: string,
  orderId: string,
) {
  const { data, error } = await serviceClient
    .from("orders")
    .select(
      "id,user_id,product_id,status,currency,final_price_cents,payment_reference,checkout_session_id,payment_environment,stripe_invoice_id,paid_at,refunded_at,created_at,products:product_id(title)",
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Pedido nao encontrado.")
  }

  return data as StudentOrderRow
}

async function resolveReceiptUrl(order: StudentOrderRow) {
  if (order.stripe_invoice_id) {
    const invoice = await getStripeInvoice(order.stripe_invoice_id, {
      mode: order.payment_environment,
    })
    const invoiceUrl = invoice.hosted_invoice_url ?? invoice.invoice_pdf
    if (invoiceUrl) {
      return {
        receipt_url: invoiceUrl,
        payment_intent: order.payment_reference ?? "",
        charge_id: "",
      }
    }
  }

  let paymentIntentId = order.payment_reference?.startsWith("pi_")
    ? order.payment_reference
    : null

  if (!paymentIntentId && order.checkout_session_id) {
    const session = await getStripeCheckoutSession(order.checkout_session_id, {
      mode: order.payment_environment,
    })
    paymentIntentId = session.payment_intent
  }

  if (!paymentIntentId) {
    throw notFound("Comprovativo Stripe ainda nao disponivel para este pedido.")
  }

  const intent = await getStripePaymentIntent(paymentIntentId, {
    mode: order.payment_environment,
  })
  let charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null

  if (!charge?.receipt_url && typeof intent.latest_charge === "string") {
    const expandedCharge = await getStripeCharge(intent.latest_charge, {
      mode: order.payment_environment,
    })
    charge = expandedCharge
  }

  if (!charge?.receipt_url) {
    const fallbackCharge = await getStripeChargeByPaymentIntent(intent.id, {
      mode: order.payment_environment,
    })
    if (fallbackCharge?.receipt_url) {
      charge = fallbackCharge
    }
  }

  if (!charge?.receipt_url) {
    throw notFound("Comprovativo Stripe ainda nao disponivel para este pedido.")
  }

  return {
    receipt_url: charge.receipt_url,
    payment_intent: intent.id,
    charge_id: charge.id,
  }
}

async function resolvePaymentIntentId(order: StudentOrderRow) {
  let paymentIntentId = order.payment_reference?.startsWith("pi_")
    ? order.payment_reference
    : null

  if (!paymentIntentId && order.checkout_session_id) {
    const session = await getStripeCheckoutSession(order.checkout_session_id, {
      mode: order.payment_environment,
    })
    paymentIntentId = session.payment_intent
  }

  if (!paymentIntentId) {
    throw notFound("Pagamento Stripe nao encontrado para este pedido.")
  }

  return paymentIntentId
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

    const context = await requireActiveUser(req)
    const body = await readJsonBody<StudentOrderActionInput>(req)

    if (!body.orderId) {
      throw badRequest("orderId e obrigatorio")
    }

    const order = await fetchOwnedOrder(context.serviceClient, context.user.id, body.orderId)

    if (body.action === "receipt") {
      const receipt = await resolveReceiptUrl(order)
      return jsonResponse({
        success: true,
        request_id: requestId,
        order_id: order.id,
        ...receipt,
      })
    }

    if (body.action !== "request_refund") {
      throw badRequest("Acao invalida")
    }

    if (order.status === "refunded") {
      await queueFiscalAdjustmentReview(context.serviceClient, {
        orderId: order.id,
        userId: order.user_id,
        stripeEventId: `student-refund-replay:${order.id}`,
        adjustmentType: "refund_full",
        amountCents: order.final_price_cents,
        currency: order.currency,
      })
      return jsonResponse({
        success: true,
        request_id: requestId,
        replayed: true,
        order_id: order.id,
      })
    }

    assertRefundWindow(order)
    const paymentIntentId = await resolvePaymentIntentId(order)

    const refund = await createStripeRefund(
      {
        paymentIntentId,
        reason: "requested_by_customer",
        metadata: {
          order_id: order.id,
          user_id: context.user.id,
        },
      },
      {
        mode: order.payment_environment,
        idempotencyKey: `student-refund-${order.id}`,
      },
    )

    if (refund.status === "failed" || refund.status === "canceled") {
      throw unprocessable("Nao foi possivel concluir o reembolso no gateway de pagamento.")
    }

    const refundedAt = new Date().toISOString()
    const updatedOrder = await updateOrderStatus(context.serviceClient, {
      orderId: order.id,
      status: "refunded",
      paymentReference: paymentIntentId,
      refundedAt,
    })

    const revokedGrants = await revokeActiveGrantForOrder(context.serviceClient, {
      orderId: updatedOrder.id,
      reason: "Acesso revogado apos reembolso solicitado pelo aluno",
    })

    const cancelledReferrals = await cancelAffiliateReferralForOrder(context.serviceClient, {
      orderId: updatedOrder.id,
    })

    await queueFiscalAdjustmentReview(context.serviceClient, {
      orderId: updatedOrder.id,
      userId: updatedOrder.user_id,
      stripeRefundId: refund.id,
      adjustmentType: refund.amount >= order.final_price_cents ? "refund_full" : "refund_partial",
      amountCents: refund.amount,
      currency: refund.currency ?? order.currency,
    })

    const productTitle = getProductTitle(order)
    const message = [
      `Reembolso solicitado para o pedido ${order.id}.`,
      `Material: ${productTitle}.`,
      `Valor: ${order.final_price_cents} ${order.currency}.`,
      body.message?.trim() ? `Mensagem do aluno: ${body.message.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    let ticket: {
      id: string
      product_id: string | null
      subject: string
      message: string
      status: string
      priority: string
      category: string
      assigned_admin_id: string | null
      last_reply_at: string | null
      first_response_due_at: string | null
      first_response_at: string | null
      sla_status: string | null
      attachment_bucket: string | null
      attachment_path: string | null
      attachment_name: string | null
      attachment_mime_type: string | null
      attachment_size_bytes: number | null
      created_at: string
      updated_at: string
    } | null = null

    try {
      const { data: createdTicket, error: ticketError } = await context.serviceClient
        .from("support_tickets")
        .insert({
          user_id: context.user.id,
          subject: `Reembolso processado - ${productTitle}`,
          message,
          category: "payment",
          priority: "high",
        })
        .select("id,product_id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
        .single()

      if (ticketError) {
        throw ticketError
      }

      ticket = createdTicket

      const { data: admins, error: adminsError } = await context.serviceClient
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_admin", true)
        .eq("status", "active")

      if (adminsError) {
        throw adminsError
      }

      if ((admins ?? []).length > 0) {
        const { error: notificationError } = await context.serviceClient
          .from("notifications")
          .insert(
            (admins ?? []).map((admin) => ({
              user_id: admin.id,
              type: "transactional",
              title: "Reembolso processado",
              message: `${context.profile.full_name || context.profile.email || "Aluno"} recebeu reembolso de ${productTitle}.`,
              link: `/admin/suporte/${createdTicket.id}`,
              status: "unread",
              sent_via_email: false,
              sent_via_in_app: true,
            })),
          )

        if (notificationError) {
          throw notificationError
        }
      }
    } catch (ticketWorkflowError) {
      logError("Refund support notification workflow failed", {
        request_id: requestId,
        order_id: order.id,
        error: String(ticketWorkflowError),
      })
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "student.refund_processed",
      entityType: "order",
      entityId: order.id,
      metadata: {
        ticket_id: ticket?.id ?? null,
        product_id: order.product_id,
        payment_reference: paymentIntentId,
        stripe_refund_id: refund.id,
        refund_status: refund.status,
        revoked_grant_ids: revokedGrants.map((grant) => grant.id),
        cancelled_referral_ids: cancelledReferrals.map((referral) => referral.id),
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      order: updatedOrder,
      revoked_grants: revokedGrants,
      cancelled_referrals: cancelledReferrals,
      stripe_refund: refund,
      ticket,
    })
  } catch (error) {
    logError("Student order action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
