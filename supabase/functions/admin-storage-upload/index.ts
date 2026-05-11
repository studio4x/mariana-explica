import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const COURSE_STORAGE_BUCKET = "course-assets-private"
const COURSE_COVER_BUCKET = "course-cover-public"
const SITE_BRANDING_BUCKET = "site-branding-public"
const COURSE_COVER_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]
const BRANDING_ALLOWED_MIME_TYPES = [
  ...COURSE_COVER_ALLOWED_MIME_TYPES,
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]
const BRANDING_ALLOWED_EXTENSIONS = new Set(["svg", "png", "jpg", "jpeg", "webp", "gif", "avif", "ico"])
const PRIVATE_ASSET_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "image/png",
  "image/jpeg",
]
const PRIVATE_ASSET_FILE_SIZE_LIMIT = "5GB"

function toPositiveNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.trunc(value)
}

function readBucketFileSizeLimitBytes(bucket: unknown) {
  if (!bucket || typeof bucket !== "object") {
    return null
  }

  const asRecord = bucket as Record<string, unknown>
  return toPositiveNumber(asRecord.file_size_limit ?? asRecord.fileSizeLimit ?? null)
}

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
    case "ico":
      return "image/x-icon"
    default:
      return null
  }
}

function normalizeBrandingMimeType(rawMimeType: string | null, extension: string) {
  const normalized = rawMimeType?.trim().toLowerCase() ?? ""

  if (!normalized || normalized === "application/octet-stream") {
    return inferImageMimeType(extension)
  }

  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg"
  }

  if (["image/x-icon", "image/vnd.microsoft.icon", "image/ico", "image/icon"].includes(normalized)) {
    return "image/x-icon"
  }

  return normalized
}

