import { badRequest, notFound } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/mod.ts"

interface HelpfulVoteInput {
  reviewId: string
  isHelpful: boolean
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
    const body = await readJsonBody<HelpfulVoteInput>(req)
    const reviewId = body.reviewId?.trim()

    if (!reviewId || typeof body.isHelpful !== "boolean") {
      throw badRequest("reviewId e isHelpful sao obrigatorios")
    }

    const { data: review, error: reviewError } = await context.serviceClient
      .from("reviews")
      .select("id,moderation_status,deleted_at")
      .eq("id", reviewId)
      .maybeSingle()

    if (reviewError) {
      throw reviewError
    }

    if (!review || review.deleted_at || review.moderation_status !== "approved") {
      throw notFound("Review nao encontrado")
    }

    const { error: voteError } = await context.serviceClient
      .from("review_helpful_votes")
      .upsert(
        {
          review_id: reviewId,
          user_id: context.user.id,
          is_helpful: body.isHelpful,
        },
        { onConflict: "review_id,user_id" },
      )

    if (voteError) {
      throw voteError
    }

    const { data: updatedReview, error: updatedReviewError } = await context.serviceClient
      .from("reviews")
      .select("id,helpful_count,unhelpful_count")
      .eq("id", reviewId)
      .single()

    if (updatedReviewError) {
      throw updatedReviewError
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      helpful_count: updatedReview.helpful_count,
      unhelpful_count: updatedReview.unhelpful_count,
    })
  } catch (error) {
    logError("Review helpful vote failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
