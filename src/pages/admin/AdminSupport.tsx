import { useDeferredValue, useMemo, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import { MessageSquare, RefreshCw, Search, Trash2, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAdminSupportTickets, useAdminUsers, useDeleteAdminSupportTicket } from "@/hooks/useAdmin"
import { ROUTES } from "@/lib/constants"
import {
  getSupportCategoryMeta,
  getSupportDueLabel,
  getSupportPriorityMeta,
  getSupportSlaStatusMeta,
  getSupportStatusMeta,
  supportCategories,
} from "@/lib/support-sla"
import type { AdminSupportTicketSummary, SupportTicketSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

type SortMode = "sla" | "priority" | "date"

export function AdminSupport() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicketSummary["status"]>("all")
  const [categoryFilter, setCategoryFilter] = useState<"all" | SupportTicketSummary["category"]>("all")
  const [sortMode, setSortMode] = useState<SortMode>("sla")
  const [ticketToDelete, setTicketToDelete] = useState<AdminSupportTicketSummary | null>(null)
  const deferredQuery = useDeferredValue(query)
  const ticketsQuery = useAdminSupportTickets()
  const usersQuery = useAdminUsers()
  const deleteTicket = useDeleteAdminSupportTicket()
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data])
  if (searchParams.get("tab") === "faq") {
    return <Navigate to={ROUTES.ADMIN_FAQ} replace />
  }

  const userMap = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  )

  const filteredTickets = useMemo(() => {
    const priorityWeight = (ticket: AdminSupportTicketSummary) => getSupportPriorityMeta(ticket.priority).weight
    const bySla = (left: AdminSupportTicketSummary, right: AdminSupportTicketSummary) => {
      const leftAnswered = left.first_response_at ? 1 : 0
      const rightAnswered = right.first_response_at ? 1 : 0
      if (leftAnswered !== rightAnswered) return leftAnswered - rightAnswered
      const leftDue = left.first_response_due_at ? new Date(left.first_response_due_at).getTime() : Number.MAX_SAFE_INTEGER
      const rightDue = right.first_response_due_at ? new Date(right.first_response_due_at).getTime() : Number.MAX_SAFE_INTEGER
      if (leftDue !== rightDue) return leftDue - rightDue
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    }

    return tickets
      .filter((ticket) => {
        const user = userMap.get(ticket.user_id)
        const haystack = [
          ticket.subject,
          ticket.message,
          ticket.status,
          ticket.priority,
          ticket.category,
          user?.full_name ?? "",
          user?.email ?? "",
        ].join(" ").toLowerCase()

        const matchesQuery = haystack.includes(deferredQuery.trim().toLowerCase())
        const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
        const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter
        return matchesQuery && matchesStatus && matchesCategory
      })
      .sort((left, right) => {
        if (sortMode === "priority") {
          const diff = priorityWeight(right) - priorityWeight(left)
          return diff || bySla(left, right)
        }
        if (sortMode === "date") {
          return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        }
        return bySla(left, right)
      })
  }, [categoryFilter, deferredQuery, sortMode, statusFilter, tickets, userMap])

  if (ticketsQuery.isLoading || usersQuery.isLoading) return <LoadingState message="A carregar suporte..." />

  if (ticketsQuery.isError || usersQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o suporte"
        message="Tenta novamente dentro de instantes."
        onRetry={() => {
          void ticketsQuery.refetch()
          void usersQuery.refetch()
        }}
      />
    )
  }

  const overdueCount = filteredTickets.filter((ticket) => ticket.sla_status === "overdue").length

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return
    await deleteTicket.mutateAsync(ticketToDelete.id)
    setTicketToDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Central de atendimento"
          description="Fila operacional de chamados com busca, filtros, SLA e resposta por detalhe."
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            void ticketsQuery.refetch()
            void usersQuery.refetch()
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar lista
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">SLA publico</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">2h uteis para pagamentos e 24h uteis para demais categorias.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Chamados filtrados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{filteredTickets.length}</p>
        </div>
        <div className={`rounded-[1.75rem] border p-5 shadow-sm ${overdueCount > 0 ? "border-red-200 bg-red-50" : "bg-white"}`}>
          <p className="text-sm font-medium text-slate-500">SLA atrasado</p>
          <p className={`mt-3 text-3xl font-bold ${overdueCount > 0 ? "text-red-700" : "text-slate-950"}`}>{overdueCount}</p>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_180px_190px_180px]">
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por assunto, nome ou e-mail..."
                className="h-11 w-full rounded-xl border bg-slate-50 pl-11 pr-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="all">Todos os status</option>
              <option value="open">Abertos</option>
              <option value="in_progress">Em atendimento</option>
              <option value="answered">Respondidos</option>
              <option value="closed">Fechados</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Categoria</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="all">Todas as categorias</option>
              {supportCategories.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Ordenacao</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="sla">Ordenar por SLA</option>
              <option value="priority">Ordenar por prioridade</option>
              <option value="date">Ordenar por data</option>
            </select>
          </label>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="p-8">
            <EmptyState title="Nenhum chamado encontrado." message="Altere os filtros ou aguarde novos pedidos." />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">Usuario</th>
                  <th className="px-4 py-4">Assunto</th>
                  <th className="px-4 py-4">Categoria</th>
                  <th className="px-4 py-4">SLA</th>
                  <th className="px-4 py-4">Prioridade</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Prazo</th>
                  <th className="px-4 py-4">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => {
                  const user = userMap.get(ticket.user_id)
                  const category = getSupportCategoryMeta(ticket.category)
                  const sla = getSupportSlaStatusMeta(ticket.sla_status)
                  const priority = getSupportPriorityMeta(ticket.priority)
                  const status = getSupportStatusMeta(ticket.status)

                  return (
                    <tr key={ticket.id} className={priority.rowClass}>
                      <td className="px-4 py-4">
                        <p className="font-black text-slate-950">{user?.full_name ?? "Utilizador"}</p>
                        <p className="mt-1 text-xs text-slate-500">{user?.email ?? ticket.user_id}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[220px] truncate font-black text-slate-950">{ticket.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(ticket.created_at)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={category.label} tone="info" />
                        <p className="mt-1 text-xs text-slate-500">Ate {category.firstResponseHours}h uteis</p>
                      </td>
                      <td className="px-4 py-4"><StatusBadge label={sla.label} tone={sla.tone} /></td>
                      <td className="px-4 py-4"><StatusBadge label={priority.label} tone={priority.tone} /></td>
                      <td className="px-4 py-4"><StatusBadge label={status.label} tone={status.tone} /></td>
                      <td className="px-4 py-4 text-slate-600">{getSupportDueLabel(ticket)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="rounded-full">
                            <Link to={`${ROUTES.ADMIN_SUPPORT}/${ticket.id}`}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Responder
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => setTicketToDelete(ticket)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
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

      {ticketToDelete ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-[0_24px_90px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Acao irreversivel</p>
                <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Excluir chamado permanentemente</h2>
              </div>
              <button type="button" onClick={() => setTicketToDelete(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Isto apaga o ticket, o historico de mensagens e os anexos associados. Chamado: <strong>{ticketToDelete.subject}</strong>.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setTicketToDelete(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-full"
                onClick={() => void handleDeleteTicket()}
                disabled={deleteTicket.isPending}
              >
                {deleteTicket.isPending ? "A excluir..." : "Confirmar exclusao"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
