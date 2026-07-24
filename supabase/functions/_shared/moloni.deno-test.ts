import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  classifyMoloniFailure,
  findInvalidMoloniCustomerReferences,
  MoloniClient,
  MoloniError,
  type MoloniProductCategory,
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

class ProductCatalogMoloniClient extends MoloniClient {
  readonly categoryCalls: Array<{ parentId: number; offset: number }> = []
  readonly productCalls: Array<{ categoryId: number; offset: number }> = []

  override async getProductCategories(_companyId: number, parentId = 0, offset = 0): Promise<MoloniProductCategory[]> {
    this.categoryCalls.push({ parentId, offset })
    if (parentId === 0) return [
      { category_id: 2, parent_id: 0, name: "Serviços" },
      { category_id: 1, parent_id: 0, name: "Cursos" },
    ]
    if (parentId === 1) return [{ category_id: 3, parent_id: 1, name: "Subcursos" }]
    if (parentId === 3) return [{ category_id: 1, parent_id: 3, name: "Ciclo" }]
    return []
  }

  override async getProductsByCategory(_companyId: number, categoryId: number, offset = 0) {
    this.productCalls.push({ categoryId, offset })
    if (categoryId === 1 && offset === 0) {
      return Array.from({ length: 50 }, (_, index) => ({
        product_id: 100 + index,
        type: 1,
        name: index === 0 ? "Zeta" : `Produto ${String(index).padStart(2, "0")}`,
        reference: `REF-${index}`,
        price: index,
        visibility_id: 1,
      }))
    }
    if (categoryId === 1 && offset === 50) {
      return [{ product_id: 1, type: 2, name: "Alpha", reference: "A-001", price: 10, visibility_id: 1 }]
    }
    if (categoryId === 2 && offset === 0) {
      return [
        { product_id: 1, type: 2, name: "Alpha", reference: "A-001", price: 10, visibility_id: 1 },
        { product_id: 999, type: 2, name: "Serviço invisível", reference: "INV-999", visibility_id: 0 },
      ]
    }
    return []
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

Deno.test("loads top-level and nested categories, paginates, deduplicates, preserves invisible products and sorts", async () => {
  const client = new ProductCatalogMoloniClient({} as never, "draft")
  const products = await client.getAllProducts(42)

  assertEquals(client.categoryCalls, [
    { parentId: 0, offset: 0 },
    { parentId: 2, offset: 0 },
    { parentId: 1, offset: 0 },
    { parentId: 3, offset: 0 },
  ])
  assertEquals(client.productCalls, [
    { categoryId: 2, offset: 0 },
    { categoryId: 1, offset: 0 },
    { categoryId: 1, offset: 50 },
    { categoryId: 3, offset: 0 },
  ])
  assertEquals(products.length, 52)
  assertEquals(products[0], {
    product_id: 1,
    category_id: 2,
    type: 2,
    name: "Alpha",
    reference: "A-001",
    price: 10,
    visibility_id: 1,
  })
  assertEquals(products.find((product) => product.product_id === 999), {
    product_id: 999,
    category_id: 2,
    type: 2,
    name: "Serviço invisível",
    reference: "INV-999",
    price: null,
    visibility_id: 0,
  })
  assertEquals(products.filter((product) => product.product_id === 1).length, 1)
  assertEquals(products.at(-1)?.name, "Zeta")
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
