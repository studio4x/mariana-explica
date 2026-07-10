import { badRequest, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { deleteStorageObject } from "../_shared/storage-provider.ts"

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
      .select("id,user_id,subject,attachment_bucket,attachment_path,attachment_storage_provider")
      .eq("id", ticketId)
      .maybeSingle()

    if (ticketError) throw ticketError
    if (!ticket) throw notFound("Ticket nao encontrado")

    const { data: messages, error: messagesError } = await context.serviceClient
      .from("support_ticket_messages")
      .select("id,attachment_bucket,attachment_path,attachment_storage_provider")
      .eq("ticket_id", ticketId)

    if (messagesError) throw messagesError

    const pathsByBucket = new Map<string, Array<{ path: string; provider: "supabase" | "r2" }>>()
    const addPath = (bucket?: string | null, path?: string | null, provider?: string | null) => {
      if (!bucket || !path) return
      const paths = pathsByBucket.get(bucket) ?? []
      paths.push({
        path,
        provider: provider === "r2" ? "r2" : "supabase",
      })
      pathsByBucket.set(bucket, paths)
    }

    addPath(ticket.attachment_bucket, ticket.attachment_path, ticket.attachment_storage_provider)
    for (const message of messages ?? []) {
      addPath(message.attachment_bucket, message.attachment_path, message.attachment_storage_provider)
    }

    const { error: deleteError } = await context.serviceClient
      .from("support_tickets")
      .delete()
      .eq("id", ticketId)

    if (deleteError) throw deleteError

    for (const [bucket, entries] of pathsByBucket.entries()) {
      for (const entry of entries) {
        try {
          await deleteStorageObject({
            serviceClient: context.serviceClient,
            logicalBucket: bucket,
            storagePath: entry.path,
            provider: entry.provider,
          })
        } catch (error) {
        logError("Support attachment cleanup failed", {
          request_id: requestId,
          bucket,
          path: entry.path,
          provider: entry.provider,
          error: String(error),
        })
      }
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
