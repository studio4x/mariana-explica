import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminFreeProductLeads } from "./AdminFreeProductLeads"

const mockUseAdminFreeProductLeads = vi.fn()
const mockUseAdminProducts = vi.fn()

vi.mock("@/hooks/useAdmin", () => ({
  useAdminFreeProductLeads: (input: unknown) => mockUseAdminFreeProductLeads(input),
  useAdminProducts: () => mockUseAdminProducts(),
}))

vi.mock("@/services", () => ({
  exportAdminFreeProductLeads: vi.fn(),
}))

describe("AdminFreeProductLeads", () => {
  beforeEach(() => {
    mockUseAdminProducts.mockReturnValue({
      data: [{ id: "product-1", title: "Sebenta de Gramática", product_type: "free" }],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseAdminFreeProductLeads.mockReturnValue({
      data: {
        rows: [{
          id: "lead-1",
          product_id: "product-1",
          name: "Ana Silva",
          email: "ana@example.com",
          delivery_status: "sent",
          request_count: 2,
          source: "public_product_page",
          first_requested_at: "2026-08-12T10:00:00.000Z",
          last_requested_at: "2026-08-13T10:00:00.000Z",
          created_at: "2026-08-12T10:00:00.000Z",
          updated_at: "2026-08-13T10:00:00.000Z",
          product: { id: "product-1", title: "Sebenta de Gramática", slug: "sebenta", product_type: "free" },
        }],
        count: 1,
        metrics: { total: 1, sent: 1, queued: 0, failed: 0 },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it("shows captured contacts and delivery status", () => {
    render(<AdminFreeProductLeads />)

    expect(screen.getByRole("heading", { name: "Leads de materiais gratuitos" })).toBeInTheDocument()
    expect(screen.getByText("Ana Silva")).toBeInTheDocument()
    expect(screen.getByText("ana@example.com")).toBeInTheDocument()
    expect(screen.getAllByText("Sebenta de Gramática").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Enviado").length).toBeGreaterThan(0)
    expect(screen.getByText("Página pública")).toBeInTheDocument()
  })

  it("provides operational filters and CSV export", () => {
    render(<AdminFreeProductLeads />)

    expect(screen.getByPlaceholderText("Nome ou e-mail...")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Material" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Entrega" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeEnabled()
  })
})
