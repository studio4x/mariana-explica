import { useEffect, useState } from "react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Operação Stripe</p>
            <h2 className="font-display text-2xl font-bold text-slate-950">Modo operacional e checklist de produção</h2>
            <p className="text-sm leading-7 text-slate-600">
              Esta página concentra apenas a configuração operacional de pagamentos. O fluxo comercial continua no
              backend e o admin usa esta vista como referência de ambiente e deploy.
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

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={cn("rounded-[1.5rem] bg-gradient-to-br p-[1px]", activeMode.accent)}>
            <div className="rounded-[1.45rem] bg-slate-950 p-5 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">Modo em foco</p>
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
              {activeMode.checklist.map((item) => (
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
    </div>
  )
}
