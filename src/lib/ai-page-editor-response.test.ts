import { describe, expect, it } from "vitest"
import {
  ensureAdminAiPageEditorProposalResponse,
  normalizeAdminAiPageEditorError,
} from "./ai-page-editor-response"

describe("ai-page-editor-response", () => {
  it("accepts a complete hybrid proposal response", () => {
    const response = ensureAdminAiPageEditorProposalResponse({
      success: true,
      provider_used: "openai",
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
    })

    expect(response.proposal.slug).toBe("sobre")
    expect(response.edit_plan.mode).toBe("spacing_patch")
  })

  it("rejects responses without proposal using a friendly message", () => {
    expect(() =>
      ensureAdminAiPageEditorProposalResponse({
        success: true,
        provider_used: "openai",
        summary: "Ajustar topo",
        explanation: "Patch localizado no topo da pagina.",
        warnings: [],
        edit_plan: {
          scope: "section",
          mode: "spacing_patch",
          target_ids: ["page_wrapper_spacing"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [],
        },
      }),
    ).toThrow(/resposta incompleta do servidor/i)
  })

  it("normalizes raw ReferenceError messages before they reach the UI", () => {
    expect(normalizeAdminAiPageEditorError(new Error("proposal is not defined")).message).toMatch(
      /resposta incompleta do servidor/i,
    )
  })
})
