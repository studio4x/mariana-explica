import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"
import {
  archiveAdminProduct,
  createAdminAffiliate,
  createAdminCoupon,
  createAdminCourseRelease,
  createAdminNotification,
  deleteAdminSupportTicket,
  createAdminProduct,
  createAdminUser,
  deleteAdminProduct,
  createAdminModuleAsset,
  createAdminProductAssessment,
  createAdminProductLesson,
  createAdminProductModule,
  deleteAdminUser,
  deleteAdminModuleAsset,
  deleteAdminProductAssessment,
  deleteAdminProductLesson,
  deleteAdminProductModule,
  fetchAdminAffiliateReferrals,
  fetchAdminAffiliates,
  fetchAdminDashboardOverview,
  fetchAdminDashboardMetrics,
  fetchAdminEmailStatus,
  fetchAdminModulePdfWatermarkConfig,
  fetchAdminPendingInfoConfig,
  fetchAdminProductCategories,
  fetchAdminNotifications,
  markAdminNotificationAsRead,
  markAllAdminNotificationsAsRead,
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
  fetchAdminCronStatus,
  fetchAdminCourseReleases,
  fetchAdminSupportTicketMessages,
  fetchAdminSupportTicket,
  fetchAdminSupportTickets,
  fetchAdminUsers,
  markAdminOrderCancelled,
  markAdminOrderPaid,
  markAdminOrderRefunded,
  publishAdminProduct,
  reconcileAdminOrder,
  retryAdminEmailDelivery,
  runAllAdminCrons,
  runOneAdminCron,
  scheduleAdminCronJobs,
  revokeAdminCourseRelease,
  replyAdminSupportTicket,
  queueAdminCronTestEmail,
  fetchSupportAttachmentUrl,
  uploadSupportAttachment,
  uploadAdminModuleAssetFile,
  uploadAdminModulePdf,
  uploadAdminProductCover,
  uploadAdminWatermarkLogoFile,
  updateAdminAffiliate,
  updateAdminCoupon,
  updateAdminModulePdfWatermarkConfig,
  updateAdminPendingInfoConfig,
  updateAdminProduct,
  createAdminProductCategory,
  deleteAdminProductCategory,
  updateAdminProductCategory,
  updateAdminModuleAsset,
  updateAdminProductAssessment,
  updateAdminProductLesson,
  updateAdminProductModule,
  updateAdminUser,
  updateAdminUserPassword,
} from "@/services"
import type {
  AdminNotificationSummary,
  AdminSupportTicketSummary,
  ProductLessonSummary,
  ProductModuleSummary,
  ProductAssessmentSummary,
  SupportTicketMessage,
} from "@/types/app.types"

const ADMIN_QUERY_STALE_TIME = 60_000
const ADMIN_QUERY_GC_TIME = 15 * 60_000
const REALTIME_FALLBACK_INTERVAL_MS = 4_000
const CHAT_FALLBACK_INTERVAL_MS = 2_500

type RealtimePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE"
  new?: unknown
  old?: unknown
}

function upsertById<TItem extends { id: string }>(
  current: TItem[] | undefined,
  nextItem: TItem,
  sortItems?: (items: TItem[]) => TItem[],
) {
  const next = current ? [...current] : []
  const index = next.findIndex((item) => item.id === nextItem.id)

  if (index >= 0) {
    next[index] = nextItem
  } else {
    next.unshift(nextItem)
  }

  return sortItems ? sortItems(next) : next
}

function removeById<TItem extends { id: string }>(current: TItem[] | undefined, itemId: string) {
  return (current ?? []).filter((item) => item.id !== itemId)
}

function sortAdminNotifications(items: AdminNotificationSummary[]) {
  return [...items].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
}

function sortAdminTickets(items: AdminSupportTicketSummary[]) {
  return [...items].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
}

function sortMessages(items: SupportTicketMessage[]) {
  return [...items].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
}

function refetchActive(queryClient: ReturnType<typeof useQueryClient>, queryKey: unknown[]) {
  void queryClient.refetchQueries({ queryKey, type: "active" })
}

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

export function useAdminModulePdfWatermarkConfig() {
  return useQuery({
    queryKey: ["admin", "module-pdf-watermark"],
    queryFn: fetchAdminModulePdfWatermarkConfig,
    ...getAdminQueryOptions(),
  })
}

export function useAdminEmailStatus() {
  return useQuery({
    queryKey: ["admin", "email-status"],
    queryFn: fetchAdminEmailStatus,
    ...getAdminQueryOptions(),
  })
}

