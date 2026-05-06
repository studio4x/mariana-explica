import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
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

interface AdminCreateReviewInput {
  productId?: string
  authorId?: string | null
  rating: number
  title: string
  content: string
  isVerifiedPurchase?: boolean
}

const reviewSelect = `
  id,author_id,target_id,target_type,target_resource_id,rating,title,content,
  is_verified_purchase,is_moderated,moderation_status,moderation_reason,
  helpful_count,unhelpful_count,created_at,updated_at,
  profiles:author_id(full_name,avatar_url)
`

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
    const body = await readJsonBody<AdminCreateReviewInput>(req)
    const productId = (body.productId ?? "").trim()
    const authorId = (body.authorId ?? context.user.id).trim()
    const rating = Number(body.rating)
    const title = body.title?.trim() ?? ""
    const content = body.content?.trim() ?? ""
    const isVerifiedPurchase = Boolean(body.isVerifiedPurchase)

    if (!productId) {
      throw badRequest("productId e obrigatorio")
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
      .eq("id", productId)
      .maybeSingle()

    if (productError) {
      throw productError
    }

    if (!product) {
      throw notFound("Material nao encontrado")
    }

    const { data: authorProfile, error: authorError } = await context.serviceClient
      .from("profiles")
      .select("id")
      .eq("id", authorId)
      .maybeSingle()

    if (authorError) {
      throw authorError
    }

    if (!authorProfile) {
      throw forbidden("Usuario selecionado nao existe")
    }

    const reviewPayload = {
      author_id: authorId,
      target_id: productId,
      target_type: "course",
      target_resource_id: productId,
      rating,
      title,
      content,
      is_verified_purchase: isVerifiedPurchase,
      is_moderated: true,
      moderation_status: "approved",
      moderation_reason: null,
      deleted_at: null,
    }

    const { data: existingReview, error: existingReviewError } = await context.serviceClient
      .from("reviews")
      .select("id")
      .eq("author_id", authorId)
      .eq("target_id", productId)
      .eq("target_type", "course")
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
      action: "review.admin_created_or_updated",
      entityType: "review",
      entityId: review.id,
      metadata: {
        target_id: productId,
        author_id: authorId,
        is_verified_purchase: isVerifiedPurchase,
        saved_as: existingReview ? "updated" : "inserted",
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      review,
      saved_as: existingReview ? "updated" : "inserted",
    })
  } catch (error) {
    logError("Admin review creation failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
