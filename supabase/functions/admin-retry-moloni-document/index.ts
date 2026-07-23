import { badRequest, conflict, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  assertAdminIntegrationRateLimit,
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

interface Input {
  fiscalDocumentId: string
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")
    const context = await requireAdmin(req)
    await assertAdminIntegrationRateLimit(
      context.serviceClient,
      context.user.id,
      "moloni.document_retry",
      10,
    )
    const body = await readJsonBody<Input>(req)
    const { data: document, error: documentError } = await context.serviceClient
      .from("fiscal_documents")
      .select("id,status,moloni_document_id")
      .eq("id", body.fiscalDocumentId)
      .maybeSingle()
    if (documentError) throw documentError
    if (!document) throw notFound("Documento fiscal não encontrado")
    if (document.status === "issued" || document.moloni_document_id) {
      throw conflict("Documento já emitido; a retentativa foi bloqueada.")
    }
    const { data: job, error } = await context.serviceClient
      .from("moloni_document_jobs")
      .update({
        status: "retry",
        available_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error_code: null,
        last_error: null,
      })
      .eq("fiscal_document_id", document.id)
      .in("status", ["blocked", "failed", "retry"])
      .select("id,status,attempt_count")
      .maybeSingle()
    if (error) throw error
    if (!job) throw conflict("A tarefa está em processamento ou concluída.")
    await context.serviceClient
      .from("fiscal_documents")
      .update({ status: "pending", last_error_code: null, last_error_message: null })
      .eq("id", document.id)
    await writeAuditLog(context.serviceClient, context, {
      action: "admin.moloni_document_retried",
      entityType: "fiscal_document",
      entityId: document.id,
      metadata: { job_id: job.id, previous_status: document.status },
      ...extractRequestAuditContext(req),
    })
    return jsonResponse({ success: true, request_id: requestId, job })
  } catch (error) {
    logError("Moloni document retry failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
