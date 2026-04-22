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
  category?: "payment" | "technical" | "account" | "general"
  priority?: "low" | "normal" | "medium" | "high" | "urgent"
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

    if (!subject || !message) {
      throw badRequest("subject e message sao obrigatorios")
    }

    if (!["payment", "technical", "account", "general"].includes(category)) {
      throw badRequest("category invalida")
    }

    if (!["low", "normal", "medium", "high", "urgent"].includes(priority)) {
      throw badRequest("priority invalida")
    }

    const { data: ticket, error } = await context.serviceClient
      .from("support_tickets")
      .insert({
        subject,
        message,
        category,
        priority,
        user_id: context.user.id,
      })
      .select("id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,created_at,updated_at")
      .single()

    if (error) {
      throw error
    }

    if (context.profile.email) {
      const email = buildSupportTicketCreatedEmail({
        fullName: context.profile.full_name,
        subject,
        supportUrl: `/aluno/suporte/${ticket.id}`,
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
      metadata: { subject, category, priority },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId, ticket })
  } catch (error) {
    logError("Support ticket creation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
