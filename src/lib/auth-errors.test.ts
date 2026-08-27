import { describe, expect, it } from "vitest"
import { isEmailNotConfirmedError, mapAuthErrorMessage } from "./auth-errors"

describe("mapAuthErrorMessage", () => {
  it("maps the Supabase email rate-limit error to a readable message", () => {
    expect(mapAuthErrorMessage("email rate limit exceeded")).toBe(
      "Foram pedidos vários emails num curto intervalo. Aguarda alguns minutos e tenta novamente.",
    )
  })

  it("identifies an unconfirmed email error independently of capitalization", () => {
    expect(isEmailNotConfirmedError("Email not confirmed")).toBe(true)
    expect(isEmailNotConfirmedError("EMAIL NOT CONFIRMED")).toBe(true)
    expect(isEmailNotConfirmedError("Invalid login credentials")).toBe(false)
  })
})
