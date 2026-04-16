import { supabase } from "@/integrations/supabase"
import { getFunctionAuthHeaders } from "@/services/supabase-auth"
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
  const headers = await getFunctionAuthHeaders()
  const { data, error } = (await supabase.functions.invoke(name, {
    body: body as never,
    headers,
  })) as { data: TResponse | null; error: Error | null }

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(`A função ${name} não retornou dados`)
  }

  return data
}

export function createCheckoutSession(input: CreateCheckoutInput) {
  return invokeFunction<CreateCheckoutResponse>("create-checkout", input)
}

export function claimFreeProduct(input: ClaimFreeProductInput) {
  return invokeFunction<ClaimFreeProductResponse>("claim-free-product", input)
}
