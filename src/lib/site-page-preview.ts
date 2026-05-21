const SITE_PAGE_PREVIEW_PREFIX = "me:site-page-preview:"
const SITE_PAGE_PREVIEW_QUERY_PARAM = "builder-preview"
const SITE_PAGE_PREVIEW_TTL_MS = 1000 * 60 * 60 * 6

export interface SitePagePreviewPayload {
  slug: string
  html: string
  css: string
  createdAt: string
}

function buildPreviewStorageKey(token: string) {
  return `${SITE_PAGE_PREVIEW_PREFIX}${token}`
}

function isPreviewPayload(value: unknown): value is SitePagePreviewPayload {
  if (!value || typeof value !== "object") return false
  const preview = value as Record<string, unknown>
  return (
    typeof preview.slug === "string" &&
    typeof preview.html === "string" &&
    typeof preview.css === "string" &&
    typeof preview.createdAt === "string"
  )
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function cleanupExpiredSitePagePreviews() {
  if (!canUseLocalStorage()) return
  const now = Date.now()

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith(SITE_PAGE_PREVIEW_PREFIX)) continue

    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) {
        window.localStorage.removeItem(key)
        continue
      }
      const parsed = JSON.parse(raw) as unknown
      if (!isPreviewPayload(parsed)) {
        window.localStorage.removeItem(key)
        continue
      }
      const createdAtMs = Date.parse(parsed.createdAt)
      if (!Number.isFinite(createdAtMs) || now - createdAtMs > SITE_PAGE_PREVIEW_TTL_MS) {
        window.localStorage.removeItem(key)
      }
    } catch {
      window.localStorage.removeItem(key)
    }
  }
}

export function createSitePagePreviewUrl(pathname: string, token: string) {
  const previewUrl = new URL(pathname, window.location.origin)
  previewUrl.searchParams.set(SITE_PAGE_PREVIEW_QUERY_PARAM, token)
  return previewUrl.toString()
}

export function storeSitePagePreview(input: { slug: string; html: string; css: string }) {
  if (!canUseLocalStorage()) return null

  cleanupExpiredSitePagePreviews()
  const token = crypto.randomUUID()
  const payload: SitePagePreviewPayload = {
    slug: input.slug,
    html: input.html,
    css: input.css,
    createdAt: new Date().toISOString(),
  }

  window.localStorage.setItem(buildPreviewStorageKey(token), JSON.stringify(payload))
  return token
}

export function readSitePagePreviewFromSearch(slug: string, search: string) {
  if (!canUseLocalStorage()) return null

  cleanupExpiredSitePagePreviews()
  const params = new URLSearchParams(search)
  const token = params.get(SITE_PAGE_PREVIEW_QUERY_PARAM)?.trim()
  if (!token) return null

  try {
    const raw = window.localStorage.getItem(buildPreviewStorageKey(token))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isPreviewPayload(parsed) || parsed.slug !== slug) return null
    return parsed
  } catch {
    return null
  }
}
