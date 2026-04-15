import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
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
  requireActiveUser,
  writeAuditLog,
} from "../_shared/mod.ts"

interface SupportReplyInput {
  ticketId: string
  message: string
  status?: "open" | "in_progress" | "answered" | "closed"
  priority?: "low" | "normal" | "high"
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("MÃ©todo nÃ£o suportado")
    }

    const context = await requireActiveUser(req)
    const body = await readJsonBody<SupportReplyInput>(req)
    if (!body.ticketId || !body.message.trim()) {
      throw badRequest("ticketId e message sÃ£o obrigatÃ³rios")
    }

    const { data: ticket, error: ticketError } = await context.serviceClient
      .from("support_tickets")
      .select("id,user_id,status,priority")
      .eq("id", body.ticketId)
      .maybeSingle()

    if (ticketError) {
      throw ticketError
    }

    if (!ticket) {
      throw notFound("Ticket nÃ£o encontrado")
    }

    const isOwner = ticket.user_id === context.user.id
    if (!context.profile.is_admin && !isOwner) {
      throw forbidden("VocÃª nÃ£o pode responder este ticket")
    }

    if (!context.profile.is_admin && ticket.status === "closed") {
      throw forbidden("Ticket encerrado nÃ£o pode receber nova resposta do usuÃ¡rio")
    }

    const { data: message, error: messageError } = await context.serviceClient
      .from("support_ticket_messages")
      .insert({
        ticket_id: body.ticketId,
        sender_user_id: context.user.id,
        sender_role: context.profile.role === "admin" ? "admin" : "student",
        message: body.message.trim(),
      })
      .select("*")
      .single()

    if (messageError) {
      throw messageError
    }

    const ticketUpdates: Record<string, unknown> = {}
    if (context.profile.is_admin) {
      if (body.status) ticketUpdates.status = body.status
      if (body.priority) ticketUpdates.priority = body.priority
      ticketUpdates.assigned_admin_id = context.user.id
    } else {
      ticketUpdates.status = "open"
    }

    if (Object.keys(ticketUpdates).length > 0) {
      const { error } = await context.serviceClient
        .from("support_tickets")
        .update(ticketUpdates)
        .eq("id", body.ticketId)

      if (error) {
        throw error
      }
    }

    if (context.profile.is_admin) {
      await context.serviceClient.from("notifications").insert({
        user_id: ticket.user_id,
        type: "support",
        title: "Suporte respondeu o seu ticket",
        message: body.message.trim().slice(0, 180),
        link: "/dashboard/suporte",
        status: "unread",
        sent_via_email: false,
        sent_via_in_app: true,
      })
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "support.ticket_reply",
      entityType: "support_ticket",
      entityId: body.ticketId,
      metadata: {
        message_id: message.id,
        is_admin_reply: context.profile.is_admin,
        status: body.status ?? null,
        priority: body.priority ?? null,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId, message })
  } catch (error) {
    logError("Support ticket reply failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
