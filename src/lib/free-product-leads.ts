import type { AdminFreeProductLead, AdminFreeProductLeadDeliveryStatus } from "@/types/app.types"

const statusLabels: Record<AdminFreeProductLeadDeliveryStatus, string> = {
  queued: "Na fila",
  sent: "Enviado",
  failed: "Falhou",
}

export function getFreeProductLeadStatusLabel(status: AdminFreeProductLeadDeliveryStatus) {
  return statusLabels[status]
}

function protectSpreadsheetCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function csvCell(value: string | number) {
  const normalized = protectSpreadsheetCell(String(value)).replace(/"/g, '""')
  return `"${normalized}"`
}

export function buildFreeProductLeadsCsv(rows: AdminFreeProductLead[]) {
  const header = [
    "Nome",
    "E-mail",
    "Material",
    "Estado da entrega",
    "Solicitações",
    "Primeira solicitação",
    "Última solicitação",
    "Origem",
  ]

  const body = rows.map((lead) => [
    lead.name,
    lead.email,
    lead.product.title,
    getFreeProductLeadStatusLabel(lead.delivery_status),
    lead.request_count,
    lead.first_requested_at,
    lead.last_requested_at,
    lead.source,
  ])

  return `\uFEFF${[header, ...body].map((row) => row.map(csvCell).join(";")).join("\r\n")}`
}

export function downloadFreeProductLeadsCsv(rows: AdminFreeProductLead[]) {
  const csv = buildFreeProductLeadsCsv(rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `leads-materiais-gratuitos-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
