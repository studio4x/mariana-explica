export type MoloniChecklistGroup = "automatic" | "accountant" | "operation"

export interface MoloniChecklistGuide {
  group: MoloniChecklistGroup
  question: string
  help: string
  options?: string[]
  placeholder?: string
}

export const MOLONI_CHECKLIST_GUIDES: Record<string, MoloniChecklistGuide> = {
  immediate_payment_document: {
    group: "automatic",
    question: "Que documento será usado quando o pagamento já estiver concluído?",
    help: "A plataforma lê esta escolha diretamente da configuração fiscal.",
  },
  production_document_set: {
    group: "automatic",
    question: "As séries dos produtos estão configuradas?",
    help: "A plataforma confere os mapeamentos ativos de todos os produtos publicados.",
  },
  homologation_strategy: {
    group: "automatic",
    question: "Os testes estão isolados e em rascunho?",
    help: "A plataforma só confirma este item depois de um teste documental em rascunho.",
  },
  moloni_products: {
    group: "automatic",
    question: "Todos os produtos pagos estão ligados a artigos Moloni?",
    help: "A plataforma compara os produtos publicados com os mapeamentos ativos.",
  },
  automatic_closing: {
    group: "automatic",
    question: "Os documentos serão rascunhos ou documentos fechados?",
    help: "Esta informação é lida da configuração do ambiente selecionado.",
  },
  customer_pdf_delivery: {
    group: "automatic",
    question: "Como o cliente recebe o documento fiscal?",
    help: "A plataforma disponibiliza o PDF protegido na área do aluno após a emissão.",
  },
  buyer_without_vat: {
    group: "accountant",
    question: "O que fazer quando o comprador não informa NIF?",
    help: "Confirme esta escolha com a contabilista.",
    options: [
      "Usar o cliente genérico aprovado na configuração",
      "Exigir NIF antes de concluir a compra",
      "Enviar a emissão para revisão manual",
    ],
  },
  individual_required_data: {
    group: "accountant",
    question: "Quais dados serão exigidos de uma pessoa particular?",
    help: "Escolha a regra confirmada para os documentos fiscais.",
    options: [
      "Nome, email, país e morada fiscal",
      "Nome, email e país",
      "Aplicar a orientação específica da contabilista",
    ],
  },
  company_required_data: {
    group: "accountant",
    question: "Quais dados serão exigidos de uma empresa?",
    help: "O NIF/VAT empresarial deve ser validado antes da emissão.",
    options: [
      "Razão social, email, NIF/VAT, país e morada fiscal",
      "Razão social, email, NIF/VAT e país",
      "Aplicar a orientação específica da contabilista",
    ],
  },
  eac: {
    group: "accountant",
    question: "É necessário informar CAE nos documentos?",
    help: "Se houver mais de um CAE na Moloni, confirme qual corresponde aos produtos digitais.",
    options: [
      "Não se aplica",
      "Usar o CAE configurado nos artigos Moloni",
      "Usar um CAE específico indicado pela contabilista",
    ],
    placeholder: "Informe o CAE quando a contabilista indicar um código específico.",
  },
  portugal_vat: {
    group: "accountant",
    question: "Qual regra de IVA será aplicada às vendas em Portugal?",
    help: "A taxa efetiva continuará vindo da regra fiscal e da API da Moloni.",
    options: [
      "Aplicar a taxa configurada nas regras fiscais",
      "Aplicar isenção configurada e respetivo motivo legal",
      "Enviar para revisão quando não houver regra segura",
    ],
  },
  international_sales: {
    group: "accountant",
    question: "A plataforma venderá para compradores fora de Portugal?",
    help: "Sem uma regra explícita, a emissão internacional continuará bloqueada para revisão.",
    options: [
      "Não vender fora de Portugal",
      "Aplicar somente regras por país previamente configuradas",
      "Enviar todas as vendas internacionais para revisão manual",
    ],
  },
  eu_b2b_b2c_oss: {
    group: "accountant",
    question: "Como tratar vendas para outros países da União Europeia?",
    help: "Confirme com a contabilista se há enquadramento B2B, B2C ou OSS.",
    options: [
      "Não se aplica — vendas limitadas a Portugal",
      "Aplicar regras B2B/B2C configuradas por país",
      "Revisão manual até validação ou adesão ao OSS",
    ],
  },
  exemptions: {
    group: "accountant",
    question: "A empresa utilizará alguma isenção de IVA?",
    help: "Motivos legais nunca serão inventados pela plataforma.",
    options: [
      "Não se aplica",
      "Usar apenas motivos de isenção configurados nas regras fiscais",
      "Enviar documentos isentos para revisão manual",
    ],
  },
  full_refund: {
    group: "operation",
    question: "O que fazer após um reembolso total?",
    help: "A opção segura atual mantém o caso em revisão antes de qualquer documento retificativo.",
    options: [
      "Enviar para revisão fiscal antes de emitir documento retificativo",
      "Emitir nota de crédito somente após aprovação manual",
    ],
  },
  partial_refund: {
    group: "operation",
    question: "O que fazer após um reembolso parcial?",
    help: "A opção segura atual mantém o caso em revisão antes de qualquer documento retificativo.",
    options: [
      "Enviar para revisão fiscal antes de emitir documento retificativo",
      "Emitir nota de crédito parcial somente após aprovação manual",
    ],
  },
  chargeback: {
    group: "operation",
    question: "O que fazer quando houver disputa ou chargeback?",
    help: "A plataforma não deve emitir automaticamente um documento fiscal incorreto.",
    options: [
      "Enviar para revisão fiscal sem emissão automática",
      "Aguardar o resultado definitivo da disputa e depois revisar",
    ],
  },
  tax_authority_communication: {
    group: "accountant",
    question: "A comunicação à Autoridade Tributária está configurada na Moloni?",
    help: "Este estado pertence à conta Moloni e precisa ser confirmado pela contabilista.",
    options: [
      "Sim, configurada e confirmada na Moloni",
      "Ainda não — manter emissão real desativada",
    ],
  },
}

