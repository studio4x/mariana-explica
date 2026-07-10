import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/mod.ts"
import { createSignedReadUrl } from "../_shared/storage-provider.ts"

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
      .select("id,user_id,attachment_bucket,attachment_path,attachment_storage_provider")
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
      .select("id,attachment_storage_provider")
      .eq("ticket_id", ticketId)
      .eq("attachment_bucket", bucket)
      .eq("attachment_path", path)
      .maybeSingle()

    if (messageError) throw messageError
    if (!isTicketAttachment && !messageAttachment) {
      throw notFound("Anexo nao encontrado neste ticket")
    }

    const storageProvider =
      (isTicketAttachment ? ticket.attachment_storage_provider : messageAttachment?.attachment_storage_provider) ?? "supabase"
    const signedUrl = await createSignedReadUrl({
      serviceClient: context.serviceClient,
      logicalBucket: bucket,
      storagePath: path,
      provider: storageProvider,
      expiresInSeconds: 600,
      downloadFileName: path.split("/").at(-1) ?? "anexo",
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      signed_url: signedUrl,
      expires_in: 600,
    })
  } catch (error) {
    logError("Support attachment access failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
