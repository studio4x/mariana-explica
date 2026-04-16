import { useEffect, useState } from "react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  CHECKOUT_MODE_STORAGE_KEY,
  CHECKOUT_MODES,
  type CheckoutMode,
  getCheckoutEndpoints,
} from "@/lib/admin-checkout"

export function AdminPayments() {
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

  const appUrl = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")
  const activeMode = CHECKOUT_MODES[checkoutMode]
  const endpoints = getCheckoutEndpoints(appUrl)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="Modo ativo, checklist da Vercel e endpoints principais do checkout e do webhook."
      />

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Operacao Stripe</p>
            <h2 className="font-display text-2xl font-bold text-slate-950">Modo operacional e checklist de producao</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Consulta rapida do modo ativo, das variaveis essenciais e dos endpoints que precisam permanecer
              alinhados entre Vercel, Supabase e Stripe.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(CHECKOUT_MODES).map(([mode, config]) => (
              <Button
                key={mode}
                type="button"
                variant={checkoutMode === mode ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setCheckoutMode(mode as CheckoutMode)}
              >
                {config.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">Modo em foco</p>
                <h3 className="mt-2 text-2xl font-bold">{activeMode.label}</h3>
              </div>
              <StatusBadge label={activeMode.label} tone={checkoutMode === "production" ? "success" : "warning"} />
            </div>
            <p className="mt-4 text-sm leading-7 text-white/80">{activeMode.description}</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Resumo rapido</p>
              <p className="mt-2 text-sm leading-7 text-white/80">
                Checkout, webhook e grants precisam apontar para o mesmo ambiente.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Checklist da Vercel</p>
            <div className="mt-4 space-y-3">
              {activeMode.checklist.map((item) => (
                <div key={item.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium leading-6 text-slate-950">{item.name}</p>
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
    </div>
  )
}
