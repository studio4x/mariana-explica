import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  getMissingMoloniActivationRequirements,
  isDraftHomologationConfirmation,
  isStrongMoloniActivationConfirmation,
  minimalBuyerLabel,
  type MoloniActivationGateInput,
} from "./moloni-admin.ts"

const readyGate: MoloniActivationGateInput = {
  credentialsConfigured: true,
  encryptionKeyConfigured: true,
  oauthConnected: true,
  tokenUsable: true,
  companyConfigured: true,
  companyValidated: true,
  documentSetsValidated: true,
  productsValidated: true,
  taxesValidated: true,
  paymentMethodValidated: true,
  mappingsValidated: true,
  missingPaidProductMappings: 0,
  approvedChecklistItems: 18,
  requiredChecklistItems: 18,
  draftTestPassed: true,
  monetaryDivergences: 0,
  moloniEnvironment: "live",
  documentStatus: 1,
}

Deno.test("Moloni production gate only opens when every requirement is satisfied", () => {
  assertEquals(getMissingMoloniActivationRequirements(readyGate), [])
})

Deno.test("Moloni production gate reports all blocking conditions", () => {
  const missing = getMissingMoloniActivationRequirements({
    ...readyGate,
    credentialsConfigured: false,
    missingPaidProductMappings: 2,
    approvedChecklistItems: 17,
    draftTestPassed: false,
    monetaryDivergences: 1,
    moloniEnvironment: "draft",
    documentStatus: 0,
  })

  assert(missing.includes("Credenciais Moloni configuradas"))
  assert(missing.includes("Todos os produtos pagos com mapeamento fiscal validado"))
  assert(missing.includes("Checklist fiscal integralmente aprovado"))
  assert(missing.includes("Teste de rascunho concluído com sucesso"))
  assert(missing.includes("Divergências monetárias resolvidas"))
  assert(missing.includes("Ambiente Moloni de produção selecionado"))
  assert(missing.includes("Fechamento do documento aprovado para produção"))
})

Deno.test("Moloni dangerous actions require exact strong confirmations", () => {
  assertEquals(isStrongMoloniActivationConfirmation("ATIVAR MOLONI"), true)
  assertEquals(isStrongMoloniActivationConfirmation("ativar moloni"), false)
  assertEquals(isDraftHomologationConfirmation("CRIAR RASCUNHO DE TESTE"), true)
  assertEquals(isDraftHomologationConfirmation("CRIAR DOCUMENTO"), false)
})

Deno.test("Moloni queue masks buyer identity", () => {
  assertEquals(minimalBuyerLabel("Maria da Silva", "maria@example.com"), "Maria S.")
  assertEquals(minimalBuyerLabel(null, "maria@example.com"), "ma***@example.com")
  assertEquals(minimalBuyerLabel(null, null), "Comprador")
})
