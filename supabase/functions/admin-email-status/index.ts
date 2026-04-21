import { requireAdmin } from "../_shared/auth.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { getEmailEnvironmentStatus } from "../_shared/mod.ts"

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
    const email = getEmailEnvironmentStatus()

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
