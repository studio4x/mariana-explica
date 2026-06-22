import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, notFound, unprocessable } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { buildAiCodeEditorPlan, type AiCodeEditorPlan } from "./planner.ts"
import {
  AiPatchGenerationError,
  generateTaskFileChanges,
  type AiPatchProviderAttempt,
  type AiPatchProviderConfig,
} from "./ai-patch-generator.ts"
import {
  buildRollbackPullRequestBody,
  buildPullRequestBody,
  GitHubRepositoryClient,
  inferFileLanguage,
  readGitHubSecrets,
} from "./github-worker.ts"
import { fetchVercelPreviewDeployment, readVercelSecrets } from "./vercel-preview.ts"
import {
  buildInitialTaskState,
  transitionTaskRecord,
  type AiCodeEditorConfigValue,
  type AiCodeEditorGenerationMode,
  type AiCodeEditorProvider,
  type AiCodeEditorProviderHealth,
} from "./task-state.ts"
import { ensureValidConfigPatch, mergeConfigValue } from "./config-utils.ts"

type Action =
  | "get_config"
  | "update_config"
  | "list_tasks"
  | "get_task"
  | "create_task"
  | "generate_task_plan"
  | "start_task_execution"
  | "create_task_branch"
  | "apply_task_patch"
  | "commit_task_changes"
  | "open_task_pull_request"
  | "refresh_task_status"
  | "refresh_task_preview"
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

type ServiceClient = ReturnType<typeof createServiceClient>

type TaskRow = Record<string, unknown>

type DetailedTaskRow = TaskRow & {
  file_changes?: Array<Record<string, unknown>>
  events?: Array<Record<string, unknown>>
  deploys?: Array<Record<string, unknown>>
}

type PlannedFileChangeRow = {
  task_id: string
  file_path: string
  change_type: string
  status: string
  rationale: string
  diff_preview: string
  metadata: Record<string, unknown>
}

const CONFIG_KEY = "ai_code_editor_config"
const CONFIG_DESCRIPTION = "Configuracao do Editor IA Irrestrito / Admin AI Code Editor."
const GEMINI_SECRET_NAME = "mariana_explica_ai_gemini_api_key"
const OPENAI_SECRET_NAME = "mariana_explica_ai_openai_api_key"
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
const DEFAULT_PROVIDER_HEALTH: Record<AiCodeEditorProvider, AiCodeEditorProviderHealth> = {
  openai: {
    configured: false,
    model: DEFAULT_OPENAI_MODEL,
    status: "not_configured",
    last_error: null,
    last_error_at: null,
  },
  gemini: {
    configured: false,
    model: DEFAULT_GEMINI_MODEL,
    status: "not_configured",
    last_error: null,
    last_error_at: null,
  },
}
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
  "default_branch",
  "commit_message",
  "commit_sha",
  "pull_request_number",
  "pull_request_url",
  "pull_request_status",
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
  "execution_error",
  "last_execution_at",
  "merged_at",
  "metadata",
  "created_at",
  "updated_at",
].join(",")
const taskDetailSelect = [
  taskSelect,
  "file_changes:ai_code_editor_file_changes(id,task_id,file_path,previous_file_path,change_type,status,rationale,summary,diff_preview,diff_patch,before_sha,after_sha,language,risk_level,metadata,created_at,updated_at)",
  "events:ai_code_editor_events(id,task_id,actor_user_id,event_type,message,metadata,created_at)",
  "deploys:ai_code_editor_deploys(id,task_id,provider,environment,deployment_id,deployment_url,status,git_branch,commit_sha,ready_at,error_message,metadata,created_at,updated_at)",
].join(",")

