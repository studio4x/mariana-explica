import { badRequest, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"

interface DeleteTicketInput {
  ticketId: string
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

    const context = await requireAdmin(req)
    const body = await readJsonBody<DeleteTicketInput>(req)
    const ticketId = String(body.ticketId ?? "").trim()

    if (!ticketId) {
      throw badRequest("ticketId e obrigatorio")
    }

    const { data: ticket, error: ticketError } = await context.serviceClient
      .from("support_tickets")
      .select("id,user_id,subject,attachment_bucket,attachment_path")
      .eq("id", ticketId)
      .maybeSingle()

    if (ticketError) throw ticketError
    if (!ticket) throw notFound("Ticket nao encontrado")

    const { data: messages, error: messagesError } = await context.serviceClient
      .from("support_ticket_messages")
      .select("id,attachment_bucket,attachment_path")
      .eq("ticket_id", ticketId)

    if (messagesError) throw messagesError

    const pathsByBucket = new Map<string, string[]>()
    const addPath = (bucket?: string | null, path?: string | null) => {
      if (!bucket || !path) return
      const paths = pathsByBucket.get(bucket) ?? []
      paths.push(path)
      pathsByBucket.set(bucket, paths)
    }

    addPath(ticket.attachment_bucket, ticket.attachment_path)
    for (const message of messages ?? []) {
      addPath(message.attachment_bucket, message.attachment_path)
    }

    const { error: deleteError } = await context.serviceClient
      .from("support_tickets")
      .delete()
      .eq("id", ticketId)

    if (deleteError) throw deleteError

    for (const [bucket, paths] of pathsByBucket.entries()) {
      const { error } = await context.serviceClient.storage.from(bucket).remove([...new Set(paths)])
      if (error) {
        logError("Support attachment cleanup failed", {
          request_id: requestId,
          bucket,
          error: String(error),
        })
      }
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.support_ticket_deleted",
      entityType: "support_ticket",
      entityId: ticketId,
      metadata: {
        user_id: ticket.user_id,
        subject: ticket.subject,
        removed_attachment_count: [...pathsByBucket.values()].reduce((total, paths) => total + paths.length, 0),
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId })
  } catch (error) {
    logError("Admin support ticket delete failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
