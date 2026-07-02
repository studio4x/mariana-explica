import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import { AdminVisualSiteEditor } from "./AdminVisualSiteEditor"

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

function buildPageDetail(pageKey: string) {
  const isMaterials = pageKey === "materials"
  const publishedVersion = {
    id: `${pageKey}-version-1`,
    page_id: `${pageKey}-page-1`,
    version_number: 1,
    status: "published" as const,
    entries_json: isMaterials
      ? {
          hero: {
            eyebrow: "Materiais",
            title: "Tudo o que precisas para brilhares",
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
      : {
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
    created_at: "2026-01-01T00:00:00.000Z",
  }
  const draftVersion = {
    id: `${pageKey}-version-2`,
    page_id: `${pageKey}-page-1`,
    version_number: 2,
    status: "draft" as const,
    entries_json: publishedVersion.entries_json,
    style_json: {},
    metadata: {},
    created_by: null,
    created_at: "2026-01-02T00:00:00.000Z",
  }

  return {
    page: {
      id: `${pageKey}-page-1`,
      page_key: pageKey,
      title: isMaterials ? "Materiais" : "Suporte",
      status: "published" as const,
      published_version_id: `${pageKey}-version-1`,
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

function renderEditor(pathname = "/admin/editor-visual") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route path="/admin/editor-visual" element={<AdminVisualSiteEditor />} />
          <Route path="/admin/editor-visual/:pageKey" element={<AdminVisualSiteEditor />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("AdminVisualSiteEditor", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
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
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async (pageKey: string) => buildPageDetail(pageKey))
  })

  it("shows the visual editor workspace", async () => {
    renderEditor()

    expect(screen.getByRole("heading", { name: "Editor Visual" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Materiais" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /guardar rascunho/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /publicar/i })).toBeInTheDocument()
    expect(await screen.findByText("Legenda do topo")).toBeInTheDocument()
    expect(await screen.findByText("Formatação de texto")).toBeInTheDocument()
    expect(await screen.findByText("Versao 2")).toBeInTheDocument()
    expect(screen.getByText("Como podemos ajudar?")).toBeInTheDocument()
  })

  it("opens the materials editor workspace", async () => {
    renderEditor("/admin/editor-visual/materials")

    expect(screen.getByRole("heading", { name: "Editor Visual" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Materiais/i })).toBeInTheDocument()
    expect(screen.getByText("Tudo o que precisas para brilhares")).toBeInTheDocument()
    expect(screen.getByText("Explorar catálogo")).toBeInTheDocument()
  })
})
