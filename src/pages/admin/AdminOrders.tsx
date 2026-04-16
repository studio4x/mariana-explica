import { useDeferredValue, useMemo, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminOrders,
  useAdminProducts,
  useAdminUsers,
  useMarkAdminOrderCancelled,
  useMarkAdminOrderPaid,
  useMarkAdminOrderRefunded,
  useReconcileAdminOrder,
} from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

export function AdminOrders() {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const ordersQuery = useAdminOrders()
  const usersQuery = useAdminUsers()
  const productsQuery = useAdminProducts()
  const markPaid = useMarkAdminOrderPaid()
  const markRefunded = useMarkAdminOrderRefunded()
  const markCancelled = useMarkAdminOrderCancelled()
  const reconcile = useReconcileAdminOrder()

  const isLoading = ordersQuery.isLoading || usersQuery.isLoading || productsQuery.isLoading
  const isError = ordersQuery.isError || usersQuery.isError || productsQuery.isError

  const userMap = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  )
  const productMap = useMemo(
    () => new Map((productsQuery.data ?? []).map((product) => [product.id, product])),
    [productsQuery.data],
  )

  if (isLoading) {
    return <LoadingState message="A carregar pedidos..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os pedidos"
        message="Tenta novamente dentro de instantes."
        onRetry={() => {
          void ordersQuery.refetch()
          void usersQuery.refetch()
          void productsQuery.refetch()
        }}
      />
    )
  }

  const orders = ordersQuery.data ?? []
  const filteredOrders = orders.filter((order) => {
    const user = userMap.get(order.user_id)
    const product = productMap.get(order.product_id)
    const haystack = [
      order.id,
      order.status,
      user?.full_name ?? "",
      user?.email ?? "",
      product?.title ?? "",
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(deferredQuery.trim().toLowerCase())
  })
  const pendingCount = orders.filter((order) => order.status === "pending").length
  const refundedCount = orders.filter((order) => order.status === "refunded").length

  if (filteredOrders.length === 0 && !query.trim()) {
    return <EmptyState title="Sem pedidos" message="Os pedidos registados vao aparecer aqui." />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" description="Acompanhamento comercial com reprocessamentos e acoes administrativas controladas." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total de pedidos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{orders.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pendentes</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{pendingCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Reembolsados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{refundedCount}</p>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Lista de pedidos</h2>
            <p className="mt-1 text-sm text-slate-600">Pesquisa por pedido, utilizador, produto ou estado.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar..."
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:w-72"
          />
        </div>

        {filteredOrders.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Nenhum pedido encontrado" message="Tenta outro termo de pesquisa." />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Pedido</th>
                  <th className="py-3 pr-4 font-medium">Cliente</th>
                  <th className="py-3 pr-4 font-medium">Produto</th>
                  <th className="py-3 pr-4 font-medium">Estado</th>
                  <th className="py-3 pr-4 font-medium">Total</th>
                  <th className="py-3 pr-4 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const user = userMap.get(order.user_id)
                  const product = productMap.get(order.product_id)

                  return (
                    <tr key={order.id} className="border-b last:border-b-0 align-top">
                      <td className="py-4 pr-4">
                        <p className="font-medium text-slate-900">{order.id.slice(0, 8)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {formatDateTime(order.created_at)}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <p className="font-medium text-slate-900">{user?.full_name ?? "Utilizador"}</p>
                        <p className="mt-1 text-slate-600">{user?.email ?? order.user_id}</p>
                      </td>
                      <td className="py-4 pr-4 text-slate-600">{product?.title ?? order.product_id}</td>
                      <td className="py-4 pr-4">
                        <StatusBadge
                          label={order.status}
                          tone={
                            order.status === "paid"
                              ? "success"
                              : order.status === "pending"
                                ? "warning"
                                : order.status === "refunded"
                                  ? "danger"
                                  : "neutral"
                          }
                        />
                      </td>
                      <td className="py-4 pr-4 text-slate-600">
                        {formatProductPrice(order.final_price_cents, order.currency)}
                      </td>
                      <td className="py-4 pr-4">
                        <div className="grid gap-2 md:max-w-[220px]">
                          <Button variant="outline" className="justify-start rounded-full" onClick={() => void reconcile.mutateAsync(order.id)} disabled={reconcile.isPending}>
                            Reconciliar
                          </Button>
                          <Button variant="outline" className="justify-start rounded-full" onClick={() => void markPaid.mutateAsync({ orderId: order.id })} disabled={markPaid.isPending}>
                            Marcar como pago
                          </Button>
                          <Button variant="outline" className="justify-start rounded-full" onClick={() => void markRefunded.mutateAsync({ orderId: order.id })} disabled={markRefunded.isPending}>
                            Reembolsar
                          </Button>
                          <Button variant="destructive" className="justify-start rounded-full" onClick={() => void markCancelled.mutateAsync({ orderId: order.id })} disabled={markCancelled.isPending}>
                            Cancelar pedido
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
