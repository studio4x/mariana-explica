import { describe, expect, it } from "vitest"
import { renderPlatformEmailLayout } from "../_shared/email-layout.ts"
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
    const content = buildAuthEmailMessage(
      "signup",
      "Mariana",
      "https://project.supabase.co/auth/v1/verify?token=hashed-token&type=signup",
    )
    const message = renderPlatformEmailLayout(content.layout)

    expect(message.html).toContain("<!doctype html>")
    expect(message.html).toContain("background-color:#dff2f8")
    expect(message.html).toContain("Confirma o teu email")
    expect(message.html).toContain("Validar conta")
    expect(message.html).not.toContain("Código")
    expect(message.html).not.toContain("123456")
    expect(message.text).not.toContain("Código")
    expect(message.text).not.toContain("123456")
  })

  it("escapes user-controlled names in the HTML email", () => {
    const content = buildAuthEmailMessage("signup", '<img src=x onerror="alert(1)">', "https://example.com")
    const message = renderPlatformEmailLayout(content.layout)

    expect(message.html).not.toContain("<img")
    expect(message.html).toContain("&lt;img")
  })

  it("uses the same branded header slot as the platform transactional template", () => {
    const content = buildAuthEmailMessage("signup", "Mariana", "https://example.com")
    const message = renderPlatformEmailLayout({
      ...content.layout,
      headerLogoUrl: "https://www.mariana-explica.pt/logo-email.png",
    })

    expect(message.html).toContain('alt="Mariana Explica"')
    expect(message.html).toContain('src="https://www.mariana-explica.pt/logo-email.png"')
  })

  it("keeps direct registration and checkout registration on the same signup template", () => {
    const directRegistrationLink = buildAuthVerificationUrl(
      "https://gookhgufsxeplelpdaua.supabase.co",
      "same-hashed-token",
      "signup",
      "https://www.mariana-explica.pt/auth/callback?next=%2Faluno%2Fdashboard",
    )
    const checkoutRegistrationLink = buildAuthVerificationUrl(
      "https://gookhgufsxeplelpdaua.supabase.co",
      "same-hashed-token",
      "signup",
      "https://www.mariana-explica.pt/auth/callback?next=%2Fcheckout%3Fslug%3Dcurso-exemplo",
    )
    const direct = buildAuthEmailMessage("signup", "Mariana", directRegistrationLink)
    const checkout = buildAuthEmailMessage("signup", "Mariana", checkoutRegistrationLink)

    expect(direct.subject).toBe(checkout.subject)
    expect({ ...direct.layout, ctaUrl: "[activation-link]" }).toEqual({
      ...checkout.layout,
      ctaUrl: "[activation-link]",
    })

    const directHtml = renderPlatformEmailLayout({ ...direct.layout, ctaUrl: "https://example.com/activation" }).html
    const checkoutHtml = renderPlatformEmailLayout({ ...checkout.layout, ctaUrl: "https://example.com/activation" }).html
    expect(directHtml).toBe(checkoutHtml)
  })
})
