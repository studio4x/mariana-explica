import { unauthorized } from "./errors.ts"
import { createServiceClient } from "./supabase.ts"

function getCronSecret() {
  const secret =
    Deno.env.get("CRON_SECRET")?.trim() ||
    Deno.env.get("INTERNAL_CRON_SECRET")?.trim() ||
    Deno.env.get("JOB_RUNNER_SECRET")?.trim()

  if (!secret) {
    throw unauthorized("Cron secret nao configurado")
  }

  return secret
}

export function requireCronSecret(req: Request) {
  const expected = getCronSecret()
  const received =
    req.headers.get("x-cron-secret")?.trim() ||
    req.headers.get("x-internal-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    ""

  if (!received || received !== expected) {
    throw unauthorized("Cron secret invalido")
  }
}

export async function startJobRun(
  serviceClient: ReturnType<typeof createServiceClient>,
  params: {
    jobName: string
    payload?: Record<string, unknown>
    idempotencyKey?: string | null
  },
) {
  const startedAt = new Date().toISOString()
  const { data, error } = await serviceClient
    .from("job_runs")
    .insert({
      job_name: params.jobName,
      status: "running",
      started_at: startedAt,
      payload: params.payload ?? {},
      result: {},
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select("id,job_name,status,started_at,payload,idempotency_key")
    .single()

  if (error) {
    throw error
  }

  return data as {
    id: string
    job_name: string
    status: "running"
    started_at: string
    payload: Record<string, unknown>
    idempotency_key: string | null
  }
}

export async function finishJobRun(
  serviceClient: ReturnType<typeof createServiceClient>,
  params: {
    jobRunId: string
    status: "success" | "failed"
    result?: Record<string, unknown>
    errorMessage?: string | null
  },
) {
  const finishedAt = new Date().toISOString()
  const { data, error } = await serviceClient
    .from("job_runs")
    .update({
      status: params.status,
      finished_at: finishedAt,
      result: params.result ?? {},
      error_message: params.errorMessage ?? null,
    })
    .eq("id", params.jobRunId)
    .select("id,job_name,status,started_at,finished_at,payload,result,error_message,idempotency_key")
    .single()

  if (error) {
    throw error
  }

  return data
}
