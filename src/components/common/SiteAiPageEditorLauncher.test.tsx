import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { SiteAiPageEditorLauncher } from "./SiteAiPageEditorLauncher"

const mockUseAuth = vi.fn()
const mockMutateAsync = vi.fn()

vi.mock("html2canvas", () => ({
  default: vi.fn(),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/useAdmin", () => ({
  useAdminAiPageEditorConfig: () => ({
    data: {
      config_value: {
        enabled: true,
        launcher_label: "Editar com IA",
        allowed_paths: ["/sobre"],
        max_attachments: 2,
      },
    },
    isLoading: false,
  }),
  usePublishAdminSitePageVersion: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRollbackAdminSitePageVersion: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAdminSitePageDetail: () => ({
    data: {
      page: {
        id: "page-1",
        slug: "sobre",
        title: "Sobre",
      },
      published_version: {
        id: "version-1",
        version_number: 12,
        status: "published",
        layout_json: { projectData: { blocks: [] } },
        style_json: {},
        metadata: {},
        created_at: "2026-06-15T12:00:00.000Z",
      },
      latest_draft: null,
      versions: [],
      assets: [],
    },
  }),
  useGenerateAdminAiPageEditorProposal: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useSaveAdminSitePageDraft: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock("@/hooks/usePublicSitePage", () => ({
  usePublicSitePage: () => ({
    data: null,
  }),
}))

vi.mock("@/services", () => ({
  fetchAdminBrandingConfig: vi.fn().mockResolvedValue({
    config_value: {
      footer_description: "",
      header_announcement: "",
    },
    updated_at: "2026-06-15T12:00:00.000Z",
  }),
  generateAdminAiHeaderCopyProposal: vi.fn(),
  generateAdminAiFooterCopyProposal: vi.fn(),
  updateAdminBrandingConfig: vi.fn(),
}))

vi.mock("./site-branding", () => ({
  broadcastBrandingUpdate: vi.fn(),
}))

vi.mock("@/lib/site-page-builder", () => ({
  composeManagedPageCss: vi.fn(() => ""),
  renderDocumentToHtml: vi.fn(() => "<main>Sobre</main>"),
  resolveBuilderDocumentFromLayoutJson: vi.fn(() => ({ blocks: [] })),
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe("SiteAiPageEditorLauncher", () => {
  it("renders a friendly error when proposal is missing instead of exposing a raw ReferenceError", async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
    })
    mockMutateAsync.mockRejectedValueOnce(new Error("proposal is not defined"))

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/sobre"]}>
          <SiteAiPageEditorLauncher />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole("button", { name: /editar com ia/i }))
    await user.type(screen.getByLabelText(/mensagem/i), "Remove o padding-top do wrapper global da pagina Sobre.")
    await user.click(screen.getByRole("button", { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getAllByText(/resposta incompleta do servidor/i).length).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/proposal is not defined/i)).not.toBeInTheDocument()
  })
})
