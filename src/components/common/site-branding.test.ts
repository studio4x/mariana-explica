import { applySiteFavicon } from "./site-branding"
import { beforeEach, describe, expect, it } from "vitest"

describe("site favicon", () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.svg" />'
  })

  it("removes the static favicon when no configured asset exists", () => {
    applySiteFavicon(null)

    expect(document.head.querySelector('link[rel="icon"]')).not.toBeInTheDocument()
  })

  it("applies the canonical favicon without declaring a potentially incorrect MIME type", () => {
    applySiteFavicon("/favicon", "2026-07-13T12:00:00.000Z")

    const favicon = document.head.querySelector<HTMLLinkElement>('link[data-managed-favicon="true"]')
    expect(favicon).not.toHaveAttribute("type")
    expect(favicon?.href).toContain("/favicon")
    expect(favicon?.href).toContain("v=2026-07-13T12%3A00%3A00.000Z")
  })
})
