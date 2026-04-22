import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createCourseReview,
  fetchAdminReviews,
  fetchApprovedCourseReviews,
  fetchCourseReviewStats,
  fetchMyCourseReview,
  moderateCourseReview,
  voteCourseReview,
} from "@/services"

export function useCourseReviewStats(productId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "stats", productId],
    queryFn: () => fetchCourseReviewStats(productId ?? ""),
    enabled: Boolean(productId),
  })
}

export function useApprovedCourseReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "course", productId],
    queryFn: () => fetchApprovedCourseReviews(productId ?? ""),
    enabled: Boolean(productId),
  })
}

export function useMyCourseReview(productId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "mine", productId],
    queryFn: () => fetchMyCourseReview(productId ?? ""),
    enabled: Boolean(productId),
  })
}

export function useCreateCourseReview(productId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCourseReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews", "stats", productId] })
      void queryClient.invalidateQueries({ queryKey: ["reviews", "course", productId] })
      void queryClient.invalidateQueries({ queryKey: ["reviews", "mine", productId] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
  })
}

export function useVoteCourseReview(productId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: voteCourseReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews", "course", productId] })
    },
  })
}

export function useAdminReviews() {
  return useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: fetchAdminReviews,
  })
}

export function useModerateCourseReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: moderateCourseReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })
      void queryClient.invalidateQueries({ queryKey: ["reviews"] })
    },
  })
}
