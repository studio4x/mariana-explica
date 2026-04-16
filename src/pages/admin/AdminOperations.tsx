import { useState } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAdminOperations, useRetryAdminEmailDelivery } from "@/hooks/useAdmin"
import { formatDateTime } from "@/utils/date"

function AdminOperationsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operacoes"
        description="Fila de emails, historico de jobs e reprocessamento seguro da camada operacional."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-16 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-4 w-32 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-7 w-56 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={row} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ))}
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

export function AdminOperations() {
  const operationsQuery = useAdminOperations()
  const retryEmail = useRetryAdminEmailDelivery()
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  if (operationsQuery.isLoading) {
    return <AdminOperationsSkeleton />
  }

  if (operationsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar a operacao"
        message={
          operationsQuery.error instanceof Error ? operationsQuery.error.message : "Tenta novamente dentro de instantes."
        }
        onRetry={() => void operationsQuery.refetch()}
      />
    )
  }

  const data = operationsQuery.data
  if (!data) {
    return (
      <EmptyState
        title="Sem dados operacionais"
        message="A fila de emails e o historico de jobs vao aparecer aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operacoes"
        description="Fila de emails, historico de jobs e reprocessamento seguro da camada operacional."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Emails em fila</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{data.queuedEmails}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Registos que ainda aguardam processamento.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Emails com falha</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{data.failedEmails}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Itens com erro prontos para reprocessamento manual.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Jobs com falha</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{data.failedJobs}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Execucoes que pedem leitura antes de seguir.</p>
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Fila de emails</h2>
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
            <div className="mt-5 space-y-3">
              {data.emailDeliveries.map((delivery) => (
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
                      disabled={
                        retryEmail.isPending || delivery.status === "sent" || delivery.status === "delivered"
                      }
                      onClick={async () => {
                        try {
                          await retryEmail.mutateAsync(delivery.id)
                          setFeedback({
                            tone: "success",
                            message: `O email para ${delivery.email_to} voltou para a fila com sucesso.`,
                          })
                        } catch (error) {
                          setFeedback({
                            tone: "error",
                            message:
                              error instanceof Error ? error.message : "Nao foi possivel reenfileirar o email.",
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
          )}
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Historico de jobs</h2>
              <p className="mt-1 text-sm text-slate-600">
                Registo das automacoes mais recentes para leitura e troubleshooting.
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
            <div className="mt-5 space-y-3">
              {data.jobRuns.map((job) => (
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
          )}
        </section>
      </div>
    </div>
  )
}
