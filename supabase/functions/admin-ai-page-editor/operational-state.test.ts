import { describe, expect, it } from "vitest"
import {
  detectPersistiblePageChange,
  resolvePersistibleProposalOperationalState,
  resolveTextProposalOperationalState,
} from "./operational-state"

const spacingPlan = {
  scope: "page",
  mode: "spacing_patch",
  target_ids: ["page_wrapper_spacing", "first_section_spacing"],
  risk_level: "low",
  requires_strict_confirmation: false,
  operations: [
    {
      type: "remove_style",
      target_id: "page_wrapper_spacing",
      path: "style.paddingTop",
      breakpoint: "all",
    },
    {
      type: "remove_style",
      target_id: "first_section_spacing",
      path: "style.paddingTop",
      breakpoint: "all",
    },
  ],
} as const

describe("operational-state", () => {
  it("detects a real diff when wrapper and first section spacing are both removed", () => {
    const diff = detectPersistiblePageChange({
      baseLayoutJson: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      baseStyleJson: {
        wrapper: { paddingTop: 40 },
        "section-1": { paddingTop: 24 },
      },
      proposalLayoutJson: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      proposalStyleJson: {
        wrapper: { paddingTop: 0 },
        "section-1": { paddingTop: 0 },
      },
    })

    expect(diff.change_detected).toBe(true)
    expect(diff.style_changed).toBe(true)
  })

  it("returns proposal_ready for a valid spacing patch with preview available", () => {
    const state = resolvePersistibleProposalOperationalState({
      editPlan: spacingPlan,
      baseLayoutJson: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      baseStyleJson: {
        wrapper: { paddingTop: 40 },
        "section-1": { paddingTop: 24 },
      },
      proposalLayoutJson: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      proposalStyleJson: {
        wrapper: { paddingTop: 0 },
        "section-1": { paddingTop: 0 },
      },
      targetResolutions: [{ confidence: 0.95 }, { confidence: 0.91 }],
      previewRenderable: true,
      desktopRenderable: true,
      mobileRenderable: true,
    })

    expect(state.final_status).toBe("proposal_ready")
    expect(state.change_detected).toBe(true)
    expect(state.preview_available).toBe(true)
  })

  it("returns awaiting_intent_confirmation when warnings exist before the final proposal", () => {
    const state = resolvePersistibleProposalOperationalState({
      editPlan: {
        ...spacingPlan,
        requires_strict_confirmation: true,
      },
      baseLayoutJson: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      baseStyleJson: {
        wrapper: { paddingTop: 40 },
        "section-1": { paddingTop: 24 },
      },
      proposalLayoutJson: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      proposalStyleJson: {
        wrapper: { paddingTop: 0 },
        "section-1": { paddingTop: 0 },
      },
      targetResolutions: [{ confidence: 0.78 }, { confidence: 0.92 }],
      previewRenderable: true,
      desktopRenderable: true,
      mobileRenderable: true,
    })

    expect(state.final_status).toBe("awaiting_intent_confirmation")
    expect(state.change_detected).toBe(true)
  })

  it("returns no_visible_change when the proposal is a structural and semantic no-op", () => {
    const state = resolvePersistibleProposalOperationalState({
      editPlan: spacingPlan,
      baseLayoutJson: { projectData: { blocks: [{ id: "wrapper" }] } },
      baseStyleJson: { wrapper: { paddingTop: 0 } },
      proposalLayoutJson: { projectData: { blocks: [{ id: "wrapper" }] } },
      proposalStyleJson: { wrapper: { paddingTop: 0 } },
      targetResolutions: [{ confidence: 0.96 }],
      previewRenderable: true,
      desktopRenderable: true,
      mobileRenderable: true,
    })

    expect(state.final_status).toBe("no_visible_change")
    expect(state.change_detected).toBe(false)
    expect(state.preview_available).toBe(false)
  })

  it("returns structured no-op state for header/footer copy when text does not change", () => {
    const state = resolveTextProposalOperationalState({
      currentText: "Anuncio atual",
      nextText: "Anuncio atual",
    })

    expect(state.final_status).toBe("no_visible_change")
    expect(state.change_detected).toBe(false)
    expect(state.change_summary.text_changed).toBe(false)
  })
})
