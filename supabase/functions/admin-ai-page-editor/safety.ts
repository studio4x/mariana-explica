import type { PatchEngineBaseVersion } from "./patch-engine.ts"

export interface AiContextVersionCandidate {
  id: string
  page_id: string
  version_number: number
  status: string
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

export interface SelectedAiBaseVersion {
  baseVersion: AiContextVersionCandidate | null
  source: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  reason: string
}

function normalizeLayoutSearchText(value: unknown): string {
  if (typeof value === "string") {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeLayoutSearchText(item)).join(" ")
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizeLayoutSearchText(item))
      .join(" ")
  }

  return ""
}

export function countManagedBlocks(layoutJson: Record<string, unknown>) {
  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : null

  if (Array.isArray(projectData?.blocks)) return projectData.blocks.length
  if (Array.isArray(layoutJson.blocks)) return layoutJson.blocks.length
  return 0
}

export function shouldUsePublishedVersionForAiContext(
  draft: Pick<AiContextVersionCandidate, "version_number" | "layout_json"> | null | undefined,
  published: Pick<AiContextVersionCandidate, "version_number" | "layout_json"> | null | undefined,
) {
  if (!draft || !published) return { usePublished: false, reason: "missing_version" }

  if (draft.version_number < published.version_number) {
    return { usePublished: true, reason: "draft_version_older_than_published" }
  }

  const draftBlocks = countManagedBlocks(draft.layout_json)
  const publishedBlocks = countManagedBlocks(published.layout_json)
  if (publishedBlocks > 0 && draftBlocks === 0) {
    return { usePublished: true, reason: "draft_missing_managed_blocks" }
  }
  if (publishedBlocks > 0 && draftBlocks > 0 && draftBlocks < publishedBlocks) {
    return { usePublished: true, reason: "draft_has_fewer_managed_blocks" }
  }

  const draftText = normalizeLayoutSearchText(draft.layout_json)
  const publishedText = normalizeLayoutSearchText(published.layout_json)
  if (publishedText.length > 500 && draftText.length === 0) {
    return { usePublished: true, reason: "draft_missing_layout_text" }
  }
  if (publishedText.length > 500 && draftText.length < publishedText.length * 0.6) {
    return { usePublished: true, reason: "draft_text_significantly_shorter_than_published" }
  }

  return { usePublished: false, reason: "latest_draft_considered_safe" }
}

export function selectAiBaseVersion(input: {
  latestDraft: AiContextVersionCandidate | null | undefined
  publishedVersion: AiContextVersionCandidate | null | undefined
}): SelectedAiBaseVersion {
  const latestDraft = input.latestDraft ?? null
  const publishedVersion = input.publishedVersion ?? null

  if (latestDraft && publishedVersion) {
    const decision = shouldUsePublishedVersionForAiContext(latestDraft, publishedVersion)
    if (decision.usePublished) {
      return {
        baseVersion: publishedVersion,
        source: "published_version",
        degradedDraftBypassed: true,
        reason: decision.reason,
      }
    }

    return {
      baseVersion: latestDraft,
      source: "latest_draft",
      degradedDraftBypassed: false,
      reason: decision.reason,
    }
  }

  if (publishedVersion) {
    return {
      baseVersion: publishedVersion,
      source: "published_version",
      degradedDraftBypassed: false,
      reason: "published_version_only",
    }
  }

  if (latestDraft) {
    return {
      baseVersion: latestDraft,
      source: "latest_draft",
      degradedDraftBypassed: false,
      reason: "latest_draft_only",
    }
  }

  return {
    baseVersion: null,
    source: "none",
    degradedDraftBypassed: false,
    reason: "no_base_version_available",
  }
}

function normalizePathname(pathname: string) {
  const trimmed = String(pathname ?? "").trim()
  if (!trimmed) return "/"
  if (trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

export function matchAllowedPathPattern(pathname: string, pattern: string) {
  const normalizedPath = normalizePathname(pathname)
  const normalizedPattern = normalizePathname(pattern)

  if (normalizedPattern === normalizedPath) {
    return true
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean)
  const patternSegments = normalizedPattern.split("/").filter(Boolean)
  const hasWildcard = patternSegments[patternSegments.length - 1] === "*"
  const comparablePatternSegments = hasWildcard ? patternSegments.slice(0, -1) : patternSegments

  if (!hasWildcard && comparablePatternSegments.length !== pathSegments.length) {
    return false
  }

  if (hasWildcard && comparablePatternSegments.length > pathSegments.length) {
    return false
  }

  for (let index = 0; index < comparablePatternSegments.length; index += 1) {
    const patternSegment = comparablePatternSegments[index]
    const pathSegment = pathSegments[index]

    if (patternSegment?.startsWith(":")) {
      if (!pathSegment) return false
      continue
    }

    if (patternSegment !== pathSegment) {
      return false
    }
  }

  return hasWildcard || comparablePatternSegments.length === pathSegments.length
}

export function isPathAllowedByPatterns(pathname: string, patterns: string[]) {
  if (patterns.length === 0) return false
  return patterns.some((pattern) => matchAllowedPathPattern(pathname, pattern))
}

export function toPatchEngineBaseVersion(version: AiContextVersionCandidate): PatchEngineBaseVersion {
  return {
    id: String(version.id),
    page_id: String(version.page_id),
    version_number: Number(version.version_number ?? 0),
    status: String(version.status ?? ""),
    layout_json:
      version.layout_json && typeof version.layout_json === "object" && !Array.isArray(version.layout_json)
        ? JSON.parse(JSON.stringify(version.layout_json)) as Record<string, unknown>
        : {},
    style_json:
      version.style_json && typeof version.style_json === "object" && !Array.isArray(version.style_json)
        ? JSON.parse(JSON.stringify(version.style_json)) as Record<string, unknown>
        : {},
    metadata:
      version.metadata && typeof version.metadata === "object" && !Array.isArray(version.metadata)
        ? JSON.parse(JSON.stringify(version.metadata)) as Record<string, unknown>
        : {},
  }
}
