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
  fetchProfilePreferences,
  fetchSupportTicketMessages,
  fetchSupportTickets,
  fetchUnreadNotificationsCount,
  markNotificationAsRead,
  replySupportTicket,
  requestAssetAccess,
  requestModulePdfAccess,
  saveAssessmentAttemptDraft,
  saveLessonNote,
  submitAssessmentAttempt,
  upsertLessonProgress,
  updateAccountPassword,
  updateProfilePreferences,
} from "@/services"

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
  })
}

export function useMyProducts() {
  return useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: fetchMyProducts,
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

export function useNotifications() {
  return useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: () => fetchNotifications(),
  })
}

export function useUnreadNotificationsCount() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["dashboard", "notifications", "unread-count", userId],
    queryFn: fetchUnreadNotificationsCount,
    enabled: Boolean(userId),
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
        () => {
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications"] })
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications", "unread-count", userId] })
        },
      )
      .subscribe()

    return () => {
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

export function useSupportTickets() {
  return useQuery({
    queryKey: ["dashboard", "support", "tickets"],
    queryFn: fetchSupportTickets,
  })
}

export function useSupportTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "support", "messages", ticketId],
    queryFn: () => fetchSupportTicketMessages(ticketId ?? ""),
    enabled: Boolean(ticketId),
  })
}

export function useProfilePreferences() {
  return useQuery({
    queryKey: ["dashboard", "profile"],
    queryFn: fetchProfilePreferences,
  })
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
    },
  })
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSupportTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "support"] })
    },
  })
}

export function useReplySupportTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: replySupportTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "support"] })
    },
  })
}

export function useUpdateProfilePreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfilePreferences,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "profile"] })
    },
  })
}

export function useUpdateAccountPassword() {
  return useMutation({
    mutationFn: updateAccountPassword,
  })
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
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "product", variables.productId] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "products"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] })
    },
  })
}
