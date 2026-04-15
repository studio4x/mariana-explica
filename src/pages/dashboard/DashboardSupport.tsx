import { useState, type FormEvent } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useCreateSupportTicket,
  useReplySupportTicket,
  useSupportTicketMessages,
  useSupportTickets,
} from "@/hooks/useDashboard"
import { formatDateTime } from "@/utils/date"

export function DashboardSupport() {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [reply, setReply] = useState("")
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(undefined)
  const ticketsQuery = useSupportTickets()
  const tickets = ticketsQuery.data ?? []
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0]
  const messagesQuery = useSupportTicketMessages(selectedTicket?.id)
  const createTicket = useCreateSupportTicket()
  const replyTicket = useReplySupportTicket()

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim()) return
    const created = await createTicket.mutateAsync({ subject, message })
    setSubject("")
    setMessage("")
    setSelectedTicketId(created.id)
  }

  const handleReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTicketId || !reply.trim()) return
    await replyTicket.mutateAsync({ ticketId: selectedTicketId, message: reply })
    setReply("")
  }

  if (ticketsQuery.isLoading) {
    return <LoadingState message="Carregando suporte..." />
  }

  if (ticketsQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os tickets"
        message={ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Tente novamente em instantes."}
        onRetry={() => void ticketsQuery.refetch()}
      />
    )
  }

  const messages = messagesQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Suporte" description="Abra tickets e acompanhe o histórico das respostas." />

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="space-y-6">
          <form onSubmit={handleCreateTicket} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Novo ticket</h2>
            <div className="mt-5 space-y-4">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Assunto"
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Descreva o que precisa"
                rows={5}
                className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <Button type="submit" disabled={createTicket.isPending}>
                {createTicket.isPending ? "Enviando..." : "Criar ticket"}
              </Button>
            </div>
          </form>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Tickets</h2>
            {tickets.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Ainda sem tickets"
                  message="Quando abrir um atendimento, ele aparece nesta lista."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedTicket?.id === ticket.id ? "border-slate-900 bg-slate-900 text-white" : "bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{ticket.subject}</p>
                      <StatusBadge label={ticket.status} tone={ticket.status === "closed" ? "danger" : "warning"} />
                    </div>
                    <p className={`mt-2 text-sm ${selectedTicket?.id === ticket.id ? "text-white/80" : "text-slate-600"}`}>
                      {ticket.message}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          {selectedTicket ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{selectedTicket.subject}</h2>
                <StatusBadge label={selectedTicket.status} tone={selectedTicket.status === "closed" ? "danger" : "warning"} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{selectedTicket.message}</p>

              <div className="mt-6 space-y-3">
                {messages.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge label={entry.sender_role === "admin" ? "Suporte" : "Você"} tone={entry.sender_role === "admin" ? "info" : "neutral"} />
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{formatDateTime(entry.created_at)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{entry.message}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="mt-6 space-y-4">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  placeholder="Responder ticket"
                  className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                />
                <Button type="submit" disabled={replyTicket.isPending}>
                  {replyTicket.isPending ? "Enviando..." : "Responder"}
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              title="Selecione um ticket"
              message="Escolha um ticket para ver o histórico de mensagens."
            />
          )}
        </section>
      </div>
    </div>
  )
}
