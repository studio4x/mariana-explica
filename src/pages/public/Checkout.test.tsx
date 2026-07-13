import { beforeEach, describe, expect, it, vi } from "vitest"
import { openCheckoutUrlInNewTab } from "./checkout-helpers"

describe("openCheckoutUrlInNewTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("abre a Stripe num novo separador sem manter opener", () => {
    const focus = vi.fn()
    const openWindow = { opener: {}, focus } as unknown as Window
    const openSpy = vi.spyOn(window, "open").mockReturnValue(openWindow)

    const opened = openCheckoutUrlInNewTab("https://payments.stripe.com/multibanco/voucher/test_123")

    expect(opened).toBe(true)
    expect(openSpy).toHaveBeenCalledWith("https://payments.stripe.com/multibanco/voucher/test_123", "_blank")
    expect(openWindow.opener).toBeNull()
    expect(focus).toHaveBeenCalled()
  })

  it("devolve falso quando o navegador bloqueia a abertura", () => {
    vi.spyOn(window, "open").mockReturnValue(null)

    const opened = openCheckoutUrlInNewTab("https://payments.stripe.com/multibanco/voucher/test_123")

    expect(opened).toBe(false)
  })
})