async function ensureStorageBucket(
  serviceClient: ReturnType<typeof createServiceClient>,
  bucketName: string,
  options: { public: boolean; fileSizeLimit: string; allowedMimeTypes: string[] },
) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()
  if (bucketsError) throw bucketsError

  const existingBucket = (buckets ?? []).find((bucket) => bucket.name === bucketName)

  if (existingBucket) {
    const { error: updateBucketError } = await serviceClient.storage.updateBucket(bucketName, options)

    if (updateBucketError) {
      logError("Admin storage bucket update failed", {
        bucket: bucketName,
        error: String(updateBucketError),
      })
    }

    const { data: refreshedBucket, error: refreshedBucketError } = await serviceClient.storage.getBucket(bucketName)

    if (refreshedBucketError) {
      logError("Admin storage bucket read failed", {
        bucket: bucketName,
        error: String(refreshedBucketError),
      })
      return readBucketFileSizeLimitBytes(existingBucket)
    }

    return readBucketFileSizeLimitBytes(refreshedBucket) ?? readBucketFileSizeLimitBytes(existingBucket)
  }

  const { error: createBucketError } = await serviceClient.storage.createBucket(bucketName, options)

  if (createBucketError && !String(createBucketError.message).toLowerCase().includes("already exists")) {
    throw createBucketError
  }

  const { data: createdBucket, error: createdBucketError } = await serviceClient.storage.getBucket(bucketName)

  if (createdBucketError) {
    logError("Admin storage bucket post-create read failed", {
      bucket: bucketName,
      error: String(createdBucketError),
    })
    return null
  }

  return readBucketFileSizeLimitBytes(createdBucket)
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
    const assetRole = sanitizeSegment(String(formData.get("assetRole") ?? "").trim())
    const requestedFileName = String(formData.get("fileName") ?? "").trim()
    const requestedMimeType = String(formData.get("mimeType") ?? "").trim().toLowerCase()
    const replacePath = String(formData.get("replacePath") ?? "").trim() || null
    const file = formData.get("file")
    const isSignedUploadRequest = kind === "module_asset_signed_url"
    const isModuleLimitRequest = kind === "module_asset_limits"

    if (!["module_pdf", "module_asset", "watermark_logo", "product_cover", "branding_asset", "module_asset_signed_url", "module_asset_limits"].includes(kind)) {
      throw badRequest("kind invalido")
    }
    if (!isSignedUploadRequest && !isModuleLimitRequest && !(file instanceof File)) {
      throw badRequest("file e obrigatorio")
    }
    if (!isSignedUploadRequest && !isModuleLimitRequest && file.size === 0) {
      throw badRequest("O ficheiro enviado esta vazio")
    }

    const fileNameForSanitization =
      isSignedUploadRequest
        ? requestedFileName || "video.mp4"
        : isModuleLimitRequest
          ? "video.mp4"
          : file.name
    const safeExtension = getFileExtension(fileNameForSanitization)
    const rawContentType =
      isSignedUploadRequest
        ? (requestedMimeType || null)
        : isModuleLimitRequest
          ? "video/mp4"
          : (file.type || null)
    let contentType = rawContentType || inferImageMimeType(safeExtension) || null
    const fileNameBase = sanitizeSegment(fileNameForSanitization.replace(/\.[^.]+$/, "")) || "arquivo"
    const timeStamp = new Date().toISOString().replace(/[:.]/g, "-")
    let objectPath = ""
    let auditAction = ""
    let auditEntityType = ""
    let auditEntityId = moduleId || productId || context.user.id
    let targetBucket = COURSE_STORAGE_BUCKET
    let targetBucketFileSizeLimitBytes: number | null = null
    let auditMetadata: Record<string, unknown> = {
      file_name: fileNameForSanitization,
      mime_type: contentType,
      file_size_bytes: isSignedUploadRequest || isModuleLimitRequest ? null : file.size,
    }

    if (kind === "watermark_logo") {
      objectPath = `site-config/module-pdf-watermark/logo/${timeStamp}-${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
      auditAction = "admin.watermark_logo_uploaded"
      auditEntityType = "site_config"
      auditEntityId = null
      targetBucketFileSizeLimitBytes = await ensureStorageBucket(context.serviceClient, COURSE_STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: PRIVATE_ASSET_FILE_SIZE_LIMIT,
        allowedMimeTypes: PRIVATE_ASSET_ALLOWED_MIME_TYPES,
      })
      auditMetadata = {
        ...auditMetadata,
        config_key: "module_pdf_watermark",
      }
    } else if (kind === "branding_asset") {
      if (!["logo_light", "logo_dark", "favicon"].includes(assetRole)) {
        throw badRequest("assetRole invalido")
      }

      if (!BRANDING_ALLOWED_EXTENSIONS.has(safeExtension)) {
        throw badRequest("Formato de branding invalido. Use SVG, PNG, JPG, WEBP, GIF, AVIF ou ICO.")
      }

      contentType = normalizeBrandingMimeType(rawContentType, safeExtension)

      await ensureStorageBucket(context.serviceClient, SITE_BRANDING_BUCKET, {
        public: true,
        fileSizeLimit: "5MB",
        allowedMimeTypes: BRANDING_ALLOWED_MIME_TYPES,
      })

      if (!contentType || !BRANDING_ALLOWED_MIME_TYPES.includes(contentType)) {
        throw badRequest("Formato de branding invalido. Use SVG, PNG, JPG, WEBP, GIF, AVIF ou ICO.")
      }

      targetBucket = SITE_BRANDING_BUCKET
      objectPath = `${assetRole}/${timeStamp}-${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
      auditAction = "admin.branding_asset_uploaded"
      auditEntityType = "site_config"
      auditEntityId = null
      auditMetadata = {
        ...auditMetadata,
        config_key: "site_branding",
        asset_role: assetRole,
      }
    } else if (kind === "product_cover") {
      if (!productId) throw badRequest("productId e obrigatorio")

      const { data: productRow, error: productError } = await context.serviceClient
        .from("products")
        .select("id,slug,title")
        .eq("id", productId)
        .maybeSingle()

      if (productError) throw productError
      if (!productRow) throw badRequest("Material nao encontrado")

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

      targetBucketFileSizeLimitBytes = await ensureStorageBucket(context.serviceClient, COURSE_STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: PRIVATE_ASSET_FILE_SIZE_LIMIT,
        allowedMimeTypes: PRIVATE_ASSET_ALLOWED_MIME_TYPES,
      })

      objectPath =
        kind === "module_pdf"
          ? `products/${moduleRow.product_id}/modules/${moduleId}/module-pdf/${timeStamp}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
          : `products/${moduleRow.product_id}/modules/${moduleId}/assets/${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`

      auditAction =
        kind === "module_pdf"
          ? "admin.module_pdf_uploaded"
          : kind === "module_asset_signed_url"
            ? "admin.module_asset_signed_url_created"
            : "admin.module_asset_uploaded"
      auditEntityType =
        kind === "module_pdf"
          ? "product_module"
          : kind === "module_asset_signed_url"
            ? "module_asset_upload_url"
            : "module_asset_upload"
      auditMetadata = {
        ...auditMetadata,
        module_id: moduleId,
        product_id: moduleRow.product_id,
      }
    }

    if (kind === "module_asset_limits") {
      return jsonResponse({
        success: true,
        request_id: requestId,
        upload: {
          bucket: targetBucket,
          path: "",
          file_name: null,
          mime_type: null,
          file_size_bytes: null,
          max_file_size_bytes: targetBucketFileSizeLimitBytes,
          uploaded_at: null,
          public_url: null,
        },
      })
    }

    if (kind === "module_asset_signed_url") {
      if (!contentType || !PRIVATE_ASSET_ALLOWED_MIME_TYPES.includes(contentType)) {
        throw badRequest("Formato de video invalido. Use MP4, WEBM, OGG, MOV ou M4V.")
      }

      const { data: signedUpload, error: signedUploadError } = await context.serviceClient.storage
        .from(targetBucket)
        .createSignedUploadUrl(objectPath)

      if (signedUploadError) {
        throw signedUploadError
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

      return jsonResponse({
        success: true,
        request_id: requestId,
        upload: {
          bucket: targetBucket,
          path: objectPath,
          file_name: fileNameForSanitization,
          mime_type: contentType,
          file_size_bytes: null,
          max_file_size_bytes: targetBucketFileSizeLimitBytes,
          uploaded_at: null,
          public_url: null,
          signed_upload: {
            path: signedUpload.path,
            token: signedUpload.token,
            signed_url: signedUpload.signedUrl,
          },
        },
      })
    }

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await context.serviceClient.storage
      .from(targetBucket)
      .upload(objectPath, arrayBuffer, {
        upsert: false,
        contentType: contentType || undefined,
      })

    if (uploadError) {
      const uploadMessage = String(uploadError.message ?? uploadError)

      if (kind === "branding_asset") {
        if (/mime|content[- ]?type|format|file type|extension/i.test(uploadMessage)) {
          throw badRequest("Formato de branding invalido. Use SVG, PNG, JPG, WEBP, GIF, AVIF ou ICO.", {
            mime_type: contentType,
            extension: safeExtension,
          })
        }

        if (/size limit|payload too large|entity too large|file too large/i.test(uploadMessage)) {
          throw badRequest("O ficheiro de branding excede o limite de 5MB.")
        }
      }

      throw uploadError
    }

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
      targetBucket === COURSE_COVER_BUCKET || targetBucket === SITE_BRANDING_BUCKET
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