const DEFAULT_CONFIG: AiCodeEditorConfigValue = {
  enabled: false,
  make_default: false,
  legacy_editor_fallback_enabled: true,
  worker_mode: "simulated",
  github_repository: "studio4x/mariana-explica",
  vercel_project_name: "mariana-explica",
  primary_provider: "openai",
  secondary_provider: "gemini",
  primary_model: DEFAULT_OPENAI_MODEL,
  secondary_model: DEFAULT_GEMINI_MODEL,
  auto_run_tests: true,
  auto_run_build: true,
  request_preview_deploy: true,
  require_explicit_publish_confirmation: true,
  generation_mode: "deterministic_only",
  provider_statuses: DEFAULT_PROVIDER_HEALTH,
  github_configured: false,
  vercel_configured: false,
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

function normalizeProvider(value: unknown, fallback: AiCodeEditorProvider) {
  return value === "gemini" ? "gemini" : value === "openai" ? "openai" : fallback
}

function normalizeGenerationMode(value: unknown, fallback: AiCodeEditorGenerationMode) {
  return value === "ai_enabled" || value === "blocked_provider_quota" || value === "deterministic_only"
    ? value
    : fallback
}

function normalizeProviderHealth(
  value: unknown,
  fallback: AiCodeEditorProviderHealth,
): AiCodeEditorProviderHealth {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const status = String(record.status ?? "").trim()

  return {
    configured: typeof record.configured === "boolean" ? record.configured : fallback.configured,
    model: normalizeText(record.model, fallback.model),
    status:
      status === "ready" || status === "quota_exceeded" || status === "error" || status === "not_configured"
        ? status
        : fallback.status,
    last_error: normalizeText(record.last_error) || null,
    last_error_at: normalizeText(record.last_error_at) || null,
  }
}

function computeGenerationMode(config: Pick<AiCodeEditorConfigValue, "provider_statuses">) {
  const statuses = Object.values(config.provider_statuses ?? {})
  const configuredStatuses = statuses.filter((item) => item.configured)
  if (configuredStatuses.length === 0) {
    return "deterministic_only" satisfies AiCodeEditorGenerationMode
  }
  if (configuredStatuses.every((item) => item.status === "quota_exceeded")) {
    return "blocked_provider_quota" satisfies AiCodeEditorGenerationMode
  }
  return "ai_enabled" satisfies AiCodeEditorGenerationMode
}

function normalizeTaskMetadata(task: TaskRow) {
  return task.metadata && typeof task.metadata === "object"
    ? task.metadata as Record<string, unknown>
    : {}
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
  const rawProviderStatuses =
    rawValue.provider_statuses && typeof rawValue.provider_statuses === "object"
      ? rawValue.provider_statuses as Record<string, unknown>
      : {}
  const primaryProvider = normalizeProvider(rawValue.primary_provider, DEFAULT_CONFIG.primary_provider)
  const secondaryProvider = normalizeProvider(rawValue.secondary_provider, DEFAULT_CONFIG.secondary_provider)
  const providerStatuses = {
    openai: normalizeProviderHealth(rawProviderStatuses.openai, {
      ...DEFAULT_PROVIDER_HEALTH.openai,
      model: primaryProvider === "openai"
        ? normalizeText(rawValue.primary_model, DEFAULT_OPENAI_MODEL)
        : secondaryProvider === "openai"
          ? normalizeText(rawValue.secondary_model, DEFAULT_OPENAI_MODEL)
          : DEFAULT_OPENAI_MODEL,
    }),
    gemini: normalizeProviderHealth(rawProviderStatuses.gemini, {
      ...DEFAULT_PROVIDER_HEALTH.gemini,
      model: primaryProvider === "gemini"
        ? normalizeText(rawValue.primary_model, DEFAULT_GEMINI_MODEL)
        : secondaryProvider === "gemini"
          ? normalizeText(rawValue.secondary_model, DEFAULT_GEMINI_MODEL)
          : DEFAULT_GEMINI_MODEL,
    }),
  } satisfies AiCodeEditorConfigValue["provider_statuses"]

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
      primary_provider: primaryProvider,
      secondary_provider: secondaryProvider,
      primary_model: normalizeText(rawValue.primary_model, DEFAULT_CONFIG.primary_model),
      secondary_model: normalizeText(rawValue.secondary_model, DEFAULT_CONFIG.secondary_model),
      auto_run_tests: normalizeBoolean(rawValue.auto_run_tests, DEFAULT_CONFIG.auto_run_tests),
      auto_run_build: normalizeBoolean(rawValue.auto_run_build, DEFAULT_CONFIG.auto_run_build),
      request_preview_deploy: normalizeBoolean(rawValue.request_preview_deploy, DEFAULT_CONFIG.request_preview_deploy),
      require_explicit_publish_confirmation: normalizeBoolean(
        rawValue.require_explicit_publish_confirmation,
        DEFAULT_CONFIG.require_explicit_publish_confirmation,
      ),
      generation_mode: normalizeGenerationMode(rawValue.generation_mode, computeGenerationMode({ provider_statuses: providerStatuses })),
      provider_statuses: providerStatuses,
      github_configured: normalizeBoolean(rawValue.github_configured, DEFAULT_CONFIG.github_configured),
      vercel_configured: normalizeBoolean(rawValue.vercel_configured, DEFAULT_CONFIG.vercel_configured),
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

async function readSecret(serviceClient: ServiceClient, name: string) {
  const { data, error } = await serviceClient.rpc("get_platform_vault_secret", {
    p_name: name,
  })

  if (error) {
    throw error
  }

  return typeof data === "string" && data.trim() ? data.trim() : null
}

async function readProviderApiKey(serviceClient: ServiceClient, provider: AiCodeEditorProvider) {
  if (provider === "openai") {
    const envValue = normalizeText(Deno.env.get("OPENAI_API_KEY"))
    if (envValue) return envValue
    return await readSecret(serviceClient, OPENAI_SECRET_NAME)
  }

  const envValue = normalizeText(Deno.env.get("GEMINI_API_KEY"))
  if (envValue) return envValue
  return await readSecret(serviceClient, GEMINI_SECRET_NAME)
}

async function enrichConfigRuntimeState(
  serviceClient: ServiceClient,
  config: ReturnType<typeof normalizeConfigRow>,
) {
  const primaryProvider = config.config_value.primary_provider
  const secondaryProvider = config.config_value.secondary_provider
  const [primaryApiKey, secondaryApiKey] = await Promise.all([
    readProviderApiKey(serviceClient, primaryProvider),
    primaryProvider === secondaryProvider ? Promise.resolve(null) : readProviderApiKey(serviceClient, secondaryProvider),
  ])

  const providerStatuses = {
    ...config.config_value.provider_statuses,
    [primaryProvider]: {
      ...config.config_value.provider_statuses[primaryProvider],
      configured: Boolean(primaryApiKey),
      model: config.config_value.primary_model,
      status: primaryApiKey
        ? config.config_value.provider_statuses[primaryProvider].status
        : "not_configured",
    },
    [secondaryProvider]: {
      ...config.config_value.provider_statuses[secondaryProvider],
      configured: primaryProvider === secondaryProvider ? Boolean(primaryApiKey) : Boolean(secondaryApiKey),
      model: config.config_value.secondary_model,
      status:
        primaryProvider === secondaryProvider
          ? (primaryApiKey ? config.config_value.provider_statuses[secondaryProvider].status : "not_configured")
          : (secondaryApiKey ? config.config_value.provider_statuses[secondaryProvider].status : "not_configured"),
    },
  } satisfies AiCodeEditorConfigValue["provider_statuses"]

  return {
    ...config,
    config_value: {
      ...config.config_value,
      provider_statuses: providerStatuses,
      generation_mode: computeGenerationMode({ provider_statuses: providerStatuses }),
      github_configured: (() => {
        try {
          readGitHubSecrets(config.config_value.github_repository)
          return true
        } catch {
          return false
        }
      })(),
      vercel_configured: (() => {
        try {
          readVercelSecrets()
          return true
        } catch {
          return false
        }
      })(),
    },
  }
}

async function readConfig(serviceClient: ServiceClient) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select(configSelect)
    .eq("config_key", CONFIG_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return await enrichConfigRuntimeState(
    serviceClient,
    normalizeConfigRow(data as Record<string, unknown> | null),
  )
}

async function writeConfig(
  serviceClient: ServiceClient,
  value?: Partial<AiCodeEditorConfigValue>,
) {
  const current = await readConfig(serviceClient)
  const payload = normalizeConfigInput(mergeConfigValue(current.config_value, value))
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

  return await enrichConfigRuntimeState(
    serviceClient,
    normalizeConfigRow(data as Record<string, unknown>),
  )
}

async function updateConfigRuntimeDiagnostics(input: {
  serviceClient: ServiceClient
  patch: Partial<AiCodeEditorConfigValue>
}) {
  const current = await readConfig(input.serviceClient)
  const mergedValue = {
    ...current.config_value,
    ...input.patch,
    provider_statuses: {
      ...current.config_value.provider_statuses,
      ...(input.patch.provider_statuses ?? {}),
    },
  } satisfies AiCodeEditorConfigValue

  return await writeConfig(input.serviceClient, mergedValue)
}

async function appendTaskEvent(input: {
  serviceClient: ServiceClient
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
  serviceClient: ServiceClient,
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

  return data as DetailedTaskRow
}

async function updateTaskRow(
  serviceClient: ServiceClient,
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

async function replaceFileChanges(
  serviceClient: ServiceClient,
  taskId: string,
  rows: Array<Record<string, unknown>>,
) {
  const { error: deleteError } = await serviceClient
    .from("ai_code_editor_file_changes")
    .delete()
    .eq("task_id", taskId)

  if (deleteError) {
    throw deleteError
  }

  if (rows.length === 0) return

  const { error: insertError } = await serviceClient
    .from("ai_code_editor_file_changes")
    .insert(rows)

  if (insertError) {
    throw insertError
  }
}

async function upsertDeployRow(
  serviceClient: ServiceClient,
  taskId: string,
  patch: Record<string, unknown>,
) {
  const { data: existing, error: existingError } = await serviceClient
    .from("ai_code_editor_deploys")
    .select("id")
    .eq("task_id", taskId)
    .eq("provider", "vercel")
    .eq("environment", "preview")
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existing?.id) {
    const { error } = await serviceClient
      .from("ai_code_editor_deploys")
      .update(patch)
      .eq("id", String(existing.id))
    if (error) throw error
    return
  }

  const { error } = await serviceClient.from("ai_code_editor_deploys").insert({
    task_id: taskId,
    provider: "vercel",
    environment: "preview",
    ...patch,
  })

  if (error) {
    throw error
  }
}

function buildPlanJson(plan: AiCodeEditorPlan) {
  return {
    steps: plan.steps,
    files_analyzed: plan.filesAnalyzed,
    files_planned: plan.filesPlanned,
    worker_mode: plan.workerMode,
    branch_name: plan.branchName,
    commit_message: plan.commitMessage,
    summary: plan.summary,
  }
}

function buildPlannedFileChangeRows(taskId: string, plan: AiCodeEditorPlan): PlannedFileChangeRow[] {
  return plan.fileChanges.map((change) => ({
    task_id: taskId,
    file_path: change.file_path,
    change_type: change.change_type,
    status: "planned",
    rationale: change.rationale,
    diff_preview: change.diff_preview,
    metadata: {
      worker_mode: plan.workerMode,
      source: "planner",
    },
  }))
}

async function generateTaskPlanForRow(input: {
  serviceClient: ServiceClient
  taskId: string
  prompt: string
  config: AiCodeEditorConfigValue
}) {
  const plan = buildAiCodeEditorPlan({
    prompt: input.prompt,
    workerMode: input.config.worker_mode,
  })
  const initialState = buildInitialTaskState({
    config: input.config,
    plan,
  })

  await updateTaskRow(input.serviceClient, input.taskId, {
    normalized_prompt: plan.normalizedPrompt,
    title: plan.title,
    summary: plan.summary,
    scope_classification: plan.scopeClassification,
    risk_level: plan.riskLevel,
    worker_mode: plan.workerMode,
    branch_name: plan.branchName,
    commit_message: plan.commitMessage,
    files_analyzed: plan.filesAnalyzed,
    files_planned: plan.filesPlanned,
    plan_json: buildPlanJson(plan),
    result_summary: initialState.resultSummary,
    sensitive_change: plan.sensitiveChange,
    sensitive_reasons: plan.sensitiveReasons,
    requires_explicit_publish_confirmation:
      plan.requiresExplicitPublishConfirmation || input.config.require_explicit_publish_confirmation,
    metadata: {
      ...initialState.metadata,
      requested_prompt: input.prompt,
    },
  })

  await replaceFileChanges(input.serviceClient, input.taskId, buildPlannedFileChangeRows(input.taskId, plan))
  return plan
}

async function resolveAiPatchProviders(
  serviceClient: ServiceClient,
  config: AiCodeEditorConfigValue,
): Promise<AiPatchProviderConfig[]> {
  const providerSlots = [
    {
      provider: config.primary_provider,
      model: normalizeText(config.primary_model, config.primary_provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL),
    },
    {
      provider: config.secondary_provider,
      model: normalizeText(config.secondary_model, config.secondary_provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL),
    },
  ] satisfies Array<{ provider: AiCodeEditorProvider; model: string }>

  const resolved = await Promise.all(
    providerSlots.map(async (slot) => ({
      provider: slot.provider,
      model: slot.model,
      apiKey: await readProviderApiKey(serviceClient, slot.provider),
    })),
  )

  return resolved
    .filter((item) => Boolean(item.apiKey))
    .filter((item, index, items) =>
      items.findIndex((candidate) =>
        candidate.provider === item.provider &&
        candidate.model === item.model &&
        candidate.apiKey === item.apiKey
      ) === index
    )
    .map((item) => ({
      provider: item.provider,
      model: item.model,
      apiKey: String(item.apiKey),
    }))
}

function buildProviderStatusPatchFromAttempts(
  current: AiCodeEditorConfigValue["provider_statuses"],
  attempts: AiPatchProviderAttempt[],
) {
  const next = {
    ...current,
  }

  for (const attempt of attempts) {
    next[attempt.provider] = {
      ...current[attempt.provider],
      status: attempt.failureType === "quota" ? "quota_exceeded" : "error",
      last_error: attempt.message,
      last_error_at: attempt.occurredAt,
    }
  }

  return next
}

function mapWorkflowStatusToExecutionStatus(
  current: string,
  workflowStatus: string,
  workflowConclusion: string | null,
) {
  if (workflowStatus === "completed") {
    if (workflowConclusion === "success" || workflowConclusion === "neutral" || workflowConclusion === "skipped") {
      return "passed"
    }
    return "failed"
  }

  if (workflowStatus === "queued" || workflowStatus === "in_progress") {
    return "pending"
  }

  return current || "not_requested"
}

function parsePullRequestNumber(task: TaskRow) {
  const directNumber = Number(task.pull_request_number ?? 0)
  if (Number.isFinite(directNumber) && directNumber > 0) {
    return directNumber
  }

  const url = normalizeText(task.pull_request_url)
  const match = url.match(/\/pull\/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function ensureTaskHasRealDiff(task: DetailedTaskRow) {
  const fileChanges = Array.isArray(task.file_changes) ? task.file_changes : []
  const hasPatch = fileChanges.some((change) => normalizeText(change.diff_patch))
  if (!hasPatch) {
    throw unprocessable("Nao e possivel aprovar a task sem diff real persistido.")
  }
}

function isRollbackSmokeTask(task: DetailedTaskRow) {
  const filesPlanned = Array.isArray(task.files_planned) ? task.files_planned : []
  return filesPlanned.length === 1 && filesPlanned[0] === "docs/AI_CODE_EDITOR_ROLLBACK_SMOKE.md"
}

function ensureTaskReadyForPublication(task: DetailedTaskRow) {
  if (!normalizeText(task.branch_name)) {
    throw unprocessable("Nao e possivel aprovar a task sem branch real.")
  }
  if (!normalizeText(task.commit_sha)) {
    throw unprocessable("Nao e possivel aprovar a task sem commit real.")
  }
  if (!normalizeText(task.pull_request_url) || parsePullRequestNumber(task) <= 0) {
    throw unprocessable("Nao e possivel aprovar a task sem Pull Request real.")
  }
  ensureTaskHasRealDiff(task)

  if (isRollbackSmokeTask(task)) {
    return
  }

  if (normalizeText(task.build_status) === "failed" || normalizeText(task.test_status) === "failed") {
    throw unprocessable("Nao e possivel aprovar a task enquanto testes ou build falharem.")
  }

  if (normalizeText(task.build_status) === "pending" || normalizeText(task.test_status) === "pending") {
    throw unprocessable("Ainda existem validacoes em processamento. Atualiza o status da task antes de aprovar.")
  }

  if (normalizeText(task.preview_status) === "failed") {
    throw unprocessable("Nao e possivel aprovar a task porque o preview falhou.")
  }

  if (normalizeText(task.preview_status) === "pending") {
    throw unprocessable("Preview ainda em processamento. Atualiza o preview antes de aprovar.")
  }
}

async function createTaskBranch(input: {
  serviceClient: ServiceClient
  task: TaskRow
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  const secrets = readGitHubSecrets(input.config.github_repository)
  const github = new GitHubRepositoryClient(secrets)
  const repository = await github.getRepositoryInfo()
  const defaultBranchInfo = await github.getBranch(repository.defaultBranch)

  if (!defaultBranchInfo?.sha) {
    throw new Error("Nao foi possivel determinar a branch base do repositorio no GitHub.")
  }

  const branchName = normalizeText(input.task.branch_name)
  const branch = await github.ensureBranch(branchName, defaultBranchInfo.sha)

  await updateTaskRow(input.serviceClient, String(input.task.id), {
    branch_name: branchName,
    default_branch: repository.defaultBranch,
    metadata: {
      ...normalizeTaskMetadata(input.task),
      github_repository: `${secrets.owner}/${secrets.repo}`,
      github_branch_ref: branch.ref,
      github_repository_url: repository.htmlUrl,
    },
  })

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: String(input.task.id),
    actorUserId: input.actorUserId,
    eventType: "branch_created",
    message: `Branch real preparada no GitHub: ${branchName}.`,
    metadata: {
      default_branch: repository.defaultBranch,
      branch_ref: branch.ref,
    },
  })

  return {
    github,
    repository,
    branchName,
  }
}

async function applyTaskPatch(input: {
  serviceClient: ServiceClient
  task: TaskRow
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  const currentTask = input.task
  const branchContext = await createTaskBranch(input)
  const aiProviders = await resolveAiPatchProviders(input.serviceClient, input.config)
  const plannedFiles = Array.isArray(currentTask.files_planned)
    ? currentTask.files_planned.map((file) => normalizeText(file)).filter(Boolean)
    : []

  if (plannedFiles.length === 0) {
    throw unprocessable("Nao foi possivel localizar arquivos candidatos para esta task.")
  }

  const fileSnapshots = await Promise.all(
    plannedFiles.map(async (filePath) => {
      const snapshot = await branchContext.github.getFile(filePath, branchContext.repository.defaultBranch)
      return {
        ...snapshot,
        language: inferFileLanguage(filePath),
      }
    }),
  )

  const plan = buildAiCodeEditorPlan({
    prompt: normalizeText(currentTask.prompt),
    workerMode: input.config.worker_mode,
  })

  const generated = await generateTaskFileChanges({
    providers: aiProviders,
    prompt: normalizeText(currentTask.prompt),
    plan,
    repository: input.config.github_repository,
    files: fileSnapshots
      .filter((file) => file.exists)
      .map((file) => ({
        filePath: file.path,
        language: file.language,
        content: file.content ?? "",
      })),
  })

  if (generated.changedFiles.length === 0) {
    throw unprocessable("A IA nao encontrou um patch real confiavel para os arquivos candidatos desta task.")
  }

  const snapshotMap = new Map(fileSnapshots.map((file) => [file.path, file]))
  const generatedMap = new Map(generated.changedFiles.map((change) => [change.filePath, change]))
  let latestCommitSha = ""
  let commitCount = 0
  const appliedChanges = new Map<string, {
    beforeSha: string | null
    afterSha: string | null
  }>()

  for (const change of generated.changedFiles) {
    const currentSnapshot = snapshotMap.get(change.filePath)
    const message = commitCount === 0
      ? normalizeText(currentTask.commit_message)
      : `${normalizeText(currentTask.commit_message)} [part ${commitCount + 1}]`

    if (change.changeType === "deleted") {
      if (!currentSnapshot?.sha) {
        continue
      }

      const deletion = await branchContext.github.deleteFile({
        path: change.filePath,
        branch: branchContext.branchName,
        message,
        previousSha: currentSnapshot.sha,
      })

      latestCommitSha = deletion.commitSha ?? latestCommitSha
      commitCount += 1
      appliedChanges.set(change.filePath, {
        beforeSha: currentSnapshot.sha,
        afterSha: null,
      })
      continue
    }

    const upserted = await branchContext.github.upsertFile({
      path: change.filePath,
      branch: branchContext.branchName,
      message,
      content: change.content,
      previousSha: currentSnapshot?.sha ?? null,
    })

    latestCommitSha = upserted.commitSha ?? latestCommitSha
    commitCount += 1
    appliedChanges.set(change.filePath, {
      beforeSha: currentSnapshot?.sha ?? null,
      afterSha: upserted.fileSha ?? null,
    })
  }

  if (!latestCommitSha) {
    throw new Error("Nao foi possivel criar um commit real para esta task.")
  }

  const comparison = await branchContext.github.compare(
    branchContext.repository.defaultBranch,
    branchContext.branchName,
  )

  const fileChangeRows = comparison.files.map((file) => {
    const generatedChange = generatedMap.get(file.filePath)
    const appliedChange = appliedChanges.get(file.filePath)

    return {
      task_id: String(currentTask.id),
      file_path: file.filePath,
      previous_file_path: file.previousFilePath,
      change_type: file.changeType,
      status: "applied",
      rationale: generatedChange?.rationale ?? null,
      summary: generatedChange?.summary ?? null,
      diff_preview: file.patch,
      diff_patch: file.patch,
      before_sha: appliedChange?.beforeSha ?? null,
      after_sha: appliedChange?.afterSha ?? file.sha ?? null,
      language: generatedChange?.language ?? inferFileLanguage(file.filePath),
      risk_level: generated.riskLevel,
      metadata: {
        source: "github_compare",
        branch_name: branchContext.branchName,
        provider_used: generated.providerUsed,
        model_used: generated.modelUsed,
      },
    }
  })

  await replaceFileChanges(input.serviceClient, String(currentTask.id), fileChangeRows)
  await updateTaskRow(input.serviceClient, String(currentTask.id), {
    status: "planning",
    commit_sha: latestCommitSha,
    default_branch: branchContext.repository.defaultBranch,
    result_summary: generated.executionNotes,
    execution_error: null,
    last_execution_at: new Date().toISOString(),
    metadata: {
      ...normalizeTaskMetadata(currentTask),
      commit_count: commitCount,
      compare_url: comparison.htmlUrl,
      ai_patch_summary: generated.summary,
      ai_patch_risk_level: generated.riskLevel,
      ai_patch_provider: generated.providerUsed,
      ai_patch_model: generated.modelUsed,
    },
  })

  const nextProviderStatuses =
    generated.providerUsed === "deterministic"
      ? {
        ...input.config.provider_statuses,
      }
      : {
        ...input.config.provider_statuses,
        [generated.providerUsed]: {
          ...input.config.provider_statuses[generated.providerUsed],
          configured: true,
          model: generated.modelUsed,
          status: "ready",
          last_error: null,
          last_error_at: null,
        },
      }

  await updateConfigRuntimeDiagnostics({
    serviceClient: input.serviceClient,
    patch: {
      provider_statuses: nextProviderStatuses,
      generation_mode: computeGenerationMode({ provider_statuses: nextProviderStatuses }),
    },
  })

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: String(currentTask.id),
    actorUserId: input.actorUserId,
    eventType: "patch_applied",
    message: `Patch real aplicado na branch ${branchContext.branchName}.`,
    metadata: {
      commit_sha: latestCommitSha,
      changed_files: fileChangeRows.map((file) => file.file_path),
      provider_used: generated.providerUsed,
      model_used: generated.modelUsed,
    },
  })

  return {
    github: branchContext.github,
    repository: branchContext.repository,
    branchName: branchContext.branchName,
    commitSha: latestCommitSha,
    generatedSummary: generated.summary,
    generatedRiskLevel: generated.riskLevel,
    providerUsed: generated.providerUsed,
    modelUsed: generated.modelUsed,
  }
}

async function commitTaskChanges(input: {
  serviceClient: ServiceClient
  task: TaskRow
  actorUserId: string | null
}) {
  if (!normalizeText(input.task.commit_sha)) {
    throw unprocessable("Nenhum commit real foi criado para esta task ainda.")
  }

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: String(input.task.id),
    actorUserId: input.actorUserId,
    eventType: "commit_recorded",
    message: `Commit real registado para a task: ${normalizeText(input.task.commit_sha)}.`,
    metadata: {
      commit_sha: normalizeText(input.task.commit_sha),
    },
  })
}

async function openTaskPullRequest(input: {
  serviceClient: ServiceClient
  task: DetailedTaskRow
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  const github = new GitHubRepositoryClient(readGitHubSecrets(input.config.github_repository))
  const defaultBranch = normalizeText(input.task.default_branch) || (await github.getRepositoryInfo()).defaultBranch
  const files = Array.isArray(input.task.file_changes) ? input.task.file_changes : []
  const metadata = normalizeTaskMetadata(input.task)

  const pullRequest = await github.createPullRequest({
    title: normalizeText(input.task.title),
    body: buildPullRequestBody({
      taskId: String(input.task.id),
      prompt: normalizeText(input.task.prompt),
      summary: normalizeText(input.task.result_summary) || normalizeText(input.task.summary),
      files: files.map((file) => ({
        filePath: normalizeText(file.file_path),
        summary: normalizeText(file.summary) || normalizeText(file.rationale),
        riskLevel: normalizeText(file.risk_level),
      })),
      previewStatus: normalizeText(input.task.preview_status) || "pending",
      previewUrl: input.task.preview_url ? String(input.task.preview_url) : null,
      testStatus: normalizeText(input.task.test_status) || "pending",
      buildStatus: normalizeText(input.task.build_status) || "pending",
      risks: Array.isArray(input.task.sensitive_reasons)
        ? input.task.sensitive_reasons.map((risk) => normalizeText(risk)).filter(Boolean)
        : [],
    }),
    head: normalizeText(input.task.branch_name),
    base: defaultBranch,
  })

  await updateTaskRow(input.serviceClient, String(input.task.id), {
    pull_request_number: pullRequest.number,
    pull_request_url: pullRequest.htmlUrl,
    pull_request_status: pullRequest.state,
    status: "ready_for_review",
    metadata: {
      ...metadata,
      pull_request_api_url: pullRequest.url,
    },
  })

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: String(input.task.id),
    actorUserId: input.actorUserId,
    eventType: "pull_request_opened",
    message: `Pull Request real aberto para revisao: #${pullRequest.number}.`,
    metadata: {
      pull_request_number: pullRequest.number,
      pull_request_url: pullRequest.htmlUrl,
      base_branch: defaultBranch,
    },
  })
}

