import { useState, type FormEvent } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminCoupons,
  useAdminCouponUsages,
  useCreateAdminCoupon,
  useUpdateAdminCoupon,
} from "@/hooks/useAdmin"
import type { AdminCouponSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"
import { formatProductPrice } from "@/utils/currency"

function formatDateTimeLocalInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function AdminCouponsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cupons"
        description="Configuracao minima de descontos com regras simples de uso e acompanhamento."
      />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminCoupons() {
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [discountType, setDiscountType] = useState<AdminCouponSummary["discount_type"]>("percentage")
  const [discountValue, setDiscountValue] = useState("10")
  const [status, setStatus] = useState<AdminCouponSummary["status"]>("active")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [maxUses, setMaxUses] = useState("")
  const [maxUsesPerUser, setMaxUsesPerUser] = useState("")
  const [minimumOrderCents, setMinimumOrderCents] = useState("")

  const couponsQuery = useAdminCoupons()
  const usagesQuery = useAdminCouponUsages()
  const createCoupon = useCreateAdminCoupon()
  const updateCoupon = useUpdateAdminCoupon()

  if (couponsQuery.isLoading || usagesQuery.isLoading) {
    return <AdminCouponsSkeleton />
  }

  if (couponsQuery.isError || usagesQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os cupons"
        message="Tenta novamente dentro de instantes."
        onRetry={() => {
          void couponsQuery.refetch()
          void usagesQuery.refetch()
        }}
      />
    )
  }

  const coupons = couponsQuery.data ?? []
  const usages = usagesQuery.data ?? []
  const activeCount = coupons.filter((coupon) => coupon.status === "active").length
  const totalDiscountCents = usages.reduce((sum, usage) => sum + usage.discount_cents, 0)

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await createCoupon.mutateAsync({
      code,
      title: title.trim() || null,
      discountType,
      discountValue: Number(discountValue),
      status,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      maxUses: maxUses ? Number(maxUses) : null,
      maxUsesPerUser: maxUsesPerUser ? Number(maxUsesPerUser) : null,
      minimumOrderCents: minimumOrderCents ? Number(minimumOrderCents) : null,
    })

    setCode("")
    setTitle("")
    setDiscountType("percentage")
    setDiscountValue("10")
    setStatus("active")
    setStartsAt("")
    setExpiresAt("")
    setMaxUses("")
    setMaxUsesPerUser("")
    setMinimumOrderCents("")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cupons"
        description="Configuracao minima de descontos com regras simples de uso e acompanhamento operacional."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cupons</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{coupons.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ativos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{activeCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Usos registados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{usages.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Desconto concedido</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{formatProductPrice(totalDiscountCents, "EUR")}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form onSubmit={handleCreate} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Regra comercial</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Criar cupom</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Define o codigo, o tipo de desconto e os limites de uso sem depender de logica no frontend.
          </p>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Codigo"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm uppercase outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Titulo interno"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <select
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as AdminCouponSummary["discount_type"])}
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="percentage">Percentagem</option>
                <option value="fixed">Valor fixo</option>
              </select>
              <input
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Valor"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as AdminCouponSummary["status"])}
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="expired">Expirado</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                type="datetime-local"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                type="datetime-local"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <input
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                type="number"
                min="0"
                placeholder="Maximo de usos"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={maxUsesPerUser}
                onChange={(event) => setMaxUsesPerUser(event.target.value)}
                type="number"
                min="0"
                placeholder="Usos por utilizador"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <input
                value={minimumOrderCents}
                onChange={(event) => setMinimumOrderCents(event.target.value)}
                type="number"
                min="0"
                placeholder="Pedido minimo em cts"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>
          </div>

          {createCoupon.error instanceof Error ? (
            <p className="mt-4 text-sm text-red-600">{createCoupon.error.message}</p>
          ) : null}

          <Button type="submit" className="mt-4 rounded-full" disabled={createCoupon.isPending}>
            {createCoupon.isPending ? "A criar..." : "Criar cupom"}
          </Button>
        </form>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Cupons ativos e historico</h2>
              <p className="mt-1 text-sm text-slate-600">Edicao rapida das regras comerciais e leitura dos limites atuais.</p>
            </div>
            <StatusBadge label={`${coupons.length} registos`} tone="neutral" />
          </div>

          {coupons.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Sem cupons"
                message="Assim que um cupom for criado, ele aparece aqui com o respetivo estado."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {coupons.map((coupon) => {
                const usageCount = usages.filter((usage) => usage.coupon_id === coupon.id).length

                return (
                  <form
                    key={coupon.id}
                    className="rounded-2xl border bg-slate-50/70 p-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const formData = new FormData(event.currentTarget)
                      void updateCoupon.mutateAsync({
                        couponId: coupon.id,
                        code: String(formData.get("code") ?? coupon.code),
                        title: String(formData.get("title") ?? "") || null,
                        discountType: formData.get("discountType") as AdminCouponSummary["discount_type"],
                        discountValue: Number(formData.get("discountValue") ?? coupon.discount_value),
                        status: formData.get("status") as AdminCouponSummary["status"],
                        startsAt: formData.get("startsAt") ? new Date(String(formData.get("startsAt"))).toISOString() : null,
                        expiresAt: formData.get("expiresAt") ? new Date(String(formData.get("expiresAt"))).toISOString() : null,
                        maxUses: formData.get("maxUses") ? Number(formData.get("maxUses")) : null,
                        maxUsesPerUser: formData.get("maxUsesPerUser") ? Number(formData.get("maxUsesPerUser")) : null,
                        minimumOrderCents: formData.get("minimumOrderCents") ? Number(formData.get("minimumOrderCents")) : null,
                      })
                    }}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{coupon.code}</p>
                        <p className="mt-1 text-sm text-slate-600">{coupon.title ?? "Sem titulo interno"}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          Criado em {formatDateTime(coupon.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={coupon.status} tone={coupon.status === "active" ? "success" : coupon.status === "expired" ? "warning" : "neutral"} />
                        <StatusBadge label={`${usageCount} usos`} tone="info" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        name="code"
                        defaultValue={coupon.code}
                        className="h-11 rounded-xl border bg-white px-4 text-sm uppercase outline-none focus:border-slate-400"
                      />
                      <input
                        name="title"
                        defaultValue={coupon.title ?? ""}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <select
                        name="discountType"
                        defaultValue={coupon.discount_type}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="percentage">Percentagem</option>
                        <option value="fixed">Valor fixo</option>
                      </select>
                      <input
                        name="discountValue"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={coupon.discount_value}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <select
                        name="status"
                        defaultValue={coupon.status}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                        <option value="expired">Expirado</option>
                      </select>
                      <input
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocalInput(coupon.starts_at)}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <input
                        name="expiresAt"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocalInput(coupon.expires_at)}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <input
                        name="maxUses"
                        type="number"
                        min="0"
                        defaultValue={coupon.max_uses ?? ""}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <input
                        name="maxUsesPerUser"
                        type="number"
                        min="0"
                        defaultValue={coupon.max_uses_per_user ?? ""}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <input
                        name="minimumOrderCents"
                        type="number"
                        min="0"
                        defaultValue={coupon.minimum_order_cents ?? ""}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        Uso atual {coupon.current_uses} de {coupon.max_uses ?? "sem limite"} · Atualizado em {formatDateTime(coupon.updated_at)}
                      </p>
                      <Button type="submit" variant="outline" className="rounded-full" disabled={updateCoupon.isPending}>
                        Guardar alteracoes
                      </Button>
                    </div>
                  </form>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
