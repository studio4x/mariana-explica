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
    metadata: {
      dynamic_slug: "sobre",
      route_is_public: true,
      route_is_allowed: true,
      bootstrap_attempted: true,
      bootstrap_created: false,
      baseline_complete: true,
      source: "published_version",
    },
  }
}

function createExplicacoesBaseVersion() {
  return {
    id: "version-explicacoes-1",
    page_id: "page-explicacoes-1",
    version_number: 22,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "important-notes",
            type: "rich_text",
            content:
              '<section class="me-explicacoes-notes"><h2>Notas importantes antes de enviares o teu formulário:</h2><p>Planeamento prévio.</p></section>',
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
            id: "contact-form",
            type: "rich_text",
            content: "<section><h3>Formulario</h3><p>Conteudo preservado.</p></section>",
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
    metadata: {
      dynamic_slug: "explicacoes",
      route_is_public: true,
      route_is_allowed: true,
      bootstrap_attempted: true,
      bootstrap_created: false,
      baseline_complete: true,
      source: "published_version",
    },
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
    attachments?: Array<{ name: string; mime_type?: string; role?: string; id?: string }>
    requestSnapshotBaseVersion?: ReturnType<typeof createVisualBaseVersion>
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
    attachments: options.attachments,
    requestSnapshotBaseVersion: options.requestSnapshotBaseVersion,
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

  it("materializes title color changes from a captured area without broad rewrites", () => {
    const result = materialize(
      "mude a cor do titulo dessa secao para branco. atualmente ele esta azul e nao esta dando contraste com o fundo",
      "mude a cor do titulo dessa secao para branco",
      {
        attachments: [
          {
            id: "capture-1",
            name: "recorte-explicacoes.jpg",
            mime_type: "image/jpeg",
            role: "target_capture",
            metadata: {
              target_capture: {
                id: "capture-1",
                role: "target_capture",
                pathname: "/sobre",
                capturedAt: "2026-06-18T18:00:00.000Z",
                viewport: {
                  width: 1280,
                  height: 720,
                  scrollX: 0,
                  scrollY: 0,
                  devicePixelRatio: 1,
                },
                selectionRect: {
                  x: 24,
                  y: 96,
                  width: 420,
                  height: 200,
                  pageX: 24,
                  pageY: 96,
                },
                domCandidates: [
                  {
                    candidateId: "about-story-capture",
                    tagName: "section",
                    safeSelector: "[data-managed-node-id='content:about-story']",
                    managedNodeId: "content:about-story",
                    blockId: "about-story",
                    classNames: ["me-managed-richtext"],
                    textContent: "De estudante para estudante: porque este projeto? Texto preservado.",
                    normalizedText: "de estudante para estudante: porque este projeto? texto preservado.",
                    rect: {
                      x: 24,
                      y: 96,
                      width: 420,
                      height: 200,
                      top: 96,
                      left: 24,
                      right: 444,
                      bottom: 296,
                    },
                    intersectsSelection: true,
                    intersectionRatio: 1,
                    isTextBearing: true,
                    isHeading: false,
                    isButton: false,
                    isImage: false,
                    isEditableManagedContent: true,
                    confidence: 0.94,
                    source: "rect_intersection",
                  },
                ],
                primaryCandidate: {
                  candidateId: "about-story-capture",
                  tagName: "section",
                  safeSelector: "[data-managed-node-id='content:about-story']",
                  managedNodeId: "content:about-story",
                  blockId: "about-story",
                  classNames: ["me-managed-richtext"],
                  textContent: "De estudante para estudante: porque este projeto? Texto preservado.",
                  normalizedText: "de estudante para estudante: porque este projeto? texto preservado.",
                  rect: {
                    x: 24,
                    y: 96,
                    width: 420,
                    height: 200,
                    top: 96,
                    left: 24,
                    right: 444,
                    bottom: 296,
                  },
                  intersectsSelection: true,
                  intersectionRatio: 1,
                  isTextBearing: true,
                  isHeading: false,
                  isButton: false,
                  isImage: false,
                  isEditableManagedContent: true,
                  confidence: 0.94,
                  source: "rect_intersection",
                },
                textFragments: ["De estudante para estudante: porque este projeto?"],
                captureDiagnostics: {
                  elementCount: 1,
                  textCandidateCount: 1,
                  primaryCandidateConfidence: 0.94,
                  source: "live_dom_selection",
                },
              },
            },
          },
        ],
      },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.intent.kind).toBe("color")
    expect(result.proposal.metadata.ai_invariants?.branch_selected).toBe("localized_visual_patch")
    expect(result.proposal.metadata.ai_invariants?.target_capture_used).toBe(true)
    expect(result.proposal.metadata.ai_invariants?.provider_full_proposal_bypassed_for_localized_patch).toBe(true)
    expect(String(result.proposal.style_json.css ?? "")).toContain("color: #ffffff !important;")
    expect(String(result.proposal.style_json.css ?? "")).toContain("[data-managed-node-id='content:about-story']")

    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(blocks).toHaveLength(2)
    expect(String(blocks[0].content)).toContain("De estudante para estudante: porque este projeto?")
    expect(String(blocks[1].content)).toContain("/suporte")
  })

  it("returns a friendly low-confidence message for title color changes when the target is still ambiguous", () => {
    const result = materialize(
      "mude a cor do titulo dessa secao para branco",
      "mude a cor do titulo dessa secao para branco",
      {
        attachments: [
          {
            id: "capture-2",
            name: "recorte-minimo.jpg",
            mime_type: "image/jpeg",
            role: "target_capture",
          },
        ],
        baseVersion: {
          ...createVisualBaseVersion(),
          layout_json: {
            projectData: {
              blocks: [
                {
                  id: "multi-cards",
                  type: "columns",
                  items: [
                    "<article><h3>Card A</h3><p>Texto A</p></article>",
                    "<article><h3>Card B</h3><p>Texto B</p></article>",
                    "<article><h3>Card C</h3><p>Texto C</p></article>",
                  ],
                },
              ],
            },
          },
        },
      },
    )

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.assistantMessage).toMatch(/incluindo o card completo ou indica o texto do titulo/i)
    expect(result.pendingTargetClarification).toMatchObject({
      intent: "set_text_color",
      requestedProperty: "color",
      requestedValue: "#ffffff",
      awaiting: "capture",
    })
  })

  it("materializes a quoted text color change using the quoted text as the anchor", () => {
    const result = materialize(
      'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco',
      'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco',
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.proposal.metadata.ai_invariants?.text_anchor_found).toBe(true)
    expect(result.proposal.metadata.ai_invariants?.text_anchor_raw).toBe("De estudante para estudante: porque este projeto?")
    expect(result.proposal.metadata.ai_invariants?.target_resolution_source).toBe("anchor_text")
    expect(result.proposal.metadata.ai_invariants?.localized_visual_patch_selected).toBe(true)
    expect(result.proposal.metadata.ai_invariants?.provider_full_proposal_bypassed).toBe(true)
  })

  it("materializes the exact /explicacoes quoted heading without asking for capture", () => {
    const result = materialize(
      'altere a cor do texto "Notas importantes antes de enviares o teu formulário:" para branco (#fff)',
      'altere a cor do texto "Notas importantes antes de enviares o teu formulário:" para branco (#fff)',
      {
        baseVersion: createExplicacoesBaseVersion(),
      },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.proposal.metadata.ai_invariants?.branch_selected).toBe("localized_visual_patch")
    expect(result.proposal.metadata.ai_invariants?.provider_full_proposal_bypassed).toBe(true)
    expect(result.proposal.metadata.ai_invariants?.text_anchor_found).toBe(true)
    expect(result.proposal.metadata.ai_invariants?.target_resolution_source).toBe("anchor_text")
    expect(result.pendingTargetClarification).toBeUndefined()

    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(blocks[0]).toMatchObject({
      id: "important-notes",
      color: "#fff",
      textColor: "#fff",
    })
  })

  it("returns a specific not-found message when the quoted text anchor is absent", () => {
    const result = materialize(
      'mude a cor do texto "Texto inexistente desta pagina" para branco',
      'mude a cor do texto "Texto inexistente desta pagina" para branco',
    )

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.assistantMessage).toMatch(/procurei o texto indicado, mas nao o encontrei com seguranca/i)
  })

  it("returns a specific ambiguity message when the quoted text anchor appears more than once", () => {
    const baseVersion = createVisualBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[1] = {
      ...blocks[1],
      content:
        '<section><h2>De estudante para estudante: porque este projeto?</h2><p>Segunda secao preservada.</p><a href="/suporte">Suporte</a></section>',
    }

    const result = materialize(
      'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco',
      'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco',
      { baseVersion },
    )

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.assistantMessage).toMatch(/encontrei mais de um texto semelhante/i)
    expect(result.pendingTargetClarification).toMatchObject({
      awaiting: "selection_confirmation",
    })
  })

  it("retries quoted text anchors against a live DOM snapshot base when the persisted baseline is stale", () => {
    const staleBaseVersion = createVisualBaseVersion()
    const staleBlocks = (staleBaseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    staleBlocks[0] = {
      ...staleBlocks[0],
      content: "<section><h2>Conteudo desatualizado</h2><p>Texto antigo.</p></section>",
    }

    const requestSnapshotBaseVersion = {
      ...createVisualBaseVersion(),
      metadata: {
        ...createVisualBaseVersion().metadata,
        source: "request_live_dom_snapshot",
      },
    }

    const result = materialize(
      'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco',
      'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco',
      {
        baseVersion: staleBaseVersion,
        requestSnapshotBaseVersion,
      },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.proposal.metadata.ai_invariants?.baseline_source).toBe("request_live_dom_snapshot")
    expect(result.proposal.metadata.ai_invariants?.text_anchor_found).toBe(true)
    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(blocks[0]).toMatchObject({
      id: "about-story",
      color: "#ffffff",
      textColor: "#ffffff",
    })
  })
})
