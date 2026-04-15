export function formatCurrency(valueCents: number, currency = "EUR", locale = "pt-PT") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(valueCents / 100)
}

export function formatShortCurrency(valueCents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valueCents / 100)
}

export function formatProductPrice(valueCents: number, currency = "EUR") {
  if (valueCents === 0) {
    return "Grátis"
  }

  return formatCurrency(valueCents, currency)
}
