import { badRequest, conflict } from "../_shared/errors.ts"
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
  action: "retry" | "unblock" | "reconcile" | "cancel"
  confirmation?: string
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
      "moloni.job_action",
      20,
    )
    const body = await readJsonBody<Input>(req)
    if (!body.fiscalDocumentId || !["retry", "unblock", "reconcile", "cancel"].includes(body.action)) {
      throw badRequest("Ação fiscal inválida")
    }
    if (body.action === "cancel" && body.confirmation !== "CANCELAR JOB FISCAL") {
      throw conflict("A confirmação explícita do cancelamento está ausente.")
    }
    const { data, error } = await context.serviceClient.rpc("admin_transition_moloni_job", {
      p_fiscal_document_id: body.fiscalDocumentId,
      p_action: body.action,
      p_actor_user_id: context.user.id,
    })
    if (error) throw conflict(error.message)
    const result = Array.isArray(data) ? data[0] : data
    await writeAuditLog(context.serviceClient, context, {
      action: `admin.moloni_job_${body.action}`,
      entityType: "fiscal_document",
      entityId: body.fiscalDocumentId,
      metadata: {
        job_id: result?.job_id ?? null,
        job_status: result?.job_status ?? null,
        changed: result?.changed ?? false,
      },
      ...extractRequestAuditContext(req),
    })
    return jsonResponse({ success: true, request_id: requestId, result })
  } catch (error) {
    logError("Moloni admin job action failed", {
      request_id: requestId,
      error: error instanceof Error ? error.message.slice(0, 250) : "unknown",
    })
    return errorResponse(error, requestId)
  }
})
