import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchPublicBrandingConfig } from "@/services"

const DEFAULT_FAVICON = "/favicon.svg"
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

export function applySiteFavicon(url: string | null | undefined) {
  applyFavicon(url)
}

export function SiteBrandingManager() {
  const brandingConfigQuery = useQuery({
    queryKey: ["site", "branding"],
    queryFn: fetchPublicBrandingConfig,
    staleTime: 60_000,
  })

  useEffect(() => {
    applyFavicon(brandingConfigQuery.data?.config_value.favicon.public_url)
  }, [brandingConfigQuery.data?.config_value.favicon.public_url])

  return null
}
