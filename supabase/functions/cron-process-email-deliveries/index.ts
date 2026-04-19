import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient, finishJobRun, requireCronSecret, startJobRun } from "../_shared/mod.ts"

interface CronProcessEmailDeliveriesInput {
  batchSize?: number
}

interface EmailDeliveryRow {
  id: string
  user_id: string | null
  notification_id: string | null
  email_to: string
  template_key: string
  provider: string | null
  provider_message_id: string | null
  status: "queued" | "sent" | "failed" | "delivered" | "bounced"
  error_message: string | null
  sent_at: string | null
  created_at: string
  subject: string | null
  html_content: string | null
  text_content: string | null
  metadata: Record<string, unknown> | null
}

function normalizeBatchSize(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 20
  }

  return Math.max(1, Math.min(50, Math.trunc(numeric)))
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

    const body = await readJsonBody<CronProcessEmailDeliveriesInput>(req)
    const batchSize = normalizeBatchSize(body.batchSize)
    const idempotencyKey = `cron-process-email-deliveries:${new Date().toISOString().slice(0, 16)}:${batchSize}`

    const jobRun = await startJobRun(serviceClient, {
      jobName: "cron_process_email_deliveries",
      payload: {
        batch_size: batchSize,
        request_id: requestId,
      },
      idempotencyKey,
    })
    jobRunId = jobRun.id

    const { data: queuedDeliveries, error: queuedError } = await serviceClient
      .from("email_deliveries")
      .select(
        "id,user_id,notification_id,email_to,template_key,provider,provider_message_id,status,error_message,sent_at,created_at,subject,html_content,text_content,metadata",
      )
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(batchSize)

    if (queuedError) {
      throw queuedError
    }

    const processedIds: string[] = []
    const failedIds: string[] = []

    for (const delivery of (queuedDeliveries ?? []) as EmailDeliveryRow[]) {
      const hasRenderablePayload = Boolean(delivery.subject?.trim()) && Boolean(
        delivery.html_content?.trim() || delivery.text_content?.trim(),
      )

      const currentMetadata =
        delivery.metadata && typeof delivery.metadata === "object" ? delivery.metadata : {}
      const previousAttempts = Number(currentMetadata["process_attempts"] ?? 0)

      if (!hasRenderablePayload) {
        const { error: markFailedError } = await serviceClient
          .from("email_deliveries")
          .update({
            status: "failed",
            error_message: "Email sem payload renderizavel para envio interno",
            metadata: {
              ...currentMetadata,
              process_attempts: previousAttempts + 1,
              last_failed_at: new Date().toISOString(),
            },
          })
          .eq("id", delivery.id)

        if (markFailedError) {
          throw markFailedError
        }

        failedIds.push(delivery.id)
        continue
      }

      const { error: markSentError } = await serviceClient
        .from("email_deliveries")
        .update({
          status: "sent",
          provider: delivery.provider ?? "internal-cron",
          provider_message_id: delivery.provider_message_id ?? crypto.randomUUID(),
          error_message: null,
          sent_at: new Date().toISOString(),
          metadata: {
            ...currentMetadata,
            process_attempts: previousAttempts + 1,
            last_processed_at: new Date().toISOString(),
          },
        })
        .eq("id", delivery.id)

      if (markSentError) {
        throw markSentError
      }

      processedIds.push(delivery.id)
    }

    const result = {
      queued_count: (queuedDeliveries ?? []).length,
      processed_count: processedIds.length,
      failed_count: failedIds.length,
      processed_ids: processedIds,
      failed_ids: failedIds,
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
        logError("Cron process email deliveries failed to finalize job run", {
          request_id: requestId,
          job_run_id: jobRunId,
          error: String(finishError),
        })
      }
    }

    logError("Cron process email deliveries failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
