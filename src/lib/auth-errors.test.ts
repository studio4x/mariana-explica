import { describe, expect, it } from "vitest"
import { mapAuthErrorMessage } from "./auth-errors"

describe("mapAuthErrorMessage", () => {
  it("maps the Supabase email rate-limit error to a readable message", () => {
    expect(mapAuthErrorMessage("email rate limit exceeded")).toBe(
      "Foram pedidos vários emails num curto intervalo. Aguarda alguns minutos e tenta novamente.",
    )
  })
})
