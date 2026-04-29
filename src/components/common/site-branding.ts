const DEFAULT_FAVICON = "/favicon.svg"
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
  const nextUrl = (url ?? "").trim() || DEFAULT_FAVICON
  const faviconLink = ensureManagedFaviconLink()
  faviconLink.type = nextUrl.endsWith(".svg")
    ? "image/svg+xml"
    : nextUrl.endsWith(".png")
      ? "image/png"
      : nextUrl.endsWith(".webp")
        ? "image/webp"
        : "image/x-icon"
  faviconLink.href = nextUrl
}

const MANAGED_FAVICON_SELECTOR = 'link[rel="icon"]'

function ensureManagedFaviconLink() {
  const existingLink = document.head.querySelector<HTMLLinkElement>(MANAGED_FAVICON_SELECTOR)
  if (existingLink) {
    return existingLink
  }

  const link = document.createElement("link")
  link.rel = "icon"
  document.head.appendChild(link)
  return link
}

export function applySiteFavicon(url: string | null | undefined) {
  applyFavicon(url)
}

export function broadcastBrandingUpdate(version?: string | null) {
  const payload = version ?? new Date().toISOString()
  window.localStorage.setItem(BRANDING_STORAGE_KEY, payload)
  window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
}
