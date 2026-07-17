import { useState } from "react"
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  Megaphone,
  MessageCircle,
  Sparkles,
  Trash2,
} from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
} from "@/hooks/useDashboard"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/constants"
import type { NotificationItem } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"
import { Link } from "react-router-dom"

function getNotificationIcon(type: NotificationItem["type"]) {
  if (type === "transactional") return CheckCircle2
  if (type === "support") return MessageCircle
  if (type === "marketing") return Megaphone
  if (type === "informational") return Info
  return Sparkles
}

function getNotificationIconClasses(type: NotificationItem["type"]) {
  if (type === "transactional") return "border-emerald-100 bg-emerald-50 text-emerald-500"
  if (type === "support") return "border-sky-100 bg-sky-50 text-sky-600"
  if (type === "marketing") return "border-violet-100 bg-violet-50 text-violet-600"
  return "border-cyan-100 bg-cyan-50 text-cyan-600"
}

function NotificationAction({ notification }: { notification: NotificationItem }) {
  if (!notification.link) return null

  const actionContent = (
    <span className="inline-flex items-center gap-1.5">
      Ver detalhes
      <ExternalLink className="h-3.5 w-3.5" />
    </span>
  )

  if (/^https?:\/\//i.test(notification.link)) {
    return (
      <a
        href={notification.link}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-lg px-0.5 py-1 text-sm font-black text-[#0879A5] transition hover:text-[#055A7A]"
      >
        {actionContent}
      </a>
    )
  }

  return (
    <Link
      to={notification.link || ROUTES.DASHBOARD}
      className="inline-flex items-center rounded-lg px-0.5 py-1 text-sm font-black text-[#0879A5] transition hover:text-[#055A7A]"
    >
      {actionContent}
    </Link>
  )
}

export function DashboardNotifications() {
  const { data, isLoading, isError, error, refetch } = useNotifications(true)
  const markAsRead = useMarkNotificationAsRead()
  const clearHistory = useMarkAllNotificationsAsRead()
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const notifications = data ?? []
  const unreadNotifications = notifications.filter((notification) => notification.status === "unread")
  const unreadCount = unreadNotifications.length

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAllAsRead) return

    setActionError(null)
    setIsMarkingAllAsRead(true)
    try {
      await Promise.all(unreadNotifications.map((notification) => markAsRead.mutateAsync(notification.id)))
    } catch {
      setActionError("Não foi possível marcar todas as notificações como lidas.")
    } finally {
      setIsMarkingAllAsRead(false)
    }
  }

  const handleClearHistory = async () => {
    if (notifications.length === 0 || clearHistory.isPending) return

    setActionError(null)
    try {
      await clearHistory.mutateAsync()
    } catch {
      setActionError("Não foi possível limpar o histórico de notificações.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#0879A5] md:text-4xl">
          Central de Notificações
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-[#28434C] md:text-base">
          Gere os teus alertas na plataforma, notificações push e configurações de e-mail.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-[1.5rem] border border-[#E2ECF0] bg-white p-8 shadow-[0_14px_40px_rgba(22,49,56,0.07)]">
          <LoadingState message="A carregar notificações..." />
        </div>
      ) : isError ? (
        <div className="rounded-[1.5rem] border border-[#E2ECF0] bg-white p-8 shadow-[0_14px_40px_rgba(22,49,56,0.07)]">
          <ErrorState
            title="Não foi possível carregar as notificações"
            message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <section className="overflow-hidden rounded-[1.5rem] border border-[#E2ECF0] bg-white p-4 shadow-[0_14px_40px_rgba(22,49,56,0.07)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-[#E8EFF2] pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-[#0879A5]" />
              <h2 className="text-lg font-black text-[#111C22]">Notificações Recentes</h2>
              <span className="rounded-full bg-[#0879A5] px-2.5 py-1 text-xs font-black text-white">
                {unreadCount} não lidas
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm font-black">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-lg px-2.5 text-[#0879A5] hover:bg-[#EFFAFF] hover:text-[#055A7A]"
                onClick={() => void handleMarkAllAsRead()}
                disabled={unreadCount === 0 || isMarkingAllAsRead}
              >
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Ler todas
              </Button>
              <span className="hidden h-5 w-px bg-[#E2ECF0] sm:block" aria-hidden="true" />
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-lg px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => void handleClearHistory()}
                disabled={notifications.length === 0 || clearHistory.isPending}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Limpar histórico
              </Button>
            </div>
          </div>

          {actionError ? (
            <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {actionError}
            </div>
          ) : null}

          {notifications.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title="Sem notificações"
                message="Mensagens importantes, avisos e atualizações vão aparecer aqui."
                icon={<Bell className="h-10 w-10 text-[#8AA9B4]" />}
              />
            </div>
          ) : (
            <div className="grid gap-3 pt-5">
              {notifications.map((notification) => {
                const isUnread = notification.status === "unread"
                const Icon = getNotificationIcon(notification.type)

                return (
                  <article
                    key={notification.id}
                    className={cn(
                      "rounded-2xl border p-4 transition sm:p-5",
                      isUnread
                        ? "border-[#1182A8] border-l-4 bg-[#F3FAFC] shadow-[0_8px_22px_rgba(14,130,168,0.1)]"
                        : "border-[#E0E9ED] bg-[#FCFEFF] shadow-[0_6px_18px_rgba(22,49,56,0.06)]",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                          getNotificationIconClasses(notification.type),
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <h3 className="flex items-start gap-1.5 text-base font-black leading-6 text-[#1C2C33]">
                            {isUnread ? <span className="mt-1 text-[#15A874]" aria-label="Não lida">●</span> : <Check className="mt-1 h-4 w-4 shrink-0 text-[#15A874]" />}
                            <span>{notification.title}</span>
                          </h3>
                          <time className="shrink-0 text-xs font-semibold text-[#45616B]" dateTime={notification.created_at}>
                            {formatDateTime(notification.created_at)}
                          </time>
                        </div>

                        <p className="mt-3 text-sm leading-7 text-[#28434C]">{notification.message}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <NotificationAction notification={notification} />
                          {isUnread && !notification.link ? (
                            <button
                              type="button"
                              onClick={() => void markAsRead.mutateAsync(notification.id)}
                              disabled={markAsRead.isPending}
                              className="inline-flex items-center rounded-lg px-0.5 py-1 text-sm font-black text-[#0879A5] transition hover:text-[#055A7A] disabled:cursor-wait disabled:opacity-60"
                            >
                              Marcar como lida
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
