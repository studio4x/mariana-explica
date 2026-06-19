import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import html2canvas from "html2canvas"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteAiPageEditorLauncher } from "./SiteAiPageEditorLauncher"
import { AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE } from "@/lib/ai-page-editor-response"

const {
  mockUseAuth,
  mockUseAdminOptionalSitePageDetail,
  mockGenerateProposalMutateAsync,
  mockSaveDraftMutateAsync,
  mockPublishPageVersionMutateAsync,
  mockRollbackPageVersionMutateAsync,
  mockGenerateHeaderCopyProposal,
  mockGenerateFooterCopyProposal,
  mockUpdateBrandingConfig,
  mockFetchAdminBrandingConfig,
  mockStoreSitePagePreview,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseAdminOptionalSitePageDetail: vi.fn(),
  mockGenerateProposalMutateAsync: vi.fn(),
  mockSaveDraftMutateAsync: vi.fn(),
  mockPublishPageVersionMutateAsync: vi.fn(),
  mockRollbackPageVersionMutateAsync: vi.fn(),
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
    mutateAsync: mockPublishPageVersionMutateAsync,
    isPending: false,
  }),
  useRollbackAdminSitePageVersion: () => ({
    mutateAsync: mockRollbackPageVersionMutateAsync,
    isPending: false,
  }),
  useAdminOptionalSitePageDetail: () => mockUseAdminOptionalSitePageDetail(),
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
  convertLegacyHtmlToBuilderDocument: vi.fn((html) => ({ blocks: [{ id: "dom-snapshot", type: "rich_text", content: html }] })),
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

