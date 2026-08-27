import { describe, expect, it } from "vitest"
import { formatProfileRole, formatProfileStatus } from "./profile-labels"

describe("profile labels", () => {
  it("translates student and active values for the account card", () => {
    expect(formatProfileRole("student")).toBe("Aluno")
    expect(formatProfileStatus("active")).toBe("Ativo")
  })
})
