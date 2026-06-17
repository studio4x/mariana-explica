import { describe, expect, it } from "vitest"
import { materializeExplicitCssPatchProposal } from "./explicit-css-patch.ts"

function createBaseVersion() {
  return {
    id: "version-explicit-1",
    page_id: "page-1",
    version_number: 42,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "section-1",
            type: "rich_text",
            content: "<section><h2>Como e estudar comigo?</h2><p>Texto preservado.</p><a href=\"/checkout\">CTA</a></section>",
          },
          {
            id: "section-2",
            type: "rich_text",
            content: "<section><p>Rodape preservado.</p><a href=\"/suporte\">Suporte</a></section>",
          },
        ],
      },
    },
    style_json: {
      css: ".me-managed-page-root { padding: 56px 20px 40px; }\n.about-section { margin-bottom: 24px; }",
    },
    metadata: {},
  }
}

function createConversationContext(
  understandingSummary: string,
  recentUserMessages: string[],
) {
  return {
    phase: "awaiting_intent_confirmation" as const,
    understanding_summary: understandingSummary,
    clarification_questions_count: 1,
    quick_reply_selected: null,
    confirmation_token: "confirm-token",
    recent_messages: recentUserMessages.map((text) => ({
      role: "user" as const,
      text,
    })),
  }
}

function materialize(options: {
  understandingSummary: string
  recentUserMessages: string[]
  confirmationMessage?: string
  currentHtml?: string
}) {
  return materializeExplicitCssPatchProposal({
    providerUsed: "openai",
    modelUsed: "gpt-4.1-mini",
    confirmationMessage: options.confirmationMessage ?? "Sim, prepara a previa.",
    slug: "sobre",
    title: "Sobre",
    path: "/sobre",
    conversationContext: createConversationContext(options.understandingSummary, options.recentUserMessages),
    baseVersion: createBaseVersion(),
    baseVersionSource: "published_version",
    degradedDraftBypassed: false,
    baseVersionSelectionReason: "published_version_safe_context",
    publishedVersionId: "version-explicit-1",
    latestDraftId: null,
    currentHtml:
      options.currentHtml ??
      '<main class="me-managed-page-root"><section class="about-section"><h2>Como e estudar comigo?</h2></section></main>',
  })
}

describe("materializeExplicitCssPatchProposal", () => {
  it("applies a deterministic patch for selector and property split across messages", () => {
    const result = materialize({
      understandingSummary: "ajustar a classe .me-managed-page-root em CSS, aplicando padding-bottom = 0px",
      recentUserMessages: [
        "remova esse espaco em branco que esta entre a ultima secao da pagina e o rodape.",
        'esse espacamento esta configurado na classe ".me-managed-page-root" do CSS, em "padding".',
        "basta remover o padding bottom nessa classe",
      ],
    })

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.proposal.metadata.ai_invariants?.branch_selected).toBe("explicit_css_patch")
    expect(result.proposal.metadata.ai_invariants?.explicit_css_selector).toBe(".me-managed-page-root")
    expect(String(result.proposal.style_json.css ?? "")).toContain("padding-bottom: 0px !important;")
    expect(result.assistantMessage).toContain(".me-managed-page-root")
    expect(result.assistantMessage.toLowerCase()).toContain("rodape")
    expect(result.assistantMessage.toLowerCase()).not.toContain("primeira secao")
    expect(result.proposal.layout_json).toEqual(createBaseVersion().layout_json)
    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(String(blocks[1].content)).toContain("/suporte")
  })

  it("applies a full safe CSS rule block without reclassifying the target", () => {
    const result = materialize({
      understandingSummary: "ajustar a classe .me-managed-page-root em CSS, aplicando max-width = 1120px, margin = 0px auto, padding = 56px 20px 0px",
      recentUserMessages: [
        `deixe a classe css dessa forma:

.me-managed-page-root {
  max-width: 1120px;
  margin: 0px auto;
  padding: 56px 20px 0px;
}`,
      ],
    })

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    const css = String(result.proposal.style_json.css ?? "")
    expect(css).toContain("max-width: 1120px !important;")
    expect(css).toContain("margin: 0px auto !important;")
    expect(css).toContain("padding: 56px 20px 0px !important;")
    expect(result.proposal.metadata.ai_invariants?.explicit_css_values).toEqual([
      "1120px",
      "0px auto",
      "56px 20px 0px",
    ])
  })

  it("fails safely when the selector is not present in the current page context", () => {
    const result = materialize({
      understandingSummary: "ajustar a classe .classe-inexistente em CSS, aplicando padding-bottom = 0px",
      recentUserMessages: ["adicione padding-bottom 0 na classe .classe-inexistente"],
      currentHtml: '<main><section class="about-section">Conteudo</section></main>',
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.assistantMessage).toMatch(/nao consegui validar esse seletor/i)
  })

  it("blocks unsafe property values like position fixed", () => {
    const result = materialize({
      understandingSummary: "ajustar a classe .me-managed-page-root em CSS, aplicando position = fixed",
      recentUserMessages: ["na classe .me-managed-page-root altere position para fixed"],
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.reason).toMatch(/propriedade position nao e permitida|nao e suportada/i)
  })

  it("blocks dangerous global selectors", () => {
    const result = materialize({
      understandingSummary: "ajustar a classe * em CSS, aplicando padding = 0px",
      recentUserMessages: ["remova o padding do *"],
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.reason).toMatch(/seletor nao seguro/i)
  })
})
