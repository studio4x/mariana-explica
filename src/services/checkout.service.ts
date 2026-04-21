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
  successUrl?: string | null
  cancelUrl?: string | null
}

export interface ClaimFreeProductInput {
  productId?: string
  productSlug?: string
}

async function invokeFunction<TResponse>(name: string, body: unknown) {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessao expirada. Entre novamente para continuar.")
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(typeof body === "object" && body !== null ? body : {}),
      access_token: auth.accessToken,
    }),
  })

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
