import { describe, expect, it } from "vitest"
import { buildAuthEmailMessage, buildAuthVerificationUrl } from "./email-content.ts"

describe("auth Send Email Hook content", () => {
  it("builds verification links against Supabase Auth and preserves the app callback", () => {
    const redirectTo = "https://www.mariana-explica.pt/auth/callback?next=%2Faluno%2Fdashboard"
    const result = new URL(
      buildAuthVerificationUrl(
        "https://gookhgufsxeplelpdaua.supabase.co",
        "hashed-token",
        "signup",
        redirectTo,
      ),
    )

    expect(result.origin).toBe("https://gookhgufsxeplelpdaua.supabase.co")
    expect(result.pathname).toBe("/auth/v1/verify")
    expect(result.searchParams.get("token")).toBe("hashed-token")
    expect(result.searchParams.get("type")).toBe("signup")
    expect(result.searchParams.get("redirect_to")).toBe(redirectTo)
    expect(result.searchParams.has("token_hash")).toBe(false)
  })

  it("omits the numeric activation code from HTML and text emails", () => {
    const message = buildAuthEmailMessage(
      "signup",
      "Mariana",
      "https://project.supabase.co/auth/v1/verify?token=hashed-token&type=signup",
    )

    expect(message.html).not.toContain("Código")
    expect(message.html).not.toContain("123456")
    expect(message.text).not.toContain("Código")
    expect(message.text).not.toContain("123456")
  })

  it("escapes user-controlled names in the HTML email", () => {
    const message = buildAuthEmailMessage("signup", '<img src=x onerror="alert(1)">', "https://example.com")

    expect(message.html).not.toContain("<img")
    expect(message.html).toContain("&lt;img")
  })
})
