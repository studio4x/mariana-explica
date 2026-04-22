import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ArrowUpRight, Check, CreditCard, RefreshCw, Search, Settings2 } from "lucide-react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { CHECKOUT_MODES, type CheckoutMode } from "@/lib/admin-checkout"
import {
  fetchAdminCheckoutModeConfig,
  fetchAdminOrdersView,
  fetchAdminPaymentsStatus,
  updateAdminCheckoutModeConfig,
} from "@/services/admin.service"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"
import type { AdminOrderViewSummary } from "@/types/app.types"

type PaymentsTab = "history" | "settings"
type PaymentsFilter = "all" | "pending" | "paid" | "refunded"

const filterOptions: Array<{ key: PaymentsFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagos" },
  { key: "refunded", label: "Reembolsados" },
]

function orderStatusTone(status: AdminOrderViewSummary["status"]) {
  if (status === "paid") return "success"
  if (status === "pending") return "warning"
  if (status === "refunded") return "danger"
  if (status === "failed") return "danger"
  return "neutral"
}

function paymentStatusLabel(status: AdminOrderViewSummary["status"]) {
  if (status === "paid") return "Pago"
  if (status === "pending") return "Pendente"
  if (status === "refunded") return "Reembolsado"
  if (status === "failed") return "Falhou"
  return "Cancelado"
}

function productTypeLabel(productType: AdminOrderViewSummary["product_type"] | null) {
  if (productType === "free") return "Gratuito"
  if (productType === "hybrid") return "Hibrido"
  if (productType === "external_service") return "Externo"
  return "Pago"
}

function toUiMode(mode: "test" | "live" | null | undefined): CheckoutMode {
  return mode === "live" ? "production" : "sandbox"
}

function AdminPaymentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-[1.5rem] border bg-white" />
      <div className="h-[32rem] animate-pulse rounded-[1.75rem] border bg-white" />
    </div>
  )
}

