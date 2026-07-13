export function openCheckoutUrlInNewTab(url: string) {
  const checkoutWindow = window.open(url, "_blank")
  if (!checkoutWindow) {
    return false
  }

  checkoutWindow.opener = null
  checkoutWindow.focus()
  return true
}
