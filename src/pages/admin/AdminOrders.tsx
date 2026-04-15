import { useMemo } from "react"
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
    return <LoadingState message="Carregando pedidos..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os pedidos"
        message="Tente novamente em instantes."
        onRetry={() => {
          void ordersQuery.refetch()
          void usersQuery.refetch()
          void productsQuery.refetch()
        }}
      />
    )
  }

  const orders = ordersQuery.data ?? []
  if (orders.length === 0) {
    return <EmptyState title="Sem pedidos" message="Os pedidos registrados aparecem aqui." />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" description="Acompanhe a operação comercial e reprocessamentos." />

      <div className="space-y-4">
        {orders.map((order) => {
          const user = userMap.get(order.user_id)
          const product = productMap.get(order.product_id)

          return (
            <div key={order.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">{product?.title ?? order.product_id}</h2>
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
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {user?.full_name ?? "Utilizador"} · {user?.email ?? order.user_id}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {formatProductPrice(order.final_price_cents, order.currency)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Criado em {formatDateTime(order.created_at)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button variant="outline" onClick={() => void reconcile.mutateAsync(order.id)} disabled={reconcile.isPending}>
                    Reconciliar
                  </Button>
                  <Button variant="outline" onClick={() => void markPaid.mutateAsync({ orderId: order.id })} disabled={markPaid.isPending}>
                    Marcar pago
                  </Button>
                  <Button variant="outline" onClick={() => void markRefunded.mutateAsync({ orderId: order.id })} disabled={markRefunded.isPending}>
                    Reembolsar
                  </Button>
                  <Button variant="outline" onClick={() => void markCancelled.mutateAsync({ orderId: order.id })} disabled={markCancelled.isPending}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
