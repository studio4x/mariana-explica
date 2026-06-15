import { beforeEach, describe, expect, it } from "vitest"
import { readSitePagePreviewFromSearch, storeSitePagePreview } from "./site-page-preview"

describe("site-page-preview", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("stores and reads enriched AI preview payloads", () => {
    const token = storeSitePagePreview({
      slug: "home",
      html: "<main><section data-block-id='hero'>Hero</section></main>",
      css: ".hero{padding-top:0;}",
      summary: "Remover padding superior do hero",
      explanation: "Patch derivado do backend a partir da base_version 7.",
      warnings: ["Revise o espaçamento mobile antes de publicar."],
      editPlan: {
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
      baseVersion: {
        id: "base-version-id",
        version_number: 7,
        status: "draft",
      },
      targetResolutions: [
        {
          requested_target_id: "section-hero",
          resolved_target_id: "section-hero",
          candidate_path: "projectData.blocks.0",
          confidence: 0.91,
          section_index: 0,
          block_type: "hero",
          selector: "[data-block-id='hero']",
          signals: {
            id_structural: 1,
            internal_path: 1,
            data_attributes: 1,
            nearest_heading: 0.8,
            anchor_text: 0.6,
            visual_order: 1,
            textual_similarity: 0.7,
            capture_attachment: 0,
          },
        },
      ],
      aiInvariants: {
        preview_renderable: true,
        desktop_renderable: true,
        mobile_renderable: true,
      },
      highlightSelectors: ["[data-block-id='hero']"],
    })

    expect(token).toBeTruthy()

    const payload = readSitePagePreviewFromSearch("home", `?builder-preview=${token}`)
    expect(payload?.summary).toBe("Remover padding superior do hero")
    expect(payload?.baseVersion?.version_number).toBe(7)
    expect(payload?.highlightSelectors).toEqual(["[data-block-id='hero']"])
    expect(payload?.targetResolutions?.[0]?.confidence).toBe(0.91)
  })
})
