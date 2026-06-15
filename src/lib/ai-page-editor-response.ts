import type {
  AdminAiFooterCopyProposal,
  AdminAiHeaderCopyProposal,
  AdminAiPageEditorChangeSummary,
  AdminAiPageEditorFinalStatus,
  AdminAiPageEditorProposal,
} from "@/types/app.types"

type GenerateProposalResponse = {
  success: true
  provider_used: AdminAiPageEditorProposal["provider_used"]
  summary: string
  explanation: string
  warnings: string[]
  edit_plan: AdminAiPageEditorProposal["edit_plan"]
  proposal: AdminAiPageEditorProposal["proposal"]
  final_status: AdminAiPageEditorFinalStatus
  change_detected: boolean
  draft_saved: boolean
  preview_available: boolean
  change_summary: AdminAiPageEditorChangeSummary
}

type GlobalCopyResponse = {
  success: true
  provider_used: AdminAiHeaderCopyProposal["provider_used"]
  summary: string
  explanation: string
  warnings: string[]
  final_status: AdminAiPageEditorFinalStatus
  change_detected: boolean
  draft_saved: boolean
  preview_available: boolean
  change_summary: AdminAiPageEditorChangeSummary
}

export interface ManagedPageComparableState {
  title?: string | null
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  html?: string | null
}

export interface ManagedPageDiffSummary extends AdminAiPageEditorChangeSummary {
  title_changed: boolean
  change_detected: boolean
}

const INCOMPLETE_PROPOSAL_MESSAGE =
  "O editor com IA recebeu uma resposta incompleta do servidor. Nenhuma alteracao foi aplicada."
export const AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE =
  "Analisei a pagina, mas esta tentativa nao gerou nenhuma alteracao visivel. Vou precisar ajustar melhor o alvo."
const VALID_FINAL_STATUSES: AdminAiPageEditorFinalStatus[] = [
  "needs_clarification",
  "awaiting_intent_confirmation",
  "proposal_ready",
  "draft_saved",
  "no_visible_change",
  "blocked",
  "error",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
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

function extractLayoutHtml(layoutJson: Record<string, unknown>) {
  return typeof layoutJson.html === "string" && layoutJson.html.trim() ? layoutJson.html : null
}

function ensureChangeSummary(value: unknown) {
  if (!isRecord(value)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  const layoutChanged = value.layout_changed === true
  const styleChanged = value.style_changed === true
  const htmlChanged = value.html_changed === true
  const textChanged = value.text_changed === true

  return {
    layout_changed: layoutChanged,
    style_changed: styleChanged,
    html_changed: htmlChanged,
    ...(textChanged ? { text_changed: true } : {}),
  } satisfies AdminAiPageEditorChangeSummary
}

function ensureOperationalFields(value: Record<string, unknown>) {
  if (!VALID_FINAL_STATUSES.includes(value.final_status as AdminAiPageEditorFinalStatus)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (typeof value.change_detected !== "boolean" || typeof value.draft_saved !== "boolean" || typeof value.preview_available !== "boolean") {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return {
    final_status: value.final_status as AdminAiPageEditorFinalStatus,
    change_detected: value.change_detected,
    draft_saved: value.draft_saved,
    preview_available: value.preview_available,
    change_summary: ensureChangeSummary(value.change_summary),
  }
}

export function normalizeAdminAiPageEditorError(error: unknown) {
  if (
    error instanceof Error &&
    (/proposal is not defined/i.test(error.message) || /resposta incompleta do servidor/i.test(error.message))
  ) {
    return new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return error instanceof Error ? error : new Error("Nao foi possivel gerar a proposta.")
}

export function detectManagedPageOperationDiff(
  base: ManagedPageComparableState,
  next: ManagedPageComparableState,
): ManagedPageDiffSummary {
  const layout_changed = stableSerialize(base.layout_json) !== stableSerialize(next.layout_json)
  const style_changed = stableSerialize(base.style_json) !== stableSerialize(next.style_json)
  const title_changed = normalizeComparableText(base.title) !== normalizeComparableText(next.title)
  const baseHtml = extractLayoutHtml(base.layout_json) ?? base.html ?? ""
  const nextHtml = extractLayoutHtml(next.layout_json) ?? next.html ?? ""
  const html_changed =
    Boolean(baseHtml || nextHtml) && normalizeComparableHtml(baseHtml) !== normalizeComparableHtml(nextHtml)

  return {
    layout_changed,
    style_changed,
    html_changed,
    title_changed,
    change_detected: layout_changed || style_changed || html_changed || title_changed,
  }
}

export function ensureAdminAiPageEditorProposalResponse(value: unknown): GenerateProposalResponse {
  if (!isRecord(value)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (!hasNonEmptyString(value.provider_used) || !hasNonEmptyString(value.summary) || !hasNonEmptyString(value.explanation)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (!Array.isArray(value.warnings) || !isRecord(value.edit_plan) || !isRecord(value.proposal)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  const proposal = value.proposal
  if (
    !hasNonEmptyString(proposal.slug) ||
    !hasNonEmptyString(proposal.title) ||
    !isRecord(proposal.layout_json) ||
    !isRecord(proposal.style_json) ||
    !isRecord(proposal.metadata)
  ) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return {
    ...(value as Omit<GenerateProposalResponse, "final_status" | "change_detected" | "draft_saved" | "preview_available" | "change_summary">),
    ...ensureOperationalFields(value),
  }
}

export function ensureAdminAiHeaderCopyProposalResponse(value: unknown): AdminAiHeaderCopyProposal {
  if (!isRecord(value) || !hasNonEmptyString(value.header_announcement)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  const base = ensureGlobalCopyResponse(value)
  return {
    ...base,
    header_announcement: String(value.header_announcement).trim(),
  }
}

export function ensureAdminAiFooterCopyProposalResponse(value: unknown): AdminAiFooterCopyProposal {
  if (!isRecord(value) || !hasNonEmptyString(value.footer_description)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  const base = ensureGlobalCopyResponse(value)
  return {
    ...base,
    footer_description: String(value.footer_description).trim(),
  }
}

function ensureGlobalCopyResponse(value: Record<string, unknown>): GlobalCopyResponse {
  if (!hasNonEmptyString(value.provider_used) || !hasNonEmptyString(value.summary) || !hasNonEmptyString(value.explanation) || !Array.isArray(value.warnings)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return {
    ...(value as Omit<GlobalCopyResponse, "final_status" | "change_detected" | "draft_saved" | "preview_available" | "change_summary">),
    ...ensureOperationalFields(value),
  }
}
