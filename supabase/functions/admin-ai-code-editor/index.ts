import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, notFound, unprocessable } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { buildAiCodeEditorPlan } from "./planner.ts"
import {
  buildInitialTaskState,
  transitionTaskRecord,
  type AiCodeEditorConfigValue,
} from "./task-state.ts"

type Action =
  | "get_config"
  | "update_config"
  | "list_tasks"
  | "get_task"
  | "create_task"
  | "approve_task"
  | "reject_task"
  | "request_adjustment"
  | "rollback_task"

interface Body {
  action: Action
  taskId?: string
  prompt?: string
  notes?: string | null
  configValue?: Partial<AiCodeEditorConfigValue>
}

const CONFIG_KEY = "ai_code_editor_config"
const CONFIG_DESCRIPTION = "Configuracao do Editor IA Irrestrito / Admin AI Code Editor."
const configSelect = "config_key,config_value,description,is_public,updated_at"
const taskSelect = [
  "id",
  "requested_by",
  "approved_by",
  "prompt",
  "normalized_prompt",
  "title",
  "summary",
  "status",
  "scope_classification",
  "risk_level",
  "worker_mode",
  "branch_name",
  "commit_message",
  "commit_sha",
  "pull_request_url",
  "preview_url",
  "preview_status",
  "test_status",
  "build_status",
  "files_analyzed",
  "files_planned",
  "plan_json",
  "result_summary",
  "sensitive_change",
  "sensitive_reasons",
  "requires_explicit_publish_confirmation",
  "published_at",
  "rolled_back_at",
  "approved_at",
  "metadata",
  "created_at",
  "updated_at",
].join(",")
const taskDetailSelect = [
  taskSelect,
  "file_changes:ai_code_editor_file_changes(id,task_id,file_path,change_type,status,rationale,diff_preview,metadata,created_at,updated_at)",
  "events:ai_code_editor_events(id,task_id,actor_user_id,event_type,message,metadata,created_at)",
  "deploys:ai_code_editor_deploys(id,task_id,provider,environment,deployment_id,deployment_url,status,metadata,created_at,updated_at)",
].join(",")

