import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildMoloniDocumentPayload,
  centsToDecimal,
  FiscalProcessingError,
  resolveMoloniCountryId,
  selectMoloniFiscalRule,
} from "./moloni-processing.ts"

Deno.test("converts integer cents without floating point drift", () => {
  assertEquals(centsToDecimal(12345), 123.45)
})

Deno.test("resolves an international buyer country from the fiscal snapshot", async () => {
  const countryId = await resolveMoloniCountryId({
    getCountries: async () => [
      { country_id: 351, iso_3166_1: "PT" },
      { country_id: 34, iso_3166_1: "ES" },
    ],
  }, "ES", 351)

  assertEquals(countryId, 34)
})

Deno.test("blocks an international country absent from Moloni instead of assuming Portugal", async () => {
  const error = await assertRejects(
    () => resolveMoloniCountryId({ getCountries: async () => [{ country_id: 351, iso_3166_1: "PT" }] }, "FR", 351),
    FiscalProcessingError,
  )
  assertEquals(error.code, "COUNTRY_NOT_FOUND")
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

Deno.test("selects country and customer rules by specificity and priority", () => {
  const result = selectMoloniFiscalRule({
    productId: "product",
    companyId: 10,
    countryCode: "ES",
    customerType: "company",
    mapping: {
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
    },
    rules: [
      { id: "default", product_id: "product", moloni_company_id: 10, billing_country_code: null, customer_type: null, moloni_tax_id: 1, tax_value: 23, exemption_reason: null, priority: 1, is_default: true, is_active: true },
      { id: "country", product_id: "product", moloni_company_id: 10, billing_country_code: "ES", customer_type: null, moloni_tax_id: 2, tax_value: 21, exemption_reason: null, priority: 100, is_default: false, is_active: true },
      { id: "company", product_id: "product", moloni_company_id: 10, billing_country_code: "ES", customer_type: "company", moloni_tax_id: 3, tax_value: 0, exemption_reason: "M01", priority: 100, is_default: false, is_active: true },
    ],
  })
  assertEquals(result.ruleId, "company")
  assertEquals(result.mapping.tax_value, 0)
})

Deno.test("blocks an active rule set without a safe match", () => {
  assertRejects(() => Promise.resolve().then(() => selectMoloniFiscalRule({
    productId: "product",
    companyId: 10,
    countryCode: "FR",
    customerType: "individual",
    mapping: {
      product_id: "product", moloni_company_id: 10, moloni_product_id: 30, moloni_document_set_id: 40,
      moloni_tax_id: 50, tax_value: 23, exemption_reason: null, eac_id: null, moloni_payment_method_id: null, is_active: true,
    },
    rules: [{ id: "pt", product_id: "product", moloni_company_id: 10, billing_country_code: "PT", customer_type: null, moloni_tax_id: 1, tax_value: 23, exemption_reason: null, priority: 1, is_default: false, is_active: true }],
  })), FiscalProcessingError)
})
