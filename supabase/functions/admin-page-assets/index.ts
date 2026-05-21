import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const ASSET_BUCKET = "site-pages-public"
const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
])

function sanitizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function sanitizeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
  return normalized || "asset"
}

async function ensureBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: bucket } = await serviceClient.storage.getBucket(ASSET_BUCKET)
  if (bucket) return
  const { error } = await serviceClient.storage.createBucket(ASSET_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
  })
  if (error && !String(error.message ?? "").toLowerCase().includes("already exists")) {
    throw error
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")

    const context = await requireAdmin(req)
    const serviceClient = createServiceClient()
    const auditMeta = extractRequestAuditContext(req)
    const formData = await req.formData()

    const slug = sanitizeSlug(String(formData.get("slug") ?? "").trim())
    if (!slug) throw badRequest("slug e obrigatorio")

    const file = formData.get("file")
    if (!(file instanceof File)) throw badRequest("file e obrigatorio")
    if (file.size <= 0) throw badRequest("Ficheiro vazio")
    if (file.size > MAX_FILE_SIZE_BYTES) throw badRequest("Ficheiro excede o limite de 12MB")
    if (!ALLOWED_MIME_TYPES.has(file.type)) throw badRequest("Tipo de ficheiro nao permitido")

    const { data: page, error: pageError } = await serviceClient
      .from("site_pages")
      .select("id,slug,title")
      .eq("slug", slug)
      .maybeSingle()
    if (pageError) throw pageError
    if (!page) throw badRequest("Pagina nao encontrada")

    await ensureBucket(serviceClient)

    const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "bin" : "bin"
    const normalizedFileName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""))
    const storagePath = `pages/${slug}/${Date.now()}-${crypto.randomUUID()}-${normalizedFileName}.${extension}`

    const { error: uploadError } = await serviceClient.storage
      .from(ASSET_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })
    if (uploadError) throw uploadError

    const { data: publicData } = serviceClient.storage.from(ASSET_BUCKET).getPublicUrl(storagePath)
    const publicUrl = String(publicData.publicUrl ?? "").trim()
    if (!publicUrl) throw badRequest("Nao foi possivel gerar URL publica do asset")

    const { data: asset, error: assetError } = await serviceClient
      .from("site_page_assets")
      .insert({
        page_id: page.id,
        bucket: ASSET_BUCKET,
        path: storagePath,
        public_url: publicUrl,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_by: context.user.id,
      })
      .select("id,page_id,bucket,path,public_url,file_name,mime_type,file_size_bytes,uploaded_by,created_at")
      .single()
    if (assetError) throw assetError

    await writeAuditLog(serviceClient, context, {
      action: "admin.page_builder_asset_uploaded",
      entityType: "site_page_asset",
      entityId: asset.id,
      metadata: {
        slug,
        page_id: page.id,
        bucket: ASSET_BUCKET,
        path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
      },
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      asset,
      upload: {
        bucket: ASSET_BUCKET,
        path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_at: asset.created_at,
        public_url: publicUrl,
      },
    })
  } catch (error) {
    logError("Admin page assets upload failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
