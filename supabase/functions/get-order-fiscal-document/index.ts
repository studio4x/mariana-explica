import { badRequest, conflict, forbidden, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { isAdminProfile, MoloniClient, requireActiveUser } from "../_shared/mod.ts"

interface Input {
  orderId: string
  action?: "metadata" | "download"
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")
    const context = await requireActiveUser(req)
    const body = await readJsonBody<Input>(req)
    if (!body.orderId) throw badRequest("orderId é obrigatório")
    const { data: order, error: orderError } = await context.serviceClient
      .from("orders")
      .select("id,user_id")
      .eq("id", body.orderId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order) throw notFound("Pedido não encontrado")
    if (order.user_id !== context.user.id && !isAdminProfile(context.profile)) {
      throw forbidden("Acesso negado ao documento deste pedido")
    }
    const { data: document, error } = await context.serviceClient
      .from("fiscal_documents")
      .select("id,order_id,document_kind,status,environment,moloni_company_id,moloni_document_id,document_number,total_amount_cents,currency,remote_status,storage_bucket,storage_path,issued_at,last_error_code,last_error_message")
      .eq("order_id", order.id)
      .is("original_fiscal_document_id", null)
      .maybeSingle()
    if (error) throw error
    if (!document) throw notFound("Documento fiscal ainda não planejado")

    const metadata = {
      id: document.id,
      order_id: document.order_id,
      document_kind: document.document_kind,
      status: document.status,
      environment: document.environment,
      document_number: document.document_number,
      total_amount_cents: document.total_amount_cents,
      currency: document.currency,
      issued_at: document.issued_at,
      available_for_download: document.status === "issued" && document.remote_status !== 0,
      error_code: document.last_error_code,
      error_message: isAdminProfile(context.profile) ? document.last_error_message : null,
    }
    if ((body.action ?? "metadata") === "metadata") {
      return jsonResponse({ success: true, request_id: requestId, document: metadata })
    }
    if (document.status !== "issued" || !document.moloni_document_id || !document.moloni_company_id) {
      throw conflict("Documento fiscal ainda não foi emitido.")
    }
    if (document.remote_status === 0) {
      throw conflict("Documento em rascunho não possui PDF fiscal oficial.")
    }

    let bucket = document.storage_bucket
    let path = document.storage_path
    if (!bucket || !path) {
      const moloni = new MoloniClient(context.serviceClient, document.environment)
      const link = await moloni.getPdfLink(document.moloni_company_id, document.moloni_document_id)
      const pdfUrl = new URL(link.url)
      if (
        pdfUrl.protocol !== "https:" ||
        (pdfUrl.hostname !== "moloni.pt" && !pdfUrl.hostname.endsWith(".moloni.pt"))
      ) {
        throw conflict("Link PDF Moloni inseguro.")
      }
      const response = await fetch(pdfUrl, { redirect: "follow" })
      if (!response.ok) throw conflict("Não foi possível obter o PDF fiscal.")
      const finalUrl = new URL(response.url)
      if (
        finalUrl.protocol !== "https:" ||
        (finalUrl.hostname !== "moloni.pt" && !finalUrl.hostname.endsWith(".moloni.pt"))
      ) {
        throw conflict("Redirecionamento PDF Moloni inseguro.")
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      const hasPdfSignature =
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d
      if (!hasPdfSignature || bytes.length > 15 * 1024 * 1024) {
        throw conflict("PDF fiscal inválido ou acima do limite.")
      }
      bucket = "fiscal-documents"
      path = `${document.environment}/${order.user_id}/${order.id}/${document.id}.pdf`
      const { error: uploadError } = await context.serviceClient.storage
        .from(bucket)
        .upload(path, bytes, { contentType: "application/pdf", upsert: true })
      if (uploadError) throw uploadError
      const { error: persistError } = await context.serviceClient
        .from("fiscal_documents")
        .update({ storage_bucket: bucket, storage_path: path })
        .eq("id", document.id)
      if (persistError) throw persistError
    }
    const { data: signed, error: signedError } = await context.serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, 300, { download: `documento-fiscal-${document.document_number ?? order.id}.pdf` })
    if (signedError) throw signedError
    return jsonResponse({
      success: true,
      request_id: requestId,
      document: metadata,
      signed_url: signed.signedUrl,
      expires_in_seconds: 300,
    })
  } catch (error) {
    logError("Fiscal document access failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
