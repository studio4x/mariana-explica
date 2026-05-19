import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const PAGE_ASSETS_BUCKET = "site-pages-public"
const IMAGE_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]
const IMAGE_ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"])
const IMAGE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function sanitizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".")
  if (parts.length < 2) return ""
  return sanitizeSegment(parts.at(-1) ?? "")
}

function inferImageMimeType(extension: string) {
  switch (extension) {
    case "png":
      return "image/png"
    case "svg":
      return "image/svg+xml"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    case "avif":
      return "image/avif"
    default:
      return null
  }
}

function normalizeMimeType(rawMimeType: string | null, extension: string) {
  const normalized = rawMimeType?.trim().toLowerCase() ?? ""
  if (!normalized || normalized === "application/octet-stream") {
    return inferImageMimeType(extension)
  }
  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg"
  }
  return normalized
}

async function ensureStorageBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()
  if (bucketsError) throw bucketsError

  const exists = (buckets ?? []).some((bucket) => bucket.name === PAGE_ASSETS_BUCKET)
  if (exists) {
    const { error: updateError } = await serviceClient.storage.updateBucket(PAGE_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: IMAGE_MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: IMAGE_ALLOWED_MIME_TYPES,
    })
    if (updateError) {
      logError("Page assets bucket update failed", { error: String(updateError) })
    }
    return
  }

  const { error: createError } = await serviceClient.storage.createBucket(PAGE_ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: IMAGE_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: IMAGE_ALLOWED_MIME_TYPES,
  })

  if (createError && !String(createError.message).toLowerCase().includes("already exists")) {
    throw createError
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const serviceClient = createServiceClient()
    const auditMeta = extractRequestAuditContext(req)
    const formData = await req.formData()
    const slug = sanitizeSlug(String(formData.get("slug") ?? "").trim())
    const replacePath = String(formData.get("replacePath") ?? "").trim() || null
    const file = formData.get("file")

    if (!slug) {
      throw badRequest("slug e obrigatorio")
    }
    if (!(file instanceof File)) {
      throw badRequest("file e obrigatorio")
    }
    if (file.size === 0) {
      throw badRequest("O ficheiro enviado esta vazio")
    }
    if (file.size > IMAGE_MAX_FILE_SIZE_BYTES) {
      throw badRequest("A imagem excede o limite de 10MB")
    }

    const fileExtension = getFileExtension(file.name)
    if (!IMAGE_ALLOWED_EXTENSIONS.has(fileExtension)) {
      throw badRequest("Formato invalido. Use PNG, JPG, WEBP, GIF, AVIF ou SVG.")
    }

    const contentType = normalizeMimeType(file.type || null, fileExtension)
    if (!contentType || !IMAGE_ALLOWED_MIME_TYPES.includes(contentType)) {
      throw badRequest("Formato invalido. Use PNG, JPG, WEBP, GIF, AVIF ou SVG.")
    }

    const { data: page, error: pageError } = await serviceClient
      .from("site_pages")
      .select("id,slug,title")
      .eq("slug", slug)
      .maybeSingle()

    if (pageError) throw pageError
    if (!page) throw badRequest("Pagina nao encontrada")

    await ensureStorageBucket(serviceClient)

    const fileNameBase = sanitizeSegment(file.name.replace(/\.[^.]+$/, "")) || "imagem"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const objectPath = `pages/${slug}/${timestamp}-${crypto.randomUUID()}-${fileNameBase}.${fileExtension}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await serviceClient.storage
      .from(PAGE_ASSETS_BUCKET)
      .upload(objectPath, arrayBuffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    if (replacePath && replacePath !== objectPath) {
      const { error: removeError } = await serviceClient.storage.from(PAGE_ASSETS_BUCKET).remove([replacePath])
      if (removeError) {
        logError("Page asset replace cleanup failed", {
          request_id: requestId,
          replace_path: replacePath,
          error: String(removeError),
        })
      }
    }

    const publicUrl = serviceClient.storage.from(PAGE_ASSETS_BUCKET).getPublicUrl(objectPath).data.publicUrl

    const { data: asset, error: assetError } = await serviceClient
      .from("site_page_assets")
      .insert({
        page_id: page.id,
        bucket: PAGE_ASSETS_BUCKET,
        path: objectPath,
        public_url: publicUrl,
        file_name: file.name,
        mime_type: contentType,
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
        bucket: PAGE_ASSETS_BUCKET,
        path: objectPath,
        mime_type: contentType,
        file_size_bytes: file.size,
      },
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      asset,
      upload: {
        bucket: PAGE_ASSETS_BUCKET,
        path: objectPath,
        public_url: publicUrl,
        file_name: file.name,
        mime_type: contentType,
        file_size_bytes: file.size,
        uploaded_at: asset.created_at,
      },
    })
  } catch (error) {
    logError("Admin page assets failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
