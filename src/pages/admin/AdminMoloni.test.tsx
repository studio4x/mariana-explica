import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fiscalStatusLabel } from "@/lib/moloni-status"
import { AdminMoloni } from "./AdminMoloni"

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  saveCredentials: vi.fn(),
  activate: vi.fn(),
  catalog: vi.fn(),
  importChecklistAnswers: vi.fn(),
  status: vi.fn(),
  runValidation: vi.fn(),
  updateChecklist: vi.fn(),
  syncAutomaticChecklist: vi.fn(),
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
  fetchAdminMoloniStatus: (...args: unknown[]) => mocks.status(...args),
  importAdminMoloniChecklistAnswers: (...args: unknown[]) => mocks.importChecklistAnswers(...args),
  runAdminMoloniValidation: (...args: unknown[]) => mocks.runValidation(...args),
  runAdminMoloniJobAction: vi.fn(),
  startAdminMoloniConnection: vi.fn(),
  updateAdminMoloniChecklist: (...args: unknown[]) => mocks.updateChecklist(...args),
  syncAdminMoloniAutomaticChecklist: (...args: unknown[]) => mocks.syncAutomaticChecklist(...args),
  updateAdminMoloniSettings: vi.fn(),
  upsertAdminMoloniMapping: vi.fn(),
  upsertAdminMoloniRule: vi.fn(),
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