interface ChecklistDetectionInput {
  environment: "test" | "live"
  settings: Array<Record<string, unknown>>
  mappings: Array<Record<string, unknown>>
  products: Array<Record<string, unknown>>
  validations: Array<Record<string, unknown>>
}

function validationPassed(
  validations: Array<Record<string, unknown>>,
  environment: "test" | "live",
  type: string,
) {
  return validations.some(
    (item) =>
      item.payment_environment === environment &&
      item.validation_type === type &&
      item.status === "passed",
  )
}

export function detectMoloniChecklistValues({
  environment,
  settings,
  mappings,
  products,
  validations,
}: ChecklistDetectionInput) {
  const detected: Record<string, string> = {
    customer_pdf_delivery:
      "PDF fiscal protegido e disponível na área do aluno após a emissão",
  }
  const currentSettings = settings.find(
    (item) => item.payment_environment === environment,
  )
  if (!currentSettings) return detected

  if (currentSettings.document_kind === "invoice_receipt") {
    detected.immediate_payment_document = "Fatura-recibo"
  } else if (currentSettings.document_kind === "invoice") {
    detected.immediate_payment_document = "Fatura"
  }

  detected.automatic_closing =
    Number(currentSettings.document_status) === 1
      ? "Fechar automaticamente após emissão (status 1)"
      : "Manter em rascunho (status 0)"

  const publishedProductIds = new Set(
    products
      .filter((item) => item.status === "published")
      .map((item) => String(item.id)),
  )
  const activeMappings = mappings.filter(
    (item) =>
      item.payment_environment === environment &&
      item.is_active === true &&
      publishedProductIds.has(String(item.product_id)),
  )
  const mappedProductIds = new Set(activeMappings.map((item) => String(item.product_id)))
  const allProductsMapped =
    publishedProductIds.size > 0 &&
    [...publishedProductIds].every((id) => mappedProductIds.has(id))

  if (allProductsMapped && validationPassed(validations, environment, "mappings")) {
    detected.moloni_products = `${mappedProductIds.size} produto(s) publicado(s) ligado(s) e validado(s)`
    const series = [...new Set(
      activeMappings
        .map((item) => String(item.moloni_document_set_name ?? "").trim())
        .filter(Boolean),
    )]
    if (
      series.length > 0 &&
      activeMappings.every((item) => Number(item.moloni_document_set_id) > 0) &&
      validationPassed(validations, environment, "document_sets")
    ) {
      detected.production_document_set = `Série(s) validada(s): ${series.join(", ")}`
    }
  }

  const testSettings = settings.find((item) => item.payment_environment === "test")
  if (
    testSettings?.moloni_environment === "draft" &&
    Number(testSettings.document_status) === 0 &&
    validationPassed(validations, "test", "draft_document")
  ) {
    detected.homologation_strategy =
      "Stripe teste isolado, documento em rascunho e homologação concluída"
  }

  return detected
}

