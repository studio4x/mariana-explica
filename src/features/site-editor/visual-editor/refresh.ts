const VISUAL_EDITOR_REFRESH_STORAGE_KEY = "mariana-explica:visual-editor-refresh"
export const VISUAL_EDITOR_REFRESH_EVENT = "mariana-explica:visual-editor-refresh"

export interface VisualEditorRefreshPayload {
  pageKey: string
  issuedAt: string
}

function normalizeVisualEditorRefreshPayload(rawValue: unknown) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<VisualEditorRefreshPayload> | null
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const pageKey = typeof parsed.pageKey === "string" ? parsed.pageKey.trim() : ""
    if (!pageKey) {
      return null
    }

    return {
      pageKey,
      issuedAt: typeof parsed.issuedAt === "string" ? parsed.issuedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function readVisualEditorRefreshPayload(value: string | null | undefined) {
  return normalizeVisualEditorRefreshPayload(value)
}

export function broadcastVisualEditorRefresh(pageKey: string) {
  if (typeof window === "undefined") {
    return
  }

  const normalizedPageKey = String(pageKey ?? "").trim()
  if (!normalizedPageKey) {
    return
  }

  const payload: VisualEditorRefreshPayload = {
    pageKey: normalizedPageKey,
    issuedAt: new Date().toISOString(),
  }

  const serialized = JSON.stringify(payload)
  window.localStorage.setItem(VISUAL_EDITOR_REFRESH_STORAGE_KEY, serialized)
  window.dispatchEvent(new CustomEvent<VisualEditorRefreshPayload>(VISUAL_EDITOR_REFRESH_EVENT, { detail: payload }))
}
