import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, Eye, GitBranch, Loader2, RefreshCw, RotateCcw, Save, Send, ShieldAlert, XCircle } from "lucide-react"
import { ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminAiCodeEditorConfig,
  useAdminAiCodeEditorTask,
  useAdminAiCodeEditorTasks,
  useApproveAdminAiCodeEditorTask,
  useCreateAdminAiCodeEditorTask,
  useRejectAdminAiCodeEditorTask,
  useRequestAdjustmentAdminAiCodeEditorTask,
  useRollbackAdminAiCodeEditorTask,
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
  if (status === "failed" || status === "rejected" || status === "rolled_back") return "danger"
  if (status === "needs_adjustment" || status === "pending") return "warning"
  return "neutral"
}

function riskTone(riskLevel: AdminAiCodeEditorTask["risk_level"]) {
  return riskLevel === "high" ? "danger" : riskLevel === "medium" ? "warning" : "success"
}

function createEmptyConfig(): AdminAiCodeEditorConfig["config_value"] {
  return {
    enabled: false,
    make_default: false,
    legacy_editor_fallback_enabled: true,
    worker_mode: "simulated",
    github_repository: "studio4x/mariana-explica",
    vercel_project_name: "mariana-explica",
    auto_run_tests: true,
    auto_run_build: true,
    request_preview_deploy: true,
    require_explicit_publish_confirmation: true,
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

export function AdminAiCodeEditor() {
  const configQuery = useAdminAiCodeEditorConfig()
  const tasksQuery = useAdminAiCodeEditorTasks()
  const updateConfigMutation = useUpdateAdminAiCodeEditorConfig()
  const createTaskMutation = useCreateAdminAiCodeEditorTask()
  const approveTaskMutation = useApproveAdminAiCodeEditorTask()
  const rejectTaskMutation = useRejectAdminAiCodeEditorTask()
  const requestAdjustmentMutation = useRequestAdjustmentAdminAiCodeEditorTask()
  const rollbackTaskMutation = useRollbackAdminAiCodeEditorTask()

  const [draftConfig, setDraftConfig] = useState<AdminAiCodeEditorConfig["config_value"]>(createEmptyConfig())
  const [prompt, setPrompt] = useState("")
  const [actionNotes, setActionNotes] = useState("")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)

  const taskList = tasksQuery.data ?? []
  const selectedTaskQuery = useAdminAiCodeEditorTask(selectedTaskId ?? undefined, Boolean(selectedTaskId))
  const selectedTask = selectedTaskQuery.data ?? null
  const transitionState = useMemo(
    () => resolveAdminAiCodeEditorTransition(configQuery.data ?? null),
    [configQuery.data],
  )

  useEffect(() => {
    if (!configQuery.data) return
    setDraftConfig(configQuery.data.config_value)
  }, [configQuery.data])

  useEffect(() => {
    if (!selectedTaskId && taskList.length > 0) {
      setSelectedTaskId(taskList[0].id)
    }
  }, [selectedTaskId, taskList])

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
      setFeedback({ tone: "success", message: "Configuracao do novo editor guardada com sucesso." })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel guardar a configuracao.",
      })
    }
  }

  async function handleCreateTask() {
    setFeedback(null)
    try {
      const task = await createTaskMutation.mutateAsync({ prompt })
      setPrompt("")
      setSelectedTaskId(task.id)
      setFeedback({ tone: "success", message: "Task criada e enviada para revisao do novo editor." })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel criar a task.",
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
            ? "Task aprovada. A publicacao continua manual e confirmada."
            : action === "reject"
              ? "Task rejeitada."
              : action === "adjust"
                ? "Task devolvida para ajuste."
                : "Rollback registado para a task.",
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
        description="Novo fluxo administrativo para tarefas de codigo com branch, diff, auditoria, aprovacao e rollback. Nesta primeira entrega o worker ainda pode operar em modo simulado, sem fingir branch ou preview reais quando a integracao GitHub/Vercel ainda nao estiver ligada."
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
          <p className="mt-2 text-sm text-slate-600">Modo real so deve aparecer quando a camada Git/Vercel estiver pronta.</p>
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

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Configuracao e transicao</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Mantem o editor atual como fallback enquanto o novo fluxo amadurece, sem apagar `site_pages` nem o launcher antigo.
              </p>
            </div>
            <StatusBadge label={draftConfig.worker_mode === "simulated" ? "Modo simulado" : "Worker real"} tone={draftConfig.worker_mode === "simulated" ? "warning" : "success"} />
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
              description="Prepara a fase 2, quando o launcher futuro deve preferir o novo editor."
              checked={draftConfig.make_default}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, make_default: checked }))}
            />
            <ToggleField
              label="Manter fallback legado"
              description="Permite ocultar o editor antigo no admin sem remover a rota nem a implementacao."
              checked={draftConfig.legacy_editor_fallback_enabled}
              onChange={(checked) =>
                setDraftConfig((current) => ({ ...current, legacy_editor_fallback_enabled: checked }))
              }
            />
            <ToggleField
              label="Executar testes automaticamente"
              description="Quando o worker GitHub estiver ativo, dispara os testes antes de qualquer aprovacao."
              checked={draftConfig.auto_run_tests}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, auto_run_tests: checked }))}
            />
            <ToggleField
              label="Executar build automaticamente"
              description="Quando a integracao estiver disponivel, exige build rastreavel para cada task."
              checked={draftConfig.auto_run_build}
              onChange={(checked) => setDraftConfig((current) => ({ ...current, auto_run_build: checked }))}
            />
            <ToggleField
              label="Solicitar preview deploy"
              description="Mantem a intencao de preview obrigatorio antes da publicacao, sem inventar URL quando ainda nao existir."
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

        <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Nova task</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                O pedido vira uma task auditavel, com plano, branch sugerida, arquivos provaveis, diff planejado e gate de aprovacao.
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
            <p className="font-semibold text-slate-950">Fluxo deste MVP</p>
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

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Tasks</h2>
              <p className="mt-1 text-sm text-slate-600">Historico do novo editor, sem apagar o legado.</p>
            </div>
            <StatusBadge label={`${taskList.length} task(s)`} tone={taskList.length > 0 ? "success" : "neutral"} />
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
                      "w-full rounded-[1.25rem] border px-4 py-4 text-left transition",
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">{task.title}</p>
                      <StatusBadge label={task.status.replace(/_/g, " ")} tone={statusTone(task.status)} />
                    </div>
                    <p className={`mt-2 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-600"}`}>{task.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge label={task.risk_level} tone={riskTone(task.risk_level)} />
                      <StatusBadge label={task.worker_mode} tone={task.worker_mode === "simulated" ? "warning" : "success"} />
                    </div>
                    <p className={`mt-3 text-[11px] ${active ? "text-slate-300" : "text-slate-500"}`}>Atualizada em {formatDateTime(task.updated_at)}</p>
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

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Branch</p>
                  </div>
                  <p className="mt-3 break-all text-sm text-slate-700">{selectedTask.branch_name}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Commit sugerido</p>
                  </div>
                  <p className="mt-3 break-all text-sm text-slate-700">{selectedTask.commit_message}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Preview</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{selectedTask.preview_url ?? "Ainda sem URL de preview"}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-950">Worker</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{selectedTask.worker_mode}</p>
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
                {selectedTask.sensitive_reasons.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTask.sensitive_reasons.map((reason) => (
                      <StatusBadge key={reason} label={reason} tone="danger" />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <h3 className="text-lg font-bold text-slate-950">Arquivos analisados</h3>
                  {selectedTask.files_analyzed.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.files_analyzed.map((filePath) => (
                        <span key={filePath} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
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
                        <div key={`${String(step)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                        </div>
                        {change.rationale ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">{change.rationale}</p>
                        ) : null}
                        <pre className="mt-3 overflow-x-auto rounded-[1rem] bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                          {change.diff_preview ?? "Sem diff planeado."}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Sem alteracoes listadas para esta task.</p>
                )}
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <h3 className="text-lg font-bold text-slate-950">Acoes do admin</h3>
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
                    Aprovar
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
                    Rollback
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
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
              Seleciona uma task para ver diff, eventos, preview, estado do build e acoes do admin.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
