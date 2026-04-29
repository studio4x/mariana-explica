import { publicSupabase, supabase } from "@/integrations/supabase"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"
import type { CourseReviewStats, CourseReviewSummary } from "@/types/app.types"

const reviewSelect = `
  id,
  author_id,
  target_id,
  target_type,
  target_resource_id,
  rating,
  title,
  content,
  is_verified_purchase,
  is_moderated,
  moderation_status,
  moderation_reason,
  helpful_count,
  unhelpful_count,
  created_at,
  updated_at,
  profiles:author_id(full_name,avatar_url)
`

async function invokeReviewFunction<TResponse>(name: string, body: Record<string, unknown>) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Faz login para continuar.")
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, access_token: auth.accessToken }),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return data as TResponse
}

export async function fetchCourseReviewStats(productId: string) {
  const { data, error } = await publicSupabase
    .from("review_stats")
    .select("target_id,target_type,total_reviews,avg_rating,rating_distribution,updated_at")
    .eq("target_id", productId)
    .eq("target_type", "course")
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? {
    target_id: productId,
    target_type: "course",
    total_reviews: 0,
    avg_rating: 0,
    rating_distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    updated_at: new Date(0).toISOString(),
  }) as CourseReviewStats
}

export async function fetchApprovedCourseReviews(productId: string) {
  const { data, error } = await publicSupabase.rpc("get_public_course_reviews", {
    target_product_id: productId,
    limit_count: 12,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as CourseReviewSummary[]
}

export async function fetchHomepageReviews(limit = 6) {
  const { data, error } = await publicSupabase.rpc("get_homepage_reviews", {
    limit_count: limit,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as CourseReviewSummary[]
}

export async function fetchMyCourseReview(productId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(reviewSelect)
    .eq("target_id", productId)
    .eq("target_type", "course")
    .eq("author_id", user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as CourseReviewSummary | null
}

export async function fetchAdminReviews() {
  const { data, error } = await supabase
    .from("reviews")
    .select(reviewSelect)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CourseReviewSummary[]
}

export function createCourseReview(input: {
  productId: string
  rating: number
  title: string
  content: string
}) {
  return invokeReviewFunction<{ success: true; review: CourseReviewSummary; needs_moderation: boolean }>(
    "create-review",
    {
      targetId: input.productId,
      targetType: "course",
      rating: input.rating,
      title: input.title,
      content: input.content,
    },
  )
}

export function voteCourseReview(input: { reviewId: string; isHelpful: boolean }) {
  return invokeReviewFunction<{ success: true; helpful_count: number; unhelpful_count: number }>(
    "helpful-vote",
    input,
  )
}

export function moderateCourseReview(input: {
  reviewId: string
  action: "approve" | "reject"
  reason?: string | null
}) {
  return invokeReviewFunction<{ success: true; review: CourseReviewSummary }>("moderate-review", input)
}
