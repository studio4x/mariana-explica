import { badRequest, conflict, notFound } from "../_shared/errors.ts"
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

type AffiliateStatus = "active" | "inactive" | "blocked"
type CommissionType = "percentage" | "fixed"

interface CreateAffiliateInput {
  action: "create"
  userId: string
  affiliateCode: string
  commissionType: CommissionType
  commissionValue: number
  status?: AffiliateStatus
}

interface UpdateAffiliateInput {
  action: "update"
  affiliateId: string
  affiliateCode?: string
  commissionType?: CommissionType
  commissionValue?: number
  status?: AffiliateStatus
}

type AdminAffiliatesInput = CreateAffiliateInput | UpdateAffiliateInput

const allowedStatuses = new Set<AffiliateStatus>(["active", "inactive", "blocked"])
const allowedCommissionTypes = new Set<CommissionType>(["percentage", "fixed"])

function normalizeAffiliateCode(code: string) {
  return code.trim().toUpperCase()
}

async function ensureAffiliateCodeAvailable(
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  affiliateCode: string,
  currentAffiliateId?: string,
) {
  const query = serviceClient
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", affiliateCode)

  const { data, error } = await (currentAffiliateId ? query.neq("id", currentAffiliateId) : query)

  if (error) {
    throw error
  }

  if ((data ?? []).length > 0) {
    throw conflict("Codigo de afiliado ja existe")
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
    const body = await readJsonBody<AdminAffiliatesInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "create") {
      if (!body.userId) {
        throw badRequest("userId e obrigatorio")
      }

      const affiliateCode = normalizeAffiliateCode(body.affiliateCode)
      if (!affiliateCode) {
        throw badRequest("affiliateCode e obrigatorio")
      }

      if (!allowedCommissionTypes.has(body.commissionType)) {
        throw badRequest("commissionType invalido")
      }

      if (!allowedStatuses.has(body.status ?? "active")) {
        throw badRequest("status invalido")
      }

      if (!Number.isFinite(body.commissionValue) || body.commissionValue < 0) {
        throw badRequest("commissionValue invalido")
      }

      const { data: profile, error: profileError } = await context.serviceClient
        .from("profiles")
        .select("id")
        .eq("id", body.userId)
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (!profile) {
        throw notFound("Perfil do afiliado nao encontrado")
      }

      await ensureAffiliateCodeAvailable(context.serviceClient, affiliateCode)

      const { data: affiliate, error } = await context.serviceClient
        .from("affiliates")
        .insert({
          user_id: body.userId,
          affiliate_code: affiliateCode,
          commission_type: body.commissionType,
          commission_value: body.commissionValue,
          status: body.status ?? "active",
        })
        .select("id,user_id,affiliate_code,status,commission_type,commission_value,created_at,updated_at")
        .single()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.affiliate_created",
        entityType: "affiliate",
        entityId: affiliate.id,
        metadata: {
          user_id: affiliate.user_id,
          affiliate_code: affiliate.affiliate_code,
          commission_type: affiliate.commission_type,
          commission_value: affiliate.commission_value,
          status: affiliate.status,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, affiliate })
    }

    if (!body.affiliateId) {
      throw badRequest("affiliateId e obrigatorio")
    }

    const updates: Record<string, unknown> = {}

    if (body.affiliateCode !== undefined) {
      const affiliateCode = normalizeAffiliateCode(body.affiliateCode)
      if (!affiliateCode) {
        throw badRequest("affiliateCode invalido")
      }

      await ensureAffiliateCodeAvailable(context.serviceClient, affiliateCode, body.affiliateId)
      updates.affiliate_code = affiliateCode
    }

    if (body.commissionType !== undefined) {
      if (!allowedCommissionTypes.has(body.commissionType)) {
        throw badRequest("commissionType invalido")
      }
      updates.commission_type = body.commissionType
    }

    if (body.commissionValue !== undefined) {
      if (!Number.isFinite(body.commissionValue) || body.commissionValue < 0) {
        throw badRequest("commissionValue invalido")
      }
      updates.commission_value = body.commissionValue
    }

    if (body.status !== undefined) {
      if (!allowedStatuses.has(body.status)) {
        throw badRequest("status invalido")
      }
      updates.status = body.status
    }

    const { data: affiliate, error } = await context.serviceClient
      .from("affiliates")
      .update(updates)
      .eq("id", body.affiliateId)
      .select("id,user_id,affiliate_code,status,commission_type,commission_value,created_at,updated_at")
      .single()

    if (error) {
      throw error
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.affiliate_updated",
      entityType: "affiliate",
      entityId: affiliate.id,
      metadata: updates,
      ...auditMeta,
    })

    return jsonResponse({ success: true, request_id: requestId, affiliate })
  } catch (error) {
    logError("Admin affiliates action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
