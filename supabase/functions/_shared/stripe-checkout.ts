export interface StripeCheckoutPaymentSnapshot {
  status?: string | null
  payment_status?: string | null
}

export function isStripeCheckoutPaymentConfirmed(session: StripeCheckoutPaymentSnapshot) {
  return session.status === "complete" && session.payment_status === "paid"
}
