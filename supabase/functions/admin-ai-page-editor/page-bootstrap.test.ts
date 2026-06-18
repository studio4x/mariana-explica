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
          html: "<section><h2>Hero</h2></section>",
        },
        styleJson: { css: ".hero{color:#fff;}" },
      }),
    ).toMatchObject({
      complete: true,
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
})
