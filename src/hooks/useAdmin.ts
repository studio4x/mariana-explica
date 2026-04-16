import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  archiveAdminProduct,
  createAdminProduct,
  createAdminUser,
  deleteAdminUser,
  fetchAdminDashboardMetrics,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchAdminSupportTicketMessages,
  fetchAdminSupportTickets,
  fetchAdminUsers,
  markAdminOrderCancelled,
  markAdminOrderPaid,
  markAdminOrderRefunded,
  publishAdminProduct,
  reconcileAdminOrder,
  replyAdminSupportTicket,
  updateAdminProduct,
  updateAdminUser,
} from "@/services"

export function useAdminDashboardMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: fetchAdminDashboardMetrics,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
  })
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin", "products"],
    queryFn: fetchAdminProducts,
  })
}

export function useAdminOrders() {
  return useQuery({
    queryKey: ["admin", "orders"],
    queryFn: fetchAdminOrders,
  })
}

export function useAdminSupportTickets() {
  return useQuery({
    queryKey: ["admin", "support", "tickets"],
    queryFn: fetchAdminSupportTickets,
  })
}

export function useAdminSupportTicketMessages(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "support", "messages", ticketId],
    queryFn: () => fetchAdminSupportTicketMessages(ticketId ?? ""),
    enabled: Boolean(ticketId),
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

export function useReplyAdminSupportTicket() {
  const invalidate = useAdminInvalidation()
  return useMutation({ mutationFn: replyAdminSupportTicket, onSuccess: invalidate })
}
