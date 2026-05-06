export function stripNifDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function formatNif(value: string) {
  const digits = stripNifDigits(value).slice(0, 9)
  return digits
    .replace(/^(\d{3})(\d)/, "$1 $2")
    .replace(/^(\d{3}) (\d{3})(\d)/, "$1 $2 $3")
}

export function isValidNif(value: string) {
  const digits = stripNifDigits(value)

  if (digits.length !== 9) {
    return false
  }

  if (/^(\d)\1{8}$/.test(digits)) {
    return false
  }

  return true
}
