import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { conflict, notFound } from "./errors.ts"
import { ensureActiveGrant, revokeActiveGrantForOrder, updateOrderStatus } from "./commerce.ts"
import { getStripeCheckoutSession } from "./payments.ts"

export interface ReconcilableOrderRow {
  id: string
  user_id: string
  product_id: string
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
  currency: string
  final_price_cents: number
  checkout_session_id: string | null
  payment_reference: string | null
  payment_environment?: "test" | "live" | null
  paid_at?: string | null
  refunded_at?: string | null
}

export interface ReconciliationResult {
  order: ReconcilableOrderRow
  grants: unknown[]
  stripe: Awaited<ReturnType<typeof getStripeCheckoutSession>>
  action: "noop" | "mark_paid" | "mark_failed"
}

export async function findReconcilableOrder(
  client: SupabaseClient,
  orderId: string,
) {
  const { data, error } = await client
    .from("orders")
    .select(
      "id,user_id,product_id,status,currency,final_price_cents,checkout_session_id,payment_reference,payment_environment,paid_at,refunded_at",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Pedido nao encontrado")
  }

  return data as ReconcilableOrderRow
}

export async function reconcileOrderWithStripe(
  client: SupabaseClient,
  order: ReconcilableOrderRow,
): Promise<ReconciliationResult> {
  if (!order.checkout_session_id) {
    throw notFound("Pedido sem checkout_session_id para reconciliacao")
  }

  const session = await getStripeCheckoutSession(order.checkout_session_id, {
    mode: order.payment_environment ?? undefined,
  })

  if (
    session.amount_total !== null &&
    session.amount_total !== undefined &&
    session.amount_total !== order.final_price_cents
  ) {
    throw conflict("Total externo diverge do pedido interno")
  }

  if (session.currency && session.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw conflict("Moeda externa diverge do pedido interno")
  }

  let updatedOrder = order
  let grants: unknown[] = []
  let action: ReconciliationResult["action"] = "noop"

  if (session.payment_status === "paid" && session.status === "complete") {
    updatedOrder = await updateOrderStatus(client, {
      orderId: order.id,
      status: "paid",
      paymentReference: session.payment_intent ?? session.id,
      paidAt: order.paid_at ?? new Date().toISOString(),
    })

    const grant = await ensureActiveGrant(client, {
      userId: order.user_id,
      productId: order.product_id,
      sourceType: "purchase",
      sourceOrderId: order.id,
    })
    grants = [grant.grant]
    action = "mark_paid"
  } else if (session.status === "expired") {
    updatedOrder = await updateOrderStatus(client, {
      orderId: order.id,
      status: "failed",
      paymentReference: session.payment_intent ?? session.id,
    })
    grants = await revokeActiveGrantForOrder(client, {
      orderId: order.id,
      reason: "Acesso revogado durante reconciliacao de pedido expirado",
    })
    action = "mark_failed"
  }

  return {
    order: updatedOrder,
    grants,
    stripe: session,
    action,
  }
}
