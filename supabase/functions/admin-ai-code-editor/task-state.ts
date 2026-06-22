import type { AiCodeEditorPlan } from "./planner.ts"

export type AiCodeEditorTaskStatus =
  | "queued"
  | "planning"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "needs_adjustment"
  | "published"
  | "rolled_back"
  | "failed"

export type AiCodeEditorPreviewStatus = "not_requested" | "pending" | "ready" | "failed"
export type AiCodeEditorExecutionStatus = "not_requested" | "pending" | "passed" | "failed"

export interface AiCodeEditorConfigValue {
  enabled: boolean
  make_default: boolean
  legacy_editor_fallback_enabled: boolean
  worker_mode: "simulated" | "github_worker"
  github_repository: string
  vercel_project_name: string
  auto_run_tests: boolean
  auto_run_build: boolean
  request_preview_deploy: boolean
  require_explicit_publish_confirmation: boolean
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
        status: "rolled_back",
        rolled_back_at: actedAt,
        metadata: {
          ...metadata,
          rollback_source: input.task.published_at ? "published_state" : "approved_state",
        },
      }
    default:
      throw new Error("Acao de task invalida.")
  }
}