export function AdminPayments() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<PaymentsTab>("history")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<PaymentsFilter>("all")
  const [draftMode, setDraftMode] = useState<CheckoutMode>("sandbox")

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders-view"],
    queryFn: fetchAdminOrdersView,
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const paymentsStatusQuery = useQuery({
    queryKey: ["admin", "payments-status"],
    queryFn: fetchAdminPaymentsStatus,
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const checkoutModeQuery = useQuery({
    queryKey: ["admin", "checkout-mode"],
    queryFn: fetchAdminCheckoutModeConfig,
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const updateCheckoutMode = useMutation({
    mutationFn: updateAdminCheckoutModeConfig,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "checkout-mode"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "payments-status"] }),
      ])
    },
  })

  const activeMode = useMemo(() => {
    const persisted = checkoutModeQuery.data?.config_value.mode ?? null
    const fallback = paymentsStatusQuery.data?.mode ?? null
    return toUiMode(persisted ?? fallback)
  }, [checkoutModeQuery.data?.config_value.mode, paymentsStatusQuery.data?.mode])

  useEffect(() => {
    setDraftMode(activeMode)
  }, [activeMode])

  const isLoading =
    ordersQuery.isLoading ||
    paymentsStatusQuery.isLoading ||
    checkoutModeQuery.isLoading

  const isError =
    ordersQuery.isError ||
    paymentsStatusQuery.isError ||
    checkoutModeQuery.isError

  if (isLoading) {
    return <AdminPaymentsSkeleton />
  }

  if (isError) {
    const error =
      ordersQuery.error instanceof Error
        ? ordersQuery.error
        : paymentsStatusQuery.error instanceof Error
          ? paymentsStatusQuery.error
          : checkoutModeQuery.error instanceof Error
            ? checkoutModeQuery.error
            : null

    return (
      <ErrorState
        title="Nao foi possivel carregar os pagamentos"
        message={error?.message ?? "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void ordersQuery.refetch()
          void paymentsStatusQuery.refetch()
          void checkoutModeQuery.refetch()
        }}
      />
    )
  }

  const orders = ordersQuery.data?.orders ?? []
  const pendingCount = ordersQuery.data?.summary.pendingCount ?? 0
  const refundedCount = ordersQuery.data?.summary.refundedCount ?? 0
  const paidCount = orders.filter((order) => order.status === "paid").length
  const currentUiMode = activeMode
  const currentModeConfig = CHECKOUT_MODES[currentUiMode]

  const filteredOrders = orders.filter((order) => {
    const matchesQuery = [
      order.id,
      order.user_name ?? "",
      order.user_email ?? "",
      order.product_title ?? "",
      order.status,
      order.payment_reference ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())

    if (!matchesQuery) {
      return false
    }

    if (filter === "all") {
      return true
    }

    return order.status === filter
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Pagamentos"
        description="Acompanhe compras registradas e ajuste o ambiente operacional do checkout."
      />

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Admin / Pagamentos</p>
            <h2 className="font-display text-2xl font-bold text-slate-950">Historico de pagamentos</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Consulta os pedidos processados, acompanha os estados e alterna o ambiente do checkout sem sair da pagina.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void ordersQuery.refetch()
              void paymentsStatusQuery.refetch()
              void checkoutModeQuery.refetch()
            }}
            disabled={ordersQuery.isFetching || paymentsStatusQuery.isFetching || checkoutModeQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            {ordersQuery.isFetching || paymentsStatusQuery.isFetching || checkoutModeQuery.isFetching
              ? "A atualizar..."
              : "Atualizar"}
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
            { key: "history" as const, label: "Historico", icon: CreditCard },
            { key: "settings" as const, label: "Configuracoes", icon: Settings2 },
          ].map((item) => {
            const Icon = item.icon
            const active = tab === item.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        {tab === "history" ? (
          <div className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total de pedidos</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{orders.length}</p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Pagos</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{paidCount}</p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Pendentes e reembolsados</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">
                  {pendingCount + refundedCount}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <label className="block flex-1">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Buscar
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por cliente, item, referencia ou status..."
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                </label>

                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((item) => {
                    const active = filter === item.key

                    return (
                      <Button
                        key={item.key}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className={[
                          "rounded-full",
                          active ? "bg-slate-950 text-white" : "bg-white",
                        ].join(" ")}
                        onClick={() => setFilter(item.key)}
                      >
                        {item.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <EmptyState
                title="Sem pagamentos encontrados"
                message="Tenta outro termo ou remove os filtros aplicados."
              />
            ) : (
              <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Comprado</th>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-b-0 align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{order.user_name ?? "Cliente nao identificado"}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">{order.user_email ?? order.user_id}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {productTypeLabel(order.product_type)}
                          </p>
                          <p className="mt-1 font-medium text-slate-950">{order.product_title ?? order.product_id}</p>
                          <p className="mt-1 text-xs text-slate-500">Pedido {order.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{formatDateTime(order.created_at)}</td>
                        <td className="px-4 py-4">
                          <StatusBadge label={paymentStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-950">
                          {formatProductPrice(order.final_price_cents, order.currency)}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => navigate(ROUTES.ADMIN_ORDERS)}
                          >
                            Abrir pedido
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 pt-6">
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Modo ativo</p>
                    <h3 className="mt-2 text-3xl font-bold">{currentModeConfig.label}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/80">
                      {paymentsStatusQuery.data?.mode === "live"
                        ? "Checkout real com chaves de producao."
                        : "Checkout de teste para validar a experiencia sem impacto comercial."}
                    </p>
                  </div>

                  <StatusBadge
                    label={currentModeConfig.label}
                    tone={paymentsStatusQuery.data?.mode === "live" ? "success" : "warning"}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Trocar ambiente</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {(["sandbox", "production"] as CheckoutMode[]).map((mode) => {
                      const active = draftMode === mode

                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            if (updateCheckoutMode.isPending) return
                            setDraftMode(mode)
                            void updateCheckoutMode.mutateAsync(mode).catch(() => {
                              setDraftMode(activeMode)
                            })
                          }}
                          className={[
                            "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                            active
                              ? "border-white bg-white text-slate-950 shadow-sm"
                              : "border-white/20 bg-transparent text-white hover:border-white/50",
                          ].join(" ")}
                        >
                          {active ? <Check className="h-4 w-4" /> : null}
                          {CHECKOUT_MODES[mode].label}
                        </button>
                      )
                    })}
                  </div>
                  {updateCheckoutMode.isPending ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/60">A guardar alteracao...</p>
                  ) : null}
                </div>

                <p className="mt-5 text-sm leading-7 text-white/75">
                  A mudanca entra no checkout imediatamente. O pedido interno e a confirmacao da Stripe passam a usar o
                  mesmo ambiente selecionado aqui.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Checklist do ambiente</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Itens ja validados para o modo {currentModeConfig.label.toLowerCase()} e requisitos que ainda pedem
                  conferencias manuais.
                </p>

                <div className="mt-5 space-y-3">
                  {currentModeConfig.checklist.map((item) => (
                    <div key={item.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium leading-6 text-slate-950">{item.name}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                        <StatusBadge label={item.status === "ready" ? "Pronto" : "Manual"} tone={item.status === "ready" ? "success" : "warning"} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notas</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {currentModeConfig.notes.map((note) => (
                      <li key={note} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Modo do checkout</p>
                <StatusBadge
                  label={currentModeConfig.label}
                  tone={paymentsStatusQuery.data?.mode === "live" ? "success" : "warning"}
                />
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                O checkout publico passa a obedecer o modo selecionado acima. Se alterares para Sandbox, as proximas
                sessoes Stripe sao criadas com chaves de teste; se alterares para Producao, passam a usar as chaves
                reais do backend.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
