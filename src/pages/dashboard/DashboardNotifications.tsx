import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useMarkNotificationAsRead, useNotifications } from "@/hooks/useDashboard"
import { formatDateTime } from "@/utils/date"

export function DashboardNotifications() {
  const { data, isLoading, isError, error, refetch } = useNotifications()
  const markAsRead = useMarkNotificationAsRead()

  if (isLoading) {
    return <LoadingState message="Carregando notificações..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as notificações"
        message={error instanceof Error ? error.message : "Tente novamente em instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const notifications = data ?? []
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Sem notificações"
        message="A comunicação com a sua conta aparece aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notificações" description="Histórico das comunicações mais recentes." />

      <div className="space-y-4">
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">{notification.title}</h2>
                  <StatusBadge
                    label={notification.status === "unread" ? "Não lida" : "Lida"}
                    tone={notification.status === "unread" ? "warning" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{notification.message}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {formatDateTime(notification.created_at)}
                </p>
              </div>
              {notification.status === "unread" ? (
                <Button
                  variant="outline"
                  onClick={() => void markAsRead.mutateAsync(notification.id)}
                  disabled={markAsRead.isPending}
                >
                  Marcar como lida
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
