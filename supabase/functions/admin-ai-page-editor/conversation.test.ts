import { describe, expect, it } from "vitest"
import {
  buildUnderstandingConfirmationToken,
  isExplicitUnderstandingConfirmation,
  isExplicitUnderstandingRejection,
  matchesUnderstandingConfirmationToken,
  normalizeConversationContext,
  sanitizeConversationReplies,
  sanitizeConversationText,
} from "./conversation"

describe("conversation helpers", () => {
  it("normalizes short context payloads from the launcher", () => {
    const context = normalizeConversationContext({
      phase: "awaiting_intent_confirmation",
      understanding_summary: "tirar o espaco no topo da pagina Sobre",
      clarification_questions_count: 2,
      quick_reply_selected: "Nos dois",
      confirmation_token: "intent_123",
      pending_image_insert: {
        target_source: "capture",
        target_page: "/sobre",
        target_slug: "sobre",
        target_hint: "selected_area",
        capture_attachment_id: "capture-1",
        capture_attachment_name: "recorte-sobre.jpg",
        status: "waiting_for_image_asset",
      },
      recent_messages: [
        { role: "assistant", text: "Percebi assim..." },
        { role: "user", text: "Sim, e isso" },
      ],
    })

    expect(context.phase).toBe("awaiting_intent_confirmation")
    expect(context.clarification_questions_count).toBe(2)
    expect(context.confirmation_token).toBe("intent_123")
    expect(context.pending_image_insert?.capture_attachment_id).toBe("capture-1")
    expect(context.recent_messages).toHaveLength(2)
  })

  it("detects explicit confirmation only in the confirmation phase", () => {
    expect(isExplicitUnderstandingConfirmation("Sim, e isso", "awaiting_intent_confirmation")).toBe(true)
    expect(isExplicitUnderstandingConfirmation("Sim, e aproveita para trocar o titulo", "awaiting_intent_confirmation")).toBe(false)
    expect(isExplicitUnderstandingConfirmation("Sim", "needs_clarification")).toBe(false)
  })

  it("detects a request to explain again", () => {
    expect(isExplicitUnderstandingRejection("Nao, quero explicar melhor", "awaiting_intent_confirmation")).toBe(true)
    expect(isExplicitUnderstandingRejection("quero explicar melhor", "needs_clarification")).toBe(false)
  })

  it("removes forbidden technical words from user-facing copy", () => {
    expect(sanitizeConversationText("Vou mexer no padding e no layout.")).toBe("Vou mexer no espaco e na estrutura.")
    expect(sanitizeConversationReplies(["Mudar o wrapper", "Trocar o padding"])).toEqual([
      "Mudar o bloco",
      "Trocar o espaco",
    ])
  })

  it("builds and validates a confirmation token for the pending understanding summary", () => {
    const token = buildUnderstandingConfirmationToken("tirar o espaco do topo da pagina Sobre")

    expect(token).toMatch(/^intent_/)
    expect(matchesUnderstandingConfirmationToken("tirar o espaco do topo da pagina Sobre", token)).toBe(true)
    expect(matchesUnderstandingConfirmationToken("tirar o espaco da primeira secao", token)).toBe(false)
  })
})
