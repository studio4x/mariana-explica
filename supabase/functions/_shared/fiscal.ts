import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { HttpError } from "./errors.ts"

export type PaymentEnvironment = "test" | "live"
export type MoloniEnvironment = "draft" | "live"

export interface StripeCustomerDetails {
  name?: string | null
  email?: string | null
  customer?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    postal_code?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
  } | null
  tax_ids?: Array<{
    type?: string | null
    value?: string | null
  }> | null
}

export function normalizeVatNumber(value?: string | null) {
  const normalized = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return normalized || null
}

export function isValidPortugueseNif(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (!/^[1235689]\d{8}$/.test(digits) || /^(\d)\1{8}$/.test(digits)) {
    return false
  }

  const sum = digits
    .slice(0, 8)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (9 - index), 0)
  const remainder = sum % 11
  const checkDigit = remainder < 2 ? 0 : 11 - remainder
  return checkDigit === Number(digits[8])
}

export function normalizeIso2(value?: string | null) {
  const normalized = String(value ?? "").trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

export function normalizeEmail(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function createInitialBillingSnapshot(
  client: SupabaseClient,
  params: {
    orderId: string
    userId: string
    legalName?: string | null
    email?: string | null
    vatNumber?: string | null
    customerType?: "individual" | "company"
  },
) {
  const vatNumber = normalizeVatNumber(params.vatNumber)
  const payload = {
    order_id: params.orderId,
    user_id: params.userId,
    customer_type: params.customerType ?? "individual",
    legal_name: String(params.legalName ?? "").trim() || null,
    email: normalizeEmail(params.email),
    vat_number: vatNumber,
    vat_country: vatNumber ? "PT" : null,
    source: "platform",
    review_status: "incomplete",
    review_reason: null,
    completed_at: null,
  }
  const snapshotHash = await sha256(JSON.stringify(payload))

  const { data, error } = await client
    .from("order_billing_details")
    .upsert({ ...payload, snapshot_hash: snapshotHash }, { onConflict: "order_id", ignoreDuplicates: true })
    .select("id,order_id,user_id,review_status")
    .maybeSingle()

  if (error) throw error
  if (data) return data

  const { data: existing, error: existingError } = await client
    .from("order_billing_details")
    .select("id,order_id,user_id,review_status")
    .eq("order_id", params.orderId)
    .single()
  if (existingError) throw existingError
  return existing
}

export async function completeBillingSnapshotFromStripe(
  client: SupabaseClient,
  params: {
    orderId: string
    userId: string
    stripeCustomerId?: string | null
    customerDetails?: StripeCustomerDetails | null
  },
) {
  const { data: existing, error: lookupError } = await client
    .from("order_billing_details")
    .select("*")
    .eq("order_id", params.orderId)
    .maybeSingle()

  if (lookupError) throw lookupError

  const details = params.customerDetails ?? {}
  const address = details.address ?? {}
  const stripeTax = details.tax_ids?.find((taxId) => taxId.value)?.value ?? null
  const stripeVatNumber = normalizeVatNumber(stripeTax)
  const platformVatNumber = normalizeVatNumber(existing?.vat_number)
  const hasVatConflict = Boolean(
    platformVatNumber && stripeVatNumber && platformVatNumber !== stripeVatNumber,
  )

  const snapshot = {
    order_id: params.orderId,
    user_id: params.userId,
    customer_type: existing?.customer_type ?? "individual",
    legal_name: existing?.legal_name || String(details.name ?? "").trim() || null,
    email: existing?.email || normalizeEmail(details.email),
    vat_number: platformVatNumber || stripeVatNumber,
    vat_country: existing?.vat_country || (platformVatNumber || stripeVatNumber ? "PT" : null),
    address_line1: String(address.line1 ?? existing?.address_line1 ?? "").trim() || null,
    address_line2: String(address.line2 ?? existing?.address_line2 ?? "").trim() || null,
    postal_code: String(address.postal_code ?? existing?.postal_code ?? "").trim() || null,
    city: String(address.city ?? existing?.city ?? "").trim() || null,
    state: String(address.state ?? existing?.state ?? "").trim() || null,
    country_code: normalizeIso2(address.country) || normalizeIso2(existing?.country_code),
    stripe_customer_id: params.stripeCustomerId ?? existing?.stripe_customer_id ?? null,
    stripe_tax_id_type:
      details.tax_ids?.find((taxId) => taxId.value)?.type ?? existing?.stripe_tax_id_type ?? null,
    source: existing ? "merged" : "stripe",
  }

  const missing = [
    !snapshot.legal_name ? "legal_name" : null,
    !snapshot.email ? "email" : null,
    !snapshot.address_line1 ? "address_line1" : null,
    !snapshot.postal_code ? "postal_code" : null,
    !snapshot.city ? "city" : null,
    !snapshot.country_code ? "country_code" : null,
  ].filter(Boolean)
  const reviewStatus = hasVatConflict
    ? "requires_review"
    : missing.length > 0
      ? "incomplete"
      : "complete"
  const reviewReason = hasVatConflict
    ? "NIF informado na plataforma diverge do identificador fiscal devolvido pela Stripe."
    : missing.length > 0
      ? `Campos fiscais ausentes: ${missing.join(", ")}.`
      : null
  const completedAt = reviewStatus === "complete" ? new Date().toISOString() : null
  const snapshotHash = await sha256(JSON.stringify(snapshot))

  const { data, error } = await client
    .from("order_billing_details")
    .upsert({
      ...snapshot,
      review_status: reviewStatus,
      review_reason: reviewReason,
      snapshot_hash: snapshotHash,
      completed_at: completedAt,
    }, { onConflict: "order_id" })
    .select("id,order_id,user_id,review_status,review_reason,completed_at")
    .single()

  if (error) throw error
  return data
}

export async function ensureOrderFiscalOutbox(client: SupabaseClient, orderId: string) {
  const { data, error } = await client.rpc("ensure_order_fiscal_outbox", { p_order_id: orderId })
  if (error) throw error
  return data as string | null
}

export async function queueFiscalAdjustmentReview(
  client: SupabaseClient,
  params: {
    orderId: string
    userId: string
    stripeEventId?: string | null
    stripeRefundId?: string | null
    adjustmentType: "refund_partial" | "refund_full" | "chargeback"
    amountCents: number
    currency: string
  },
) {
  if (params.adjustmentType !== "refund_partial") {
    const { data: existingRequest, error: existingRequestError } = await client
      .from("fiscal_adjustment_requests")
      .select("id,status")
      .eq("order_id", params.orderId)
      .eq("adjustment_type", params.adjustmentType)
      .maybeSingle()
    if (existingRequestError) throw existingRequestError
    if (existingRequest) return existingRequest
  }

  const { data: original } = await client
    .from("fiscal_documents")
    .select("id")
    .eq("order_id", params.orderId)
    .is("original_fiscal_document_id", null)
    .maybeSingle()

  const { data, error } = await client
    .from("fiscal_adjustment_requests")
    .upsert({
      order_id: params.orderId,
      user_id: params.userId,
      original_fiscal_document_id: original?.id ?? null,
      stripe_event_id: params.stripeEventId ?? null,
      stripe_refund_id: params.stripeRefundId ?? null,
      adjustment_type: params.adjustmentType,
      status: "requires_review",
      amount_cents: Math.max(1, Math.trunc(params.amountCents)),
      currency: params.currency.toUpperCase(),
    }, {
      onConflict: params.stripeRefundId ? "stripe_refund_id" : "stripe_event_id",
      ignoreDuplicates: true,
    })
    .select("id,status")
    .maybeSingle()

  if (error && error.code === "23505") {
    const { data: existingRequest, error: lookupError } = await client
      .from("fiscal_adjustment_requests")
      .select("id,status")
      .eq("order_id", params.orderId)
      .eq("adjustment_type", params.adjustmentType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lookupError) throw lookupError
    return existingRequest
  }
  if (error) throw error
  return data
}

export async function claimStripeEvent(client: SupabaseClient, eventId: string, eventType: string) {
  const { data, error } = await client.rpc("claim_stripe_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_lock_timeout_seconds: 300,
  })
  if (error) throw error
  return data as "claimed" | "completed" | "busy"
}

export async function completeStripeEvent(client: SupabaseClient, eventId: string) {
  const { error } = await client.rpc("complete_stripe_event", { p_event_id: eventId })
  if (error) throw error
}

export async function failStripeEvent(client: SupabaseClient, eventId: string, errorMessage: string) {
  const { error } = await client.rpc("fail_stripe_event", {
    p_event_id: eventId,
    p_error: errorMessage.slice(0, 500),
  })
  if (error) throw error
}

export function buildFiscalIdempotencyKey(params: {
  environment: MoloniEnvironment
  orderId: string
  documentKind: string
  version?: number
}) {
  return `moloni:${params.environment}:${params.orderId}:${params.documentKind}:v${params.version ?? 1}`
}

export async function assertAdminIntegrationRateLimit(
  client: SupabaseClient,
  actorUserId: string,
  actionKey: string,
  limit = 20,
) {
  const { data, error } = await client.rpc("claim_admin_integration_rate_limit", {
    p_actor_user_id: actorUserId,
    p_action_key: actionKey,
    p_limit: limit,
  })
  if (error) throw error
  if (!data) {
    throw new HttpError(429, "RATE_LIMITED", "Muitas ações administrativas. Aguarde um minuto.")
  }
}
