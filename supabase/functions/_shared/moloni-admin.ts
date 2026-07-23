export const MOLONI_CHECKLIST_KEYS = [
  "immediate_payment_document",
  "buyer_without_vat",
  "individual_required_data",
  "company_required_data",
  "production_document_set",
  "homologation_strategy",
  "eac",
  "moloni_products",
  "portugal_vat",
  "international_sales",
  "eu_b2b_b2c_oss",
  "exemptions",
  "full_refund",
  "partial_refund",
  "chargeback",
  "automatic_closing",
  "tax_authority_communication",
  "customer_pdf_delivery",
] as const

export type MoloniChecklistKey = typeof MOLONI_CHECKLIST_KEYS[number]

export interface MoloniActivationGateInput {
  credentialsConfigured: boolean
  encryptionKeyConfigured: boolean
  oauthConnected: boolean
  tokenUsable: boolean
  companyConfigured: boolean
  companyValidated: boolean
  documentSetsValidated: boolean
  productsValidated: boolean
  taxesValidated: boolean
  paymentMethodValidated: boolean
  mappingsValidated: boolean
  missingPaidProductMappings: number
  approvedChecklistItems: number
  requiredChecklistItems: number
  draftTestPassed: boolean
  monetaryDivergences: number
  moloniEnvironment: "draft" | "live"
  documentStatus: 0 | 1
}

export function getMissingMoloniActivationRequirements(input: MoloniActivationGateInput) {
  const missing: string[] = []
  if (!input.credentialsConfigured) missing.push("Credenciais Moloni configuradas")
  if (!input.encryptionKeyConfigured) missing.push("Chave de criptografia configurada no ambiente")
  if (!input.oauthConnected) missing.push("OAuth Moloni conectado")
  if (!input.tokenUsable) missing.push("Token Moloni válido ou renovável")
  if (!input.companyConfigured) missing.push("Empresa Moloni selecionada")
  if (!input.companyValidated) missing.push("Empresa Moloni validada")
  if (!input.documentSetsValidated) missing.push("Séries documentais validadas")
  if (!input.productsValidated) missing.push("Artigos Moloni validados")
  if (!input.taxesValidated) missing.push("Impostos validados")
  if (!input.paymentMethodValidated) missing.push("Método de pagamento validado")
  if (!input.mappingsValidated || input.missingPaidProductMappings > 0) {
    missing.push("Todos os produtos pagos com mapeamento fiscal validado")
  }
  if (
    input.requiredChecklistItems === 0 ||
    input.approvedChecklistItems !== input.requiredChecklistItems
  ) {
    missing.push("Checklist fiscal integralmente aprovado")
  }
  if (!input.draftTestPassed) missing.push("Teste de rascunho concluído com sucesso")
  if (input.monetaryDivergences > 0) missing.push("Divergências monetárias resolvidas")
  if (input.moloniEnvironment !== "live") missing.push("Ambiente Moloni de produção selecionado")
  if (input.documentStatus !== 1) missing.push("Fechamento do documento aprovado para produção")
  return missing
}

export function isStrongMoloniActivationConfirmation(value: unknown) {
  return typeof value === "string" && value.trim() === "ATIVAR MOLONI"
}

export function isDraftHomologationConfirmation(value: unknown) {
  return typeof value === "string" && value.trim() === "CRIAR RASCUNHO DE TESTE"
}

export function minimalBuyerLabel(fullName: unknown, email: unknown) {
  if (typeof fullName === "string" && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0] ?? ""}.` : parts[0]
  }
  if (typeof email === "string" && email.includes("@")) {
    const [local, domain] = email.split("@")
    return `${local.slice(0, 2)}***@${domain}`
  }
  return "Comprador"
}

export function hasApprovedChecklistItem(
  items: Array<{ item_key?: string; status?: string }>,
  key: MoloniChecklistKey,
) {
  return items.some((item) => item.item_key === key && item.status === "approved")
}
