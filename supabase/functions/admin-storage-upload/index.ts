import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const COURSE_STORAGE_BUCKET = "course-assets-private"
const COURSE_COVER_BUCKET = "course-cover-public"
const COURSE_COVER_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
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

async function ensureStorageBucket(
  serviceClient: ReturnType<typeof createServiceClient>,
  bucketName: string,
  options: { public: boolean; fileSizeLimit: string; allowedMimeTypes: string[] },
) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()
  if (bucketsError) throw bucketsError

  if ((buckets ?? []).some((bucket) => bucket.name === bucketName)) {
    const { error: updateBucketError } = await serviceClient.storage.updateBucket(bucketName, options)

    if (updateBucketError) {
      logError("Admin storage bucket update failed", {
        bucket: bucketName,
        error: String(updateBucketError),
      })
    }

    return
  }

  const { error: createBucketError } = await serviceClient.storage.createBucket(bucketName, options)

  if (createBucketError && !String(createBucketError.message).toLowerCase().includes("already exists")) {
    throw createBucketError
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
    const auditMeta = extractRequestAuditContext(req)
    const formData = await req.formData()
    const kind = String(formData.get("kind") ?? "").trim()
    const moduleId = String(formData.get("moduleId") ?? "").trim()
    const productId = String(formData.get("productId") ?? "").trim()
    const replacePath = String(formData.get("replacePath") ?? "").trim() || null
    const file = formData.get("file")

    if (!["module_pdf", "module_asset", "watermark_logo", "product_cover"].includes(kind)) {
      throw badRequest("kind invalido")
    }
    if (!(file instanceof File)) {
      throw badRequest("file e obrigatorio")
    }
    if (file.size === 0) {
      throw badRequest("O ficheiro enviado esta vazio")
    }

    const safeExtension = getFileExtension(file.name)
    const contentType = file.type || inferImageMimeType(safeExtension) || null
    const fileNameBase = sanitizeSegment(file.name.replace(/\.[^.]+$/, "")) || "arquivo"
    const timeStamp = new Date().toISOString().replace(/[:.]/g, "-")
    let objectPath = ""
    let auditAction = ""
    let auditEntityType = ""
    let auditEntityId = moduleId || productId || context.user.id
    let targetBucket = COURSE_STORAGE_BUCKET
    let auditMetadata: Record<string, unknown> = {
      file_name: file.name,
      mime_type: contentType,
      file_size_bytes: file.size,
    }

    if (kind === "watermark_logo") {
      objectPath = `site-config/module-pdf-watermark/logo/${timeStamp}-${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
      auditAction = "admin.watermark_logo_uploaded"
      auditEntityType = "site_config"
      auditEntityId = "module_pdf_watermark"
      await ensureStorageBucket(context.serviceClient, COURSE_STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: "50MB",
        allowedMimeTypes: ["application/pdf", "video/mp4", "video/webm", "image/png", "image/jpeg"],
      })
    } else if (kind === "product_cover") {
      if (!productId) throw badRequest("productId e obrigatorio")

      const { data: productRow, error: productError } = await context.serviceClient
        .from("products")
        .select("id,slug,title")
        .eq("id", productId)
        .maybeSingle()

      if (productError) throw productError
      if (!productRow) throw badRequest("Curso nao encontrado")

      await ensureStorageBucket(context.serviceClient, COURSE_COVER_BUCKET, {
        public: true,
        fileSizeLimit: "10MB",
        allowedMimeTypes: COURSE_COVER_ALLOWED_MIME_TYPES,
      })

      if (!contentType || !COURSE_COVER_ALLOWED_MIME_TYPES.includes(contentType)) {
        throw badRequest("Formato de capa invalido. Use PNG, JPG, WEBP, GIF ou AVIF.")
      }

      targetBucket = COURSE_COVER_BUCKET
      objectPath = `products/${productId}/cover/${timeStamp}-${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
      auditAction = "admin.product_cover_uploaded"
      auditEntityType = "product"
      auditEntityId = productId
      auditMetadata = {
        ...auditMetadata,
        product_id: productId,
        product_slug: productRow.slug,
      }
    } else {
      if (!moduleId) throw badRequest("moduleId e obrigatorio")

      const { data: moduleRow, error: moduleError } = await context.serviceClient
        .from("product_modules")
        .select("id,product_id,title")
        .eq("id", moduleId)
        .maybeSingle()

      if (moduleError) throw moduleError
      if (!moduleRow) throw badRequest("Modulo nao encontrado")

      await ensureStorageBucket(context.serviceClient, COURSE_STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: "50MB",
        allowedMimeTypes: ["application/pdf", "video/mp4", "video/webm", "image/png", "image/jpeg"],
      })

      objectPath =
        kind === "module_pdf"
          ? `products/${moduleRow.product_id}/modules/${moduleId}/module-pdf/${timeStamp}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
          : `products/${moduleRow.product_id}/modules/${moduleId}/assets/${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`

      auditAction = kind === "module_pdf" ? "admin.module_pdf_uploaded" : "admin.module_asset_uploaded"
      auditEntityType = kind === "module_pdf" ? "product_module" : "module_asset_upload"
      auditMetadata = {
        ...auditMetadata,
        module_id: moduleId,
        product_id: moduleRow.product_id,
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await context.serviceClient.storage
      .from(targetBucket)
      .upload(objectPath, arrayBuffer, {
        upsert: false,
        contentType: contentType || undefined,
      })

    if (uploadError) throw uploadError

    if (replacePath && replacePath !== objectPath) {
      const { error: removeError } = await context.serviceClient.storage
        .from(targetBucket)
        .remove([replacePath])

      if (removeError) {
        logError("Admin storage replace cleanup failed", {
        request_id: requestId,
        replace_path: replacePath,
        bucket: targetBucket,
        error: String(removeError),
      })
      }
    }

    await writeAuditLog(context.serviceClient, context, {
      action: auditAction,
      entityType: auditEntityType,
      entityId: auditEntityId,
      metadata: {
        ...auditMetadata,
        bucket: targetBucket,
        path: objectPath,
      },
      ...auditMeta,
    })

    const publicUploadUrl =
      targetBucket === COURSE_COVER_BUCKET
        ? context.serviceClient.storage.from(targetBucket).getPublicUrl(objectPath).data.publicUrl
        : null

    return jsonResponse({
      success: true,
      request_id: requestId,
      upload: {
        bucket: targetBucket,
        path: objectPath,
        file_name: file.name,
        mime_type: contentType,
        file_size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
        public_url: publicUploadUrl,
      },
    })
  } catch (error) {
    logError("Admin storage upload failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
