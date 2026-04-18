import { badRequest } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

type ProductType = "paid" | "free" | "hybrid" | "external_service"
type ProductStatus = "draft" | "published" | "archived"

interface ProductPayload {
  slug: string
  title: string
  shortDescription?: string | null
  description?: string | null
  productType: ProductType
  priceCents: number
  currency?: string
  salesPageEnabled?: boolean
  requiresAuth?: boolean
  isFeatured?: boolean
  allowAffiliate?: boolean
  sortOrder?: number
  launchDate?: string | null
  isPublic?: boolean
  creatorId?: string | null
  creatorCommissionPercent?: number | null
  workloadMinutes?: number
  hasLinearProgression?: boolean
  quizTypeSettings?: Record<string, boolean>
}

type AdminProductsInput =
  | ({ action: "create" } & ProductPayload)
  | ({ action: "update"; productId: string } & Partial<ProductPayload> & { status?: ProductStatus })
  | { action: "publish"; productId: string }
  | { action: "archive"; productId: string }

function mapPayload(payload: Partial<ProductPayload>) {
  const updates: Record<string, unknown> = {}

  if (payload.slug !== undefined) updates.slug = payload.slug.trim()
  if (payload.title !== undefined) updates.title = payload.title.trim()
  if (payload.shortDescription !== undefined) updates.short_description = payload.shortDescription
  if (payload.description !== undefined) updates.description = payload.description
  if (payload.productType !== undefined) updates.product_type = payload.productType
  if (payload.priceCents !== undefined) updates.price_cents = payload.priceCents
  if (payload.currency !== undefined) updates.currency = payload.currency.toUpperCase()
  if (payload.salesPageEnabled !== undefined) updates.sales_page_enabled = payload.salesPageEnabled
  if (payload.requiresAuth !== undefined) updates.requires_auth = payload.requiresAuth
  if (payload.isFeatured !== undefined) updates.is_featured = payload.isFeatured
  if (payload.allowAffiliate !== undefined) updates.allow_affiliate = payload.allowAffiliate
  if (payload.sortOrder !== undefined) updates.sort_order = payload.sortOrder
  if (payload.launchDate !== undefined) updates.launch_date = payload.launchDate
  if (payload.isPublic !== undefined) updates.is_public = payload.isPublic
  if (payload.creatorId !== undefined) updates.creator_id = payload.creatorId
  if (payload.creatorCommissionPercent !== undefined) {
    updates.creator_commission_percent = payload.creatorCommissionPercent
  }
  if (payload.workloadMinutes !== undefined) updates.workload_minutes = payload.workloadMinutes
  if (payload.hasLinearProgression !== undefined) {
    updates.has_linear_progression = payload.hasLinearProgression
  }
  if (payload.quizTypeSettings !== undefined) updates.quiz_type_settings = payload.quizTypeSettings

  return updates
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("MÃ©todo nÃ£o suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<AdminProductsInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "create") {
      const payload = mapPayload(body)
      if (!payload.slug || !payload.title) {
        throw badRequest("slug e title sÃ£o obrigatÃ³rios")
      }

      const { data, error } = await context.serviceClient
        .from("products")
        .insert({
          ...payload,
          status: "draft",
        })
        .select("*")
        .single()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.product_created",
        entityType: "product",
        entityId: data.id,
        metadata: payload,
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, product: data })
    }

    if (!("productId" in body) || !body.productId) {
      throw badRequest("productId Ã© obrigatÃ³rio")
    }

    if (body.action === "publish" || body.action === "archive") {
      const status = body.action === "publish" ? "published" : "archived"
      const publishFields =
        body.action === "publish"
          ? { status, published_at: new Date().toISOString() }
          : { status }

      const { data, error } = await context.serviceClient
        .from("products")
        .update(publishFields)
        .eq("id", body.productId)
        .select("*")
        .single()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: `admin.product_${body.action}d`,
        entityType: "product",
        entityId: data.id,
        metadata: publishFields,
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, product: data })
    }

    const updates = mapPayload(body)
    if (body.status) {
      updates.status = body.status
      if (body.status === "published") {
        updates.published_at = new Date().toISOString()
      }
    }

    const { data, error } = await context.serviceClient
      .from("products")
      .update(updates)
      .eq("id", body.productId)
      .select("*")
      .single()

    if (error) {
      throw error
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.product_updated",
      entityType: "product",
      entityId: data.id,
      metadata: updates,
      ...auditMeta,
    })

    return jsonResponse({ success: true, request_id: requestId, product: data })
  } catch (error) {
    logError("Admin products action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
