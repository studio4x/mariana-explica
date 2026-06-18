import { describe, expect, it } from "vitest"
import {
  assessAiPageEditorProposal,
  formatAiPageEditorModeLabel,
  getAiPageEditorRouteCapability,
  isAiPageEditorPublicContentPath,
  isAiPageEditorAllowedPath,
  isAiPageEditorManagedPersistibleRoute,
  resolveAiPageEditorManagedSlug,
  shouldUsePublishedVersionForAiContext,
} from "./ai-page-editor"
import type { AdminAiPageEditorProposal } from "@/types/app.types"

function createProposal(
  overrides: Partial<AdminAiPageEditorProposal> = {},
): AdminAiPageEditorProposal {
  return {
    provider_used: "openai",
    summary: "Ajustar espaco do topo",
    explanation: "O patch reduz o espaco superior apenas na primeira secao.",
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
    final_status: "proposal_ready",
    change_detected: true,
    draft_saved: false,
    preview_available: true,
    change_summary: {
      layout_changed: true,
      style_changed: false,
      html_changed: false,
    },
    ...overrides,
  }
}

describe("ai-page-editor helpers", () => {
  it("marks known public routes as persistible", () => {
    expect(isAiPageEditorManagedPersistibleRoute("/sobre", ["/sobre"])).toBe(true)
    expect(getAiPageEditorRouteCapability("/sobre", { allowedPaths: ["/sobre"] }).supportsPersistibleFlow).toBe(true)
    expect(getAiPageEditorRouteCapability("/aluno/dashboard", { allowedPaths: ["/aluno/dashboard"] }).supportsPersistibleFlow).toBe(false)
  })

  it("supports allowed path patterns with params and wildcards", () => {
    expect(isAiPageEditorAllowedPath("/aluno/cursos/abc", ["/aluno/cursos/:courseId"])).toBe(true)
    expect(isAiPageEditorAllowedPath("/aluno/cursos/abc/player/modulo-1", ["/aluno/cursos/:courseId/player/*"])).toBe(true)
    expect(isAiPageEditorAllowedPath("/admin", ["/", "/sobre", "/cookies"])).toBe(false)
  })

  it("resolves stable dynamic slugs for public routes", () => {
    expect(resolveAiPageEditorManagedSlug("/explicacoes")).toBe("explicacoes")
    expect(resolveAiPageEditorManagedSlug("/explicacoes/?origem=teste")).toBe("explicacoes")
    expect(resolveAiPageEditorManagedSlug("/termos-de-uso")).toBe("termos")
  })

  it("treats allowed public routes as persistible even when they are not hardcoded legacy slugs", () => {
    const capability = getAiPageEditorRouteCapability("/explicacoes?origem=x", {
      allowedPaths: ["/", "/sobre", "/explicacoes"],
    })

    expect(capability.routeIsPublic).toBe(true)
    expect(capability.managedSlug).toBe("explicacoes")
    expect(capability.supportsPersistibleFlow).toBe(true)
    expect(capability.reason).toBeNull()
  })

  it("keeps auth and student routes blocked even if they appear in allowed paths", () => {
    expect(isAiPageEditorPublicContentPath("/login")).toBe(false)
    expect(getAiPageEditorRouteCapability("/login", { allowedPaths: ["/login"] }).supportsPersistibleFlow).toBe(false)
    expect(getAiPageEditorRouteCapability("/aluno/dashboard", { allowedPaths: ["/aluno/dashboard"] }).reason).toContain("privada")
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
                { id: "hero", type: "rich_text", content: "<p>Texto publicado suficiente para manter o contexto estavel.</p>" },
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
    const base = createProposal()
    const target = base.proposal.metadata.ai_invariants!.target_resolutions![0]
    const proposal = createProposal({
      proposal: {
        ...base.proposal,
        metadata: {
          ...base.proposal.metadata,
          ai_invariants: {
            ...base.proposal.metadata.ai_invariants,
            target_resolutions: [{ ...target, confidence: 0.42 }],
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
    const base = createProposal()
    const target = base.proposal.metadata.ai_invariants!.target_resolutions![0]
    const proposal = createProposal({
      final_status: "awaiting_intent_confirmation",
      proposal: {
        ...base.proposal,
        metadata: {
          ...base.proposal.metadata,
          ai_invariants: {
            ...base.proposal.metadata.ai_invariants,
            target_resolutions: [{ ...target, confidence: 0.74 }],
          },
        },
      },
    })

    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })
    expect(assessment?.status).toBe("review")
    expect(assessment?.canApply).toBe(true)
    expect(assessment?.requiresStrictConfirmation).toBe(true)
  })

  it("blocks proposals classified as no visible change", () => {
    const assessment = assessAiPageEditorProposal(
      createProposal({
        final_status: "no_visible_change",
        change_detected: false,
        preview_available: false,
        change_summary: {
          layout_changed: false,
          style_changed: false,
          html_changed: false,
        },
      }),
      { canPersistDraft: true },
    )

    expect(assessment?.status).toBe("blocked")
    expect(assessment?.canApply).toBe(false)
    expect(assessment?.reasons.join(" ")).toContain("sem alteração visível")
  })

  it("blocks proposals when preview is not available", () => {
    const assessment = assessAiPageEditorProposal(
      createProposal({
        preview_available: false,
        final_status: "blocked",
      }),
      { canPersistDraft: true },
    )

    expect(assessment?.status).toBe("blocked")
    expect(assessment?.canApply).toBe(false)
    expect(assessment?.reasons.join(" ")).toContain("pré-visualização")
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

  it("accepts explicit_css_patch proposals that use an internal operation target id", () => {
    const proposal = createProposal({
      summary: "Atualizar a regra CSS .me-managed-page-root na pagina Sobre.",
      explanation: "Preparei um ajuste localizado na regra .me-managed-page-root.",
      edit_plan: {
        scope: "page",
        mode: "style_patch",
        target_ids: [".me-managed-page-root"],
        risk_level: "low",
        requires_strict_confirmation: false,
        operations: [
          {
            type: "set_style",
            target_id: "explicit_css_selector",
            path: "padding",
            value: "56px 20px 0px",
            breakpoint: "all",
          },
        ],
      },
      proposal: {
        slug: "sobre",
        title: "Sobre",
        layout_json: { blocks: [] },
        style_json: {
          css: ".me-managed-page-root {\n  padding: 56px 20px 0px !important;\n}",
        },
        metadata: {
          ai_contract_version: "hybrid_v1",
          ai_edit_plan: {
            scope: "page",
            mode: "style_patch",
            target_ids: [".me-managed-page-root"],
            risk_level: "low",
            requires_strict_confirmation: false,
            operations: [
              {
                type: "set_style",
                target_id: "explicit_css_selector",
                path: "padding",
                value: "56px 20px 0px",
                breakpoint: "all",
              },
            ],
          },
          ai_invariants: {
            branch_selected: "explicit_css_patch",
            explicit_css_patch_applied: true,
            explicit_css_selector: ".me-managed-page-root",
            explicit_css_properties: ["padding"],
            explicit_css_values: ["56px 20px 0px"],
            supports_persistible_flow: true,
            preview_renderable: true,
            desktop_renderable: true,
            mobile_renderable: true,
            target_resolutions: [
              {
                requested_target_id: ".me-managed-page-root",
                resolved_target_id: ".me-managed-page-root",
                candidate_path: ".me-managed-page-root",
                confidence: 1,
                section_index: -1,
                block_type: "explicit_css_selector",
                selector: ".me-managed-page-root",
                signals: {
                  id_structural: 1,
                  internal_path: 1,
                  data_attributes: 1,
                  nearest_heading: 0,
                  anchor_text: 0,
                  visual_order: 0,
                  textual_similarity: 1,
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
      change_summary: {
        layout_changed: false,
        style_changed: true,
        html_changed: false,
      },
    })

    const assessment = assessAiPageEditorProposal(proposal, { canPersistDraft: true })
    expect(assessment?.status).toBe("ready")
    expect(assessment?.canApply).toBe(true)
    expect(assessment?.targetIds).toEqual([".me-managed-page-root"])
  })

  it("formats mode labels for launcher cards", () => {
    expect(formatAiPageEditorModeLabel("section_layout_patch")).toBe("Patch de layout da seção")
  })
})
