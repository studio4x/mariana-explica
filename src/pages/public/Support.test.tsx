import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Support } from "./Support"

const mockUseAuth = vi.fn()
const mockUsePublishedFaqCategories = vi.fn()
const mockUsePublishedFaqs = vi.fn()
const mockFetchPublicVisualEditorPage = vi.fn()
const mockFetchAdminVisualEditorPageDetail = vi.fn()
const mockSaveVisualEditorPageDraft = vi.fn()
const mockPublishVisualEditorPageVersion = vi.fn()
const mockRestoreVisualEditorPageVersion = vi.fn()

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
  saveVisualEditorPageDraft: (...args: unknown[]) => mockSaveVisualEditorPageDraft(...args),
  publishVisualEditorPageVersion: (...args: unknown[]) => mockPublishVisualEditorPageVersion(...args),
  restoreVisualEditorPageVersion: (...args: unknown[]) => mockRestoreVisualEditorPageVersion(...args),
}))

function buildSupportDocument(title: string) {
  return {
    hero: {
      eyebrow: "Suporte e FAQ",
      title,
      lead: "Encontre respostas rapidas na FAQ e, se ainda precisar, abra um chamado.",
      primaryCta: {
        label: "Abrir um chamado",
        href: "/aluno/suporte?openTicketModal=1&ticketStep=form",
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
        href: "/aluno/suporte?openTicketModal=1&ticketStep=form",
      },
      secondaryCta: {
        label: "Entrar na conta",
        href: "/login",
      },
    },
  }
}

function buildSupportDetail() {
  const publishedDocument = buildSupportDocument("Como podemos ajudar?")
  const staleDraftDocument = buildSupportDocument("Como podemos ajudar? | Draft antigo")

  const publishedVersion = {
    id: "support-version-1",
    page_id: "support-page-1",
    version_number: 2,
    status: "published",
    entries_json: publishedDocument,
    style_json: {},
    metadata: {},
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
  }

  const draftVersion = {
    id: "support-version-2",
    page_id: "support-page-1",
    version_number: 1,
    status: "draft",
    entries_json: staleDraftDocument,
    style_json: {},
    metadata: {},
    created_by: null,
    created_at: "2026-01-02T00:00:00.000Z",
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
    versions: [publishedVersion, draftVersion],
    publishedVersion,
    latestDraft: null,
    assets: [],
  }
}

let supportPageDetail: any = buildSupportDetail()