export function useAdminPendingInfoConfig() {
  return useQuery({
    queryKey: ["admin", "pending-info"],
    queryFn: fetchAdminPendingInfoConfig,
    ...getAdminQueryOptions(),
  })
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
    enabled,
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

export function useAdminProductCategories() {
  return useQuery({
    queryKey: ["admin", "product-categories"],
    queryFn: fetchAdminProductCategories,
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

export function useCreateAdminProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdminProductCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "product-categories"] })
      void queryClient.invalidateQueries({ queryKey: ["products", "categories"] })
    },
  })
}

export function useUpdateAdminProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAdminProductCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "product-categories"] })
      void queryClient.invalidateQueries({ queryKey: ["products", "categories"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      void queryClient.invalidateQueries({ queryKey: ["products", "published"] })
    },
  })
}

export function useDeleteAdminProductCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAdminProductCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "product-categories"] })
      void queryClient.invalidateQueries({ queryKey: ["products", "categories"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      void queryClient.invalidateQueries({ queryKey: ["products", "published"] })
    },
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

export function useAdminNotifications(includeArchived = false) {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const notificationsQueryKey: unknown[] = ["admin", "notifications", includeArchived ? "all" : "active", userId]
  const query = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => fetchAdminNotifications(includeArchived, userId),
    ...getAdminQueryOptions(),
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (includeArchived || !userId) return undefined

    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload: RealtimePayload) => {
          const nextNotification = payload.new as AdminNotificationSummary | undefined
          const oldNotification = payload.old as AdminNotificationSummary | undefined

          if (payload.eventType === "DELETE" && oldNotification?.id) {
            queryClient.setQueryData<AdminNotificationSummary[]>(["admin", "notifications", "active", userId], (current) =>
              removeById(current, oldNotification.id),
            )
          } else if (nextNotification?.id) {
            queryClient.setQueryData<AdminNotificationSummary[]>(["admin", "notifications", "active", userId], (current) =>
              upsertById(current, nextNotification, sortAdminNotifications),
            )
          }

          refetchActive(queryClient, ["admin", "notifications", "active", userId])
          void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] })
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, notificationsQueryKey)
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, includeArchived, userId])

  return query
}

export function useAdminOperations() {
  return useQuery({
    queryKey: ["admin", "operations"],
    queryFn: fetchAdminOperations,
    ...getAdminQueryOptions(),
  })
}

export function useAdminCronStatus() {
  return useQuery({
    queryKey: ["admin", "cron-status"],
    queryFn: fetchAdminCronStatus,
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
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["admin", "support", "tickets"],
    queryFn: fetchAdminSupportTickets,
    staleTime: 0,
    gcTime: ADMIN_QUERY_GC_TIME,
    refetchOnMount: "always",
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const channel = supabase
      .channel("admin-support-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
        },
        (payload: RealtimePayload) => {
          const nextTicket = payload.new as AdminSupportTicketSummary | undefined
          const oldTicket = payload.old as AdminSupportTicketSummary | undefined

          if (payload.eventType === "DELETE" && oldTicket?.id) {
            queryClient.setQueryData<AdminSupportTicketSummary[]>(["admin", "support", "tickets"], (current) =>
              removeById(current, oldTicket.id),
            )
          } else if (nextTicket?.id) {
            queryClient.setQueryData<AdminSupportTicketSummary[]>(["admin", "support", "tickets"], (current) =>
              upsertById(current, nextTicket, sortAdminTickets),
            )
            queryClient.setQueryData(["admin", "support", "ticket", nextTicket.id], nextTicket)
          }

          refetchActive(queryClient, ["admin", "support"])
          void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] })
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, ["admin", "support"])
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return query
}

export function useAdminSupportTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "support", "ticket", ticketId],
    queryFn: () => fetchAdminSupportTicket(ticketId ?? ""),
    enabled: Boolean(ticketId),
    staleTime: 0,
    gcTime: ADMIN_QUERY_GC_TIME,
    refetchOnMount: "always",
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useAdminSupportTicketMessages(ticketId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["admin", "support", "messages", ticketId],
    queryFn: () => fetchAdminSupportTicketMessages(ticketId ?? ""),
    enabled: Boolean(ticketId),
    staleTime: 0,
    gcTime: ADMIN_QUERY_GC_TIME,
    refetchOnMount: "always",
    refetchInterval: CHAT_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!ticketId) return undefined

    const channel = supabase
      .channel(`admin-support-chat:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload: RealtimePayload) => {
          const nextMessage = payload.new as SupportTicketMessage | undefined

          if (nextMessage?.id) {
            queryClient.setQueryData<SupportTicketMessage[]>(
              ["admin", "support", "messages", ticketId],
              (current) => upsertById(current, nextMessage, sortMessages),
            )
          }

          refetchActive(queryClient, ["admin", "support", "messages", ticketId])
          refetchActive(queryClient, ["admin", "support"])
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${ticketId}`,
        },
        (payload: RealtimePayload) => {
          const nextTicket = payload.new as AdminSupportTicketSummary | undefined

          if (nextTicket?.id) {
            queryClient.setQueryData(["admin", "support", "ticket", nextTicket.id], nextTicket)
            queryClient.setQueryData<AdminSupportTicketSummary[]>(["admin", "support", "tickets"], (current) =>
              upsertById(current, nextTicket, sortAdminTickets),
            )
          }

          refetchActive(queryClient, ["admin", "support", "ticket", ticketId])
          refetchActive(queryClient, ["admin", "support"])
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, ["admin", "support", "messages", ticketId])
      refetchActive(queryClient, ["admin", "support", "ticket", ticketId])
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, ticketId])

  return query
}

