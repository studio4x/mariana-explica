import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

function buildSupportDetail() {
    const draftVersion = {
      id: "support-version-2",
      page_id: "support-page-1",
      version_number: 2,
      status: "draft",
      entries_json: {
        hero: {
          eyebrow: "Suporte e FAQ",
          title: "Como podemos ajudar?",
          lead: "Encontre respostas rapidas na FAQ e, se ainda precisar, abra um chamado.",
          primaryCta: {
            label: "Abrir um chamado",
            href: "/aluno/chamados?openTicketModal=1&ticketStep=form",
          },
          secondaryCta: {
            label: "Entrar na conta",
            href: "/login",
          },
          image: {
            src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'></svg>",
            alt: "Ilustracao",
          },
        },
        supportCta: {
          title: "Ainda precisa de ajuda?",
          lead: "Abra um chamado autenticado para receber acompanhamento pelo dashboard.",
          primaryCta: {
            label: "Abrir um chamado",
            href: "/aluno/chamados?openTicketModal=1&ticketStep=form",
          },
          secondaryCta: {
            label: "Entrar na conta",
            href: "/login",
          },
        },
      },
      style_json: {},
      metadata: {},
      created_by: null,
      created_at: "2026-01-02T00:00:00.000Z",
    }

    const publishedVersion = {
      id: "support-version-1",
      page_id: "support-page-1",
      version_number: 1,
      status: "published",
      entries_json: {},
      style_json: {},
      metadata: {},
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
    }

    return {
      page: {
        id: "support-page-1",
        page_key: "support",
        title: "Suporte",
      status: "published",
      published_version_id: "support-version-1",
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      versions: [
        draftVersion,
        publishedVersion,
      ],
      publishedVersion,
      latestDraft: draftVersion,
      assets: [],
    }
}

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
    expect(screen.getAllByRole("link", { name: "Abrir um chamado" })[0]).toHaveAttribute(
      "href",
      "/aluno/chamados?openTicketModal=1&ticketStep=form",
    )
    expect(screen.getByText("Pergunta de teste")).toBeInTheDocument()
    expect(screen.queryByText("Guardar rascunho")).not.toBeInTheDocument()
  })

  it("opens the sidebar when an admin clicks an editable element", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
    })
    mockFetchAdminVisualEditorPageDetail.mockResolvedValue(buildSupportDetail())

    renderSupport()

    expect(await screen.findByRole("button", { name: "Como podemos ajudar?" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Como podemos ajudar?" }))

    expect(await screen.findByText("Elemento selecionado")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Como podemos ajudar?")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Guardar rascunho/i })).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "Abrir um chamado" })[0])
    expect(await screen.findByText("Botao principal")).toBeInTheDocument()
    expect(screen.getByLabelText("Rotulo")).toBeInTheDocument()
    expect(screen.getByLabelText("Destino")).toBeInTheDocument()
  })
})