function buildSupportPublicPayload() {
  const publishedVersion = supportPageDetail.publishedVersion

  return {
    page: {
      id: supportPageDetail.page.id,
      page_key: supportPageDetail.page.page_key,
      title: supportPageDetail.page.title,
      updated_at: supportPageDetail.page.updated_at,
      published_version_id: supportPageDetail.page.published_version_id,
    },
    version: {
      id: publishedVersion.id,
      page_id: publishedVersion.page_id,
      version_number: publishedVersion.version_number,
      entries_json: publishedVersion.entries_json,
      style_json: publishedVersion.style_json,
      metadata: publishedVersion.metadata,
      created_at: publishedVersion.created_at,
    },
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

async function clickEditableField(_user: ReturnType<typeof userEvent.setup>, fieldKey: string) {
  const field = await waitFor(() => {
    const element = document.querySelector<HTMLElement>(`[data-visual-editor-field="${fieldKey}"]`)
    expect(element).not.toBeNull()
    return element as HTMLElement
  })

  fireEvent.click(field)
}

describe("Support", () => {
  beforeEach(() => {
    supportPageDetail = buildSupportDetail()
    mockSaveVisualEditorPageDraft.mockReset()
    mockPublishVisualEditorPageVersion.mockReset()
    mockRestoreVisualEditorPageVersion.mockReset()
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false })
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
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    mockSaveVisualEditorPageDraft.mockImplementation(async ({ document, styles, title }: any) => {
      const nextDocument = document ?? buildSupportDocument(title ?? "Como podemos ajudar?")
      const nextStyles = styles ?? { fields: {} }
      const saved: any = {
        page: {
          id: "support-page-1",
          page_key: "support",
          title: title ?? "Suporte",
          status: "published",
          published_version_id: "support-version-1",
          created_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-03T00:00:00.000Z",
        },
        version: {
          id: "support-version-3",
          page_id: "support-page-1",
          version_number: 3,
          status: "draft",
          entries_json: nextDocument,
          style_json: nextStyles,
          metadata: {},
          created_by: null,
          created_at: "2026-01-03T00:00:00.000Z",
        },
      }

      supportPageDetail = {
        ...supportPageDetail,
        versions: [saved.version, ...supportPageDetail.versions.filter((version: any) => version.id !== saved.version.id)],
        latestDraft: saved.version,
        page: {
          ...supportPageDetail.page,
          updated_at: saved.page.updated_at,
        },
      }

      return saved
    })

    mockPublishVisualEditorPageVersion.mockImplementation(async ({ versionId }: any) => {
      const publishedSource = supportPageDetail.versions.find((version: any) => version.id === versionId)
      const published: any = {
        page: {
          id: "support-page-1",
          page_key: "support",
          title: "Suporte",
          status: "published",
          published_version_id: versionId,
          created_by: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-03T00:00:00.000Z",
        },
        version: {
          ...(publishedSource ?? {
            id: versionId,
            page_id: "support-page-1",
            version_number: 3,
            status: "draft",
            entries_json: buildSupportDocument("Como podemos ajudar? | Teste Persistencia"),
            style_json: {},
            metadata: {},
            created_by: null,
            created_at: "2026-01-03T00:00:00.000Z",
          }),
          status: "published",
        },
      }

      supportPageDetail = {
        ...supportPageDetail,
        versions: [published.version, ...supportPageDetail.versions.filter((version: any) => version.id !== published.version.id)],
        latestDraft: null,
        publishedVersion: published.version,
        page: {
          ...supportPageDetail.page,
          published_version_id: versionId,
          updated_at: published.page.updated_at,
        },
      }

      return published
    })
  })

  it("renders the public support page without editor controls", async () => {
    renderSupport()

    expect(screen.getByRole("heading", { name: "Como podemos ajudar?" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Abrir um chamado" })[0]).toHaveAttribute(
      "href",
      "/aluno/suporte?openTicketModal=1&ticketStep=form",
    )
    expect(screen.getByText("Pergunta de teste")).toBeInTheDocument()
    expect(screen.queryByText("Guardar rascunho")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Abrir editor visual" })).not.toBeInTheDocument()
  })

  it("opens the sidebar when an admin clicks an editable element", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    expect(await screen.findByRole("button", { name: "Ativar edicao" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Ativar edicao" }))

    await clickEditableField(user, "hero.title")

    expect(await screen.findByText("Elemento selecionado")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Como podemos ajudar?")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Guardar rascunho/i })).toBeInTheDocument()

    await clickEditableField(user, "hero.primaryCta")
    expect(await screen.findByText("Botao principal")).toBeInTheDocument()
    expect(screen.getByLabelText("Rotulo")).toBeInTheDocument()
    expect(screen.getByLabelText("Destino")).toBeInTheDocument()

    await clickEditableField(user, "supportForm.formContainer")
    expect(await screen.findByText("Card do formulario")).toBeInTheDocument()

    await clickEditableField(user, "faqSection.container")
    expect(await screen.findByText("Bloco da FAQ")).toBeInTheDocument()
  })

  it("uses the published support version as the public editor baseline when a stale draft exists", async () => {
    const user = userEvent.setup()

    supportPageDetail = {
      ...buildSupportDetail(),
      latestDraft: {
        id: "support-version-draft",
        page_id: "support-page-1",
        version_number: 3,
        status: "draft",
        entries_json: buildSupportDocument("Como podemos ajudar? | Draft visivel so no admin"),
        style_json: {},
        metadata: {},
        created_by: null,
        created_at: "2026-01-03T00:00:00.000Z",
      },
    }

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    renderSupport()

    expect(await screen.findByRole("heading", { name: "Como podemos ajudar?" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Como podemos ajudar? | Draft visivel so no admin" }),
    ).not.toBeInTheDocument()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    expect(screen.getByRole("button", { name: "Como podemos ajudar?" })).toBeInTheDocument()
  })

  it("saves and reloads the support CTA container style", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    const initialRender = renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "supportCta.container")

    expect(await screen.findByText("Container / card")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Estilo" }))

    fireEvent.change(screen.getByLabelText("Cor de fundo"), { target: { value: "#0f172a" } })
    fireEvent.input(screen.getByLabelText("Border radius"), { target: { value: "28" } })

    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "support",
        styles: expect.objectContaining({
          fields: expect.objectContaining({
            "supportCta.container": expect.objectContaining({
              backgroundColor: "#0f172a",
              borderRadius: "28px",
            }),
          }),
        }),
      }),
    )
    expect(mockPublishVisualEditorPageVersion).toHaveBeenCalledWith({
      pageKey: "support",
      versionId: "support-version-3",
    })

    initialRender.unmount()
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false })
    mockFetchPublicVisualEditorPage.mockResolvedValueOnce(buildSupportPublicPayload())

    renderSupport()

    await waitFor(() => {
      const container = document.querySelector<HTMLElement>('[data-visual-editor-field="supportCta.container"]')
      expect(container).not.toBeNull()
      expect(container?.style.backgroundColor).toBe("rgb(15, 23, 42)")
      expect(container?.style.borderRadius).toBe("28px")
    })
    expect(screen.queryByRole("button", { name: "Abrir editor visual" })).not.toBeInTheDocument()
  })

  it("persists text decoration edits for support titles", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    const initialRender = renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "hero.title")
    await user.click(screen.getByRole("button", { name: "Estilo" }))

    fireEvent.change(screen.getByLabelText("Decoração"), { target: { value: "underline" } })

    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "support",
        styles: expect.objectContaining({
          fields: expect.objectContaining({
            "hero.title": expect.objectContaining({
              textDecoration: "underline",
            }),
          }),
        }),
      }),
    )

    initialRender.unmount()
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false })
    mockFetchPublicVisualEditorPage.mockResolvedValueOnce(buildSupportPublicPayload())

    renderSupport()

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Como podemos ajudar?" })).toHaveStyle({
        textDecoration: "underline",
      })
    })
  })

  it("restores the support CTA container fallback style", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "supportCta.container")
    await user.click(screen.getByRole("button", { name: "Estilo" }))

    fireEvent.change(screen.getByLabelText("Cor de fundo"), { target: { value: "#0f172a" } })
    await user.click(screen.getByRole("button", { name: "Resetar estilo" }))
    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "support",
      }),
    )
    const lastCall = mockSaveVisualEditorPageDraft.mock.calls[mockSaveVisualEditorPageDraft.mock.calls.length - 1]
    expect(lastCall?.[0].styles.fields["supportCta.container"]).toBeUndefined()
  })

  it("keeps image editing working with style controls", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    const initialRender = renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "hero.image")
    await user.click(screen.getByRole("button", { name: "Estilo" }))

    fireEvent.input(screen.getByLabelText("Border radius"), { target: { value: "32" } })
    fireEvent.input(screen.getByLabelText("Largura"), { target: { value: "360" } })
    fireEvent.input(screen.getByLabelText("Altura"), { target: { value: "420" } })
    await user.selectOptions(screen.getByLabelText("Object fit"), "contain")

    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "support",
        styles: expect.objectContaining({
          fields: expect.objectContaining({
            "hero.image": expect.objectContaining({
              borderRadius: "32px",
              width: "360px",
              height: "420px",
              objectFit: "contain",
            }),
          }),
        }),
      }),
    )

    initialRender.unmount()
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false })
    mockFetchPublicVisualEditorPage.mockResolvedValueOnce(buildSupportPublicPayload())

    renderSupport()

    await waitFor(() => {
      const imageWrapper = document.querySelector<HTMLElement>('[data-visual-editor-field="hero.image"]')
      expect(imageWrapper).not.toBeNull()
      expect(imageWrapper?.style.borderRadius).toBe("32px")
      expect(imageWrapper?.style.width).toBe("360px")
    })
    expect(screen.getByAltText("Ilustracao").style.objectFit).toBe("contain")
    expect(screen.getByAltText("Ilustracao").style.height).toBe("420px")
  })

  it("publishes the freshly saved support draft instead of a stale draft", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "hero.title")

    const titleInput = await screen.findByDisplayValue("Como podemos ajudar?")
    await user.clear(titleInput)
    await user.type(titleInput, "Como podemos ajudar? | Teste Persistencia")
    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "support",
        document: expect.objectContaining({
          hero: expect.objectContaining({
            title: "Como podemos ajudar? | Teste Persistencia",
          }),
        }),
      }),
    )
    expect(mockPublishVisualEditorPageVersion).toHaveBeenCalledWith({
      pageKey: "support",
      versionId: "support-version-3",
    })
    expect(await screen.findByText("Versao 3 publicada com sucesso.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Como podemos ajudar? | Teste Persistencia" })).toBeInTheDocument()
  })

  it("persists style-only edits when publishing the support page", async () => {
    const user = userEvent.setup()

    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false })
    mockFetchAdminVisualEditorPageDetail.mockImplementation(async () => supportPageDetail)

    const initialRender = renderSupport()

    await user.click(await screen.findByRole("button", { name: "Abrir editor visual" }))
    await user.click(await screen.findByRole("button", { name: "Ativar edicao" }))
    await clickEditableField(user, "hero.title")
    await user.click(screen.getByRole("button", { name: "Estilo" }))

    fireEvent.input(screen.getByLabelText("Cor do texto"), { target: { value: "#b91c1c" } })
    fireEvent.change(screen.getByLabelText("Tamanho da fonte"), { target: { value: "56" } })
    await user.selectOptions(screen.getByLabelText("Fonte"), '"Arvo", Georgia, serif')

    expect(screen.getByText("Alteracoes pendentes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Guardar rascunho/i })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Publicar" }))

    expect(mockSaveVisualEditorPageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "support",
        styles: expect.objectContaining({
          fields: expect.objectContaining({
            "hero.title": expect.objectContaining({
              color: "#b91c1c",
              fontSize: "56px",
              fontFamily: '"Arvo", Georgia, serif',
            }),
          }),
        }),
      }),
    )
    expect(mockPublishVisualEditorPageVersion).toHaveBeenCalledWith({
      pageKey: "support",
      versionId: "support-version-3",
    })
    expect(supportPageDetail.page.published_version_id).toBe("support-version-3")
    expect(supportPageDetail.publishedVersion.style_json.fields["hero.title"]).toMatchObject({
      color: "#b91c1c",
      fontSize: "56px",
      fontFamily: '"Arvo", Georgia, serif',
    })

    initialRender.unmount()
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false })
    mockFetchPublicVisualEditorPage.mockResolvedValueOnce(buildSupportPublicPayload())

    renderSupport()

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Como podemos ajudar?" })).toHaveStyle({
        color: "#b91c1c",
        fontSize: "56px",
      })
    })
    expect(screen.queryByRole("button", { name: "Abrir editor visual" })).not.toBeInTheDocument()
  })
})
