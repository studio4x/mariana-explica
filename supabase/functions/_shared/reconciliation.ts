import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { conflict, notFound } from "./errors.ts"
import { ensureActiveGrant, revokeActiveGrantForOrder, updateOrderStatus } from "./commerce.ts"
import { getStripeCheckoutSession } from "./payments.ts"
import { isStripeCheckoutPaymentConfirmed } from "./stripe-checkout.ts"
import { completeBillingSnapshotFromStripe, ensureOrderFiscalOutbox } from "./fiscal.ts"

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
  tax_amount_cents: number
  total_paid_cents: number | null
  stripe_invoice_id: string | null
  paid_at?: string | null
  refunded_at?: string | null
}

export interface ReconciliationResult {
  order: ReconcilableOrderRow
  grants: unknown[]
  stripe: Awaited<ReturnType<typeof getStripeCheckoutSession>>
  action: "noop" | "mark_paid" | "mark_pending" | "mark_failed"
}

export async function findReconcilableOrder(
  client: SupabaseClient,
  orderId: string,
) {
  const { data, error } = await client
    .from("orders")
    .select(
      "id,user_id,product_id,status,currency,final_price_cents,checkout_session_id,payment_reference,payment_environment,tax_amount_cents,total_paid_cents,stripe_invoice_id,paid_at,refunded_at",
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
    session.amount_total < order.final_price_cents
  ) {
    throw conflict("Total externo é inferior ao total interno do pedido")
  }

  if (session.currency && session.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw conflict("Moeda externa diverge do pedido interno")
  }

  let updatedOrder = order
  let grants: unknown[] = []
  let action: ReconciliationResult["action"] = "noop"

  if (isStripeCheckoutPaymentConfirmed(session)) {
    updatedOrder = await updateOrderStatus(client, {
      orderId: order.id,
      status: "paid",
      paymentReference: session.payment_intent ?? session.id,
      paidAt: order.paid_at ?? new Date().toISOString(),
      taxAmountCents: Math.max(session.total_details?.amount_tax ?? 0, 0),
      totalPaidCents: session.amount_total ?? order.final_price_cents,
      stripeInvoiceId: session.invoice ?? null,
    })

    const grant = await ensureActiveGrant(client, {
      userId: order.user_id,
      productId: order.product_id,
      sourceType: "purchase",
      sourceOrderId: order.id,
    })
    grants = [grant.grant]
    await completeBillingSnapshotFromStripe(client, {
      orderId: order.id,
      userId: order.user_id,
      stripeCustomerId: session.customer,
      customerDetails: session.customer_details,
    })
    await ensureOrderFiscalOutbox(client, order.id)
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
  } else {
    grants = await revokeActiveGrantForOrder(client, {
      orderId: order.id,
      reason: "Acesso revogado durante reconciliacao: pagamento Stripe ainda nao confirmado",
    })

    if (order.status === "paid" || grants.length > 0) {
      updatedOrder = await updateOrderStatus(client, {
        orderId: order.id,
        status: "pending",
        paymentReference: session.payment_intent ?? session.id,
        paidAt: null,
      })
      action = "mark_pending"
    }
  }

  return {
    order: updatedOrder,
    grants,
    stripe: session,
    action,
  }
}
