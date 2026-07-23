import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { buildMoloniDocumentPayload, centsToDecimal } from "./moloni-processing.ts"

Deno.test("converts integer cents without floating point drift", () => {
  assertEquals(centsToDecimal(12345), 123.45)
})

Deno.test("builds a draft invoice receipt payload from immutable order totals", () => {
  const payload = buildMoloniDocumentPayload({
    document: {
      id: "fiscal",
      order_id: "order",
      user_id: "user",
      document_kind: "invoice_receipt",
      status: "pending",
      environment: "draft",
      source_payment_environment: "test",
      moloni_company_id: 10,
      currency: "EUR",
      net_amount_cents: 1000,
      tax_amount_cents: 230,
      total_amount_cents: 1230,
      your_reference: "mariana:order:sale:v1",
      payment_reference: "pi_test",
    },
    settings: {
      payment_environment: "test",
      moloni_environment: "draft",
      emission_enabled: true,
      fiscal_checklist_approved: true,
      document_kind: "invoice_receipt",
      document_status: 0,
      moloni_company_id: 10,
      customer_email_fallback_enabled: false,
      customer_without_vat_rule: null,
      customer_country_id: 1,
      customer_language_id: 1,
      customer_maturity_date_id: 1,
      customer_payment_method_id: 7,
    },
    customerId: 20,
    paidAt: "2026-07-23T10:00:00.000Z",
    items: [{
      product_id: "product",
      product_title_snapshot: "Curso",
      unit_price_cents: 1000,
      discount_cents: 0,
      final_price_cents: 1000,
    }],
    mappings: [{
      product_id: "product",
      moloni_company_id: 10,
      moloni_product_id: 30,
      moloni_document_set_id: 40,
      moloni_tax_id: 50,
      tax_value: 23,
      exemption_reason: null,
      eac_id: null,
      moloni_payment_method_id: 7,
      is_active: true,
    }],
  })
  assertEquals(payload.status, 0)
  assertEquals((payload.payments as Array<{ value: number }>)[0].value, 12.3)
})

Deno.test("blocks monetary divergence before reaching Moloni", () => {
  assertThrows(() =>
    buildMoloniDocumentPayload({
      document: {
        id: "fiscal",
        order_id: "order",
        user_id: "user",
        document_kind: "invoice",
        status: "pending",
        environment: "draft",
        source_payment_environment: "test",
        moloni_company_id: 10,
        currency: "EUR",
        net_amount_cents: 999,
        tax_amount_cents: 0,
        total_amount_cents: 999,
        your_reference: "reference",
        payment_reference: null,
      },
      settings: {
        payment_environment: "test",
        moloni_environment: "draft",
        emission_enabled: true,
        fiscal_checklist_approved: true,
        document_kind: "invoice",
        document_status: 0,
        moloni_company_id: 10,
        customer_email_fallback_enabled: false,
        customer_without_vat_rule: null,
        customer_country_id: 1,
        customer_language_id: 1,
        customer_maturity_date_id: 1,
        customer_payment_method_id: 1,
      },
      customerId: 20,
      paidAt: "2026-07-23T10:00:00Z",
      items: [{
        product_id: "product",
        product_title_snapshot: "Curso",
        unit_price_cents: 1000,
        discount_cents: 0,
        final_price_cents: 1000,
      }],
      mappings: [],
    })
  )
})
