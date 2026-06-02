import { useEffect, useMemo, useState } from "react"
import { Mail, RefreshCw, Search, Settings2, Table2, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminPublicFormNotificationsConfig,
  useAdminPublicFormSubmissions,
  useReplyAdminPublicFormSubmission,
  useUpdateAdminPublicFormNotificationsConfig,
} from "@/hooks/useAdmin"
import type { PublicFormSubmissionSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

type FormsTab = "submissions" | "settings"

function formatShortMessage(value: string, maxLength = 150) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
}

function getFormTypeLabel(formType: string) {
  if (formType === "explicacoes") return "Explicações"
  return formType
}

export function AdminPublicForms() {
  const submissionsQuery = useAdminPublicFormSubmissions()
  const configQuery = useAdminPublicFormNotificationsConfig()
  const updateConfig = useUpdateAdminPublicFormNotificationsConfig()
  const replySubmission = useReplyAdminPublicFormSubmission()

  const [tab, setTab] = useState<FormsTab>("submissions")
  const [query, setQuery] = useState("")
  const [formTypeFilter, setFormTypeFilter] = useState<"all" | string>("all")
  const [draftEmail, setDraftEmail] = useState("")
  const [submissionFeedback, setSubmissionFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [replyTarget, setReplyTarget] = useState<PublicFormSubmissionSummary | null>(null)
  const [replySubject, setReplySubject] = useState("")
  const [replyMessage, setReplyMessage] = useState("")
  const [replyError, setReplyError] = useState<string | null>(null)

  useEffect(() => {
    if (configQuery.data) {
      setDraftEmail(configQuery.data.config_value.notification_email)
    }
  }, [configQuery.data])

  const submissions = submissionsQuery.data ?? []

  const availableFormTypes = useMemo(() => {
    return Array.from(new Set(submissions.map((submission) => submission.form_type))).sort((left, right) =>
      left.localeCompare(right),
    )
  }, [submissions])

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return submissions.filter((submission) => {
      if (formTypeFilter !== "all" && submission.form_type !== formTypeFilter) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        submission.full_name,
        submission.email,
        submission.subject,
        submission.message,
        submission.source_page,
        submission.form_type,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [formTypeFilter, query, submissions])

  const validEmail = draftEmail.trim().length === 0 || EMAIL_PATTERN.test(draftEmail.trim())
  const validReplySubject = replySubject.trim().length === 0 || replySubject.trim().length >= 2
  const validReplyMessage = replyMessage.trim().length >= 2

  const handleRefresh = () => {
    void submissionsQuery.refetch()
    void configQuery.refetch()
  }

  const handleSaveConfig = async () => {
    const nextEmail = draftEmail.trim().toLowerCase()

    if (nextEmail.length > 0 && !EMAIL_PATTERN.test(nextEmail)) {
      setFeedback({ tone: "danger", message: "Informe um email válido para notificações." })
      return
    }

    setFeedback(null)

    try {
      await updateConfig.mutateAsync({ notification_email: nextEmail })
      setFeedback({
        tone: "success",
        message:
          nextEmail.length > 0
            ? "Email de notificação atualizado com sucesso."
            : "Notificações por email desativadas para formulários públicos.",
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      })
    }
  }

  const openReplyModal = (submission: PublicFormSubmissionSummary) => {
    setReplyTarget(submission)
    setReplySubject(`Re: ${submission.subject}`.slice(0, 180))
    setReplyMessage("")
    setReplyError(null)
  }

  const closeReplyModal = () => {
    setReplyTarget(null)
    setReplySubject("")
    setReplyMessage("")
    setReplyError(null)
  }

  const handleReplySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!replyTarget) return

    const message = replyMessage.trim()
    const subject = replySubject.trim()

    if (!message || message.length < 2) {
      setReplyError("A mensagem precisa ter pelo menos 2 caracteres.")
      return
    }

    if (subject && subject.length < 2) {
      setReplyError("Informe um assunto válido ou deixe em branco.")
      return
    }

    setReplyError(null)

    try {
      const response = await replySubmission.mutateAsync({
        submissionId: replyTarget.id,
        subject: subject || null,
        message,
      })

      closeReplyModal()
      setSubmissionFeedback({
        tone: "success",
        message: `Resposta enfileirada para ${response.email_to}.`,
      })
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Não foi possível enviar a resposta por email.")
    }
  }

  if (submissionsQuery.isLoading && configQuery.isLoading) {
    return <LoadingState message="A carregar formulários públicos..." />
  }

  if (submissionsQuery.isError || configQuery.isError) {
    const message =
      submissionsQuery.error instanceof Error
        ? submissionsQuery.error.message
        : configQuery.error instanceof Error
          ? configQuery.error.message
          : "Tenta novamente dentro de instantes."

    return (
      <ErrorState
        title="Não foi possível carregar os formulários"
        message={message}
        onRetry={handleRefresh}
      />
    )
  }

  const notifiedCount = submissions.filter((submission) => submission.notified_at).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Formulários Públicos"
          description="Acompanha todos os envios do site público e configura o email que recebe as notificações."
        />
        <Button type="button" variant="outline" className="rounded-full" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
            { key: "submissions" as const, label: "Envios", icon: Table2 },
            { key: "settings" as const, label: "Configurações", icon: Settings2 },
          ].map((item) => {
            const Icon = item.icon
            const active = tab === item.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        {tab === "submissions" ? (
          <div className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total de envios</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{submissions.length}</p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">No filtro atual</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{filteredSubmissions.length}</p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">JÁ notificados por email</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{notifiedCount}</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_260px]">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Buscar</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por nome, email, assunto ou mensagem..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Tipo de formulário</span>
                  <select
                    value={formTypeFilter}
                    onChange={(event) => setFormTypeFilter(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="all">Todos os tipos</option>
                    {availableFormTypes.map((formType) => (
                      <option key={formType} value={formType}>{getFormTypeLabel(formType)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {submissionFeedback ? (
              <div
                className={[
                  "rounded-2xl border px-4 py-3 text-sm font-medium",
                  submissionFeedback.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900",
                ].join(" ")}
              >
                {submissionFeedback.message}
              </div>
            ) : null}

            {filteredSubmissions.length === 0 ? (
              <EmptyState
                title="Sem envios para mostrar"
                message="Ajuste os filtros ou aguarde novos formulários enviados pelo site público."
              />
            ) : (
              <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-4">Recebido em</th>
                      <th className="px-4 py-4">Origem</th>
                      <th className="px-4 py-4">Contato</th>
                      <th className="px-4 py-4">Assunto</th>
                      <th className="px-4 py-4">Mensagem</th>
                      <th className="px-4 py-4">Notificação</th>
                      <th className="px-4 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubmissions.map((submission) => (
                      <tr key={submission.id}>
                        <td className="px-4 py-4 text-slate-600">{formatDateTime(submission.created_at)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{getFormTypeLabel(submission.form_type)}</p>
                          <p className="mt-1 text-xs text-slate-500">{submission.source_page}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{submission.full_name}</p>
                          <p className="mt-1 text-xs text-slate-500">{submission.email}</p>
                        </td>
                        <td className="px-4 py-4 text-slate-800">{submission.subject}</td>
                        <td className="px-4 py-4 text-slate-600">{formatShortMessage(submission.message)}</td>
                        <td className="px-4 py-4">
                          {submission.notified_at ? (
                            <div className="space-y-1">
                              <StatusBadge label="Enviado" tone="success" />
                              <p className="text-xs text-slate-500">{submission.notified_email_to}</p>
                            </div>
                          ) : (
                            <StatusBadge label="Sem envio" tone="warning" />
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => openReplyModal(submission)}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Responder
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 pt-6">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Destino das notificações</p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Define o email que recebe alertas quando um formulário público e enviado. Deixa em branco para
                desativar notificações por email.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Email de notificação</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={draftEmail}
                      onChange={(event) => setDraftEmail(event.target.value)}
                      placeholder="exemplo@dominio.com"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                </label>

                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => void handleSaveConfig()}
                  disabled={updateConfig.isPending || !validEmail}
                >
                  {updateConfig.isPending ? "A guardar..." : "Guardar configuração"}
                </Button>
              </div>

              {!validEmail ? (
                <p className="mt-3 text-sm text-rose-700">O email informado não e válido.</p>
              ) : null}

              {feedback ? (
                <div
                  className={[
                    "mt-4 rounded-2xl border px-4 py-3 text-sm font-medium",
                    feedback.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900",
                  ].join(" ")}
                >
                  {feedback.message}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Como funciona</p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                <p>1. O visitante envia o formulário na página pública.</p>
                <p>2. O envio fica registado nesta tela para acompanhamento.</p>
                <p>3. Se houver email configurado, o sistema enfileira a notificação automaticamente.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {replyTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Responder formulário</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Envia uma resposta para {replyTarget.full_name} ({replyTarget.email}).
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={closeReplyModal}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4 px-6 py-6" onSubmit={(event) => void handleReplySubmit(event)}>
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Assunto do email</span>
                <input
                  type="text"
                  value={replySubject}
                  onChange={(event) => setReplySubject(event.target.value)}
                  maxLength={180}
                  placeholder={`Re: ${replyTarget.subject}`}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Mensagem da resposta</span>
                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  rows={8}
                  maxLength={5000}
                  placeholder="Escreve aqui a resposta que será enviada por email."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                />
              </label>

              {!validReplySubject ? (
                <p className="text-sm text-rose-700">O assunto deve ter pelo menos 2 caracteres.</p>
              ) : null}

              {replyError ? (
                <p className="text-sm text-rose-700">{replyError}</p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={closeReplyModal}
                  disabled={replySubmission.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="rounded-full"
                  disabled={replySubmission.isPending || !validReplySubject || !validReplyMessage}
                >
                  {replySubmission.isPending ? "A enviar..." : "Enviar resposta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
