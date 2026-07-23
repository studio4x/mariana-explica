import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  assertAdminIntegrationRateLimit,
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

interface Input {
  environment: "draft" | "live"
  confirmation: string
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
      "moloni.disconnect",
      5,
    )
    const body = await readJsonBody<Input>(req)
    if (!["draft", "live"].includes(body.environment) || body.confirmation !== "DESCONECTAR_MOLONI") {
      throw badRequest("Confirmação de desconexão inválida")
    }
    const { error: credentialError } = await context.serviceClient.rpc("delete_moloni_credentials", {
      p_environment: body.environment,
    })
    if (credentialError) throw credentialError
    const { error } = await context.serviceClient
      .from("moloni_connections")
      .update({
        status: "disconnected",
        token_expires_at: null,
        refresh_token_expires_at: null,
        disconnected_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
      })
      .eq("environment", body.environment)
    if (error) throw error
    await writeAuditLog(context.serviceClient, context, {
      action: "admin.moloni_disconnected",
      entityType: "moloni_connection",
      metadata: { environment: body.environment },
      ...extractRequestAuditContext(req),
    })
    return jsonResponse({ success: true, request_id: requestId, environment: body.environment })
  } catch (error) {
    logError("Moloni disconnect failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
