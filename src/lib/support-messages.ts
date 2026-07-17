import type { SupportTicketMessage } from "@/types/app.types"

const OPTIMISTIC_MESSAGE_WINDOW_MS = 2 * 60 * 1000

export function removeMatchingOptimisticSupportMessage(
  messages: SupportTicketMessage[] | undefined,
  persistedMessage: SupportTicketMessage,
) {
  const persistedTime = Date.parse(persistedMessage.created_at)
  let removedOptimisticMessage = false

  return (messages ?? []).filter((message) => {
    if (!message.id.startsWith("temp-")) return true
    if (message.ticket_id !== persistedMessage.ticket_id || message.message !== persistedMessage.message) return true
    if (message.attachment_path !== persistedMessage.attachment_path || message.attachment_name !== persistedMessage.attachment_name) return true
    if (message.sender_user_id !== persistedMessage.sender_user_id && message.sender_user_id !== "pending-user") return true

    const messageTime = Date.parse(message.created_at)
    const isMatchingMessage = Number.isFinite(persistedTime) && Number.isFinite(messageTime) && Math.abs(persistedTime - messageTime) <= OPTIMISTIC_MESSAGE_WINDOW_MS
    if (isMatchingMessage && !removedOptimisticMessage) {
      removedOptimisticMessage = true
      return false
    }

    return true
  })
}
