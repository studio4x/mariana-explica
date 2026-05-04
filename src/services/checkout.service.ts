import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"
import type {
  ClaimFreeProductResponse,
  CreateCheckoutResponse,
} from "@/types/product.types"

export interface CreateCheckoutInput {
  productId?: string
  productSlug?: string
  couponCode?: string | null
  affiliateCode?: string | null
  customerEmail?: string | null
  invoiceWithNif?: boolean
  customerNif?: string | null
  contentUpdatesConsent?: boolean
  successUrl?: string | null
  cancelUrl?: string | null
}

export interface ClaimFreeProductInput {
  productId?: string
  productSlug?: string
}

const RETRYABLE_NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
]

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof TypeError)) return false

  const message = error.message.toLowerCase()
  return RETRYABLE_NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

async function invokeFunction<TResponse>(name: string, body: unknown) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessao expirada. Entre novamente para continuar.")
  }

  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`
  const requestBody = JSON.stringify({
    ...(typeof body === "object" && body !== null ? body : {}),
    access_token: auth.accessToken,
  })
  let response: Response | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: auth.headers.Authorization,
          "Content-Type": "application/json",
        },
        body: requestBody,
      })
      break
    } catch (error) {
      if (attempt === 0 && isRetryableNetworkError(error)) {
        await delay(700)
        continue
      }

      throw error
    }
  }

  if (!response) {
    throw new Error("Nao foi possivel contactar o servidor. Tenta novamente dentro de instantes.")
  }

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  if (!data || typeof data !== "object") {
    throw new Error(`A funcao ${name} nao retornou dados`)
  }

  return data as TResponse
}

export function createCheckoutSession(input: CreateCheckoutInput) {
  return invokeFunction<CreateCheckoutResponse>("create-checkout", input)
}

export function claimFreeProduct(input: ClaimFreeProductInput) {
  return invokeFunction<ClaimFreeProductResponse>("claim-free-product", input)
}
