import { requireAdmin } from "../_shared/auth.ts"
import { internalError } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { getStripeEnvironment, type StripeEnvironment } from "../_shared/payments.ts"

async function validateStripeKey(secret: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)

  try {
    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      return { valid: false }
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null
    return { valid: Boolean(payload?.id) }
  } catch {
    return { valid: false }
  } finally {
    clearTimeout(timeout)
  }
}

function readSecret(name: string) {
  const value = Deno.env.get(name)?.trim()
  return value ? value : null
}

function webhookSecretOk(value: string | null) {
  if (!value) {
    return false
  }
  return value.startsWith("whsec_") && value.length > 10
}

function stripeSecretOk(value: string | null, env: StripeEnvironment) {
  if (!value) {
    return false
  }
  return env === "live" ? value.startsWith("sk_live_") : value.startsWith("sk_test_")
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw internalError("Método não suportado")
    }

    const context = await requireAdmin(req)
    const stripeMode = getStripeEnvironment()

    const testSecret =
      readSecret("STRIPE_SECRET_KEY_TEST") ?? readSecret("STRIPE_SECRET_KEY")
    const liveSecret =
      readSecret("STRIPE_SECRET_KEY_LIVE") ?? readSecret("STRIPE_SECRET_KEY")

    const testWebhook =
      readSecret("STRIPE_WEBHOOK_SECRET_TEST") ?? readSecret("STRIPE_WEBHOOK_SECRET")
    const liveWebhook =
      readSecret("STRIPE_WEBHOOK_SECRET_LIVE") ?? readSecret("STRIPE_WEBHOOK_SECRET")

    const testSecretPresent = stripeSecretOk(testSecret, "test")
    const liveSecretPresent = stripeSecretOk(liveSecret, "live")

    const [testValidation, liveValidation] = await Promise.all([
      testSecretPresent ? validateStripeKey(testSecret as string) : Promise.resolve({ valid: false }),
      liveSecretPresent ? validateStripeKey(liveSecret as string) : Promise.resolve({ valid: false }),
    ])

    logInfo("Admin payments status checked", {
      request_id: requestId,
      user_id: context.user.id,
      stripe_mode: stripeMode,
      test_secret: testSecretPresent,
      live_secret: liveSecretPresent,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      stripe: {
        mode: stripeMode,
        test: {
          secret_present: testSecretPresent,
          secret_valid: testValidation.valid,
          webhook_present: webhookSecretOk(testWebhook),
        },
        live: {
          secret_present: liveSecretPresent,
          secret_valid: liveValidation.valid,
          webhook_present: webhookSecretOk(liveWebhook),
        },
      },
    })
  } catch (error) {
    logError("Admin payments status failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})

