import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CodeXml,
  Eye,
  GitBranch,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import { ErrorState, LoadingState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import type { AdminAiCodeEditorTask } from "@/types/app.types"

export type TaskListFilter = "all" | "in_progress" | "ready" | "failed" | "rejected" | "rollback"

function formatDateTime(value: string | null) {
  if (!value) return "Sem registo"
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return "Sem registo"
  return new Date(parsed).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusTone(status: string) {
  if (status === "approved" || status === "published" || status === "ready" || status === "passed") return "success"
  if (status === "failed" || status === "rejected" || status === "rolled_back" || status === "blocked_provider_quota" || status === "ai_generation_unavailable") return "danger"
  if (status === "rollback_ready_for_review") return "warning"
  if (status === "needs_adjustment" || status === "pending") return "warning"
  return "neutral"
}

function riskTone(riskLevel: AdminAiCodeEditorTask["risk_level"]) {
  return riskLevel === "high" ? "danger" : riskLevel === "medium" ? "warning" : "success"
}

function humanizeLabel(value: string | null | undefined, fallback = "Sem registo") {
  if (!value) return fallback
  return value.replace(/_/g, " ")
}

function summarizeChecks(task: AdminAiCodeEditorTask) {
  if (task.test_status === "passed" && task.build_status === "passed") return "checks passed"
  if (task.test_status === "failed" || task.build_status === "failed") return "checks failed"
  if (task.test_status === "pending" || task.build_status === "pending") return "checks pending"
  return "checks not requested"
}

function resolveTaskMethodLabel(task: AdminAiCodeEditorTask) {
  const providerAttempts = Array.isArray(task.metadata.provider_attempts)
    ? task.metadata.provider_attempts
    : []
  const firstAttempt = providerAttempts[0] as { provider?: string; model?: string } | undefined

  if (firstAttempt?.provider && firstAttempt?.model) {
    return `${firstAttempt.provider} / ${firstAttempt.model}`
  }

  return task.worker_mode === "github_worker" ? "GitHub worker" : "Modo simulado"
}

function resolveTaskListMeta(task: AdminAiCodeEditorTask) {
  const parts = [
    task.pull_request_number ? `PR #${task.pull_request_number}` : "Sem PR",
    `preview ${humanizeLabel(task.preview_status, "not requested")}`,
    summarizeChecks(task),
  ]

  return parts.join(" · ")
}

function SummaryMetricCard(props: { label: string; value: number; description: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{props.label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-bold text-slate-950">{props.value}</p>
        <p className="max-w-[11rem] text-right text-xs leading-5 text-slate-500">{props.description}</p>
      </div>
    </div>
  )
}

function TaskFilterButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-full border px-3 py-2 text-xs font-semibold transition",
        props.active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
      ].join(" ")}
    >
      {props.label}
    </button>
  )
}

function DetailSection(props: {
  title: string
  description: string
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(Boolean(props.defaultOpen))

  return (
    <section className="rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{props.title}</h3>
            {props.badge ? <StatusBadge label={props.badge} tone="neutral" /> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{props.description}</p>
        </div>
        <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open ? <div className="border-t border-slate-100 px-4 py-4">{props.children}</div> : null}
    </section>
  )
}

function TaskFileChangeItem(props: { change: NonNullable<AdminAiCodeEditorTask["file_changes"]>[number] }) {
  const [showDiff, setShowDiff] = useState(false)

  return (
    <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">{props.change.file_path}</p>
            <StatusBadge label={props.change.change_type} tone="info" />
            <StatusBadge label={props.change.status} tone={statusTone(props.change.status)} />
            {props.change.language ? <StatusBadge label={props.change.language} tone="neutral" /> : null}
          </div>
          {props.change.summary ? (
            <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{props.change.summary}</p>
          ) : null}
          {props.change.rationale ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">{props.change.rationale}</p>
          ) : null}
          {props.change.before_sha || props.change.after_sha ? (
            <p className="mt-2 break-all text-xs text-slate-500">
              before: {props.change.before_sha ?? "n/a"} | after: {props.change.after_sha ?? "n/a"}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setShowDiff((current) => !current)}
        >
          {showDiff ? "Ocultar diff" : "Ver diff"}
        </Button>
      </div>
      {showDiff ? (
        <pre className="mt-3 max-h-72 overflow-auto rounded-[1rem] bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {props.change.diff_patch ?? props.change.diff_preview ?? "Sem diff persistido."}
        </pre>
      ) : null}
    </div>
  )
}

function TaskAuditEvents(props: { events: NonNullable<AdminAiCodeEditorTask["events"]> }) {
  const [showAll, setShowAll] = useState(false)
  const visibleEvents = showAll ? props.events : props.events.slice(0, 3)

  return (
    <div className="space-y-3">
      {visibleEvents.map((event) => (
        <div key={event.id} className="rounded-[1.1rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">{event.event_type}</p>
            <p className="text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{event.message}</p>
        </div>
      ))}
      {props.events.length > 3 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Mostrar menos eventos" : "Ver auditoria completa"}
        </Button>
      ) : null}
    </div>
  )
}