function createManagedPageDetailMock(overrides: Record<string, unknown> = {}) {
  const layoutJson = {
    projectData: {
      blocks: [
        {
          id: "wrapper",
          type: "rich_text",
          content: "<section><h1>Sobre</h1><p>Conteudo gerido.</p></section>",
          layout: {
            gridColumns: 12,
            align: "center",
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            backgroundColor: "transparent",
            backgroundImageUrl: "",
            backgroundImageSize: "cover",
            borderRadius: 0,
            contentAlignX: "stretch",
            contentAlignY: "top",
            contentGap: 0,
            minHeight: 0,
          },
        },
      ],
    },
    html:
      '<div class="me-managed-page-root">' +
      '<section class="me-managed-block" data-block-id="wrapper" data-block-type="rich_text" data-managed-node-id="block:wrapper" data-ai-editor-id="managed:wrapper" data-section-index="0">' +
      '<div class="me-managed-richtext" data-parent-block-id="wrapper" data-managed-node-id="content:wrapper" data-ai-editor-id="managed:wrapper:content" data-block-type="rich_text">' +
      "<section><h1>Sobre</h1><p>Conteudo gerido.</p></section>" +
      "</div></section></div>",
  }

  return {
    data: {
      page: {
        id: "page-1",
        slug: "sobre",
        title: "Sobre",
        status: "published",
        published_version_id: "version-1",
        created_by: null,
        created_at: "2026-06-15T12:00:00.000Z",
        updated_at: "2026-06-15T12:00:00.000Z",
      },
      published_version: {
        id: "version-1",
        page_id: "page-1",
        version_number: 12,
        status: "published",
        layout_json: layoutJson,
        style_json: {},
        metadata: {
          source: "managed_public_page_seed",
        },
        created_by: null,
        created_at: "2026-06-15T12:00:00.000Z",
      },
      latest_draft: null,
      versions: [
        {
          id: "version-1",
          page_id: "page-1",
          version_number: 12,
          status: "published",
          layout_json: layoutJson,
          style_json: {},
          metadata: {
            source: "managed_public_page_seed",
          },
          created_by: null,
          created_at: "2026-06-15T12:00:00.000Z",
        },
      ],
      assets: [],
    },
    isLoading: false,
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
  const submitButton = screen.getAllByRole("button", { name: /enviar/i }).at(-1)
  if (!submitButton) throw new Error("submit button not found")
  await user.click(submitButton)
}

describe("SiteAiPageEditorLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateProposalMutateAsync.mockReset()
    mockSaveDraftMutateAsync.mockReset()
    mockPublishPageVersionMutateAsync.mockReset()
    mockRollbackPageVersionMutateAsync.mockReset()
    mockGenerateHeaderCopyProposal.mockReset()
    mockGenerateFooterCopyProposal.mockReset()
    mockUpdateBrandingConfig.mockReset()
    mockFetchAdminBrandingConfig.mockReset()
    mockStoreSitePagePreview.mockReset()
    mockUseAdminOptionalSitePageDetail.mockReset()
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
    mockUseAdminOptionalSitePageDetail.mockReturnValue(createManagedPageDetailMock())
    vi.mocked(html2canvas).mockResolvedValue({
      width: 640,
      height: 320,
      toDataURL: () => "data:image/jpeg;base64,ZmFrZS1jYXB0dXJl",
    } as unknown as HTMLCanvasElement)
    document.elementsFromPoint = vi.fn(() => [])
    mockPublishPageVersionMutateAsync.mockResolvedValue({
      page: {
        id: "page-1",
        slug: "sobre",
        title: "Sobre",
      },
      version: {
        id: "version-2",
        version_number: 13,
        status: "published",
        layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
        style_json: {
          wrapper: { paddingTop: 0 },
          "section-1": { paddingTop: 0 },
        },
        metadata: {},
        created_at: "2026-06-15T12:15:00.000Z",
      },
    })
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

  it("shows a clear restriction when the route is allowed but still lacks a real managed baseline", async () => {
    mockUseAdminOptionalSitePageDetail.mockReturnValue({
      data: null,
      isLoading: false,
    })

    await renderLauncher()

    expect(screen.getByText(/ainda não existe site_pages\/published baseline para esta rota/i)).toBeInTheDocument()
    expect(screen.getByText(/header e footer globais continuam suportados/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()
  })

  it("routes spacing between the header and the first section to the visual proposal flow", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createProposalResponse())

    const { user } = await renderLauncher()
    await sendMessage(user, "remova o espaco em branco entre o cabecalho e a primeira secao")

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateHeaderCopyProposal).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    expect(screen.queryByText(/conteudo textual|folha de estilos|texto do cabecalho/i)).not.toBeInTheDocument()
  })

  it("keeps explicit header copy changes on the textual header branch", async () => {
    mockGenerateHeaderCopyProposal.mockResolvedValueOnce({
      provider_used: "openai",
      summary: "Atualizar texto do cabecalho",
      explanation: "Preparei uma versao curta para o anuncio do topo.",
      warnings: [],
      header_announcement: "Novo anuncio",
      final_status: "proposal_ready",
      change_detected: true,
      draft_saved: false,
      preview_available: false,
      change_summary: {
        layout_changed: false,
        style_changed: false,
        html_changed: false,
        text_changed: true,
      },
    })

    const { user } = await renderLauncher()
    await sendMessage(user, "quero mudar o texto do cabecalho")

    await waitFor(() => {
      expect(mockGenerateHeaderCopyProposal).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateProposalMutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText(/topo do site atualizado/i)).toBeInTheDocument()
  })

  it("routes footer-adjacent spacing to the visual page flow instead of footer copy", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        assistant_message: "Entendido. Preparei a remocao do espaco entre a ultima secao e o rodape.",
        summary: "Remover espaco antes do rodape",
        explanation: "Ajuste visual localizado no fim da pagina.",
        edit_plan: {
          scope: "section",
          mode: "spacing_patch",
          target_ids: ["footer_adjacent_spacing"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [
            {
              type: "set_style",
              target_id: "footer_adjacent_spacing",
              path: "padding-bottom",
              value: 0,
              breakpoint: "all",
            },
          ],
        },
      }),
    )

    const { user } = await renderLauncher()
    await sendMessage(user, "remova o espaco entre a ultima secao e o rodape")

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateFooterCopyProposal).not.toHaveBeenCalled()
    expect(screen.queryByText(/texto do rodape|rodape do site foi atualizado/i)).not.toBeInTheDocument()
  })

  it("keeps explicit footer copy changes on the textual footer branch", async () => {
    mockGenerateFooterCopyProposal.mockResolvedValueOnce({
      provider_used: "openai",
      summary: "Atualizar texto do rodape",
      explanation: "Preparei uma versao mais clara para o rodape.",
      warnings: [],
      footer_description: "Novo rodape",
      final_status: "proposal_ready",
      change_detected: true,
      draft_saved: false,
      preview_available: false,
      change_summary: {
        layout_changed: false,
        style_changed: false,
        html_changed: false,
        text_changed: true,
      },
    })

    const { user } = await renderLauncher()
    await sendMessage(user, "quero mudar o texto do rodape")

    await waitFor(() => {
      expect(mockGenerateFooterCopyProposal).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateProposalMutateAsync).not.toHaveBeenCalled()
    expect(screen.getByText(/rodape do site atualizado/i)).toBeInTheDocument()
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

  it('does not show "Ja preparei" when the backend did not return a real draft or preview flow', async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce({
      ...createClarificationResponse({
        conversation_phase: "ready_for_proposal",
        assistant_message: 'Procurei o texto "Notas importantes antes de enviares o teu formulario:", mas preciso de mais contexto visual.',
        understanding_summary: 'mudar a cor do texto "Notas importantes antes de enviares o teu formulario:" para branco',
        final_status: "needs_clarification",
      }),
    })

    const { user } = await renderLauncher()
    await sendMessage(user, 'mude a cor do texto "Notas importantes antes de enviares o teu formulario:" para branco')

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText(/ja preparei o proximo passo para veres antes de publicar/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()
  })

  it("does not mix a legacy textual refusal with no-op feedback for visual spacing requests", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        assistant_message: "Entendi. Vou ajustar melhor o alvo visual antes da primeira secao.",
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
    await sendMessage(user, "ha uma faixa branca entre o menu e a primeira secao")

    await waitFor(() => {
      expect(screen.getAllByText(new RegExp(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE, "i")).length).toBeGreaterThan(0)
    })
    expect(mockGenerateHeaderCopyProposal).not.toHaveBeenCalled()
    expect(screen.queryByText(/conteudo textual|folha de estilos|texto do cabecalho/i)).not.toBeInTheDocument()
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

  it("marks the follow-up uploaded file as insert_image_asset when the target capture is already pending", async () => {
    mockGenerateProposalMutateAsync
      .mockResolvedValueOnce({
        ...createClarificationResponse({
          assistant_message:
            "Entendido. Queres inserir uma imagem na area selecionada. Envia agora a imagem ou um link da imagem que queres usar.",
          quick_replies: ["Vou enviar a imagem agora"],
          understanding_summary: "inserir uma imagem na area selecionada, mantendo o restante da secao igual",
          pending_image_insert: {
            target_source: "capture",
            target_page: "/sobre",
            target_slug: "sobre",
            target_hint: "selected_area",
            capture_attachment_id: "capture-1",
            capture_attachment_name: "recorte-sobre.jpg",
            status: "waiting_for_image_asset",
          },
        }),
      })
      .mockResolvedValueOnce(
        createClarificationResponse({
          conversation_phase: "awaiting_intent_confirmation",
          assistant_message:
            "Perfeito. Vou inserir esta imagem na area selecionada, mantendo o restante da secao igual. Posso preparar a previa?",
          quick_replies: ["Sim, prepara a previa"],
          understanding_summary: "inserir esta imagem na area selecionada, mantendo o restante da secao igual",
          pending_image_insert: {
            target_source: "capture",
            target_page: "/sobre",
            target_slug: "sobre",
            target_hint: "selected_area",
            capture_attachment_id: "capture-1",
            capture_attachment_name: "recorte-sobre.jpg",
            image_asset_attachment_id: "attachment-1",
            status: "awaiting_confirmation",
          },
          requires_user_confirmation: true,
          final_status: "awaiting_intent_confirmation",
        }),
      )

    const { user } = await renderLauncher()
    await sendMessage(user, "quero inserir uma imagem nesse local")

    await waitFor(() => {
      expect(screen.getByText(/envia agora a imagem/i)).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["fake-image"], "hero.webp", { type: "image/webp" })
    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    })

    await waitFor(() => {
      expect(screen.getByText(/hero\.webp/i)).toBeInTheDocument()
    })

    await sendMessage(user, "segue a imagem")

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(2)
    })
    const secondCall = mockGenerateProposalMutateAsync.mock.calls[1]?.[0]
    expect(secondCall.conversationContext.pending_image_insert).toMatchObject({
      capture_attachment_id: "capture-1",
      status: "waiting_for_image_asset",
    })
    expect(secondCall.attachments[0]).toMatchObject({
      name: "hero.webp",
      role: "insert_image_asset",
    })
  })

  it("stores pending target clarification from the backend and sends it back on the next turn", async () => {
    mockGenerateProposalMutateAsync
      .mockResolvedValueOnce(
        createClarificationResponse({
          assistant_message: "Entendi o ajuste, mas preciso que seleciones melhor o titulo certo.",
          understanding_summary: 'mudar a cor do texto "De estudante para estudante: porque este projeto?" para branco',
          pending_target_clarification: {
            requestedAt: "2026-06-18T18:00:00.000Z",
            intent: "set_text_color",
            textAnchor: "De estudante para estudante: porque este projeto?",
            requestedProperty: "color",
            requestedValue: "#ffffff",
            awaiting: "capture",
            resolvedTarget: {
              found: true,
              confidence: 0.97,
              resolutionSource: "block_id",
              selectedTarget: {
                targetId: "about-story",
                blockId: "about-story",
                managedNodeId: "block:about-story",
              },
              candidateCount: 1,
              evidence: {
                captureProvided: true,
                primaryCandidateProvided: true,
                textAnchorProvided: true,
                exactTextMatch: false,
                normalizedTextMatch: true,
                candidateIntersectsCapture: true,
                candidateMatchesManagedContent: true,
              },
              rejectionReasons: [],
            },
            capturedTarget: null,
          },
        }),
      )
      .mockResolvedValueOnce(createProposalResponse())

    const { user } = await renderLauncher()
    await sendMessage(user, 'mude a cor do texto "De estudante para estudante: porque este projeto?" para branco')

    await waitFor(() => {
      expect(screen.getByText(/preciso que seleciones melhor o titulo certo/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/falta mapear o alvo real da pagina/i)).toBeInTheDocument()

    await sendMessage(user, "agora esta certo")

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(2)
    })
    const secondCall = mockGenerateProposalMutateAsync.mock.calls[1]?.[0]
    expect(secondCall.conversationContext.pending_target_clarification).toMatchObject({
      intent: "set_text_color",
      requestedProperty: "color",
      requestedValue: "#ffffff",
      awaiting: "capture",
      resolvedTarget: {
        found: true,
        resolutionSource: "block_id",
        selectedTarget: {
          blockId: "about-story",
        },
      },
    })
  })

  it("captures DOM metadata together with the selected screenshot area", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createClarificationResponse())

    const managedRoot = document.createElement("main")
    managedRoot.innerHTML = `
      <div class="me-managed-page-root">
        <section class="me-managed-block" data-block-id="hero-heading" data-managed-node-id="block:hero-heading">
          <h1 data-parent-block-id="hero-heading" data-managed-node-id="content:hero-heading">Transforme o seu estudo</h1>
        </section>
      </div>
    `
    document.body.appendChild(managedRoot)

    const wrapper = managedRoot.querySelector("[data-block-id='hero-heading']") as HTMLElement
    const heading = managedRoot.querySelector("[data-managed-node-id='content:hero-heading']") as HTMLElement
    wrapper.getBoundingClientRect = () =>
      ({
        x: 24,
        y: 48,
        width: 420,
        height: 160,
        top: 48,
        left: 24,
        right: 444,
        bottom: 208,
      } as DOMRect)
    heading.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 72,
        width: 280,
        height: 48,
        top: 72,
        left: 40,
        right: 320,
        bottom: 120,
      } as DOMRect)
    const extensionOverlay = document.createElement("div")
    extensionOverlay.textContent = "overlay externo"
    extensionOverlay.className = "browser-extension-overlay"
    document.body.appendChild(extensionOverlay)
    extensionOverlay.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 720,
      } as DOMRect)
    document.elementsFromPoint = vi.fn(() => [extensionOverlay, heading, wrapper])

    const { user } = await renderLauncher()
    await user.click(screen.getByRole("button", { name: /capturar area/i }))

    const overlay = document.querySelector("[data-ai-page-editor-root] .fixed.inset-0") as HTMLElement
    fireEvent.mouseDown(overlay, { button: 0, clientX: 20, clientY: 40 })
    fireEvent.mouseMove(overlay, { clientX: 260, clientY: 180 })
    fireEvent.mouseUp(overlay, { clientX: 260, clientY: 180 })

    await user.click(screen.getByRole("button", { name: /confirmar/i }))

    await waitFor(() => {
      expect(screen.getByText(/recorte-.*\.jpg/i)).toBeInTheDocument()
    })

    await sendMessage(user, "mude a cor deste titulo para branco")

    await waitFor(() => {
      expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(1)
    })
    const firstCall = mockGenerateProposalMutateAsync.mock.calls[0]?.[0]
    expect(firstCall.attachments[0].metadata.target_capture).toMatchObject({
      role: "target_capture",
      pathname: "/sobre",
      primaryCandidate: {
        blockId: "hero-heading",
        managedNodeId: "content:hero-heading",
      },
    })
    expect(
      firstCall.attachments[0].metadata.target_capture.domCandidates.some(
        (candidate: { classNames?: string[] }) => candidate.classNames?.includes("browser-extension-overlay"),
      ),
    ).toBe(false)
    expect(firstCall.attachments[0].metadata.target_capture.domCandidates.length).toBeGreaterThan(0)
    expect(firstCall.attachments[0].metadata.target_capture.textFragments[0]).toContain("Transforme o seu estudo")

    extensionOverlay.remove()
    managedRoot.remove()
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

  it("keeps localized visual patch copy simple and avoids truncation errors", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        assistant_message: "Preparei a remocao da linha decorativa abaixo do titulo indicado.",
        summary: "Remover linha decorativa",
        explanation: "Ajuste visual localizado.",
        edit_plan: {
          scope: "section",
          mode: "style_patch",
          target_ids: ["localized_divider_below_heading"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [
            {
              type: "remove_style",
              target_id: "localized_divider_below_heading",
              path: "localized-divider",
              breakpoint: "all",
            },
          ],
        },
        proposal: {
          slug: "sobre",
          title: "Sobre",
          layout_json: { projectData: { blocks: [{ id: "story" }, { id: "support" }] } },
          style_json: { css: ".story hr { display: none !important; }" },
          metadata: {
            ai_contract_version: "hybrid_v1",
            ai_invariants: {
              plan_source: "localized_visual_patch",
              localized_visual_patch: true,
              supports_persistible_flow: true,
              preview_renderable: true,
              desktop_renderable: true,
              mobile_renderable: true,
              target_resolutions: [
                {
                  requested_target_id: "localized_divider_below_heading",
                  resolved_target_id: "story",
                  candidate_path: "projectData.blocks.0",
                  confidence: 0.91,
                  section_index: 0,
                  block_type: "rich_text",
                  selector: ".me-managed-page-root > .me-managed-block:nth-of-type(1)",
                  signals: {
                    id_structural: 0.18,
                    internal_path: 0,
                    data_attributes: 0,
                    nearest_heading: 0.18,
                    anchor_text: 0.54,
                    visual_order: 0.1,
                    textual_similarity: 0,
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
      }),
    )

    const { user } = await renderLauncher()
    await sendMessage(user, "Sim, e isso mesmo.")

    await waitFor(() => {
      expect(screen.getByText(/linha decorativa abaixo do titulo/i)).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    expect(screen.queryByText(/truncada|provider|proposal/i)).not.toBeInTheDocument()
  })

  it("shows explicit CSS previews with the real selector and never reintroduces the first-section target", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        assistant_message:
          "Preparei uma previa ajustando o padding-bottom da classe .me-managed-page-root para remover o espaco antes do rodape, mantendo o restante da pagina igual.",
        summary: "Ajustar padding-bottom da classe .me-managed-page-root.",
        explanation: "Patch CSS explicito e localizado no wrapper da pagina.",
        edit_plan: {
          scope: "page",
          mode: "style_patch",
          target_ids: [".me-managed-page-root"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [
            {
              type: "set_style",
              target_id: "explicit_css_selector",
              path: "padding-bottom",
              value: "0px",
              breakpoint: "all",
            },
          ],
        },
        proposal: {
          slug: "sobre",
          title: "Sobre",
          layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
          style_json: {
            css: ".me-managed-page-root {\n  padding-bottom: 0px !important;\n}",
          },
          metadata: {
            ai_contract_version: "hybrid_v1",
            ai_invariants: {
              branch_selected: "explicit_css_patch",
              explicit_css_selector: ".me-managed-page-root",
              explicit_css_properties: ["padding-bottom"],
              supports_persistible_flow: true,
              preview_renderable: true,
              desktop_renderable: true,
              mobile_renderable: true,
              target_resolutions: [
                {
                  requested_target_id: ".me-managed-page-root",
                  resolved_target_id: ".me-managed-page-root",
                  candidate_path: ".me-managed-page-root",
                  confidence: 1,
                  section_index: -1,
                  block_type: "explicit_css_selector",
                  selector: ".me-managed-page-root",
                  signals: {
                    id_structural: 1,
                    internal_path: 1,
                    data_attributes: 1,
                    nearest_heading: 0,
                    anchor_text: 0,
                    visual_order: 0,
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
      }),
    )

    const { user } = await renderLauncher()
    await sendMessage(user, "Sim, e isso mesmo.")

    await waitFor(() => {
      expect(screen.getByText(/\.me-managed-page-root/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/ja preparei o proximo passo para veres antes de publicar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/primeira secao/i)).not.toBeInTheDocument()
  })

  it("auto-applies explicit CSS preview confirmations into draft plus pending publication", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(
      createProposalResponse({
        assistant_message:
          "Preparei uma previa atualizando a regra .me-managed-page-root com os valores pedidos, mantendo o restante da pagina igual.",
        summary: "Atualizar a regra CSS .me-managed-page-root na pagina Sobre.",
        explanation: "Preparei um ajuste localizado na regra .me-managed-page-root, aplicando apenas max-width, margin, padding.",
        edit_plan: {
          scope: "page",
          mode: "style_patch",
          target_ids: [".me-managed-page-root"],
          risk_level: "low",
          requires_strict_confirmation: false,
          operations: [
            {
              type: "set_style",
              target_id: "explicit_css_selector",
              path: "padding",
              value: "56px 20px 0px",
              breakpoint: "all",
            },
          ],
        },
        proposal: {
          slug: "sobre",
          title: "Sobre",
          layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
          style_json: {
            css: ".me-managed-page-root {\n  max-width: 1120px !important;\n  margin: 0px auto !important;\n  padding: 56px 20px 0px !important;\n}",
          },
          metadata: {
            ai_contract_version: "hybrid_v1",
            ai_invariants: {
              branch_selected: "explicit_css_patch",
              explicit_css_patch_applied: true,
              explicit_css_selector: ".me-managed-page-root",
              explicit_css_properties: ["max-width", "margin", "padding"],
              explicit_css_values: ["1120px", "0px auto", "56px 20px 0px"],
              explicit_css_validation: {
                selector_found: true,
                rule_found: true,
                rule_created: false,
                style_changed: true,
                change_detected: true,
              },
              supports_persistible_flow: true,
              preview_renderable: true,
              desktop_renderable: true,
              mobile_renderable: true,
              target_resolutions: [
                {
                  requested_target_id: ".me-managed-page-root",
                  resolved_target_id: ".me-managed-page-root",
                  candidate_path: ".me-managed-page-root",
                  confidence: 1,
                  section_index: -1,
                  block_type: "explicit_css_selector",
                  selector: ".me-managed-page-root",
                  signals: {
                    id_structural: 1,
                    internal_path: 1,
                    data_attributes: 1,
                    nearest_heading: 0,
                    anchor_text: 0,
                    visual_order: 0,
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
      }),
    )
    mockSaveDraftMutateAsync.mockResolvedValueOnce(
      createSavedDraftResult({
        version: {
          id: "version-2",
          version_number: 13,
          status: "draft",
          layout_json: { projectData: { blocks: [{ id: "wrapper" }, { id: "section-1" }] } },
          style_json: {
            css: ".me-managed-page-root {\n  max-width: 1120px !important;\n  margin: 0px auto !important;\n  padding: 56px 20px 0px !important;\n}",
          },
          metadata: {},
          created_at: "2026-06-15T12:10:00.000Z",
        },
      }),
    )

    const { user } = await renderLauncher()
    await sendMessage(user, "Sim, prepara a previa")

    await waitFor(() => {
      expect(mockSaveDraftMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(mockStoreSitePagePreview).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /confirmar altera/i })).toBeInTheDocument()
    expect(screen.getAllByText(/previa preparada ajustando a regra/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /preparar previa/i })).not.toBeInTheDocument()
  })

  it("applies a pending proposal when the admin says faca o ajuste", async () => {
    mockGenerateProposalMutateAsync.mockResolvedValueOnce(createProposalResponse())
    mockSaveDraftMutateAsync.mockResolvedValueOnce(createSavedDraftResult())

    const { user } = await renderLauncher()
    await sendMessage(user, "Remove o espaco do topo da pagina Sobre com patch localizado.")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparar previa/i })).toBeInTheDocument()
    })

    await sendMessage(user, "faca o ajuste")

    await waitFor(() => {
      expect(mockSaveDraftMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateProposalMutateAsync).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /confirmar altera/i })).toBeInTheDocument()
    expect(screen.queryByText(/falta so a tua confirmacao/i)).not.toBeInTheDocument()
  })

  it("publishes the pending preview when the admin says pode publicar", async () => {
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

    await sendMessage(user, "pode publicar")

    await waitFor(() => {
      expect(mockPublishPageVersionMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText(/a alteracao foi confirmada e ja esta visivel no site/i)).toBeInTheDocument()
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
