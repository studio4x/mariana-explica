import { describe, expect, it } from "vitest"
import { richTextToPlainText, sanitizeRichTextHtml } from "./rich-text.ts"

describe("rich-text helpers", () => {
  it("sanitizeRichTextHtml removes unsafe markup and keeps allowed links", () => {
    const html = sanitizeRichTextHtml(
      '<p>Ola <strong>aluno</strong></p><script>alert("x")</script><p><a href="/aluno/notificacoes" onclick="evil()">Ver</a></p>',
    )

    expect(html).toContain("<strong>aluno</strong>")
    expect(html).toContain('href="/aluno/notificacoes"')
    expect(html.includes("<script")).toBe(false)
    expect(html.includes("onclick")).toBe(false)
  })

  it("richTextToPlainText creates readable fallback text", () => {
    const text = richTextToPlainText("<p>Primeira linha</p><p>Segunda linha</p><ul><li>Item</li></ul>")

    expect(text).toBe("Primeira linha\nSegunda linha\n- Item")
  })
})
