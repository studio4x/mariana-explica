import { buildFreeLeadDownloadEmail, createServiceClient, extractRequestAuditContext, queueEmailDelivery, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"

type Input = { name?: unknown; email?: unknown; productId?: unknown }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((part) => part.toString(16).padStart(2, "0")).join("")
const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")
    const body = await readJsonBody<Input>(req)
    if (Object.keys(body).some((key) => !["name", "email", "productId"].includes(key))) throw badRequest("Pedido invalido")
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const productId = typeof body.productId === "string" ? body.productId.trim() : ""
    if (name.length < 2 || name.length > 120 || !EMAIL.test(email) || email.length > 320 || !productId) throw badRequest("Verifique o nome e o email informados")
    const service = createServiceClient()
    const { data: product, error: productError } = await service.from("products").select("id,title,product_type,status").eq("id", productId).maybeSingle()
    if (productError) throw productError
    if (!product || product.product_type !== "free" || product.status !== "published") throw forbidden("Material indisponivel")
    const { data: file, error: fileError } = await service.from("product_download_files").select("id").eq("product_id", product.id).eq("status", "active").maybeSingle()
    if (fileError) throw fileError
    if (!file) throw forbidden("Material indisponivel")
    const windowStart = new Date(Date.now() - 10 * 60_000).toISOString()
    const { count, error: rateError } = await service.from("free_product_leads").select("id", { count: "exact", head: true }).eq("product_id", product.id).eq("normalized_email", email).gte("last_requested_at", windowStart)
    if (rateError) throw rateError
    if ((count ?? 0) >= 3) return jsonResponse({ success: true, request_id: requestId, message: "Se o endereco estiver correto, recebera o material em breve." })
    const { data: lead, error: leadError } = await service.rpc("register_free_product_lead", { input_product_id: product.id, input_name: name, input_email: email, input_source: "public_product_page", input_metadata: { last_ip_hash: await digest(clientIp(req)) } })
    if (leadError) throw leadError
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, "0")).join("")
    const tokenHash = await digest(token)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
    const { error: tokenError } = await service.from("free_product_download_tokens").insert({ lead_id: lead.id, product_id: product.id, product_download_file_id: file.id, token_hash: tokenHash, expires_at: expiresAt, max_uses: 3 })
    if (tokenError) throw tokenError
    const emailContent = await buildFreeLeadDownloadEmail(service, { fullName: name, productTitle: product.title, downloadUrl: `/material-gratuito/${token}` })
    await queueEmailDelivery(service, { emailTo: email, templateKey: "free_lead_download", subject: emailContent.subject, html: emailContent.html, text: emailContent.text, metadata: { free_product_lead_id: lead.id, product_id: product.id } })
    await writeAuditLog(service, null, { action: "free_download.requested", entityType: "product", entityId: product.id, metadata: { lead_id: lead.id, request_id: requestId, source: "public_product_page" }, ...extractRequestAuditContext(req) })
    return jsonResponse({ success: true, request_id: requestId, message: "Se o endereco estiver correto, recebera o material em breve." })
  } catch (error) {
    logError("Free download request failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
