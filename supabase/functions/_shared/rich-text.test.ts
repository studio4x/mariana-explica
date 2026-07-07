import { assertEquals, assertStringIncludes } from "jsr:@std/assert"
import { richTextToPlainText, sanitizeRichTextHtml } from "./rich-text.ts"

Deno.test("sanitizeRichTextHtml removes unsafe markup and keeps allowed links", () => {
  const html = sanitizeRichTextHtml(
    '<p>Ola <strong>aluno</strong></p><script>alert("x")</script><p><a href="/aluno/notificacoes" onclick="evil()">Ver</a></p>',
  )

  assertStringIncludes(html, "<strong>aluno</strong>")
  assertStringIncludes(html, 'href="/aluno/notificacoes"')
  assertEquals(html.includes("<script"), false)
  assertEquals(html.includes("onclick"), false)
})

Deno.test("richTextToPlainText creates readable fallback text", () => {
  const text = richTextToPlainText("<p>Primeira linha</p><p>Segunda linha</p><ul><li>Item</li></ul>")

  assertEquals(text, "Primeira linha\nSegunda linha\n- Item")
})
