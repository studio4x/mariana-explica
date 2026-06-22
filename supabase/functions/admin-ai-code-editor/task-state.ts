import type { AiCodeEditorPlan } from "./planner.ts"

export type AiCodeEditorTaskStatus =
  | "queued"
  | "planning"
  | "ready_for_review"
  | "approved"
  | "blocked_provider_quota"
  | "ai_generation_unavailable"
  | "rejected"
  | "needs_adjustment"
  | "published"
  | "rollback_ready_for_review"
  | "rolled_back"
  | "failed"

export type AiCodeEditorPreviewStatus = "not_requested" | "pending" | "ready" | "failed"
export type AiCodeEditorExecutionStatus = "not_requested" | "pending" | "passed" | "failed"
export type AiCodeEditorProvider = "openai" | "gemini"
export type AiCodeEditorGenerationMode = "ai_enabled" | "deterministic_only" | "blocked_provider_quota"
export type AiCodeEditorProviderHealthStatus = "ready" | "quota_exceeded" | "error" | "not_configured"

export interface AiCodeEditorProviderHealth {
  configured: boolean
  model: string
  status: AiCodeEditorProviderHealthStatus
  last_error: string | null
  last_error_at: string | null
}

export interface AiCodeEditorConfigValue {
  enabled: boolean
  make_default: boolean
  legacy_editor_fallback_enabled: boolean
  worker_mode: "simulated" | "github_worker"
  github_repository: string
  vercel_project_name: string
  primary_provider: AiCodeEditorProvider
  secondary_provider: AiCodeEditorProvider
  primary_model: string
  secondary_model: string
  auto_run_tests: boolean
  auto_run_build: boolean
  request_preview_deploy: boolean
  require_explicit_publish_confirmation: boolean
  generation_mode: AiCodeEditorGenerationMode
  provider_statuses: Record<AiCodeEditorProvider, AiCodeEditorProviderHealth>
  github_configured: boolean
  vercel_configured: boolean
}

export interface AiCodeEditorTaskRecord {
  id: string
  status: AiCodeEditorTaskStatus
  preview_status: AiCodeEditorPreviewStatus
  test_status: AiCodeEditorExecutionStatus
  build_status: AiCodeEditorExecutionStatus
  sensitive_change: boolean
  requires_explicit_publish_confirmation: boolean
  worker_mode: AiCodeEditorConfigValue["worker_mode"]
  approved_at: string | null
  published_at: string | null
  rolled_back_at: string | null
  metadata: Record<string, unknown>
}

export interface AiCodeEditorPublicationReadiness {
  branch_name?: string | null
  commit_sha?: string | null
  pull_request_url?: string | null
  preview_status: AiCodeEditorPreviewStatus
  test_status: AiCodeEditorExecutionStatus
  build_status: AiCodeEditorExecutionStatus
  has_diff: boolean
}

export interface AiCodeEditorInitialTaskState {
  status: AiCodeEditorTaskStatus
  previewStatus: AiCodeEditorPreviewStatus
  testStatus: AiCodeEditorExecutionStatus
  buildStatus: AiCodeEditorExecutionStatus
  resultSummary: string
  metadata: Record<string, unknown>
}

export function buildInitialTaskState(input: {
  config: AiCodeEditorConfigValue
  plan: AiCodeEditorPlan
}): AiCodeEditorInitialTaskState {
  const executionMode = input.config.worker_mode
  const previewAvailable = executionMode === "github_worker" && input.config.request_preview_deploy
  const testsAvailable = executionMode === "github_worker" && input.config.auto_run_tests
  const buildAvailable = executionMode === "github_worker" && input.config.auto_run_build

  return {
    status: "ready_for_review",
    previewStatus: previewAvailable ? "pending" : "not_requested",
    testStatus: testsAvailable ? "pending" : "not_requested",
    buildStatus: buildAvailable ? "pending" : "not_requested",
    resultSummary: input.plan.resultSummary,
    metadata: {
      execution_mode: executionMode,
      capabilities: {
        git_branching: executionMode === "github_worker" ? "planned_live" : "simulated_contract",
        preview_deploy: previewAvailable ? "requested" : "not_requested",
        automated_tests: testsAvailable ? "requested" : "not_requested",
        automated_build: buildAvailable ? "requested" : "not_requested",
      },
      simulation_notice:
        executionMode === "simulated"
          ? "Este task ainda opera em modo simulado. A branch, o commit e o preview aparecem como contrato operacional ate a integracao Git/Vercel."
          : null,
    },
  }
}

