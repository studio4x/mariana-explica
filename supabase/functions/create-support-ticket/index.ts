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

interface CreateSupportTicketInput {
  subject: string
  message: string
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

    if (!subject || !message) {
      throw badRequest("subject e message sao obrigatorios")
    }

    const { data: ticket, error } = await context.serviceClient
      .from("support_tickets")
      .insert({
        subject,
        message,
        user_id: context.user.id,
      })
      .select("id,subject,message,status,priority,assigned_admin_id,last_reply_at,created_at,updated_at")
      .single()

    if (error) {
      throw error
    }

    if (context.profile.email) {
      const email = buildSupportTicketCreatedEmail({
        fullName: context.profile.full_name,
        subject,
        supportUrl: "/dashboard/suporte",
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

    await writeAuditLog(context.serviceClient, context, {
      action: "support.ticket_created",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { subject },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId, ticket })
  } catch (error) {
    logError("Support ticket creation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
