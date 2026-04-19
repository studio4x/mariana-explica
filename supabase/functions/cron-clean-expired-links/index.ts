import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient, finishJobRun, requireCronSecret, startJobRun } from "../_shared/mod.ts"

const COURSE_STORAGE_BUCKET = "course-assets-private"
const DERIVED_WATERMARK_ROOT = "derived-watermarks/module-pdfs"

interface CronCleanExpiredLinksInput {
  retentionHours?: number
  maxUsers?: number
  dryRun?: boolean
}

interface StorageListItem {
  name: string
  created_at?: string | null
  updated_at?: string | null
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

function isExpired(item: StorageListItem, cutoffTimestamp: number) {
  const candidateDate = item.updated_at || item.created_at
  const candidateTimestamp = candidateDate ? Date.parse(candidateDate) : Number.NaN
  return Number.isFinite(candidateTimestamp) && candidateTimestamp < cutoffTimestamp
}

function joinStoragePath(...segments: string[]) {
  return segments.map((segment) => segment.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/")
}

async function listStoragePrefix(
  serviceClient: ReturnType<typeof createServiceClient>,
  path: string,
) {
  const { data, error } = await serviceClient.storage.from(COURSE_STORAGE_BUCKET).list(path, {
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  })

  if (error) {
    throw error
  }

  return (data ?? []) as StorageListItem[]
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

    const body = await readJsonBody<CronCleanExpiredLinksInput>(req)
    const retentionHours = clampNumber(body.retentionHours, 24, 1, 24 * 30)
    const maxUsers = clampNumber(body.maxUsers, 50, 1, 200)
    const dryRun = body.dryRun === true
    const cutoffTimestamp = Date.now() - retentionHours * 60 * 60 * 1000
    const idempotencyKey = `cron-clean-expired-links:${new Date().toISOString().slice(0, 13)}:${retentionHours}:${maxUsers}:${dryRun ? "dry" : "live"}`

    const jobRun = await startJobRun(serviceClient, {
      jobName: "cron_clean_expired_links",
      payload: {
        retention_hours: retentionHours,
        max_users: maxUsers,
        dry_run: dryRun,
        request_id: requestId,
      },
      idempotencyKey,
    })
    jobRunId = jobRun.id

    const userFolders = await listStoragePrefix(serviceClient, DERIVED_WATERMARK_ROOT)
    const removedPaths: string[] = []
    const scannedPaths: string[] = []

    for (const userFolder of userFolders.slice(0, maxUsers)) {
      const userPrefix = joinStoragePath(DERIVED_WATERMARK_ROOT, userFolder.name)
      const moduleFolders = await listStoragePrefix(serviceClient, userPrefix)

      for (const moduleFolder of moduleFolders) {
        const modulePrefix = joinStoragePath(userPrefix, moduleFolder.name)
        const files = await listStoragePrefix(serviceClient, modulePrefix)
        const staleFiles = files
          .filter((item) => item.name.toLowerCase().endsWith(".pdf"))
          .filter((item) => isExpired(item, cutoffTimestamp))

        if (!staleFiles.length) {
          continue
        }

        const stalePaths = staleFiles.map((item) => joinStoragePath(modulePrefix, item.name))
        scannedPaths.push(...stalePaths)

        if (!dryRun) {
          const { error: removeError } = await serviceClient.storage.from(COURSE_STORAGE_BUCKET).remove(stalePaths)
          if (removeError) {
            throw removeError
          }
        }

        removedPaths.push(...stalePaths)
      }
    }

    const result = {
      retention_hours: retentionHours,
      dry_run: dryRun,
      scanned_count: scannedPaths.length,
      removed_count: removedPaths.length,
      removed_paths: removedPaths,
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
        logError("Cron clean expired links failed to finalize job run", {
          request_id: requestId,
          job_run_id: jobRunId,
          error: String(finishError),
        })
      }
    }

    logError("Cron clean expired links failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
