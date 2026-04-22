import { useMemo, useState, type KeyboardEvent } from "react"
import { Bell, CheckCheck, ExternalLink, X } from "lucide-react"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/utils/date"
import type { AdminNotificationSummary, NotificationItem } from "@/types/app.types"
import { Link } from "react-router-dom"

interface FloatingNotificationsProps<TNotification extends NotificationItem | AdminNotificationSummary> {
  notifications: TNotification[]
  isLoading?: boolean
  unreadCount?: number
  onMarkAsRead: (notificationId: string) => void
  onClearAll: () => void
  markAsReadPending?: boolean
  clearAllPending?: boolean
  getAudienceLabel?: (notification: TNotification) => string | null
}

export function FloatingNotifications<TNotification extends NotificationItem | AdminNotificationSummary>({
  notifications,
  isLoading = false,
  unreadCount,
  onMarkAsRead,
  onClearAll,
  markAsReadPending = false,
  clearAllPending = false,
  getAudienceLabel,
}: FloatingNotificationsProps<TNotification>) {
  const [isOpen, setIsOpen] = useState(false)
  const effectiveUnreadCount = unreadCount ?? notifications.filter((item) => item.status === "unread").length
  const visibleNotifications = useMemo(() => notifications.slice(0, 30), [notifications])
  const canClearAll = visibleNotifications.length > 0

  const renderActionButton = (notification: TNotification) => {
    if (!notification.link) return null

    const isExternal = /^https?:\/\//i.test(notification.link)
    const actionContent = (
      <span className="inline-flex items-center gap-2">
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir
      </span>
    )

    if (isExternal) {
      return (
        <a
          href={notification.link}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          {actionContent}
        </a>
      )
    }

    return (
      <Button
        asChild
        variant="outline"
        className="h-8 rounded-full px-3 text-xs"
      >
        <Link to={notification.link} onClick={(event) => event.stopPropagation()}>
          {actionContent}
        </Link>
      </Button>
    )
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, notificationId: string, isUnread: boolean) => {
    if (markAsReadPending) return
    if (!isUnread) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onMarkAsRead(notificationId)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {isOpen ? (
        <div className="mb-4 w-[min(calc(100vw-2rem),430px)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Centro</p>
              <h2 className="text-base font-black text-slate-950">Notificacoes</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-3 text-xs"
                onClick={onClearAll}
                disabled={clearAllPending || !canClearAll}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Limpar todas
              </Button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                aria-label="Fechar notificacoes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(620px,calc(100vh-10rem))] overflow-y-auto p-3">
            {isLoading ? (
              <p className="px-3 py-8 text-sm font-semibold text-slate-500">A carregar notificacoes...</p>
            ) : visibleNotifications.length === 0 ? (
              <p className="px-3 py-8 text-sm font-semibold text-slate-500">Sem notificacoes por enquanto.</p>
            ) : (
              <div className="grid gap-2">
                {visibleNotifications.map((notification) => {
                  const isUnread = notification.status === "unread"
                  const audience = getAudienceLabel?.(notification)
                  const actionButton = renderActionButton(notification)

                  return (
                    <div
                      key={notification.id}
                      role="button"
                      tabIndex={0}
                      aria-busy={markAsReadPending}
                      onClick={() => {
                        if (markAsReadPending) return
                        if (isUnread) onMarkAsRead(notification.id)
                      }}
                      onKeyDown={(event) => handleCardKeyDown(event, notification.id, isUnread)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                        markAsReadPending ? "cursor-wait" : "cursor-pointer",
                        isUnread
                          ? "border-sky-200 bg-sky-50 shadow-[0_10px_30px_rgba(14,165,233,0.12)]"
                          : "border-slate-100 bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">{notification.title}</p>
                          {audience ? <p className="mt-1 text-xs font-semibold text-slate-500">{audience}</p> : null}
                        </div>
                        {isUnread ? <StatusBadge label="nao lida" tone="warning" /> : null}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{notification.message}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge label={notification.type} tone="info" />
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          {formatDateTime(notification.created_at)}
                        </span>
                      </div>
                      {actionButton ? <div className="mt-3 flex justify-start">{actionButton}</div> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_18px_45px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:bg-sky-700"
        aria-label={`Notificacoes${effectiveUnreadCount > 0 ? `, ${effectiveUnreadCount} nao lidas` : ""}`}
      >
        <Bell className="h-6 w-6" />
        {effectiveUnreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-black text-white ring-2 ring-white">
            {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}
