import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  createServiceClient,
  findReconcilableOrder,
  finishJobRun,
  reconcileOrderWithStripe,
  requireCronSecret,
  startJobRun,
} from "../_shared/mod.ts"

interface CronReconcileOrdersInput {
  batchSize?: number
}

function normalizeBatchSize(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 20
  }

  return Math.max(1, Math.min(100, Math.trunc(numeric)))
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

    const body = await readJsonBody<CronReconcileOrdersInput>(req)
    const batchSize = normalizeBatchSize(body.batchSize)
    const idempotencyKey = `cron-reconcile-orders:${new Date().toISOString().slice(0, 16)}:${batchSize}`

    const jobRun = await startJobRun(serviceClient, {
      jobName: "cron_reconcile_orders",
      payload: {
        batch_size: batchSize,
        request_id: requestId,
      },
      idempotencyKey,
    })
    jobRunId = jobRun.id

    const { data: candidates, error: candidatesError } = await serviceClient
      .from("orders")
      .select("id")
      .not("checkout_session_id", "is", null)
      .in("status", ["pending", "paid", "failed"])
      .order("created_at", { ascending: false })
      .limit(batchSize)

    if (candidatesError) {
      throw candidatesError
    }

    const reconciledIds: string[] = []
    const changedIds: string[] = []
    const failedItems: Array<{ order_id: string; message: string }> = []

    for (const candidate of candidates ?? []) {
      try {
        const order = await findReconcilableOrder(serviceClient, candidate.id as string)
        const result = await reconcileOrderWithStripe(serviceClient, order)
        reconciledIds.push(order.id)
        if (result.action !== "noop") {
          changedIds.push(order.id)
        }
      } catch (error) {
        failedItems.push({
          order_id: String(candidate.id),
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const result = {
      scanned_count: (candidates ?? []).length,
      reconciled_count: reconciledIds.length,
      changed_count: changedIds.length,
      failed_count: failedItems.length,
      reconciled_ids: reconciledIds,
      changed_ids: changedIds,
      failed_items: failedItems,
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
        logError("Cron reconcile orders failed to finalize job run", {
          request_id: requestId,
          job_run_id: jobRunId,
          error: String(finishError),
        })
      }
    }

    logError("Cron reconcile orders failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
