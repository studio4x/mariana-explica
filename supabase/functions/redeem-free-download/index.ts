import { createServiceClient, createSignedReadUrl, extractRequestAuditContext, getSignedGetExpiresSeconds, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((part) => part.toString(16).padStart(2, "0")).join("")
Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")
    const body = await readJsonBody<{ token?: unknown }>(req)
    if (!body || Object.keys(body).length !== 1 || typeof body.token !== "string" || !/^[a-f0-9]{64}$/i.test(body.token)) throw forbidden("Link de download invalido ou expirado")
    const service = createServiceClient()
    const { data: row, error } = await service.from("free_product_download_tokens").select("id,usage_count,max_uses,expires_at,revoked_at,lead_id,products!inner(id,title,product_type,status),product_download_files!inner(id,storage_provider,storage_bucket,storage_path,file_name,status)").eq("token_hash", await digest(body.token)).maybeSingle()
    if (error) throw error
    const product = row?.products as unknown as { id: string; title: string; product_type: string; status: string } | undefined
    const file = row?.product_download_files as unknown as { id: string; storage_provider: "supabase" | "r2"; storage_bucket: string; storage_path: string; file_name: string; status: string } | undefined
    if (!row || !product || !file || row.revoked_at || row.usage_count >= row.max_uses || Date.parse(row.expires_at) <= Date.now() || product.product_type !== "free" || product.status !== "published" || file.status !== "active") throw forbidden("Link de download invalido ou expirado")
    const { data: consumed, error: consumeError } = await service.from("free_product_download_tokens").update({ usage_count: row.usage_count + 1, last_used_at: new Date().toISOString() }).eq("id", row.id).eq("usage_count", row.usage_count).is("revoked_at", null).select("id").maybeSingle()
    if (consumeError) throw consumeError
    if (!consumed) throw forbidden("Link de download invalido ou expirado")
    const url = await createSignedReadUrl({ serviceClient: service, logicalBucket: file.storage_bucket, storagePath: file.storage_path, provider: file.storage_provider, expiresInSeconds: getSignedGetExpiresSeconds(), downloadFileName: file.file_name })
    await writeAuditLog(service, null, { action: "free_download.redeemed", entityType: "product", entityId: product.id, metadata: { token_id: row.id, source: "email_download" }, ...extractRequestAuditContext(req) })
    return jsonResponse({ success: true, request_id: requestId, url, file_name: file.file_name, expires_in_seconds: getSignedGetExpiresSeconds() })
  } catch (error) {
    logError("Free download redemption failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
