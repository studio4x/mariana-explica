import { useMemo, useState, type FormEvent } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminAffiliateReferrals,
  useAdminAffiliates,
  useAdminUsers,
  useCreateAdminAffiliate,
  useUpdateAdminAffiliate,
} from "@/hooks/useAdmin"
import type { AdminAffiliateSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"
import { formatProductPrice } from "@/utils/currency"

function AdminAffiliatesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Afiliados"
        description="Gestao minima de parceiros, codigos e leitura das conversoes registadas."
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

export function AdminAffiliates() {
  const [userId, setUserId] = useState("")
  const [affiliateCode, setAffiliateCode] = useState("")
  const [commissionType, setCommissionType] = useState<AdminAffiliateSummary["commission_type"]>("percentage")
  const [commissionValue, setCommissionValue] = useState("10")
  const [status, setStatus] = useState<AdminAffiliateSummary["status"]>("active")

  const affiliatesQuery = useAdminAffiliates()
  const referralsQuery = useAdminAffiliateReferrals()
  const usersQuery = useAdminUsers()
  const createAffiliate = useCreateAdminAffiliate()
  const updateAffiliate = useUpdateAdminAffiliate()

  const isLoading = affiliatesQuery.isLoading || referralsQuery.isLoading || usersQuery.isLoading
  const isError = affiliatesQuery.isError || referralsQuery.isError || usersQuery.isError

  const userMap = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  )

  const availableUsers = (usersQuery.data ?? []).filter((user) => user.role !== "admin")

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await createAffiliate.mutateAsync({
      userId,
      affiliateCode,
      commissionType,
      commissionValue: Number(commissionValue),
      status,
    })

    setUserId("")
    setAffiliateCode("")
    setCommissionType("percentage")
    setCommissionValue("10")
    setStatus("active")
  }

  if (isLoading) {
    return <AdminAffiliatesSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os afiliados"
        message="Tenta novamente dentro de instantes."
        onRetry={() => {
          void affiliatesQuery.refetch()
          void referralsQuery.refetch()
          void usersQuery.refetch()
        }}
      />
    )
  }

  const affiliates = affiliatesQuery.data ?? []
  const referrals = referralsQuery.data ?? []
  const activeCount = affiliates.filter((affiliate) => affiliate.status === "active").length
  const convertedReferrals = referrals.filter((referral) => referral.status === "converted").length
  const commissionsCents = referrals
    .filter((referral) => referral.status === "converted")
    .reduce((sum, referral) => sum + referral.commission_cents, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Afiliados"
        description="Gestao minima de parceiros, codigos e leitura das conversoes registadas no sistema."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Afiliados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{affiliates.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ativos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{activeCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Conversoes</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{convertedReferrals}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Comissoes</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{formatProductPrice(commissionsCents, "EUR")}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form onSubmit={handleCreate} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Entrada operacional</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Criar afiliado</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            O parceiro passa a ter codigo proprio e condicoes minimas de comissao para uso no checkout.
          </p>

          <div className="mt-5 grid gap-4">
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="">Seleciona um utilizador</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} - {user.email}
                </option>
              ))}
            </select>
            <input
              value={affiliateCode}
              onChange={(event) => setAffiliateCode(event.target.value.toUpperCase())}
              placeholder="Codigo do afiliado"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm uppercase outline-none focus:border-slate-400 focus:bg-white"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={commissionType}
                onChange={(event) => setCommissionType(event.target.value as AdminAffiliateSummary["commission_type"])}
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="percentage">Percentagem</option>
                <option value="fixed">Valor fixo</option>
              </select>
              <input
                value={commissionValue}
                onChange={(event) => setCommissionValue(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Valor da comissao"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminAffiliateSummary["status"])}
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </div>

          {createAffiliate.error instanceof Error ? (
            <p className="mt-4 text-sm text-red-600">{createAffiliate.error.message}</p>
          ) : null}

          <Button type="submit" className="mt-4 rounded-full" disabled={createAffiliate.isPending}>
            {createAffiliate.isPending ? "A criar..." : "Criar afiliado"}
          </Button>
        </form>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Parceiros ativos</h2>
              <p className="mt-1 text-sm text-slate-600">Edicao rapida de codigo, comissao e estado.</p>
            </div>
            <StatusBadge label={`${affiliates.length} registos`} tone="neutral" />
          </div>

          {affiliates.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Sem afiliados"
                message="Assim que um parceiro for registado, ele aparece aqui com o respetivo codigo."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {affiliates.map((affiliate) => {
                const user = userMap.get(affiliate.user_id)
                const relatedReferrals = referrals.filter((referral) => referral.affiliate_id === affiliate.id)
                const converted = relatedReferrals.filter((referral) => referral.status === "converted").length

                return (
                  <form
                    key={affiliate.id}
                    className="rounded-2xl border bg-slate-50/70 p-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const formData = new FormData(event.currentTarget)
                      void updateAffiliate.mutateAsync({
                        affiliateId: affiliate.id,
                        affiliateCode: String(formData.get("affiliateCode") ?? affiliate.affiliate_code),
                        commissionType: formData.get("commissionType") as AdminAffiliateSummary["commission_type"],
                        commissionValue: Number(formData.get("commissionValue") ?? affiliate.commission_value),
                        status: formData.get("status") as AdminAffiliateSummary["status"],
                      })
                    }}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{user?.full_name ?? "Parceiro"}</p>
                        <p className="mt-1 text-sm text-slate-600">{user?.email ?? affiliate.user_id}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          Criado em {formatDateTime(affiliate.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={affiliate.status} tone={affiliate.status === "active" ? "success" : affiliate.status === "blocked" ? "danger" : "neutral"} />
                        <StatusBadge label={`${converted} conversoes`} tone="info" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        name="affiliateCode"
                        defaultValue={affiliate.affiliate_code}
                        className="h-11 rounded-xl border bg-white px-4 text-sm uppercase outline-none focus:border-slate-400"
                      />
                      <select
                        name="commissionType"
                        defaultValue={affiliate.commission_type}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="percentage">Percentagem</option>
                        <option value="fixed">Valor fixo</option>
                      </select>
                      <input
                        name="commissionValue"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={affiliate.commission_value}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <select
                        name="status"
                        defaultValue={affiliate.status}
                        className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                        <option value="blocked">Bloqueado</option>
                      </select>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        Referencias rastreadas: {relatedReferrals.length} · Ultima atualizacao {formatDateTime(affiliate.updated_at)}
                      </p>
                      <Button type="submit" variant="outline" className="rounded-full" disabled={updateAffiliate.isPending}>
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
