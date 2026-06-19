import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import { PublicManagedPage } from "./PublicManagedPage"
import { storeSitePagePreview } from "@/lib/site-page-preview"
import { buildCanonicalManagedPagePayload } from "@/lib/site-page-builder"

const mockUsePublicSitePage = vi.fn()

vi.mock("@/hooks/usePublicSitePage", () => ({
  usePublicSitePage: (slug: string) => mockUsePublicSitePage(slug),
}))

describe("PublicManagedPage AI preview", () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockUsePublicSitePage.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    })
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it("renders the AI preview banner and highlights resolved targets", () => {
    const token = storeSitePagePreview({
      slug: "home",
      html: `
        <main>
          <section data-block-id="hero">
            <h1>Hero principal</h1>
          </section>
        </main>
      `,
      css: "",
      summary: "Remover padding superior do hero",
      explanation: "Preview derivado do patch engine sobre a base v7.",
      warnings: ["Confere o mobile antes de publicar."],
      editPlan: {
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["section-hero"],
        risk_level: "low",
        requires_strict_confirmation: false,
        operations: [],
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
          confidence: 0.93,
          section_index: 0,
          block_type: "hero",
          selector: "[data-block-id='hero']",
          signals: {
            id_structural: 1,
            internal_path: 1,
            data_attributes: 1,
            nearest_heading: 0.8,
            anchor_text: 0.8,
            visual_order: 1,
            textual_similarity: 0.8,
            capture_attachment: 0,
          },
        },
      ],
      highlightSelectors: ["[data-block-id='hero']"],
    })

    render(
      <MemoryRouter initialEntries={[`/?builder-preview=${token}`]}>
        <PublicManagedPage slug="home" fallback={<div>fallback</div>} />
      </MemoryRouter>,
    )

    expect(screen.getByText("Pré-visualização IA")).toBeInTheDocument()
    expect(screen.getByText("Remover padding superior do hero")).toBeInTheDocument()
    expect(screen.getByText(/1 alvo\(s\) destacados/i)).toBeInTheDocument()
    expect(document.querySelector("[data-block-id='hero']")?.getAttribute("data-me-ai-preview-highlight")).toBe("1")
  })

  it("renders the published managed baseline for /explicacoes with managed markers", () => {
    const payload = buildCanonicalManagedPagePayload("explicacoes")
    expect(JSON.stringify(payload.layoutJson)).toContain("Notas importantes antes de enviares o teu formulário:")
    expect(payload.html).toContain("Notas importantes antes de enviares o teu formulário:")
    mockUsePublicSitePage.mockImplementation((slug: string) => ({
      data:
        slug === "explicacoes"
          ? {
              page: {
                id: "page-explicacoes",
                slug: "explicacoes",
                title: payload.title,
                updated_at: "2026-06-19T10:00:00.000Z",
                published_version_id: "version-explicacoes-1",
              },
              version: {
                id: "version-explicacoes-1",
                page_id: "page-explicacoes",
                version_number: 1,
                layout_json: payload.layoutJson,
                style_json: payload.styleJson,
                metadata: {
                  source: "managed_public_page_seed",
                },
                created_at: "2026-06-19T10:00:00.000Z",
              },
            }
          : null,
      isLoading: false,
      isError: false,
    }))

    render(
      <MemoryRouter initialEntries={["/explicacoes"]}>
        <PublicManagedPage slug="explicacoes" fallback={<div>fallback</div>} />
      </MemoryRouter>,
    )

    expect(screen.getByText("Notas importantes antes de enviares o teu formulário:")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /enviar formulário/i })).toBeInTheDocument()
    expect(document.querySelector(".me-managed-page-root")).not.toBeNull()
    expect(document.querySelector("[data-block-id]")).not.toBeNull()
    expect(document.querySelector("[data-managed-node-id]")).not.toBeNull()
    expect(screen.queryByText("fallback")).not.toBeInTheDocument()
  })
})
