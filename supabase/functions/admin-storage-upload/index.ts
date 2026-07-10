import {
  badRequest,
  corsResponse,
  errorResponse,
  extractRequestAuditContext,
  getRequestId,
  isAdminProfile,
  jsonResponse,
  logError,
  readJsonBody,
  requireActiveUser,
  writeAuditLog,
} from "../_shared/mod.ts"
import {
  createSignedUploadTicket,
  deleteStorageObject,
  getStorageLimits,
  type PublicProxyKind,
  type StorageProvider,
} from "../_shared/storage-provider.ts"

type UploadKind =
  | "module_pdf"
  | "module_asset"
  | "product_cover"
  | "branding_asset"
  | "watermark_logo"
  | "profile_avatar"
  | "support_attachment"
  | "site_page_asset"

interface Body {
  operation: "prepare_upload" | "delete_object" | "get_upload_limits"
  upload_kind?: UploadKind
  entity_id?: string | null
  file_name?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  replace_path?: string | null
  asset_role?: string | null
  storage_bucket?: string | null
  storage_path?: string | null
  storage_provider?: StorageProvider | null
}

const COURSE_STORAGE_BUCKET = "course-assets-private"
const COURSE_COVER_BUCKET = "course-cover-public"
const SITE_BRANDING_BUCKET = "site-branding-public"
const PROFILE_AVATAR_BUCKET = "profile-avatars-public"
const SUPPORT_BUCKET = "support-attachments"
const SITE_PAGE_BUCKET = "site-pages-public"

const COURSE_COVER_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
  "image/avif",
])

const BRANDING_ALLOWED_MIME_TYPES = new Set([
  ...COURSE_COVER_ALLOWED_MIME_TYPES,
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
])

const PRIVATE_ASSET_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "image/png",
  "image/jpeg",
])

const SUPPORT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

const PUBLIC_PAGE_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
])

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

function asPositiveInteger(value: unknown) {
  const parsed = Number(value ?? null)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw badRequest("file_size_bytes invalido")
  }

  return Math.trunc(parsed)
}

function ensureMimeType(value: unknown, fileName: string) {
  const raw = String(value ?? "").trim().toLowerCase()
  return raw || inferImageMimeType(getFileExtension(fileName)) || "application/octet-stream"
}

function requireAdminUpload(context: Awaited<ReturnType<typeof requireActiveUser>>) {
  if (!isAdminProfile(context.profile)) {
    throw badRequest("Acesso administrativo obrigatorio para este upload")
  }
}

async function resolveModulePathMeta(
  context: Awaited<ReturnType<typeof requireActiveUser>>,
  moduleId: string,
  fileNameBase: string,
  extension: string,
  kind: "module_pdf" | "module_asset",
) {
  const { data: moduleRow, error } = await context.serviceClient
    .from("product_modules")
    .select("id,product_id,title")
    .eq("id", moduleId)
    .maybeSingle()

  if (error) throw error
  if (!moduleRow) throw badRequest("Modulo nao encontrado")

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const storagePath =
    kind === "module_pdf"
      ? `products/${moduleRow.product_id}/modules/${moduleId}/module-pdf/${timestamp}-${fileNameBase}${extension ? `.${extension}` : ""}`
      : `products/${moduleRow.product_id}/modules/${moduleId}/assets/${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`

  return {
    logicalBucket: COURSE_STORAGE_BUCKET,
    storagePath,
    publicProxyKind: null as PublicProxyKind | null,
    auditEntityType: "product_module",
    auditEntityId: moduleId,
    metadata: {
      module_id: moduleId,
      product_id: moduleRow.product_id,
    },
  }
}

