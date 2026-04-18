import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  archiveAdminProduct,
  createAdminAffiliate,
  createAdminCoupon,
  createAdminCourseRelease,
  createAdminNotification,
  createAdminProduct,
  createAdminUser,
  createAdminModuleAsset,
  createAdminProductLesson,
  createAdminProductModule,
  deleteAdminUser,
  deleteAdminModuleAsset,
  deleteAdminProductLesson,
  deleteAdminProductModule,
  fetchAdminAffiliateReferrals,
  fetchAdminAffiliates,
  fetchAdminDashboardOverview,
  fetchAdminDashboardMetrics,
  fetchAdminNotifications,
  fetchAdminOperations,
  fetchAdminOrders,
  fetchAdminOrdersView,
  fetchAdminProducts,
  fetchAdminModuleAssets,
  fetchAdminProductAssessments,
  fetchAdminProductLessons,
  fetchAdminProductModules,
  fetchAdminCoupons,
  fetchAdminCouponUsages,
  fetchAdminCourseReleases,
  fetchAdminSupportTicketMessages,
  fetchAdminSupportTickets,
  fetchAdminUsers,
  markAdminOrderCancelled,
  markAdminOrderPaid,
  markAdminOrderRefunded,
  publishAdminProduct,
  reconcileAdminOrder,
  retryAdminEmailDelivery,
  revokeAdminCourseRelease,
  replyAdminSupportTicket,
  updateAdminAffiliate,
  updateAdminCoupon,
  updateAdminProduct,
  updateAdminModuleAsset,
  updateAdminProductLesson,
  updateAdminProductModule,
  updateAdminUser,
} from "@/services"

const ADMIN_QUERY_STALE_TIME = 60_000
const ADMIN_QUERY_GC_TIME = 15 * 60_000

function getAdminQueryOptions() {
  return {
    staleTime: ADMIN_QUERY_STALE_TIME,
    gcTime: ADMIN_QUERY_GC_TIME,
    refetchOnMount: false as const,
  }
}

export function useAdminDashboardMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: fetchAdminDashboardMetrics,
    ...getAdminQueryOptions(),
  })
}

export function useAdminDashboardOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminDashboardOverview,
    ...getAdminQueryOptions(),
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
    ...getAdminQueryOptions(),
  })
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin", "products"],
    queryFn: fetchAdminProducts,
    ...getAdminQueryOptions(),
  })
}

export function useAdminProductModules(productId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "products", productId, "modules"],
    queryFn: () => fetchAdminProductModules(productId ?? ""),
    enabled: Boolean(productId),
    ...getAdminQueryOptions(),
  })
}

export function useAdminModuleAssets(moduleId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "modules", moduleId, "assets"],
    queryFn: () => fetchAdminModuleAssets(moduleId ?? ""),
    enabled: Boolean(moduleId),
    ...getAdminQueryOptions(),
  })
}

export function useAdminProductLessons(moduleId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "modules", moduleId, "lessons"],
    queryFn: () => fetchAdminProductLessons(moduleId ?? ""),
    enabled: Boolean(moduleId),
    ...getAdminQueryOptions(),
  })
}

export function useAdminProductAssessments(productId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "products", productId, "assessments"],
    queryFn: () => fetchAdminProductAssessments(productId ?? ""),
    enabled: Boolean(productId),
    ...getAdminQueryOptions(),
  })
}

export function useAdminCourseReleases(productId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "courses", productId, "releases"],
    queryFn: () => fetchAdminCourseReleases(productId ?? ""),
    enabled: Boolean(productId),
    ...getAdminQueryOptions(),
  })
}

export function useAdminOrders() {
  return useQuery({
    queryKey: ["admin", "orders"],
    queryFn: fetchAdminOrders,
    ...getAdminQueryOptions(),
  })
}

export function useAdminOrdersView() {
  return useQuery({
    queryKey: ["admin", "orders-view"],
    queryFn: fetchAdminOrdersView,
    ...getAdminQueryOptions(),
  })
}

export function useAdminNotifications() {
  return useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: fetchAdminNotifications,
    ...getAdminQueryOptions(),
  })
}

export function useAdminOperations() {
  return useQuery({
    queryKey: ["admin", "operations"],
    queryFn: fetchAdminOperations,
    ...getAdminQueryOptions(),
  })
}

