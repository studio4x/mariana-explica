import { Link } from "react-router-dom"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import {
  useAdminDashboardOverview,
} from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

interface OperationalAlert {
  title: string
  message: string
  tone: "warning" | "danger" | "info" | "neutral"
  to: string
  cta: string
}

function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Visao geral"
        description="Indicadores rapidos da operacao, contexto para tomada de decisao e os pedidos mais recentes para acompanhamento imediato."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-8 w-52 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-full space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function Admin() {
  const overviewQuery = useAdminDashboardOverview()

  if (overviewQuery.isLoading) {
    return <AdminOverviewSkeleton />
  }

  if (overviewQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o admin"
        message={
          overviewQuery.error instanceof Error ? overviewQuery.error.message : "Tenta novamente dentro de instantes."
        }
        onRetry={() => {
          void overviewQuery.refetch()
        }}
      />
    )
  }

  const overview = overviewQuery.data
  const metrics = overview?.metrics
  const recentOrders = overview?.recentOrders ?? []
  const alerts: OperationalAlert[] = []

  if (!overview || !metrics) {
    return (
      <EmptyState
        title="Sem dados operacionais"
        message="Assim que houver movimentacao, os indicadores vao aparecer aqui."
      />
    )
  }

  if (overview.alerts.openSupportTickets > 0) {
    alerts.push({
      title: "Tickets de suporte a pedir resposta",
      message: `${overview.alerts.openSupportTickets} ticket(s) em aberto com impacto direto na experiencia do aluno.`,
      tone: overview.alerts.highPrioritySupportTickets > 0 ? "danger" : "warning",
      to: ROUTES.ADMIN_SUPPORT,
      cta: "Abrir suporte",
    })
  }

  if (overview.alerts.unreadNotifications > 0) {
    alerts.push({
      title: "Notificacoes recentes por rever",
      message: `${overview.alerts.unreadNotifications} notificacao(oes) ainda estao sem leitura na fila operacional.`,
      tone: "neutral",
      to: ROUTES.ADMIN_NOTIFICATIONS,
      cta: "Abrir notificacoes",
    })
  }

  if (overview.alerts.failedEmails > 0) {
    alerts.push({
      title: "Emails com falha na fila",
      message: `${overview.alerts.failedEmails} entrega(s) precisam de reprocessamento ou leitura do erro.`,
      tone: "danger",
      to: ROUTES.ADMIN_OPERATIONS,
      cta: "Abrir operacoes",
    })
  }

  if (overview.alerts.failedJobs > 0) {
    alerts.push({
      title: "Jobs com falha recente",
      message: `${overview.alerts.failedJobs} execucao(oes) falharam e merecem conferencia operacional.`,
      tone: "warning",
      to: ROUTES.ADMIN_OPERATIONS,
      cta: "Rever jobs",
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visao geral"
        description="Indicadores rapidos da operacao, contexto para tomada de decisao e os pedidos mais recentes para acompanhamento imediato."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to={ROUTES.ADMIN_OPERATIONS}>Operacoes</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Utilizadores</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalUsers}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Base total sincronizada com o sistema de autenticacao.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cursos publicados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalPublishedProducts}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Oferta publicada com visibilidade na area publica.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pedidos pagos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalPaidOrders}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pedidos fechados com impacto direto no acesso e grants.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-primary p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Receita registada</p>
          <p className="mt-3 text-3xl font-bold">{formatProductPrice(metrics.revenueCents, "EUR")}</p>
          <p className="mt-2 text-sm leading-6 text-white/82">Leitura rapida do volume financeiro registado no sistema.</p>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Alertas operacionais</h2>
            <p className="mt-1 text-sm text-slate-600">Leitura curta do que merece acao antes de seguir para o restante da operacao.</p>
          </div>
          <StatusBadge label={`${alerts.length} alertas`} tone={alerts.length > 0 ? "warning" : "success"} />
        </div>

        {alerts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Sem alertas criticos"
              message="A operacao principal esta estavel neste momento."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-[1.5rem] border bg-slate-50/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{alert.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{alert.message}</p>
                  </div>
                  <StatusBadge label="Atencao" tone={alert.tone} />
                </div>
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={alert.to}>{alert.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Pedidos recentes</h2>
            <p className="mt-1 text-sm text-slate-600">Leitura rapida para conferencia e acao operacional.</p>
          </div>
          <StatusBadge label={`${recentOrders.length} linhas`} tone="neutral" />
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Sem pedidos recentes"
              message="Os pedidos mais recentes vao aparecer aqui."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Pedido</th>
                  <th className="py-3 pr-4 font-medium">Estado</th>
                  <th className="py-3 pr-4 font-medium">Total</th>
                  <th className="py-3 pr-4 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-4 font-medium text-slate-900">{order.id.slice(0, 8)}</td>
                    <td className="py-4 pr-4">
                      <StatusBadge
                        label={order.status}
                        tone={order.status === "paid" ? "success" : order.status === "pending" ? "warning" : "neutral"}
                      />
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {formatProductPrice(order.final_price_cents, order.currency)}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
