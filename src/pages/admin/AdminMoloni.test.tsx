import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminMoloni } from "./AdminMoloni"

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  saveCredentials: vi.fn(),
  activate: vi.fn(),
  catalog: vi.fn(),
}))

vi.mock("@/services/admin.service", () => ({
  fetchAdminMoloniOverview: (...args: unknown[]) => mocks.overview(...args),
  saveAdminMoloniCredentials: (...args: unknown[]) => mocks.saveCredentials(...args),
  activateAdminMoloniLive: (...args: unknown[]) => mocks.activate(...args),
  createAdminMoloniDraftTest: vi.fn(),
  deactivateAdminMoloni: vi.fn(),
  disconnectAdminMoloni: vi.fn(),
  fetchAdminFiscalDocumentUrl: vi.fn(),
  fetchAdminMoloniCatalog: (...args: unknown[]) => mocks.catalog(...args),
  runAdminMoloniJobAction: vi.fn(),
  runAdminMoloniValidation: vi.fn(),
  startAdminMoloniConnection: vi.fn(),
  updateAdminMoloniChecklist: vi.fn(),
  updateAdminMoloniSettings: vi.fn(),
  upsertAdminMoloniMapping: vi.fn(),
}))

function buildOverview(ready = false) {
  return {
    success: true,
    credentials: {
      configured: true,
      client_id_configured: true,
      client_secret_configured: true,
      encryption_key_configured: true,
      source: "database",
      callback_uri: "https://gookhgufsxeplelpdaua.supabase.co/functions/v1/moloni-oauth-callback",
      configured_at: "2026-07-23T10:00:00.000Z",
    },
    settings: [
      {
        payment_environment: "test",
        moloni_environment: "draft",
        emission_enabled: false,
        fiscal_checklist_approved: false,
        document_kind: "invoice_receipt",
        refund_document_kind: null,
        document_status: 0,
        moloni_company_id: null,
        customer_email_fallback_enabled: false,
        customer_without_vat_rule: null,
        customer_country_id: null,
        customer_language_id: null,
        customer_maturity_date_id: null,
        customer_payment_method_id: null,
        activated_at: null,
        deactivated_at: null,
      },
      {
        payment_environment: "live",
        moloni_environment: "live",
        emission_enabled: false,
        fiscal_checklist_approved: ready,
        document_kind: "invoice_receipt",
        refund_document_kind: null,
        document_status: 1,
        moloni_company_id: 42,
        customer_email_fallback_enabled: false,
        customer_without_vat_rule: null,
        customer_country_id: 1,
        customer_language_id: 1,
        customer_maturity_date_id: 1,
        customer_payment_method_id: 1,
        activated_at: null,
        deactivated_at: null,
      },
    ],
    connections: [
      {
        environment: "draft",
        status: "connected",
        moloni_company_id: 42,
        company_name: "Mariana Explica Teste",
        token_expires_at: "2026-08-23T10:00:00.000Z",
        refresh_token_expires_at: null,
        last_success_at: "2026-07-23T10:00:00.000Z",
        last_error_code: null,
        last_error_message: null,
      },
      {
        environment: "live",
        status: "connected",
        moloni_company_id: 42,
        company_name: "Mariana Explica",
        token_expires_at: "2026-08-23T10:00:00.000Z",
        refresh_token_expires_at: null,
        last_success_at: "2026-07-23T10:00:00.000Z",
        last_error_code: null,
        last_error_message: null,
      },
    ],
    checklist: [],
    validations: [],
    activation_events: [],
    mappings: [],
    products: [],
    queue: [],
    adjustments: [],
    metrics: {
      pending: 0,
      blocked: 0,
      permanent_failures: 0,
      issued: 0,
      paid_without_document: 0,
      adjustments_requiring_review: 0,
    },
    activation_gate: {
      ready,
      missing: ready ? [] : ["Checklist fiscal integralmente aprovado"],
      credentialsConfigured: true,
      encryptionKeyConfigured: true,
      oauthConnected: true,
      tokenUsable: true,
      companyConfigured: true,
      companyValidated: ready,
      documentSetsValidated: ready,
      productsValidated: ready,
      taxesValidated: ready,
      paymentMethodValidated: ready,
      mappingsValidated: ready,
      missingPaidProductMappings: 0,
      approvedChecklistItems: ready ? 18 : 0,
      requiredChecklistItems: 18,
      draftTestPassed: ready,
      monetaryDivergences: 0,
      moloniEnvironment: "live",
      documentStatus: 1,
    },
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/integracoes/moloni/configuracao"]}>
          <Routes>
            <Route path="/admin/integracoes/moloni/:tab" element={<AdminMoloni />} />
          </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("AdminMoloni", () => {
  beforeEach(() => {
    mocks.overview.mockReset()
    mocks.saveCredentials.mockReset()
    mocks.activate.mockReset()
    mocks.catalog.mockReset()
  })

  it("shows an initial loading skeleton", () => {
    mocks.overview.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByLabelText("A carregar configuração Moloni")).toBeInTheDocument()
  })

  it("never exposes stored credentials and blocks incomplete production activation", async () => {
    mocks.overview.mockResolvedValue(buildOverview(false))
    renderPage()

    expect(await screen.findByRole("heading", { name: "Integração Moloni" })).toBeInTheDocument()
    const secret = screen.getByLabelText("Client secret")
    expect(secret).toHaveAttribute("type", "password")
    expect(secret).toHaveValue("")
    expect(screen.getByText("https://gookhgufsxeplelpdaua.supabase.co/functions/v1/moloni-oauth-callback")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Testar conexão" })).toBeInTheDocument()
    expect(screen.getByText("Checklist fiscal integralmente aprovado")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ativar Moloni live/i })).toBeDisabled()
  })

  it("requires the exact confirmation before calling live activation", async () => {
    const user = userEvent.setup()
    mocks.overview.mockResolvedValue(buildOverview(true))
    mocks.activate.mockResolvedValue({ success: true, historical_reprocessing_started: false })
    renderPage()

    const confirmation = await screen.findByLabelText("Confirmação de ativação")
    const activateButton = screen.getByRole("button", { name: /Ativar Moloni live/i })
    await user.type(confirmation, "ativar moloni")
    expect(activateButton).toBeDisabled()
    expect(mocks.activate).not.toHaveBeenCalled()

    await user.clear(confirmation)
    await user.type(confirmation, "ATIVAR MOLONI")
    expect(activateButton).toBeEnabled()
    await user.click(activateButton)

    await waitFor(() => expect(mocks.activate.mock.calls[0]?.[0]).toBe("ATIVAR MOLONI"))
  })

  it("shows a recoverable error state", async () => {
    mocks.overview.mockRejectedValue(new Error("Falha simulada"))
    renderPage()

    expect(await screen.findByText("Não foi possível carregar a Moloni")).toBeInTheDocument()
    expect(screen.getByText("Falha simulada")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument()
  })

  it("renders readable catalog selectors and suggests Portugal, Portuguese and immediate payment", async () => {
    const user = userEvent.setup()
    mocks.overview.mockResolvedValue(buildOverview(false))
    mocks.catalog.mockResolvedValue({
      success: true,
      companies: [{ company_id: 42, name: "Mariana Explica" }],
      countries: [{ country_id: 351, iso_3166_1: "PT", name: "Portugal" }],
      languages: [{ language_id: 7, code: "pt", title: "Português" }],
      maturity_dates: [{ maturity_date_id: 9, name: "Pronto pagamento", days: 0, associated_discount: 0 }],
      products: [],
      document_sets: [],
      taxes: [],
      payment_methods: [],
    })
    renderPage()

    await screen.findByRole("heading", { name: "Integração Moloni" })
    await user.click(screen.getByRole("button", { name: "Carregar catálogo" }))

    expect(await screen.findByRole("option", { name: "Portugal — PT" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Português" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Pronto pagamento — 0 dias" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "País Moloni" })).toHaveValue("351")
    expect(screen.getByRole("combobox", { name: "Idioma Moloni" })).toHaveValue("7")
    expect(screen.getByRole("combobox", { name: "Vencimento Moloni" })).toHaveValue("9")
  })

  it("preserves saved selector values after the catalog is loaded", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.settings[0].customer_country_id = 351
    overview.settings[0].customer_language_id = 7
    overview.settings[0].customer_maturity_date_id = 9
    mocks.overview.mockResolvedValue(overview)
    mocks.catalog.mockResolvedValue({
      success: true,
      companies: [{ company_id: 42, name: "Mariana Explica" }],
      countries: [{ country_id: 351, iso_3166_1: "PT", name: "Portugal" }],
      languages: [{ language_id: 7, code: "pt", title: "Português" }],
      maturity_dates: [{ maturity_date_id: 9, name: "Pronto pagamento", days: 0 }],
      products: [],
      document_sets: [],
      taxes: [],
      payment_methods: [],
    })
    renderPage()

    await screen.findByRole("heading", { name: "Integração Moloni" })
    await user.click(screen.getByRole("button", { name: "Carregar catálogo" }))

    expect(await screen.findByRole("combobox", { name: "País Moloni" })).toHaveValue("351")
    expect(screen.getByRole("combobox", { name: "Idioma Moloni" })).toHaveValue("7")
    expect(screen.getByRole("combobox", { name: "Vencimento Moloni" })).toHaveValue("9")
  })

  it("shows the explicit empty catalog state and retries without offering article creation", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.settings[0].moloni_company_id = 42
    mocks.overview.mockResolvedValue(overview)
    mocks.catalog.mockResolvedValue({
      success: true,
      companies: [{ company_id: 42, name: "Mariana Explica" }],
      countries: [],
      languages: [],
      maturity_dates: [],
      products: [],
      document_sets: [],
      taxes: [],
      payment_methods: [],
    })
    renderPage()

    await screen.findByRole("heading", { name: "Integração Moloni" })
    await user.click(screen.getByRole("button", { name: "Carregar catálogo" }))

    expect(await screen.findByText("Não foram encontrados artigos na Moloni. Crie os artigos ou serviços diretamente na sua conta Moloni e carregue o catálogo novamente.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Carregar novamente" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Abrir Moloni" })).toHaveAttribute("href", "https://www.moloni.pt/")
    expect(screen.queryByRole("button", { name: /Criar artigo/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Carregar novamente" }))
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledTimes(2))
  })

  it("searches large catalogs and renders name, reference and Moloni type", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.settings[0].moloni_company_id = 42
    mocks.overview.mockResolvedValue(overview)
    mocks.catalog.mockResolvedValue({
      success: true,
      companies: [{ company_id: 42, name: "Mariana Explica" }],
      countries: [],
      languages: [],
      maturity_dates: [],
      products: Array.from({ length: 26 }, (_, index) => ({
        product_id: 1000 + index,
        category_id: 10,
        type: index === 25 ? 2 : 1,
        name: `Artigo ${index}`,
        reference: `REF-${index}`,
        price: null,
        visibility_id: index === 25 ? 0 : 1,
      })),
      document_sets: [],
      taxes: [],
      payment_methods: [],
    })
    renderPage()

    await screen.findByRole("heading", { name: "Integração Moloni" })
    await user.click(screen.getByRole("button", { name: "Carregar catálogo" }))
    const search = await screen.findByRole("textbox", { name: "Pesquisar artigos Moloni" })
    await user.type(search, "REF-25")

    expect(screen.getByRole("option", { name: "Artigo 25 — REF-25 — Serviço" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Artigo 1 — REF-1 — Produto" })).not.toBeInTheDocument()
  })

  it("hydrates an existing product mapping when the Mariana product is selected", async () => {
    const user = userEvent.setup()
    const overview = {
      ...buildOverview(false),
      products: [{ id: "mariana-course", title: "Curso de Filosofia", status: "published", product_type: "paid" }],
      mappings: [{
        id: "mapping-1",
        product_id: "mariana-course",
        payment_environment: "test",
        moloni_company_id: 42,
        moloni_product_id: 901,
        moloni_document_set_id: 77,
        moloni_tax_id: 6,
        tax_value: 23,
        exemption_reason: null,
        eac_id: null,
        moloni_payment_method_id: null,
        moloni_product_name: "Curso de Filosofia",
        moloni_document_set_name: "Série Teste",
        moloni_tax_name: "IVA 23%",
        moloni_payment_method_name: null,
        is_active: true,
      }],
    }
    overview.settings[0].moloni_company_id = 42
    mocks.overview.mockResolvedValue(overview)
    mocks.catalog.mockResolvedValue({
      success: true,
      companies: [{ company_id: 42, name: "Mariana Explica" }],
      countries: [],
      languages: [],
      maturity_dates: [],
      products: [{ product_id: 901, category_id: 10, type: 2, name: "Curso de Filosofia", reference: "CURSO-01", price: 20, visibility_id: 1 }],
      document_sets: [{ document_set_id: 77, name: "Série Teste" }],
      taxes: [{ tax_id: 6, name: "IVA 23%", value: 23 }],
      payment_methods: [],
    })
    renderPage()

    await screen.findByRole("heading", { name: "Integração Moloni" })
    await user.click(screen.getByRole("button", { name: "Carregar catálogo" }))
    await user.selectOptions(await screen.findByRole("combobox", { name: "Produto" }), "mariana-course")

    expect(screen.getByRole("combobox", { name: "Artigo Moloni" })).toHaveValue("901")
    expect(screen.getByRole("option", { name: "Curso de Filosofia — CURSO-01 — Serviço" })).toBeInTheDocument()
  })
})
