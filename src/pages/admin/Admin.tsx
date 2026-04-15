import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { useAdminDashboardMetrics, useAdminOrders } from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

export function Admin() {
  const metricsQuery = useAdminDashboardMetrics()
  const ordersQuery = useAdminOrders()

  if (metricsQuery.isLoading || ordersQuery.isLoading) {
    return <LoadingState message="Carregando visão geral do admin..." />
  }

  if (metricsQuery.isError || ordersQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o admin"
        message={
          (metricsQuery.error instanceof Error && metricsQuery.error.message) ||
          (ordersQuery.error instanceof Error && ordersQuery.error.message) ||
          "Tente novamente em instantes."
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
        message="Assim que a operação tiver movimentação, os indicadores aparecem aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel administrativo"
        description="Indicadores rápidos da operação e últimos pedidos."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Usuários</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalUsers}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Produtos publicados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalPublishedProducts}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pedidos pagos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalPaidOrders}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-[#007BFF] p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Receita registrada</p>
          <p className="mt-3 text-3xl font-bold">
            {formatProductPrice(metrics.revenueCents, "EUR")}
          </p>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Pedidos recentes</h2>
        {recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Sem pedidos recentes"
              message="Os últimos pedidos da operação aparecem aqui."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Pedido</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Criado</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="py-3 pr-4 font-medium text-slate-900">{order.id.slice(0, 8)}</td>
                    <td className="py-3 pr-4 text-slate-600">{order.status}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatProductPrice(order.final_price_cents, order.currency)}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatDateTime(order.created_at)}</td>
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
