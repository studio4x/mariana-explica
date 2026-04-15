import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { badRequest, conflict, forbidden, notFound, unprocessable } from "./errors.ts"

export interface ProductRow {
  id: string
  slug: string
  title: string
  short_description: string | null
  description: string | null
  product_type: "paid" | "free" | "hybrid" | "external_service"
  status: "draft" | "published" | "archived"
  price_cents: number
  currency: string
  sales_page_enabled: boolean
  requires_auth: boolean
  allow_affiliate: boolean
}

export interface CouponRow {
  id: string
  code: string
  discount_type: "percentage" | "fixed"
  discount_value: number
  status: "active" | "inactive" | "expired"
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  max_uses_per_user: number | null
  current_uses: number
  minimum_order_cents: number | null
}

export interface AffiliateRow {
  id: string
  user_id: string
  affiliate_code: string
  status: "active" | "inactive" | "blocked"
  commission_type: "percentage" | "fixed"
  commission_value: number
}

export interface OrderRow {
  id: string
  user_id: string
  product_id: string
  coupon_id: string | null
  affiliate_id: string | null
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
  currency: string
  base_price_cents: number
  discount_cents: number
  final_price_cents: number
  payment_provider: string | null
  payment_reference: string | null
  checkout_session_id: string | null
}

export interface OrderTotals {
  basePriceCents: number
  discountCents: number
  finalPriceCents: number
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function getProductByIdentifier(client: SupabaseClient, identifier: string) {
  const query = client
    .from("products")
    .select(
      "id,slug,title,short_description,description,product_type,status,price_cents,currency,sales_page_enabled,requires_auth,allow_affiliate",
    )

  const { data, error } = await (isUuid(identifier)
    ? query.eq("id", identifier).maybeSingle()
    : query.eq("slug", identifier).maybeSingle())

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Produto não encontrado")
  }

  return data as ProductRow
}

export async function resolveCouponByCode(client: SupabaseClient, code?: string | null) {
  if (!code) {
    return null
  }

  const normalized = normalizeCode(code)
  const { data, error } = await client
    .from("coupons")
    .select(
      "id,code,discount_type,discount_value,status,starts_at,expires_at,max_uses,max_uses_per_user,current_uses,minimum_order_cents",
    )
    .eq("code", normalized)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as CouponRow | null
}

export async function resolveAffiliateByCode(client: SupabaseClient, code?: string | null) {
  if (!code) {
    return null
  }

  const normalized = normalizeCode(code)
  const { data, error } = await client
    .from("affiliates")
    .select("id,user_id,affiliate_code,status,commission_type,commission_value")
    .eq("affiliate_code", normalized)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as AffiliateRow | null
}

export function calculateCouponDiscount(
  basePriceCents: number,
  coupon: CouponRow,
  now = new Date(),
) {
  if (coupon.status !== "active") {
    throw forbidden("Cupom inativo")
  }

  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    throw forbidden("Cupom ainda não iniciou")
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    throw forbidden("Cupom expirado")
  }

  if (coupon.minimum_order_cents !== null && basePriceCents < coupon.minimum_order_cents) {
    throw unprocessable("Pedido não atinge o mínimo do cupom")
  }

  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
    throw conflict("Cupom esgotado")
  }

  let discountCents = 0
  if (coupon.discount_type === "percentage") {
    discountCents = Math.floor((basePriceCents * coupon.discount_value) / 100)
  } else {
    discountCents = coupon.discount_value
  }

  return Math.min(basePriceCents, Math.max(discountCents, 0))
}

export function calculateOrderTotals(basePriceCents: number, discountCents: number): OrderTotals {
  return {
    basePriceCents,
    discountCents,
    finalPriceCents: Math.max(basePriceCents - discountCents, 0),
  }
}

export async function countCouponUsagesByUser(
  client: SupabaseClient,
  couponId: string,
  userId: string,
) {
  const { count, error } = await client
    .from("coupon_usages")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", couponId)
    .eq("user_id", userId)

  if (error) {
    throw error
  }

  return count ?? 0
}

export function calculateAffiliateCommission(
  affiliate: AffiliateRow,
  finalPriceCents: number,
) {
  if (affiliate.commission_type === "percentage") {
    return Math.floor((finalPriceCents * affiliate.commission_value) / 100)
  }

  return Math.min(finalPriceCents, Math.max(affiliate.commission_value, 0))
}

export async function ensureActiveGrant(
  client: SupabaseClient,
  params: {
    userId: string
    productId: string
    sourceType: "purchase" | "free_claim" | "admin_grant" | "manual_adjustment"
    sourceOrderId?: string | null
    notes?: string | null
  },
) {
  const { data: existingGrant, error: lookupError } = await client
    .from("access_grants")
    .select("id,user_id,product_id,status,source_type,source_order_id")
    .eq("user_id", params.userId)
    .eq("product_id", params.productId)
    .eq("status", "active")
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existingGrant) {
    return { grant: existingGrant, created: false }
  }

  const { data, error } = await client
    .from("access_grants")
    .insert({
      user_id: params.userId,
      product_id: params.productId,
      source_type: params.sourceType,
      source_order_id: params.sourceOrderId ?? null,
      status: "active",
      notes: params.notes ?? null,
      granted_at: new Date().toISOString(),
    })
    .select("id,user_id,product_id,status,source_type,source_order_id")
    .single()

  if (error) {
    throw error
  }

  return { grant: data, created: true }
}

