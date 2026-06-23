import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CodeXml,
  Eye,
  GitBranch,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import { ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import {
  useAdminAiCodeEditorConfig,
  useAdminAiCodeEditorTask,
  useAdminAiCodeEditorTasks,
  useApproveAdminAiCodeEditorTask,
  useCreateAdminAiCodeEditorTask,
  useRefreshAdminAiCodeEditorTaskPreview,
  useRefreshAdminAiCodeEditorTaskStatus,
  useRejectAdminAiCodeEditorTask,
  useRequestAdjustmentAdminAiCodeEditorTask,
  useRollbackAdminAiCodeEditorTask,
  useStartAdminAiCodeEditorTaskExecution,
  useUpdateAdminAiCodeEditorConfig,
} from "@/hooks/useAdmin"
import { resolveAdminAiCodeEditorTransition } from "@/lib/admin-ai-code-editor"
import { ROUTES } from "@/lib/constants"
import type { AdminAiCodeEditorConfig, AdminAiCodeEditorTask } from "@/types/app.types"

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

function generationModeTone(mode: AdminAiCodeEditorConfig["config_value"]["generation_mode"]) {
  if (mode === "ai_enabled") return "success"
  if (mode === "blocked_provider_quota") return "danger"
  return "warning"
}

function providerStatusTone(status: AdminAiCodeEditorConfig["config_value"]["provider_statuses"]["openai"]["status"]) {
  if (status === "ready") return "success"
  if (status === "quota_exceeded" || status === "error") return "danger"
  return "warning"
}

function createEmptyConfig(): AdminAiCodeEditorConfig["config_value"] {
  return {
    enabled: false,
    make_default: false,
    legacy_editor_fallback_enabled: true,
    worker_mode: "simulated",
    github_repository: "studio4x/mariana-explica",
    vercel_project_name: "mariana-explica",
    primary_provider: "openai",
    secondary_provider: "gemini",
    primary_model: "gpt-4.1-mini",
    secondary_model: "gemini-2.0-flash",
    auto_run_tests: true,
    auto_run_build: true,
    request_preview_deploy: true,
    require_explicit_publish_confirmation: true,
    generation_mode: "deterministic_only",
    provider_statuses: {
      openai: {
        configured: false,
        model: "gpt-4.1-mini",
        status: "not_configured",
        last_error: null,
        last_error_at: null,
      },
      gemini: {
        configured: false,
        model: "gemini-2.0-flash",
        status: "not_configured",
        last_error: null,
        last_error_at: null,
      },
    },
    github_configured: false,
    vercel_configured: false,
  }
}

function ToggleField(props: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-950">{props.label}</p>
        <p className="text-sm leading-6 text-slate-600">{props.description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-950"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  )
}

type EditorTab = "chat" | "tasks" | "config"
type TaskListFilter = "all" | "in_progress" | "ready" | "failed" | "rejected" | "rollback"

const EDITOR_TAB_ROUTES: Record<EditorTab, string> = {
  chat: ROUTES.ADMIN_AI_CODE_EDITOR_CHAT,
  tasks: ROUTES.ADMIN_AI_CODE_EDITOR_TASKS,
  config: ROUTES.ADMIN_AI_CODE_EDITOR_CONFIG,
}

function resolveEditorTab(tab?: string | null): EditorTab | null {
  if (tab === "chat" || tab === "tasks" || tab === "config") {
    return tab
  }

  if (tab === "configuracao") {
    return "config"
  }

  if (tab == null) {
    return "chat"
  }

  return null
}

function EditorTabButton(props: {
  active: boolean
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.active}
      onClick={props.onClick}
      className={[
        "rounded-full border px-4 py-3 text-left transition",
        props.active
          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950",
      ].join(" ")}
    >
      <span className="block text-sm font-semibold">{props.label}</span>
      <span className={["block text-xs leading-5", props.active ? "text-slate-200" : "text-slate-500"].join(" ")}>
        {props.description}
      </span>
    </button>
  )
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function matchesTaskFilter(task: AdminAiCodeEditorTask, filter: TaskListFilter) {
  if (filter === "all") return true
  if (filter === "in_progress") {
    return task.status === "queued" || task.status === "planning" || task.status === "approved"
  }
  if (filter === "ready") {
    return task.status === "ready_for_review"
  }
  if (filter === "failed") {
    return task.status === "failed" || task.status === "blocked_provider_quota" || task.status === "ai_generation_unavailable"
  }
  if (filter === "rejected") {
    return task.status === "rejected" || task.status === "needs_adjustment"
  }
  return task.status === "rollback_ready_for_review" || Boolean(task.rolled_back_at ?? task.metadata.rollback_pull_request_url)
}

export function AdminAiCodeEditor() {
  const navigate = useNavigate()
  const { tab } = useParams<{ tab?: string }>()
  const configQuery = useAdminAiCodeEditorConfig()
  const tasksQuery = useAdminAiCodeEditorTasks()
  const updateConfigMutation = useUpdateAdminAiCodeEditorConfig()
  const createTaskMutation = useCreateAdminAiCodeEditorTask()
  const startExecutionMutation = useStartAdminAiCodeEditorTaskExecution()
  const refreshTaskStatusMutation = useRefreshAdminAiCodeEditorTaskStatus()
  const refreshTaskPreviewMutation = useRefreshAdminAiCodeEditorTaskPreview()
  const approveTaskMutation = useApproveAdminAiCodeEditorTask()
  const rejectTaskMutation = useRejectAdminAiCodeEditorTask()
  const requestAdjustmentMutation = useRequestAdjustmentAdminAiCodeEditorTask()
  const rollbackTaskMutation = useRollbackAdminAiCodeEditorTask()

  const [draftConfig, setDraftConfig] = useState<AdminAiCodeEditorConfig["config_value"]>(createEmptyConfig())
  const [prompt, setPrompt] = useState("")
  const [actionNotes, setActionNotes] = useState("")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskFilter] = useState<TaskListFilter>("all")
  const [taskSearch] = useState("")
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const activeTab = resolveEditorTab(tab) ?? "chat"
  const hasInvalidTab = tab != null && resolveEditorTab(tab) === null

  const rawTaskList = tasksQuery.data ?? []
  const taskList = useMemo(
    () => [...rawTaskList].sort((left, right) => parseDateValue(right.updated_at) - parseDateValue(left.updated_at)),
    [rawTaskList],
  )
  const filteredTaskList = useMemo(() => {
    const normalizedSearch = taskSearch.trim().toLocaleLowerCase("pt-PT")

    return taskList.filter((task) => {
      if (!matchesTaskFilter(task, taskFilter)) return false
      if (!normalizedSearch) return true

      const searchableText = [
        task.title,
        task.summary,
        task.prompt,
        task.branch_name,
        task.commit_sha ?? "",
        task.pull_request_number ? String(task.pull_request_number) : "",
      ]
        .join(" ")
        .toLocaleLowerCase("pt-PT")

      return searchableText.includes(normalizedSearch)
    })
  }, [taskFilter, taskList, taskSearch])
  const taskMetrics = useMemo(() => {
    const metrics = {
      total: taskList.length,
      readyForReview: 0,
      blocked: 0,
      rollbackReady: 0,
      failed: 0,
    }

    for (const task of taskList) {
      if (task.status === "ready_for_review" || task.status === "rollback_ready_for_review") {
        metrics.readyForReview += 1
      }

      if (task.status === "blocked_provider_quota" || task.status === "ai_generation_unavailable") {
        metrics.blocked += 1
      }

      if (task.status === "rollback_ready_for_review" || Boolean(task.rolled_back_at ?? task.metadata.rollback_pull_request_url)) {
        metrics.rollbackReady += 1
      }

      if (task.status === "failed") {
        metrics.failed += 1
      }
    }

    return metrics
  }, [taskList])
  const selectedTaskQuery = useAdminAiCodeEditorTask(selectedTaskId ?? undefined, Boolean(selectedTaskId))
  const selectedTask =
    selectedTaskQuery.data ?? filteredTaskList.find((task) => task.id === selectedTaskId) ?? null
  const transitionState = useMemo(
    () => resolveAdminAiCodeEditorTransition(configQuery.data ?? null),
    [configQuery.data],
  )

  useEffect(() => {
    if (!configQuery.data) return
    setDraftConfig(configQuery.data.config_value)
  }, [configQuery.data])

  useEffect(() => {
    if (filteredTaskList.length === 0) {
      setSelectedTaskId(null)
      return
    }

    if (!selectedTaskId || !filteredTaskList.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTaskList[0].id)
    }
  }, [filteredTaskList, selectedTaskId])

  if (hasInvalidTab) {
    return <Navigate to={ROUTES.ADMIN_AI_CODE_EDITOR_CHAT} replace />
  }

  if (configQuery.isLoading) {
    return <LoadingState message="A carregar o Editor IA Irrestrito..." />
  }

  if (configQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o Editor IA Irrestrito"
        message={configQuery.error instanceof Error ? configQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void configQuery.refetch()}
      />
    )
  }

  async function handleSaveConfig() {
    setFeedback(null)
    try {
      const nextConfig = await updateConfigMutation.mutateAsync({
        configValue: draftConfig,
      })
      setDraftConfig(nextConfig.config_value)
      setFeedback({ tone: "success", message: "Configurações salvas com sucesso." })
    } catch {
      setFeedback({
        tone: "danger",
        message: "Não foi possível salvar as configurações do Editor IA Irrestrito. Verifique os dados e tente novamente.",
      })
    }
  }

  async function handleCreateTask() {
    setFeedback(null)
    try {
      const task = await createTaskMutation.mutateAsync({ prompt })
      setPrompt("")
      setSelectedTaskId(task.id)
      setFeedback({
        tone: "success",
        message:
          task.worker_mode === "github_worker"
            ? "Task criada com branch, patch, commit e PR reais em andamento."
            : "Task criada em modo de planejamento.",
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel criar a task.",
      })
    }
  }

  async function handleRefreshTask(action: "status" | "preview", taskId: string) {
    setFeedback(null)
    try {
      const task =
        action === "status"
          ? await refreshTaskStatusMutation.mutateAsync({ taskId })
          : await refreshTaskPreviewMutation.mutateAsync({ taskId })

      setSelectedTaskId(task.id)
      setFeedback({
        tone: "success",
        message: action === "status" ? "Checks da task atualizados." : "Preview da task atualizado.",
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar a task.",
      })
    }
  }

  async function handleRestartExecution(taskId: string) {
    setFeedback(null)
    try {
      const task = await startExecutionMutation.mutateAsync({ taskId })
      setSelectedTaskId(task.id)
      setFeedback({
        tone: "success",
        message: "Execucao real reiniciada para a task.",
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel reiniciar a execucao da task.",
      })
    }
  }

  async function handleTaskAction(
    action: "approve" | "reject" | "adjust" | "rollback",
    taskId: string,
  ) {
    setFeedback(null)
    try {
      const payload = { taskId, notes: actionNotes.trim() || null }
      const result =
        action === "approve"
          ? await approveTaskMutation.mutateAsync(payload)
          : action === "reject"
            ? await rejectTaskMutation.mutateAsync(payload)
            : action === "adjust"
              ? await requestAdjustmentMutation.mutateAsync(payload)
              : await rollbackTaskMutation.mutateAsync(payload)

      setSelectedTaskId(result.id)
      setActionNotes("")
      setFeedback({
        tone: "success",
        message:
          action === "approve"
            ? "Task aprovada e publicada com merge via GitHub API."
            : action === "reject"
              ? "Task rejeitada."
              : action === "adjust"
                ? "Task devolvida para ajuste."
                : "Rollback preparado com branch e PR de revert para revisao.",
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar a task.",
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor IA Irrestrito"
        description="Fluxo administrativo para tarefas de codigo com branch real, patch real, diff persistido, Pull Request, preview, aprovacao manual e rollback auditavel."
        backTo={ROUTES.ADMIN}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void configQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar config
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void tasksQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar tasks
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Novo editor</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{draftConfig.enabled ? "Ativo" : "Inativo"}</p>
          <p className="mt-2 text-sm text-slate-600">Acesso exclusivo para admin autenticado.</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Transicao</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={transitionState.showNewEditor ? "Novo visivel" : "Novo oculto"} tone={transitionState.showNewEditor ? "success" : "neutral"} />
            <StatusBadge label={transitionState.showLegacyAiEditor ? "Legado fallback" : "Legado oculto"} tone={transitionState.showLegacyAiEditor ? "warning" : "success"} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {transitionState.newEditorIsDefault ? "O launcher futuro passa a abrir o novo editor." : "Fase 1: os dois editores podem coexistir."}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Worker</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{draftConfig.worker_mode === "github_worker" ? "GitHub" : "Simulado"}</p>
          <p className="mt-2 text-sm text-slate-600">Modo operacional do worker que executa as tasks do editor.</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Tasks</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{taskList.length}</p>
          <p className="mt-2 text-sm text-slate-600">Historico auditavel de tarefas do novo editor.</p>
        </div>
      </div>

      {feedback ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm font-medium",
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      <div role="tablist" aria-label="Secoes do editor IA irrestrito" className="grid gap-3 md:grid-cols-3">
        <EditorTabButton
          active={activeTab === "chat"}
          label="Chat"
          description="Ponto de entrada para pedidos e validação rápida."
          onClick={() => navigate(EDITOR_TAB_ROUTES.chat)}
        />
        <EditorTabButton
          active={activeTab === "tasks"}
          label="Tasks"
          description="Lista, diff, PR, preview e rollback por tarefa."
          onClick={() => navigate(EDITOR_TAB_ROUTES.tasks)}
        />
        <EditorTabButton
          active={activeTab === "config"}
          label="Configuração"
          description="Worker, providers, fallback e publicação."
          onClick={() => navigate(EDITOR_TAB_ROUTES.config)}
        />
      </div>

      {activeTab !== "tasks" ? (
        <section className="space-y-5">
        <div
          className={[
            "w-full space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm",
            activeTab === "config" ? "" : "hidden",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Configuracao e transicao</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Controla o worker GitHub/Vercel e a transicao que desativa o editor legado sem apagar os dados existentes.
              </p>
            </div>
            <StatusBadge label={draftConfig.worker_mode === "simulated" ? "Modo simulado" : "Worker real"} tone={draftConfig.worker_mode === "simulated" ? "warning" : "success"} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Modo IA</p>
              <div className="mt-3">
                <StatusBadge label={draftConfig.generation_mode.replace(/_/g, " ")} tone={generationModeTone(draftConfig.generation_mode)} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {draftConfig.generation_mode === "blocked_provider_quota"
                  ? "A geracao livre esta bloqueada por quota e o editor depende de fallback deterministico."
                  : draftConfig.generation_mode === "deterministic_only"
                    ? "Sem provider IA utilizavel neste momento; apenas pedidos deterministicos ficam disponiveis."
                    : "Geracao livre por IA disponivel, com fallback deterministico para pedidos simples."}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">GitHub</p>
              <div className="mt-3">
                <StatusBadge label={draftConfig.github_configured ? "Configurado" : "Nao configurado"} tone={draftConfig.github_configured ? "success" : "danger"} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{draftConfig.github_repository}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Vercel</p>
              <div className="mt-3">
                <StatusBadge label={draftConfig.vercel_configured ? "Configurado" : "Nao configurado"} tone={draftConfig.vercel_configured ? "success" : "danger"} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{draftConfig.vercel_project_name}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Editor legado</p>
              <div className="mt-3">
                <StatusBadge label={transitionState.showLegacyAiEditor ? "Fallback ativo" : "Oculto"} tone={transitionState.showLegacyAiEditor ? "warning" : "success"} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {transitionState.newEditorIsDefault ? "O fluxo principal ja aponta para o editor irrestrito." : "Ainda existe transicao paralela entre novo e legado."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(["openai", "gemini"] as const).map((provider) => {
              const providerState = draftConfig.provider_statuses[provider]
              return (
                <div key={provider} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-950">{provider.toUpperCase()}</p>
                    <StatusBadge label={providerState.status.replace(/_/g, " ")} tone={providerStatusTone(providerState.status)} />
                    <StatusBadge label={providerState.configured ? "Com chave" : "Sem chave"} tone={providerState.configured ? "success" : "warning"} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Modelo: {providerState.model}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {providerState.last_error
                      ? `${providerState.last_error} (${formatDateTime(providerState.last_error_at)})`
                      : "Sem erro recente registado."}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="grid gap-3">
            <ToggleField
              label="Ativar novo editor"
              description="Mostra a nova tela administrativa e permite criar tasks do Editor IA Irrestrito."
              checked={draftConfig.enabled}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, enabled: checked }))}
            />
            <ToggleField
              label="Tornar padrao"
              description="Define o novo editor como fluxo principal e oculta o legado quando o fallback estiver desligado."
              checked={draftConfig.make_default}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, make_default: checked }))}
            />
            <ToggleField
              label="Manter fallback legado"
              description="Mantem o editor IA antigo disponivel apenas como fallback tecnico temporario."
              checked={draftConfig.legacy_editor_fallback_enabled}
              onChange={(checked) =>
                setDraftConfig((current) => ({ ...current, legacy_editor_fallback_enabled: checked }))
              }
            />
            <ToggleField
              label="Executar testes automaticamente"
              description="Consulta os checks do GitHub Actions antes de qualquer aprovacao."
              checked={draftConfig.auto_run_tests}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, auto_run_tests: checked }))}
            />
            <ToggleField
              label="Executar build automaticamente"
              description="Exige build rastreavel da branch antes de aprovar a publicacao."
              checked={draftConfig.auto_run_build}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, auto_run_build: checked }))}
            />
            <ToggleField
              label="Solicitar preview deploy"
              description="Captura o preview real do Vercel por commit antes da publicacao."
              checked={draftConfig.request_preview_deploy}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, request_preview_deploy: checked }))}
            />
            <ToggleField
              label="Confirmacao explicita antes de publicar"
              description="Mesmo com permissao ampla, nada deve ir para producao sem aprovacao manual rastreavel."
              checked={draftConfig.require_explicit_publish_confirmation}
              onChange={(checked) =>
                setDraftConfig((current) => ({
                  ...current,
                  require_explicit_publish_confirmation: checked,
                }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Worker mode</span>
              <select
                value={draftConfig.worker_mode}
                onChange={(event) =>
                  setDraftConfig((current) => ({
                    ...current,
                    worker_mode: event.target.value as AdminAiCodeEditorConfig["config_value"]["worker_mode"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="simulated">simulated</option>
                <option value="github_worker">github_worker</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Provider primario</span>
              <select
                value={draftConfig.primary_provider}
                onChange={(event) =>
                  setDraftConfig((current) => ({
                    ...current,
                    primary_provider: event.target.value as AdminAiCodeEditorConfig["config_value"]["primary_provider"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="openai">openai</option>
                <option value="gemini">gemini</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Modelo primario</span>
              <input
                value={draftConfig.primary_model}
                onChange={(event) =>
                  setDraftConfig((current) => ({ ...current, primary_model: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Provider secundario</span>
              <select
                value={draftConfig.secondary_provider}
                onChange={(event) =>
                  setDraftConfig((current) => ({
                    ...current,
                    secondary_provider: event.target.value as AdminAiCodeEditorConfig["config_value"]["secondary_provider"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="gemini">gemini</option>
                <option value="openai">openai</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Modelo secundario</span>
              <input
                value={draftConfig.secondary_model}
                onChange={(event) =>
                  setDraftConfig((current) => ({ ...current, secondary_model: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Repositorio GitHub</span>
              <input
                value={draftConfig.github_repository}
                onChange={(event) =>
                  setDraftConfig((current) => ({ ...current, github_repository: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Projeto Vercel</span>
              <input
                value={draftConfig.vercel_project_name}
                onChange={(event) =>
                  setDraftConfig((current) => ({ ...current, vercel_project_name: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" className="rounded-full" onClick={() => void handleSaveConfig()} disabled={updateConfigMutation.isPending}>
              {updateConfigMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar configuracao
                </>
              )}
            </Button>
          </div>
        </div>

        <div
          data-testid="ai-editor-chat-panel"
          className={[
            "w-full space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm",
            activeTab === "chat" ? "" : "hidden",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Chat</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Ponto principal do editor: o pedido entra aqui e vira uma task auditavel, com plano, branch real, patch aplicado, diff persistido, PR e gate de aprovacao manual.
              </p>
            </div>
            {draftConfig.worker_mode === "simulated" ? (
              <StatusBadge label="Sem fake deploy" tone="warning" />
            ) : (
              <StatusBadge label="Integracao real" tone="success" />
            )}
          </div>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-[180px] w-full rounded-[1.5rem] border border-slate-200 px-4 py-4 text-sm leading-6 outline-none transition focus:border-slate-400"
            placeholder='Ex.: altere o layout dos cards da pagina de materiais'
          />

          <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-950">Fluxo operacional</p>
            <p className="mt-2">
              admin pede → IA planeia → arquivos provaveis → diff visivel → status de testes/build/preview honestos → revisao admin → aprovacao manual → rollback rastreavel.
            </p>
          </div>

          <Button
            type="button"
            className="rounded-full"
            onClick={() => void handleCreateTask()}
            disabled={!prompt.trim() || createTaskMutation.isPending}
          >
            {createTaskMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A criar task...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Criar task
              </>
            )}
          </Button>
        </div>
        </section>
      ) : null}

      {activeTab === "tasks" ? (
        <section className="space-y-5" data-testid="ai-editor-tasks-panel">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Tasks</p>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">Tarefas do Editor IA</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Acompanhe solicitações, branches, PRs, previews, rollbacks e auditoria num único painel mais legível.
                </p>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => void tasksQuery.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar tasks
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Total</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{taskMetrics.total}</p>
              <p className="mt-2 text-sm text-slate-600">Tarefas registadas no histórico.</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Prontas p/ revisão</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{taskMetrics.readyForReview}</p>
              <p className="mt-2 text-sm text-slate-600">Aguardam validação ou aprovação manual.</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Bloqueadas</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{taskMetrics.blocked}</p>
              <p className="mt-2 text-sm text-slate-600">Quotas ou indisponibilidade de geração.</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Com rollback</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{taskMetrics.rollbackReady}</p>
              <p className="mt-2 text-sm text-slate-600">Revert preparado ou já registado.</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Falhas</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{taskMetrics.failed}</p>
              <p className="mt-2 text-sm text-slate-600">Execuções interrompidas ou inválidas.</p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Lista</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">Fila de tasks</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Escolhe uma tarefa para abrir o detalhe completo.</p>
                </div>
                <StatusBadge label={`${taskList.length}`} tone={taskList.length > 0 ? "success" : "neutral"} />
              </div>

              {tasksQuery.isLoading ? (
                <LoadingState message="A carregar tasks..." />
              ) : tasksQuery.isError ? (
                <ErrorState
                  title="Nao foi possivel carregar as tasks"
                  message={tasksQuery.error instanceof Error ? tasksQuery.error.message : "Tenta novamente dentro de instantes."}
                  onRetry={() => void tasksQuery.refetch()}
                />
              ) : taskList.length > 0 ? (
                <div className="space-y-3">
                  {taskList.map((task) => {
                    const active = task.id === selectedTaskId

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className={[
                          "w-full rounded-[1.4rem] border px-4 py-4 text-left transition",
                          active
                            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-6">{task.title}</p>
                          <StatusBadge label={task.status.replace(/_/g, " ")} tone={statusTone(task.status)} />
                        </div>
                        <p className={`mt-2 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-600"}`}>{task.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge label={task.risk_level} tone={riskTone(task.risk_level)} />
                          <StatusBadge label={`Preview ${task.preview_status}`} tone={statusTone(task.preview_status)} />
                          <StatusBadge label={`Build ${task.build_status}`} tone={statusTone(task.build_status)} />
                        </div>
                        <p className={`mt-3 text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>
                          Atualizada em {formatDateTime(task.updated_at)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Ainda nao existem tasks do novo editor.
                </p>
              )}
            </div>

            <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              {selectedTaskId && selectedTaskQuery.isLoading ? (
                <LoadingState message="A carregar detalhes da task..." />
              ) : selectedTaskId && selectedTaskQuery.isError ? (
                <ErrorState
                  title="Nao foi possivel carregar a task"
                  message={
                    selectedTaskQuery.error instanceof Error
                      ? selectedTaskQuery.error.message
                      : "Tenta novamente dentro de instantes."
                  }
                  onRetry={() => void selectedTaskQuery.refetch()}
                />
              ) : selectedTask ? (
                <>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-950">{selectedTask.title}</h2>
                        <StatusBadge label={selectedTask.status.replace(/_/g, " ")} tone={statusTone(selectedTask.status)} />
                        <StatusBadge label={selectedTask.risk_level} tone={riskTone(selectedTask.risk_level)} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTask.summary}</p>
                      <p className="mt-2 text-xs text-slate-500">Criada em {formatDateTime(selectedTask.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.sensitive_change ? (
                        <StatusBadge label="Area sensivel" tone="danger" />
                      ) : null}
                      <StatusBadge label={`Preview ${selectedTask.preview_status}`} tone={statusTone(selectedTask.preview_status)} />
                      <StatusBadge label={`Testes ${selectedTask.test_status}`} tone={statusTone(selectedTask.test_status)} />
                      <StatusBadge label={`Build ${selectedTask.build_status}`} tone={statusTone(selectedTask.build_status)} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-slate-500" />
                        <p className="text-sm font-semibold text-slate-950">Branch</p>
                      </div>
                      <p className="mt-3 break-all text-sm text-slate-700">{selectedTask.branch_name}</p>
                      <p className="mt-2 text-xs text-slate-500">Base: {selectedTask.default_branch ?? "por resolver"}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-500" />
                        <p className="text-sm font-semibold text-slate-950">Commit</p>
                      </div>
                      <p className="mt-3 break-all text-sm text-slate-700">{selectedTask.commit_sha ?? "Ainda sem commit real"}</p>
                      <p className="mt-2 text-xs text-slate-500">{selectedTask.commit_message}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <CodeXml className="h-4 w-4 text-slate-500" />
                        <p className="text-sm font-semibold text-slate-950">Pull Request</p>
                      </div>
                      {selectedTask.pull_request_url ? (
                        <a
                          href={selectedTask.pull_request_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900"
                        >
                          #{selectedTask.pull_request_number ?? "?"} abrir PR
                        </a>
                      ) : (
                        <p className="mt-3 text-sm text-slate-700">Ainda sem PR real</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Estado: {selectedTask.pull_request_status ?? "nao aberto"}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-slate-500" />
                        <p className="text-sm font-semibold text-slate-950">Preview</p>
                      </div>
                      {selectedTask.preview_url ? (
                        <a
                          href={selectedTask.preview_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900"
                        >
                          Abrir preview
                        </a>
                      ) : (
                        <p className="mt-3 text-sm text-slate-700">Ainda sem URL de preview</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Estado: {selectedTask.preview_status}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-slate-500" />
                        <p className="text-sm font-semibold text-slate-950">Rollback</p>
                      </div>
                      {selectedTask.metadata.rollback_pull_request_url ? (
                        <a
                          href={String(selectedTask.metadata.rollback_pull_request_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 block break-all text-sm font-semibold text-sky-700 hover:text-sky-900"
                        >
                          Abrir PR de rollback #{String(selectedTask.metadata.rollback_pull_request_number ?? "?")}
                        </a>
                      ) : (
                        <p className="mt-3 text-sm text-slate-700">Ainda sem rollback preparado</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Estado: {String(selectedTask.metadata.rollback_pull_request_status ?? "nao aberto")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      {selectedTask.sensitive_change ? (
                        <ShieldAlert className="h-4 w-4 text-rose-700" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                      )}
                      <p className="text-sm font-semibold text-slate-950">Resumo operacional</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{selectedTask.result_summary ?? "Sem resumo operacional."}</p>
                    {selectedTask.execution_error ? (
                      <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-6 text-rose-900">
                        {selectedTask.execution_error}
                      </p>
                    ) : null}
                    {selectedTask.sensitive_reasons.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedTask.sensitive_reasons.map((reason) => (
                          <StatusBadge key={reason} label={reason} tone="danger" />
                        ))}
                      </div>
                    ) : null}
                    {Array.isArray(selectedTask.metadata.provider_attempts) && selectedTask.metadata.provider_attempts.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {selectedTask.metadata.provider_attempts.map((attempt, index) => (
                          <div
                            key={`${String((attempt as { provider?: string }).provider ?? "provider")}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-600"
                          >
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
                    {selectedTask.status === "blocked_provider_quota" ? (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
                        A geracao livre por IA ficou bloqueada por quota. O admin pode restaurar creditos dos providers ou reenquadrar o pedido para um fallback deterministico suportado.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <h3 className="text-lg font-bold text-slate-950">Arquivos analisados</h3>
                      {selectedTask.files_analyzed.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.files_analyzed.map((filePath) => (
                            <span
                              key={filePath}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
                            >
                              {filePath}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">Nenhum arquivo analisado registado.</p>
                      )}
                    </div>

                    <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <h3 className="text-lg font-bold text-slate-950">Plano do worker</h3>
                      {Array.isArray(selectedTask.plan_json.steps) && selectedTask.plan_json.steps.length > 0 ? (
                        <div className="space-y-2">
                          {selectedTask.plan_json.steps.map((step, index) => (
                            <div
                              key={`${String(step)}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                            >
                              {index + 1}. {String(step)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">Sem passos detalhados no plano.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-bold text-slate-950">Arquivos alterados e diff</h3>
                    {selectedTask.file_changes && selectedTask.file_changes.length > 0 ? (
                      <div className="space-y-4">
                        {selectedTask.file_changes.map((change) => (
                          <div key={change.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-950">{change.file_path}</p>
                              <StatusBadge label={change.change_type} tone="info" />
                              <StatusBadge label={change.status} tone={statusTone(change.status)} />
                              {change.language ? <StatusBadge label={change.language} tone="neutral" /> : null}
                            </div>
                            {change.summary ? (
                              <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{change.summary}</p>
                            ) : null}
                            {change.rationale ? (
                              <p className="mt-2 text-sm leading-6 text-slate-600">{change.rationale}</p>
                            ) : null}
                            {(change.before_sha || change.after_sha) ? (
                              <p className="mt-2 break-all text-xs text-slate-500">
                                before: {change.before_sha ?? "n/a"} | after: {change.after_sha ?? "n/a"}
                              </p>
                            ) : null}
                            <pre className="mt-3 max-h-72 overflow-auto rounded-[1rem] bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                              {change.diff_patch ?? change.diff_preview ?? "Sem diff persistido."}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">Sem alteracoes listadas para esta task.</p>
                    )}
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <h3 className="text-lg font-bold text-slate-950">Acoes do admin</h3>
                      <p className="text-sm leading-6 text-slate-600">
                        A aprovacao faz merge via GitHub API quando diff, checks e preview estao prontos. O rollback cria uma branch de revert e abre um PR de rollback para revisao.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => void handleRefreshTask("status", selectedTask.id)}
                          disabled={refreshTaskStatusMutation.isPending}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Atualizar checks
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => void handleRefreshTask("preview", selectedTask.id)}
                          disabled={refreshTaskPreviewMutation.isPending}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Atualizar preview
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => void handleRestartExecution(selectedTask.id)}
                          disabled={startExecutionMutation.isPending}
                        >
                          <Loader2 className="mr-2 h-4 w-4" />
                          Reexecutar worker
                        </Button>
                      </div>
                      <textarea
                        value={actionNotes}
                        onChange={(event) => setActionNotes(event.target.value)}
                        className="min-h-[110px] w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                        placeholder="Notas opcionais para aprovacao, rejeicao, ajuste ou rollback"
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          className="rounded-full"
                          onClick={() => void handleTaskAction("approve", selectedTask.id)}
                          disabled={approveTaskMutation.isPending}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Aprovar e publicar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => void handleTaskAction("adjust", selectedTask.id)}
                          disabled={requestAdjustmentMutation.isPending}
                        >
                          <Loader2 className="mr-2 h-4 w-4" />
                          Pedir ajuste
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                          onClick={() => void handleTaskAction("reject", selectedTask.id)}
                          disabled={rejectTaskMutation.isPending}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Rejeitar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => void handleTaskAction("rollback", selectedTask.id)}
                          disabled={rollbackTaskMutation.isPending}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Criar rollback PR
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <h3 className="text-lg font-bold text-slate-950">Auditoria da task</h3>
                      {selectedTask.events && selectedTask.events.length > 0 ? (
                        <div className="space-y-3">
                          {selectedTask.events.map((event) => (
                            <div key={event.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-950">{event.event_type}</p>
                                <p className="text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{event.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">Sem eventos registados.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
                  Seleciona uma task para ver diff, eventos, preview, estado do build e acoes do admin.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
