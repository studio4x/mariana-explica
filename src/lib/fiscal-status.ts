import type { FiscalDocumentSummary } from "@/types/app.types"

const fiscalStatusLabels: Record<FiscalDocumentSummary["status"], string> = {
  pending: "Pendente",
  processing: "Em processamento",
  blocked_data: "Dados pendentes",
  issued: "Emitido",
  failed_retryable: "Falha temporária",
  failed_permanent: "Falha permanente",
  credit_pending: "Crédito pendente",
  credited: "Creditado",
  cancelled_before_issue: "Cancelado antes da emissão",
  requires_review: "Requer revisão",
}

const fiscalErrorLabels: Record<string, string> = {
  BILLING_SNAPSHOT_INCOMPLETE: "Dados fiscais do comprador incompletos",
  CUSTOMER_CONFIGURATION_MISSING: "Configuração do cliente incompleta",
  CUSTOMER_CREATE_INVALID_RESPONSE: "Não foi possível criar o cliente na Moloni",
  CUSTOMER_LOCK_BUSY: "Cliente em processamento",
  CUSTOMER_VAT_MISMATCH: "NIF do cliente incompatível",
  CUSTOMER_WITHOUT_VAT_RULE_MISSING: "Regra para cliente sem NIF não configurada",
  DOCUMENT_CONFIRM_INVALID_RESPONSE: "A Moloni não confirmou o documento",
  DOCUMENT_CREATE_INVALID_RESPONSE: "A Moloni não confirmou a criação do documento",
  DOCUMENT_KIND_NOT_APPROVED: "Tipo de documento não aprovado",
  ENVIRONMENT_ISOLATION_VIOLATION: "Ambiente de pagamento incompatível",
  FISCAL_CONFIGURATION_INCOMPLETE: "Configuração fiscal incompleta",
  FISCAL_RULE_CONFLICT: "Conflito nas regras fiscais",
  FISCAL_RULE_NOT_FOUND: "Regra fiscal não encontrada",
  FISCAL_SNAPSHOT_INVALID: "Snapshot fiscal inválido",
  MAPPING_COMPANY_MISMATCH: "Mapeamento ligado a outra empresa Moloni",
  MAPPING_REQUIRES_REVIEW: "Mapeamento fiscal requer revisão",
  MOLONI_REJECTED: "Documento rejeitado pela Moloni",
  MOLONI_TOTAL_MISMATCH: "Totais do documento não conferem com a Moloni",
  ORDER_ITEM_TOTAL_MISMATCH: "Totais dos itens não conferem com o pedido",
  ORDER_NOT_PAID: "O pedido ainda não está pago",
  PAYMENT_METHOD_MISSING: "Método de pagamento não configurado",
  PRODUCT_MAPPING_MISSING: "Produto sem mapeamento Moloni",
  TAX_MAPPING_DIVERGED: "Taxa fiscal diferente da configurada na Moloni",
  TAX_MAPPING_INVALID: "Imposto configurado não encontrado na Moloni",
  TAX_RATE_MISSING: "Taxa de imposto não configurada",
  TAX_RULE_MISSING: "Regra de imposto não encontrada",
}

function humanizeUnknownStatus(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function fiscalDocumentStatusLabel(status: string | null | undefined) {
  if (!status) return "Não disponível"
  return fiscalStatusLabels[status as FiscalDocumentSummary["status"]] ?? humanizeUnknownStatus(status)
}

export function fiscalErrorLabel(code: string | null | undefined) {
  if (!code) return null
  return fiscalErrorLabels[code] ?? humanizeUnknownStatus(code)
}

export function canDownloadFiscalDocument(
  document: Pick<FiscalDocumentSummary, "status" | "environment" | "remote_status">,
) {
  return document.status === "issued" && document.environment === "live" && document.remote_status !== 0
}