async function resolveUploadTarget(
  context: Awaited<ReturnType<typeof requireActiveUser>>,
  body: Body,
) {
  const uploadKind = body.upload_kind
  if (!uploadKind) {
    throw badRequest("upload_kind e obrigatorio")
  }

  const fileName = String(body.file_name ?? "").trim()
  if (!fileName) {
    throw badRequest("file_name e obrigatorio")
  }

  const fileSizeBytes = asPositiveInteger(body.file_size_bytes)
  const extension = getFileExtension(fileName)
  const fileNameBase = sanitizeSegment(fileName.replace(/\.[^.]+$/, "")) || "arquivo"
  let mimeType = ensureMimeType(body.mime_type, fileName)
  const { maxFileSizeBytes } = getStorageLimits()

  if (fileSizeBytes > maxFileSizeBytes) {
    throw badRequest(`O ficheiro excede o limite configurado de ${maxFileSizeBytes} bytes.`)
  }

  if (uploadKind === "module_pdf" || uploadKind === "module_asset") {
    requireAdminUpload(context)
    if (!PRIVATE_ASSET_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest("Formato de ficheiro privado invalido.")
    }

    return {
      ...(await resolveModulePathMeta(context, String(body.entity_id ?? "").trim(), fileNameBase, extension, uploadKind)),
      mimeType,
      fileName,
      fileSizeBytes,
    }
  }

  if (uploadKind === "product_cover") {
    requireAdminUpload(context)
    const productId = String(body.entity_id ?? "").trim()
    if (!productId) throw badRequest("entity_id do produto e obrigatorio")

    const { data: productRow, error } = await context.serviceClient
      .from("products")
      .select("id,slug")
      .eq("id", productId)
      .maybeSingle()

    if (error) throw error
    if (!productRow) throw badRequest("Material nao encontrado")
    if (!COURSE_COVER_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest("Formato de capa invalido.")
    }

    return {
      logicalBucket: COURSE_COVER_BUCKET,
      storagePath: `products/${productId}/cover/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`,
      publicProxyKind: "course_media" as PublicProxyKind,
      auditEntityType: "product",
      auditEntityId: productId,
      metadata: {
        product_id: productId,
        product_slug: productRow.slug,
      },
      mimeType,
      fileName,
      fileSizeBytes,
    }
  }

  if (uploadKind === "branding_asset") {
    requireAdminUpload(context)
    const assetRole = sanitizeSegment(String(body.asset_role ?? "").trim())
    if (!["logo_light", "logo_dark", "favicon"].includes(assetRole)) {
      throw badRequest("asset_role invalido")
    }

    mimeType = normalizeBrandingMimeType(mimeType, extension) ?? mimeType
    if (!BRANDING_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest("Formato de branding invalido.")
    }

    return {
      logicalBucket: SITE_BRANDING_BUCKET,
      storagePath: `${assetRole}/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`,
      publicProxyKind: "site_asset" as PublicProxyKind,
      auditEntityType: "site_config",
      auditEntityId: null,
      metadata: {
        asset_role: assetRole,
        config_key: "site_branding",
      },
      mimeType,
      fileName,
      fileSizeBytes,
    }
  }

  if (uploadKind === "watermark_logo") {
    requireAdminUpload(context)
    if (!BRANDING_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest("Formato de watermark invalido.")
    }

    return {
      logicalBucket: COURSE_STORAGE_BUCKET,
      storagePath: `site-config/module-pdf-watermark/logo/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`,
      publicProxyKind: null as PublicProxyKind | null,
      auditEntityType: "site_config",
      auditEntityId: null,
      metadata: {
        config_key: "module_pdf_watermark",
      },
      mimeType,
      fileName,
      fileSizeBytes,
    }
  }

  if (uploadKind === "profile_avatar") {
    if (!COURSE_COVER_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest("Formato de avatar invalido.")
    }

    return {
      logicalBucket: PROFILE_AVATAR_BUCKET,
      storagePath: `profiles/${context.user.id}/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`,
      publicProxyKind: "profile_avatar" as PublicProxyKind,
      auditEntityType: "profile",
      auditEntityId: context.user.id,
      metadata: {
        user_id: context.user.id,
      },
      mimeType,
      fileName,
      fileSizeBytes,
    }
  }

  if (uploadKind === "support_attachment") {
    if (!SUPPORT_ALLOWED_MIME_TYPES.has(mimeType)) {
      throw badRequest("Formato de anexo invalido.")
    }

    const scope = sanitizeSegment(String(body.entity_id ?? "").trim()) || "draft"
    return {
      logicalBucket: SUPPORT_BUCKET,
      storagePath: `support/${context.user.id}/${scope}/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`,
      publicProxyKind: null as PublicProxyKind | null,
      auditEntityType: "support_attachment",
      auditEntityId: context.user.id,
      metadata: {
        user_id: context.user.id,
        scope,
      },
      mimeType,
      fileName,
      fileSizeBytes,
    }
  }

  requireAdminUpload(context)
  const slug = sanitizeSlug(String(body.entity_id ?? "").trim())
  if (!slug) throw badRequest("entity_id da pagina e obrigatorio")
  if (!PUBLIC_PAGE_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw badRequest("Formato de asset publico invalido.")
  }

  return {
    logicalBucket: SITE_PAGE_BUCKET,
    storagePath: `pages/${slug}/${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`,
    publicProxyKind: "site_asset" as PublicProxyKind,
    auditEntityType: "site_page_asset_upload",
    auditEntityId: slug,
    metadata: {
      slug,
    },
    mimeType,
    fileName,
    fileSizeBytes,
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

    const context = await requireActiveUser(req)
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<Body>(req)

    if (body.operation === "get_upload_limits") {
      const { maxFileSizeBytes } = getStorageLimits()
      return jsonResponse({
        success: true,
        request_id: requestId,
        upload: {
          bucket: COURSE_STORAGE_BUCKET,
          max_file_size_bytes: maxFileSizeBytes,
        },
      })
    }

    if (body.operation === "delete_object") {
      requireAdminUpload(context)
      const storageBucket = String(body.storage_bucket ?? "").trim()
      const storagePath = String(body.storage_path ?? "").trim()

      if (!storageBucket || !storagePath) {
        throw badRequest("storage_bucket e storage_path sao obrigatorios")
      }

      await deleteStorageObject({
        serviceClient: context.serviceClient,
        logicalBucket: storageBucket,
        storagePath,
        provider: body.storage_provider ?? null,
      })

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.storage_object_deleted",
        entityType: "storage_object",
        entityId: null,
        metadata: {
          bucket: storageBucket,
          path: storagePath,
          provider: body.storage_provider ?? null,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId })
    }

    if (body.operation !== "prepare_upload") {
      throw badRequest("operation invalida")
    }

    const target = await resolveUploadTarget(context, body)
    const ticket = await createSignedUploadTicket({
      serviceClient: context.serviceClient,
      logicalBucket: target.logicalBucket,
      storagePath: target.storagePath,
      mimeType: target.mimeType,
      provider: body.storage_provider ?? undefined,
      publicProxyKind: target.publicProxyKind,
    })

    await writeAuditLog(context.serviceClient, context, {
      action: `storage.${body.upload_kind}.prepare_upload`,
      entityType: target.auditEntityType,
      entityId: target.auditEntityId,
      metadata: {
        ...target.metadata,
        bucket: target.logicalBucket,
        path: target.storagePath,
        provider: ticket.storage_provider,
        file_name: target.fileName,
        mime_type: target.mimeType,
        file_size_bytes: target.fileSizeBytes,
        replace_path: body.replace_path ?? null,
      },
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      upload: {
        ...ticket,
        max_file_size_bytes: getStorageLimits().maxFileSizeBytes,
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