function useAdminInvalidation() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] })
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    void queryClient.invalidateQueries({ queryKey: ["products"] })
  }
}

function upsertAdminProductAssessmentCache(
  queryClient: ReturnType<typeof useQueryClient>,
  assessment: ProductAssessmentSummary,
) {
  queryClient.setQueryData<ProductAssessmentSummary[]>(
    ["admin", "products", assessment.product_id, "assessments"],
    (current) => {
      const next = current ? [...current] : []
      const existingIndex = next.findIndex((item) => item.id === assessment.id)

      if (existingIndex >= 0) {
        next[existingIndex] = assessment
      } else {
        next.push(assessment)
      }

      return next.sort(
        (left, right) =>
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      )
    },
  )
}

function upsertAdminProductModuleCache(
  queryClient: ReturnType<typeof useQueryClient>,
  module: ProductModuleSummary,
) {
  queryClient.setQueryData<ProductModuleSummary[]>(
    ["admin", "products", module.product_id, "modules"],
    (current) => {
      const next = current ? [...current] : []
      const existingIndex = next.findIndex((item) => item.id === module.id)

      if (existingIndex >= 0) {
        next[existingIndex] = module
      } else {
        next.push(module)
      }

      return next.sort((left, right) => {
        if (left.position !== right.position) {
          return left.position - right.position
        }
        return left.sort_order - right.sort_order
      })
    },
  )
}

function upsertAdminProductLessonCache(
  queryClient: ReturnType<typeof useQueryClient>,
  lesson: ProductLessonSummary,
) {
  queryClient.setQueryData<ProductLessonSummary[]>(
    ["admin", "modules", lesson.module_id, "lessons"],
    (current) => {
      const next = current ? [...current] : []
      const existingIndex = next.findIndex((item) => item.id === lesson.id)

      if (existingIndex >= 0) {
        next[existingIndex] = lesson
      } else {
        next.push(lesson)
      }

      return next.sort((left, right) => left.position - right.position)
    },
  )
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

export function useUpdateAdminUserPassword() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminUserPassword, onSuccess: invalidate })
}

export function useRetryAdminEmailDelivery() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: retryAdminEmailDelivery, onSuccess: invalidate })
}

export function useScheduleAdminCronJobs() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: scheduleAdminCronJobs, onSuccess: invalidate })
}

export function useRunOneAdminCron() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: runOneAdminCron, onSuccess: invalidate })
}

export function useRunAllAdminCrons() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: runAllAdminCrons, onSuccess: invalidate })
}

export function useQueueAdminCronTestEmail() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: queueAdminCronTestEmail, onSuccess: invalidate })
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

export function useDeleteAdminProduct() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminProduct, onSuccess: invalidate })
}

export function useCreateAdminProductModule() {
  const invalidate = useAdminInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdminProductModule,
    onSuccess: (module) => {
      upsertAdminProductModuleCache(queryClient, module)
      invalidate()
    },
  })
}

export function useUploadAdminModulePdf() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: uploadAdminModulePdf, onSuccess: invalidate })
}

export function useUploadAdminProductCover() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: uploadAdminProductCover, onSuccess: invalidate })
}

export function useUploadAdminModuleAssetFile() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: uploadAdminModuleAssetFile, onSuccess: invalidate })
}

export function useUploadAdminWatermarkLogoFile() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: uploadAdminWatermarkLogoFile, onSuccess: invalidate })
}

export function useUpdateAdminProductModule() {
  const invalidate = useAdminInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAdminProductModule,
    onSuccess: (module) => {
      upsertAdminProductModuleCache(queryClient, module)
      invalidate()
    },
  })
}

export function useDeleteAdminProductModule() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminProductModule, onSuccess: invalidate })
}

export function useCreateAdminModuleAsset() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: createAdminModuleAsset, onSuccess: invalidate })
}

