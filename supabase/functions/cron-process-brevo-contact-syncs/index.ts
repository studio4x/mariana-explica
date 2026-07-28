import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient, safeBrevoError, syncBrevoContact, requireCronSecret } from "../_shared/mod.ts"

interface Input { batchSize?: number }

function batchSize(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(1, Math.min(50, Math.trunc(number))) : 20
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")
    requireCronSecret(req)
    const serviceClient = createServiceClient()
    const body = await readJsonBody<Input>(req)
    const limit = batchSize(body.batchSize)
    const { data: rows, error } = await serviceClient
      .from("brevo_contact_syncs")
      .select("id,user_id,email,source_product_id,source_order_id,attributes,consent_at,consent_source,consent_evidence,status,attempt_count")
      .in("status", ["queued", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(limit)
    if (error) throw error

    let synced = 0
    let failed = 0
    for (const row of rows ?? []) {
      await serviceClient.from("brevo_contact_syncs").update({ status: "processing" }).eq("id", row.id)
      try {
        const { data: profile } = row.user_id
          ? await serviceClient.from("profiles").select("full_name,email,nif").eq("id", row.user_id).maybeSingle()
          : { data: null }
        const { data: product } = row.source_product_id
          ? await serviceClient.from("products").select("title").eq("id", row.source_product_id).maybeSingle()
          : { data: null }
        const result = await syncBrevoContact(serviceClient, {
          userId: row.user_id,
          email: row.email,
          fullName: profile?.full_name,
          nif: profile?.nif,
          product: product?.title,
          productId: row.source_product_id,
          orderId: row.source_order_id,
          source: row.consent_source,
          consentAt: row.consent_at,
          consentEvidence: row.consent_evidence,
        })
        await serviceClient.from("brevo_contact_syncs").update({
          status: "synced",
          brevo_contact_id: result.contactId,
          list_id: result.listId,
          consent_group_id: result.consentGroupId,
          attributes: result.attributes,
          remote_snapshot: result,
          last_synced_at: new Date().toISOString(),
          last_error: null,
          attempt_count: Number(row.attempt_count ?? 0) + 1,
        }).eq("id", row.id)
        synced += 1
      } catch (syncError) {
        const attempts = Number(row.attempt_count ?? 0) + 1
        await serviceClient.from("brevo_contact_syncs").update({
          status: "failed",
          attempt_count: attempts,
          last_error: safeBrevoError(syncError),
          next_attempt_at: new Date(Date.now() + Math.min(60 * 60 * 1000, attempts * 5 * 60 * 1000)).toISOString(),
        }).eq("id", row.id)
        failed += 1
      }
    }
    return jsonResponse({ success: true, request_id: requestId, scanned: rows?.length ?? 0, synced, failed })
  } catch (error) {
    logError("Cron Brevo contact sync failed", { request_id: requestId, error: safeBrevoError(error) })
    return errorResponse(error, requestId)
  }
})
