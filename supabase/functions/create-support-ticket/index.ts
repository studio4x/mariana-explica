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
  buildSupportTicketCreatedEmail,
  extractRequestAuditContext,
  queueEmailDelivery,
  requireActiveUser,
  writeAuditLog,
} from "../_shared/mod.ts"
import { recordSupportWhatsappIntent } from "../_shared/whatsapp.ts"

interface CreateSupportTicketInput {
  subject: string
  message: string
  productId?: string | null
  category?: "payment" | "technical" | "account" | "general"
  priority?: "low" | "normal" | "medium" | "high" | "urgent"
  attachment?: {
    bucket: string
    path: string
    file_name: string
    mime_type?: string | null
    file_size_bytes?: number | null
  } | null
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
    const body = await readJsonBody<CreateSupportTicketInput>(req)
    const subject = body.subject?.trim()
    const message = body.message?.trim()
    const category = body.category ?? "general"
    const priority = body.priority ?? "normal"
    const productId = String(body.productId ?? "").trim() || null

    if (!subject || !message) {
      throw badRequest("subject e message sao obrigatorios")
    }

    if (!["payment", "technical", "account", "general"].includes(category)) {
      throw badRequest("category invalida")
    }

    if (!["low", "normal", "medium", "high", "urgent"].includes(priority)) {
      throw badRequest("priority invalida")
    }

    if (
      body.attachment &&
      (body.attachment.bucket !== "support-attachments" ||
        !body.attachment.path.startsWith(`support/${context.user.id}/`))
    ) {
      throw badRequest("Anexo invalido para este usuario")
    }

    if (productId) {
      const { data: product, error: productError } = await context.serviceClient
        .from("products")
        .select("id,status")
        .eq("id", productId)
        .maybeSingle()

      if (productError) throw productError
      if (!product) throw badRequest("Curso nao encontrado")

      const { data: grant, error: grantError } = await context.serviceClient
        .from("access_grants")
        .select("id")
        .eq("user_id", context.user.id)
        .eq("product_id", productId)
        .eq("status", "active")
        .maybeSingle()

      if (grantError) throw grantError
      if (!grant && !context.profile.is_admin) {
        throw badRequest("Este curso nao esta vinculado a tua conta")
      }
    }

    const { data: ticket, error } = await context.serviceClient
      .from("support_tickets")
      .insert({
        subject,
        message,
        category,
        priority,
        product_id: productId,
        user_id: context.user.id,
        attachment_bucket: body.attachment?.bucket ?? null,
        attachment_path: body.attachment?.path ?? null,
        attachment_name: body.attachment?.file_name ?? null,
        attachment_mime_type: body.attachment?.mime_type ?? null,
        attachment_size_bytes: body.attachment?.file_size_bytes ?? null,
      })
      .select("id,product_id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
      .single()

    if (error) {
      throw error
    }

    if (context.profile.email) {
      const email = buildSupportTicketCreatedEmail({
        fullName: context.profile.full_name,
        subject,
        supportUrl: `/aluno/chamados/${ticket.id}`,
      })

      await queueEmailDelivery(context.serviceClient, {
        userId: context.user.id,
        emailTo: context.profile.email,
        templateKey: "support_ticket_created",
        subject: email.subject,
        html: email.html,
        text: email.text,
        metadata: {
          ticket_id: ticket.id,
        },
      })
    }

    const { data: adminRecipients, error: adminRecipientsError } = await context.serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_admin", true)
      .eq("status", "active")

    if (adminRecipientsError) {
      throw adminRecipientsError
    }

    if ((adminRecipients ?? []).length > 0) {
      const { error: adminNotificationError } = await context.serviceClient.from("notifications").insert(
        (adminRecipients ?? []).map((admin) => ({
          user_id: admin.id,
          type: "support",
          title: "Novo ticket de suporte",
          message: `${context.profile.full_name || context.profile.email || "Aluno"} abriu: ${subject}`.slice(0, 180),
          link: `/admin/suporte/${ticket.id}`,
          status: "unread",
          sent_via_email: false,
          sent_via_in_app: true,
        })),
      )

      if (adminNotificationError) {
        throw adminNotificationError
      }
    }

    await recordSupportWhatsappIntent(context.serviceClient, {
      event: "new_ticket",
      ticketId: ticket.id,
      actorUserId: context.user.id,
      target: "admin",
      messagePreview: message.slice(0, 180),
    })

    await writeAuditLog(context.serviceClient, context, {
      action: "support.ticket_created",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: {
        subject,
        category,
        priority,
        product_id: productId,
        has_attachment: Boolean(body.attachment?.path),
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId, ticket })
  } catch (error) {
    logError("Support ticket creation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
