import { useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { HelpCircle, MessageSquare, Plus } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useCreateSupportTicket, useSupportTickets } from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import {
  getSupportCategoryMeta,
  getSupportDueLabel,
  getSupportPriorityMeta,
  getSupportSlaStatusMeta,
  getSupportStatusMeta,
  supportBusinessHours,
  supportCategories,
  supportPublicNote,
} from "@/lib/support-sla"
import type { SupportTicketSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

export function DashboardSupport() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(searchParams.get("openTicketModal") === "1")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState<SupportTicketSummary["category"]>("general")
  const [priority, setPriority] = useState<SupportTicketSummary["priority"]>("normal")
  const ticketsQuery = useSupportTickets()
  const createTicket = useCreateSupportTicket()
  const tickets = ticketsQuery.data ?? []
  const selectedCategory = useMemo(() => getSupportCategoryMeta(category), [category])

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim()) return
    const created = await createTicket.mutateAsync({ subject, message, category, priority })
    setSubject("")
    setMessage("")
    setCategory("general")
    setPriority("normal")
    setShowForm(false)
    setSearchParams({})
    navigate(`${ROUTES.DASHBOARD_SUPPORT}/${created.id}`)
  }

  if (ticketsQuery.isLoading) return <LoadingState message="A carregar suporte..." />

  if (ticketsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os chamados"
        message={ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void ticketsQuery.refetch()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Meus chamados"
          description="Acompanha conversas com o suporte, prazos de primeira resposta e historico de atendimento."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/suporte">
              <HelpCircle className="mr-2 h-4 w-4" />
              Ver FAQs
            </Link>
          </Button>
          <Button type="button" className="rounded-full" onClick={() => setShowForm((value) => !value)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo chamado
          </Button>
        </div>
      </div>

      <section className="rounded-[1.75rem] border border-sky-100 bg-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-xl font-black text-slate-950">SLA publico de primeira resposta</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              Pagamentos em ate 2 horas uteis. Demais categorias em ate 24 horas uteis. {supportBusinessHours}
            </p>
          </div>
          <StatusBadge label="Nao e prazo de resolucao final" tone="info" />
        </div>
      </section>

      {showForm ? (
        <form onSubmit={handleCreateTicket} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Novo chamado</p>
            <h2 className="mt-1 font-display text-2xl font-black text-slate-950">Como podemos ajudar?</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {selectedCategory.label}: primeira resposta em ate {selectedCategory.firstResponseHours} horas uteis. {supportPublicNote}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-black text-slate-700">
              Categoria
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as SupportTicketSummary["category"])}
                className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              >
                {supportCategories.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-black text-slate-700">
              Prioridade interna
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as SupportTicketSummary["priority"])}
                className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-black text-slate-700">
            Assunto
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex: problema com pagamento ou acesso"
              className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              required
            />
          </label>
          <label className="mt-4 block text-sm font-black text-slate-700">
            Descricao
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Inclui contexto, passos ja tentados e o que precisas resolver."
              rows={5}
              className="mt-2 w-full resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
              required
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={createTicket.isPending}>
              {createTicket.isPending ? "A enviar..." : "Enviar chamado"}
            </Button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-[1.75rem] border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="font-display text-xl font-black text-slate-950">Historico</h2>
          <StatusBadge label={`${tickets.length} chamados`} tone="neutral" />
        </div>

        {tickets.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Voce ainda nao abriu nenhum chamado."
              message="Quando precisares de ajuda, abre um chamado e acompanha a conversa por aqui."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">Assunto</th>
                  <th className="px-5 py-4">Categoria</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">SLA</th>
                  <th className="px-5 py-4">Prazo</th>
                  <th className="px-5 py-4">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const ticketCategory = getSupportCategoryMeta(ticket.category)
                  const statusMeta = getSupportStatusMeta(ticket.status)
                  const slaMeta = getSupportSlaStatusMeta(ticket.sla_status)
                  const priorityMeta = getSupportPriorityMeta(ticket.priority)
                  return (
                    <tr key={ticket.id} className={priorityMeta.rowClass}>
                      <td className="px-5 py-4">
                        <p className="font-black text-slate-950">{ticket.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">Aberto em {formatDateTime(ticket.created_at)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge label={ticketCategory.label} tone="info" />
                        <p className="mt-1 text-xs text-slate-500">Ate {ticketCategory.firstResponseHours}h uteis</p>
                      </td>
                      <td className="px-5 py-4"><StatusBadge label={statusMeta.label} tone={statusMeta.tone} /></td>
                      <td className="px-5 py-4"><StatusBadge label={slaMeta.label} tone={slaMeta.tone} /></td>
                      <td className="px-5 py-4 text-slate-600">{getSupportDueLabel(ticket)}</td>
                      <td className="px-5 py-4">
                        <Button asChild variant="outline" className="rounded-full">
                          <Link to={`${ROUTES.DASHBOARD_SUPPORT}/${ticket.id}`}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
