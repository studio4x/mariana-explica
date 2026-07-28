import { requireAdmin } from "../_shared/auth.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { fetchBrevoSettings, getBrevoCredentialStatus } from "../_shared/mod.ts"

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  try {
    if (req.method === "OPTIONS") {
      return corsResponse()
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          request_id: requestId,
          code: "METHOD_NOT_ALLOWED",
          message: "Metodo nao suportado",
        },
        405,
      )
    }

    const context = await requireAdmin(req)
    const [credentials, settings] = await Promise.all([
      getBrevoCredentialStatus(context.serviceClient),
      fetchBrevoSettings(context.serviceClient),
    ])
    const email = {
      providerName: "brevo",
      transport: "brevo" as const,
      senderNamePresent: Boolean(settings.sender_name),
      senderAddressPresent: Boolean(settings.sender_email),
      replyToPresent: Boolean(settings.reply_to),
      smtpHostPresent: false,
      smtpPortPresent: false,
      smtpUserPresent: false,
      smtpPasswordPresent: false,
      ready: credentials.configured && settings.enabled && Boolean(settings.sender_email),
      missing: [
        ...(!credentials.configured ? ["BREVO_API_KEY"] : []),
        ...(!settings.enabled ? ["integração Brevo ativa"] : []),
        ...(!settings.sender_email ? ["remetente Brevo"] : []),
      ],
      credentials,
      settings,
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      email,
      checked_by: context.user.id,
    })
  } catch (error) {
    logError("Admin email status failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
