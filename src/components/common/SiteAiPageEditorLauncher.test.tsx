import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteAiPageEditorLauncher } from "./SiteAiPageEditorLauncher"
import { AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE } from "@/lib/ai-page-editor-response"

const {
  mockUseAuth,
  mockGenerateProposalMutateAsync,
  mockSaveDraftMutateAsync,
  mockGenerateHeaderCopyProposal,
  mockGenerateFooterCopyProposal,
  mockUpdateBrandingConfig,
  mockFetchAdminBrandingConfig,
  mockStoreSitePagePreview,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockGenerateProposalMutateAsync: vi.fn(),
  mockSaveDraftMutateAsync: vi.fn(),
  mockGenerateHeaderCopyProposal: vi.fn(),
  mockGenerateFooterCopyProposal: vi.fn(),
  mockUpdateBrandingConfig: vi.fn(),
  mockFetchAdminBrandingConfig: vi.fn(),
  mockStoreSitePagePreview: vi.fn(() => "preview-token"),
}))

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
        layout_json: { projectData: { blocks: [{ id: "wrapper" }] } },
        style_json: { wrapper: { paddingTop: 32 } },
        metadata: {},
        created_at: "2026-06-15T12:00:00.000Z",
      },
      latest_draft: null,
      versions: [],
      assets: [],
    },
  }),
  useGenerateAdminAiPageEditorProposal: () => ({
    mutateAsync: mockGenerateProposalMutateAsync,
    isPending: false,
  }),
  useSaveAdminSitePageDraft: () => ({
    mutateAsync: mockSaveDraftMutateAsync,
    isPending: false,
  }),
}))

vi.mock("@/hooks/usePublicSitePage", () => ({
  usePublicSitePage: () => ({
    data: null,
  }),
}))

vi.mock("@/services", () => ({
  fetchAdminBrandingConfig: mockFetchAdminBrandingConfig,
  generateAdminAiHeaderCopyProposal: mockGenerateHeaderCopyProposal,
  generateAdminAiFooterCopyProposal: mockGenerateFooterCopyProposal,
  updateAdminBrandingConfig: mockUpdateBrandingConfig,
}))

vi.mock("./site-branding", () => ({
  broadcastBrandingUpdate: vi.fn(),
}))

vi.mock("@/lib/site-page-preview", () => ({
  readSitePagePreviewFromSearch: vi.fn(() => null),
  storeSitePagePreview: mockStoreSitePagePreview,
}))

