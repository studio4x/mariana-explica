import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildFiscalIdempotencyKey,
  isValidPortugueseNif,
  normalizeIso2,
  normalizeVatNumber,
} from "./fiscal.ts"

Deno.test("validates Portuguese NIF checksum", () => {
  assertEquals(isValidPortugueseNif("501 442 600"), true)
  assertEquals(isValidPortugueseNif("501442601"), false)
  assertEquals(isValidPortugueseNif("111111111"), false)
})

Deno.test("normalizes fiscal identifiers without logging or preserving punctuation", () => {
  assertEquals(normalizeVatNumber(" PT 501.442.600 "), "PT501442600")
  assertEquals(normalizeIso2("pt"), "PT")
  assertEquals(normalizeIso2("Portugal"), null)
})

Deno.test("builds deterministic fiscal idempotency keys", () => {
  assertEquals(
    buildFiscalIdempotencyKey({
      environment: "draft",
      orderId: "order-id",
      documentKind: "invoice_receipt",
    }),
    "moloni:draft:order-id:invoice_receipt:v1",
  )
})
