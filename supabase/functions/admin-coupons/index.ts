import { badRequest, conflict } from "../_shared/errors.ts"
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

type CouponStatus = "active" | "inactive" | "expired"
type DiscountType = "percentage" | "fixed"

interface CouponPayload {
  code?: string
  title?: string | null
  discountType?: DiscountType
  discountValue?: number
  status?: CouponStatus
  startsAt?: string | null
  expiresAt?: string | null
  maxUses?: number | null
  maxUsesPerUser?: number | null
  minimumOrderCents?: number | null
}

type AdminCouponsInput =
  | ({ action: "create" } & Required<Pick<CouponPayload, "code" | "discountType" | "discountValue">> & CouponPayload)
  | ({ action: "update"; couponId: string } & CouponPayload)

const allowedStatuses = new Set<CouponStatus>(["active", "inactive", "expired"])
const allowedDiscountTypes = new Set<DiscountType>(["percentage", "fixed"])

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function mapPayload(payload: CouponPayload) {
  const updates: Record<string, unknown> = {}

  if (payload.code !== undefined) updates.code = normalizeCode(payload.code)
  if (payload.title !== undefined) updates.title = normalizeNullableString(payload.title)
  if (payload.discountType !== undefined) updates.discount_type = payload.discountType
  if (payload.discountValue !== undefined) updates.discount_value = payload.discountValue
  if (payload.status !== undefined) updates.status = payload.status
  if (payload.startsAt !== undefined) updates.starts_at = payload.startsAt || null
  if (payload.expiresAt !== undefined) updates.expires_at = payload.expiresAt || null
  if (payload.maxUses !== undefined) updates.max_uses = payload.maxUses
  if (payload.maxUsesPerUser !== undefined) updates.max_uses_per_user = payload.maxUsesPerUser
  if (payload.minimumOrderCents !== undefined) updates.minimum_order_cents = payload.minimumOrderCents

  return updates
}

function validatePayload(payload: CouponPayload) {
  if (payload.discountType !== undefined && !allowedDiscountTypes.has(payload.discountType)) {
    throw badRequest("discountType invalido")
  }

  if (payload.status !== undefined && !allowedStatuses.has(payload.status)) {
    throw badRequest("status invalido")
  }

  if (payload.discountValue !== undefined && (!Number.isFinite(payload.discountValue) || payload.discountValue < 0)) {
    throw badRequest("discountValue invalido")
  }

  if (payload.maxUses !== undefined && payload.maxUses !== null && (!Number.isInteger(payload.maxUses) || payload.maxUses < 0)) {
    throw badRequest("maxUses invalido")
  }

  if (payload.maxUsesPerUser !== undefined && payload.maxUsesPerUser !== null && (!Number.isInteger(payload.maxUsesPerUser) || payload.maxUsesPerUser < 0)) {
    throw badRequest("maxUsesPerUser invalido")
  }

  if (payload.minimumOrderCents !== undefined && payload.minimumOrderCents !== null && (!Number.isInteger(payload.minimumOrderCents) || payload.minimumOrderCents < 0)) {
    throw badRequest("minimumOrderCents invalido")
  }
}

async function ensureCouponCodeAvailable(
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  code: string,
  currentCouponId?: string,
) {
  const query = serviceClient.from("coupons").select("id").eq("code", code)
  const { data, error } = await (currentCouponId ? query.neq("id", currentCouponId) : query)

  if (error) {
    throw error
  }

  if ((data ?? []).length > 0) {
    throw conflict("Codigo de cupom ja existe")
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
    const body = await readJsonBody<AdminCouponsInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "create") {
      if (!body.code?.trim()) {
        throw badRequest("code e obrigatorio")
      }

      validatePayload(body)
      const code = normalizeCode(body.code)
      await ensureCouponCodeAvailable(context.serviceClient, code)

      const { data: coupon, error } = await context.serviceClient
        .from("coupons")
        .insert({
          ...mapPayload(body),
          code,
          status: body.status ?? "active",
        })
        .select("id,code,title,discount_type,discount_value,status,starts_at,expires_at,max_uses,max_uses_per_user,current_uses,minimum_order_cents,created_at,updated_at")
        .single()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.coupon_created",
        entityType: "coupon",
        entityId: coupon.id,
        metadata: {
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          status: coupon.status,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, coupon })
    }

    if (!body.couponId) {
      throw badRequest("couponId e obrigatorio")
    }

    validatePayload(body)
    const updates = mapPayload(body)

    if (body.code !== undefined) {
      const code = normalizeCode(body.code)
      if (!code) {
        throw badRequest("code invalido")
      }

      await ensureCouponCodeAvailable(context.serviceClient, code, body.couponId)
      updates.code = code
    }

    const { data: coupon, error } = await context.serviceClient
      .from("coupons")
      .update(updates)
      .eq("id", body.couponId)
      .select("id,code,title,discount_type,discount_value,status,starts_at,expires_at,max_uses,max_uses_per_user,current_uses,minimum_order_cents,created_at,updated_at")
      .single()

    if (error) {
      throw error
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.coupon_updated",
      entityType: "coupon",
      entityId: coupon.id,
      metadata: updates,
      ...auditMeta,
    })

    return jsonResponse({ success: true, request_id: requestId, coupon })
  } catch (error) {
    logError("Admin coupons action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
