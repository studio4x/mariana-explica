import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Download, Paperclip, Send, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useReplySupportTicket,
  useSupportAttachmentUrl,
  useSupportTicket,
  useSupportTicketMessages,
  useUploadSupportAttachment,
} from "@/hooks/useDashboard"
import {
  useAdminSupportAttachmentUrl,
  useAdminSupportTicket,
  useAdminSupportTicketMessages,
  useAdminUsers,
  useUploadAdminSupportAttachment,
  useReplyAdminSupportTicket,
} from "@/hooks/useAdmin"
import { useAuth } from "@/hooks/useAuth"
import { ROUTES } from "@/lib/constants"
import {
  getSupportCategoryMeta,
  getSupportDueLabel,
  getSupportPriorityMeta,
  getSupportSlaStatusMeta,
  getSupportStatusMeta,
  supportBusinessHours,
} from "@/lib/support-sla"
import type { SupportTicketSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

function formatFileSize(size: number | null) {
  if (!size) return null
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function TicketDetail({ mode }: { mode: "student" | "admin" }) {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [reply, setReply] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [status, setStatus] = useState<SupportTicketSummary["status"]>("in_progress")
  const [priority, setPriority] = useState<SupportTicketSummary["priority"]>("normal")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const studentTicketQuery = useSupportTicket(mode === "student" ? ticketId : undefined)
  const adminTicketQuery = useAdminSupportTicket(mode === "admin" ? ticketId : undefined)
  const studentMessagesQuery = useSupportTicketMessages(mode === "student" ? ticketId : undefined)
  const adminMessagesQuery = useAdminSupportTicketMessages(mode === "admin" ? ticketId : undefined)
  const usersQuery = useAdminUsers(mode === "admin")
  const studentReply = useReplySupportTicket()
  const adminReply = useReplyAdminSupportTicket()
  const studentUpload = useUploadSupportAttachment()
  const adminUpload = useUploadAdminSupportAttachment()
  const studentAttachmentUrl = useSupportAttachmentUrl()
  const adminAttachmentUrl = useAdminSupportAttachmentUrl()
  const ticket = mode === "admin" ? adminTicketQuery.data : studentTicketQuery.data
  const messages = mode === "admin" ? adminMessagesQuery.data ?? [] : studentMessagesQuery.data ?? []
  const isLoading =
    mode === "admin"
      ? adminTicketQuery.isLoading || adminMessagesQuery.isLoading
      : studentTicketQuery.isLoading || studentMessagesQuery.isLoading
  const isError =
    mode === "admin"
      ? adminTicketQuery.isError || adminMessagesQuery.isError
      : studentTicketQuery.isError || studentMessagesQuery.isError

  useEffect(() => {
    if (!ticket || mode !== "admin" || adminReply.isPending) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps admin controls aligned with the selected ticket.
    setStatus(ticket.status)
    setPriority(ticket.priority)
  }, [adminReply.isPending, mode, ticket])

  const latestMessageId = messages.at(-1)?.id ?? null

  useLayoutEffect(() => {
    const scrollToLatestMessage = () => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
    }

    scrollToLatestMessage()
    const frame = window.requestAnimationFrame(scrollToLatestMessage)
    return () => window.cancelAnimationFrame(frame)
  }, [latestMessageId, ticket?.id])

  const selectedUser =
    mode === "admin" && ticket && "user_id" in ticket
      ? (usersQuery.data ?? []).find((item) => item.id === ticket.user_id)
      : null

  const handleReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ticket || (!reply.trim() && !attachment)) return

    const upload = attachment
      ? mode === "admin"
        ? await adminUpload.mutateAsync({ file: attachment, ticketId: ticket.id })
        : await studentUpload.mutateAsync({ file: attachment, ticketId: ticket.id })
      : null

    if (mode === "admin") {
      await adminReply.mutateAsync({ ticketId: ticket.id, message: reply, status, priority, attachment: upload })
    } else {
      await studentReply.mutateAsync({ ticketId: ticket.id, message: reply, attachment: upload })
    }

    setReply("")
    setAttachment(null)
  }

  const openAttachment = async (input: {
    bucket: string | null
    path: string | null
  }) => {
    if (!ticket || !input.bucket || !input.path) return
    const result =
      mode === "admin"
        ? await adminAttachmentUrl.mutateAsync({ ticketId: ticket.id, bucket: input.bucket, path: input.path })
        : await studentAttachmentUrl.mutateAsync({ ticketId: ticket.id, bucket: input.bucket, path: input.path })
    window.open(result.signed_url, "_blank", "noopener,noreferrer")
  }

  if (isLoading) return <LoadingState message="A carregar chamado..." />

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar este chamado"
        message="Tenta novamente dentro de instantes."
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (!ticket) {
    return <EmptyState title="Chamado não encontrado" message="Este ticket não existe ou não esta acessivel." />
  }

  const category = getSupportCategoryMeta(ticket.category)
  const statusMeta = getSupportStatusMeta(ticket.status)
  const slaMeta = getSupportSlaStatusMeta(ticket.sla_status)
  const priorityMeta = getSupportPriorityMeta(ticket.priority)
  const isClosedForStudent = mode === "student" && ticket.status === "closed"
  const isSubmitting =
    (mode === "admin" ? adminReply.isPending || adminUpload.isPending : studentReply.isPending || studentUpload.isPending)
  const backTo = mode === "admin" ? ROUTES.ADMIN_SUPPORT : ROUTES.DASHBOARD_SUPPORT

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate(backTo)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="mt-4 font-display text-3xl font-black text-slate-950">{ticket.subject}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ticket #{ticket.id.slice(0, 8)} · Aberto em {formatDateTime(ticket.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
          <StatusBadge label={slaMeta.label} tone={slaMeta.tone} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="overflow-hidden rounded-[1.75rem] border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4">
            <h2 className="font-display text-xl font-black text-slate-950">Histórico de mensagens</h2>
            {mode === "admin" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as SupportTicketSummary["status"])}
                  className="h-10 rounded-xl border bg-white px-3 text-sm outline-none"
                >
                  <option value="open">Aberto</option>
                  <option value="in_progress">Em atendimento</option>
                  <option value="answered">Respondido</option>
                  <option value="closed">Fechado</option>
                </select>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as SupportTicketSummary["priority"])}
                  className="h-10 rounded-xl border bg-white px-3 text-sm outline-none"
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            ) : null}
          </div>

          <div ref={chatScrollRef} className="h-[560px] space-y-4 overflow-y-auto bg-slate-50/50 p-5">
            <div className="max-w-[86%] rounded-2xl rounded-tl-sm border bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Descrição do problema</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{ticket.message}</p>
              {ticket.attachment_path ? (
                <button
                  type="button"
                  onClick={() => void openAttachment({ bucket: ticket.attachment_bucket, path: ticket.attachment_path })}
                  className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white"
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  {ticket.attachment_name ?? "Abrir anexo"}
                  {formatFileSize(ticket.attachment_size_bytes) ? ` (${formatFileSize(ticket.attachment_size_bytes)})` : ""}
                </button>
              ) : null}
              <p className="mt-3 text-xs font-semibold text-slate-400">{formatDateTime(ticket.created_at)}</p>
            </div>

            {messages.map((message) => {
              const isMine = message.sender_user_id === user?.id
              return (
                <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[86%] rounded-2xl p-4 shadow-sm ${
                      isMine
                        ? "rounded-tr-sm bg-slate-950 text-white"
                        : "rounded-tl-sm border bg-white text-slate-800"
                    }`}
                  >
                    {!isMine ? (
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                        {message.sender_role === "admin" ? "Equipe de suporte" : "Aluno"}
                      </p>
                    ) : null}
                    {message.message ? <p className="text-sm leading-7">{message.message}</p> : null}
                    {message.attachment_path ? (
                      <button
                        type="button"
                        onClick={() => void openAttachment({ bucket: message.attachment_bucket, path: message.attachment_path })}
                        className={`mt-3 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${
                          isMine
                            ? "bg-white/10 text-white hover:bg-white/20"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                        }`}
                      >
                        <Download className="mr-2 h-3.5 w-3.5" />
                        {message.attachment_name ?? "Abrir anexo"}
                        {formatFileSize(message.attachment_size_bytes) ? ` (${formatFileSize(message.attachment_size_bytes)})` : ""}
                      </button>
                    ) : null}
                    <p className={`mt-3 text-xs font-semibold ${isMine ? "text-white/60" : "text-slate-400"}`}>
                      {formatDateTime(message.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleReply} className="border-t bg-white p-4">
            {isClosedForStudent ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Este chamado foi encerrado.
              </div>
            ) : (
              <div className="space-y-3">
                {attachment ? (
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                    <span className="truncate">
                      <Paperclip className="mr-2 inline h-4 w-4" />
                      {attachment.name}
                    </span>
                    <button type="button" onClick={() => setAttachment(null)} className="text-red-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
                  <Button type="button" variant="outline" className="self-end rounded-2xl" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={2}
                    placeholder="Escreve a tua resposta"
                    className="min-h-12 flex-1 resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                  />
                  <Button type="submit" className="self-end rounded-2xl" disabled={isSubmitting || (!reply.trim() && !attachment)}>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl font-black text-slate-950">Informações</h2>
            <dl className="mt-4 space-y-4 text-sm">
              {selectedUser ? (
                <div>
                  <dt className="font-black text-slate-500">Usuário</dt>
                  <dd className="mt-1 text-slate-800">{selectedUser.full_name} · {selectedUser.email}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-black text-slate-500">Categoria</dt>
                <dd className="mt-1">{category.label}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Prioridade</dt>
                <dd className="mt-1"><StatusBadge label={priorityMeta.label} tone={priorityMeta.tone} /></dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">SLA da primeira resposta</dt>
                <dd className="mt-1">{category.firstResponseHours} horas uteis</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Prazo previsto</dt>
                <dd className="mt-1">{getSupportDueLabel(ticket)}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Primeira resposta</dt>
                <dd className="mt-1">{ticket.first_response_at ? formatDateTime(ticket.first_response_at) : "Ainda pendente"}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-500">Última atualização</dt>
                <dd className="mt-1">{formatDateTime(ticket.updated_at)}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            {category.label}: primeira resposta em ate {category.firstResponseHours} horas uteis. {supportBusinessHours}
          </div>
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            Em casos de fraude, pagamento indevido ou risco de acesso, mantenha o chamado ativo e detalhe o máximo possível.
          </div>
          <Link to={backTo} className="inline-flex text-sm font-bold text-sky-700 underline underline-offset-4">
            Ver todos os chamados
          </Link>
        </aside>
      </div>
    </div>
  )
}

export function DashboardSupportTicketDetail() {
  return <TicketDetail mode="student" />
}

export function AdminSupportTicketDetail() {
  return <TicketDetail mode="admin" />
}
