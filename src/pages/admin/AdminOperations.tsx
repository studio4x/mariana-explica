import { useEffect, useMemo, useState } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminCronStatus,
  useAdminOperations,
  useQueueAdminCronTestEmail,
  useRetryAdminEmailDelivery,
  useRunAllAdminCrons,
  useRunOneAdminCron,
  useScheduleAdminCronJobs,
} from "@/hooks/useAdmin"
import type { AdminCronKey, AdminCronScheduleSummary, AdminJobRunSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

type OperationsListTab = "emails" | "jobs"

const OPERATIONS_PAGE_SIZE = 6

function AdminOperationsSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className="space-y-6">
      {!embedded ? (
        <PageHeader
          title="Operacoes"
          description="Fila de emails, scheduler dos crons, historico de jobs e reprocessamento seguro da camada operacional."
        />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-16 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-4 w-32 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-7 w-56 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  )
}

function emailTone(status: "queued" | "sent" | "failed" | "delivered" | "bounced") {
  if (status === "sent" || status === "delivered") return "success"
  if (status === "failed" || status === "bounced") return "danger"
  return "warning"
}

function jobTone(status: "running" | "success" | "failed") {
  if (status === "success") return "success"
  if (status === "failed") return "danger"
  return "warning"
}

function cronTone(active: boolean) {
  return active ? "success" : "warning"
}

const CRON_CATALOG: Array<{
  cron: AdminCronKey
  jobname: string
  title: string
  description: string
}> = [
  {
    cron: "process_email_deliveries",
    jobname: "mariana-cron-process-email-deliveries",
    title: "Processar fila de emails",
    description: "Consome a fila e envia emails transacionais pendentes.",
  },
  {
    cron: "retry_email_deliveries",
    jobname: "mariana-cron-retry-email-deliveries",
    title: "Retry de emails falhados",
    description: "Reenfileira emails com falha para nova tentativa segura.",
  },
  {
    cron: "reconcile_orders",
    jobname: "mariana-cron-reconcile-orders",
    title: "Reconciliar pedidos",
    description: "Confere estado comercial, Stripe e grants de acesso.",
  },
  {
    cron: "audit_access_consistency",
    jobname: "mariana-cron-audit-access-consistency",
    title: "Auditar acessos",
    description: "Varre inconsistencias entre pedidos, grants e conteudo.",
  },
  {
    cron: "clean_expired_links",
    jobname: "mariana-cron-clean-expired-links",
    title: "Limpar links expirados",
    description: "Remove links temporarios expirados e faz manutencao tecnica.",
  },
]

function findLastRun(jobRuns: AdminJobRunSummary[], cron: AdminCronKey) {
  const prefixes: Record<AdminCronKey, string> = {
    process_email_deliveries: "cron_process_email_deliveries",
    retry_email_deliveries: "cron_retry_email_deliveries",
    reconcile_orders: "cron_reconcile_orders",
    audit_access_consistency: "cron_audit_access_consistency",
    clean_expired_links: "cron_clean_expired_links",
  }

  return jobRuns.find((job) => job.job_name === prefixes[cron]) ?? null
}

function getScheduleMap(items: AdminCronScheduleSummary[]) {
  return new Map(items.map((item) => [item.jobname, item]))
}

function paginateItems<TItem>(items: TItem[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    currentPage,
    totalPages,
    items: items.slice(start, start + pageSize),
  }
}

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  itemLabel,
  onPrevious,
  onNext,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemLabel: string
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        {totalItems} {itemLabel}
        {totalItems === 1 ? "" : "s"} · pagina {currentPage} de {totalPages}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={currentPage <= 1}
          onClick={onPrevious}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={currentPage >= totalPages}
          onClick={onNext}
        >
          Proxima
        </Button>
      </div>
    </div>
  )
}

