import { useMemo } from "react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  getCheckoutEndpoints,
} from "@/lib/admin-checkout"
import { useQuery } from "@tanstack/react-query"
import { fetchAdminPaymentsStatus } from "@/services/admin.service"

export function AdminPayments() {
  const paymentsStatus = useQuery({
    queryKey: ["admin", "payments-status"],
    queryFn: fetchAdminPaymentsStatus,
    staleTime: 60_000,
  })

  const appUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")
  const endpoints = getCheckoutEndpoints(appUrl)

  const verifiedItems = useMemo(() => {
    const items: Array<{ name: string; description: string }> = []

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY
    const appBase = import.meta.env.VITE_APP_URL

    if (supabaseUrl) {
      items.push({ name: "VITE_SUPABASE_URL", description: "URL pública do projeto Supabase." })
    }
    if (supabaseAnon) {
      items.push({ name: "VITE_SUPABASE_ANON_KEY", description: "Chave pública do frontend." })
    }
    if (appBase) {
      items.push({ name: "VITE_APP_URL", description: "URL pública da aplicação." })
    }

    const stripe = paymentsStatus.data
    if (stripe) {
      if (stripe.test.secret_present && stripe.test.secret_valid) {
        items.push({ name: "STRIPE_SECRET_KEY_TEST", description: "Secret key de teste válida no backend." })
      }
      if (stripe.test.webhook_present) {
        items.push({ name: "STRIPE_WEBHOOK_SECRET_TEST", description: "Webhook secret de teste configurado no backend." })
      }
      if (stripe.live.secret_present && stripe.live.secret_valid) {
        items.push({ name: "STRIPE_SECRET_KEY_LIVE", description: "Secret key de produção válida no backend." })
      }
      if (stripe.live.webhook_present) {
        items.push({ name: "STRIPE_WEBHOOK_SECRET_LIVE", description: "Webhook secret de produção configurado no backend." })
      }
      items.push({
        name: "STRIPE_MODE",
        description: `Modo ativo no backend: ${stripe.mode === "live" ? "produção" : "sandbox/test"}.`,
      })
    }

    return items
  }, [paymentsStatus.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="Checklist validado (sem expor segredos) e endpoints principais do checkout e do webhook."
      />

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Operacao Stripe</p>
            <h2 className="font-display text-2xl font-bold text-slate-950">Modo operacional e checklist de producao</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Consulta rápida do modo ativo no backend, das variáveis essenciais detectadas e dos endpoints que precisam permanecer alinhados.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void paymentsStatus.refetch()}
            disabled={paymentsStatus.isFetching}
          >
            {paymentsStatus.isFetching ? "A validar..." : "Validar novamente"}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">Modo em foco</p>
                <h3 className="mt-2 text-2xl font-bold">
                  {paymentsStatus.data?.mode === "live" ? "Produção" : "Sandbox"}
                </h3>
              </div>
              <StatusBadge
                label={paymentsStatus.data?.mode === "live" ? "Produção" : "Sandbox"}
                tone={paymentsStatus.data?.mode === "live" ? "success" : "warning"}
              />
            </div>
            <p className="mt-4 text-sm leading-7 text-white/80">
              O modo ativo vem do backend (env `STRIPE_MODE`) e define qual chave é usada para criar o checkout.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Resumo rapido</p>
              <p className="mt-2 text-sm leading-7 text-white/80">
                Checkout, webhook e grants precisam apontar para o mesmo ambiente.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Checklist validado</p>
            <div className="mt-4 space-y-3">
              {verifiedItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  Nenhum item validado ainda. Clica em “Validar novamente” para consultar o backend.
                </div>
              ) : null}

              {verifiedItems.map((item) => (
                <div key={item.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium leading-6 text-slate-950">{item.name}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                    <StatusBadge label="OK" tone="success" />
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
    </div>
  )
}
