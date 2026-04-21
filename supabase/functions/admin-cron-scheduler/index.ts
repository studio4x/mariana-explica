import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

type CronKey =
  | "process_email_deliveries"
  | "retry_email_deliveries"
  | "reconcile_orders"
  | "audit_access_consistency"
  | "clean_expired_links"

interface AdminCronSchedulerInput {
  action: "status" | "schedule" | "run_one" | "run_all" | "queue_test_email"
  cron?: CronKey
  emailTo?: string
  batchSize?: number
  maxAttempts?: number
  retentionHours?: number
  maxUsers?: number
  dryRun?: boolean
  processImmediately?: boolean
}

const CRON_TARGETS: Record<CronKey, { slug: string; defaultPayload: Record<string, unknown> }> = {
  process_email_deliveries: {
    slug: "cron-process-email-deliveries",
    defaultPayload: { batchSize: 20 },
  },
  retry_email_deliveries: {
    slug: "cron-retry-email-deliveries",
    defaultPayload: { batchSize: 20, maxAttempts: 5 },
  },
  reconcile_orders: {
    slug: "cron-reconcile-orders",
    defaultPayload: { batchSize: 20 },
  },
  audit_access_consistency: {
    slug: "cron-audit-access-consistency",
    defaultPayload: { batchSize: 100 },
  },
  clean_expired_links: {
    slug: "cron-clean-expired-links",
    defaultPayload: { retentionHours: 24, maxUsers: 50, dryRun: false },
  },
}

const DEFAULT_TEST_EMAIL_TO = "agenciastudio4x@gmail.com"

function getSupabaseUrl() {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL")
  if (!url) {
    throw badRequest("SUPABASE_URL nao configurada")
  }

  return url.replace(/\/+$/g, "")
}

function getCronSecret() {
  const secret = Deno.env.get("CRON_SECRET")?.trim() || Deno.env.get("INTERNAL_CRON_SECRET")?.trim()
  if (!secret) {
    throw badRequest("CRON_SECRET nao configurado")
  }

  return secret
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("emailTo invalido")
  }

  return email
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

function buildPayload(cron: CronKey, body: AdminCronSchedulerInput) {
  const payload = { ...CRON_TARGETS[cron].defaultPayload, source: "admin-cron-scheduler" }

  if ("batchSize" in payload || body.batchSize !== undefined) {
    payload.batchSize = normalizeNumber(body.batchSize, Number(payload.batchSize ?? 20), 1, 100)
  }

  if (cron === "retry_email_deliveries") {
    payload.maxAttempts = normalizeNumber(body.maxAttempts, 5, 1, 10)
  }

  if (cron === "clean_expired_links") {
    payload.retentionHours = normalizeNumber(body.retentionHours, 24, 1, 24 * 30)
    payload.maxUsers = normalizeNumber(body.maxUsers, 50, 1, 200)
    payload.dryRun = body.dryRun === true
  }

  return payload
}

async function invokeCron(cron: CronKey, body: AdminCronSchedulerInput) {
  const target = CRON_TARGETS[cron]
  const response = await fetch(`${getSupabaseUrl()}/functions/v1/${target.slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": getCronSecret(),
    },
    body: JSON.stringify(buildPayload(cron, body)),
  })

  let result: unknown = null
  try {
    result = await response.json()
  } catch {
    result = { message: await response.text() }
  }

  return {
    cron,
    slug: target.slug,
    ok: response.ok,
    status: response.status,
    result,
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<AdminCronSchedulerInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "status") {
      const [{ data: scheduledJobs, error: scheduleError }, { data: jobRuns, error: jobError }] =
        await Promise.all([
          context.serviceClient.rpc("get_platform_cron_jobs"),
          context.serviceClient
            .from("job_runs")
            .select("id,job_name,status,started_at,finished_at,payload,result,error_message,idempotency_key,created_at")
            .order("started_at", { ascending: false })
            .limit(40),
        ])

      if (scheduleError) throw scheduleError
      if (jobError) throw jobError

      return jsonResponse({
        success: true,
        request_id: requestId,
        scheduledJobs,
        jobRuns: jobRuns ?? [],
      })
    }

    if (body.action === "schedule") {
      const { data, error } = await context.serviceClient.rpc("configure_platform_cron_jobs", {
        p_project_url: getSupabaseUrl(),
        p_cron_secret: getCronSecret(),
      })

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.cron_schedule_configured",
        entityType: "job_run",
        entityId: null,
        metadata: { scheduled: data },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        schedule: data,
      })
    }

    if (body.action === "run_one") {
      if (!body.cron || !CRON_TARGETS[body.cron]) {
        throw badRequest("cron invalido")
      }

      const result = await invokeCron(body.cron, body)

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.cron_run_one",
        entityType: "job_run",
        entityId: null,
        metadata: { cron: body.cron, ok: result.ok, status: result.status },
        ...auditMeta,
      })

      return jsonResponse({
        success: result.ok,
        request_id: requestId,
        run: result,
      }, result.ok ? 200 : 502)
    }

    if (body.action === "run_all") {
      const runs = [] as Array<Awaited<ReturnType<typeof invokeCron>>>

      for (const cron of Object.keys(CRON_TARGETS) as CronKey[]) {
        runs.push(await invokeCron(cron, body))
      }

      const success = runs.every((run) => run.ok)

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.cron_run_all",
        entityType: "job_run",
        entityId: null,
        metadata: { success, runs: runs.map((run) => ({ cron: run.cron, ok: run.ok, status: run.status })) },
        ...auditMeta,
      })

      return jsonResponse({
        success,
        request_id: requestId,
        runs,
      }, success ? 200 : 502)
    }

    if (body.action === "queue_test_email") {
      const emailTo = normalizeEmail(body.emailTo ?? DEFAULT_TEST_EMAIL_TO)
      const now = new Date().toISOString()
      const subject = "Teste de email transacional | Mariana Explica"
      const text = [
        "Este e um teste operacional do email transacional da plataforma Mariana Explica.",
        `Destino: ${emailTo}`,
        `Data: ${now}`,
      ].join("\n")

      const { data: delivery, error } = await context.serviceClient
        .from("email_deliveries")
        .insert({
          email_to: emailTo,
          template_key: "admin_test_email",
          status: "queued",
          subject,
          html_content: `<p>Este e um teste operacional do email transacional da plataforma Mariana Explica.</p><p><strong>Destino:</strong> ${emailTo}</p><p><strong>Data:</strong> ${now}</p>`,
          text_content: text,
          metadata: {
            source: "admin-cron-scheduler",
            requested_by: context.user.id,
            requested_at: now,
          },
        })
        .select("id,email_to,template_key,status,subject,created_at")
        .single()

      if (error) {
        throw error
      }

      const processResult = body.processImmediately === false
        ? null
        : await invokeCron("process_email_deliveries", { ...body, batchSize: 5 })

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.test_email_queued",
        entityType: "email_delivery",
        entityId: delivery.id,
        metadata: {
          email_to: emailTo,
          processed_immediately: Boolean(processResult),
          process_ok: processResult?.ok ?? null,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: processResult ? processResult.ok : true,
        request_id: requestId,
        emailDelivery: delivery,
        process: processResult,
      }, !processResult || processResult.ok ? 200 : 502)
    }

    throw badRequest("Acao invalida")
  } catch (error) {
    logError("Admin cron scheduler failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