async function refreshTaskStatus(input: {
  serviceClient: ServiceClient
  task: TaskRow
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  const commitSha = normalizeText(input.task.commit_sha)
  if (!commitSha) {
    return
  }

  const github = new GitHubRepositoryClient(readGitHubSecrets(input.config.github_repository))
  const workflow = await github.listWorkflowRuns(commitSha)
  const nextTestStatus = mapWorkflowStatusToExecutionStatus(
    normalizeText(input.task.test_status),
    workflow.status,
    workflow.conclusion,
  )
  const nextBuildStatus = mapWorkflowStatusToExecutionStatus(
    normalizeText(input.task.build_status),
    workflow.status,
    workflow.conclusion,
  )

  await updateTaskRow(input.serviceClient, String(input.task.id), {
    test_status: nextTestStatus,
    build_status: nextBuildStatus,
    metadata: {
      ...normalizeTaskMetadata(input.task),
      workflow_status: workflow.status,
      workflow_conclusion: workflow.conclusion,
      workflow_url: workflow.htmlUrl,
      workflow_name: workflow.workflowName,
    },
  })

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: String(input.task.id),
    actorUserId: input.actorUserId,
    eventType: "status_refreshed",
    message: "Status de checks do GitHub atualizado.",
    metadata: {
      workflow_status: workflow.status,
      workflow_conclusion: workflow.conclusion,
    },
  })
}

