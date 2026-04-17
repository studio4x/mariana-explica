import { requireAdmin } from "../_shared/auth.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

type Action =
  | "list_modules"
  | "create_module"
  | "update_module"
  | "delete_module"
  | "list_assets"
  | "create_asset"
  | "update_asset"
  | "delete_asset"

type ModuleType = "pdf" | "video" | "external_link" | "mixed"
type AccessType = "public" | "registered" | "paid_only"
type ModuleStatus = "draft" | "published" | "archived"

type AssetType = "pdf" | "video_file" | "video_embed" | "external_link"
type AssetStatus = "active" | "inactive"

interface Body {
  action: Action

  productId?: string
  moduleId?: string
  assetId?: string

  title?: string
  description?: string | null
  module_type?: ModuleType
  access_type?: AccessType
  sort_order?: number
  is_preview?: boolean
  status?: ModuleStatus

  asset_type?: AssetType
  sort_order_asset?: number
  storage_bucket?: string | null
  storage_path?: string | null
  external_url?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  allow_download?: boolean
  allow_stream?: boolean
  watermark_enabled?: boolean
  asset_status?: AssetStatus
}

function requireUuid(value: string | undefined, label: string) {
  if (!value) {
    throw badRequest(`${label} é obrigatório`)
  }
  return value
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }
  const text = String(value).trim()
  return text.length ? text : null
}

