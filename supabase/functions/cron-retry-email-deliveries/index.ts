import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient, finishJobRun, requireCronSecret, startJobRun } from "../_shared/mod.ts"

interface CronRetryEmailDeliveriesInput {
  batchSize?: number
  maxAttempts?: number
}

interface EmailDeliveryRetryRow {
  id: string
  status: "queued" | "sent" | "failed" | "delivered" | "bounced"
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  const serviceClient = createServiceClient()
  let jobRunId: string | null = null

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    requireCronSecret(req)

    const body = await readJsonBody<CronRetryEmailDeliveriesInput>(req)
    const batchSize = clampNumber(body.batchSize, 20, 1, 50)
    const maxAttempts = clampNumber(body.maxAttempts, 5, 1, 10)
    const idempotencyKey = `cron-retry-email-deliveries:${new Date().toISOString().slice(0, 16)}:${batchSize}:${maxAttempts}`

    const jobRun = await startJobRun(serviceClient, {
      jobName: "cron_retry_email_deliveries",
      payload: {
        batch_size: batchSize,
        max_attempts: maxAttempts,
        request_id: requestId,
      },
      idempotencyKey,
    })
    jobRunId = jobRun.id

    const { data: failedDeliveries, error: failedError } = await serviceClient
      .from("email_deliveries")
      .select("id,status,error_message,metadata,created_at")
      .in("status", ["failed", "bounced"])
      .order("created_at", { ascending: true })
      .limit(batchSize)

    if (failedError) {
      throw failedError
    }

    const requeuedIds: string[] = []
    const exhaustedIds: string[] = []

    for (const delivery of (failedDeliveries ?? []) as EmailDeliveryRetryRow[]) {
      const currentMetadata =
        delivery.metadata && typeof delivery.metadata === "object" ? delivery.metadata : {}
      const retryAttempts = Number(currentMetadata["retry_attempts"] ?? 0)

      if (retryAttempts >= maxAttempts) {
        exhaustedIds.push(delivery.id)
        continue
      }

      const { error: requeueError } = await serviceClient
        .from("email_deliveries")
        .update({
          status: "queued",
          error_message: null,
          sent_at: null,
          provider_message_id: null,
          metadata: {
            ...currentMetadata,
            retry_attempts: retryAttempts + 1,
            last_requeued_at: new Date().toISOString(),
            last_retry_source: "cron_retry_email_deliveries",
          },
        })
        .eq("id", delivery.id)

      if (requeueError) {
        throw requeueError
      }

      requeuedIds.push(delivery.id)
    }

    const result = {
      scanned_count: (failedDeliveries ?? []).length,
      requeued_count: requeuedIds.length,
      exhausted_count: exhaustedIds.length,
      requeued_ids: requeuedIds,
      exhausted_ids: exhaustedIds,
    }

    await finishJobRun(serviceClient, {
      jobRunId,
      status: "success",
      result,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      job_run_id: jobRunId,
      ...result,
    })
  } catch (error) {
    if (jobRunId) {
      try {
        await finishJobRun(serviceClient, {
          jobRunId,
          status: "failed",
          result: {},
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (finishError) {
        logError("Cron retry email deliveries failed to finalize job run", {
          request_id: requestId,
          job_run_id: jobRunId,
          error: String(finishError),
        })
      }
    }

    logError("Cron retry email deliveries failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
