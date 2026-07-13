const BRANDING_STORAGE_KEY = "mariana-explica:branding-updated"
export const BRANDING_UPDATED_EVENT = "mariana-explica:branding-updated"

export function buildVersionedAssetUrl(url: string | null | undefined, version: string | null | undefined) {
  const nextUrl = (url ?? "").trim()
  if (!nextUrl) {
    return null
  }

  const nextVersion = (version ?? "").trim()
  if (!nextVersion) {
    return nextUrl
  }

  const assetUrl = new URL(nextUrl, window.location.origin)
  assetUrl.searchParams.set("v", nextVersion)
  return assetUrl.toString()
}

function applyFavicon(url: string | null | undefined) {
  const nextUrl = (url ?? "").trim()
  if (!nextUrl) {
    document.head
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((link) => link.remove())
    return
  }

  const faviconLink = ensureManagedFaviconLink()
  const pathname = new URL(nextUrl, window.location.origin).pathname.toLowerCase()
  faviconLink.type = pathname.endsWith(".svg")
    ? "image/svg+xml"
    : pathname.endsWith(".png")
      ? "image/png"
      : pathname.endsWith(".webp")
        ? "image/webp"
        : "image/x-icon"
  faviconLink.href = nextUrl
}

const MANAGED_FAVICON_SELECTOR = 'link[data-managed-favicon="true"]'

function ensureManagedFaviconLink() {
  const existingLink = document.head.querySelector<HTMLLinkElement>(MANAGED_FAVICON_SELECTOR)
  if (existingLink) {
    return existingLink
  }

  document.head
    .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
    .forEach((link) => {
      link.remove()
    })

  const link = document.createElement("link")
  link.rel = "icon"
  link.setAttribute("data-managed-favicon", "true")
  document.head.appendChild(link)
  return link
}

export function applySiteFavicon(url: string | null | undefined, version?: string | null) {
  const nextUrl = buildVersionedAssetUrl(url, version)
  applyFavicon(nextUrl)
}

export function broadcastBrandingUpdate(version?: string | null) {
  const payload = version ?? new Date().toISOString()
  window.localStorage.setItem(BRANDING_STORAGE_KEY, payload)
  window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
}
