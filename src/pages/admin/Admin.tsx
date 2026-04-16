import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { useAdminDashboardMetrics, useAdminOrders } from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

export function Admin() {
  const metricsQuery = useAdminDashboardMetrics()
  const ordersQuery = useAdminOrders()

  if (metricsQuery.isLoading || ordersQuery.isLoading) {
    return <LoadingState message="A carregar visao geral do admin..." />
  }

  if (metricsQuery.isError || ordersQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o admin"
        message={
          (metricsQuery.error instanceof Error && metricsQuery.error.message) ||
          (ordersQuery.error instanceof Error && ordersQuery.error.message) ||
          "Tenta novamente dentro de instantes."
        }
        onRetry={() => {
          void metricsQuery.refetch()
          void ordersQuery.refetch()
        }}
      />
    )
  }

  const metrics = metricsQuery.data
  const recentOrders = (ordersQuery.data ?? []).slice(0, 5)

  if (!metrics) {
    return (
      <EmptyState
        title="Sem dados operacionais"
        message="Assim que houver movimentacao, os indicadores vao aparecer aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visao geral"
        description="Indicadores rapidos da operacao, contexto para tomada de decisao e os pedidos mais recentes para acompanhamento imediato."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Utilizadores</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalUsers}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Base total sincronizada com o sistema de autenticacao.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Produtos publicados</p>
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
          <p className="mt-3 text-3xl font-bold">
            {formatProductPrice(metrics.revenueCents, "EUR")}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/82">Leitura rapida do volume financeiro registado no sistema.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Leitura operacional</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">O que acompanhar agora</h2>
          <div className="mt-5 grid gap-3">
            {[
              "Utilizadores e papeis devem ser revistos com cuidado para evitar erro operacional.",
              "Pedidos pendentes ou com falha merecem leitura antes de qualquer reprocessamento manual.",
              "Produtos publicados precisam de copy clara, estado correto e preco consistente.",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50/80 p-4 text-sm leading-7 text-slate-700">
                {item}
              </div>
            ))}
          </div>
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
                        <StatusBadge label={order.status} tone={order.status === "paid" ? "success" : order.status === "pending" ? "warning" : "neutral"} />
                      </td>
                      <td className="py-4 pr-4 text-slate-600">{formatProductPrice(order.final_price_cents, order.currency)}</td>
                      <td className="py-4 pr-4 text-slate-600">{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
