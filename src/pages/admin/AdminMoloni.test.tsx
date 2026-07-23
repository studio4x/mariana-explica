import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminMoloni } from "./AdminMoloni"

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  saveCredentials: vi.fn(),
  activate: vi.fn(),
}))

vi.mock("@/services/admin.service", () => ({
  fetchAdminMoloniOverview: (...args: unknown[]) => mocks.overview(...args),
  saveAdminMoloniCredentials: (...args: unknown[]) => mocks.saveCredentials(...args),
  activateAdminMoloniLive: (...args: unknown[]) => mocks.activate(...args),
  createAdminMoloniDraftTest: vi.fn(),
  deactivateAdminMoloni: vi.fn(),
  disconnectAdminMoloni: vi.fn(),
  fetchAdminFiscalDocumentUrl: vi.fn(),
  fetchAdminMoloniCatalog: vi.fn(),
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
      <MemoryRouter initialEntries={["/admin/integracoes/moloni"]}>
        <AdminMoloni />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("AdminMoloni", () => {
  beforeEach(() => {
    mocks.overview.mockReset()
    mocks.saveCredentials.mockReset()
    mocks.activate.mockReset()
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
    expect(screen.getByText("Fila fiscal vazia")).toBeInTheDocument()
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
})
