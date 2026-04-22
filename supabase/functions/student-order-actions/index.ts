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
  extractRequestAuditContext,
  getStripeCheckoutSession,
  getStripePaymentIntent,
  requireActiveUser,
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
  paid_at: string | null
  refunded_at: string | null
  created_at: string
  products: { title: string | null } | Array<{ title: string | null }> | null
}

const REFUND_WINDOW_DAYS = 7

function getProductTitle(order: StudentOrderRow) {
  const product = Array.isArray(order.products) ? order.products[0] : order.products
  return product?.title ?? "Curso"
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
      "id,user_id,product_id,status,currency,final_price_cents,payment_reference,checkout_session_id,payment_environment,paid_at,refunded_at,created_at,products:product_id(title)",
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
    throw notFound("Fatura Stripe ainda nao disponivel para este pedido.")
  }

  const intent = await getStripePaymentIntent(paymentIntentId, {
    mode: order.payment_environment,
  })
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null

  if (!charge?.receipt_url) {
    throw notFound("Fatura Stripe ainda nao disponivel para este pedido.")
  }

  return {
    receipt_url: charge.receipt_url,
    payment_intent: intent.id,
    charge_id: charge.id,
  }
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

    assertRefundWindow(order)

    const productTitle = getProductTitle(order)
    const message = [
      `Solicitacao de reembolso do pedido ${order.id}.`,
      `Curso: ${productTitle}.`,
      `Valor: ${order.final_price_cents} ${order.currency}.`,
      body.message?.trim() ? `Mensagem do aluno: ${body.message.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const { data: ticket, error: ticketError } = await context.serviceClient
      .from("support_tickets")
      .insert({
        user_id: context.user.id,
        subject: `Solicitacao de reembolso - ${productTitle}`,
        message,
        category: "payment",
        priority: "high",
      })
      .select("id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
      .single()

    if (ticketError) {
      throw ticketError
    }

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
            title: "Solicitacao de reembolso",
            message: `${context.profile.full_name || context.profile.email || "Aluno"} solicitou reembolso de ${productTitle}.`,
            link: `/admin/suporte/${ticket.id}`,
            status: "unread",
            sent_via_email: false,
            sent_via_in_app: true,
          })),
        )

      if (notificationError) {
        throw notificationError
      }
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "student.refund_requested",
      entityType: "order",
      entityId: order.id,
      metadata: {
        ticket_id: ticket.id,
        product_id: order.product_id,
        payment_reference: order.payment_reference,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      ticket,
    })
  } catch (error) {
    logError("Student order action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
