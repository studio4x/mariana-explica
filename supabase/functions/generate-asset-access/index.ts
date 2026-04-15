import { badRequest, forbidden } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { getOptionalAuth, requireActiveUser } from "../_shared/auth.ts"
import { createServiceClient } from "../_shared/supabase.ts"

interface GenerateAssetAccessInput {
  assetId?: string
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

  if (error) {
    throw error
  }

  return Boolean(data)
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Método não suportado")
    }

    const optionalContext = await getOptionalAuth(req)
    const body = await readJsonBody<GenerateAssetAccessInput>(req)

    if (!body.assetId) {
      throw badRequest("assetId é obrigatório")
    }

    const client = createServiceClient()

    const { data: asset, error: assetError } = await client
      .from("module_assets")
      .select(
        "id,module_id,asset_type,title,storage_bucket,storage_path,external_url,allow_download,allow_stream,watermark_enabled,status",
      )
      .eq("id", body.assetId)
      .maybeSingle()

    if (assetError) {
      throw assetError
    }

    if (!asset) {
      throw forbidden("Asset indisponível")
    }

    const { data: moduleRow, error: moduleError } = await client
      .from("product_modules")
      .select("id,product_id,title,access_type,is_preview,status")
      .eq("id", asset.module_id)
      .maybeSingle()

    if (moduleError) {
      throw moduleError
    }

    if (!moduleRow) {
      throw forbidden("Módulo indisponível")
    }

    const { data: productRow, error: productError } = await client
      .from("products")
      .select("id,slug,title,product_type,status")
      .eq("id", moduleRow.product_id)
      .maybeSingle()

    if (productError) {
      throw productError
    }

    if (!productRow) {
      throw forbidden("Produto indisponível")
    }

    const module = moduleRow as ModuleRow
    const product = productRow as ProductRow

    if (asset.status !== "active" || module.status !== "published" || product.status !== "published") {
      throw forbidden("Conteúdo indisponível")
    }

    const moduleAllowsPublicAccess = module.access_type === "public" || module.is_preview
    const activeContext = optionalContext ? await requireActiveUser(req) : null
    const userHasPaidAccess = Boolean(
      activeContext && (await hasPaidAccess(client, activeContext.user.id, product.id)),
    )

    const canAccess =
      moduleAllowsPublicAccess ||
      (module.access_type === "registered" && activeContext?.profile.status === "active") ||
      (module.access_type === "paid_only" && userHasPaidAccess)

    if (!canAccess) {
      throw forbidden("Você não possui acesso a este conteúdo")
    }

    if (asset.external_url) {
      logInfo("External asset access granted", {
        request_id: requestId,
        user_id: activeContext?.user.id ?? null,
        asset_id: asset.id,
        product_id: product.id,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        mode: "external_url",
        url: asset.external_url,
        allow_download: asset.allow_download,
        allow_stream: asset.allow_stream,
        watermark_enabled: asset.watermark_enabled,
      })
    }

    if (!asset.storage_bucket || !asset.storage_path) {
      throw forbidden("Asset sem origem de armazenamento")
    }

    const signed = await client.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 300)

    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error ?? forbidden("Não foi possível gerar acesso temporário")
    }

    logInfo("Signed asset access granted", {
      request_id: requestId,
      user_id: activeContext?.user.id ?? null,
      asset_id: asset.id,
      product_id: product.id,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      mode: "signed_url",
      url: signed.data.signedUrl,
      expires_in_seconds: 300,
      allow_download: asset.allow_download,
      allow_stream: asset.allow_stream,
      watermark_enabled: asset.watermark_enabled,
    })
  } catch (error) {
    logError("Asset access failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
