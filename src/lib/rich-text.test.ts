import { describe, expect, it } from "vitest"
import { isRichTextEmpty, richTextToPlainText, sanitizeRichTextHtml } from "./rich-text"

describe("rich text sanitization", () => {
  it("preserves h1 content while stripping unsafe attributes", () => {
    const html = '<h1 style="color:red">Titulo</h1><p>Paragrafo</p><script>alert(1)</script>'

    const sanitized = sanitizeRichTextHtml(html)

    expect(sanitized).toContain("<h1>Titulo</h1>")
    expect(sanitized).not.toContain("style=")
    expect(sanitized).not.toContain("<script>")
  })

  it("keeps plain text helpers aligned", () => {
    expect(richTextToPlainText("<h1>Titulo</h1><p>Paragrafo</p>")).toBe("TituloParagrafo")
    expect(isRichTextEmpty("   ")).toBe(true)
  })
})
