import { useMemo, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { HelpCircle, MessageSquare, Paperclip, Plus, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useCreateSupportTicket,
  useMyProducts,
  useSupportTickets,
  useUploadSupportAttachment,
} from "@/hooks/useDashboard"
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<"choice" | "form">("choice")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [productId, setProductId] = useState("")
  const [category, setCategory] = useState<SupportTicketSummary["category"]>("general")
  const [priority, setPriority] = useState<SupportTicketSummary["priority"]>("normal")
  const [attachment, setAttachment] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ticketsQuery = useSupportTickets()
  const productsQuery = useMyProducts()
  const createTicket = useCreateSupportTicket()
  const uploadAttachment = useUploadSupportAttachment()
  const tickets = ticketsQuery.data ?? []
  const products = productsQuery.data ?? []
  const selectedCategory = useMemo(() => getSupportCategoryMeta(category), [category])
  const isSubmitting = createTicket.isPending || uploadAttachment.isPending
  const modalFromQuery = searchParams.get("openTicketModal") === "1"
  const isTicketModalOpen = isModalOpen || modalFromQuery
  const activeModalStep = modalFromQuery
    ? searchParams.get("ticketStep") === "form" ? "form" : "choice"
    : modalStep

  const resetForm = () => {
    setSubject("")
    setMessage("")
    setProductId("")
    setCategory("general")
    setPriority("normal")
    setAttachment(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalStep("choice")
    setSearchParams({})
  }

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim()) return
    const uploadedAttachment = attachment ? await uploadAttachment.mutateAsync({ file: attachment }) : null
    const created = await createTicket.mutateAsync({
      subject,
      message,
      productId: productId || null,
      category,
      priority,
      attachment: uploadedAttachment,
    })
    resetForm()
    closeModal()
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
          <Button type="button" className="rounded-full" onClick={() => {
            setIsModalOpen(true)
            setModalStep("choice")
          }}>
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

      {isTicketModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[1.75rem] bg-white shadow-[0_24px_90px_rgba(15,23,42,0.28)]">
            {activeModalStep === "choice" ? (
              <div className="p-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                  <HelpCircle className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-center font-display text-2xl font-black text-slate-950">Como podemos ajudar?</h2>
                <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-7 text-slate-600">
                  As perguntas frequentes resolvem boa parte dos casos. Se precisares de acompanhamento, abre um chamado.
                </p>
                <div className="mt-6 grid gap-3">
                  <Link
                    to="/suporte"
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-200 hover:bg-sky-50"
                    onClick={closeModal}
                  >
                    <p className="font-black text-slate-950">Ver perguntas frequentes</p>
                    <p className="mt-1 text-sm text-slate-600">Consultar respostas antes de acionar o suporte.</p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setModalStep("form")
                      if (modalFromQuery) setSearchParams({ openTicketModal: "1", ticketStep: "form" })
                    }}
                    className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left transition hover:bg-sky-100"
                  >
                    <p className="font-black text-slate-950">Abrir um chamado</p>
                    <p className="mt-1 text-sm text-slate-600">Enviar o caso para acompanhamento da equipe.</p>
                  </button>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button type="button" variant="outline" className="rounded-full" onClick={closeModal}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateTicket}>
                <div className="bg-sky-50 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Novo chamado</p>
                      <h2 className="mt-1 font-display text-2xl font-black text-slate-950">Novo chamado</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {selectedCategory.label}: primeira resposta em ate {selectedCategory.firstResponseHours} horas uteis.
                      </p>
                    </div>
                    <button type="button" onClick={closeModal} className="rounded-full p-2 text-slate-500 hover:bg-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-slate-700">
                    {supportBusinessHours} {supportPublicNote} A prioridade ajuda apenas na triagem interna.
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-black text-slate-700 md:col-span-2">
                      Curso relacionado
                      <select
                        value={productId}
                        onChange={(event) => setProductId(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white"
                      >
                        <option value="">Nenhum curso especifico</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.title}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-black text-slate-700">
                      Categoria
                      <select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketSummary["category"])} className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white">
                        {supportCategories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-black text-slate-700">
                      Prioridade interna
                      <select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketSummary["priority"])} className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white">
                        <option value="low">Baixa</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-black text-slate-700">
                    Assunto
                    <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex: problema com pagamento ou acesso" className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white" required />
                  </label>
                  <label className="mt-4 block text-sm font-black text-slate-700">
                    Descricao
                    <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Inclui contexto, passos ja tentados e o que precisas resolver." rows={5} className="mt-2 w-full resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-slate-400 focus:bg-white" required />
                  </label>
                  <div className="mt-4">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 hover:bg-slate-100">
                      <Paperclip className="mr-2 h-4 w-4" />
                      {attachment ? attachment.name : "Anexo (opcional)"}
                    </button>
                    {attachment ? (
                      <button type="button" onClick={() => setAttachment(null)} className="mt-2 inline-flex items-center text-xs font-bold text-red-700">
                        <X className="mr-1 h-3 w-3" />
                        Remover anexo
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setModalStep("choice")
                        if (modalFromQuery) setSearchParams({ openTicketModal: "1", ticketStep: "choice" })
                      }}
                    >
                      Voltar
                    </Button>
                    <Button type="submit" className="rounded-full" disabled={isSubmitting}>
                      {isSubmitting ? "A enviar..." : "Enviar chamado"}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
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
