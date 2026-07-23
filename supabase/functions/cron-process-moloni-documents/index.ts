import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import {
  createServiceClient,
  finishJobRun,
  processMoloniDocumentJob,
  requireCronSecret,
  startJobRun,
} from "../_shared/mod.ts"

interface Input {
  batchSize?: number
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  let jobRunId: string | null = null
  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")
    requireCronSecret(req)
    const body: Input = await readJsonBody<Input>(req).catch(() => ({}))
    const batchSize = Math.max(1, Math.min(Number(body.batchSize ?? 10), 25))
    const client = createServiceClient()
    const jobRun = await startJobRun(client, {
      jobName: "cron_process_moloni_documents",
      payload: { batch_size: batchSize },
      idempotencyKey: `moloni-worker:${new Date().toISOString().slice(0, 16)}`,
    })
    jobRunId = jobRun.id
    const workerId = `${requestId}:${jobRun.id}`
    const { data: jobs, error: claimError } = await client.rpc("claim_moloni_document_jobs", {
      p_worker_id: workerId,
      p_batch_size: batchSize,
    })
    if (claimError) throw claimError
    const results = []
    for (const job of jobs ?? []) {
      results.push(await processMoloniDocumentJob(client, job))
    }
    const counts = results.reduce<Record<string, number>>((accumulator, result) => {
      accumulator[result.status] = (accumulator[result.status] ?? 0) + 1
      return accumulator
    }, {})
    await finishJobRun(client, {
      jobRunId: jobRun.id,
      status: "success",
      result: { claimed: jobs?.length ?? 0, counts },
    })
    logInfo("Moloni document worker completed", {
      request_id: requestId,
      job_run_id: jobRun.id,
      claimed: jobs?.length ?? 0,
      counts,
    })
    return jsonResponse({ success: true, request_id: requestId, claimed: jobs?.length ?? 0, counts })
  } catch (error) {
    logError("Moloni document worker failed", { request_id: requestId, error: String(error) })
    if (jobRunId) {
      const client = createServiceClient()
      await finishJobRun(client, {
        jobRunId,
        status: "failed",
        errorMessage: "Falha no processador fiscal; consulte os logs pelo request_id.",
      }).catch(() => undefined)
    }
    return errorResponse(error, requestId)
  }
})
