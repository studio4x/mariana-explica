import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase"
import { useAuth } from "@/hooks/useAuth"
import {
  createSupportTicket,
  fetchAccessibleAssessment,
  fetchAccessibleLesson,
  fetchAssessmentAttemptState,
  fetchDashboardOverview,
  fetchDashboardProductContent,
  fetchDownloads,
  fetchLessonNotes,
  fetchModuleAssetsByModule,
  fetchMyProducts,
  fetchNotifications,
  fetchPaymentHistory,
  fetchStudentOrderReceiptUrl,
  fetchProfilePreferences,
  fetchSupportTicketMessages,
  fetchSupportTicket,
  fetchSupportTickets,
  fetchUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  replySupportTicket,
  requestAssetAccess,
  requestModulePdfAccess,
  requestStudentOrderRefund,
  saveAssessmentAttemptDraft,
  saveLessonNote,
  submitAssessmentAttempt,
  upsertLessonProgress,
  updateAccountPassword,
  updateProfilePreferences,
  uploadProfileAvatar,
  uploadSupportAttachment,
  fetchSupportAttachmentUrl,
} from "@/services"
import type { NotificationItem, SupportTicketMessage, SupportTicketSummary } from "@/types/app.types"

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

function sortNotifications(items: NotificationItem[]) {
  return [...items].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
}

function sortTickets(items: SupportTicketSummary[]) {
  return [...items].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
}

function sortMessages(items: SupportTicketMessage[]) {
  return [...items].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
}

function refetchActive(queryClient: ReturnType<typeof useQueryClient>, queryKey: unknown[]) {
  void queryClient.refetchQueries({ queryKey, type: "active" })
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
  })
}

export function useMyProducts(options?: { enabled?: boolean }) {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: ["dashboard", "products", userId],
    queryFn: fetchMyProducts,
    enabled: (options?.enabled ?? true) && Boolean(userId),
  })
}

export function useDashboardProductContent(productId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "product", productId],
    queryFn: () => fetchDashboardProductContent(productId ?? ""),
    enabled: Boolean(productId),
  })
}

export function useLessonNote(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "lesson", lessonId, "note"],
    queryFn: () => fetchLessonNotes(lessonId ?? ""),
    enabled: Boolean(lessonId),
  })
}

export function useAccessibleLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "lesson", lessonId, "content"],
    queryFn: () => fetchAccessibleLesson(lessonId ?? ""),
    enabled: Boolean(lessonId),
  })
}

export function useAccessibleAssessment(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "assessment", assessmentId, "content"],
    queryFn: () => fetchAccessibleAssessment(assessmentId ?? ""),
    enabled: Boolean(assessmentId),
  })
}

export function useModuleAssets(moduleId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "module", moduleId, "assets"],
    queryFn: () => fetchModuleAssetsByModule(moduleId ?? ""),
    enabled: Boolean(moduleId),
  })
}

export function useAssessmentAttemptState(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "assessment", assessmentId, "attempt"],
    queryFn: () => fetchAssessmentAttemptState(assessmentId ?? ""),
    enabled: Boolean(assessmentId),
  })
}

export function useDownloads() {
  return useQuery({
    queryKey: ["dashboard", "downloads"],
    queryFn: fetchDownloads,
  })
}

export function useNotifications(includeArchived = false) {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const notificationsQueryKey: unknown[] = ["dashboard", "notifications", includeArchived ? "all" : "active", userId]
  const query = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => fetchNotifications(undefined, includeArchived, userId),
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!userId || includeArchived) return undefined

    const channel = supabase
      .channel(`student-notifications-list:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePayload) => {
          const nextNotification = payload.new as NotificationItem | undefined
          const oldNotification = payload.old as NotificationItem | undefined

          if (payload.eventType === "DELETE" && oldNotification?.id) {
            queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "active", userId], (current) =>
              removeById(current, oldNotification.id),
            )
          } else if (nextNotification?.id) {
            queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "active", userId], (current) =>
              upsertById(current, nextNotification, sortNotifications),
            )
          }

          refetchActive(queryClient, ["dashboard", "notifications", "active", userId])
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
          refetchActive(queryClient, ["dashboard", "notifications", "unread-count", userId])
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, notificationsQueryKey)
      refetchActive(queryClient, ["dashboard", "notifications", "unread-count", userId])
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, includeArchived, userId])

  return query
}

export function useUnreadNotificationsCount() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["dashboard", "notifications", "unread-count", userId],
    queryFn: () => fetchUnreadNotificationsCount(userId),
    enabled: Boolean(userId),
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!userId) return undefined

    const channel = supabase
      .channel(`student-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePayload) => {
          const nextNotification = payload.new as NotificationItem | undefined
          const oldNotification = payload.old as NotificationItem | undefined

          if (payload.eventType === "DELETE" && oldNotification?.id) {
            queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "active", userId], (current) =>
              removeById(current, oldNotification.id),
            )
          } else if (nextNotification?.id) {
            queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "active", userId], (current) =>
              upsertById(current, nextNotification, sortNotifications),
            )
          }

          refetchActive(queryClient, ["dashboard", "notifications", "active", userId])
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
          refetchActive(queryClient, ["dashboard", "notifications", "unread-count", userId])
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, ["dashboard", "notifications", "active", userId])
      refetchActive(queryClient, ["dashboard", "notifications", "unread-count", userId])
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  return query
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: ["dashboard", "payments"],
    queryFn: fetchPaymentHistory,
  })
}

