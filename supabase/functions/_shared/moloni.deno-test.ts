import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  classifyMoloniFailure,
  findInvalidMoloniCustomerReferences,
  MoloniClient,
  MoloniError,
} from "./moloni.ts"

class CatalogMoloniClient extends MoloniClient {
  readonly calls: Array<{ endpoint: string; body: Record<string, unknown> }> = []

  override async post<T>(endpoint: string, body: Record<string, unknown>) {
    this.calls.push({ endpoint, body })
    if (endpoint === "countries/getAll") return [{ country_id: 351, iso_3166_1: "PT" }] as T
    if (endpoint === "languages/getAll") return [{ language_id: 1, code: "pt", title: "Português" }] as T
    return [{ maturity_date_id: 7, name: "Pronto pagamento", days: 0, associated_discount: 0 }] as T
  }
}

Deno.test("classifies temporary Moloni failures as retryable", () => {
  const rateLimited = classifyMoloniFailure(429, null, "customers/getByVat")
  const unavailable = classifyMoloniFailure(503, null, "documents/getOne")
  assertEquals(rateLimited instanceof MoloniError, true)
  assertEquals(rateLimited.retryable, true)
  assertEquals(unavailable.retryable, true)
})

Deno.test("classifies functional rejection as permanent", () => {
  const rejected = classifyMoloniFailure(
    400,
    { error_description: "document_set_id inválido" },
    "invoiceReceipts/insert",
  )
  assertEquals(rejected.retryable, false)
  assertEquals(rejected.code, "MOLONI_REJECTED")
})

Deno.test("loads countries and languages without a company and maturity dates with company_id", async () => {
  const client = new CatalogMoloniClient({} as never, "draft")
  assertEquals(await client.getCountries(), [{ country_id: 351, iso_3166_1: "PT" }])
  assertEquals(await client.getLanguages(), [{ language_id: 1, code: "pt", title: "Português" }])
  assertEquals(await client.getMaturityDates(42), [{
    maturity_date_id: 7,
    name: "Pronto pagamento",
    days: 0,
    associated_discount: 0,
  }])
  assertEquals(client.calls, [
    { endpoint: "countries/getAll", body: {} },
    { endpoint: "languages/getAll", body: {} },
    { endpoint: "maturityDates/getAll", body: { company_id: 42 } },
  ])
})

Deno.test("requires company_id before requesting maturity dates", async () => {
  const client = new CatalogMoloniClient({} as never, "draft")
  await assertRejects(() => Promise.resolve().then(() => client.getMaturityDates(0)), MoloniError)
})

Deno.test("rejects customer references that are not present in the remote catalog", async () => {
  const client = {
    getCountries: async () => [{ country_id: 351, iso_3166_1: "PT" }],
    getLanguages: async () => [{ language_id: 7, code: "pt", title: "Português" }],
    getMaturityDates: async () => [{ maturity_date_id: 9, name: "Pronto pagamento", days: 0 }],
  }
  const invalidCountry = await findInvalidMoloniCustomerReferences(client, {
    companyId: 42,
    countryId: 999,
    languageId: 7,
    maturityDateId: 9,
  })
  assertEquals(invalidCountry, "País Moloni selecionado não existe no catálogo atual.")
})
