const BRANDING_STORAGE_KEY = "mariana-explica:branding-updated"
export const BRANDING_UPDATED_EVENT = "mariana-explica:branding-updated"

export function buildVersionedAssetUrl(url: string | null | undefined, version: string | null | undefined) {
  const nextUrl = (url ?? "").trim()
  if (!nextUrl) {
    return null
  }

  const assetUrl = new URL(nextUrl, window.location.origin)
  if (assetUrl.hostname === "mariana-explica.pt") {
    assetUrl.protocol = "https:"
    assetUrl.hostname = "www.mariana-explica.pt"
  }
  if (
    assetUrl.hostname === "www.mariana-explica.pt" &&
    assetUrl.pathname === "/api/public/site-asset"
  ) {
    assetUrl.pathname = "/site-asset"
  }

  const nextVersion = (version ?? "").trim()
  if (nextVersion) {
    assetUrl.searchParams.set("v", nextVersion)
  }

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
  // The canonical /favicon endpoint can serve JPEG, PNG, WebP or SVG from
  // the current admin configuration. Omitting type lets the response's real
  // Content-Type remain the source of truth.
  faviconLink.removeAttribute("type")
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
