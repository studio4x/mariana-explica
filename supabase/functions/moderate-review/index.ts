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

interface ModerateReviewInput {
  reviewId: string
  action: "approve" | "reject"
  reason?: string | null
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
    const body = await readJsonBody<ModerateReviewInput>(req)
    const reviewId = body.reviewId?.trim()
    const reason = body.reason?.trim() || null

    if (!reviewId || !["approve", "reject"].includes(body.action)) {
      throw badRequest("reviewId e action sao obrigatorios")
    }

    const nextStatus = body.action === "approve" ? "approved" : "rejected"

    const { data: review, error: reviewError } = await context.serviceClient
      .from("reviews")
      .update({
        moderation_status: nextStatus,
        is_moderated: true,
        moderation_reason: nextStatus === "rejected" ? reason : null,
      })
      .eq("id", reviewId)
      .select(`
        id,author_id,target_id,target_type,target_resource_id,rating,title,content,
        is_verified_purchase,is_moderated,moderation_status,moderation_reason,
        helpful_count,unhelpful_count,created_at,updated_at,
        profiles:author_id(full_name,avatar_url)
      `)
      .single()

    if (reviewError) {
      throw reviewError
    }

    await writeAuditLog(context.serviceClient, context, {
      action: `review.${body.action}`,
      entityType: "review",
      entityId: reviewId,
      metadata: {
        target_id: review.target_id,
        moderation_status: nextStatus,
        reason,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId, review })
  } catch (error) {
    logError("Review moderation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
