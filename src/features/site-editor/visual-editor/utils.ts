import type { VisualEditorDocument } from "./types"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function cloneVisualEditorDocument(document: VisualEditorDocument): VisualEditorDocument {
  return JSON.parse(JSON.stringify(document ?? {})) as VisualEditorDocument
}

export function mergeVisualEditorDocuments(
  fallbackDocument: VisualEditorDocument,
  persistedDocument?: VisualEditorDocument | null,
): VisualEditorDocument {
  const fallbackClone = cloneVisualEditorDocument(fallbackDocument)
  const source = persistedDocument ?? {}

  const merge = (target: Record<string, unknown>, input: Record<string, unknown>) => {
    Object.entries(input).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(target[key])) {
        merge(target[key] as Record<string, unknown>, value)
        return
      }

      target[key] = cloneValue(value)
    })
  }

  merge(fallbackClone, source)
  return fallbackClone
}

export function getVisualEditorPathValue(document: VisualEditorDocument, path: string) {
  if (!path) return undefined
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isPlainObject(current)) return undefined
    return current[segment]
  }, document)
}

export function setVisualEditorPathValue(document: VisualEditorDocument, path: string, value: unknown) {
  const segments = path.split(".").filter(Boolean)
  if (segments.length === 0) return cloneVisualEditorDocument(document)

  const nextDocument = cloneVisualEditorDocument(document)
  let current: Record<string, unknown> = nextDocument

  segments.slice(0, -1).forEach((segment) => {
    const nextValue = current[segment]
    if (!isPlainObject(nextValue)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  })

  current[segments[segments.length - 1] ?? ""] = cloneValue(value)
  return nextDocument
}

export function normalizeVisualEditorString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value
}

function cloneValue(value: unknown) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.parse(JSON.stringify(value)) as unknown
  }
  return value
}

