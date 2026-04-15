import { supabase } from "@/integrations/supabase"

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

export interface GenerateAssetAccessInput {
  assetId?: string
}

export type EdgeFunctionSuccess<T> = {
  success: true
  request_id: string
} & T

async function invokeFunction<TInput, TOutput>(name: string, payload: TInput) {
  const { data, error } = await supabase.functions.invoke<TOutput>(name, {
    body: payload,
  })

  if (error) {
    throw error
  }

  return data
}

export function createCheckoutSession(input: CreateCheckoutInput) {
  return invokeFunction<CreateCheckoutInput, unknown>("create-checkout", input)
}

export function claimFreeProduct(input: ClaimFreeProductInput) {
  return invokeFunction<ClaimFreeProductInput, unknown>("claim-free-product", input)
}

export function generateAssetAccess(input: GenerateAssetAccessInput) {
  return invokeFunction<GenerateAssetAccessInput, unknown>("generate-asset-access", input)
}
