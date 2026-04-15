import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useMarkNotificationAsRead, useNotifications } from "@/hooks/useDashboard"
import { formatDateTime } from "@/utils/date"

export function DashboardNotifications() {
  const { data, isLoading, isError, error, refetch } = useNotifications()
  const markAsRead = useMarkNotificationAsRead()

  if (isLoading) {
    return <LoadingState message="A carregar notificacoes..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar as notificacoes"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const notifications = data ?? []
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Sem notificacoes"
        message="Mensagens importantes, avisos e atualizacoes vao aparecer aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificacoes"
        description="Historico das comunicacoes mais recentes relacionadas com a tua conta e os teus acessos."
      />

      <div className="space-y-4">
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-2xl font-bold text-slate-950">{notification.title}</h2>
                  <StatusBadge
                    label={notification.status === "unread" ? "Nao lida" : "Lida"}
                    tone={notification.status === "unread" ? "warning" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{notification.message}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {formatDateTime(notification.created_at)}
                </p>
              </div>
              {notification.status === "unread" ? (
                <Button
                  variant="outline"
                  className="rounded-full"
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
