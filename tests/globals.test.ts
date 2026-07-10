import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const styles = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8")

describe("global typography theme", () => {
  it("keeps global typography tied to the site theme variables", () => {
    expect(styles).toContain("--site-headline-xl-font-size: 3rem;")
    expect(styles).toContain("--site-headline-sm-font-size: 1.25rem;")
    expect(styles).toContain("font-size: var(--me-rich-text-font-size, var(--site-h1-font-size));")
    expect(styles).toContain("font-family: var(--me-rich-text-font-family, var(--site-paragraph-font-family));")
    expect(styles).toContain("color: var(--site-link-hover-color);")
    expect(styles).toContain("font-size: var(--site-label-md-font-size);")
    expect(styles).toContain("text-transform: var(--site-label-md-text-transform);")
    expect(styles).toContain("--site-small-font-size: var(--site-body-sm-font-size);")
  })
})
