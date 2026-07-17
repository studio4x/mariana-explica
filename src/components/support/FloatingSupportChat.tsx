import { useMemo, useRef, useState, type FormEvent } from "react"
import { BookOpen, ChevronLeft, Download, Loader2, MessageCircle, Paperclip, Send, X } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  useCreateSupportTicket,
  useMyProducts,
  useReplySupportTicket,
  useSupportAttachmentUrl,
  useSupportTicket,
  useSupportTicketMessages,
  useSupportTickets,
  useUploadSupportAttachment,
} from "@/hooks/useDashboard"
import type { DashboardProductSummary, SupportTicketSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

export interface FloatingSupportChatContext {
  productId: string
  productTitle: string
  currentContentTitle?: string | null
  currentContentType?: string | null
}

interface FloatingSupportChatProps {
  context?: FloatingSupportChatContext
}

function buildContextMessage(
  message: string,
  product: Pick<DashboardProductSummary, "id" | "title">,
  context?: FloatingSupportChatContext,
) {
  const lines = [
    "[Contexto do curso/material]",
    `Curso/material: ${product.title}`,
    `ID do curso/material: ${product.id}`,
  ]

  if (context?.currentContentTitle) {
    lines.push(`Conteúdo atual: ${context.currentContentTitle}`)
  }
  if (context?.currentContentType) {
    lines.push(`Tipo de conteúdo: ${context.currentContentType}`)
  }

  return `${lines.join("\n")}\n\nMensagem do aluno:\n${message.trim()}`
}

function ticketMatchesContext(ticket: SupportTicketSummary, context?: FloatingSupportChatContext) {
  return ticket.category === "course_chat" && (!context || ticket.product_id === context.productId)
}

export function FloatingSupportChat({ context }: FloatingSupportChatProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [reply, setReply] = useState("")
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null)
  const composerFileInputRef = useRef<HTMLInputElement | null>(null)
  const replyFileInputRef = useRef<HTMLInputElement | null>(null)
  const ticketsQuery = useSupportTickets()
  const productsQuery = useMyProducts({ enabled: !context })
  const createTicket = useCreateSupportTicket()
  const replyTicket = useReplySupportTicket()
  const uploadAttachment = useUploadSupportAttachment()
  const attachmentUrl = useSupportAttachmentUrl()
  const tickets = useMemo(
    () => (ticketsQuery.data ?? []).filter((ticket) => ticketMatchesContext(ticket, context)),
    [context, ticketsQuery.data],
  )
  const products = productsQuery.data ?? []
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null
  const activeTicketQuery = useSupportTicket(selectedTicketId ?? undefined)
  const messagesQuery = useSupportTicketMessages(selectedTicketId ?? undefined)
  const activeTicket = activeTicketQuery.data
  const messages = messagesQuery.data ?? []
  const isSending = createTicket.isPending || replyTicket.isPending || uploadAttachment.isPending

  const openComposer = () => {
    setSelectedTicketId(null)
    setReply("")
    setMessage("")
    setAttachment(null)
    setReplyAttachment(null)
    if (context) setSelectedProductId(context.productId)
    setIsComposerOpen(true)
  }

  const closePanel = () => {
    setIsOpen(false)
    setIsComposerOpen(false)
    setSelectedTicketId(null)
    setReply("")
    setReplyAttachment(null)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const product = context
      ? { id: context.productId, title: context.productTitle }
      : selectedProduct
    if (!product || !message.trim()) return

    const uploadedAttachment = attachment
      ? await uploadAttachment.mutateAsync({ file: attachment })
      : null
    const ticket = await createTicket.mutateAsync({
      subject: `Dúvida sobre ${product.title}`,
      message: buildContextMessage(message, product, context),
      productId: product.id,
      category: "course_chat",
      priority: "normal",
      attachment: uploadedAttachment,
    })

    setMessage("")
    setAttachment(null)
    if (composerFileInputRef.current) composerFileInputRef.current.value = ""
    setIsComposerOpen(false)
    setSelectedTicketId(ticket.id)
  }

  const handleReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTicketId || (!reply.trim() && !replyAttachment) || activeTicket?.status === "closed") return
    const uploadedAttachment = replyAttachment
      ? await uploadAttachment.mutateAsync({ file: replyAttachment, ticketId: selectedTicketId })
      : null
    await replyTicket.mutateAsync({ ticketId: selectedTicketId, message: reply, attachment: uploadedAttachment })
    setReply("")
    setReplyAttachment(null)
    if (replyFileInputRef.current) replyFileInputRef.current.value = ""
  }

  const openAttachment = async (input: { bucket: string | null; path: string | null }) => {
    if (!activeTicket || !input.bucket || !input.path) return
    const result = await attachmentUrl.mutateAsync({ ticketId: activeTicket.id, bucket: input.bucket, path: input.path })
    window.open(result.signed_url, "_blank", "noopener,noreferrer")
  }

  const selectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId)
    setIsComposerOpen(false)
    setReply("")
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 md:bottom-7 md:right-7">
      {isOpen ? (
        <section className="flex h-[min(620px,calc(100dvh-7rem))] w-[min(410px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
          <header className="flex items-center justify-between gap-3 bg-slate-950 px-5 py-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/20 text-sky-200">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-black">Chat com a equipa</p>
                <p className="truncate text-xs text-slate-300">
                  {context ? context.productTitle : "Dúvidas sobre os teus materiais"}
                </p>
              </div>
            </div>
            <button type="button" onClick={closePanel} className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Fechar chat">
              <X className="h-5 w-5" />
            </button>
          </header>

          {isComposerOpen ? (
            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Nova conversa</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950">Sobre qual material precisas de ajuda?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">A tua mensagem chegará diretamente à fila de tickets do suporte.</p>
                </div>
                {context ? (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
                    <p className="font-black text-slate-950">Contexto automático</p>
                    <p className="mt-1">{context.productTitle}</p>
                    {context.currentContentTitle ? <p className="mt-1 text-xs text-slate-500">A ver: {context.currentContentTitle}</p> : null}
                  </div>
                ) : (
                  <label className="block text-sm font-black text-slate-700">
                    Material liberado
                    <select
                      value={selectedProductId}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                      required
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-sky-500 focus:bg-white"
                    >
                      <option value="">Seleciona um material</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                    </select>
                    {productsQuery.isLoading ? <span className="mt-2 block text-xs font-medium text-slate-500">A carregar materiais...</span> : null}
                    {!productsQuery.isLoading && products.length === 0 ? <span className="mt-2 block text-xs font-medium text-amber-700">Não tens materiais liberados para selecionar.</span> : null}
                  </label>
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Categoria: <strong className="text-slate-950">Chat do curso</strong>. O curso/material selecionado será anexado à mensagem.
                </div>
                <label className="block text-sm font-black text-slate-700">
                  Mensagem
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={6}
                    required
                    maxLength={5000}
                    placeholder="Explica a tua dúvida ou o que aconteceu..."
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:bg-white"
                  />
                </label>
                {attachment ? (
                  <div className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-slate-700">
                    <span className="flex min-w-0 items-center gap-2 truncate"><Paperclip className="h-4 w-4 shrink-0 text-sky-700" />{attachment.name}</span>
                    <button type="button" onClick={() => { setAttachment(null); if (composerFileInputRef.current) composerFileInputRef.current.value = "" }} className="rounded-full p-1 text-slate-500 hover:bg-white" aria-label="Remover anexo">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-4">
                {tickets.length > 0 ? <button type="button" onClick={() => setIsComposerOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Voltar</button> : null}
                <input ref={composerFileInputRef} type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => composerFileInputRef.current?.click()} className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2.5 text-slate-600 hover:bg-slate-50" aria-label="Anexar arquivo">
                  <Paperclip className="h-4 w-4" />
                </button>
                <button type="submit" disabled={isSending || !message.trim() || (!context && !selectedProductId)} className="ml-auto inline-flex items-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Enviar mensagem
                </button>
              </div>
            </form>
          ) : selectedTicketId ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <button type="button" onClick={() => setSelectedTicketId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Voltar para conversas">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{activeTicket?.subject ?? "Conversa"}</p>
                  <p className="text-xs text-slate-500">Chat do curso</p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
                {activeTicketQuery.isLoading || messagesQuery.isLoading ? <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-sky-600" /> : null}
                {activeTicket && messages.length === 0 ? (
                  <div className="rounded-2xl rounded-tl-sm border border-sky-100 bg-white p-3 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeTicket.message}</p>
                    {activeTicket.attachment_path ? (
                      <button type="button" onClick={() => void openAttachment({ bucket: activeTicket.attachment_bucket, path: activeTicket.attachment_path })} className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white">
                        <Download className="mr-2 h-3.5 w-3.5" />
                        {activeTicket.attachment_name ?? "Abrir anexo"}
                      </button>
                    ) : null}
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">{formatDateTime(activeTicket.created_at)}</p>
                  </div>
                ) : null}
                {messages.map((item) => {
                  const isMine = item.sender_user_id === user?.id
                  const isInitialMessage = item.message === activeTicket?.message && item.created_at === activeTicket.created_at
                  const attachmentData = isInitialMessage && activeTicket?.attachment_path
                    ? { bucket: activeTicket.attachment_bucket, path: activeTicket.attachment_path, name: activeTicket.attachment_name }
                    : { bucket: item.attachment_bucket, path: item.attachment_path, name: item.attachment_name }
                  return (
                    <div key={item.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl p-3 shadow-sm ${isMine ? "rounded-tr-sm bg-slate-950 text-white" : "rounded-tl-sm border bg-white text-slate-800"}`}>
                        {!isMine ? <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Equipe de suporte</p> : null}
                        <p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                        {attachmentData.path ? (
                          <button type="button" onClick={() => void openAttachment({ bucket: attachmentData.bucket, path: attachmentData.path })} className={`mt-3 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${isMine ? "bg-white/10 text-white hover:bg-white/20" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"}`}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            {attachmentData.name ?? "Abrir anexo"}
                          </button>
                        ) : null}
                        <p className={`mt-2 text-[11px] font-semibold ${isMine ? "text-white/60" : "text-slate-400"}`}>{formatDateTime(item.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {activeTicket?.status === "closed" ? (
                <p className="border-t border-slate-100 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">Esta conversa foi encerrada.</p>
              ) : (
                <form onSubmit={handleReply} className="border-t border-slate-100 bg-white p-3">
                  {replyAttachment ? (
                    <div className="mb-2 flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-slate-700">
                      <span className="flex min-w-0 items-center gap-2 truncate"><Paperclip className="h-4 w-4 shrink-0 text-sky-700" />{replyAttachment.name}</span>
                      <button type="button" onClick={() => { setReplyAttachment(null); if (replyFileInputRef.current) replyFileInputRef.current.value = "" }} className="rounded-full p-1 text-slate-500 hover:bg-white" aria-label="Remover anexo">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <input ref={replyFileInputRef} type="file" className="hidden" onChange={(event) => setReplyAttachment(event.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => replyFileInputRef.current?.click()} className="self-end rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50" aria-label="Anexar arquivo">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Escreve uma resposta..." className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:bg-white" />
                    <button type="submit" disabled={isSending || (!reply.trim() && !replyAttachment)} className="self-end rounded-xl bg-sky-600 p-3 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Enviar resposta">
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {tickets.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-5 py-10 text-center">
                    <BookOpen className="h-8 w-8 text-sky-600" />
                    <h2 className="mt-4 font-black text-slate-950">Ainda não há conversas</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Fala com a equipa sobre um curso ou material liberado.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <button key={ticket.id} type="button" onClick={() => selectTicket(ticket.id)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50">
                        <p className="truncate font-black text-slate-950">{ticket.subject}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{ticket.message.replace(/^\[Contexto do curso\/material\][\s\S]*?Mensagem do aluno:\n/, "")}</p>
                        <p className="mt-2 text-[11px] font-semibold text-slate-400">{formatDateTime(ticket.updated_at)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 p-4">
                <button type="button" onClick={openComposer} className="flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-700">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Nova conversa
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <button type="button" onClick={() => setIsOpen((value) => !value)} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-[0_16px_35px_rgba(2,132,199,0.35)] transition hover:-translate-y-0.5 hover:bg-sky-700" aria-label={isOpen ? "Fechar chat de suporte" : "Abrir chat de suporte"}>
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && tickets.length > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] font-black text-white">{tickets.length}</span> : null}
      </button>
    </div>
  )
}
