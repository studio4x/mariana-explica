import { badRequest, forbidden } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { getOptionalAuth, isAdminProfile, requireActiveUser } from "../_shared/auth.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { extractRequestAuditContext, writeAuditLog } from "../_shared/mod.ts"
import { createSignedReadUrl } from "../_shared/storage-provider.ts"

interface GenerateAssetAccessInput {
  assetId?: string
  lessonId?: string
}

interface ModuleRow {
  id: string
  product_id: string
  title: string
  access_type: "public" | "registered" | "paid_only"
  is_preview: boolean
  status: "draft" | "published" | "archived"
}

interface ProductRow {
  id: string
  slug: string
  title: string
  product_type: "paid" | "free" | "hybrid" | "external_service"
  status: "draft" | "published" | "archived"
}

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

async function hasPaidAccess(
  client: ReturnType<typeof createServiceClient>,
  userId: string,
  productId: string,
) {
  const { data, error } = await client
    .from("access_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("status", "active")
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")

    const optionalContext = await getOptionalAuth(req)
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<GenerateAssetAccessInput>(req)
    const hasAssetId = Boolean(body.assetId)
    const hasLessonId = Boolean(body.lessonId)

    if (hasAssetId === hasLessonId) {
      throw badRequest("assetId ou lessonId e obrigatorio")
    }

    const client = createServiceClient()
    let resource: {
      id: string
      module_id: string
      title: string
      status: "active" | "inactive" | "draft" | "published" | "archived"
      external_url: string | null
      allow_download: boolean
      allow_stream: boolean
      watermark_enabled: boolean
      storage_bucket: string | null
      storage_path: string | null
      storage_provider: "supabase" | "r2" | null
      file_name: string | null
      resource_type: "module_asset" | "product_lesson"
    }

    if (hasAssetId) {
      const { data, error } = await client
        .from("module_assets")
        .select(
          "id,module_id,asset_type,title,storage_bucket,storage_path,storage_provider,external_url,allow_download,allow_stream,watermark_enabled,status",
        )
        .eq("id", body.assetId as string)
        .maybeSingle()
      if (error) throw error
      if (!data) throw forbidden("Asset indisponivel")

      resource = {
        ...data,
        file_name: null,
        resource_type: "module_asset",
      }
    } else {
      const { data, error } = await client
        .from("product_lessons")
        .select(
          "id,module_id,title,status,lesson_type,lesson_file_storage_bucket,lesson_file_storage_path,lesson_file_storage_provider,lesson_file_name,lesson_file_mime_type",
        )
        .eq("id", body.lessonId as string)
        .maybeSingle()
      if (error) throw error
      if (!data || data.lesson_type !== "file") throw forbidden("Ficheiro da aula indisponivel")

      resource = {
        id: data.id,
        module_id: data.module_id,
        title: data.title,
        status: data.status,
        external_url: null,
        allow_download: false,
        allow_stream: false,
        watermark_enabled: false,
        storage_bucket: data.lesson_file_storage_bucket,
        storage_path: data.lesson_file_storage_path,
        storage_provider: data.lesson_file_storage_provider,
        file_name: data.lesson_file_name,
        resource_type: "product_lesson",
      }
    }

    const { data: moduleRow, error: moduleError } = await client
      .from("product_modules")
      .select("id,product_id,title,access_type,is_preview,status")
      .eq("id", resource.module_id)
      .maybeSingle()
    if (moduleError) throw moduleError
    if (!moduleRow) throw forbidden("Modulo indisponivel")

    const { data: productRow, error: productError } = await client
      .from("products")
      .select("id,slug,title,product_type,status")
      .eq("id", moduleRow.product_id)
      .maybeSingle()
    if (productError) throw productError
    if (!productRow) throw forbidden("Produto indisponivel")

    const module = moduleRow as ModuleRow
    const product = productRow as ProductRow
    const activeContext = optionalContext ? await requireActiveUser(req) : null
    const isAdminRequester = Boolean(activeContext && isAdminProfile(activeContext.profile))

    if (!isAdminRequester && (resource.status !== "active" && resource.status !== "published" || module.status !== "published" || product.status !== "published")) {
      throw forbidden("Conteudo indisponivel")
    }

    const moduleAllowsPublicAccess = module.access_type === "public" || module.is_preview
    const userHasPaidAccess = Boolean(
      activeContext && (await hasPaidAccess(client, activeContext.user.id, product.id)),
    )
    const canAccess =
      isAdminRequester ||
      moduleAllowsPublicAccess ||
      (module.access_type === "registered" && activeContext?.profile.status === "active") ||
      (module.access_type === "paid_only" && userHasPaidAccess)

    if (!canAccess) throw forbidden("Voce nao possui acesso a este conteudo")

    if (resource.external_url) {
      if (activeContext) {
        await writeAuditLog(client, activeContext, {
          action: "student.asset_access_requested",
          entityType: resource.resource_type,
          entityId: resource.id,
          metadata: { asset_id: resource.id, module_id: resource.module_id, product_id: product.id, mode: "external_url" },
          ...auditMeta,
        })
      }

      return jsonResponse({
        success: true,
        request_id: requestId,
        mode: "external_url",
        url: resource.external_url,
        allow_download: resource.allow_download,
        allow_stream: resource.allow_stream,
        watermark_enabled: resource.watermark_enabled,
      })
    }

    if (!resource.storage_bucket || !resource.storage_path) throw forbidden("Conteudo sem origem de armazenamento")

    const signedUrl = await createSignedReadUrl({
      serviceClient: client,
      logicalBucket: resource.storage_bucket,
      storagePath: resource.storage_path,
      provider: resource.storage_provider ?? "supabase",
      expiresInSeconds: 300,
      downloadFileName:
        resource.allow_download && activeContext
          ? sanitizeSegment(`${product.title}-${resource.title}-${activeContext.user.id.slice(0, 8)}`)
          : null,
    })

    if (activeContext) {
      await writeAuditLog(client, activeContext, {
        action: resource.resource_type === "product_lesson" ? "student.lesson_file_access_requested" : "student.asset_access_requested",
        entityType: resource.resource_type,
        entityId: resource.id,
        metadata: {
          asset_id: resource.resource_type === "module_asset" ? resource.id : null,
          lesson_id: resource.resource_type === "product_lesson" ? resource.id : null,
          module_id: resource.module_id,
          product_id: product.id,
          mode: "signed_url",
          allow_download: resource.allow_download,
          storage_path: resource.storage_path,
        },
        ...auditMeta,
      })
    }

    logInfo("Signed content access granted", {
      request_id: requestId,
      user_id: activeContext?.user.id ?? null,
      resource_id: resource.id,
      resource_type: resource.resource_type,
      product_id: product.id,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      mode: "signed_url",
      url: signedUrl,
      file_name: resource.file_name,
      expires_in_seconds: 300,
      allow_download: resource.allow_download,
      allow_stream: resource.allow_stream,
      watermark_enabled: resource.watermark_enabled,
    })
  } catch (error) {
    logError("Content access failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
