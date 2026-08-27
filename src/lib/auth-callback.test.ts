import { describe, expect, it } from "vitest"
import { buildAuthCallbackUrl } from "./auth-callback"

describe("buildAuthCallbackUrl", () => {
  it("uses the same callback builder for dashboard and checkout destinations", () => {
    const options = { origin: "https://www.mariana-explica.pt", baseUrl: "/" }
    const dashboard = new URL(buildAuthCallbackUrl("/aluno/dashboard", options))
    const checkout = new URL(buildAuthCallbackUrl("/checkout?slug=curso-exemplo", options))

    expect(dashboard.origin).toBe(checkout.origin)
    expect(dashboard.pathname).toBe("/auth/callback")
    expect(checkout.pathname).toBe("/auth/callback")
    expect(dashboard.searchParams.get("next")).toBe("/aluno/dashboard")
    expect(checkout.searchParams.get("next")).toBe("/checkout?slug=curso-exemplo")
  })
})
