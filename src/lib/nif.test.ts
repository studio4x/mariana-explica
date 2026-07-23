import { describe, expect, it } from "vitest"
import { formatNif, isValidNif, stripNifDigits } from "./nif"

describe("Portuguese NIF", () => {
  it("validates the official checksum", () => {
    expect(isValidNif("123 456 789")).toBe(true)
    expect(isValidNif("123 456 788")).toBe(false)
    expect(isValidNif("111 111 111")).toBe(false)
  })

  it("normalizes and formats nine digits", () => {
    expect(stripNifDigits("123 456 789")).toBe("123456789")
    expect(formatNif("123456789")).toBe("123 456 789")
  })
})
