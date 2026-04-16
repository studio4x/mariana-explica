import { useDeferredValue, useMemo, useState, type FormEvent } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminSupportTicketMessages,
  useAdminSupportTickets,
  useAdminUsers,
  useReplyAdminSupportTicket,
} from "@/hooks/useAdmin"
import type { AdminSupportTicketSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

function AdminSupportSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte"
        description="Fila de tickets, contexto do utilizador e resposta administrativa no mesmo fluxo."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-10 w-16 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-11 w-full animate-pulse rounded-xl bg-slate-100" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-8 w-64 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="mt-6 h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

const statusToneMap: Record<AdminSupportTicketSummary["status"], "warning" | "info" | "success" | "danger"> = {
  open: "warning",
  in_progress: "info",
  answered: "success",
  closed: "danger",
}

const priorityToneMap: Record<AdminSupportTicketSummary["priority"], "neutral" | "warning" | "danger"> = {
  low: "neutral",
  normal: "warning",
  high: "danger",
}

export function AdminSupport() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState("")
  const [reply, setReply] = useState("")
  const [status, setStatus] = useState<AdminSupportTicketSummary["status"]>("in_progress")
  const [priority, setPriority] = useState<AdminSupportTicketSummary["priority"]>("normal")
  const deferredQuery = useDeferredValue(query)

  const ticketsQuery = useAdminSupportTickets()
  const usersQuery = useAdminUsers()
  const replyTicket = useReplyAdminSupportTicket()

  const tickets = ticketsQuery.data ?? []
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0]
  const messagesQuery = useAdminSupportTicketMessages(selectedTicket?.id)

  const userMap = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  )

  const filteredTickets = tickets.filter((ticket) => {
    const user = userMap.get(ticket.user_id)
    const haystack = [
      ticket.subject,
      ticket.message,
      ticket.status,
      ticket.priority,
      user?.full_name ?? "",
      user?.email ?? "",
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(deferredQuery.trim().toLowerCase())
  })

  const openCount = tickets.filter((ticket) => ticket.status === "open").length
  const highPriorityCount = tickets.filter((ticket) => ticket.priority === "high").length
  const answeredCount = tickets.filter((ticket) => ticket.status === "answered").length

  const syncSelectedTicket = (ticket: AdminSupportTicketSummary | undefined) => {
    if (!ticket) {
      return
    }

    setSelectedTicketId(ticket.id)
    setStatus(ticket.status)
    setPriority(ticket.priority)
  }

  const handleReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTicket || !reply.trim()) {
      return
    }

    await replyTicket.mutateAsync({
      ticketId: selectedTicket.id,
      message: reply,
      status,
      priority,
    })

    setReply("")
  }

  if (ticketsQuery.isLoading || usersQuery.isLoading) {
    return <AdminSupportSkeleton />
  }

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

  const selectedUser = selectedTicket ? userMap.get(selectedTicket.user_id) : null
  const messages = messagesQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte"
        description="Fila de tickets, contexto do utilizador e resposta administrativa no mesmo fluxo."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tickets abertos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{openCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Alta prioridade</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{highPriorityCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Respondidos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{answeredCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Fila de tickets</h2>
              <p className="mt-1 text-sm text-slate-600">Pesquisa por assunto, estado, prioridade ou utilizador.</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar..."
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:w-72"
            />
          </div>

          {filteredTickets.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Sem tickets na fila"
                message="Os pedidos de suporte vao aparecer aqui assim que forem criados."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {filteredTickets.map((ticket) => {
                const user = userMap.get(ticket.user_id)
                const isActive = selectedTicket?.id === ticket.id

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => syncSelectedTicket(ticket)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      isActive ? "border-slate-900 bg-slate-900 text-white" : "bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{ticket.subject}</p>
                      <StatusBadge label={ticket.status} tone={statusToneMap[ticket.status]} />
                      <StatusBadge label={ticket.priority} tone={priorityToneMap[ticket.priority]} />
                    </div>
                    <p className={`mt-2 text-sm leading-6 ${isActive ? "text-white/78" : "text-slate-600"}`}>
                      {user?.full_name ?? "Utilizador"} · {user?.email ?? ticket.user_id}
                    </p>
                    <p className={`mt-2 text-sm leading-7 ${isActive ? "text-white/78" : "text-slate-600"}`}>
                      {ticket.message}
                    </p>
                    <p className={`mt-3 text-xs uppercase tracking-[0.18em] ${isActive ? "text-white/55" : "text-slate-500"}`}>
                      Atualizado em {formatDateTime(ticket.updated_at)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          {selectedTicket ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-bold text-slate-950">{selectedTicket.subject}</h2>
                    <StatusBadge label={selectedTicket.status} tone={statusToneMap[selectedTicket.status]} />
                    <StatusBadge label={selectedTicket.priority} tone={priorityToneMap[selectedTicket.priority]} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{selectedTicket.message}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>{selectedUser?.full_name ?? "Utilizador"}</span>
                    <span>{selectedUser?.email ?? selectedTicket.user_id}</span>
                    <span>Criado em {formatDateTime(selectedTicket.created_at)}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as AdminSupportTicketSummary["status"])}
                    className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                  >
                    <option value="open">Aberto</option>
                    <option value="in_progress">Em progresso</option>
                    <option value="answered">Respondido</option>
                    <option value="closed">Fechado</option>
                  </select>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as AdminSupportTicketSummary["priority"])}
                    className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>

              {messagesQuery.isLoading ? (
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {messages.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge
                          label={entry.sender_role === "admin" ? "Admin" : "Aluno"}
                          tone={entry.sender_role === "admin" ? "info" : "neutral"}
                        />
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-700">{entry.message}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleReply} className="mt-6 space-y-4">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={5}
                  placeholder="Escreve a resposta administrativa"
                  className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                />
                <Button type="submit" className="rounded-full" disabled={replyTicket.isPending}>
                  {replyTicket.isPending ? "A responder..." : "Responder ticket"}
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              title="Seleciona um ticket"
              message="Escolhe um ticket na fila para ver o historico e responder."
            />
          )}
        </section>
      </div>
    </div>
  )
}