export function useAdminAffiliates() {
  return useQuery({
    queryKey: ["admin", "affiliates"],
    queryFn: fetchAdminAffiliates,
    ...getAdminQueryOptions(),
  })
}

export function useAdminAffiliateReferrals() {
  return useQuery({
    queryKey: ["admin", "affiliate-referrals"],
    queryFn: fetchAdminAffiliateReferrals,
    ...getAdminQueryOptions(),
  })
}

export function useAdminCoupons() {
  return useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: fetchAdminCoupons,
    ...getAdminQueryOptions(),
  })
}

export function useAdminCouponUsages() {
  return useQuery({
    queryKey: ["admin", "coupon-usages"],
    queryFn: fetchAdminCouponUsages,
    ...getAdminQueryOptions(),
  })
}

export function useAdminSupportTickets() {
  return useQuery({
    queryKey: ["admin", "support", "tickets"],
    queryFn: fetchAdminSupportTickets,
    ...getAdminQueryOptions(),
  })
}

export function useAdminSupportTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "support", "messages", ticketId],
    queryFn: () => fetchAdminSupportTicketMessages(ticketId ?? ""),
    enabled: Boolean(ticketId),
    ...getAdminQueryOptions(),
  })
}

function useAdminInvalidation() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] })
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }
}

export function useCreateAdminUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminUser, onSuccess: invalidate })
}

export function useUpdateAdminUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminUser, onSuccess: invalidate })
}

export function useDeleteAdminUser() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminUser, onSuccess: invalidate })
}

export function useRetryAdminEmailDelivery() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: retryAdminEmailDelivery, onSuccess: invalidate })
}

export function useCreateAdminProduct() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminProduct, onSuccess: invalidate })
}

export function useUpdateAdminProduct() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminProduct, onSuccess: invalidate })
}

export function usePublishAdminProduct() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: publishAdminProduct, onSuccess: invalidate })
}

export function useArchiveAdminProduct() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: archiveAdminProduct, onSuccess: invalidate })
}

export function useCreateAdminProductModule() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminProductModule, onSuccess: invalidate })
}

export function useUpdateAdminProductModule() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminProductModule, onSuccess: invalidate })
}

export function useDeleteAdminProductModule() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminProductModule, onSuccess: invalidate })
}

export function useCreateAdminModuleAsset() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminModuleAsset, onSuccess: invalidate })
}

export function useCreateAdminProductLesson() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminProductLesson, onSuccess: invalidate })
}

export function useUpdateAdminModuleAsset() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminModuleAsset, onSuccess: invalidate })
}

export function useUpdateAdminProductLesson() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminProductLesson, onSuccess: invalidate })
}

export function useDeleteAdminModuleAsset() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminModuleAsset, onSuccess: invalidate })
}

export function useDeleteAdminProductLesson() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminProductLesson, onSuccess: invalidate })
}

export function useMarkAdminOrderPaid() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ orderId, paymentReference }: { orderId: string; paymentReference?: string | null }) =>
      markAdminOrderPaid(orderId, paymentReference),
    onSuccess: invalidate,
  })
}

export function useMarkAdminOrderRefunded() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string | null }) =>
      markAdminOrderRefunded(orderId, reason),
    onSuccess: invalidate,
  })
}

export function useMarkAdminOrderCancelled() {
  const invalidate = useAdminInvalidation()
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string | null }) =>
      markAdminOrderCancelled(orderId, reason),
    onSuccess: invalidate,
  })
}

export function useReconcileAdminOrder() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: reconcileAdminOrder, onSuccess: invalidate })
}

export function useCreateAdminNotification() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminNotification, onSuccess: invalidate })
}

export function useCreateAdminAffiliate() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminAffiliate, onSuccess: invalidate })
}

export function useUpdateAdminAffiliate() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminAffiliate, onSuccess: invalidate })
}

export function useCreateAdminCoupon() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminCoupon, onSuccess: invalidate })
}

export function useUpdateAdminCoupon() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminCoupon, onSuccess: invalidate })
}

export function useCreateAdminCourseRelease() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminCourseRelease, onSuccess: invalidate })
}

export function useRevokeAdminCourseRelease() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: revokeAdminCourseRelease, onSuccess: invalidate })
}

export function useReplyAdminSupportTicket() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: replyAdminSupportTicket, onSuccess: invalidate })
}
