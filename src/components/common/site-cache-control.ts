const CACHE_CONTROL_STORAGE_KEY = "mariana-explica:cache-control"
export const CACHE_CONTROL_EVENT = "mariana-explica:cache-control"
const CACHE_CONTROL_FEEDBACK_STORAGE_KEY = "mariana-explica:cache-control-feedback"
export const CACHE_CONTROL_FEEDBACK_EVENT = "mariana-explica:cache-control-feedback"

export type CacheControlAction = "server" | "browser" | "full"
export type CacheControlFeedbackTone = "success" | "error"

export interface CacheControlPayload {
  action: CacheControlAction
  issuedAt: string
}

export interface CacheControlFeedbackPayload {
  tone: CacheControlFeedbackTone
  message: string
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

function normalizeCacheControlFeedbackPayload(rawValue: unknown): CacheControlFeedbackPayload | null {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CacheControlFeedbackPayload> | null
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const tone = parsed.tone
    const message = typeof parsed.message === "string" ? parsed.message.trim() : ""
    if ((tone !== "success" && tone !== "error") || !message) {
      return null
    }

    return {
      tone,
      message,
      issuedAt: typeof parsed.issuedAt === "string" ? parsed.issuedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function readCacheControlFeedbackPayload(value: string | null | undefined) {
  return normalizeCacheControlFeedbackPayload(value)
}

export function clearCacheControlFeedback() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(CACHE_CONTROL_FEEDBACK_STORAGE_KEY)
}

export function broadcastCacheControlFeedback(
  payload: Omit<CacheControlFeedbackPayload, "issuedAt">,
  options?: { persist?: boolean },
) {
  if (typeof window === "undefined") {
    return
  }

  const nextPayload: CacheControlFeedbackPayload = {
    ...payload,
    issuedAt: new Date().toISOString(),
  }

  const serialized = JSON.stringify(nextPayload)
  if (options?.persist) {
    window.sessionStorage.setItem(CACHE_CONTROL_FEEDBACK_STORAGE_KEY, serialized)
  }

  window.dispatchEvent(new CustomEvent<CacheControlFeedbackPayload>(CACHE_CONTROL_FEEDBACK_EVENT, { detail: nextPayload }))
}

export function getCacheControlFeedbackStorageKey() {
  return CACHE_CONTROL_FEEDBACK_STORAGE_KEY
}
