import { describe, expect, it } from "vitest"
import { isStripeCheckoutPaymentConfirmed } from "./stripe-checkout.ts"

describe("isStripeCheckoutPaymentConfirmed", () => {
  it("confirms only a complete Checkout Session with paid status", () => {
    expect(isStripeCheckoutPaymentConfirmed({ status: "complete", payment_status: "paid" })).toBe(true)
  })

  it("does not confirm a delayed payment after checkout completion", () => {
    expect(isStripeCheckoutPaymentConfirmed({ status: "complete", payment_status: "unpaid" })).toBe(false)
  })

  it("does not confirm an unpaid open session", () => {
    expect(isStripeCheckoutPaymentConfirmed({ status: "open", payment_status: "unpaid" })).toBe(false)
  })
})
