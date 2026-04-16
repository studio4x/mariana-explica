import { useEffect, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { cn } from "@/lib/cn"
import { useAdminDashboardMetrics, useAdminOrders } from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

type CheckoutMode = "production" | "sandbox"

const CHECKOUT_MODE_STORAGE_KEY = "mariana-explica.admin.checkout-mode"

const CHECKOUT_MODES: Record<
  CheckoutMode,
  {
    label: string
    description: string
    accent: string
    notes: string[]
    envItems: Array<{
      name: string
      description: string
      status: "ready" | "manual"
    }>
  }
> = {
  production: {
    label: "Produção",
    description: "Modo real para checkout, webhook e grants em ambiente público.",
    accent: "from-emerald-500 to-emerald-600",
    notes: [
      "Usar credenciais reais da Stripe e webhook de produção.",
      "Todos os endpoints devem apontar para o ambiente publicado da Vercel e do Supabase.",
      "Nunca expor secrets no frontend.",
    ],
    envItems: [
      { name: "VITE_SUPABASE_URL", description: "URL pública do projeto Supabase.", status: "ready" },
      { name: "VITE_SUPABASE_ANON_KEY", description: "Chave pública do frontend.", status: "ready" },
      { name: "VITE_APP_URL", description: "URL pública da aplicação.", status: "ready" },
      { name: "VITE_STRIPE_PUBLIC_KEY", description: "Chave pública da Stripe para checkout.", status: "ready" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Segredo backend para operações administrativas.", status: "manual" },
      { name: "STRIPE_SECRET_KEY", description: "Secret key de produção configurada no backend.", status: "manual" },
      { name: "STRIPE_WEBHOOK_SECRET", description: "Webhook secret de produção configurado no backend.", status: "manual" },
      { name: "create-checkout", description: "Edge Function publicada.", status: "manual" },
      { name: "payment-webhook", description: "Edge Function publicada.", status: "manual" },
      { name: "claim-free-product", description: "Edge Function publicada.", status: "manual" },
      { name: "generate-asset-access", description: "Edge Function publicada.", status: "manual" },
    ],
  },
  sandbox: {
    label: "Sandbox",
    description: "Modo de teste para validar checkout, webhook e grants sem risco comercial.",
    accent: "from-amber-500 to-amber-600",
    notes: [
      "Usar chaves de teste e webhook separado por ambiente.",
      "Validar replay de webhook e idempotência antes de mover para produção.",
      "Manter URLs e segredos separados do ambiente real.",
    ],
    envItems: [
      { name: "VITE_SUPABASE_URL", description: "URL pública do projeto Supabase.", status: "ready" },
      { name: "VITE_SUPABASE_ANON_KEY", description: "Chave pública do frontend.", status: "ready" },
      { name: "VITE_APP_URL", description: "URL pública da aplicação.", status: "ready" },
      { name: "VITE_STRIPE_PUBLIC_KEY", description: "Chave pública de teste da Stripe.", status: "ready" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Segredo backend para operações administrativas.", status: "manual" },
      { name: "STRIPE_SANDBOX_SECRET_KEY", description: "Secret key de teste configurada no backend.", status: "manual" },
      { name: "STRIPE_SANDBOX_WEBHOOK_SECRET", description: "Webhook secret de teste configurado no backend.", status: "manual" },
      { name: "create-checkout", description: "Edge Function publicada.", status: "manual" },
      { name: "payment-webhook", description: "Edge Function publicada.", status: "manual" },
      { name: "claim-free-product", description: "Edge Function publicada.", status: "manual" },
      { name: "generate-asset-access", description: "Edge Function publicada.", status: "manual" },
    ],
  },
}

const checkoutEndpoints = (appUrl: string, supabaseUrl: string) => [
  {
    label: "Endpoint do checkout",
    value: appUrl ? `${appUrl.replace(/\/$/, "")}/checkout` : "/checkout",
    description: "Página pública que inicia a compra e chama a função backend.",
  },
  {
    label: "Função create-checkout",
    value: supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/create-checkout` : "Definir VITE_SUPABASE_URL",
    description: "Endpoint da Edge Function que cria a sessão na Stripe.",
  },
  {
    label: "URL do webhook",
    value: supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/payment-webhook` : "Definir VITE_SUPABASE_URL",
    description: "Endpoint registado na Stripe para confirmação e assinatura.",
  },
]

export function Admin() {
  const metricsQuery = useAdminDashboardMetrics()
  const ordersQuery = useAdminOrders()
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>(() => {
    if (typeof window === "undefined") {
      return "production"
    }

    const storedMode = window.localStorage.getItem(CHECKOUT_MODE_STORAGE_KEY)
    return storedMode === "sandbox" ? "sandbox" : "production"
  })

  useEffect(() => {
    window.localStorage.setItem(CHECKOUT_MODE_STORAGE_KEY, checkoutMode)
  }, [checkoutMode])

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
  const appUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ""
  const activeMode = CHECKOUT_MODES[checkoutMode]
  const endpoints = checkoutEndpoints(appUrl, supabaseUrl)

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

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Checkout e deploy</p>
            <h2 className="font-display text-2xl font-bold text-slate-950">Modo operacional e checklist da Vercel</h2>
            <p className="text-sm leading-7 text-slate-600">
              Usa este bloco para validar o ambiente ativo, confirmar as credenciais essenciais e rever os endpoints
              do checkout e do webhook sem depender de memória operacional.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(CHECKOUT_MODES).map(([mode, config]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCheckoutMode(mode as CheckoutMode)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  checkoutMode === mode
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white",
                )}
                aria-pressed={checkoutMode === mode}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={cn("rounded-[1.5rem] bg-gradient-to-br p-[1px]", activeMode.accent)}>
            <div className="rounded-[1.45rem] bg-slate-950 p-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">Modo ativo em foco</p>
                  <h3 className="mt-2 text-2xl font-bold">{activeMode.label}</h3>
                </div>
                <StatusBadge label={activeMode.label} tone={checkoutMode === "production" ? "success" : "warning"} />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">{activeMode.description}</p>
              <div className="mt-5 grid gap-2">
                {activeMode.notes.map((note) => (
                <div key={note} className="rounded-2xl bg-white/10 px-4 py-3 text-sm leading-6 text-white/85">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Checklist da Vercel</p>
            <div className="mt-4 grid gap-3">
              {activeMode.envItems.map((item) => (
                <div key={item.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{item.name}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                    <StatusBadge
                      label={item.status === "ready" ? "OK" : "Manual"}
                      tone={item.status === "ready" ? "success" : "neutral"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {endpoints.map((item) => (
            <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
              <p className="mt-3 break-all rounded-2xl bg-white px-4 py-3 font-mono text-sm text-slate-900">
                {item.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

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
