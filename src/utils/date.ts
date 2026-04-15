const formatter = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const dateTimeFormatter = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return formatter.format(new Date(value))
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  return dateTimeFormatter.format(new Date(value))
}
