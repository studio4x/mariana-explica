import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { PublicManagedPage } from "./PublicManagedPage"
import { storeSitePagePreview } from "@/lib/site-page-preview"

const mockUsePublicSitePage = vi.fn()

vi.mock("@/hooks/usePublicSitePage", () => ({
  usePublicSitePage: (slug: string) => mockUsePublicSitePage(slug),
}))

describe("PublicManagedPage AI preview", () => {
  function renderManagedPage(pathname: string, element: ReactNode) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[pathname]}>{element}</MemoryRouter>
      </QueryClientProvider>,
    )
  }

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

    renderManagedPage(`/?builder-preview=${token}`, <PublicManagedPage slug="home" fallback={<div>fallback</div>} />)

    expect(screen.getByText("Pré-visualização IA")).toBeInTheDocument()
    expect(screen.getByText("Remover padding superior do hero")).toBeInTheDocument()
    expect(screen.getByText(/1 alvo\(s\) destacados/i)).toBeInTheDocument()
    expect(document.querySelector("[data-block-id='hero']")?.getAttribute("data-me-ai-preview-highlight")).toBe("1")
  })

  it("keeps the managed page visually hidden until the first published payload resolves", () => {
    mockUsePublicSitePage.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    })

    const { container } = renderManagedPage("/", <PublicManagedPage slug="home" fallback={<div>fallback</div>} />)

    const managedPage = container.querySelector("[data-public-managed-page-paint='pending']")
    expect(managedPage).not.toBeNull()
    expect(screen.queryByText("fallback")).not.toBeInTheDocument()
  })
})
