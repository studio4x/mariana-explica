import { describe, expect, it } from "vitest"
import { buildFreeProductLeadsCsv, getFreeProductLeadStatusLabel } from "./free-product-leads"
import type { AdminFreeProductLead } from "@/types/app.types"

const lead: AdminFreeProductLead = {
  id: "lead-1",
  product_id: "product-1",
  name: "Mariana, Explica",
  email: "mariana@example.com",
  delivery_status: "sent",
  request_count: 2,
  source: "public_product_page",
  first_requested_at: "2026-08-12T10:00:00.000Z",
  last_requested_at: "2026-08-13T10:00:00.000Z",
  created_at: "2026-08-12T10:00:00.000Z",
  updated_at: "2026-08-13T10:00:00.000Z",
  product: { id: "product-1", title: "Sebenta de Gramática", slug: "sebenta", product_type: "free" },
}

describe("free product leads CSV", () => {
  it("exports only the operational lead fields", () => {
    const csv = buildFreeProductLeadsCsv([lead])

    expect(csv).toContain('"Mariana, Explica"')
    expect(csv).toContain('"Sebenta de Gramática"')
    expect(csv).toContain('"Enviado"')
    expect(csv).not.toContain("metadata")
  })

  it("neutralizes spreadsheet formulas", () => {
    const csv = buildFreeProductLeadsCsv([{ ...lead, name: "=IMPORTXML(A1)" }])
    expect(csv).toContain('"\'=IMPORTXML(A1)"')
  })

  it("maps delivery statuses", () => {
    expect(getFreeProductLeadStatusLabel("queued")).toBe("Na fila")
    expect(getFreeProductLeadStatusLabel("failed")).toBe("Falhou")
  })
})
