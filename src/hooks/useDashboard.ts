import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createSupportTicket,
  fetchAssessmentAttemptState,
  fetchDashboardOverview,
  fetchDashboardProductContent,
  fetchDownloads,
  fetchLessonNotes,
  fetchMyProducts,
  fetchNotifications,
  fetchProfilePreferences,
  fetchSupportTicketMessages,
  fetchSupportTickets,
  markNotificationAsRead,
  replySupportTicket,
  requestAssetAccess,
  saveAssessmentAttemptDraft,
  saveLessonNote,
  submitAssessmentAttempt,
  upsertLessonProgress,
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

export function useRequestAssetAccess() {
  return useMutation({
    mutationFn: requestAssetAccess,
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