export function AdminAiCodeEditorTasksPanel(props: {
  taskMetrics: {
    total: number
    readyForReview: number
    blocked: number
    rollbackReady: number
    failed: number
  }
  taskList: AdminAiCodeEditorTask[]
  filteredTaskList: AdminAiCodeEditorTask[]
  taskFilter: TaskListFilter
  taskSearch: string
  onTaskFilterChange: (filter: TaskListFilter) => void
  onTaskSearchChange: (value: string) => void
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
  selectedTask: AdminAiCodeEditorTask | null
  tasksQuery: {
    isLoading: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }
  selectedTaskQuery: {
    isLoading: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }
  actionNotes: string
  onActionNotesChange: (value: string) => void
  onRefreshTask: (action: "status" | "preview", taskId: string) => Promise<void>
  onRestartExecution: (taskId: string) => Promise<void>
  onTaskAction: (action: "approve" | "reject" | "adjust" | "rollback", taskId: string) => Promise<void>
  pending: {
    refreshStatus: boolean
    refreshPreview: boolean
    restartExecution: boolean
    approve: boolean
    reject: boolean
    adjust: boolean
    rollback: boolean
  }
}) {
  const task = props.selectedTask

  return (
    <section className="space-y-5" data-testid="ai-editor-tasks-panel">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Tasks</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">Tarefas do Editor IA</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Painel operacional com lista compacta, selecao clara e detalhe organizado sem abrir tudo ao mesmo tempo.
            </p>
          </div>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void props.tasksQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar tasks
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryMetricCard label="Total" value={props.taskMetrics.total} description="Historico rastreavel de tasks." />
        <SummaryMetricCard label="Prontas p/ revisao" value={props.taskMetrics.readyForReview} description="Aguardam aprovacao manual." />
        <SummaryMetricCard label="Bloqueadas" value={props.taskMetrics.blocked} description="Quota ou geracao indisponivel." />
        <SummaryMetricCard label="Com rollback" value={props.taskMetrics.rollbackReady} description="Revert pronto ou ja registado." />
        <SummaryMetricCard label="Falhas" value={props.taskMetrics.failed} description="Execucoes interrompidas ou invalidas." />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Lista</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">Inbox de tasks</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Selecione uma task para abrir o detalhe completo sem poluir a tela.
                </p>
              </div>
              <StatusBadge label={`${props.filteredTaskList.length}`} tone={props.filteredTaskList.length > 0 ? "success" : "neutral"} />
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={props.taskSearch}
                onChange={(event) => props.onTaskSearchChange(event.target.value)}
                placeholder="Buscar por titulo, branch, prompt ou PR"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <TaskFilterButton active={props.taskFilter === "all"} label="Todas" onClick={() => props.onTaskFilterChange("all")} />
              <TaskFilterButton active={props.taskFilter === "in_progress"} label="Em andamento" onClick={() => props.onTaskFilterChange("in_progress")} />
              <TaskFilterButton active={props.taskFilter === "ready"} label="Prontas" onClick={() => props.onTaskFilterChange("ready")} />
              <TaskFilterButton active={props.taskFilter === "failed"} label="Falhas" onClick={() => props.onTaskFilterChange("failed")} />
              <TaskFilterButton active={props.taskFilter === "rejected"} label="Rejeitadas" onClick={() => props.onTaskFilterChange("rejected")} />
              <TaskFilterButton active={props.taskFilter === "rollback"} label="Rollback" onClick={() => props.onTaskFilterChange("rollback")} />
            </div>
          </div>

          {props.tasksQuery.isLoading ? (
            <div className="px-5 py-6">
              <LoadingState message="A carregar tasks..." />
            </div>
          ) : props.tasksQuery.isError ? (
            <div className="px-5 py-6">
              <ErrorState
                title="Nao foi possivel carregar as tasks"
                message={props.tasksQuery.error instanceof Error ? props.tasksQuery.error.message : "Tenta novamente dentro de instantes."}
                onRetry={() => void props.tasksQuery.refetch()}
              />
            </div>
          ) : props.taskList.length === 0 ? (
            <div className="px-5 py-6">
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Ainda nao existem tasks do novo editor.
              </p>
            </div>
          ) : props.filteredTaskList.length === 0 ? (
            <div className="px-5 py-6">
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Nenhuma task encontrada com os filtros atuais.
              </p>
            </div>
          ) : (
            <div data-testid="ai-editor-task-list" className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto px-3 py-3">
              {props.filteredTaskList.map((listTask) => {
                const active = listTask.id === props.selectedTaskId

                return (
                  <button
                    key={listTask.id}
                    type="button"
                    onClick={() => props.onSelectTask(listTask.id)}
                    className={[
                      "w-full rounded-[1.2rem] border px-4 py-3 text-left transition",
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge label={humanizeLabel(listTask.status)} tone={statusTone(listTask.status)} />
                          <StatusBadge label={listTask.risk_level} tone={riskTone(listTask.risk_level)} />
                        </div>
                        <p className={`mt-2 truncate text-sm font-semibold ${active ? "text-white" : "text-slate-950"}`}>{listTask.title}</p>
                      </div>
                      {active ? <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" /> : null}
                    </div>
                    <p className={`mt-1 truncate text-xs leading-5 ${active ? "text-slate-200" : "text-slate-600"}`}>{listTask.summary}</p>
                    <p className={`mt-2 truncate text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>{resolveTaskListMeta(listTask)}</p>
                    <p className={`mt-2 text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>
                      Atualizada em {formatDateTime(listTask.updated_at)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-slate-50/60 p-4 shadow-sm xl:p-5">
          {props.selectedTaskId && props.selectedTaskQuery.isLoading ? (
            <LoadingState message="A carregar detalhes da task..." />
          ) : props.selectedTaskId && props.selectedTaskQuery.isError ? (
            <ErrorState
              title="Nao foi possivel carregar a task"
              message={
                props.selectedTaskQuery.error instanceof Error
                  ? props.selectedTaskQuery.error.message
                  : "Tenta novamente dentro de instantes."
              }
              onRetry={() => void props.selectedTaskQuery.refetch()}
            />
          ) : task ? (
            <div key={task.id} className="space-y-4">
              <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-950">{task.title}</h2>
                      <StatusBadge label={humanizeLabel(task.status)} tone={statusTone(task.status)} />
                      <StatusBadge label={task.risk_level} tone={riskTone(task.risk_level)} />
                      {task.sensitive_change ? <StatusBadge label="Area sensivel" tone="danger" /> : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{task.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Provider/metodo: {resolveTaskMethodLabel(task)}</span>
                      <span>Criada em {formatDateTime(task.created_at)}</span>
                      <span>Ultima execucao em {formatDateTime(task.last_execution_at ?? task.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={`Preview ${humanizeLabel(task.preview_status)}`} tone={statusTone(task.preview_status)} />
                    <StatusBadge label={`Testes ${humanizeLabel(task.test_status)}`} tone={statusTone(task.test_status)} />
                    <StatusBadge label={`Build ${humanizeLabel(task.build_status)}`} tone={statusTone(task.build_status)} />
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Acoes principais</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Aprovacao, ajuste, rejeicao, rollback e atualizacoes do admin ficam agrupados no topo do detalhe.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" className="rounded-full" onClick={() => void props.onTaskAction("approve", task.id)} disabled={props.pending.approve}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar e publicar
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void props.onTaskAction("adjust", task.id)} disabled={props.pending.adjust}>
                      <Loader2 className="mr-2 h-4 w-4" />
                      Pedir ajuste
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => void props.onTaskAction("reject", task.id)} disabled={props.pending.reject}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Rejeitar
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void props.onTaskAction("rollback", task.id)} disabled={props.pending.rollback}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Criar rollback
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void props.onRefreshTask("status", task.id)} disabled={props.pending.refreshStatus}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Atualizar checks
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void props.onRefreshTask("preview", task.id)} disabled={props.pending.refreshPreview}>
                      <Eye className="mr-2 h-4 w-4" />
                      Atualizar preview
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void props.onRestartExecution(task.id)} disabled={props.pending.restartExecution}>
                      <Loader2 className="mr-2 h-4 w-4" />
                      Reexecutar worker
                    </Button>
                  </div>
                  <textarea
                    value={props.actionNotes}
                    onChange={(event) => props.onActionNotesChange(event.target.value)}
                    className="min-h-[96px] w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                    placeholder="Notas opcionais para aprovacao, rejeicao, ajuste ou rollback"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Branch</p>
                  </div>
                  <p className="mt-3 break-all text-sm text-slate-700">{task.branch_name}</p>
                  <p className="mt-2 text-xs text-slate-500">Base: {task.default_branch ?? "por resolver"}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Commit</p>
                  </div>
                  <p className="mt-3 break-all text-sm text-slate-700">{task.commit_sha ?? "Ainda sem commit real"}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{task.commit_message}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <CodeXml className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Pull Request</p>
                  </div>
                  {task.pull_request_url ? (
                    <a href={task.pull_request_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900">
                      #{task.pull_request_number ?? "?"} abrir PR
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700">Ainda sem PR real</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">Estado: {humanizeLabel(task.pull_request_status, "nao aberto")}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Preview</p>
                  </div>
                  {task.preview_url ? (
                    <a href={task.preview_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900">
                      Abrir preview
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700">Ainda sem URL de preview</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">Estado: {humanizeLabel(task.preview_status)}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Rollback</p>
                  </div>
                  {task.metadata.rollback_pull_request_url ? (
                    <a href={String(task.metadata.rollback_pull_request_url)} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900">
                      PR #{String(task.metadata.rollback_pull_request_number ?? "?")}
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700">Ainda sem rollback preparado</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Estado: {humanizeLabel(String(task.metadata.rollback_pull_request_status ?? "nao aberto"))}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      {task.sensitive_change ? (
                        <ShieldAlert className="h-4 w-4 text-rose-700" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                      )}
                      <h3 className="text-base font-semibold text-slate-950">Resumo operacional</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{task.result_summary ?? "Sem resumo operacional."}</p>
                    {task.execution_error ? (
                      <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-6 text-rose-900">
                        {task.execution_error}
                      </p>
                    ) : null}
                    {task.status === "blocked_provider_quota" ? (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
                        A geracao livre por IA ficou bloqueada por quota. O admin pode restaurar creditos dos providers ou reenquadrar o pedido para um fallback deterministico suportado.
                      </p>
                    ) : null}
                  </div>

                  <DetailSection title="Execucao" description="Contexto tecnico, arquivos analisados e tentativas do worker." defaultOpen>
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Worker</p>
                          <p className="mt-2 text-sm text-slate-800">{humanizeLabel(task.worker_mode)}</p>
                        </div>
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ultima execucao</p>
                          <p className="mt-2 text-sm text-slate-800">{formatDateTime(task.last_execution_at ?? task.updated_at)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-950">Arquivos analisados</p>
                        {task.files_analyzed.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {task.files_analyzed.map((filePath) => (
                              <span key={filePath} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                                {filePath}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-600">Nenhum arquivo analisado registado.</p>
                        )}
                      </div>

                      {task.sensitive_reasons.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Alertas sensiveis</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {task.sensitive_reasons.map((reason) => (
                              <StatusBadge key={reason} label={reason} tone="danger" />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {Array.isArray(task.metadata.provider_attempts) && task.metadata.provider_attempts.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-950">Tentativas do provider</p>
                          {task.metadata.provider_attempts.map((attempt, index) => (
                            <div key={`${String((attempt as { provider?: string }).provider ?? "provider")}-${index}`} className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                              <span className="font-semibold text-slate-900">
                                {String((attempt as { provider?: string }).provider ?? "provider")} /{" "}
                                {String((attempt as { model?: string }).model ?? "model")}
                              </span>
                              {" - "}
                              {String((attempt as { failureType?: string }).failureType ?? "error")}
                              {" - "}
                              {String((attempt as { message?: string }).message ?? "")}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </DetailSection>

                  <DetailSection title="Plano do worker" description="Checklist compacto da execucao proposta." badge={Array.isArray(task.plan_json.steps) ? `${task.plan_json.steps.length} passos` : undefined}>
                    {Array.isArray(task.plan_json.steps) && task.plan_json.steps.length > 0 ? (
                      <div className="space-y-2">
                        {task.plan_json.steps.map((step, index) => (
                          <div key={`${String(step)}-${index}`} className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {index + 1}. {String(step)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">Sem passos detalhados no plano.</p>
                    )}
                  </DetailSection>

                  <DetailSection title="Arquivos e diff" description="Lista compacta de mudancas; o diff so abre quando necessario." badge={task.file_changes?.length ? `${task.file_changes.length} arquivos` : "sem diff"}>
                    {task.file_changes && task.file_changes.length > 0 ? (
                      <div className="space-y-3">
                        {task.file_changes.map((change) => (
                          <TaskFileChangeItem key={change.id} change={change} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">Sem alteracoes listadas para esta task.</p>
                    )}
                  </DetailSection>
                </div>

                <div className="space-y-4">
                  <DetailSection title="Preview e checks" description="Tudo o que importa para validar o PR sem misturar com as acoes principais." badge={summarizeChecks(task)}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preview</p>
                        {task.preview_url ? (
                          <a href={task.preview_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900">
                            Abrir preview
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-slate-700">Ainda sem URL de preview</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">Estado: {humanizeLabel(task.preview_status)}</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Checks</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge label={`Testes ${humanizeLabel(task.test_status)}`} tone={statusTone(task.test_status)} />
                          <StatusBadge label={`Build ${humanizeLabel(task.build_status)}`} tone={statusTone(task.build_status)} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">PR: {humanizeLabel(task.pull_request_status, "nao aberto")}</p>
                      </div>
                    </div>
                  </DetailSection>

                  <DetailSection title="Rollback" description="Estado do revert sem competir com diff ou auditoria." badge={task.metadata.rollback_pull_request_url ? "disponivel" : "nao criado"}>
                    <div className="space-y-3">
                      <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Branch de rollback</p>
                        <p className="mt-2 break-all text-sm text-slate-800">{String(task.metadata.rollback_branch_name ?? "Ainda sem branch de rollback")}</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pull Request</p>
                        {task.metadata.rollback_pull_request_url ? (
                          <a href={String(task.metadata.rollback_pull_request_url)} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900">
                            Abrir PR de rollback #{String(task.metadata.rollback_pull_request_number ?? "?")}
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-slate-700">Ainda sem PR de rollback.</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          Estado: {humanizeLabel(String(task.metadata.rollback_pull_request_status ?? "nao aberto"))}
                        </p>
                        {task.rolled_back_at ? (
                          <p className="mt-2 text-xs text-slate-500">Rollback registado em {formatDateTime(task.rolled_back_at)}</p>
                        ) : null}
                      </div>
                    </div>
                  </DetailSection>

                  <DetailSection title="Auditoria" description="Mostra so os eventos recentes por padrao, com expansao manual." badge={task.events?.length ? `${task.events.length} eventos` : "sem eventos"}>
                    {task.events && task.events.length > 0 ? (
                      <TaskAuditEvents events={task.events} />
                    ) : (
                      <p className="text-sm text-slate-600">Sem eventos registados.</p>
                    )}
                  </DetailSection>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
              Seleciona uma task para ver diff, eventos, preview, estado do build e acoes do admin.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
