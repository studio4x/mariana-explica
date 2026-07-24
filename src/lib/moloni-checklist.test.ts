import { describe, expect, it } from "vitest"
import { detectMoloniChecklistValues } from "./moloni-checklist"

describe("detectMoloniChecklistValues", () => {
  it("derives only configuration that the platform can prove", () => {
    const values = detectMoloniChecklistValues({
      environment: "live",
      settings: [
        {
          payment_environment: "test",
          moloni_environment: "draft",
          document_status: 0,
        },
        {
          payment_environment: "live",
          document_kind: "invoice_receipt",
          document_status: 1,
        },
      ],
      products: [{ id: "product-1", status: "published" }],
      mappings: [
        {
          product_id: "product-1",
          payment_environment: "live",
          is_active: true,
          moloni_document_set_id: 90,
          moloni_document_set_name: "Série 2026",
        },
      ],
      validations: [
        { payment_environment: "live", validation_type: "mappings", status: "passed" },
        { payment_environment: "live", validation_type: "document_sets", status: "passed" },
        { payment_environment: "test", validation_type: "draft_document", status: "passed" },
      ],
    })

    expect(values.immediate_payment_document).toBe("Fatura-recibo")
    expect(values.production_document_set).toContain("Série 2026")
    expect(values.moloni_products).toContain("1 produto(s)")
    expect(values.homologation_strategy).toContain("homologação concluída")
    expect(values.customer_pdf_delivery).toContain("área do aluno")
    expect(values.portugal_vat).toBeUndefined()
  })

  it("does not claim mappings are ready without validation", () => {
    const values = detectMoloniChecklistValues({
      environment: "test",
      settings: [
        {
          payment_environment: "test",
          moloni_environment: "draft",
          document_kind: "invoice",
          document_status: 0,
        },
      ],
      products: [{ id: "product-1", status: "published" }],
      mappings: [],
      validations: [],
    })

    expect(values.immediate_payment_document).toBe("Fatura")
    expect(values.automatic_closing).toContain("rascunho")
    expect(values.moloni_products).toBeUndefined()
    expect(values.production_document_set).toBeUndefined()
    expect(values.homologation_strategy).toBeUndefined()
  })
})
