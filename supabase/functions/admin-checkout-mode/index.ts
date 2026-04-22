import { badRequest } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireAdmin } from "../_shared/mod.ts"

type CheckoutMode = "test" | "live"

type AdminCheckoutModeInput =
  | {
      action: "get"
    }
  | {
      action: "update"
      mode: "sandbox" | "production"
    }

const CHECKOUT_MODE_CONFIG_KEY = "checkout_environment"

function normalizeMode(value: unknown): CheckoutMode {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "live" || raw === "production") {
    return "live"
  }
  return "test"
}

function buildCheckoutModeRow(mode: CheckoutMode, description = "Configuracao operacional do ambiente do checkout Stripe.") {
  return {
    config_key: CHECKOUT_MODE_CONFIG_KEY,
    config_value: { mode },
    description,
    is_public: false,
  }
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

    const context = await requireAdmin(req)
    const body = await readJsonBody<AdminCheckoutModeInput>(req)

    if (body.action === "get") {
      const { data, error } = await context.serviceClient
        .from("site_config")
        .select("config_key,config_value,description,is_public,updated_at")
        .eq("config_key", CHECKOUT_MODE_CONFIG_KEY)
        .maybeSingle()

      if (error) {
        throw error
      }

      return jsonResponse({
        success: true,
        request_id: requestId,
        checkout_mode: data
          ? {
              ...data,
              config_value: {
                mode: normalizeMode((data.config_value as Record<string, unknown> | null)?.mode),
              },
            }
          : null,
      })
    }

    const payload = buildCheckoutModeRow(body.mode === "production" ? "live" : "test")

    const siteConfigTable = context.serviceClient.from("site_config") as unknown as {
      upsert: (...args: unknown[]) => {
        select: (columns: string) => {
          single: () => Promise<{
            data: {
              config_key: string
              config_value: { mode: CheckoutMode }
              description: string | null
              is_public: boolean
              updated_at: string | null
            } | null
            error: Error | null
          }>
        }
      }
    }

    const { data, error } = await siteConfigTable
      .upsert(payload, { onConflict: "config_key" })
      .select("config_key,config_value,description,is_public,updated_at")
      .single()

    if (error) {
      throw error
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      checkout_mode: data,
    })
  } catch (error) {
    logError("Admin checkout mode action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
