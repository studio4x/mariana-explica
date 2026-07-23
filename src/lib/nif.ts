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

  if (!/^[1235689]\d{8}$/.test(digits)) {
    return false
  }

  if (/^(\d)\1{8}$/.test(digits)) {
    return false
  }

  const sum = digits
    .slice(0, 8)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (9 - index), 0)
  const remainder = sum % 11
  const checkDigit = remainder < 2 ? 0 : 11 - remainder
  return Number(digits[8]) === checkDigit
}
