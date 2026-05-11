import { badRequest, forbidden } from "../_shared/errors.ts"
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
  requireActiveUser,
  writeAuditLog,
} from "../_shared/mod.ts"

interface CreateReviewInput {
  targetId?: string
  productId?: string
  targetType?: "course" | "product"
  rating: number
  title: string
  content: string
}

function needsModeration(title: string, content: string) {
  const text = `${title}\n${content}`.trim()
  if (/viagra|casino|crypto|bet|aposta/i.test(text)) return true
  if ((text.match(/https?:\/\//gi) ?? []).length > 2) return true
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "")
  if (letters.length >= 16 && letters === letters.toUpperCase()) return true
  if (/(.)\1{4,}/.test(text)) return true
  return false
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
    const body = await readJsonBody<CreateReviewInput>(req)
    const targetId = (body.targetId ?? body.productId ?? "").trim()
    const targetType = body.targetType ?? "course"
    const rating = Number(body.rating)
    const title = body.title?.trim() ?? ""
    const content = body.content?.trim() ?? ""

    if (!targetId) {
      throw badRequest("targetId e obrigatorio")
    }

    if (!["course", "product"].includes(targetType)) {
      throw badRequest("targetType invalido")
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw badRequest("rating deve estar entre 1 e 5")
    }

    if (title.length < 3 || title.length > 100) {
      throw badRequest("title deve ter entre 3 e 100 caracteres")
    }

    if (content.length < 3 || content.length > 3000) {
      throw badRequest("content deve ter entre 3 e 3000 caracteres")
    }

    const { data: product, error: productError } = await context.serviceClient
      .from("products")
      .select("id,title,status")
      .eq("id", targetId)
      .maybeSingle()

    if (productError) {
      throw productError
    }

    if (!product || product.status !== "published") {
      throw forbidden("Material indisponivel para avaliacao")
    }

    const { data: grant, error: grantError } = await context.serviceClient
      .from("access_grants")
      .select("id")
      .eq("user_id", context.user.id)
      .eq("product_id", targetId)
      .eq("status", "active")
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle()

    if (grantError) {
      throw grantError
    }

    if (!grant && !context.profile.is_admin) {
      throw forbidden("Apenas alunos com acesso ativo podem avaliar este material")
    }

    const moderationStatus = needsModeration(title, content) ? "pending" : "approved"
    const reviewPayload = {
      author_id: context.user.id,
      author_name: null,
      target_id: targetId,
      target_type: targetType,
      target_resource_id: targetId,
      rating,
      title,
      content,
      is_verified_purchase: Boolean(grant),
      is_moderated: moderationStatus !== "pending",
      moderation_status: moderationStatus,
      moderation_reason: null,
      deleted_at: null,
    }

    const reviewSelect = `
      id,author_id,author_name,target_id,target_type,target_resource_id,rating,title,content,
      is_verified_purchase,is_moderated,moderation_status,moderation_reason,
      helpful_count,unhelpful_count,created_at,updated_at,
      profiles:author_id(full_name,avatar_url)
    `

    const { data: existingReview, error: existingReviewError } = await context.serviceClient
      .from("reviews")
      .select("id")
      .eq("author_id", context.user.id)
      .eq("target_id", targetId)
      .eq("target_type", targetType)
      .is("author_name", null)
      .is("deleted_at", null)
      .maybeSingle()

    if (existingReviewError) {
      throw existingReviewError
    }

    const reviewQuery = existingReview
      ? context.serviceClient
          .from("reviews")
          .update(reviewPayload)
          .eq("id", existingReview.id)
          .select(reviewSelect)
      : context.serviceClient
          .from("reviews")
          .insert(reviewPayload)
          .select(reviewSelect)

    const { data: review, error: reviewError } = await reviewQuery.single()

    if (reviewError) {
      throw reviewError
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "review.created_or_updated",
      entityType: "review",
      entityId: review.id,
      metadata: {
        target_id: targetId,
        target_type: targetType,
        rating,
        moderation_status: moderationStatus,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      review,
      needs_moderation: moderationStatus === "pending",
    })
  } catch (error) {
    logError("Review creation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