export function useCreateAdminProductAssessment() {
  const invalidate = useAdminInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdminProductAssessment,
    onSuccess: (assessment) => {
      upsertAdminProductAssessmentCache(queryClient, assessment)
      invalidate()
    },
  })
}

export function useCreateAdminProductLesson() {
  const invalidate = useAdminInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAdminProductLesson,
    onSuccess: (lesson) => {
      upsertAdminProductLessonCache(queryClient, lesson)
      invalidate()
    },
  })
}

export function useUpdateAdminModuleAsset() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminModuleAsset, onSuccess: invalidate })
}

export function useUpdateAdminProductLesson() {
  const invalidate = useAdminInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAdminProductLesson,
    onSuccess: (lesson) => {
      upsertAdminProductLessonCache(queryClient, lesson)
      invalidate()
    },
  })
}

export function useUpdateAdminProductAssessment() {
  const invalidate = useAdminInvalidation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAdminProductAssessment,
    onSuccess: (assessment) => {
      upsertAdminProductAssessmentCache(queryClient, assessment)
      invalidate()
    },
  })
}

export function useDeleteAdminModuleAsset() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminModuleAsset, onSuccess: invalidate })
}

export function useDeleteAdminProductLesson() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminProductLesson, onSuccess: invalidate })
}

export function useDeleteAdminProductAssessment() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminProductAssessment, onSuccess: invalidate })
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

export function useMarkAdminNotificationAsRead() {
  const invalidate = useAdminInvalidation()
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAdminNotificationAsRead,
    onSuccess: (notification) => {
      queryClient.setQueryData<AdminNotificationSummary[]>(["admin", "notifications", "active", userId], (current) =>
        upsertById(current, notification, sortAdminNotifications),
      )
      invalidate()
    },
  })
}

export function useMarkAllAdminNotificationsAsRead() {
  const invalidate = useAdminInvalidation()
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllAdminNotificationsAsRead,
    onSuccess: (notifications) => {
      queryClient.setQueryData<AdminNotificationSummary[]>(["admin", "notifications", "active", userId], () => [])
      queryClient.setQueryData<AdminNotificationSummary[]>(["admin", "notifications", "all", userId], (current) => {
        const next = current ?? []
        const updatedById = new Map(notifications.map((notification) => [notification.id, notification]))
        return sortAdminNotifications(next.map((notification) => updatedById.get(notification.id) ?? notification))
      })
      invalidate()
    },
  })
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

export function useUpdateAdminModulePdfWatermarkConfig() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminModulePdfWatermarkConfig, onSuccess: invalidate })
}

export function useUpdateAdminPendingInfoConfig() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: updateAdminPendingInfoConfig, onSuccess: invalidate })
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
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id

  return useMutation({
    mutationFn: replyAdminSupportTicket,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "support", "messages", variables.ticketId] })

      const previousMessages =
        queryClient.getQueryData<SupportTicketMessage[]>(["admin", "support", "messages", variables.ticketId]) ?? []
      const tempId = `temp-${crypto.randomUUID()}`
      const optimisticMessage: SupportTicketMessage = {
        id: tempId,
        ticket_id: variables.ticketId,
        sender_user_id: userId ?? "pending-user",
        sender_role: "admin",
        message: variables.message ?? "",
        attachment_bucket: variables.attachment?.bucket ?? null,
        attachment_path: variables.attachment?.path ?? null,
        attachment_name: variables.attachment?.file_name ?? null,
        attachment_mime_type: variables.attachment?.mime_type ?? null,
        attachment_size_bytes: variables.attachment?.file_size_bytes ?? null,
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<SupportTicketMessage[]>(
        ["admin", "support", "messages", variables.ticketId],
        (current) => upsertById(current, optimisticMessage, sortMessages),
      )

      return { previousMessages, ticketId: variables.ticketId, tempId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData<SupportTicketMessage[]>(
        ["admin", "support", "messages", context.ticketId],
        context.previousMessages,
      )
    },
    onSuccess: (result, _variables, context) => {
      queryClient.setQueryData<SupportTicketMessage[]>(
        ["admin", "support", "messages", result.message.ticket_id],
        (current) => {
          const withoutTemp = (current ?? []).filter((message) => message.id !== context?.tempId)
          return upsertById(withoutTemp, result.message, sortMessages)
        },
      )
      invalidate()
    },
  })
}

export function useUploadAdminSupportAttachment() {
  return useMutation({ mutationFn: uploadSupportAttachment })
}

export function useAdminSupportAttachmentUrl() {
  return useMutation({ mutationFn: fetchSupportAttachmentUrl })
}

export function useDeleteAdminSupportTicket() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: deleteAdminSupportTicket, onSuccess: invalidate })
}
