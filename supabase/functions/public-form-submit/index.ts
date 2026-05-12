import { badRequest } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  buildManualNotificationEmail,
  queueEmailDelivery,
} from "../_shared/mod.ts"
import { createServiceClient } from "../_shared/supabase.ts"

interface PublicFormSubmissionInput {
  formType?: string
  sourcePage?: string
  fullName?: string
  email?: string
  subject?: string
  message?: string
  metadata?: Record<string, unknown> | null
}

const FORM_NOTIFICATION_CONFIG_KEY = "public_form_notifications"
const DEFAULT_FORM_TYPE = "explicacoes"
const DEFAULT_SOURCE_PAGE = "/explicacoes"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
}

function normalizeMessage(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 20)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, itemValue]) => {
      if (itemValue === null || itemValue === undefined) {
        return [key, null] as const
      }

      if (typeof itemValue === "string") {
        return [key, itemValue.slice(0, 500)] as const
      }

      if (typeof itemValue === "number" || typeof itemValue === "boolean") {
        return [key, itemValue] as const
      }

      return [key, String(itemValue).slice(0, 500)] as const
    })

  return Object.fromEntries(entries)
}

function resolveNotificationEmail(configValue: unknown) {
  if (!configValue || typeof configValue !== "object") {
    return null
  }

  const rawEmail = String((configValue as Record<string, unknown>).notification_email ?? "")
    .trim()
    .toLowerCase()

  if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
    return null
  }

  return rawEmail
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

    const body = await readJsonBody<PublicFormSubmissionInput>(req)
    const formType = normalizeText(body.formType ?? DEFAULT_FORM_TYPE, 80).toLowerCase() || DEFAULT_FORM_TYPE
    const sourcePage = normalizeText(body.sourcePage ?? DEFAULT_SOURCE_PAGE, 180) || DEFAULT_SOURCE_PAGE
    const fullName = normalizeText(body.fullName, 140)
    const email = normalizeText(body.email, 180).toLowerCase()
    const subject = normalizeText(body.subject, 180)
    const message = normalizeMessage(body.message, 5000)
    const metadata = sanitizeMetadata(body.metadata)

    if (fullName.length < 2) {
      throw badRequest("Nome invalido")
    }

    if (!EMAIL_PATTERN.test(email)) {
      throw badRequest("Email invalido")
    }

    if (subject.length < 2) {
      throw badRequest("Assunto invalido")
    }

    if (message.length < 8) {
      throw badRequest("Mensagem invalida")
    }

    const serviceClient = createServiceClient()

    const { data: submission, error: submissionError } = await serviceClient
      .from("public_form_submissions")
      .insert({
        form_type: formType,
        source_page: sourcePage,
        full_name: fullName,
        email,
        subject,
        message,
        metadata,
      })
      .select("id")
      .single()

    if (submissionError) {
      throw submissionError
    }

    const { data: configRow, error: configError } = await serviceClient
      .from("site_config")
      .select("config_value")
      .eq("config_key", FORM_NOTIFICATION_CONFIG_KEY)
      .maybeSingle()

    if (configError) {
      throw configError
    }

    const notificationEmail = resolveNotificationEmail(configRow?.config_value ?? null)

    if (notificationEmail) {
      const shortMessage = [
        `Origem: ${sourcePage}`,
        `Nome: ${fullName}`,
        `Email: ${email}`,
        `Assunto: ${subject}`,
        `Mensagem: ${message.slice(0, 500)}`,
      ].join("\n")

      const delivery = buildManualNotificationEmail({
        title: "Novo formulario publico recebido",
        message: shortMessage,
        ctaUrl: "/admin/formularios",
      })

      await queueEmailDelivery(serviceClient, {
        userId: null,
        notificationId: null,
        emailTo: notificationEmail,
        templateKey: "manual_notification",
        subject: delivery.subject,
        html: delivery.html,
        text: delivery.text,
        metadata: {
          source: "public_form_submit",
          submission_id: submission.id,
          form_type: formType,
          source_page: sourcePage,
          from_email: email,
        },
      })

      const { error: markNotifiedError } = await serviceClient
        .from("public_form_submissions")
        .update({
          notified_email_to: notificationEmail,
          notified_at: new Date().toISOString(),
        })
        .eq("id", submission.id)

      if (markNotifiedError) {
        throw markNotifiedError
      }
    }

    const { data: adminRecipients, error: adminRecipientsError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_admin", true)
      .eq("status", "active")

    if (adminRecipientsError) {
      throw adminRecipientsError
    }

    if ((adminRecipients ?? []).length > 0) {
      const { error: adminNotificationError } = await serviceClient.from("notifications").insert(
        (adminRecipients ?? []).map((admin) => ({
          user_id: admin.id,
          type: "support",
          title: "Novo formulario publico",
          message: `${fullName} (${email}) enviou: ${subject}`.slice(0, 180),
          link: "/admin/formularios",
          status: "unread",
          sent_via_email: false,
          sent_via_in_app: true,
        })),
      )

      if (adminNotificationError) {
        throw adminNotificationError
      }
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      submission_id: submission.id,
    })
  } catch (error) {
    logError("Public form submission failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