export type AiCodeEditorTaskAction = "approve" | "reject" | "request_adjustment" | "rollback"

export function transitionTaskRecord(input: {
  task: AiCodeEditorTaskRecord
  action: AiCodeEditorTaskAction
  notes?: string | null
  actedAt?: string
}): AiCodeEditorTaskRecord {
  const actedAt = input.actedAt ?? new Date().toISOString()
  const metadata = {
    ...input.task.metadata,
  }

  if (input.notes?.trim()) {
    metadata.latest_action_notes = input.notes.trim()
  }

  switch (input.action) {
    case "approve":
      if (!["ready_for_review", "needs_adjustment"].includes(input.task.status)) {
        throw new Error("Somente tasks prontas para revisao ou ajuste podem ser aprovadas.")
      }
      return {
        ...input.task,
        status: "approved",
        approved_at: actedAt,
        metadata: {
          ...metadata,
          publish_gate:
            input.task.sensitive_change || input.task.requires_explicit_publish_confirmation
              ? "explicit_admin_confirmation_required"
              : "manual_publish_required",
        },
      }
    case "reject":
      if (["rejected", "rolled_back"].includes(input.task.status)) {
        throw new Error("Esta task ja foi encerrada e nao pode ser rejeitada novamente.")
      }
      return {
        ...input.task,
        status: "rejected",
        metadata,
      }
    case "request_adjustment":
      if (!["ready_for_review", "approved"].includes(input.task.status)) {
        throw new Error("Somente tasks em revisao ou aprovadas podem voltar para ajuste.")
      }
      return {
        ...input.task,
        status: "needs_adjustment",
        metadata: {
          ...metadata,
          adjustment_requested_at: actedAt,
        },
      }
    case "rollback":
      if (!["approved", "published"].includes(input.task.status)) {
        throw new Error("Rollback so pode ser registado para tasks aprovadas ou publicadas.")
      }
      return {
        ...input.task,
        status: "rollback_ready_for_review",
        metadata: {
          ...metadata,
          rollback_source: input.task.published_at ? "published_state" : "approved_state",
          rollback_requested_at: actedAt,
        },
      }
    default:
      throw new Error("Acao de task invalida.")
  }
}

export function validatePublicationReadiness(task: AiCodeEditorPublicationReadiness) {
  if (!task.branch_name?.trim()) {
    throw new Error("Nao e possivel aprovar a task sem branch real.")
  }
  if (!task.commit_sha?.trim()) {
    throw new Error("Nao e possivel aprovar a task sem commit real.")
  }
  if (!task.pull_request_url?.trim()) {
    throw new Error("Nao e possivel aprovar a task sem Pull Request real.")
  }
  if (!task.has_diff) {
    throw new Error("Nao e possivel aprovar a task sem diff real persistido.")
  }
  if (task.test_status === "failed" || task.build_status === "failed") {
    throw new Error("Nao e possivel aprovar a task enquanto testes ou build falharem.")
  }
  if (task.test_status === "pending" || task.build_status === "pending") {
    throw new Error("Ainda existem validacoes em processamento. Atualiza o status da task antes de aprovar.")
  }
  if (task.preview_status === "failed") {
    throw new Error("Nao e possivel aprovar a task porque o preview falhou.")
  }
  if (task.preview_status === "pending") {
    throw new Error("Preview ainda em processamento. Atualiza o preview antes de aprovar.")
  }
}
