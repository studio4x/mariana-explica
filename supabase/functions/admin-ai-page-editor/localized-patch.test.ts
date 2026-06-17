import { describe, expect, it } from "vitest"
import { materializeLocalizedVisualPatchProposal } from "./localized-patch.ts"

function createVisualBaseVersion() {
  return {
    id: "version-visual-1",
    page_id: "page-visual-1",
    version_number: 15,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "about-story",
            type: "rich_text",
            content:
              '<section class="me-about-page"><h2>De estudante para estudante: porque este projeto?</h2><hr class="me-about-divider" /><p>Texto preservado.</p><a href="/checkout">Comecar</a></section>',
            layout: {
              paddingTop: 0,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
            },
          },
          {
            id: "after-story",
            type: "rich_text",
            content: '<p>Segunda secao preservada.</p><a href="/suporte">Suporte</a>',
            layout: {
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
            },
          },
        ],
      },
    },
    style_json: {},
    metadata: {},
  }
}

function createConversationContext(understandingSummary: string, originalMessage = understandingSummary) {
  return {
    phase: "awaiting_intent_confirmation" as const,
    understanding_summary: understandingSummary,
    clarification_questions_count: 1,
    quick_reply_selected: null,
    confirmation_token: "intent_test",
    recent_messages: [
      {
        role: "user" as const,
        text: originalMessage,
      },
      {
        role: "assistant" as const,
        text: "Entendi. E isso mesmo?",
      },
    ],
  }
}

function materialize(
  understandingSummary: string,
  originalMessage = understandingSummary,
  options: {
    baseVersion?: ReturnType<typeof createVisualBaseVersion>
    currentHtml?: string
  } = {},
) {
  return materializeLocalizedVisualPatchProposal({
    providerUsed: "openai",
    modelUsed: "gpt-4.1-mini",
    confirmationMessage: "Sim, e isso mesmo.",
    slug: "sobre",
    title: "Sobre",
    path: "/sobre",
    conversationContext: createConversationContext(understandingSummary, originalMessage),
    baseVersion: options.baseVersion ?? createVisualBaseVersion(),
    baseVersionSource: "published_version",
    degradedDraftBypassed: false,
    baseVersionSelectionReason: "published_version_safe_context",
    publishedVersionId: "version-visual-1",
    latestDraftId: null,
    currentHtml: options.currentHtml,
  })
}

describe("materializeLocalizedVisualPatchProposal", () => {
  it("materializes divider removal without provider full proposal or section loss", () => {
    const result = materialize(
      "remover a linha decorativa abaixo desse titulo sem mudar o texto nem a secao",
      'remova essa linha que esta inserido abaixo do titulo "De estudante para estudante: porque este projeto?"',
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.intent.kind).toBe("divider")
    expect(result.proposal.metadata.ai_invariants?.plan_source).toBe("localized_visual_patch")
    expect(result.proposal.metadata.ai_invariants).not.toHaveProperty("provider_full_proposal")
    expect(result.summary).not.toMatch(/truncada/i)
    expect(String(result.proposal.style_json.css ?? "")).toContain('[class*="divider"]')
    expect(String(result.proposal.style_json.css ?? "")).toContain("display: none")

    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(blocks).toHaveLength(2)
    expect(String(blocks[0].content)).toContain("De estudante para estudante: porque este projeto?")
    expect(String(blocks[1].content)).toContain("/suporte")
  })

  it("does not mass-apply low confidence divider requests", () => {
    const result = materialize("remove a linha")

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.intent.confidence).toBe("low")
    expect(result.assistantMessage).toMatch(/localizar com seguranca/i)
  })

  it("materializes clarified spacing between the last section and footer without touching footer text", () => {
    const result = materialize(
      "remover o espaco em branco entre a ultima secao da pagina e o rodape, mantendo o rodape igual",
      "remova esse espaco em branco | Esta entre a ultima secao da pagina e o rodape",
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.intent.targetHint).toBe("footer_adjacent_spacing")
    expect(result.editPlan.target_ids).toEqual(["footer_adjacent_spacing"])
    expect(result.assistantMessage).toMatch(/ultima secao e o rodape/i)

    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(blocks).toHaveLength(2)
    expect(String(blocks[1].content)).toContain("/suporte")
    expect((blocks[1].layout as { paddingBottom?: number }).paddingBottom).toBe(0)
  })

  it("materializes footer-adjacent spacing when the user clarifies the last-section heading", () => {
    const baseVersion = createVisualBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[1] = {
      ...blocks[1],
      content:
        '<section><h2>Como e estudar comigo?</h2><p>Segunda secao preservada.</p><a href="/suporte">Suporte</a></section>',
      layout: {
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 64,
        paddingLeft: 16,
        marginTop: 0,
        marginBottom: 0,
      },
    }

    const result = materialize(
      'remover o espaco em branco entre a secao "Como e estudar comigo?" e o rodape, mantendo o rodape igual',
      'a ultima secao da pagina sobre e "Como e estudar comigo?"',
      {
        baseVersion,
        currentHtml: '<main><section><h2>Como e estudar comigo?</h2></section></main>',
      },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.intent.targetHint).toBe("footer_adjacent_spacing")
    expect(result.proposal.metadata.ai_invariants?.footer_adjacent_spacing_diagnosis).toMatchObject({
      html_anchor_text: "Como e estudar comigo?",
      html_contains_anchor: true,
    })

    const nextBlocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect((nextBlocks[1].layout as { paddingBottom?: number }).paddingBottom).toBe(0)
    expect(String(nextBlocks[1].content)).toContain("Como e estudar comigo?")
    expect(String(nextBlocks[1].content)).toContain("/suporte")
  })
})
