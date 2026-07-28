import { describe, expect, it } from "vitest"
import { detectMoloniChecklistValues, MOLONI_CHECKLIST_GUIDES } from "./moloni-checklist"

describe("Moloni checklist text", () => {
  it("keeps all UI labels free of UTF-8 replacement characters", () => {
    const text = Object.values(MOLONI_CHECKLIST_GUIDES)
      .flatMap((guide) => [guide.question, guide.help, ...(guide.options ?? []), guide.placeholder ?? ""])
      .join(" ")

    expect(text).not.toContain("ï¿½")
  })
})

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
      products: [{ id: "product-1", status: "published", price_cents: 1500 }],
      mappings: [
        {
          product_id: "product-1",
          payment_environment: "live",
          is_active: true,
          moloni_document_set_id: 90,
          moloni_document_set_name: "SÃ©rie 2026",
        },
      ],
      validations: [
        { payment_environment: "live", validation_type: "mappings", status: "passed" },
        { payment_environment: "live", validation_type: "document_sets", status: "passed" },
        { payment_environment: "test", validation_type: "draft_document", status: "passed" },
      ],
    })

    expect(values.immediate_payment_document).toBe("Fatura-recibo")
    expect(values.production_document_set).toContain("SÃ©rie 2026")
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
      products: [{ id: "product-1", status: "published", price_cents: 1500 }],
      mappings: [],
      validations: [],
    })

    expect(values.immediate_payment_document).toBe("Fatura")
    expect(values.automatic_closing).toContain("rascunho")
    expect(values.moloni_products).toBeUndefined()
    expect(values.production_document_set).toBeUndefined()
    expect(values.homologation_strategy).toBeUndefined()
  })

  it("ignores free or archived products when checking paid-product coverage", () => {
    const values = detectMoloniChecklistValues({
      environment: "live",
      settings: [
        {
          payment_environment: "live",
          document_kind: "invoice_receipt",
          document_status: 1,
        },
      ],
      products: [
        { id: "paid-product", status: "published", price_cents: 2900 },
        { id: "free-product", status: "published", price_cents: 0 },
        { id: "archived-free", status: "archived", price_cents: 0 },
      ],
      mappings: [
        {
          product_id: "paid-product",
          payment_environment: "live",
          is_active: true,
          moloni_document_set_id: 90,
          moloni_document_set_name: "SÃ©rie 2026",
        },
      ],
      validations: [
        { payment_environment: "live", validation_type: "mappings", status: "passed" },
        { payment_environment: "live", validation_type: "document_sets", status: "passed" },
      ],
    })

    expect(values.moloni_products).toContain("1 produto(s) pago(s) publicado(s)")
    expect(values.production_document_set).toContain("SÃ©rie 2026")
  })
})
