import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  createServiceClient,
  finishJobRun,
  requireCronSecret,
  revokeActiveGrantForOrder,
  startJobRun,
} from "../_shared/mod.ts"

interface CronAuditAccessConsistencyInput {
  batchSize?: number
}

interface GrantAuditRow {
  id: string
  user_id: string
  product_id: string
  source_type: "purchase" | "free_claim" | "admin_grant" | "manual_adjustment"
  source_order_id: string | null
  status: "active" | "revoked" | "expired"
  granted_at: string
  expires_at: string | null
  profiles:
    | {
        status: "active" | "inactive" | "blocked" | "pending_review"
        email: string | null
        full_name: string | null
      }
    | null
  products:
    | {
        status: "draft" | "published" | "archived"
        title: string
      }
    | null
  orders:
    | {
        status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
        refunded_at: string | null
      }
    | null
}

function normalizeBatchSize(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 100
  }

  return Math.max(1, Math.min(300, Math.trunc(numeric)))
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

    const body = await readJsonBody<CronAuditAccessConsistencyInput>(req)
    const batchSize = normalizeBatchSize(body.batchSize)
    const idempotencyKey = `cron-audit-access-consistency:${new Date().toISOString().slice(0, 16)}:${batchSize}`

    const jobRun = await startJobRun(serviceClient, {
      jobName: "cron_audit_access_consistency",
      payload: {
        batch_size: batchSize,
        request_id: requestId,
      },
      idempotencyKey,
    })
    jobRunId = jobRun.id

    const { data: grants, error: grantsError } = await serviceClient
      .from("access_grants")
      .select(
        "id,user_id,product_id,source_type,source_order_id,status,granted_at,expires_at,profiles:user_id(status,email,full_name),products:product_id(status,title),orders:source_order_id(status,refunded_at)",
      )
      .eq("status", "active")
      .order("granted_at", { ascending: false })
      .limit(batchSize)

    if (grantsError) {
      throw grantsError
    }

    const alerts: Array<Record<string, unknown>> = []
    const autoRevokedOrderIds = new Set<string>()

    for (const grant of (grants ?? []) as GrantAuditRow[]) {
      const userStatus = grant.profiles?.status ?? null
      const productStatus = grant.products?.status ?? null
      const orderStatus = grant.orders?.status ?? null

      if (userStatus && userStatus !== "active") {
        alerts.push({
          type: "user_status_incompatible_with_active_grant",
          grant_id: grant.id,
          user_id: grant.user_id,
          user_status: userStatus,
          product_id: grant.product_id,
        })
      }

      if (productStatus === "archived") {
        alerts.push({
          type: "archived_product_with_active_grant",
          grant_id: grant.id,
          product_id: grant.product_id,
          product_title: grant.products?.title ?? null,
        })
      }

      if (
        grant.source_type === "purchase" &&
        grant.source_order_id &&
        orderStatus &&
        ["refunded", "cancelled", "failed"].includes(orderStatus)
      ) {
        alerts.push({
          type: "purchase_grant_with_invalid_order_status",
          grant_id: grant.id,
          order_id: grant.source_order_id,
          order_status: orderStatus,
          product_id: grant.product_id,
        })

        if (!autoRevokedOrderIds.has(grant.source_order_id)) {
          await revokeActiveGrantForOrder(serviceClient, {
            orderId: grant.source_order_id,
            reason: `Acesso revogado automaticamente por auditoria de consistencia: pedido ${orderStatus}`,
          })
          autoRevokedOrderIds.add(grant.source_order_id)
        }
      }
    }

    const result = {
      scanned_count: (grants ?? []).length,
      alert_count: alerts.length,
      auto_revoked_orders_count: autoRevokedOrderIds.size,
      auto_revoked_order_ids: Array.from(autoRevokedOrderIds),
      alerts,
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
        logError("Cron audit access consistency failed to finalize job run", {
          request_id: requestId,
          job_run_id: jobRunId,
          error: String(finishError),
        })
      }
    }

    logError("Cron audit access consistency failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
