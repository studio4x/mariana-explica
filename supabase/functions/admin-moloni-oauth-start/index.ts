import { badRequest } from "../_shared/errors.ts"
import { buildMoloniAuthorizationUrl } from "../_shared/moloni.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  assertAdminIntegrationRateLimit,
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

interface Input {
  environment: "draft" | "live"
  redirectPath?: string
}

function base64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
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
      "moloni.oauth_start",
      10,
    )
    const body = await readJsonBody<Input>(req)
    if (!["draft", "live"].includes(body.environment)) {
      throw badRequest("Ambiente Moloni inválido")
    }
    const redirectPath = body.redirectPath?.trim() || "/admin/integracoes/moloni"
    if (!redirectPath.startsWith("/admin/")) throw badRequest("Redirect administrativo inválido")

    const state = base64Url(crypto.getRandomValues(new Uint8Array(32)))
    const stateHash = await sha256(state)
    const { error } = await context.serviceClient.from("moloni_oauth_states").insert({
      state_hash: stateHash,
      environment: body.environment,
      admin_user_id: context.user.id,
      redirect_path: redirectPath,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (error) throw error

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.moloni_oauth_started",
      entityType: "moloni_connection",
      metadata: { environment: body.environment },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      environment: body.environment,
      authorization_url: await buildMoloniAuthorizationUrl(context.serviceClient, state),
      expires_in_seconds: 600,
    })
  } catch (error) {
    logError("Moloni OAuth start failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
