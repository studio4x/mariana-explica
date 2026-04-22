import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/mod.ts"

interface AttachmentAccessInput {
  ticketId: string
  bucket: string
  path: string
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
    const body = await readJsonBody<AttachmentAccessInput>(req)
    const ticketId = String(body.ticketId ?? "").trim()
    const bucket = String(body.bucket ?? "").trim()
    const path = String(body.path ?? "").trim()

    if (!ticketId || !bucket || !path) {
      throw badRequest("ticketId, bucket e path sao obrigatorios")
    }

    const { data: ticket, error: ticketError } = await context.serviceClient
      .from("support_tickets")
      .select("id,user_id,attachment_bucket,attachment_path")
      .eq("id", ticketId)
      .maybeSingle()

    if (ticketError) throw ticketError
    if (!ticket) throw notFound("Ticket nao encontrado")
    if (!context.profile.is_admin && ticket.user_id !== context.user.id) {
      throw forbidden("Sem permissao para acessar este anexo")
    }

    const isTicketAttachment = ticket.attachment_bucket === bucket && ticket.attachment_path === path
    const { data: messageAttachment, error: messageError } = await context.serviceClient
      .from("support_ticket_messages")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("attachment_bucket", bucket)
      .eq("attachment_path", path)
      .maybeSingle()

    if (messageError) throw messageError
    if (!isTicketAttachment && !messageAttachment) {
      throw notFound("Anexo nao encontrado neste ticket")
    }

    const { data: signed, error: signedError } = await context.serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 600, { download: true })

    if (signedError) {
      throw signedError
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      signed_url: signed.signedUrl,
      expires_in: 600,
    })
  } catch (error) {
    logError("Support attachment access failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
