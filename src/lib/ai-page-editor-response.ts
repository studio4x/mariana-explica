import type {
  AdminAiPageEditorConversationResponse,
  AdminAiFooterCopyProposal,
  AdminAiHeaderCopyProposal,
  AdminAiPageEditorChangeSummary,
  AdminAiPageEditorFinalStatus,
  AdminAiPageEditorProposal,
} from "@/types/app.types"

type GenerateProposalResponse = {
  success: true
  request_id?: string
  client_request_id?: string | null
  provider_used: AdminAiPageEditorConversationResponse["provider_used"]
  conversation_phase: AdminAiPageEditorConversationResponse["conversation_phase"]
  assistant_message: string
  quick_replies: string[]
  understanding_summary: string | null
  confirmation_token?: string | null
  confirmation_consumed?: boolean
  pending_image_insert?: AdminAiPageEditorConversationResponse["pending_image_insert"]
  requires_user_confirmation: boolean
  can_generate_proposal: boolean
  warnings: string[]
  edit_plan?: AdminAiPageEditorProposal["edit_plan"]
  proposal?: AdminAiPageEditorProposal["proposal"]
  summary?: string
  explanation?: string
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

function ensureQuickReplies(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
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

export function ensureAdminAiPageEditorConversationResponse(value: unknown): GenerateProposalResponse {
  if (!isRecord(value)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (!hasNonEmptyString(value.provider_used) || !hasNonEmptyString(value.assistant_message)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (
    !hasNonEmptyString(value.conversation_phase) ||
    !Array.isArray(value.warnings) ||
    typeof value.requires_user_confirmation !== "boolean" ||
    typeof value.can_generate_proposal !== "boolean"
  ) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (value.can_generate_proposal) {
    if (!isRecord(value.edit_plan) || !isRecord(value.proposal) || !hasNonEmptyString(value.summary) || !hasNonEmptyString(value.explanation)) {
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
  }

  const operationalFields = ensureOperationalFields(value)
  const response: GenerateProposalResponse = {
    ...(value as Omit<
      GenerateProposalResponse,
      | "provider_used"
      | "conversation_phase"
      | "assistant_message"
      | "quick_replies"
      | "understanding_summary"
      | "requires_user_confirmation"
      | "can_generate_proposal"
      | "warnings"
      | "edit_plan"
      | "proposal"
      | "summary"
      | "explanation"
      | "final_status"
      | "change_detected"
      | "draft_saved"
      | "preview_available"
      | "change_summary"
    >),
    ...operationalFields,
    provider_used: value.provider_used as GenerateProposalResponse["provider_used"],
    conversation_phase: String(value.conversation_phase).trim() as GenerateProposalResponse["conversation_phase"],
    assistant_message: String(value.assistant_message).trim(),
    quick_replies: ensureQuickReplies(value.quick_replies),
    understanding_summary: hasNonEmptyString(value.understanding_summary) ? String(value.understanding_summary).trim() : null,
    ...(hasNonEmptyString(value.request_id) ? { request_id: String(value.request_id).trim() } : {}),
    ...(value.client_request_id === null || hasNonEmptyString(value.client_request_id)
      ? { client_request_id: value.client_request_id === null ? null : String(value.client_request_id).trim() }
      : {}),
    ...(value.confirmation_token === null || hasNonEmptyString(value.confirmation_token)
      ? { confirmation_token: value.confirmation_token === null ? null : String(value.confirmation_token).trim() }
      : {}),
    ...(typeof value.confirmation_consumed === "boolean"
      ? { confirmation_consumed: value.confirmation_consumed }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(value, "pending_image_insert")
      ? {
          pending_image_insert:
            value.pending_image_insert && typeof value.pending_image_insert === "object"
              ? (value.pending_image_insert as AdminAiPageEditorConversationResponse["pending_image_insert"])
              : null,
        }
      : {}),
    requires_user_confirmation: value.requires_user_confirmation,
    can_generate_proposal: value.can_generate_proposal,
    warnings: value.warnings as string[],
  }

  if (isRecord(value.edit_plan)) {
    response.edit_plan = value.edit_plan as unknown as AdminAiPageEditorProposal["edit_plan"]
  }

  if (isRecord(value.proposal)) {
    response.proposal = value.proposal as unknown as AdminAiPageEditorProposal["proposal"]
  }

  if (hasNonEmptyString(value.summary)) {
    response.summary = String(value.summary).trim()
  }

  if (hasNonEmptyString(value.explanation)) {
    response.explanation = String(value.explanation).trim()
  }

  return response
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
