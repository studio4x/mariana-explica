import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Download,
  MailCheck,
  MailQuestion,
  MailX,
  RefreshCw,
  Search,
  UserRoundPlus,
  X,
} from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { useAdminFreeProductLeads, useAdminProducts } from "@/hooks/useAdmin"
import {
  downloadFreeProductLeadsCsv,
  getFreeProductLeadStatusLabel,
} from "@/lib/free-product-leads"
import { exportAdminFreeProductLeads } from "@/services"
import type { AdminFreeProductLeadDeliveryStatus } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

const PAGE_SIZE = 25

const statusTone: Record<AdminFreeProductLeadDeliveryStatus, "warning" | "success" | "danger"> = {
  queued: "warning",
  sent: "success",
  failed: "danger",
}

function sourceLabel(source: string) {
  return source === "public_product_page" ? "Página pública" : source
}

export function AdminFreeProductLeads() {
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [productId, setProductId] = useState("")
  const [deliveryStatus, setDeliveryStatus] = useState<"" | AdminFreeProductLeadDeliveryStatus>("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setQuery(searchInput.trim()), 350)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const filters = useMemo(
    () => ({
      query: query || undefined,
      productId: productId || undefined,
      deliveryStatus: deliveryStatus || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, deliveryStatus, productId, query],
  )

  const leadsQuery = useAdminFreeProductLeads({ ...filters, offset: page * PAGE_SIZE, limit: PAGE_SIZE })
  const productsQuery = useAdminProducts()
  const freeProducts = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.product_type === "free"),
    [productsQuery.data],
  )

  const data = leadsQuery.data
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))
  const hasFilters = Boolean(searchInput || productId || deliveryStatus || dateFrom || dateTo)

  const updateFilter = (update: () => void) => {
    update()
    setPage(0)
    setExportFeedback(null)
  }

  const clearFilters = () => {
    setSearchInput("")
    setQuery("")
    setProductId("")
    setDeliveryStatus("")
    setDateFrom("")
    setDateTo("")
    setPage(0)
    setExportFeedback(null)
  }

  const handleExport = async () => {
    setIsExporting(true)
    setExportFeedback(null)
    try {
      const response = await exportAdminFreeProductLeads(filters)
      downloadFreeProductLeadsCsv(response.rows)
      setExportFeedback(
        response.truncated
          ? `Foram exportados os primeiros ${response.rows.length.toLocaleString("pt-PT")} registos. Refine os filtros para exportar os restantes.`
          : `${response.rows.length.toLocaleString("pt-PT")} registo(s) exportado(s) com sucesso.`,
      )
    } catch (error) {
      setExportFeedback(error instanceof Error ? error.message : "Não foi possível exportar os leads.")
    } finally {
      setIsExporting(false)
    }
  }

  if (leadsQuery.isLoading || productsQuery.isLoading) {
    return <LoadingState message="A carregar leads de materiais gratuitos..." />
  }

  if (leadsQuery.isError || productsQuery.isError) {
    const error = leadsQuery.error ?? productsQuery.error
    return (
      <ErrorState
        title="Não foi possível carregar os leads"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void leadsQuery.refetch()
          void productsQuery.refetch()
        }}
      />
    )
  }

  const metrics = data?.metrics ?? { total: 0, queued: 0, sent: 0, failed: 0 }
  const firstVisible = data?.count ? page * PAGE_SIZE + 1 : 0
  const lastVisible = Math.min((page + 1) * PAGE_SIZE, data?.count ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Leads de materiais gratuitos"
          description="Acompanha os contactos que solicitaram materiais gratuitos e o estado do envio por e-mail."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void leadsQuery.refetch()}
            disabled={leadsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => void handleExport()}
            disabled={isExporting || metrics.total === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "A exportar..." : "Exportar CSV"}
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Leads únicos", value: metrics.total, icon: UserRoundPlus, color: "bg-sky-50 text-sky-700" },
          { label: "E-mails enviados", value: metrics.sent, icon: MailCheck, color: "bg-emerald-50 text-emerald-700" },
          { label: "Na fila", value: metrics.queued, icon: MailQuestion, color: "bg-amber-50 text-amber-700" },
          { label: "Falhas", value: metrics.failed, icon: MailX, color: "bg-rose-50 text-rose-700" },
        ].map((card) => (
          <article key={card.label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-3xl font-black text-slate-950">{card.value.toLocaleString("pt-PT")}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{card.label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(260px,1.4fr)_minmax(210px,1fr)_180px_160px_160px]">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Pesquisar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(event) => updateFilter(() => setSearchInput(event.target.value))}
                  placeholder="Nome ou e-mail..."
                  maxLength={120}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Material</span>
              <select
                value={productId}
                onChange={(event) => updateFilter(() => setProductId(event.target.value))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="">Todos os materiais</option>
                {freeProducts.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Entrega</span>
              <select
                value={deliveryStatus}
                onChange={(event) => updateFilter(() => setDeliveryStatus(event.target.value as typeof deliveryStatus))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="">Todos os estados</option>
                <option value="sent">Enviado</option>
                <option value="queued">Na fila</option>
                <option value="failed">Falhou</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Desde</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => updateFilter(() => setDateFrom(event.target.value))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Até</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => updateFilter(() => setDateTo(event.target.value))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-950"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          ) : null}
        </div>

        {exportFeedback ? (
          <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900" role="status">
            {exportFeedback}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {data?.count === 0
              ? "Nenhum registo no filtro atual"
              : `A mostrar ${firstVisible}–${lastVisible} de ${(data?.count ?? 0).toLocaleString("pt-PT")} registo(s)`}
          </p>
          <p className="inline-flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="h-4 w-4" />
            Datas baseadas na última solicitação
          </p>
        </div>

        {data?.rows.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Sem leads para mostrar"
              message={hasFilters ? "Ajuste os filtros para encontrar outros registos." : "Os novos pedidos de materiais gratuitos aparecerão aqui."}
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">Contacto</th>
                  <th className="px-4 py-4">Material</th>
                  <th className="px-4 py-4">Entrega</th>
                  <th className="px-4 py-4">Solicitações</th>
                  <th className="px-4 py-4">Primeira solicitação</th>
                  <th className="px-4 py-4">Última solicitação</th>
                  <th className="px-4 py-4">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data?.rows.map((lead) => (
                  <tr key={lead.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-950">{lead.name}</p>
                      <a className="mt-1 block text-xs text-sky-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{lead.product.title}</td>
                    <td className="px-4 py-4">
                      <StatusBadge label={getFreeProductLeadStatusLabel(lead.delivery_status)} tone={statusTone[lead.delivery_status]} />
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-800">{lead.request_count.toLocaleString("pt-PT")}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDateTime(lead.first_requested_at)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDateTime(lead.last_requested_at)}</td>
                    <td className="px-4 py-4 text-slate-600">{sourceLabel(lead.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" className="rounded-full" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
              Anterior
            </Button>
            <span className="text-sm font-semibold text-slate-600">Página {page + 1} de {totalPages}</span>
            <Button type="button" variant="outline" className="rounded-full" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>
              Seguinte
            </Button>
          </div>
        ) : null}

        <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Estes dados são usados apenas para entregar o material solicitado. A exportação fica registada na auditoria administrativa e não representa consentimento de marketing.
        </p>
      </section>
    </div>
  )
}