vi.mock("@/lib/site-page-builder", () => ({
  composeManagedPageCss: vi.fn(() => ""),
  renderDocumentToHtml: vi.fn((document) => JSON.stringify(document)),
  resolveBuilderDocumentFromLayoutJson: vi.fn((_slug, layoutJson) => layoutJson),
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

function createProposalResponse(overrides: Record<string, unknown> = {}) {
  return {
    request_id: "req-1",
    provider_used: "openai",
    conversation_phase: "ready_for_proposal",
    assistant_message: "Percebi assim: queres tirar o espaco do topo desta pagina sem mexer no resto. Esta certo?",
    quick_replies: [],
    understanding_summary: "tirar o espaco do topo desta pagina sem mexer no resto",
    confirmation_token: null,
    confirmation_consumed: true,
    requires_user_confirmation: false,
    can_generate_proposal: true,
    summary: "Remover espaco visivel do topo",
    explanation: "Analisei o wrapper global e a primeira secao.",
    warnings: [],
    edit_plan: {
      scope: "page",
      mode: "spacing_patch",
      target_ids: ["page_wrapper_spacing", "first_section_spacing"],
      risk_level: "low",
      requires_strict_confirmation: false,
      operations: [
        {
          type: "remove_style",
          target_id: "page_wrapper_spacing",
          path: "style.paddingTop",
          breakpoint: "all",
        },
        {
          type: "remove_style",
          target_id: "first_section_spacing",
          path: "style.paddingTop",
          breakpoint: "all",
        },
      ],
    },
    proposal: {
      slug: "sobre",
      title: "Sobre",
      layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      style_json: {
        wrapper: { paddingTop: 0 },
        "section-1": { paddingTop: 0 },
      },
      metadata: {
        ai_contract_version: "hybrid_v1",
        ai_invariants: {
          supports_persistible_flow: true,
          preview_renderable: true,
          desktop_renderable: true,
          mobile_renderable: true,
          target_resolutions: [
            {
              requested_target_id: "page_wrapper_spacing",
              resolved_target_id: "page_wrapper_spacing",
              candidate_path: "projectData.blocks.0",
              confidence: 0.96,
              section_index: 0,
              block_type: "wrapper",
              selector: "[data-block-id='wrapper']",
              signals: {
                id_structural: 1,
                internal_path: 1,
                data_attributes: 1,
                nearest_heading: 1,
                anchor_text: 1,
                visual_order: 1,
                textual_similarity: 1,
                capture_attachment: 0,
              },
            },
            {
              requested_target_id: "first_section_spacing",
              resolved_target_id: "first_section_spacing",
              candidate_path: "projectData.blocks.1",
              confidence: 0.94,
              section_index: 1,
              block_type: "section",
              selector: "[data-block-id='section-1']",
              signals: {
                id_structural: 1,
                internal_path: 1,
                data_attributes: 1,
                nearest_heading: 1,
                anchor_text: 1,
                visual_order: 1,
                textual_similarity: 1,
                capture_attachment: 0,
              },
            },
          ],
        },
        base_version: {
          id: "version-1",
          version_number: 12,
          status: "published",
        },
      },
    },
    final_status: "proposal_ready",
    change_detected: true,
    draft_saved: false,
    preview_available: true,
    change_summary: {
      layout_changed: false,
      style_changed: true,
      html_changed: true,
    },
    ...overrides,
  }
}

function createClarificationResponse(overrides: Record<string, unknown> = {}) {
  return {
    request_id: "req-clarify",
    provider_used: "openai",
    conversation_phase: "needs_clarification",
    assistant_message: "Queres mexer so nesta parte ou na secao inteira?",
    quick_replies: ["So nesta parte", "Na secao inteira"],
    understanding_summary: "mexer nesta area da pagina",
    confirmation_token: null,
    confirmation_consumed: false,
    requires_user_confirmation: false,
    can_generate_proposal: false,
    warnings: [],
    final_status: "needs_clarification",
    change_detected: false,
    draft_saved: false,
    preview_available: false,
    change_summary: {
      layout_changed: false,
      style_changed: false,
      html_changed: false,
    },
    ...overrides,
  }
}

function createSavedDraftResult(overrides: Record<string, unknown> = {}) {
  return {
    page: {
      id: "page-1",
      slug: "sobre",
      title: "Sobre",
    },
    version: {
      id: "version-2",
      version_number: 13,
      status: "draft",
      layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
      style_json: {
        wrapper: { paddingTop: 0 },
        "section-1": { paddingTop: 0 },
      },
      metadata: {},
      created_at: "2026-06-15T12:10:00.000Z",
    },
    ...overrides,
  }
}

async function renderLauncher() {
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

  return { user, queryClient }
}

async function sendMessage(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.clear(screen.getByLabelText(/mensagem/i))
  await user.type(screen.getByLabelText(/mensagem/i), value)
  await user.click(screen.getByRole("button", { name: /enviar/i }))
}

describe("SiteAiPageEditorLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateProposalMutateAsync.mockReset()
    mockSaveDraftMutateAsync.mockReset()
    mockGenerateHeaderCopyProposal.mockReset()
    mockGenerateFooterCopyProposal.mockReset()
    mockUpdateBrandingConfig.mockReset()
    mockFetchAdminBrandingConfig.mockReset()
    mockStoreSitePagePreview.mockReset()
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
    })
    mockFetchAdminBrandingConfig.mockResolvedValue({
      config_value: {
        footer_description: "Rodape atual",
        header_announcement: "Topo atual",
      },
      updated_at: "2026-06-15T12:00:00.000Z",
    })
    mockUpdateBrandingConfig.mockImplementation(async (payload) => ({
      config_value: payload,
      updated_at: "2026-06-15T12:05:00.000Z",
    }))
    mockStoreSitePagePreview.mockReturnValue("preview-token")
  })

  it("does not route a page-top spacing request to the global header branch", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createProposalResponse())

    const { user } = await renderLauncher()
    await sendMessage(user, "Existe espaco visivel no topo da pagina Sobre. Remove o padding-top do wrapper global.")

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateHeaderCopyProposal).not.toHaveBeenCalled()
    expect(screen.queryByText(/topo do site foi atualizado/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
  })

  it("shows no_visible_change instead of success when the backend reports a no-op", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        final_status: "no_visible_change",
        change_detected: false,
        preview_available: false,
        change_summary: {
          layout_changed: false,
          style_changed: false,
          html_changed: false,
        },
      }),
    )

    const { user } = await renderLauncher()
    await sendMessage(user, "Remove o padding-top do topo da pagina.")

    await waitFor(() => {
      expect(screen.getAllByText(new RegExp(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE, "i")).length).toBeGreaterThan(0)
    })
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/atualizado/i)).not.toBeInTheDocument()
  })

  it("renders quick replies and waits for confirmation before showing the preview action", async () => {
    mockGenerateProposalMutateAsync
      .mockResolvedValueOnce(createClarificationResponse())
      .mockResolvedValueOnce(
        createProposalResponse({
          assistant_message: "Percebi assim: queres mexer so nesta parte. Esta certo?",
          quick_replies: ["Sim, e isso", "Nao, quero explicar melhor"],
          requires_user_confirmation: true,
          conversation_phase: "awaiting_intent_confirmation",
          confirmation_token: "intent_confirm_1",
          confirmation_consumed: false,
          can_generate_proposal: false,
          summary: undefined,
          explanation: undefined,
          edit_plan: undefined,
          proposal: undefined,
        }),
      )
      .mockResolvedValueOnce(createProposalResponse())

    const { user } = await renderLauncher()
    await sendMessage(user, "Quero mudar esta parte.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /so nesta parte/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /so nesta parte/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sim, e isso/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /sim, e isso/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    })
    expect(screen.queryByText(/falta so a tua confirmacao/i)).not.toBeInTheDocument()
  })

  it("allows the success path only after diff real, draft saved and preview available", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createProposalResponse())
    mockSaveDraftMutateAsync.mockResolvedValueOnce(createSavedDraftResult())

    const { user } = await renderLauncher()
    await sendMessage(user, "Remove o espaco do topo da pagina Sobre com patch localizado.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /preparar previa/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirmar altera/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/revisao pronta/i)).toBeInTheDocument()
  })

  it("keeps the chat copy simple when a confirmed spacing request already comes back as preview-ready", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        assistant_message: "Entendi. Preparei uma prévia só para tirar esse espaço do topo, sem mexer no resto da página.",
        quick_replies: [],
        conversation_phase: "ready_for_proposal",
        understanding_summary: "tirar o espaço do topo da página Sobre",
        requires_user_confirmation: false,
        can_generate_proposal: true,
      }),
    )

    const { user } = await renderLauncher()
    await sendMessage(user, "Sim, é isso mesmo.")

    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes("Preparei uma prévia só para tirar esse espaço do topo")),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    expect(screen.queryByText(/\bpadding\b|\bwrapper\b|\bproposal\b/i)).not.toBeInTheDocument()
  })

  it("shows a friendly error without reopening confirmation when the confirmed safe patch fails", async () => {
    mockGenerateProposalMutateAsync
      .mockResolvedValueOnce(
        createProposalResponse({
          assistant_message: "Percebi assim: queres tirar o espaco do topo da pagina Sobre. Esta certo?",
          quick_replies: ["Sim, e isso"],
          understanding_summary: "tirar o espaco do topo da pagina Sobre",
          conversation_phase: "awaiting_intent_confirmation",
          confirmation_token: "intent_confirm_failure",
          confirmation_consumed: false,
          requires_user_confirmation: true,
          can_generate_proposal: false,
          summary: undefined,
          explanation: undefined,
          edit_plan: undefined,
          proposal: undefined,
          final_status: "awaiting_intent_confirmation",
          change_detected: false,
          preview_available: false,
          change_summary: {
            layout_changed: false,
            style_changed: false,
            html_changed: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        createClarificationResponse({
          conversation_phase: "ready_for_proposal",
          assistant_message:
            "Percebi o que queres mudar, mas esta tentativa segura não conseguiu preparar a prévia. Vou precisar ajustar melhor o alvo.",
          understanding_summary: "tirar o espaco do topo da pagina Sobre",
          quick_replies: [],
          confirmation_token: null,
          confirmation_consumed: true,
          final_status: "error",
        }),
      )

    const { user } = await renderLauncher()
    await sendMessage(user, "Quero tirar o espaço do topo da página Sobre.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sim, e isso/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /sim, e isso/i }))

    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes("tentativa segura") && content.includes("preparar a prévia")),
      ).toBeInTheDocument()
    })
    expect(screen.queryByText(/falta so a tua confirmacao/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /sim, e isso/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()
  })

  it("ignores stale responses whose client_request_id does not match the active request", async () => {
    mockGenerateProposalMutateAsync
      .mockImplementationOnce(async () =>
        createProposalResponse({
          client_request_id: "stale-client-request",
          assistant_message: "Resposta antiga que nao devia entrar.",
        }))
      .mockImplementationOnce(async (input: { clientRequestId: string }) =>
        createProposalResponse({
          client_request_id: input.clientRequestId,
          assistant_message: "Entendi. Esta e a resposta atual.",
        }))

    const { user } = await renderLauncher()
    await sendMessage(user, "Primeiro pedido.")

    await waitFor(() => {
      expect(screen.queryByText(/resposta antiga que nao devia entrar/i)).not.toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText(/mensagem/i)).not.toBeDisabled()
    })

    await sendMessage(user, "Segundo pedido.")

    await waitFor(() => {
      expect(screen.getByText(/esta e a resposta atual/i)).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
  })

  it("does not show success when the draft save fails", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createProposalResponse())
    mockSaveDraftMutateAsync.mockRejectedValueOnce(new Error("Falha ao guardar draft"))

    const { user } = await renderLauncher()
    await sendMessage(user, "Aplica o patch seguro no topo da pagina.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /preparar previa/i }))

    await waitFor(() => {
      expect(screen.getByText(/falha ao guardar draft/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /confirmar altera/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/topo do site foi atualizado/i)).not.toBeInTheDocument()
  })

  it("does not show success when preview storage is unavailable for a draft flow", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createProposalResponse())
    mockSaveDraftMutateAsync.mockResolvedValueOnce(createSavedDraftResult())
    mockStoreSitePagePreview.mockReturnValueOnce("")

    const { user } = await renderLauncher()
    await sendMessage(user, "Remove o espaco do topo e abre a previa segura.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /preparar previa/i }))

    await waitFor(() => {
      expect(screen.getByText(/nenhum sucesso foi confirmado/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /confirmar altera/i })).not.toBeInTheDocument()
  })

  it("keeps the flow usable for a new attempt after a no-op", async () => {
    mockGenerateProposalMutateAsync
      .mockResolvedValueOnce(
        createProposalResponse({
          final_status: "no_visible_change",
          change_detected: false,
          preview_available: false,
          change_summary: {
            layout_changed: false,
            style_changed: false,
            html_changed: false,
          },
        }),
      )
      .mockResolvedValueOnce(createProposalResponse())

    const { user } = await renderLauncher()
    await sendMessage(user, "Primeira tentativa sem efeito.")

    await waitFor(() => {
      expect(screen.getAllByText(new RegExp(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE, "i")).length).toBeGreaterThan(0)
    })

    await sendMessage(user, "Tenta agora remover o padding-top do wrapper global da pagina Sobre.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    })
    expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(2)
  })

  it("renders a friendly error when proposal is missing instead of exposing a raw ReferenceError", async () => {
    mockGenerateProposalMutateAsync.mockRejectedValueOnce(new Error("proposal is not defined"))

    const { user } = await renderLauncher()
    await sendMessage(user, "Remove o padding-top do wrapper global da pagina Sobre.")

    await waitFor(() => {
      expect(screen.getAllByText(/resposta incompleta do servidor/i).length).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/proposal is not defined/i)).not.toBeInTheDocument()
  })
})