async function refreshTaskPreview(input: {
  serviceClient: ServiceClient
  task: TaskRow
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  const commitSha = normalizeText(input.task.commit_sha)
  const branchName = normalizeText(input.task.branch_name)
  if (!commitSha || !branchName || !input.config.request_preview_deploy) {
    return
  }

  const preview = await fetchVercelPreviewDeployment({
    commitSha,
    branchName,
  })

  await upsertDeployRow(input.serviceClient, String(input.task.id), {
    deployment_id: preview.deploymentId,
    deployment_url: preview.deploymentUrl,
    status: preview.status,
    git_branch: branchName,
    commit_sha: commitSha,
    ready_at: preview.readyAt,
    error_message: preview.errorMessage,
    metadata: preview.metadata,
  })

  await updateTaskRow(input.serviceClient, String(input.task.id), {
    preview_url: preview.deploymentUrl,
    preview_status: preview.status,
  })

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: String(input.task.id),
    actorUserId: input.actorUserId,
    eventType: "preview_refreshed",
    message:
      preview.status === "ready"
        ? "Preview real do Vercel encontrado para a task."
        : preview.status === "failed"
          ? "Preview do Vercel falhou para a task."
          : "Preview ainda em processamento.",
    metadata: {
      deployment_id: preview.deploymentId,
      preview_url: preview.deploymentUrl,
      status: preview.status,
    },
  })
}

