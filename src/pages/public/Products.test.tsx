import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { render, screen, waitFor } from "@testing-library/react"
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
const mockSaveVisualEditorPageDraft = vi.fn()
const mockPublishVisualEditorPageVersion = vi.fn()
const mockRestoreVisualEditorPageVersion = vi.fn()

vi.setConfig({ testTimeout: 10000 })

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
  saveVisualEditorPageDraft: (...args: unknown[]) => mockSaveVisualEditorPageDraft(...args),
  publishVisualEditorPageVersion: (...args: unknown[]) => mockPublishVisualEditorPageVersion(...args),
  restoreVisualEditorPageVersion: (...args: unknown[]) => mockRestoreVisualEditorPageVersion(...args),
}))

function buildMaterialsDocument(title: string) {
  return {
    hero: {
      eyebrow: "Materiais",
      title,
      lead: "Encontra aqui os teus melhores amigos de estudo.",
      primaryCta: {
        label: "Explorar catálogo",
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
  }
}

function buildMaterialsDetail() {
  const publishedDocument = buildMaterialsDocument("Tudo o que precisas para brilhares")
  const staleDraftDocument = buildMaterialsDocument("Tudo o que precisas para brilhares | Draft antigo")

  const publishedVersion = {
    id: "materials-version-1",
    page_id: "materials-page-1",
    version_number: 1,
    status: "published",
    entries_json: publishedDocument,
    style_json: {},
    metadata: {},
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
  }

  const draftVersion = {
    id: "materials-version-2",
    page_id: "materials-page-1",
    version_number: 2,
    status: "draft",
    entries_json: staleDraftDocument,
    style_json: {},
    metadata: {},
    created_by: null,
    created_at: "2026-01-02T00:00:00.000Z",
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
    versions: [draftVersion, publishedVersion],
    publishedVersion,
    latestDraft: draftVersion,
    assets: [],
  }
}

let materialsPageDetail: any = buildMaterialsDetail()

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

async function clickEditableField(user: ReturnType<typeof userEvent.setup>, fieldKey: string) {
  const field = await waitFor(() => {
    const element = document.querySelector<HTMLElement>(`[data-visual-editor-field="${fieldKey}"]`)
    expect(element).not.toBeNull()
    return element as HTMLElement
  })

  await user.click(field)
}

describe("Products", () => {
  beforeEach(() => {
    materialsPageDetail = buildMaterialsDetail()
    mockSaveVisualEditorPageDraft.mockReset()
    mockPublishVisualEditorPageVersion.mockReset()
    mockRestoreVisualEditorPageVersion.mockReset()
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false })
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
    mockUseMyProducts.mockReturnValue({ data: [] })
    mockFetchPublicVisualEditorPage.mockResolvedValue(null)
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => materialsPageDetail)

    mockSaveVisualEditorPageDraft.mockImplementation(async ({ document, title }: any) => {
      const nextDocument = document ?? buildMaterialsDocument(title ?? "Tudo o que precisas para brilhares")
      const saved: any = {
        page: {
          id: "materials-page-1",
          page_key: "materials",
          title: title ?? "Materiais",
          status: "published",
          published_version_id: "materials-version-3",
          created_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-03T00:00:00.000Z",
        },
        version: {
          id: "materials-version-3",
          page_id: "materials-page-1",
          version_number: 3,
          status: "draft",
          entries_json: nextDocument,
          style_json: {},
          metadata: {},
          created_by: null,
          created_at: "2026-01-03T00:00:00.000Z",
        },
      }

      materialsPageDetail = {
        ...materialsPageDetail,
        versions: [saved.version, ...materialsPageDetail.versions.filter((version: any) => version.id !== saved.version.id)],
        latestDraft: saved.version,
        page: {
          ...materialsPageDetail.page,
          updated_at: saved.page.updated_at,
        },
      }

      return saved
    })

    mockPublishVisualEditorPageVersion.mockImplementation(async ({ versionId }: any) => {
      const published: any = {
        page: {
          id: "materials-page-1",
          page_key: "materials",
          title: "Materiais",
          status: "published",
          published_version_id: versionId,
          created_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-03T00:00:00.000Z",
        },
        version: {
          id: versionId,
          page_id: "materials-page-1",
          version_number: 3,
          status: "published",
          entries_json: buildMaterialsDocument("Tudo o que precisas para brilhares | Teste Persistencia"),
          style_json: {},
          metadata: {},
          created_by: null,
          created_at: "2026-01-03T00:00:00.000Z",
        },
      }

      materialsPageDetail = {
        ...materialsPageDetail,
        versions: [published.version, ...materialsPageDetail.versions.filter((version: any) => version.id !== published.version.id)],
        latestDraft: null,
        publishedVersion: published.version,
        page: {
          ...materialsPageDetail.page,
          published_version_id: versionId,
          updated_at: published.page.updated_at,
        },
      }

      return published
    })
  })

  it("renders the public materials page without editor controls", async () => {
    renderProducts()

    expect(screen.getByRole("heading", { name: "Tudo o que precisas para brilhares" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Explorar catálogo/i })).toHaveAttribute("href", "#catalogo")
    expect(screen.getByRole("link", { name: "Precisas de ajuda para escolher?" })).toHaveAttribute("href", "/suporte")
    expect(screen.getByRole("heading", { name: "Sebenta Teste" })).toBeInTheDocument()
    expect(screen.getByText("Pergunta de teste")).toBeInTheDocument()
    expect(screen.queryByText("Guardar rascunho")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Abrir editor visual" })).not.toBeInTheDocument()
  })

  it("shows editor controls to an admin on the public materials page", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => materialsPageDetail)

    renderProducts()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    expect(await screen.findByRole("button", { name: "Ativar edicao" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Ativar edicao" }))

    await clickEditableField(user, "hero.title")
    expect(await screen.findByText("Elemento selecionado")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Tudo o que precisas para brilhares | Draft antigo")).toBeInTheDocument()

    await clickEditableField(user, "hero.primaryCta")
    expect(await screen.findByText("Botao principal")).toBeInTheDocument()
    expect(screen.getByLabelText("Rotulo")).toBeInTheDocument()
    expect(screen.getByLabelText("Destino")).toBeInTheDocument()
  })

  it("publishes the freshly saved materials draft instead of a stale draft", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => materialsPageDetail)

    renderProducts()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "hero.title")

    const titleInput = await screen.findByDisplayValue("Tudo o que precisas para brilhares | Draft antigo")
    await user.clear(titleInput)
    await user.type(titleInput, "Tudo o que precisas para brilhares | Teste Persistencia")
    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "materials",
        document: expect.objectContaining({
          hero: expect.objectContaining({
            title: "Tudo o que precisas para brilhares | Teste Persistencia",
          }),
        }),
      }),
    )
    expect(mockPublishVisualEditorPageVersion).toHaveBeenCalledWith({
      pageKey: "materials",
      versionId: "materials-version-3",
    })
    expect(await screen.findByText("Versao 3 publicada com sucesso.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tudo o que precisas para brilhares | Teste Persistencia" })).toBeInTheDocument()
  })
})
