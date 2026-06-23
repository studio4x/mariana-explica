import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import { Support } from "./Support"

const mockUseAuth = vi.fn()
const mockUsePublishedFaqCategories = vi.fn()
const mockUsePublishedFaqs = vi.fn()
const mockFetchPublicVisualEditorPage = vi.fn()
const mockFetchAdminVisualEditorPageDetail = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/useFaqs", () => ({
  usePublishedFaqCategories: () => mockUsePublishedFaqCategories(),
  usePublishedFaqs: () => mockUsePublishedFaqs(),
}))

vi.mock("@/features/site-editor/visual-editor/api", () => ({
  fetchPublicVisualEditorPage: (...args: unknown[]) => mockFetchPublicVisualEditorPage(...args),
  fetchAdminVisualEditorPageDetail: (...args: unknown[]) => mockFetchAdminVisualEditorPageDetail(...args),
  saveVisualEditorPageDraft: vi.fn(),
  publishVisualEditorPageVersion: vi.fn(),
  restoreVisualEditorPageVersion: vi.fn(),
}))

function renderSupport(pathname = "/suporte") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <Support />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Support", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
    })
    mockUsePublishedFaqCategories.mockReturnValue({
      data: [
        {
          id: "cat-general",
          slug: "general",
          title: "Geral",
        },
      ],
    })
    mockUsePublishedFaqs.mockReturnValue({
      data: [
        {
          id: "faq-1",
          category_id: "cat-general",
          question: "Pergunta de teste",
          answer: "Resposta de teste",
          sort_order: 1,
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    })
    mockFetchPublicVisualEditorPage.mockResolvedValue(null)
    mockFetchAdminVisualEditorPageDetail.mockResolvedValue(null)
  })

  it("renders the public support page without editor controls", async () => {
    renderSupport()

    expect(screen.getByRole("heading", { name: "Como podemos ajudar?" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Entrar na conta" })[0]).toHaveAttribute("href", "/login")
    expect(screen.getByText("Pergunta de teste")).toBeInTheDocument()
    expect(screen.queryByText("Editar imagem")).not.toBeInTheDocument()
    expect(screen.queryByText("Guardar rascunho")).not.toBeInTheDocument()
  })

  it("shows editor controls to an admin on the public support page", async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
    })
    mockFetchAdminVisualEditorPageDetail.mockResolvedValue({
      page: {
        id: "page-1",
        page_key: "support",
        title: "Suporte",
        status: "published",
        published_version_id: "version-1",
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      versions: [
        {
          id: "version-1",
          page_id: "page-1",
          version_number: 1,
          status: "published",
          entries_json: {},
          style_json: {},
          metadata: {},
          created_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      publishedVersion: {
        id: "version-1",
        page_id: "page-1",
        version_number: 1,
        status: "published",
        entries_json: {},
        style_json: {},
        metadata: {},
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      latestDraft: null,
      assets: [],
    })

    renderSupport()

    expect(screen.getByRole("button", { name: /Guardar rascunho/i })).toBeInTheDocument()
    expect(screen.getByText("Editor visual")).toBeInTheDocument()
    expect(screen.getByText("Clique num elemento da pagina para editá-lo.")).toBeInTheDocument()
  })
})