export function useStudentOrderReceipt() {
  return useMutation({
    mutationFn: fetchStudentOrderReceiptUrl,
  })
}

export function useRequestStudentOrderRefund() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestStudentOrderRefund,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "payments"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "support"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications"] })
    },
  })
}

export function useSupportTickets() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["dashboard", "support", "tickets"],
    queryFn: fetchSupportTickets,
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!userId) return undefined

    const channel = supabase
      .channel(`student-support-tickets:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePayload) => {
          const nextTicket = payload.new as SupportTicketSummary | undefined
          const oldTicket = payload.old as SupportTicketSummary | undefined

          if (payload.eventType === "DELETE" && oldTicket?.id) {
            queryClient.setQueryData<SupportTicketSummary[]>(["dashboard", "support", "tickets"], (current) =>
              removeById(current, oldTicket.id),
            )
          } else if (nextTicket?.id) {
            queryClient.setQueryData<SupportTicketSummary[]>(["dashboard", "support", "tickets"], (current) =>
              upsertById(current, nextTicket, sortTickets),
            )
            queryClient.setQueryData(["dashboard", "support", "ticket", nextTicket.id], nextTicket)
          }

          refetchActive(queryClient, ["dashboard", "support"])
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, ["dashboard", "support"])
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  return query
}

export function useSupportTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "support", "ticket", ticketId],
    queryFn: () => fetchSupportTicket(ticketId ?? ""),
    enabled: Boolean(ticketId),
    refetchInterval: REALTIME_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useSupportTicketMessages(ticketId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["dashboard", "support", "messages", ticketId],
    queryFn: () => fetchSupportTicketMessages(ticketId ?? ""),
    enabled: Boolean(ticketId),
    refetchInterval: CHAT_FALLBACK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!ticketId) return undefined

    const channel = supabase
      .channel(`support-chat:${ticketId}`)
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
              ["dashboard", "support", "messages", ticketId],
              (current) => upsertById(current, nextMessage, sortMessages),
            )
          }

          refetchActive(queryClient, ["dashboard", "support", "messages", ticketId])
          refetchActive(queryClient, ["dashboard", "support"])
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
          const nextTicket = payload.new as SupportTicketSummary | undefined

          if (nextTicket?.id) {
            queryClient.setQueryData(["dashboard", "support", "ticket", nextTicket.id], nextTicket)
            queryClient.setQueryData<SupportTicketSummary[]>(["dashboard", "support", "tickets"], (current) =>
              upsertById(current, nextTicket, sortTickets),
            )
          }

          refetchActive(queryClient, ["dashboard", "support", "ticket", ticketId])
          refetchActive(queryClient, ["dashboard", "support"])
        },
      )
      .subscribe()

    const initialSync = window.setTimeout(() => {
      refetchActive(queryClient, ["dashboard", "support", "messages", ticketId])
      refetchActive(queryClient, ["dashboard", "support", "ticket", ticketId])
    }, 250)

    return () => {
      window.clearTimeout(initialSync)
      void supabase.removeChannel(channel)
    }
  }, [queryClient, ticketId])

  return query
}

export function useProfilePreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["dashboard", "profile"],
    queryFn: fetchProfilePreferences,
    enabled: options?.enabled ?? true,
  })
}

export function useMarkNotificationAsRead() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (notification) => {
      queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "active", userId], (current) =>
        upsertById(current, notification, sortNotifications),
      )
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
    },
  })
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSupportTicket,
    onSuccess: (ticket) => {
      queryClient.setQueryData<SupportTicketSummary[]>(["dashboard", "support", "tickets"], (current) =>
        upsertById(current, ticket, sortTickets),
      )
      queryClient.setQueryData(["dashboard", "support", "ticket", ticket.id], ticket)
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "support"] })
    },
  })
}

export function useReplySupportTicket() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: replySupportTicket,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard", "support", "messages", variables.ticketId] })

      const previousMessages =
        queryClient.getQueryData<SupportTicketMessage[]>(["dashboard", "support", "messages", variables.ticketId]) ?? []
      const tempId = `temp-${crypto.randomUUID()}`
      const optimisticMessage: SupportTicketMessage = {
        id: tempId,
        ticket_id: variables.ticketId,
        sender_user_id: userId ?? "pending-user",
        sender_role: "student",
        message: variables.message,
        attachment_bucket: variables.attachment?.bucket ?? null,
        attachment_path: variables.attachment?.path ?? null,
        attachment_name: variables.attachment?.file_name ?? null,
        attachment_mime_type: variables.attachment?.mime_type ?? null,
        attachment_size_bytes: variables.attachment?.file_size_bytes ?? null,
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<SupportTicketMessage[]>(
        ["dashboard", "support", "messages", variables.ticketId],
        (current) => upsertById(current, optimisticMessage, sortMessages),
      )

      return { previousMessages, ticketId: variables.ticketId, tempId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData<SupportTicketMessage[]>(
        ["dashboard", "support", "messages", context.ticketId],
        context.previousMessages,
      )
    },
    onSuccess: (result, _variables, context) => {
      queryClient.setQueryData<SupportTicketMessage[]>(
        ["dashboard", "support", "messages", result.message.ticket_id],
        (current) => {
          const withoutTemp = (current ?? []).filter((message) => message.id !== context?.tempId)
          return upsertById(withoutTemp, result.message, sortMessages)
        },
      )
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "support"] })
    },
  })
}

export function useUpdateProfilePreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfilePreferences,
    onSuccess: (profile) => {
      queryClient.setQueryData(["dashboard", "profile"], profile)
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "profile"] })
    },
  })
}

export function useUploadProfileAvatar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadProfileAvatar,
    onSuccess: (result) => {
      queryClient.setQueryData(["dashboard", "profile"], result.profile)
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "profile"] })
    },
  })
}

export function useMarkAllNotificationsAsRead() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: (notifications) => {
      queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "active", userId], () => [])
      queryClient.setQueryData<NotificationItem[]>(["dashboard", "notifications", "all", userId], (current) => {
        const next = current ?? []
        const updatedById = new Map(notifications.map((notification) => [notification.id, notification]))
        const merged = next.map((notification) => updatedById.get(notification.id) ?? notification)
        return sortNotifications(merged)
      })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
    },
  })
}

export function useUpdateAccountPassword() {
  return useMutation({
    mutationFn: updateAccountPassword,
  })
}

export function useUploadSupportAttachment() {
  return useMutation({ mutationFn: uploadSupportAttachment })
}

export function useSupportAttachmentUrl() {
  return useMutation({ mutationFn: fetchSupportAttachmentUrl })
}

export function useRequestAssetAccess() {
  return useMutation({
    mutationFn: requestAssetAccess,
  })
}

export function useRequestModulePdfAccess() {
  return useMutation({
    mutationFn: requestModulePdfAccess,
  })
}

export function useSaveLessonNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveLessonNote,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "lesson", variables.lessonId, "note"] })
    },
  })
}

export function useSaveAssessmentAttemptDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveAssessmentAttemptDraft,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", "assessment", variables.attemptId],
        exact: false,
      })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "assessment"] })
    },
  })
}

export function useSubmitAssessmentAttempt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: submitAssessmentAttempt,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "assessment"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "product"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
    },
  })
}

export function useUpsertLessonProgress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertLessonProgress,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard", "product", variables.productId] })

      const previousProduct = queryClient.getQueryData<Awaited<ReturnType<typeof fetchDashboardProductContent>>>([
        "dashboard",
        "product",
        variables.productId,
      ])

      const optimisticProgress = {
        id: `optimistic-${variables.lessonId}`,
        user_id: "",
        lesson_id: variables.lessonId,
        product_id: variables.productId,
        module_id: variables.moduleId,
        status: variables.status,
        progress_percent: variables.progressPercent,
        started_at: variables.status !== "not_started" ? new Date().toISOString() : null,
        completed_at: variables.status === "completed" ? new Date().toISOString() : null,
        last_accessed_at: new Date().toISOString(),
      } satisfies Awaited<ReturnType<typeof upsertLessonProgress>>

      queryClient.setQueryData<Awaited<ReturnType<typeof fetchDashboardProductContent>>>(
        ["dashboard", "product", variables.productId],
        (current) => {
          if (!current) return current

          const progress = current.progress.filter((item) => item.lesson_id !== variables.lessonId)
          return {
            ...current,
            lessons: current.lessons.map((lesson) =>
              lesson.id === variables.lessonId
                ? {
                    ...lesson,
                    progress_state: variables.status,
                    progress_percent: variables.progressPercent,
                  }
                : lesson,
            ),
            progress: [...progress, optimisticProgress],
          }
        },
      )

      return { previousProduct, productId: variables.productId }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(["dashboard", "product", context.productId], context.previousProduct)
      }
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "product", variables.productId] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "products"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
    },
  })
}