function renderPage(path = "/admin/integracoes/moloni/configuracao") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
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
    mocks.importChecklistAnswers.mockReset()
    mocks.status.mockReset()
    mocks.runValidation.mockReset()
    mocks.updateChecklist.mockReset()
    mocks.syncAutomaticChecklist.mockReset()
    mocks.status.mockResolvedValue({ rules: [] })
    mocks.importChecklistAnswers.mockResolvedValue({
      success: true,
      result: {
        imported_count: 9,
        imported_keys: [
          "buyer_without_vat",
          "individual_required_data",
          "company_required_data",
          "eac",
          "portugal_vat",
          "international_sales",
          "eu_b2b_b2c_oss",
          "exemptions",
          "tax_authority_communication",
        ],
      },
    })
    mocks.updateChecklist.mockResolvedValue({ success: true })
    mocks.syncAutomaticChecklist.mockResolvedValue({
      success: true,
      result: {
        approved_items: [],
        pending_items: [],
        updated_count: 0,
        total_automatic_items: 0,
        fiscal_checklist_approved: false,
      },
    })
  })

  it("translates every fiscal document status for the queue", () => {
    expect(fiscalStatusLabel("pending")).toBe("Pendente")
    expect(fiscalStatusLabel("processing")).toBe("Em processamento")
    expect(fiscalStatusLabel("blocked_data")).toBe("Dados pendentes")
    expect(fiscalStatusLabel("issued")).toBe("Emitido")
    expect(fiscalStatusLabel("failed_retryable")).toBe("Falha temporária")
    expect(fiscalStatusLabel("failed_permanent")).toBe("Falha permanente")
    expect(fiscalStatusLabel("credit_pending")).toBe("Nota de crédito pendente")
    expect(fiscalStatusLabel("credited")).toBe("Nota de crédito emitida")
    expect(fiscalStatusLabel("cancelled_before_issue")).toBe("Cancelado antes da emissão")
    expect(fiscalStatusLabel("requires_review")).toBe("Requer revisão")
    expect(fiscalStatusLabel("future_status")).toBe("Estado fiscal não reconhecido")
  })

  it("shows an initial loading skeleton", () => {
    mocks.overview.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByLabelText("A carregar configuração Moloni")).toBeInTheDocument()
  })

  it("shows validation notifications when requested", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.validations = [{
      id: "validation-1",
      payment_environment: "test",
      validation_type: "document_sets",
      status: "failed",
      summary: "A série configurada não foi confirmada na Moloni.",
      details: {},
      created_at: "2026-07-24T10:00:00.000Z",
    }] as unknown as typeof overview.validations
    mocks.overview.mockResolvedValue(overview)
    renderPage()

    expect(await screen.findByRole("heading", { name: "Integração Moloni" })).toBeInTheDocument()
    expect(screen.queryByText("A série configurada não foi confirmada na Moloni.")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Mostrar notificações/i }))

    expect(screen.getByText("A série configurada não foi confirmada na Moloni.")).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === "P" && Boolean(element.textContent?.startsWith("Séries")))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ocultar notificações/i })).toHaveAttribute("aria-expanded", "true")
  })

  it("shows the validation progress and result in the diagnostic card", async () => {
    const user = userEvent.setup()
    mocks.overview.mockResolvedValue(buildOverview(false))
    mocks.runValidation.mockResolvedValue({
      success: true,
      validation: {
        id: "validation-2",
        payment_environment: "test",
        validation_type: "credentials",
        status: "passed",
        summary: "Credenciais cifradas e callback validados.",
        details: {},
        created_at: "2026-07-27T15:00:00.000Z",
      },
    })
    renderPage()

    const validationButton = await screen.findByRole("button", { name: "Validar Credenciais" })
    await user.click(validationButton)

    expect(await screen.findByRole("status")).toHaveTextContent("Validação concluída: Credenciais")
    expect(screen.getByRole("status")).toHaveTextContent("Credenciais cifradas e callback validados.")
    expect(mocks.runValidation).toHaveBeenCalledWith(
      { paymentEnvironment: "test", validationType: "credentials" },
      expect.anything(),
    )
    expect(screen.getByRole("button", { name: /Ocultar notificações/i })).toHaveAttribute("aria-expanded", "true")
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

  it("validates server-side requirements that still block live activation", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.activation_gate.missing = ["Impostos validados", "Método de pagamento validado"]
    overview.activation_gate.companyValidated = true
    overview.activation_gate.documentSetsValidated = true
    overview.activation_gate.productsValidated = true
    overview.activation_gate.taxesValidated = false
    overview.activation_gate.paymentMethodValidated = false
    overview.activation_gate.mappingsValidated = true
    overview.activation_gate.approvedChecklistItems = overview.activation_gate.requiredChecklistItems
    overview.activation_gate.draftTestPassed = true
    mocks.overview.mockResolvedValue(overview)
    mocks.runValidation.mockImplementation(async ({ validationType }: { validationType: string }) => ({
      success: true,
      validation: {
        id: `validation-${validationType}`,
        payment_environment: "live",
        validation_type: validationType,
        status: "passed",
        summary: `${validationType} validado`,
        details: { company_id: 42 },
        created_at: "2026-08-25T12:00:00.000Z",
      },
    }))
    renderPage()

    expect(await screen.findByText("Para habilitar a ativação, conclua os requisitos pendentes:")).toBeInTheDocument()
    const validateButton = screen.getByRole("button", { name: "Validar requisitos pendentes" })
    await user.click(validateButton)

    await waitFor(() => expect(mocks.runValidation).toHaveBeenCalledTimes(2))
    expect(mocks.runValidation).toHaveBeenNthCalledWith(1, {
      paymentEnvironment: "live",
      validationType: "taxes",
    })
    expect(mocks.runValidation).toHaveBeenNthCalledWith(2, {
      paymentEnvironment: "live",
      validationType: "payment_method",
    })
    expect(await screen.findByText("2 requisito(s) live validado(s). O estado da ativação foi atualizado.")).toBeInTheDocument()
  })

  it("shows a recoverable error state", async () => {
    mocks.overview.mockRejectedValue(new Error("Falha simulada"))
    renderPage()

    expect(await screen.findByText("Não foi possível carregar a Moloni")).toBeInTheDocument()
    expect(screen.getByText("Falha simulada")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument()
  })

  it("replaces generic checklist fields with detected values and guided choices", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.checklist = [
      {
        id: "automatic-1",
        payment_environment: "test",
        item_key: "immediate_payment_document",
        title: "Documento para pagamento imediato",
        description: "Descrição antiga",
        is_blocking: true,
        status: "pending",
        configuration: null,
        notes: null,
        approved_by: null,
        approved_at: null,
        is_automatic: true,
        evidence_snapshot: null,
        evidence_hash: null,
        current_evidence_snapshot: null,
        current_evidence_hash: null,
        evidence_checked_at: null,
        stale_reason: null,
        invalidated_at: null,
        invalidated_by: null,
        updated_at: "2026-07-24T10:00:00.000Z",
      },
      {
        id: "accountant-1",
        payment_environment: "test",
        item_key: "international_sales",
        title: "Vendas internacionais",
        description: "Descrição antiga",
        is_blocking: true,
        status: "pending",
        configuration: null,
        notes: null,
        approved_by: null,
        approved_at: null,
        updated_at: "2026-07-24T10:00:00.000Z",
      },
    ] as unknown as typeof overview.checklist
    mocks.overview.mockResolvedValue(overview)
    renderPage("/admin/integracoes/moloni/checklist-fiscal")

    expect(await screen.findByText("Preenchimento assistido")).toBeInTheDocument()
    expect(screen.getByText("Pré-visualização:")).toBeInTheDocument()
    expect(screen.getByText("Fatura-recibo")).toBeInTheDocument()
    expect(screen.getByText("A aprovação final é feita pelo backend.")).toBeInTheDocument()
    expect(screen.getAllByText(/Como resolver:/i)).toHaveLength(2)
    expect(screen.getByText(/Escolha a decisão confirmada com a contabilista/i)).toBeInTheDocument()
    expect(screen.getByText(/Abra Configuração fiscal, defina o documento de pagamento imediato/i)).toBeInTheDocument()
    expect(screen.getByLabelText("Decisão: Vendas internacionais")).toBeInTheDocument()
    expect(screen.queryByText("Valor ou configuração aprovada")).not.toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText("Decisão: Vendas internacionais"),
      "Aplicar somente regras por país previamente configuradas",
    )
    expect(screen.getByRole("button", { name: "Guardar decisão" })).toBeEnabled()
  })

  it("uses one server-side action for automatic checklist verification", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.checklist = [{
      id: "automatic-1",
      payment_environment: "test",
      item_key: "immediate_payment_document",
      title: "Documento para pagamento imediato",
      description: "Definir fatura-recibo ou fatura seguida de recibo.",
      is_blocking: true,
      is_automatic: true,
      status: "pending",
      configuration: null,
      notes: null,
      approved_by: null,
      approved_at: null,
      evidence_snapshot: null,
      evidence_hash: null,
      current_evidence_snapshot: null,
      current_evidence_hash: null,
      evidence_checked_at: null,
      stale_reason: "Configuração alterada.",
      invalidated_at: "2026-07-24T10:00:00.000Z",
      invalidated_by: null,
      updated_at: "2026-07-24T10:00:00.000Z",
    }] as unknown as typeof overview.checklist
    mocks.overview.mockResolvedValue(overview)
    mocks.syncAutomaticChecklist.mockResolvedValue({
      success: true,
      result: {
        approved_items: [{ item_key: "immediate_payment_document", label: "Fatura-recibo" }],
        pending_items: [],
        updated_count: 1,
        total_automatic_items: 1,
        fiscal_checklist_approved: false,
      },
    })
    renderPage("/admin/integracoes/moloni/checklist-fiscal")

    await user.click(await screen.findByRole("button", { name: "Verificar automaticamente" }))

    await waitFor(() => expect(mocks.syncAutomaticChecklist).toHaveBeenCalledWith("test"))
    expect(mocks.syncAutomaticChecklist).toHaveBeenCalledTimes(1)
    expect(mocks.updateChecklist).not.toHaveBeenCalled()
    expect(await screen.findByText("Resultado da verificação server-side")).toBeInTheDocument()
    expect(screen.getByText("Confirmados:")).toBeInTheDocument()
    expect(screen.queryByText(/No ambiente Stripe teste, conclua um teste documental em rascunho sem bloqueios/i)).not.toBeInTheDocument()
  })

  it("imports accountant answers from sandbox into live", async () => {
    const user = userEvent.setup()
    const overview = buildOverview(false)
    overview.checklist = [
      {
        id: "accountant-test-1",
        payment_environment: "test",
        item_key: "buyer_without_vat",
        title: "Comprador sem NIF",
        description: "Regra para comprador sem NIF.",
        is_blocking: true,
        status: "approved",
        configuration: { value: "Usar o cliente genérico aprovado na configuração" },
        notes: "Resposta confirmada no sandbox.",
        approved_by: "admin-test",
        approved_at: "2026-07-26T14:35:36.362Z",
        is_automatic: false,
        updated_at: "2026-07-26T14:35:36.362Z",
      },
      {
        id: "accountant-live-1",
        payment_environment: "live",
        item_key: "buyer_without_vat",
        title: "Comprador sem NIF",
        description: "Regra para comprador sem NIF.",
        is_blocking: true,
        status: "pending",
        configuration: null,
        notes: null,
        approved_by: null,
        approved_at: null,
        is_automatic: false,
        updated_at: "2026-07-28T20:00:00.000Z",
      },
    ] as unknown as typeof overview.checklist
    mocks.overview.mockResolvedValue(overview)
    renderPage("/admin/integracoes/moloni/checklist-fiscal")

    await screen.findByRole("heading", { name: "Integração Moloni" })
    await user.click(screen.getByRole("tab", { name: "Stripe live" }))

    expect(await screen.findByText("1 resposta(s) já preenchida(s) no sandbox podem ser copiadas para produção.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Importar respostas do sandbox" }))

    await waitFor(() => expect(mocks.importChecklistAnswers).toHaveBeenCalled())
    expect(mocks.importChecklistAnswers.mock.calls[0]?.[0]).toEqual({
      sourcePaymentEnvironment: "test",
      targetPaymentEnvironment: "live",
      group: "accountant",
    })
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

    expect(await screen.findByText("A empresa nao possui metodos de pagamento disponiveis.")).toBeInTheDocument()
    expect(await screen.findByText("Não foram encontrados artigos na Moloni. Crie os artigos ou serviços diretamente na sua conta Moloni e carregue o catálogo novamente.")).toBeInTheDocument()
    expect(screen.getByText(/Diagnostico do catalogo rascunho:/i)).toBeInTheDocument()
    expect(screen.getByText(/a Moloni nao devolveu prazos de pagamento, metodos de pagamento e artigos\/servicos para a empresa selecionada\./i)).toBeInTheDocument()
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
