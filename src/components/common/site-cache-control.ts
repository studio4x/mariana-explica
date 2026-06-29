const CACHE_CONTROL_STORAGE_KEY = "mariana-explica:cache-control"
export const CACHE_CONTROL_EVENT = "mariana-explica:cache-control"

export type CacheControlAction = "server" | "browser" | "full"

export interface CacheControlPayload {
  action: CacheControlAction
  issuedAt: string
}

function normalizeCacheControlPayload(rawValue: unknown): CacheControlPayload | null {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CacheControlPayload> | null
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const action = parsed.action
    if (action !== "server" && action !== "browser" && action !== "full") {
      return null
    }

    return {
      action,
      issuedAt: typeof parsed.issuedAt === "string" ? parsed.issuedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function readCacheControlPayload(value: string | null | undefined) {
  return normalizeCacheControlPayload(value)
}

export function broadcastCacheControl(action: CacheControlAction) {
  if (typeof window === "undefined") {
    return
  }

  const payload: CacheControlPayload = {
    action,
    issuedAt: new Date().toISOString(),
  }

  const serialized = JSON.stringify(payload)
  window.localStorage.setItem(CACHE_CONTROL_STORAGE_KEY, serialized)
  window.dispatchEvent(new CustomEvent<CacheControlPayload>(CACHE_CONTROL_EVENT, { detail: payload }))
}

export function getCacheControlStorageKey() {
  return CACHE_CONTROL_STORAGE_KEY
}
