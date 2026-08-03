const SITE_SEO_STORAGE_KEY = 'mariana-explica:site-seo-updated'
export const SITE_SEO_UPDATED_EVENT = 'mariana-explica:site-seo-updated'

export function broadcastSiteSeoUpdate(version?: string | null) {
  const payload = version ?? new Date().toISOString()
  window.localStorage.setItem(SITE_SEO_STORAGE_KEY, payload)
  window.dispatchEvent(new Event(SITE_SEO_UPDATED_EVENT))
}
