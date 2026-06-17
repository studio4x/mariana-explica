import { describe, expect, it } from "vitest"
import {
  buildExplicitCssSourceText,
  buildExplicitCssUnderstandingSummary,
  extractExplicitCssIntent,
} from "./explicit-css-intent.ts"

function createConversationContext(overrides: Partial<Parameters<typeof buildExplicitCssSourceText>[0]["conversationContext"]> = {}) {
  return {
    phase: "awaiting_intent_confirmation" as const,
    understanding_summary: null,
    clarification_questions_count: 0,
    quick_reply_selected: null,
    confirmation_token: null,
    recent_messages: [],
    ...overrides,
  }
}

describe("explicit-css-intent", () => {
  it("consolidates selector from previous context with a property instruction in the current message", () => {
    const sourceText = buildExplicitCssSourceText({
      message: "basta remover o padding bottom nessa classe",
      conversationContext: createConversationContext({
        recent_messages: [
          {
            role: "user",
            text: 'esse espacamento esta configurado na classe ".me-managed-page-root" do CSS, em "padding".',
          },
        ],
      }),
    })

    const intent = extractExplicitCssIntent(sourceText)

    expect(intent).toMatchObject({
      selector: ".me-managed-page-root",
      selector_from_context: true,
      uses_rule_block: false,
    })
    expect(intent?.declarations).toEqual([
      {
        property: "padding-bottom",
        value: "0px",
      },
    ])
    expect(buildExplicitCssUnderstandingSummary(intent!)).toContain(".me-managed-page-root")
    expect(buildExplicitCssUnderstandingSummary(intent!)).toContain("padding-bottom = 0px")
  })

  it("parses a full CSS rule block as an explicit patch intent", () => {
    const intent = extractExplicitCssIntent(`
deixe a classe css dessa forma:

.me-managed-page-root {
  max-width: 1120px;
  margin: 0px auto;
  padding: 56px 20px 0px;
}
`)

    expect(intent).toMatchObject({
      selector: ".me-managed-page-root",
      selector_from_context: false,
      uses_rule_block: true,
    })
    expect(intent?.declarations).toEqual([
      { property: "max-width", value: "1120px" },
      { property: "margin", value: "0px auto" },
      { property: "padding", value: "56px 20px 0px" },
    ])
  })

  it("keeps footer context when the request is about space before the footer", () => {
    const intent = extractExplicitCssIntent("na classe .about-section troque margin-bottom para 0px antes do rodape")

    expect(intent?.context).toBe("footer_spacing")
    expect(intent?.declarations).toEqual([
      {
        property: "margin-bottom",
        value: "0px",
      },
    ])
  })
})
