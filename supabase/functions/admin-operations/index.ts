import { badRequest, unprocessable } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

interface ListOperationsInput {
  action: "list"
}

interface RetryEmailInput {
  action: "retry_email"
  emailDeliveryId: string
}

type AdminOperationsInput = ListOperationsInput | RetryEmailInput

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
    const body = await readJsonBody<AdminOperationsInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "list") {
      const [{ data: emailDeliveries, error: emailError }, { data: jobRuns, error: jobError }] =
        await Promise.all([
          context.serviceClient
            .from("email_deliveries")
            .select(
              "id,user_id,notification_id,email_to,template_key,provider,provider_message_id,status,error_message,sent_at,created_at,subject",
            )
            .order("created_at", { ascending: false })
            .limit(40),
          context.serviceClient
            .from("job_runs")
            .select("id,job_name,status,started_at,finished_at,payload,result,error_message,idempotency_key,created_at")
            .order("started_at", { ascending: false })
            .limit(30),
        ])

      if (emailError) {
        throw emailError
      }

      if (jobError) {
        throw jobError
      }

      const queuedEmails = (emailDeliveries ?? []).filter((item) => item.status === "queued").length
      const failedEmails = (emailDeliveries ?? []).filter(
        (item) => item.status === "failed" || item.status === "bounced",
      ).length
      const failedJobs = (jobRuns ?? []).filter((job) => job.status === "failed").length

      return jsonResponse({
        success: true,
        request_id: requestId,
        summary: {
          queuedEmails,
          failedEmails,
          failedJobs,
          deliveredEmails: (emailDeliveries ?? []).filter(
            (item) => item.status === "sent" || item.status === "delivered",
          ).length,
        },
        emailDeliveries: emailDeliveries ?? [],
        jobRuns: jobRuns ?? [],
      })
    }

    if (body.action === "retry_email") {
      if (!body.emailDeliveryId) {
        throw badRequest("emailDeliveryId e obrigatorio")
      }

      const { data: delivery, error: deliveryError } = await context.serviceClient
        .from("email_deliveries")
        .select(
          "id,user_id,notification_id,email_to,template_key,provider,provider_message_id,status,error_message,sent_at,created_at,subject",
        )
        .eq("id", body.emailDeliveryId)
        .single()

      if (deliveryError) {
        throw deliveryError
      }

      if (delivery.status === "sent" || delivery.status === "delivered") {
        throw unprocessable("Este email ja foi entregue e nao precisa de reprocessamento")
      }

      const { data: updatedDelivery, error: updateError } = await context.serviceClient
        .from("email_deliveries")
        .update({
          status: "queued",
          error_message: null,
          provider_message_id: null,
          sent_at: null,
        })
        .eq("id", body.emailDeliveryId)
        .select(
          "id,user_id,notification_id,email_to,template_key,provider,provider_message_id,status,error_message,sent_at,created_at,subject",
        )
        .single()

      if (updateError) {
        throw updateError
      }

      const { error: jobError } = await context.serviceClient.from("job_runs").insert({
        job_name: "admin_retry_email_delivery",
        status: "success",
        payload: {
          email_delivery_id: delivery.id,
          previous_status: delivery.status,
        },
        result: {
          requeued: true,
          email_to: delivery.email_to,
          template_key: delivery.template_key,
        },
        idempotency_key: `retry:${delivery.id}:${Date.now()}`,
        finished_at: new Date().toISOString(),
      })

      if (jobError) {
        throw jobError
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.email_delivery_requeued",
        entityType: "email_delivery",
        entityId: delivery.id,
        metadata: {
          email_to: delivery.email_to,
          template_key: delivery.template_key,
          previous_status: delivery.status,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        emailDelivery: updatedDelivery,
      })
    }

    throw badRequest("Acao invalida")
  } catch (error) {
    logError("Admin operations action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