export function AdminOperations({ embedded = false }: { embedded?: boolean }) {
  const operationsQuery = useAdminOperations()
  const cronStatusQuery = useAdminCronStatus()
  const retryEmail = useRetryAdminEmailDelivery()
  const scheduleCrons = useScheduleAdminCronJobs()
  const runOneCron = useRunOneAdminCron()
  const runAllCrons = useRunAllAdminCrons()
  const queueTestEmail = useQueueAdminCronTestEmail()
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [activeListTab, setActiveListTab] = useState<OperationsListTab>("emails")
  const [emailPage, setEmailPage] = useState(1)
  const [jobPage, setJobPage] = useState(1)

  const isLoading = operationsQuery.isLoading || cronStatusQuery.isLoading
  const hasError = operationsQuery.isError || cronStatusQuery.isError
  const error = operationsQuery.error ?? cronStatusQuery.error

  const cronScheduleMap = useMemo(
    () => getScheduleMap(cronStatusQuery.data?.scheduledJobs ?? []),
    [cronStatusQuery.data?.scheduledJobs],
  )

  const emailDeliveries = operationsQuery.data?.emailDeliveries ?? []
  const jobRuns = operationsQuery.data?.jobRuns ?? []
  const emailPagination = paginateItems(emailDeliveries, emailPage, OPERATIONS_PAGE_SIZE)
  const jobPagination = paginateItems(jobRuns, jobPage, OPERATIONS_PAGE_SIZE)

  useEffect(() => {
    if (emailPage !== emailPagination.currentPage) {
      setEmailPage(emailPagination.currentPage)
    }
  }, [emailPage, emailPagination.currentPage])

  useEffect(() => {
    if (jobPage !== jobPagination.currentPage) {
      setJobPage(jobPagination.currentPage)
    }
  }, [jobPage, jobPagination.currentPage])

  if (isLoading) {
    return <AdminOperationsSkeleton embedded={embedded} />
  }

  if (hasError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar a operacao"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void operationsQuery.refetch()
          void cronStatusQuery.refetch()
        }}
      />
    )
  }

  const data = operationsQuery.data
  const cronStatus = cronStatusQuery.data

  if (!data || !cronStatus) {
    return (
      <EmptyState
        title="Sem dados operacionais"
        message="A fila de emails, o scheduler e o historico de jobs vao aparecer aqui."
      />
    )
  }

  const scheduledCount = cronStatus.scheduledJobs.length
  const activeScheduledCount = cronStatus.scheduledJobs.filter((job) => job.active).length
  const failedCronRuns = cronStatus.jobRuns.filter((job) => job.status === "failed").length

  return (
    <div className="space-y-6">
      {!embedded ? (
        <PageHeader
          title="Operacoes"
          description="Fila de emails, scheduler dos crons, historico de jobs e reprocessamento seguro da camada operacional."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Emails em fila</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{data.queuedEmails}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Registos que ainda aguardam processamento.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Crons agendados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{scheduledCount}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{activeScheduledCount} ativos na agenda do ambiente.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Falhas operacionais</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{data.failedEmails + failedCronRuns}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Soma de emails falhados e execucoes cron com erro.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-primary p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Emails entregues</p>
          <p className="mt-3 text-3xl font-bold">{data.deliveredEmails}</p>
          <p className="mt-2 text-sm leading-6 text-white/80">Historico recente de entregas concluido com sucesso.</p>
        </div>
      </div>

      {feedback ? (
        <div
          className={`rounded-[1.4rem] border px-5 py-4 text-sm shadow-sm ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Scheduler dos crons</h2>
            <p className="mt-1 text-sm text-slate-600">
              Aqui ficam os crons reais do ambiente. A ideia e complementar a operacao que ja existia, sem duplicar a
              leitura de historico.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={scheduleCrons.isPending}
              onClick={async () => {
                try {
                  const result = await scheduleCrons.mutateAsync()
                  setFeedback({
                    tone: "success",
                    message: `Crons reagendados com sucesso. ${result.scheduled_count} processos ficaram configurados.`,
                  })
                } catch (nextError) {
                  setFeedback({
                    tone: "error",
                    message: nextError instanceof Error ? nextError.message : "Nao foi possivel reagendar os crons.",
                  })
                }
              }}
            >
              {scheduleCrons.isPending ? "A reagendar..." : "Reagendar crons"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={queueTestEmail.isPending}
              onClick={async () => {
                try {
                  const result = await queueTestEmail.mutateAsync({
                    emailTo: "agenciastudio4x@gmail.com",
                    processImmediately: true,
                  })
                  setFeedback({
                    tone: result.success ? "success" : "error",
                    message: result.success
                      ? "Email de teste enviado para a fila e processamento acionado."
                      : "O email de teste foi criado, mas o processamento imediato devolveu falha.",
                  })
                } catch (nextError) {
                  setFeedback({
                    tone: "error",
                    message:
                      nextError instanceof Error ? nextError.message : "Nao foi possivel enfileirar o email de teste.",
                  })
                }
              }}
            >
              {queueTestEmail.isPending ? "A testar..." : "Testar fila de email"}
            </Button>

            <Button
              type="button"
              className="rounded-full"
              disabled={runAllCrons.isPending}
              onClick={async () => {
                try {
                  const runs = await runAllCrons.mutateAsync()
                  const successCount = runs.filter((run) => run.ok).length
                  setFeedback({
                    tone: successCount === runs.length ? "success" : "error",
                    message:
                      successCount === runs.length
                        ? "Todos os crons foram executados manualmente com sucesso."
                        : `${successCount}/${runs.length} crons executaram com sucesso.`,
                  })
                } catch (nextError) {
                  setFeedback({
                    tone: "error",
                    message: nextError instanceof Error ? nextError.message : "Nao foi possivel executar os crons.",
                  })
                }
              }}
            >
              {runAllCrons.isPending ? "A executar..." : "Executar todos agora"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {CRON_CATALOG.map((item) => {
            const schedule = cronScheduleMap.get(item.jobname) ?? null
            const lastRun = findLastRun(cronStatus.jobRuns, item.cron)

            return (
              <article key={item.cron} className="rounded-[1.5rem] border bg-slate-50/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{item.title}</p>
                      <StatusBadge
                        label={schedule ? (schedule.active ? "agendado" : "inativo") : "nao agendado"}
                        tone={schedule ? cronTone(schedule.active) : "warning"}
                      />
                      {lastRun ? <StatusBadge label={lastRun.status} tone={jobTone(lastRun.status)} /> : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>
                        <span className="font-semibold text-slate-700">Job:</span> {item.jobname}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Agenda:</span>{" "}
                        {schedule?.schedule ?? "Ainda nao configurada"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Ultima execucao:</span>{" "}
                        {lastRun ? formatDateTime(lastRun.started_at) : "Sem historico recente"}
                      </p>
                      {lastRun?.error_message ? (
                        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                          {lastRun.error_message}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={runOneCron.isPending}
                    onClick={async () => {
                      try {
                        const run = await runOneCron.mutateAsync({ cron: item.cron })
                        setFeedback({
                          tone: run.ok ? "success" : "error",
                          message: run.ok
                            ? `${item.title} executado com sucesso.`
                            : `${item.title} respondeu com status ${run.status}.`,
                        })
                      } catch (nextError) {
                        setFeedback({
                          tone: "error",
                          message: nextError instanceof Error ? nextError.message : "Nao foi possivel executar o cron.",
                        })
                      }
                    }}
                  >
                    {runOneCron.isPending ? "A executar..." : "Executar agora"}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Listagens operacionais</h2>
            <p className="mt-1 text-sm text-slate-600">
              A fila de emails e o historico de jobs ficam separados em abas para manter a leitura mais leve.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveListTab("emails")}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                activeListTab === "emails"
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
              ].join(" ")}
            >
              Fila de emails
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab("jobs")}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                activeListTab === "jobs"
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
              ].join(" ")}
            >
              Historico de jobs
            </button>
          </div>
        </div>

        {activeListTab === "emails" ? (
          <div className="mt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-slate-950">Fila de emails</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Entregas recentes com estado, erro e opcao de reenfileirar quando necessario.
                </p>
              </div>
              <StatusBadge label={`${data.emailDeliveries.length} registos`} tone="neutral" />
            </div>

            {data.emailDeliveries.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="Sem emails na fila"
                  message="Quando a plataforma gerar emails, a operacao vai aparecer aqui."
                />
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  {emailPagination.items.map((delivery) => (
                    <div key={delivery.id} className="rounded-[1.5rem] border bg-slate-50/70 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-950">{delivery.subject ?? delivery.template_key}</p>
                            <StatusBadge label={delivery.status} tone={emailTone(delivery.status)} />
                          </div>
                          <p className="mt-1 break-all text-sm text-slate-600">{delivery.email_to}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                            {delivery.template_key} · criado em {formatDateTime(delivery.created_at)}
                          </p>
                          {delivery.sent_at ? (
                            <p className="mt-2 text-xs text-slate-500">Enviado em {formatDateTime(delivery.sent_at)}</p>
                          ) : null}
                          {delivery.error_message ? (
                            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                              {delivery.error_message}
                            </p>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          disabled={retryEmail.isPending || delivery.status === "sent" || delivery.status === "delivered"}
                          onClick={async () => {
                            try {
                              await retryEmail.mutateAsync(delivery.id)
                              setFeedback({
                                tone: "success",
                                message: `O email para ${delivery.email_to} voltou para a fila com sucesso.`,
                              })
                            } catch (nextError) {
                              setFeedback({
                                tone: "error",
                                message:
                                  nextError instanceof Error ? nextError.message : "Nao foi possivel reenfileirar o email.",
                              })
                            }
                          }}
                        >
                          {retryEmail.isPending ? "A reenfileirar..." : "Reenfileirar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <PaginationBar
                  currentPage={emailPagination.currentPage}
                  totalPages={emailPagination.totalPages}
                  totalItems={data.emailDeliveries.length}
                  itemLabel="registo"
                  onPrevious={() => setEmailPage((current) => Math.max(1, current - 1))}
                  onNext={() => setEmailPage((current) => Math.min(emailPagination.totalPages, current + 1))}
                />
              </>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-slate-950">Historico de jobs</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Registo consolidado das automacoes mais recentes para leitura e troubleshooting.
                </p>
              </div>
              <StatusBadge label={`${data.jobRuns.length} execucoes`} tone="neutral" />
            </div>

            {data.jobRuns.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="Sem jobs registados"
                  message="As automacoes e reprocessamentos vao aparecer aqui."
                />
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  {jobPagination.items.map((job) => (
                    <div key={job.id} className="rounded-[1.5rem] border bg-slate-50/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-950">{job.job_name}</p>
                        <StatusBadge label={job.status} tone={jobTone(job.status)} />
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        Iniciado em {formatDateTime(job.started_at)}
                        {job.finished_at ? ` · concluido em ${formatDateTime(job.finished_at)}` : ""}
                      </p>
                      {job.idempotency_key ? (
                        <p className="mt-2 break-all text-xs text-slate-500">Chave: {job.idempotency_key}</p>
                      ) : null}
                      {job.error_message ? (
                        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                          {job.error_message}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <PaginationBar
                  currentPage={jobPagination.currentPage}
                  totalPages={jobPagination.totalPages}
                  totalItems={data.jobRuns.length}
                  itemLabel="execucao"
                  onPrevious={() => setJobPage((current) => Math.max(1, current - 1))}
                  onNext={() => setJobPage((current) => Math.min(jobPagination.totalPages, current + 1))}
                />
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