export async function createOrderWithItems(
  client: SupabaseClient,
  params: {
    userId: string
    product: ProductRow
    totals: OrderTotals
    couponId?: string | null
    affiliateId?: string | null
    paymentProvider?: string | null
    paymentReference?: string | null
    checkoutSessionId?: string | null
    status?: OrderRow["status"]
    paidAt?: string | null
  },
) {
  const { data: order, error: orderError } = await client
    .from("orders")
    .insert({
      user_id: params.userId,
      product_id: params.product.id,
      coupon_id: params.couponId ?? null,
      affiliate_id: params.affiliateId ?? null,
      status: params.status ?? "pending",
      currency: params.product.currency,
      base_price_cents: params.totals.basePriceCents,
      discount_cents: params.totals.discountCents,
      final_price_cents: params.totals.finalPriceCents,
      payment_provider: params.paymentProvider ?? null,
      payment_reference: params.paymentReference ?? null,
      checkout_session_id: params.checkoutSessionId ?? null,
      paid_at: params.paidAt ?? null,
    })
    .select(
      "id,user_id,product_id,coupon_id,affiliate_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id",
    )
    .single()

  if (orderError) {
    throw orderError
  }

  const { error: itemError } = await client.from("order_items").insert({
    order_id: order.id,
    product_id: params.product.id,
    product_title_snapshot: params.product.title,
    unit_price_cents: params.totals.basePriceCents,
    discount_cents: params.totals.discountCents,
    final_price_cents: params.totals.finalPriceCents,
  })

  if (itemError) {
    throw itemError
  }

  return order as OrderRow
}

export async function recordCouponUsage(
  client: SupabaseClient,
  params: {
    couponId: string
    userId: string
    orderId: string
    discountCents: number
  },
) {
  const { data: existing } = await client
    .from("coupon_usages")
    .select("id")
    .eq("order_id", params.orderId)
    .maybeSingle()

  if (existing) {
    return { created: false }
  }

  const { error } = await client.from("coupon_usages").insert({
    coupon_id: params.couponId,
    user_id: params.userId,
    order_id: params.orderId,
    discount_cents: params.discountCents,
  })

  if (error) {
    throw error
  }

  const { data: coupon, error: couponError } = await client
    .from("coupons")
    .select("current_uses")
    .eq("id", params.couponId)
    .maybeSingle()

  if (couponError) {
    throw couponError
  }

  if (coupon) {
    const { error: updateError } = await client
      .from("coupons")
      .update({ current_uses: coupon.current_uses + 1 })
      .eq("id", params.couponId)

    if (updateError) {
      throw updateError
    }
  }

  return { created: true }
}

export async function recordAffiliateReferral(
  client: SupabaseClient,
  params: {
    affiliateId: string
    userId: string
    productId: string
    orderId: string
    referralCode: string
    commissionCents: number
  },
) {
  const { data: existing } = await client
    .from("affiliate_referrals")
    .select("id")
    .eq("order_id", params.orderId)
    .maybeSingle()

  if (existing) {
    return { created: false }
  }

  const { error } = await client.from("affiliate_referrals").insert({
    affiliate_id: params.affiliateId,
    user_id: params.userId,
    product_id: params.productId,
    order_id: params.orderId,
    referral_code: params.referralCode,
    status: "converted",
    commission_cents: params.commissionCents,
    tracked_at: new Date().toISOString(),
    converted_at: new Date().toISOString(),
  })

  if (error) {
    throw error
  }

  return { created: true }
}

export async function updateOrderAfterPayment(
  client: SupabaseClient,
  params: {
    orderId: string
    paymentReference: string
    paidAt: string
  },
) {
  const { data, error } = await client
    .from("orders")
    .update({
      status: "paid",
      payment_reference: params.paymentReference,
      paid_at: params.paidAt,
    })
    .eq("id", params.orderId)
    .select(
      "id,user_id,product_id,coupon_id,affiliate_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id",
    )
    .single()

  if (error) {
    throw error
  }

  return data as OrderRow
}

export async function markOrderFailed(
  client: SupabaseClient,
  params: {
    orderId: string
    paymentReference: string
  },
) {
  const { data, error } = await client
    .from("orders")
    .update({
      status: "failed",
      payment_reference: params.paymentReference,
    })
    .eq("id", params.orderId)
    .select("id")
    .single()

  if (error) {
    throw error
  }

  return data as { id: string }
}

export async function findOrderForCheckoutSession(
  client: SupabaseClient,
  checkoutSessionId: string,
) {
  const { data, error } = await client
    .from("orders")
    .select(
      "id,user_id,product_id,coupon_id,affiliate_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id",
    )
    .eq("checkout_session_id", checkoutSessionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Pedido não encontrado")
  }

  return data as OrderRow
}

export function assertPaidProduct(product: ProductRow) {
  if (product.status !== "published") {
    throw forbidden("Produto indisponível")
  }

  if (product.product_type === "external_service") {
    throw badRequest("Produto externo não usa checkout interno")
  }
}