const DEFAULT_CONFIG: AiCodeEditorConfigValue = {
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

function normalizeText(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeWorkerMode(value: unknown) {
  return value === "github_worker" ? "github_worker" : "simulated"
}

function normalizeConfigRow(row?: Partial<{
  config_key: string
  config_value: Record<string, unknown>
  description: string | null
  is_public: boolean
  updated_at: string | null
}> | null) {
  const rawValue = row?.config_value && typeof row.config_value === "object"
    ? row.config_value
    : {}

  return {
    config_key: row?.config_key ?? CONFIG_KEY,
    config_value: {
      enabled: normalizeBoolean(rawValue.enabled, DEFAULT_CONFIG.enabled),
      make_default: normalizeBoolean(rawValue.make_default, DEFAULT_CONFIG.make_default),
      legacy_editor_fallback_enabled: normalizeBoolean(
        rawValue.legacy_editor_fallback_enabled,
        DEFAULT_CONFIG.legacy_editor_fallback_enabled,
      ),
      worker_mode: normalizeWorkerMode(rawValue.worker_mode),
      github_repository: normalizeText(rawValue.github_repository, DEFAULT_CONFIG.github_repository),
      vercel_project_name: normalizeText(rawValue.vercel_project_name, DEFAULT_CONFIG.vercel_project_name),
      auto_run_tests: normalizeBoolean(rawValue.auto_run_tests, DEFAULT_CONFIG.auto_run_tests),
      auto_run_build: normalizeBoolean(rawValue.auto_run_build, DEFAULT_CONFIG.auto_run_build),
      request_preview_deploy: normalizeBoolean(rawValue.request_preview_deploy, DEFAULT_CONFIG.request_preview_deploy),
      require_explicit_publish_confirmation: normalizeBoolean(
        rawValue.require_explicit_publish_confirmation,
        DEFAULT_CONFIG.require_explicit_publish_confirmation,
      ),
    },
    description: row?.description ?? CONFIG_DESCRIPTION,
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeConfigInput(value?: Partial<AiCodeEditorConfigValue>) {
  return normalizeConfigRow({
    config_key: CONFIG_KEY,
    config_value: value ?? DEFAULT_CONFIG,
    description: CONFIG_DESCRIPTION,
    is_public: false,
  })
}

async function readConfig(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select(configSelect)
    .eq("config_key", CONFIG_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeConfigRow(data as Record<string, unknown> | null)
}

async function writeConfig(
  serviceClient: ReturnType<typeof createServiceClient>,
  value?: Partial<AiCodeEditorConfigValue>,
) {
  const payload = normalizeConfigInput(value)
  const { data, error } = await serviceClient
    .from("site_config")
    .upsert(
      {
        config_key: CONFIG_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: false,
      },
      { onConflict: "config_key" },
    )
    .select(configSelect)
    .single()

  if (error) {
    throw error
  }

  return normalizeConfigRow(data as Record<string, unknown>)
}

async function appendTaskEvent(input: {
  serviceClient: ReturnType<typeof createServiceClient>
  taskId: string
  actorUserId: string | null
  eventType: string
  message: string
  metadata?: Record<string, unknown>
}) {
  const { error } = await input.serviceClient.from("ai_code_editor_events").insert({
    task_id: input.taskId,
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    message: input.message,
    metadata: input.metadata ?? {},
  })

  if (error) {
    throw error
  }
}

async function readTask(
  serviceClient: ReturnType<typeof createServiceClient>,
  taskId: string,
  detailed = false,
) {
  const { data, error } = await serviceClient
    .from("ai_code_editor_tasks")
    .select(detailed ? taskDetailSelect : taskSelect)
    .eq("id", taskId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Task do Editor IA Irrestrito nao encontrada")
  }

  return data
}

async function updateTaskRow(
  serviceClient: ReturnType<typeof createServiceClient>,
  taskId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await serviceClient
    .from("ai_code_editor_tasks")
    .update(patch)
    .eq("id", taskId)

  if (error) {
    throw error
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    const context = await requireAdmin(req)
    const serviceClient = createServiceClient()
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<Body>(req)

    if (body.action === "get_config") {
      const config = await readConfig(serviceClient)
      return jsonResponse({ success: true, config })
    }

    if (body.action === "update_config") {
      const config = await writeConfig(serviceClient, body.configValue)

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_code_editor_config_updated",
        entityType: "site_config",
        entityId: CONFIG_KEY,
        metadata: {
          config_key: CONFIG_KEY,
          worker_mode: config.config_value.worker_mode,
          enabled: config.config_value.enabled,
          make_default: config.config_value.make_default,
          legacy_editor_fallback_enabled: config.config_value.legacy_editor_fallback_enabled,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, config })
    }

    if (body.action === "list_tasks") {
      const { data, error } = await serviceClient
        .from("ai_code_editor_tasks")
        .select(taskSelect)
        .order("updated_at", { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }

      return jsonResponse({ success: true, tasks: data ?? [] })
    }

    if (body.action === "get_task") {
      const taskId = normalizeText(body.taskId)
      if (!taskId) {
        throw badRequest("taskId obrigatorio")
      }

      const task = await readTask(serviceClient, taskId, true)
      return jsonResponse({ success: true, task })
    }

    if (body.action === "create_task") {
      const prompt = normalizeText(body.prompt)
      if (!prompt) {
        throw badRequest("prompt obrigatorio")
      }

      const config = await readConfig(serviceClient)
      if (!config.config_value.enabled) {
        throw unprocessable("O Editor IA Irrestrito esta desativado no momento.")
      }

      const plan = buildAiCodeEditorPlan({
        prompt,
        workerMode: config.config_value.worker_mode,
      })
      const initialState = buildInitialTaskState({
        config: config.config_value,
        plan,
      })
      const planJson = {
        steps: plan.steps,
        files_analyzed: plan.filesAnalyzed,
        files_planned: plan.filesPlanned,
        worker_mode: plan.workerMode,
        branch_name: plan.branchName,
        commit_message: plan.commitMessage,
      }

      const { data: insertedTask, error: insertTaskError } = await serviceClient
        .from("ai_code_editor_tasks")
        .insert({
          requested_by: context.user.id,
          prompt,
          normalized_prompt: plan.normalizedPrompt,
          title: plan.title,
          summary: plan.summary,
          status: initialState.status,
          scope_classification: plan.scopeClassification,
          risk_level: plan.riskLevel,
          worker_mode: plan.workerMode,
          branch_name: plan.branchName,
          commit_message: plan.commitMessage,
          preview_status: initialState.previewStatus,
          test_status: initialState.testStatus,
          build_status: initialState.buildStatus,
          files_analyzed: plan.filesAnalyzed,
          files_planned: plan.filesPlanned,
          plan_json: planJson,
          result_summary: initialState.resultSummary,
          sensitive_change: plan.sensitiveChange,
          sensitive_reasons: plan.sensitiveReasons,
          requires_explicit_publish_confirmation:
            plan.requiresExplicitPublishConfirmation || config.config_value.require_explicit_publish_confirmation,
          metadata: {
            ...initialState.metadata,
            requested_by_email: context.profile.email,
            transition_mode: config.config_value.make_default ? "new_editor_default" : "parallel_with_legacy",
          },
        })
        .select(taskSelect)
        .single()

      if (insertTaskError) {
        throw insertTaskError
      }

      const taskId = String((insertedTask as { id: string }).id)

      const fileChangeRows = plan.fileChanges.map((change) => ({
        task_id: taskId,
        file_path: change.file_path,
        change_type: change.change_type,
        status: "planned",
        rationale: change.rationale,
        diff_preview: change.diff_preview,
        metadata: {
          worker_mode: plan.workerMode,
        },
      }))

      if (fileChangeRows.length > 0) {
        const { error: fileChangesError } = await serviceClient.from("ai_code_editor_file_changes").insert(fileChangeRows)
        if (fileChangesError) {
          throw fileChangesError
        }
      }

      const { error: deployError } = await serviceClient.from("ai_code_editor_deploys").insert({
        task_id: taskId,
        provider: "vercel",
        environment: "preview",
        deployment_id: null,
        deployment_url: null,
        status: initialState.previewStatus === "pending" ? "pending" : "not_requested",
        metadata: {
          project_name: config.config_value.vercel_project_name,
          preview_requested: config.config_value.request_preview_deploy,
          worker_mode: config.config_value.worker_mode,
        },
      })

      if (deployError) {
        throw deployError
      }

      await appendTaskEvent({
        serviceClient,
        taskId,
        actorUserId: context.user.id,
        eventType: "task_created",
        message: "Task criada e pronta para revisao administrativa.",
        metadata: {
          worker_mode: plan.workerMode,
          branch_name: plan.branchName,
          sensitive_change: plan.sensitiveChange,
        },
      })

      await appendTaskEvent({
        serviceClient,
        taskId,
        actorUserId: context.user.id,
        eventType: "plan_generated",
        message:
          plan.workerMode === "simulated"
            ? "Plano gerado em modo simulado com branch, diff e preview como contrato operacional."
            : "Plano gerado para execucao integrada no repositorio.",
        metadata: {
          files_planned: plan.filesPlanned,
          step_count: plan.steps.length,
        },
      })

      if (plan.sensitiveChange) {
        await appendTaskEvent({
          serviceClient,
          taskId,
          actorUserId: context.user.id,
          eventType: "sensitive_change_detected",
          message: "A task envolve area sensivel e exigira confirmacao explicita antes de publicar.",
          metadata: {
            sensitive_reasons: plan.sensitiveReasons,
          },
        })
      }

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_code_editor_task_created",
        entityType: "ai_code_editor_task",
        entityId: taskId,
        metadata: {
          prompt,
          scope_classification: plan.scopeClassification,
          risk_level: plan.riskLevel,
          worker_mode: plan.workerMode,
          files_planned: plan.filesPlanned,
        },
        ...auditMeta,
      })

      const task = await readTask(serviceClient, taskId, true)
      return jsonResponse({ success: true, task })
    }

    if (
      body.action === "approve_task" ||
      body.action === "reject_task" ||
      body.action === "request_adjustment" ||
      body.action === "rollback_task"
    ) {
      const taskId = normalizeText(body.taskId)
      if (!taskId) {
        throw badRequest("taskId obrigatorio")
      }

      const currentTask = await readTask(serviceClient, taskId, false) as Record<string, unknown>
      const nextTask = transitionTaskRecord({
        task: {
          id: String(currentTask.id),
          status: String(currentTask.status) as never,
          preview_status: String(currentTask.preview_status) as never,
          test_status: String(currentTask.test_status) as never,
          build_status: String(currentTask.build_status) as never,
          sensitive_change: Boolean(currentTask.sensitive_change),
          requires_explicit_publish_confirmation: Boolean(currentTask.requires_explicit_publish_confirmation),
          worker_mode: normalizeWorkerMode(currentTask.worker_mode),
          approved_at: currentTask.approved_at ? String(currentTask.approved_at) : null,
          published_at: currentTask.published_at ? String(currentTask.published_at) : null,
          rolled_back_at: currentTask.rolled_back_at ? String(currentTask.rolled_back_at) : null,
          metadata:
            currentTask.metadata && typeof currentTask.metadata === "object"
              ? (currentTask.metadata as Record<string, unknown>)
              : {},
        },
        action:
          body.action === "approve_task"
            ? "approve"
            : body.action === "reject_task"
              ? "reject"
              : body.action === "request_adjustment"
                ? "request_adjustment"
                : "rollback",
        notes: body.notes ?? null,
      })

      await updateTaskRow(serviceClient, taskId, {
        status: nextTask.status,
        approved_by: body.action === "approve_task" ? context.user.id : currentTask.approved_by ?? null,
        approved_at: nextTask.approved_at,
        rolled_back_at: nextTask.rolled_back_at,
        metadata: nextTask.metadata,
      })

      if (body.action === "rollback_task") {
        const { error } = await serviceClient
          .from("ai_code_editor_deploys")
          .update({ status: "rolled_back", metadata: nextTask.metadata })
          .eq("task_id", taskId)
        if (error) {
          throw error
        }
      }

      const actionMap = {
        approve_task: {
          eventType: "task_approved",
          message: "Task aprovada para a proxima etapa de publicacao manual.",
          auditAction: "admin.ai_code_editor_task_approved",
        },
        reject_task: {
          eventType: "task_rejected",
          message: "Task rejeitada pelo admin.",
          auditAction: "admin.ai_code_editor_task_rejected",
        },
        request_adjustment: {
          eventType: "task_adjustment_requested",
          message: "Task devolvida para ajuste antes de qualquer publicacao.",
          auditAction: "admin.ai_code_editor_task_adjustment_requested",
        },
        rollback_task: {
          eventType: "task_roll_back_requested",
          message: "Rollback administrativo registado para esta task.",
          auditAction: "admin.ai_code_editor_task_rollback_requested",
        },
      } as const

      const mapped = actionMap[body.action]
      await appendTaskEvent({
        serviceClient,
        taskId,
        actorUserId: context.user.id,
        eventType: mapped.eventType,
        message: mapped.message,
        metadata: {
          notes: normalizeText(body.notes),
          next_status: nextTask.status,
        },
      })

      await writeAuditLog(serviceClient, context, {
        action: mapped.auditAction,
        entityType: "ai_code_editor_task",
        entityId: taskId,
        metadata: {
          next_status: nextTask.status,
          notes: normalizeText(body.notes),
        },
        ...auditMeta,
      })

      const task = await readTask(serviceClient, taskId, true)
      logInfo("Admin AI code editor task updated", {
        request_id: requestId,
        user_id: context.user.id,
        task_id: taskId,
        action: body.action,
        next_status: nextTask.status,
      })
      return jsonResponse({ success: true, task })
    }

    throw badRequest("action invalida")
  } catch (error) {
    logError("Admin AI code editor failed", {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse(error, requestId)
  }
})