function deriveTaskExecutionFailure(
  error: unknown,
  config: AiCodeEditorConfigValue,
) {
  const fallbackMessage = error instanceof Error ? error.message : String(error)
  if (error instanceof AiPatchGenerationError) {
    const providerStatuses = buildProviderStatusPatchFromAttempts(
      config.provider_statuses,
      error.providerAttempts,
    )

    return {
      status: error.code === "blocked_provider_quota"
        ? "blocked_provider_quota"
        : "ai_generation_unavailable",
      message: error.message,
      metadata: {
        provider_attempts: error.providerAttempts,
        deterministic_attempt: error.deterministicAttempt,
        generation_failure_code: error.code,
      },
      providerStatuses,
      generationMode: error.code === "blocked_provider_quota"
        ? "blocked_provider_quota"
        : computeGenerationMode({ provider_statuses: providerStatuses }),
    } as const
  }

  return {
    status: "failed",
    message: fallbackMessage,
    metadata: {},
    providerStatuses: config.provider_statuses,
    generationMode: computeGenerationMode({ provider_statuses: config.provider_statuses }),
  } as const
}

async function executeTaskWithFailureHandling(input: {
  serviceClient: ServiceClient
  taskId: string
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  try {
    await runTaskExecution(input)
  } catch (error) {
    const failure = deriveTaskExecutionFailure(error, input.config)
    await updateTaskRow(input.serviceClient, input.taskId, {
      status: failure.status,
      execution_error: failure.message,
      result_summary: failure.message,
      last_execution_at: new Date().toISOString(),
      metadata: {
        ...normalizeTaskMetadata(await readTask(input.serviceClient, input.taskId, false)),
        ...failure.metadata,
      },
    })

    await updateConfigRuntimeDiagnostics({
      serviceClient: input.serviceClient,
      patch: {
        provider_statuses: failure.providerStatuses,
        generation_mode: failure.generationMode,
      },
    })

    await appendTaskEvent({
      serviceClient: input.serviceClient,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      eventType: failure.status === "blocked_provider_quota"
        ? "task_execution_blocked_provider_quota"
        : "task_execution_failed",
      message: failure.message,
      metadata: failure.metadata,
    })
  }
}

async function runTaskExecution(input: {
  serviceClient: ServiceClient
  taskId: string
  config: AiCodeEditorConfigValue
  actorUserId: string | null
}) {
  let task = await readTask(input.serviceClient, input.taskId, true)
  const prompt = normalizeText(task.prompt)

  const plan = await generateTaskPlanForRow({
    serviceClient: input.serviceClient,
    taskId: input.taskId,
    prompt,
    config: input.config,
  })

  await updateTaskRow(input.serviceClient, input.taskId, {
    status: "planning",
    plan_json: buildPlanJson(plan),
    execution_error: null,
  })

  task = await readTask(input.serviceClient, input.taskId, true)
  const applied = await applyTaskPatch({
    serviceClient: input.serviceClient,
    task,
    config: input.config,
    actorUserId: input.actorUserId,
  })

  task = await readTask(input.serviceClient, input.taskId, true)
  await commitTaskChanges({
    serviceClient: input.serviceClient,
    task,
    actorUserId: input.actorUserId,
  })

  task = await readTask(input.serviceClient, input.taskId, true)
  await openTaskPullRequest({
    serviceClient: input.serviceClient,
    task,
    config: input.config,
    actorUserId: input.actorUserId,
  })

  task = await readTask(input.serviceClient, input.taskId, true)
  if (input.config.auto_run_tests || input.config.auto_run_build) {
    try {
      await refreshTaskStatus({
        serviceClient: input.serviceClient,
        task,
        config: input.config,
        actorUserId: input.actorUserId,
      })
    } catch (error) {
      await appendTaskEvent({
        serviceClient: input.serviceClient,
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        eventType: "status_refresh_warning",
        message: "Os checks ainda nao puderam ser atualizados automaticamente.",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  task = await readTask(input.serviceClient, input.taskId, true)
  if (input.config.request_preview_deploy) {
    try {
      await refreshTaskPreview({
        serviceClient: input.serviceClient,
        task,
        config: input.config,
        actorUserId: input.actorUserId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await updateTaskRow(input.serviceClient, input.taskId, {
        preview_status: "failed",
        preview_url: null,
      })
      await upsertDeployRow(input.serviceClient, input.taskId, {
        deployment_id: null,
        deployment_url: null,
        status: "failed",
        git_branch: normalizeText(task.branch_name),
        commit_sha: normalizeText(task.commit_sha) || null,
        ready_at: null,
        error_message: message,
        metadata: {
          source: "preview_refresh_error",
        },
      })
      await appendTaskEvent({
        serviceClient: input.serviceClient,
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        eventType: "preview_refresh_warning",
        message,
      })
    }
  }

  await appendTaskEvent({
    serviceClient: input.serviceClient,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    eventType: "task_execution_completed",
    message: `Execucao real concluida para a branch ${applied.branchName}.`,
    metadata: {
      branch_name: applied.branchName,
      commit_sha: applied.commitSha,
    },
  })
}

function toTaskTransitionRecord(currentTask: DetailedTaskRow) {
  return {
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
    metadata: normalizeTaskMetadata(currentTask),
  }
}

async function createRollbackPullRequestForTask(input: {
  serviceClient: ServiceClient
  task: DetailedTaskRow
  config: AiCodeEditorConfigValue
  notes?: string | null
}) {
  const taskId = String(input.task.id)
  const fileChanges = Array.isArray(input.task.file_changes) ? input.task.file_changes : []
  if (fileChanges.length === 0) {
    throw new Error("Nao existem file_changes suficientes para gerar um rollback automatico desta task.")
  }

  const github = new GitHubRepositoryClient(readGitHubSecrets(input.config.github_repository))
  const repository = await github.getRepositoryInfo()
  const defaultBranch = normalizeText(input.task.default_branch) || repository.defaultBranch
  const defaultBranchInfo = await github.getBranch(defaultBranch)
  if (!defaultBranchInfo?.sha) {
    throw new Error("Nao foi possivel determinar a branch base para o rollback.")
  }

  const timestampToken = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
  const rollbackBranchName = `ai-editor/rollback-${taskId.slice(0, 8)}-${timestampToken}`
  await github.ensureBranch(rollbackBranchName, defaultBranchInfo.sha)

  let latestCommitSha = ""
  let commitCount = 0

  for (const change of fileChanges) {
    const filePath = normalizeText(change.file_path)
    const previousFilePath = normalizeText(change.previous_file_path) || null
    const changeType = normalizeText(change.change_type)
    const beforeSha = normalizeText(change.before_sha) || null
    const commitMessage = commitCount === 0
      ? `revert(ai-editor): ${taskId.slice(0, 8)}`
      : `revert(ai-editor): ${taskId.slice(0, 8)} [part ${commitCount + 1}]`

    if (changeType === "created") {
      const currentSnapshot = await github.getFile(filePath, defaultBranch)
      if (!currentSnapshot.sha) {
        continue
      }

      const deletion = await github.deleteFile({
        path: filePath,
        branch: rollbackBranchName,
        message: commitMessage,
        previousSha: currentSnapshot.sha,
      })
      latestCommitSha = deletion.commitSha ?? latestCommitSha
      commitCount += 1
      continue
    }

    if (!beforeSha) {
      throw new Error(`Nao encontrei o blob anterior necessario para reverter ${filePath}.`)
    }

    const previousContent = await github.getBlobText(beforeSha)

    if (changeType === "renamed" && previousFilePath) {
      const renamedSnapshot = await github.getFile(filePath, defaultBranch)
      if (renamedSnapshot.sha) {
        const deletion = await github.deleteFile({
          path: filePath,
          branch: rollbackBranchName,
          message: commitMessage,
          previousSha: renamedSnapshot.sha,
        })
        latestCommitSha = deletion.commitSha ?? latestCommitSha
        commitCount += 1
      }

      const originalSnapshot = await github.getFile(previousFilePath, defaultBranch)
      const restoration = await github.upsertFile({
        path: previousFilePath,
        branch: rollbackBranchName,
        message: commitMessage,
        content: previousContent,
        previousSha: originalSnapshot.sha,
      })
      latestCommitSha = restoration.commitSha ?? latestCommitSha
      commitCount += 1
      continue
    }

    const currentSnapshot = await github.getFile(filePath, defaultBranch)
    const restoration = await github.upsertFile({
      path: filePath,
      branch: rollbackBranchName,
      message: commitMessage,
      content: previousContent,
      previousSha: currentSnapshot.sha,
    })
    latestCommitSha = restoration.commitSha ?? latestCommitSha
    commitCount += 1
  }

  if (!latestCommitSha) {
    throw new Error("O rollback automatico nao gerou nenhum commit de revert.")
  }

  const comparison = await github.compare(defaultBranch, rollbackBranchName)
  if (comparison.files.length === 0) {
    throw new Error("O rollback automatico nao produziu diff real para revisao.")
  }

  const rollbackPullRequest = await github.createPullRequest({
    title: `Revert AI Editor task ${taskId}`,
    body: buildRollbackPullRequestBody({
      taskId,
      originalPrompt: normalizeText(input.task.prompt),
      originalPullRequestUrl: normalizeText(input.task.pull_request_url) || null,
      originalCommitSha: normalizeText(input.task.commit_sha) || null,
      files: fileChanges.map((change) => ({
        filePath: normalizeText(change.file_path),
        previousFilePath: normalizeText(change.previous_file_path) || null,
        changeType: normalizeText(change.change_type) as never,
      })),
      notes: normalizeText(input.notes) || null,
    }),
    head: rollbackBranchName,
    base: defaultBranch,
  })

  return {
    branchName: rollbackBranchName,
    commitSha: latestCommitSha,
    compareUrl: comparison.htmlUrl,
    pullRequest: rollbackPullRequest,
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
      try {
        ensureValidConfigPatch(body.configValue)
      } catch {
        throw badRequest("configValue invalido")
      }

      const config = await writeConfig(serviceClient, body.configValue)

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_code_editor_config_updated",
        entityType: "site_config",
        entityId: null,
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

      const { data: insertedTask, error: insertTaskError } = await serviceClient
        .from("ai_code_editor_tasks")
        .insert({
          requested_by: context.user.id,
          prompt,
          normalized_prompt: plan.normalizedPrompt,
          title: plan.title,
          summary: plan.summary,
          status: config.config_value.worker_mode === "github_worker" ? "planning" : initialState.status,
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
          plan_json: buildPlanJson(plan),
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
      await replaceFileChanges(serviceClient, taskId, buildPlannedFileChangeRows(taskId, plan))
      await upsertDeployRow(serviceClient, taskId, {
        deployment_id: null,
        deployment_url: null,
        status: initialState.previewStatus === "pending" ? "pending" : "not_requested",
        git_branch: plan.branchName,
        commit_sha: null,
        ready_at: null,
        error_message: null,
        metadata: {
          project_name: config.config_value.vercel_project_name,
          preview_requested: config.config_value.request_preview_deploy,
          worker_mode: config.config_value.worker_mode,
        },
      })

      await appendTaskEvent({
        serviceClient,
        taskId,
        actorUserId: context.user.id,
        eventType: "task_created",
        message:
          config.config_value.worker_mode === "github_worker"
            ? "Task criada e enviada para execucao real no GitHub."
            : "Task criada em modo de planejamento.",
        metadata: {
          worker_mode: config.config_value.worker_mode,
        },
      })

      if (config.config_value.worker_mode === "github_worker") {
        await executeTaskWithFailureHandling({
          serviceClient,
          taskId,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      }

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_code_editor_task_created",
        entityType: "ai_code_editor_task",
        entityId: taskId,
        metadata: {
          prompt,
          worker_mode: config.config_value.worker_mode,
        },
        ...auditMeta,
      })

      const task = await readTask(serviceClient, taskId, true)
      return jsonResponse({ success: true, task })
    }

    if (
      body.action === "generate_task_plan" ||
      body.action === "start_task_execution" ||
      body.action === "create_task_branch" ||
      body.action === "apply_task_patch" ||
      body.action === "commit_task_changes" ||
      body.action === "open_task_pull_request" ||
      body.action === "refresh_task_status" ||
      body.action === "refresh_task_preview"
    ) {
      const taskId = normalizeText(body.taskId)
      if (!taskId) {
        throw badRequest("taskId obrigatorio")
      }

      const config = await readConfig(serviceClient)
      const task = await readTask(serviceClient, taskId, true)

      if (body.action === "generate_task_plan") {
        await generateTaskPlanForRow({
          serviceClient,
          taskId,
          prompt: normalizeText(task.prompt),
          config: config.config_value,
        })
      } else if (body.action === "start_task_execution") {
        await executeTaskWithFailureHandling({
          serviceClient,
          taskId,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      } else if (body.action === "create_task_branch") {
        await createTaskBranch({
          serviceClient,
          task,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      } else if (body.action === "apply_task_patch") {
        await applyTaskPatch({
          serviceClient,
          task,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      } else if (body.action === "commit_task_changes") {
        await commitTaskChanges({
          serviceClient,
          task,
          actorUserId: context.user.id,
        })
      } else if (body.action === "open_task_pull_request") {
        await openTaskPullRequest({
          serviceClient,
          task,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      } else if (body.action === "refresh_task_status") {
        await refreshTaskStatus({
          serviceClient,
          task,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      } else if (body.action === "refresh_task_preview") {
        await refreshTaskPreview({
          serviceClient,
          task,
          config: config.config_value,
          actorUserId: context.user.id,
        })
      }

      const refreshedTask = await readTask(serviceClient, taskId, true)
      return jsonResponse({ success: true, task: refreshedTask })
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

      const config = await readConfig(serviceClient)
      const currentTask = await readTask(serviceClient, taskId, true)
      const metadata = normalizeTaskMetadata(currentTask)

      if (body.action === "approve_task") {
        ensureTaskReadyForPublication(currentTask)

        const github = new GitHubRepositoryClient(readGitHubSecrets(config.config_value.github_repository))
        const mergeResult = await github.mergePullRequest({
          pullRequestNumber: parsePullRequestNumber(currentTask),
          commitTitle: normalizeText(currentTask.commit_message),
        })

        if (!mergeResult.merged) {
          throw unprocessable("O Pull Request nao pode ser mergeado neste momento.")
        }

        await updateTaskRow(serviceClient, taskId, {
          status: "published",
          approved_by: context.user.id,
          approved_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          merged_at: new Date().toISOString(),
          pull_request_status: "merged",
          metadata: {
            ...metadata,
            merge_commit_sha: mergeResult.sha,
            latest_action_notes: normalizeText(body.notes) || null,
          },
        })

        await appendTaskEvent({
          serviceClient,
          taskId,
          actorUserId: context.user.id,
          eventType: "task_published",
          message: "Task aprovada e mergeada via GitHub API pelo admin.",
          metadata: {
            merge_commit_sha: mergeResult.sha,
          },
        })
      } else if (body.action === "reject_task") {
        const pullRequestNumber = parsePullRequestNumber(currentTask)
        if (pullRequestNumber > 0 && normalizeText(currentTask.pull_request_status) !== "merged") {
          const github = new GitHubRepositoryClient(readGitHubSecrets(config.config_value.github_repository))
          await github.closePullRequest(pullRequestNumber)
        }

        const nextTask = transitionTaskRecord({
          task: toTaskTransitionRecord(currentTask),
          action: "reject",
          notes: body.notes ?? null,
        })

        await updateTaskRow(serviceClient, taskId, {
          status: nextTask.status,
          pull_request_status: pullRequestNumber > 0 ? "closed" : normalizeText(currentTask.pull_request_status),
          metadata: {
            ...nextTask.metadata,
            pull_request_status: pullRequestNumber > 0 ? "closed" : normalizeText(currentTask.pull_request_status),
          },
        })

        await appendTaskEvent({
          serviceClient,
          taskId,
          actorUserId: context.user.id,
          eventType: "task_rejected",
          message: "Task rejeitada pelo admin.",
          metadata: {
            notes: normalizeText(body.notes),
          },
        })
      } else if (body.action === "request_adjustment") {
        const nextTask = transitionTaskRecord({
          task: toTaskTransitionRecord(currentTask),
          action: "request_adjustment",
          notes: body.notes ?? null,
        })

        await updateTaskRow(serviceClient, taskId, {
          status: nextTask.status,
          metadata: nextTask.metadata,
        })

        await appendTaskEvent({
          serviceClient,
          taskId,
          actorUserId: context.user.id,
          eventType: "task_adjustment_requested",
          message: "Task devolvida para ajuste antes de qualquer publicacao.",
          metadata: {
            notes: normalizeText(body.notes),
          },
        })
      } else if (body.action === "rollback_task") {
        const nextTask = transitionTaskRecord({
          task: toTaskTransitionRecord(currentTask),
          action: "rollback",
          notes: body.notes ?? null,
        })

        try {
          const rollback = await createRollbackPullRequestForTask({
            serviceClient,
            task: currentTask,
            config: config.config_value,
            notes: body.notes ?? null,
          })

          await updateTaskRow(serviceClient, taskId, {
            status: nextTask.status,
            metadata: {
              ...nextTask.metadata,
              rollback_mode: "revert_pull_request",
              rollback_branch_name: rollback.branchName,
              rollback_commit_sha: rollback.commitSha,
              rollback_compare_url: rollback.compareUrl,
              rollback_pull_request_number: rollback.pullRequest.number,
              rollback_pull_request_url: rollback.pullRequest.htmlUrl,
              rollback_pull_request_status: rollback.pullRequest.state,
            },
          })

          await appendTaskEvent({
            serviceClient,
            taskId,
            actorUserId: context.user.id,
            eventType: "rollback_pull_request_opened",
            message: `Rollback operacional preparado via PR #${rollback.pullRequest.number}.`,
            metadata: {
              notes: normalizeText(body.notes),
              rollback_branch_name: rollback.branchName,
              rollback_commit_sha: rollback.commitSha,
              rollback_pull_request_url: rollback.pullRequest.htmlUrl,
            },
          })
        } catch (rollbackError) {
          const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          await updateTaskRow(serviceClient, taskId, {
            metadata: {
              ...metadata,
              rollback_mode: "manual_required",
              rollback_error: message,
            },
          })

          await appendTaskEvent({
            serviceClient,
            taskId,
            actorUserId: context.user.id,
            eventType: "rollback_manual_required",
            message: "Rollback automatico indisponivel; revisao manual necessaria.",
            metadata: {
              notes: normalizeText(body.notes),
              error: message,
            },
          })

          throw unprocessable(
            `Rollback automatico indisponivel: ${message}. Faz o revert manual no GitHub ou corrige os artefactos desta task.`,
          )
        }
      }

      const actionMap = {
        approve_task: "admin.ai_code_editor_task_approved",
        reject_task: "admin.ai_code_editor_task_rejected",
        request_adjustment: "admin.ai_code_editor_task_adjustment_requested",
        rollback_task: "admin.ai_code_editor_task_rollback_requested",
      } as const

      const task = await readTask(serviceClient, taskId, true)

      await writeAuditLog(serviceClient, context, {
        action: actionMap[body.action],
        entityType: "ai_code_editor_task",
        entityId: taskId,
        metadata: {
          next_status: normalizeText(task.status),
          notes: normalizeText(body.notes),
        },
        ...auditMeta,
      })

      logInfo("Admin AI code editor task updated", {
        request_id: requestId,
        user_id: context.user.id,
        task_id: taskId,
        action: body.action,
        next_status: normalizeText(task.status),
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
