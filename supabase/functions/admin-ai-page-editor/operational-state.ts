import type { AiEditPlan } from "./contract.ts"

export type AiPageEditorFinalStatus =
  | "needs_clarification"
  | "awaiting_intent_confirmation"
  | "proposal_ready"
  | "draft_saved"
  | "no_visible_change"
  | "blocked"
  | "error"

export interface AiPageEditorChangeSummary {
  layout_changed: boolean
  style_changed: boolean
  html_changed: boolean
  text_changed?: boolean
}

export interface PersistibleProposalOperationalState {
  final_status: AiPageEditorFinalStatus
  change_detected: boolean
  draft_saved: false
  preview_available: boolean
  change_summary: AiPageEditorChangeSummary
}

export interface TextProposalOperationalState {
  final_status: AiPageEditorFinalStatus
  change_detected: boolean
  draft_saved: false
  preview_available: false
  change_summary: AiPageEditorChangeSummary
}

const LOW_CONFIDENCE_THRESHOLD = 0.65
const REVIEW_CONFIDENCE_THRESHOLD = 0.8

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`
  }

  return JSON.stringify(value ?? null)
}

function normalizeComparableText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeComparableHtml(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim()
}

function extractComparableHtml(layoutJson: Record<string, unknown>) {
  return typeof layoutJson.html === "string" && layoutJson.html.trim() ? layoutJson.html : null
}

function normalizePlanTargetIds(plan: AiEditPlan) {
  const operationTargetIds = Array.isArray(plan.operations)
    ? plan.operations.map((operation) => String(operation.target_id ?? "").trim())
    : []

  return Array.from(
    new Set(
      [...plan.target_ids, ...operationTargetIds]
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  )
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function detectPersistiblePageChange(input: {
  baseLayoutJson: Record<string, unknown>
  baseStyleJson: Record<string, unknown>
  proposalLayoutJson: Record<string, unknown>
  proposalStyleJson: Record<string, unknown>
}) {
  const layout_changed = stableSerialize(input.baseLayoutJson) !== stableSerialize(input.proposalLayoutJson)
  const style_changed = stableSerialize(input.baseStyleJson) !== stableSerialize(input.proposalStyleJson)
  const baseHtml = extractComparableHtml(input.baseLayoutJson) ?? ""
  const proposalHtml = extractComparableHtml(input.proposalLayoutJson) ?? ""
  const html_changed =
    Boolean(baseHtml || proposalHtml) && normalizeComparableHtml(baseHtml) !== normalizeComparableHtml(proposalHtml)

  return {
    layout_changed,
    style_changed,
    html_changed,
    change_detected: layout_changed || style_changed || html_changed,
  }
}

export function resolvePersistibleProposalOperationalState(input: {
  editPlan: AiEditPlan
  baseLayoutJson: Record<string, unknown>
  baseStyleJson: Record<string, unknown>
  proposalLayoutJson: Record<string, unknown>
  proposalStyleJson: Record<string, unknown>
  targetResolutions: Array<{ confidence?: number | null }>
  previewRenderable: boolean
  desktopRenderable: boolean
  mobileRenderable: boolean
}) {
  const diff = detectPersistiblePageChange({
    baseLayoutJson: input.baseLayoutJson,
    baseStyleJson: input.baseStyleJson,
    proposalLayoutJson: input.proposalLayoutJson,
    proposalStyleJson: input.proposalStyleJson,
  })
  const targetIds = normalizePlanTargetIds(input.editPlan)
  const resolvedCount = input.targetResolutions.length
  const lowConfidenceTargets = input.targetResolutions.filter((item) => (toFiniteNumber(item.confidence) ?? 0) < LOW_CONFIDENCE_THRESHOLD)
  const reviewTargets = input.targetResolutions.filter((item) => {
    const confidence = toFiniteNumber(item.confidence) ?? 0
    return confidence >= LOW_CONFIDENCE_THRESHOLD && confidence < REVIEW_CONFIDENCE_THRESHOLD
  })
  const preview_available =
    diff.change_detected &&
    input.previewRenderable &&
    input.desktopRenderable &&
    input.mobileRenderable
  let final_status: AiPageEditorFinalStatus

  if (!diff.change_detected) {
    final_status = "no_visible_change"
  } else if (!preview_available) {
    final_status = "blocked"
  } else if (targetIds.length > 0 && resolvedCount === 0) {
    final_status = "needs_clarification"
  } else if (targetIds.length > resolvedCount || lowConfidenceTargets.length > 0) {
    final_status = "needs_clarification"
  } else if (reviewTargets.length > 0 || input.editPlan.requires_strict_confirmation) {
    final_status = "awaiting_intent_confirmation"
  } else {
    final_status = "proposal_ready"
  }

  return {
    final_status,
    change_detected: diff.change_detected,
    draft_saved: false as const,
    preview_available: preview_available && (final_status === "proposal_ready" || final_status === "awaiting_intent_confirmation"),
    change_summary: {
      layout_changed: diff.layout_changed,
      style_changed: diff.style_changed,
      html_changed: diff.html_changed,
    },
  } satisfies PersistibleProposalOperationalState
}

export function resolveTextProposalOperationalState(input: {
  currentText: string
  nextText: string
}) {
  const text_changed = normalizeComparableText(input.currentText) !== normalizeComparableText(input.nextText)

  return {
    final_status: text_changed ? "proposal_ready" : "no_visible_change",
    change_detected: text_changed,
    draft_saved: false as const,
    preview_available: false as const,
    change_summary: {
      layout_changed: false,
      style_changed: false,
      html_changed: false,
      text_changed,
    },
  } satisfies TextProposalOperationalState
}
