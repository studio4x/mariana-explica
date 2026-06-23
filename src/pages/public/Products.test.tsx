import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Products } from "./Products"

const mockUseAuth = vi.fn()
const mockUsePublishedProductCategories = vi.fn()
const mockUsePublishedProducts = vi.fn()
const mockUsePublishedFaqCategories = vi.fn()
const mockUsePublishedFaqs = vi.fn()
const mockUseMyProducts = vi.fn()
const mockFetchPublicVisualEditorPage = vi.fn()
const mockFetchAdminVisualEditorPageDetail = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/useProducts", () => ({
  usePublishedProductCategories: () => mockUsePublishedProductCategories(),
  usePublishedProducts: () => mockUsePublishedProducts(),
}))

vi.mock("@/hooks/useFaqs", () => ({
  usePublishedFaqCategories: () => mockUsePublishedFaqCategories(),
  usePublishedFaqs: () => mockUsePublishedFaqs(),
}))

vi.mock("@/hooks/useDashboard", () => ({
  useMyProducts: () => mockUseMyProducts(),
}))

vi.mock("@/features/site-editor/visual-editor/api", () => ({
  fetchPublicVisualEditorPage: (...args: unknown[]) => mockFetchPublicVisualEditorPage(...args),
  fetchAdminVisualEditorPageDetail: (...args: unknown[]) => mockFetchAdminVisualEditorPageDetail(...args),
  saveVisualEditorPageDraft: vi.fn(),
  publishVisualEditorPageVersion: vi.fn(),
  restoreVisualEditorPageVersion: vi.fn(),
}))

function buildMaterialsDetail() {
    const draftVersion = {
      id: "materials-version-2",
      page_id: "materials-page-1",
      version_number: 2,
      status: "draft",
      entries_json: {
        hero: {
          eyebrow: "Materiais",
          title: "Tudo o que precisas para brilhares",
          lead: "Encontra aqui os teus melhores amigos de estudo.",
          primaryCta: {
            label: "Explorar catálogos",
            href: "#catalogo",
          },
        },
        catalogHelpCta: {
          label: "Precisas de ajuda para escolher?",
          href: "/suporte",
        },
        supportCta: {
          title: "Dúvidas? Estou aqui para ajudar!",
          lead: "Se precisares, fala diretamente comigo.",
          primaryCta: {
            label: "Preciso de ajuda!",
            href: "/suporte",
          },
          secondaryCta: {
            label: "Entrar na conta",
            href: "/login",
          },
        },
        faq: {
          eyebrow: "Respostas úteis",
          title: "Perguntas Frequentes",
        },
      },
      style_json: {},
      metadata: {},
      created_by: null,
      created_at: "2026-01-02T00:00:00.000Z",
    }

    const publishedVersion = {
      id: "materials-version-1",
      page_id: "materials-page-1",
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
        id: "materials-page-1",
        page_key: "materials",
        title: "Materiais",
      status: "published",
      published_version_id: "materials-version-1",
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

function renderProducts(pathname = "/materiais") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <Products />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("Products", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
    })
    mockUsePublishedProductCategories.mockReturnValue({
      data: [
        {
          id: "cat-1",
          slug: "packs-poupanca",
          title: "Packs poupança",
          description: null,
          sort_order: 1,
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    })
    mockUsePublishedProducts.mockReturnValue({
      data: [
        {
          id: "product-1",
          slug: "sebenta-testes",
          title: "Sebenta Teste",
          short_description: "Resumo prático",
          description: "Conteúdo de teste",
          product_type: "paid",
          status: "published",
          price_cents: 1590,
          currency: "EUR",
          cover_image_url: null,
          launch_date: "2026-01-01T00:00:00.000Z",
          is_public: true,
          creator_id: null,
          creator_commission_percent: null,
          workload_minutes: 30,
          has_linear_progression: false,
          quiz_type_settings: {},
          public_page_content: null,
          sales_page_enabled: true,
          requires_auth: false,
          is_featured: true,
          allow_affiliate: false,
          sort_order: 1,
          category_id: "cat-1",
          published_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
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
    mockUseMyProducts.mockReturnValue({
      data: [],
    })
    mockFetchPublicVisualEditorPage.mockResolvedValue(null)
    mockFetchAdminVisualEditorPageDetail.mockResolvedValue(null)
  })

  it("renders the public materials page without editor controls", async () => {
    renderProducts()

    expect(screen.getByRole("heading", { name: "Tudo o que precisas para brilhares" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Explorar catálogo" })).toHaveAttribute("href", "#catalogo")
    expect(screen.getByRole("link", { name: "Precisas de ajuda para escolher?" })).toHaveAttribute("href", "/suporte")
    expect(screen.getByRole("heading", { name: "Sebenta Teste" })).toBeInTheDocument()
    expect(screen.getByText("Pergunta de teste")).toBeInTheDocument()
    expect(screen.queryByText("Guardar rascunho")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Abrir editor visual" })).not.toBeInTheDocument()
  })

  it("shows editor controls to an admin on the public materials page", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
    })
    mockFetchAdminVisualEditorPageDetail.mockResolvedValue(buildMaterialsDetail())

    renderProducts()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    expect(await screen.findByRole("button", { name: "Ativar edicao" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Ativar edicao" }))

    expect(await screen.findByRole("button", { name: "Tudo o que precisas para brilhares" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Tudo o que precisas para brilhares" }))
    expect(await screen.findByText("Elemento selecionado")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Tudo o que precisas para brilhares")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Explorar/i }))
    expect(await screen.findByText("Botao principal")).toBeInTheDocument()
    expect(screen.getByLabelText("Rotulo")).toBeInTheDocument()
    expect(screen.getByLabelText("Destino")).toBeInTheDocument()
  })
})
