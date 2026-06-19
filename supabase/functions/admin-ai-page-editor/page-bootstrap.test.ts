import { describe, expect, it } from "vitest"
import { assessBootstrapBaseline, hasBootstrapContext, normalizeBootstrapLayout, normalizeBootstrapStyle } from "./page-bootstrap.ts"

describe("page-bootstrap", () => {
  it("keeps html and projectData html aligned for the first baseline", () => {
    const layoutJson = normalizeBootstrapLayout(
      {
        projectData: {
          blocks: [{ id: "hero", type: "rich_text", content: "<p>Hero</p>" }],
        },
      },
      "<section><h2>Hero</h2></section>",
    )

    expect(layoutJson.html).toBe("<section><h2>Hero</h2></section>")
    expect((layoutJson.projectData as Record<string, unknown>).html).toBe("<section><h2>Hero</h2></section>")
  })

  it("accepts managed blocks as enough context even without raw html", () => {
    expect(
      hasBootstrapContext(
        {
          projectData: {
            blocks: [{ id: "hero", type: "rich_text", content: "<p>Hero</p>" }],
          },
        },
        "",
      ),
    ).toBe(true)
  })

  it("rejects empty baselines", () => {
    expect(hasBootstrapContext({}, "")).toBe(false)
  })

  it("normalizes style payloads to plain objects", () => {
    expect(normalizeBootstrapStyle({ css: ".me-managed-page-root{padding:0;}" })).toEqual({
      css: ".me-managed-page-root{padding:0;}",
    })
    expect(normalizeBootstrapStyle(null as never)).toEqual({})
  })

  it("marks a baseline as complete only when html and managed blocks are both present", () => {
    expect(
      assessBootstrapBaseline({
        layoutJson: {
          projectData: {
            blocks: [{ id: "hero", type: "rich_text", content: "<p>Hero</p>" }],
          },
          html:
            '<div class="me-managed-page-root"><section data-block-id="hero" data-managed-node-id="block:hero"><div data-managed-node-id="content:hero"><h2>Hero</h2></div></section></div>',
        },
        styleJson: { css: ".hero{color:#fff;}" },
      }),
    ).toMatchObject({
      complete: true,
      persistible_safe: true,
      block_count: 1,
    })

    expect(
      assessBootstrapBaseline({
        layoutJson: {
          projectData: {
            blocks: [{ id: "hero", type: "rich_text", content: "<p>Hero</p>" }],
          },
        },
        styleJson: {},
      }).complete,
    ).toBe(false)
  })

  it("flags bootstrap baselines built from unmanaged html as non persistible", () => {
    const assessment = assessBootstrapBaseline({
      layoutJson: {
        projectData: {
          blocks: [{ id: "legacy-text-1", type: "rich_text", content: "<p>Texto solto</p>" }],
        },
        html: '<main><section><h2>Texto solto</h2></section></main>',
      },
      styleJson: { css: ".legacy{color:#fff;}" },
    })

    expect(assessment.complete).toBe(true)
    expect(assessment.persistible_safe).toBe(false)
    expect(assessment.reason).toBe("missing_managed_html_markers")
  })
})
