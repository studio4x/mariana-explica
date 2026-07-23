import { badRequest, unauthorized } from "../_shared/errors.ts"
import { getRequestId } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  createServiceClient,
  exchangeMoloniAuthorizationCode,
  getAppBaseUrl,
  MoloniClient,
  storeMoloniTokens,
} from "../_shared/mod.ts"

function redirect(path: string, result: "connected" | "error", requestId: string) {
  const url = new URL(path, getAppBaseUrl())
  url.searchParams.set("moloni", result)
  url.searchParams.set("request_id", requestId)
  return Response.redirect(url.toString(), 302)
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  let redirectPath = "/admin/integracoes/moloni"
  try {
    if (req.method !== "GET") throw badRequest("Método não suportado")
    const url = new URL(req.url)
    const code = url.searchParams.get("code")?.trim()
    const state = url.searchParams.get("state")?.trim()
    if (!code || !state) throw unauthorized("Callback OAuth incompleto")

    const client = createServiceClient()
    const stateHash = await sha256(state)
    const { data: oauthState, error } = await client
      .from("moloni_oauth_states")
      .select("id,environment,admin_user_id,redirect_path,expires_at,consumed_at")
      .eq("state_hash", stateHash)
      .maybeSingle()
    if (error) throw error
    if (
      !oauthState ||
      oauthState.consumed_at ||
      new Date(oauthState.expires_at).getTime() <= Date.now()
    ) {
      throw unauthorized("OAuth state inválido ou expirado")
    }
    redirectPath = oauthState.redirect_path

    const { data: consumed, error: consumeError } = await client
      .from("moloni_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", oauthState.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle()
    if (consumeError) throw consumeError
    if (!consumed) throw unauthorized("OAuth state já utilizado")

    const tokens = await exchangeMoloniAuthorizationCode(client, code)
    await storeMoloniTokens(client, oauthState.environment, tokens, oauthState.admin_user_id)
    const moloni = new MoloniClient(client, oauthState.environment)
    const companies = await moloni.getCompanies()
    const { data: settings } = await client
      .from("moloni_fiscal_settings")
      .select("moloni_company_id")
      .eq("moloni_environment", oauthState.environment)
      .not("moloni_company_id", "is", null)
      .limit(1)
      .maybeSingle()
    const company = companies.find((item) => item.company_id === settings?.moloni_company_id) ??
      (companies.length === 1 ? companies[0] : null)
    await client
      .from("moloni_connections")
      .update({
        status: "connected",
        moloni_company_id: company?.company_id ?? null,
        company_name: company?.name ?? null,
        last_success_at: new Date().toISOString(),
      })
      .eq("environment", oauthState.environment)
    await client.from("audit_logs").insert({
      actor_user_id: oauthState.admin_user_id,
      actor_role: "admin",
      action: "admin.moloni_oauth_connected",
      entity_type: "moloni_connection",
      metadata: {
        environment: oauthState.environment,
        company_id: company?.company_id ?? null,
      },
    })
    return redirect(redirectPath, "connected", requestId)
  } catch (error) {
    logError("Moloni OAuth callback failed", { request_id: requestId, error: String(error) })
    return redirect(redirectPath, "error", requestId)
  }
})
