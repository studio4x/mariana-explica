import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { extractRequestAuditContext, requireActiveUser, writeAuditLog } from "../_shared/mod.ts"

interface ArchiveSupportTicketInput {
  ticketId: string
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")

    const context = await requireActiveUser(req)
    const body = await readJsonBody<ArchiveSupportTicketInput>(req)
    const ticketId = String(body.ticketId ?? "").trim()
    if (!ticketId) throw badRequest("ticketId e obrigatorio")

    const { data: ticket, error: ticketError } = await context.serviceClient
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle()

    if (ticketError) throw ticketError
    if (!ticket) throw notFound("Ticket nao encontrado")
    if (ticket.user_id !== context.user.id) throw forbidden("Voce nao pode arquivar este ticket")

    if (ticket.status !== "closed") {
      const { data: updatedTicket, error: updateError } = await context.serviceClient
        .from("support_tickets")
        .update({ status: "closed" })
        .eq("id", ticketId)
        .select("*")
        .single()

      if (updateError) throw updateError

      await writeAuditLog(context.serviceClient, context, {
        action: "support.ticket_archived_by_student",
        entityType: "support_ticket",
        entityId: ticketId,
        metadata: { previous_status: ticket.status },
        ...extractRequestAuditContext(req),
      })

      return jsonResponse({ success: true, request_id: requestId, ticket: updatedTicket })
    }

    return jsonResponse({ success: true, request_id: requestId, ticket })
  } catch (error) {
    logError("Support ticket archive failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
