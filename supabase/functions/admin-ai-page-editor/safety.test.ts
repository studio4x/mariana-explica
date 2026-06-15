import { describe, expect, it } from "vitest"
import {
  isPathAllowedByPatterns,
  matchAllowedPathPattern,
  selectAiBaseVersion,
  shouldUsePublishedVersionForAiContext,
} from "./safety.ts"

function createVersion(overrides: Partial<{
  id: string
  page_id: string
  version_number: number
  status: string
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  metadata: Record<string, unknown>
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    page_id: overrides.page_id ?? "page-1",
    version_number: overrides.version_number ?? 1,
    status: overrides.status ?? "draft",
    layout_json: overrides.layout_json ?? { projectData: { blocks: [] } },
    style_json: overrides.style_json ?? {},
    metadata: overrides.metadata ?? {},
  }
}

describe("admin-ai-page-editor safety helpers", () => {
  it("uses the published version when the latest draft is degraded", () => {
    const published = createVersion({
      version_number: 8,
      status: "published",
      layout_json: {
        projectData: {
          blocks: [
            { id: "hero", type: "rich_text", content: "<p>Texto publicado longo o suficiente para ser considerado estável.</p>" },
            { id: "cards", type: "columns", items: ["a", "b", "c"] },
          ],
        },
      },
    })
    const degradedDraft = createVersion({
      version_number: 9,
      status: "draft",
      layout_json: {
        projectData: {
          blocks: [],
        },
      },
    })

    const decision = shouldUsePublishedVersionForAiContext(degradedDraft, published)
    const selected = selectAiBaseVersion({ latestDraft: degradedDraft, publishedVersion: published })

    expect(decision.usePublished).toBe(true)
    expect(selected.baseVersion?.id).toBe(published.id)
    expect(selected.source).toBe("published_version")
    expect(selected.degradedDraftBypassed).toBe(true)
  })

  it("keeps the latest draft when it is not degraded", () => {
    const published = createVersion({
      version_number: 8,
      status: "published",
      layout_json: {
        projectData: {
          blocks: [{ id: "hero", type: "rich_text", content: "<p>Hero publicado.</p>" }],
        },
      },
    })
    const latestDraft = createVersion({
      version_number: 9,
      status: "draft",
      layout_json: {
        projectData: {
          blocks: [{ id: "hero", type: "rich_text", content: "<p>Hero rascunho seguro.</p>" }],
        },
      },
    })

    const selected = selectAiBaseVersion({ latestDraft, publishedVersion: published })
    expect(selected.baseVersion?.id).toBe(latestDraft.id)
    expect(selected.source).toBe("latest_draft")
    expect(selected.degradedDraftBypassed).toBe(false)
  })

  it("matches allowed path patterns with params and wildcards", () => {
    expect(matchAllowedPathPattern("/aluno/cursos/curso-1", "/aluno/cursos/:courseId")).toBe(true)
    expect(matchAllowedPathPattern("/aluno/cursos/curso-1/player/modulo-2", "/aluno/cursos/:courseId/player/*")).toBe(true)
    expect(isPathAllowedByPatterns("/sobre", ["/", "/sobre", "/cookies"])).toBe(true)
    expect(isPathAllowedByPatterns("/admin", ["/", "/sobre", "/cookies"])).toBe(false)
  })
})
