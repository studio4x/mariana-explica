import { describe, expect, it } from "vitest"
import { HttpError } from "../_shared/errors.ts"
import {
  extractPersistibleProposalInvariants,
  requirePersistiblePageEditorProposal,
} from "./proposal-guards.ts"

describe("proposal guards", () => {
  it("preserves warnings before the final proposal is returned", () => {
    const proposal = requirePersistiblePageEditorProposal({
      summary: "Ajustar espacamento no topo",
      explanation: "O patch remove apenas o padding superior necessario.",
      warnings: [
        "Compatibilidade protegida: plano inferido no backend.",
        "Diagnostico: o wrapper global foi identificado antes da primeira secao.",
      ],
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
        metadata: {
          ai_invariants: {
            target_resolutions: [],
          },
        },
      },
    }, "generate_proposal_response")

    expect(proposal.warnings).toEqual([
      "Compatibilidade protegida: plano inferido no backend.",
      "Diagnostico: o wrapper global foi identificado antes da primeira secao.",
    ])
    expect(extractPersistibleProposalInvariants(proposal)).toMatchObject({
      target_resolutions: [],
    })
  })

  it("returns a structured error when proposal is missing", () => {
    expect(() => requirePersistiblePageEditorProposal({
      summary: "Ajustar espacamento",
      explanation: "Sem proposal final.",
      warnings: [],
      edit_plan: {
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["page_wrapper_spacing"],
        risk_level: "low",
        requires_strict_confirmation: false,
        operations: [],
      },
    }, "generate_proposal_response")).toThrowError(HttpError)

    try {
      requirePersistiblePageEditorProposal({
        summary: "Ajustar espacamento",
        explanation: "Sem proposal final.",
        warnings: [],
        edit_plan: {
          scope: "section",
          mode: "spacing_patch",
          target_ids: ["page_wrapper_spacing"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [],
        },
      }, "generate_proposal_response")
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).message).toContain("A proposta final da IA ficou incompleta")
      expect((error as HttpError).details).toMatchObject({
        stage: "generate_proposal_response",
        reason: "missing_proposal",
      })
    }
  })

  it("accepts localized visual patch metadata without requiring a provider full proposal flag", () => {
    const proposal = requirePersistiblePageEditorProposal({
      summary: "Remover linha decorativa",
      explanation: "Ajuste localizado no divisor abaixo do titulo.",
      warnings: [],
      edit_plan: {
        scope: "section",
        mode: "style_patch",
        target_ids: ["localized_divider_below_heading"],
        risk_level: "low",
        requires_strict_confirmation: true,
        operations: [
          {
            type: "remove_style",
            target_id: "localized_divider_below_heading",
            path: "localized-divider",
            breakpoint: "all",
          },
        ],
      },
      proposal: {
        slug: "sobre",
        title: "Sobre",
        layout_json: { projectData: { blocks: [{ id: "story" }] } },
        style_json: { css: ".story hr { display: none !important; }" },
        metadata: {
          ai_invariants: {
            plan_source: "localized_visual_patch",
            localized_visual_patch: true,
            target_resolutions: [{ confidence: 0.91 }],
          },
        },
      },
    }, "localized_visual_patch")

    expect(extractPersistibleProposalInvariants(proposal)).toMatchObject({
      plan_source: "localized_visual_patch",
      localized_visual_patch: true,
    })
  })
})
