import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createSupportTicket,
  fetchDashboardOverview,
  fetchDashboardProductContent,
  fetchDownloads,
  fetchMyProducts,
  fetchNotifications,
  fetchProfilePreferences,
  fetchSupportTicketMessages,
  fetchSupportTickets,
  markNotificationAsRead,
  replySupportTicket,
  requestAssetAccess,
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