function validateAssetSource(body: Body) {
  const externalUrl = normalizeNullableText(body.external_url)
  const bucket = normalizeNullableText(body.storage_bucket)
  const path = normalizeNullableText(body.storage_path)

  const hasExternal = Boolean(externalUrl)
  const hasStorage = Boolean(bucket && path)

  if (hasExternal === hasStorage) {
    throw badRequest("Informe external_url OU storage_bucket + storage_path")
  }

  return {
    external_url: externalUrl,
    storage_bucket: hasStorage ? bucket : null,
    storage_path: hasStorage ? path : null,
  }
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

    const context = await requireAdmin(req)
    const body = await readJsonBody<Body>(req)
    const serviceClient = createServiceClient()

    if (!body.action) {
      throw badRequest("action é obrigatório")
    }

    if (body.action === "list_modules") {
      const productId = requireUuid(body.productId, "productId")
      const { data, error } = await serviceClient
        .from("product_modules")
        .select("id,product_id,title,description,module_type,access_type,sort_order,is_preview,status,created_at,updated_at")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true })

      if (error) throw error

      return jsonResponse({ success: true, request_id: requestId, modules: data ?? [] })
    }

    if (body.action === "create_module") {
      const productId = requireUuid(body.productId, "productId")
      const title = normalizeNullableText(body.title)
      if (!title) throw badRequest("title é obrigatório")

      const { data, error } = await serviceClient
        .from("product_modules")
        .insert({
          product_id: productId,
          title,
          description: normalizeNullableText(body.description),
          module_type: body.module_type ?? "pdf",
          access_type: body.access_type ?? "paid_only",
          sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 0,
          is_preview: Boolean(body.is_preview),
          status: body.status ?? "published",
        })
        .select("id,product_id,title,description,module_type,access_type,sort_order,is_preview,status")
        .single()

      if (error) throw error

      logInfo("Admin module created", { request_id: requestId, user_id: context.user.id, module_id: data.id })
      return jsonResponse({ success: true, request_id: requestId, module: data })
    }

    if (body.action === "update_module") {
      const moduleId = requireUuid(body.moduleId, "moduleId")

      const payload: Record<string, unknown> = {}
      if (body.title !== undefined) payload.title = normalizeNullableText(body.title)
      if (body.description !== undefined) payload.description = normalizeNullableText(body.description)
      if (body.module_type !== undefined) payload.module_type = body.module_type
      if (body.access_type !== undefined) payload.access_type = body.access_type
      if (body.sort_order !== undefined) payload.sort_order = body.sort_order
      if (body.is_preview !== undefined) payload.is_preview = Boolean(body.is_preview)
      if (body.status !== undefined) payload.status = body.status

      const { data, error } = await serviceClient
        .from("product_modules")
        .update(payload)
        .eq("id", moduleId)
        .select("id,product_id,title,description,module_type,access_type,sort_order,is_preview,status")
        .single()

      if (error) throw error

      return jsonResponse({ success: true, request_id: requestId, module: data })
    }

    if (body.action === "delete_module") {
      const moduleId = requireUuid(body.moduleId, "moduleId")
      const { error } = await serviceClient.from("product_modules").delete().eq("id", moduleId)
      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId })
    }

    if (body.action === "list_assets") {
      const moduleId = requireUuid(body.moduleId, "moduleId")
      const { data, error } = await serviceClient
        .from("module_assets")
        .select("id,module_id,asset_type,title,sort_order,storage_bucket,storage_path,external_url,mime_type,file_size_bytes,allow_download,allow_stream,watermark_enabled,status,created_at,updated_at")
        .eq("module_id", moduleId)
        .order("sort_order", { ascending: true })

      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId, assets: data ?? [] })
    }

    if (body.action === "create_asset") {
      const moduleId = requireUuid(body.moduleId, "moduleId")
      const title = normalizeNullableText(body.title)
      if (!title) throw badRequest("title é obrigatório")
      if (!body.asset_type) throw badRequest("asset_type é obrigatório")

      const source = validateAssetSource(body)

      const { data, error } = await serviceClient
        .from("module_assets")
        .insert({
          module_id: moduleId,
          asset_type: body.asset_type,
          title,
          sort_order: Number.isFinite(body.sort_order_asset) ? body.sort_order_asset : 0,
          ...source,
          mime_type: normalizeNullableText(body.mime_type),
          file_size_bytes: body.file_size_bytes ?? null,
          allow_download: Boolean(body.allow_download),
          allow_stream: body.allow_stream !== undefined ? Boolean(body.allow_stream) : true,
          watermark_enabled: Boolean(body.watermark_enabled),
          status: body.asset_status ?? "active",
        })
        .select("id,module_id,asset_type,title,sort_order,storage_bucket,storage_path,external_url,mime_type,file_size_bytes,allow_download,allow_stream,watermark_enabled,status")
        .single()

      if (error) throw error

      return jsonResponse({ success: true, request_id: requestId, asset: data })
    }

    if (body.action === "update_asset") {
      const assetId = requireUuid(body.assetId, "assetId")

      const payload: Record<string, unknown> = {}
      if (body.title !== undefined) payload.title = normalizeNullableText(body.title)
      if (body.asset_type !== undefined) payload.asset_type = body.asset_type
      if (body.sort_order_asset !== undefined) payload.sort_order = body.sort_order_asset
      if (
        body.external_url !== undefined ||
        body.storage_bucket !== undefined ||
        body.storage_path !== undefined
      ) {
        Object.assign(payload, validateAssetSource(body))
      }
      if (body.mime_type !== undefined) payload.mime_type = normalizeNullableText(body.mime_type)
      if (body.file_size_bytes !== undefined) payload.file_size_bytes = body.file_size_bytes
      if (body.allow_download !== undefined) payload.allow_download = Boolean(body.allow_download)
      if (body.allow_stream !== undefined) payload.allow_stream = Boolean(body.allow_stream)
      if (body.watermark_enabled !== undefined) payload.watermark_enabled = Boolean(body.watermark_enabled)
      if (body.asset_status !== undefined) payload.status = body.asset_status

      const { data, error } = await serviceClient
        .from("module_assets")
        .update(payload)
        .eq("id", assetId)
        .select("id,module_id,asset_type,title,sort_order,storage_bucket,storage_path,external_url,mime_type,file_size_bytes,allow_download,allow_stream,watermark_enabled,status")
        .single()

      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId, asset: data })
    }

    if (body.action === "delete_asset") {
      const assetId = requireUuid(body.assetId, "assetId")
      const { error } = await serviceClient.from("module_assets").delete().eq("id", assetId)
      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId })
    }

    throw badRequest("action inválida")
  } catch (error) {
    logError("Admin content failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})

