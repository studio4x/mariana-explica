import type { SupportTicketSummary } from "@/types/app.types"

export const supportCategories = [
  {
    key: "payment",
    label: "Pagamentos",
    description: "Compra, checkout, fatura ou acesso apos pagamento.",
    firstResponseHours: 2,
  },
  {
    key: "technical",
    label: "Problema tecnico",
    description: "Erro no dashboard, visualizador, downloads ou login.",
    firstResponseHours: 24,
  },
  {
    key: "account",
    label: "Conta e acesso",
    description: "Dados da conta, senha, acesso a cursos ou permissao.",
    firstResponseHours: 24,
  },
  {
    key: "general",
    label: "Duvida geral",
    description: "Perguntas sobre cursos, materiais ou funcionamento.",
    firstResponseHours: 24,
  },
] as const

export const supportPublicNote =
  "Os prazos indicam a primeira resposta humana da equipa. Nao representam prazo de resolucao final."

export const supportBusinessHours =
  "Atendimento em dias uteis, das 8h as 18h."

export function getSupportCategoryMeta(category: SupportTicketSummary["category"] | string | null | undefined) {
  return supportCategories.find((item) => item.key === category) ?? supportCategories[3]
}

export function getSupportStatusMeta(status: SupportTicketSummary["status"]) {
  const map = {
    open: { label: "Aberto", tone: "info" },
    in_progress: { label: "Em atendimento", tone: "warning" },
    answered: { label: "Respondido", tone: "success" },
    closed: { label: "Fechado", tone: "neutral" },
  } as const

  return map[status]
}

export function getSupportSlaStatusMeta(status: SupportTicketSummary["sla_status"]) {
  const map = {
    on_time: { label: "No prazo", tone: "success" },
    at_risk: { label: "Em risco", tone: "warning" },
    overdue: { label: "Atrasado", tone: "danger" },
    answered: { label: "Respondido", tone: "info" },
  } as const

  return map[status]
}

export function getSupportPriorityMeta(priority: SupportTicketSummary["priority"]) {
  const map = {
    low: { label: "Baixa", tone: "neutral", weight: 1, rowClass: "bg-emerald-50/60" },
    normal: { label: "Normal", tone: "warning", weight: 2, rowClass: "bg-amber-50/55" },
    medium: { label: "Media", tone: "warning", weight: 2, rowClass: "bg-amber-50/55" },
    high: { label: "Alta", tone: "danger", weight: 3, rowClass: "bg-orange-50/60" },
    urgent: { label: "Urgente", tone: "danger", weight: 4, rowClass: "bg-red-50/70" },
  } as const

  return map[priority] ?? map.normal
}

export function getSupportDueLabel(ticket: SupportTicketSummary) {
  if (ticket.first_response_at) return `Respondido em ${new Date(ticket.first_response_at).toLocaleString("pt-PT")}`
  if (ticket.first_response_due_at) return new Date(ticket.first_response_due_at).toLocaleString("pt-PT")
  return "A calcular"
}
