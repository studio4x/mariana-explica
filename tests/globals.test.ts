import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const styles = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8")

describe("global typography theme", () => {
  it("keeps global typography tied to the site theme variables", () => {
    expect(styles).toContain("font-size: var(--site-h1-font-size) !important;")
    expect(styles).toContain("font-family: var(--site-paragraph-font-family) !important;")
    expect(styles).toContain("color: var(--site-link-hover-color) !important;")
    expect(styles).toContain("font-size: var(--site-small-font-size) !important;")
  })
})
