import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { classifyMoloniFailure, MoloniError } from "./moloni.ts"

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
