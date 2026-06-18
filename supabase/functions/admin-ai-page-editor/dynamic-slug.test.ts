import { describe, expect, it } from "vitest"
import {
  isPublicEditorPath,
  isSensitiveEditorPath,
  normalizeEditorPathname,
  resolveManagedPageSlug,
} from "./dynamic-slug.ts"

describe("dynamic-slug", () => {
  it("normalizes trailing slash, query string and hash to the same canonical route", () => {
    expect(normalizeEditorPathname("/explicacoes/")).toBe("/explicacoes")
    expect(normalizeEditorPathname("/explicacoes?ref=teste")).toBe("/explicacoes")
    expect(normalizeEditorPathname("/explicacoes#card")).toBe("/explicacoes")
  })

  it("builds stable slugs for public routes", () => {
    expect(resolveManagedPageSlug("/")).toBe("home")
    expect(resolveManagedPageSlug("/explicacoes")).toBe("explicacoes")
    expect(resolveManagedPageSlug("/como-estudar")).toBe("como-estudar")
    expect(resolveManagedPageSlug("/biblioteca/guias")).toBe("biblioteca--guias")
  })

  it("keeps private and sensitive routes blocked", () => {
    expect(isSensitiveEditorPath("/login")).toBe(true)
    expect(isSensitiveEditorPath("/aluno/dashboard")).toBe(true)
    expect(isPublicEditorPath("/explicacoes")).toBe(true)
    expect(resolveManagedPageSlug("/login")).toBeNull()
  })
})
