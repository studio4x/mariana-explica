const fiscalStatusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Em processamento",
  blocked_data: "Dados pendentes",
  issued: "Emitido",
  failed_retryable: "Falha tempor\u00e1ria",
  failed_permanent: "Falha permanente",
  credit_pending: "Nota de cr\u00e9dito pendente",
  credited: "Nota de cr\u00e9dito emitida",
  cancelled_before_issue: "Cancelado antes da emiss\u00e3o",
  requires_review: "Requer revis\u00e3o",
}

export function fiscalStatusLabel(status: string) {
  return fiscalStatusLabels[status] ?? "Estado fiscal n\u00e3o reconhecido"
}
