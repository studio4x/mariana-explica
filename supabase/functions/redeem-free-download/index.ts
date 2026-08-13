import { createServiceClient, createSignedReadUrl, downloadStorageObject, extractRequestAuditContext, getSignedGetExpiresSeconds, uploadStorageObject, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { stampFreeDownloadPdf } from "../_shared/free-download-pdf-license.ts"
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((part) => part.toString(16).padStart(2, "0")).join("")

type DownloadFile = { id: string; storage_provider: "supabase" | "r2"; storage_bucket: string; storage_path: string; file_name: string; mime_type: string | null; status: string }
type FreeLead = { id: string; name: string; normalized_email: string }
type LicensedPdf = { storage_provider: "supabase" | "r2"; storage_bucket: string; storage_path: string }

function isPdf(file: DownloadFile) {
  return file.mime_type === "application/pdf" || /\.pdf$/i.test(file.file_name) || /\.pdf$/i.test(file.storage_path)
}

async function getLicensedPdf(params: {
  service: ReturnType<typeof createServiceClient>
  token: { id: string; token_hash: string; expires_at: string; product_download_file_id: string }
  file: DownloadFile
  lead: FreeLead
}) : Promise<LicensedPdf> {
  const existing = await params.service
    .from("free_product_download_licenses")
    .select("storage_provider,storage_bucket,storage_path")
    .eq("download_token_id", params.token.id)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as LicensedPdf

  const sourceBytes = await downloadStorageObject({
    serviceClient: params.service,
    logicalBucket: params.file.storage_bucket,
    storagePath: params.file.storage_path,
    provider: params.file.storage_provider,
  })
  const licensedPdfBytes = await stampFreeDownloadPdf({
    sourceBytes,
    leadName: params.lead.name,
    leadEmail: params.lead.normalized_email,
    licenseKeyHash: params.token.token_hash,
  })
  const storagePath = `derived-watermarks/free-product-downloads/${params.token.id}/${params.token.token_hash}.pdf`
  await uploadStorageObject({
    serviceClient: params.service,
    logicalBucket: params.file.storage_bucket,
    storagePath,
    provider: params.file.storage_provider,
    body: licensedPdfBytes,
    contentType: "application/pdf",
    upsert: true,
  })
  const created = await params.service
    .from("free_product_download_licenses")
    .upsert({
      download_token_id: params.token.id,
      product_download_file_id: params.token.product_download_file_id,
      storage_provider: params.file.storage_provider,
      storage_bucket: params.file.storage_bucket,
      storage_path: storagePath,
      license_key_hash: params.token.token_hash,
      expires_at: params.token.expires_at,
    }, { onConflict: "download_token_id" })
    .select("storage_provider,storage_bucket,storage_path")
    .single()
  if (created.error || !created.data) throw created.error ?? new Error("Nao foi possivel preparar o PDF licenciado")
  return created.data as LicensedPdf
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")
    const body = await readJsonBody<{ token?: unknown }>(req)
    if (!body || Object.keys(body).length !== 1 || typeof body.token !== "string" || !/^[a-f0-9]{64}$/i.test(body.token)) throw forbidden("Link de download invalido ou expirado")
    const service = createServiceClient()
    const { data: row, error } = await service.from("free_product_download_tokens").select("id,usage_count,max_uses,expires_at,revoked_at,lead_id,product_download_file_id,token_hash,products!inner(id,title,product_type,status),free_product_leads!inner(id,name,normalized_email),product_download_files!inner(id,storage_provider,storage_bucket,storage_path,file_name,mime_type,status)").eq("token_hash", await digest(body.token)).maybeSingle()
    if (error) throw error
    const product = row?.products as unknown as { id: string; title: string; product_type: string; status: string } | undefined
    const lead = row?.free_product_leads as unknown as FreeLead | undefined
    const file = row?.product_download_files as unknown as DownloadFile | undefined
    if (!row || !product || !lead || !file || row.revoked_at || row.usage_count >= row.max_uses || Date.parse(row.expires_at) <= Date.now() || product.product_type !== "free" || product.status !== "published" || file.status !== "active") throw forbidden("Link de download invalido ou expirado")
    const licensedPdf = isPdf(file)
      ? await getLicensedPdf({ service, token: row, file, lead })
      : null
    const { data: consumed, error: consumeError } = await service.from("free_product_download_tokens").update({ usage_count: row.usage_count + 1, last_used_at: new Date().toISOString() }).eq("id", row.id).eq("usage_count", row.usage_count).is("revoked_at", null).select("id").maybeSingle()
    if (consumeError) throw consumeError
    if (!consumed) throw forbidden("Link de download invalido ou expirado")
    const url = await createSignedReadUrl({ serviceClient: service, logicalBucket: licensedPdf?.storage_bucket ?? file.storage_bucket, storagePath: licensedPdf?.storage_path ?? file.storage_path, provider: licensedPdf?.storage_provider ?? file.storage_provider, expiresInSeconds: getSignedGetExpiresSeconds(), downloadFileName: file.file_name })
    await writeAuditLog(service, null, { action: "free_download.redeemed", entityType: "product", entityId: product.id, metadata: { token_id: row.id, source: "email_download", licensed_pdf: Boolean(licensedPdf), file_id: file.id }, ...extractRequestAuditContext(req) })
    return jsonResponse({ success: true, request_id: requestId, url, file_name: file.file_name, expires_in_seconds: getSignedGetExpiresSeconds(), licensed_pdf: Boolean(licensedPdf) })
  } catch (error) {
    logError("Free download redemption failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
