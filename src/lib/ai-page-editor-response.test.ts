import { describe, expect, it } from "vitest"
import {
  AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE,
  detectManagedPageOperationDiff,
  ensureAdminAiPageEditorConversationResponse,
  ensureAdminAiFooterCopyProposalResponse,
  ensureAdminAiHeaderCopyProposalResponse,
  normalizeAdminAiPageEditorError,
} from "./ai-page-editor-response"

describe("ai-page-editor-response", () => {
  it("accepts a complete hybrid proposal response with operational state", () => {
    const response = ensureAdminAiPageEditorConversationResponse({
      success: true,
      provider_used: "openai",
      conversation_phase: "ready_for_proposal",
      assistant_message: "Entendi. Vou preparar a alteração.",
      quick_replies: [],
      understanding_summary: "tirar o espaço do topo",
      requires_user_confirmation: false,
      can_generate_proposal: true,
      summary: "Ajustar topo",
      explanation: "Patch localizado no topo da pagina.",
      warnings: ["Wrapper global identificado."],
      edit_plan: {
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["page_wrapper_spacing"],
        risk_level: "low",
        requires_strict_confirmation: false,
        operations: [],
      },
      proposal: {
        slug: "sobre",
        title: "Sobre",
        layout_json: { projectData: { blocks: [] } },
        style_json: {},
        metadata: {},
      },
      final_status: "proposal_ready",
      change_detected: true,
      draft_saved: false,
      preview_available: true,
      change_summary: {
        layout_changed: true,
        style_changed: false,
        html_changed: false,
      },
    })

    expect(response.proposal?.slug).toBe("sobre")
    expect(response.final_status).toBe("proposal_ready")
    expect(response.change_detected).toBe(true)
    expect(response.preview_available).toBe(true)
  })

  it("rejects responses without proposal using a friendly message", () => {
    expect(() =>
      ensureAdminAiPageEditorConversationResponse({
        success: true,
        provider_used: "openai",
        conversation_phase: "ready_for_proposal",
        assistant_message: "Entendi. Vou preparar a alteração.",
        quick_replies: [],
        understanding_summary: "tirar o espaço do topo",
        requires_user_confirmation: false,
        can_generate_proposal: true,
        warnings: [],
        final_status: "error",
        change_detected: false,
        draft_saved: false,
        preview_available: false,
        change_summary: {
          layout_changed: false,
          style_changed: false,
          html_changed: false,
        },
      }),
    ).toThrow(/resposta incompleta do servidor/i)
  })

  it("accepts a conversational clarification response without proposal", () => {
    const response = ensureAdminAiPageEditorConversationResponse({
      success: true,
      provider_used: "openai",
      conversation_phase: "needs_clarification",
      assistant_message: "Queres mexer só nesta parte ou na secção inteira?",
      quick_replies: ["Só nesta parte", "Na secção inteira"],
      understanding_summary: "mexer nesta área da página",
      requires_user_confirmation: false,
      can_generate_proposal: false,
      warnings: [],
      final_status: "needs_clarification",
      change_detected: false,
      draft_saved: false,
      preview_available: false,
      change_summary: {
        layout_changed: false,
        style_changed: false,
        html_changed: false,
      },
    })

    expect(response.can_generate_proposal).toBe(false)
    expect(response.quick_replies).toHaveLength(2)
  })

  it("detects a no-op diff when layout, style and html stay equal", () => {
    const diff = detectManagedPageOperationDiff(
      {
        title: "Sobre",
        layout_json: { projectData: { blocks: [{ id: "wrapper" }] } },
        style_json: { wrapper: { paddingTop: 0 } },
        html: "<main><section>Sobre</section></main>",
      },
      {
        title: "Sobre",
        layout_json: { projectData: { blocks: [{ id: "wrapper" }] } },
        style_json: { wrapper: { paddingTop: 0 } },
        html: "<main><section>Sobre</section></main>",
      },
    )

    expect(diff.change_detected).toBe(false)
    expect(diff.layout_changed).toBe(false)
    expect(diff.style_changed).toBe(false)
    expect(diff.html_changed).toBe(false)
  })

  it("detects real changes when wrapper and first section spacing both move", () => {
    const diff = detectManagedPageOperationDiff(
      {
        title: "Sobre",
        layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
        style_json: {
          wrapper: { paddingTop: 48 },
          "section-1": { paddingTop: 32 },
        },
        html: "<main><section data-id='section-1'>Sobre</section></main>",
      },
      {
        title: "Sobre",
        layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
        style_json: {
          wrapper: { paddingTop: 0 },
          "section-1": { paddingTop: 0 },
        },
        html: "<main><section data-id='section-1'>Sobre atualizado</section></main>",
      },
    )

    expect(diff.change_detected).toBe(true)
    expect(diff.style_changed).toBe(true)
    expect(diff.html_changed).toBe(true)
  })

  it("validates header and footer proposal responses with operational state", () => {
    const header = ensureAdminAiHeaderCopyProposalResponse({
      success: true,
      provider_used: "openai",
      summary: "Atualizar topo global",
      explanation: "Texto do anuncio atualizado.",
      warnings: [],
      header_announcement: "Novo anuncio",
      final_status: "proposal_ready",
      change_detected: true,
      draft_saved: false,
      preview_available: false,
      change_summary: {
        layout_changed: false,
        style_changed: false,
        html_changed: false,
        text_changed: true,
      },
    })
    const footer = ensureAdminAiFooterCopyProposalResponse({
      success: true,
      provider_used: "openai",
      summary: "Atualizar rodape global",
      explanation: "Descricao do rodape atualizada.",
      warnings: [],
      footer_description: "Novo rodape",
      final_status: "proposal_ready",
      change_detected: true,
      draft_saved: false,
      preview_available: false,
      change_summary: {
        layout_changed: false,
        style_changed: false,
        html_changed: false,
        text_changed: true,
      },
    })

    expect(header.header_announcement).toBe("Novo anuncio")
    expect(footer.footer_description).toBe("Novo rodape")
  })

  it("normalizes raw ReferenceError messages before they reach the UI", () => {
    expect(normalizeAdminAiPageEditorError(new Error("proposal is not defined")).message).toMatch(
      /resposta incompleta do servidor/i,
    )
    expect(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE).toMatch(/nenhuma alteracao visivel/i)
  })
})
