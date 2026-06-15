import { describe, expect, it } from "vitest"
import {
  assessAiPageEditorProposal,
  formatAiPageEditorModeLabel,
  getAiPageEditorRouteCapability,
  isAiPageEditorAllowedPath,
  isAiPageEditorManagedPersistibleRoute,
  shouldUsePublishedVersionForAiContext,
} from "./ai-page-editor"
import type { AdminAiPageEditorProposal } from "@/types/app.types"

function createProposal(
  overrides: Partial<AdminAiPageEditorProposal> = {},
): AdminAiPageEditorProposal {
  return {
    provider_used: "openai",
    summary: "Ajustar espaçamento do hero",
    explanation: "O patch reduz o espaço superior apenas na primeira seção.",
    warnings: [],
    edit_plan: {
      scope: "section",
      mode: "spacing_patch",
      target_ids: ["section-hero"],
      risk_level: "low",
      requires_strict_confirmation: false,
      operations: [
        {
          type: "remove_style",
          target_id: "section-hero",
          path: "style.paddingTop",
          breakpoint: "all",
        },
      ],
    },
    proposal: {
      slug: "home",
      title: "Home",
      layout_json: { blocks: [] },
      style_json: {},
      metadata: {
        ai_contract_version: "hybrid_v1",
        ai_edit_plan: {
          scope: "section",
          mode: "spacing_patch",
          target_ids: ["section-hero"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [
            {
              type: "remove_style",
              target_id: "section-hero",
              path: "style.paddingTop",
              breakpoint: "all",
            },
          ],
        },
        ai_invariants: {
          supports_persistible_flow: true,
          preview_renderable: true,
          desktop_renderable: true,
          mobile_renderable: true,
          target_resolutions: [
            {
              requested_target_id: "section-hero",
              resolved_target_id: "section-hero",
              candidate_path: "projectData.blocks.0",
              confidence: 0.94,
              section_index: 0,
              block_type: "hero",
              selector: "[data-block-id='section-hero']",
              signals: {
                id_structural: 1,
                internal_path: 1,
                data_attributes: 1,
                nearest_heading: 0.8,
                anchor_text: 0.7,
                visual_order: 1,
                textual_similarity: 0.8,
                capture_attachment: 0,
              },
            },
          ],
        },
        base_version: {
          id: "base-version-id",
          version_number: 7,
          status: "draft",
        },
      },
    },
    ...overrides,
  }
}

describe("ai-page-editor helpers", () => {
  it("marks known public routes as persistible", () => {
    expect(isAiPageEditorManagedPersistibleRoute("/sobre")).toBe(true)
    expect(getAiPageEditorRouteCapability("/sobre").supportsPersistibleFlow).toBe(true)
    expect(getAiPageEditorRouteCapability("/aluno/dashboard").supportsPersistibleFlow).toBe(false)
  })

  it("supports allowed path patterns with params and wildcards", () => {
    expect(isAiPageEditorAllowedPath("/aluno/cursos/abc", ["/aluno/cursos/:courseId"])).toBe(true)
    expect(isAiPageEditorAllowedPath("/aluno/cursos/abc/player/modulo-1", ["/aluno/cursos/:courseId/player/*"])).toBe(true)
    expect(isAiPageEditorAllowedPath("/admin", ["/", "/sobre", "/cookies"])).toBe(false)
  })

  it("falls back to the published version when the latest draft is degraded", () => {
    expect(
      shouldUsePublishedVersionForAiContext(
        {
          version_number: 9,
          layout_json: {
            projectData: {
              blocks: [],
            },
          },
        },
        {
          version_number: 8,
          layout_json: {
            projectData: {
              blocks: [
                { id: "hero", type: "rich_text", content: "<p>Texto publicado suficiente para manter o contexto estável.</p>" },
              ],
            },
          },
        },
      ),
    ).toBe(true)
  })

  it("assesses a high-confidence proposal as ready", () => {
    const proposal = createProposal()
    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })

    expect(assessment).not.toBeNull()
    expect(assessment?.status).toBe("ready")
    expect(assessment?.canApply).toBe(true)
    expect(assessment?.baseVersion?.version_number).toBe(7)
    expect(assessment?.highlightSelectors).toEqual(["[data-block-id='section-hero']"])
  })

  it("blocks low-confidence proposals", () => {
    const proposal = createProposal({
      proposal: {
        ...createProposal().proposal,
        metadata: {
          ...createProposal().proposal.metadata,
          ai_invariants: {
            ...createProposal().proposal.metadata.ai_invariants,
            target_resolutions: [
              {
                ...createProposal().proposal.metadata.ai_invariants!.target_resolutions![0],
                confidence: 0.42,
              },
            ],
          },
        },
      },
    })

    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })
    expect(assessment?.status).toBe("blocked")
    expect(assessment?.canApply).toBe(false)
    expect(assessment?.reasons.join(" ")).toContain("confidence baixa")
  })

  it("keeps medium-confidence proposals in review with strict confirmation", () => {
    const proposal = createProposal({
      proposal: {
        ...createProposal().proposal,
        metadata: {
          ...createProposal().proposal.metadata,
          ai_invariants: {
            ...createProposal().proposal.metadata.ai_invariants,
            target_resolutions: [
              {
                ...createProposal().proposal.metadata.ai_invariants!.target_resolutions![0],
                confidence: 0.74,
              },
            ],
          },
        },
      },
    })

    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })
    expect(assessment?.status).toBe("review")
    expect(assessment?.canApply).toBe(true)
    expect(assessment?.requiresStrictConfirmation).toBe(true)
  })

  it("blocks semi-assisted operation types from the main flow", () => {
    const proposal = createProposal({
      edit_plan: {
        ...createProposal().edit_plan,
        mode: "section_layout_patch",
        operations: [
          {
            type: "wrap_children",
            target_id: "section-hero",
            breakpoint: "all",
          },
        ],
      },
    })

    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })
    expect(assessment?.status).toBe("blocked")
    expect(assessment?.unsupportedOperationTypes).toEqual(["wrap_children"])
  })

  it("flags ambiguous target resolutions when multiple requested targets converge to the same node", () => {
    const base = createProposal()
    const proposal = createProposal({
      edit_plan: {
        ...base.edit_plan,
        target_ids: ["hero-a", "hero-b"],
      },
      proposal: {
        ...base.proposal,
        metadata: {
          ...base.proposal.metadata,
          ai_invariants: {
            ...base.proposal.metadata.ai_invariants,
            target_resolutions: [
              {
                ...base.proposal.metadata.ai_invariants!.target_resolutions![0],
                requested_target_id: "hero-a",
                resolved_target_id: "hero-section",
              },
              {
                ...base.proposal.metadata.ai_invariants!.target_resolutions![0],
                requested_target_id: "hero-b",
                resolved_target_id: "hero-section",
              },
            ],
          },
        },
      },
    })

    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })
    expect(assessment?.warnings.join(" ")).toContain("convergiu para o mesmo alvo resolvido")
  })

  it("formats mode labels for launcher cards", () => {
    expect(formatAiPageEditorModeLabel("section_layout_patch")).toBe("Patch de layout da seção")
  })
})
