export type AiConversationPhase =
  | "understanding"
  | "needs_clarification"
  | "awaiting_intent_confirmation"
  | "ready_for_proposal"

export interface AiConversationContextMessage {
  role: "user" | "assistant"
  text: string
}

export interface AiConversationPendingImageInsert {
  target_source: "capture"
  target_page: string
  target_slug: string | null
  target_hint: "selected_area"
  capture_attachment_id: string
  capture_attachment_name?: string | null
  image_asset_attachment_id?: string | null
  image_asset_url?: string | null
  status: "waiting_for_image_asset" | "awaiting_confirmation"
}

export interface AiConversationContextInput {
  phase?: string | null
  understanding_summary?: string | null
  clarification_questions_count?: number | null
  quick_reply_selected?: string | null
  confirmation_token?: string | null
  recent_messages?: AiConversationContextMessage[] | null
  pending_image_insert?: AiConversationPendingImageInsert | null
}

export interface AiConversationContext {
  phase: AiConversationPhase | null
  understanding_summary: string | null
  clarification_questions_count: number
  quick_reply_selected: string | null
  confirmation_token: string | null
  recent_messages: AiConversationContextMessage[]
  pending_image_insert: AiConversationPendingImageInsert | null
}

const FORBIDDEN_TERMS: Array<[RegExp, string]> = [
  [/\bpadding\b/gi, "espaco"],
  [/\bmargin\b/gi, "espaco"],
  [/\bwrapper\b/gi, "bloco"],
  [/\blayout\b/gi, "estrutura"],
  [/\bpatch\b/gi, "ajuste"],
  [/\bproposal\b/gi, "ajuste"],
  [/\binvariants\b/gi, "regras de seguranca"],
  [/\bedit_plan\b/gi, "plano interno"],
  [/\bcss\b/gi, "estilo"],
  [/\bdom\b/gi, "pagina"],
  [/\btarget resolution\b/gi, "identificacao do alvo"],
]

const AFFIRMATIVE_PATTERNS = [
  /^sim(?:[,!. ]|$)/,
  /^e isso(?:[,!. ]|$)/,
  /^isso(?:[,!. ]|$)/,
  /^certo(?:[,!. ]|$)/,
  /^perfeito(?:[,!. ]|$)/,
  /^exatamente(?:[,!. ]|$)/,
]

const NEGATIVE_PATTERNS = [/^nao(?:[,!. ]|$)/, /quero explicar melhor/, /ainda nao/]

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeComparableText(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function isConversationPhase(value: string): value is AiConversationPhase {
  return (
    value === "understanding" ||
    value === "needs_clarification" ||
    value === "awaiting_intent_confirmation" ||
    value === "ready_for_proposal"
  )
}

function normalizeRecentMessages(value: unknown): AiConversationContextMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null
      const text = normalizeText(record.text)
      if (!role || !text) return null
      return { role, text } satisfies AiConversationContextMessage
    })
    .filter((item): item is AiConversationContextMessage => Boolean(item))
    .slice(-6)
}

function normalizePendingImageInsert(value: unknown): AiConversationPendingImageInsert | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const targetSource = normalizeText(record.target_source)
  const targetHint = normalizeText(record.target_hint)
  const status = normalizeText(record.status)
  const targetPage = normalizeText(record.target_page)
  const captureAttachmentId = normalizeText(record.capture_attachment_id)

  if (
    targetSource !== "capture" ||
    targetHint !== "selected_area" ||
    (status !== "waiting_for_image_asset" && status !== "awaiting_confirmation") ||
    !targetPage ||
    !captureAttachmentId
  ) {
    return null
  }

  return {
    target_source: "capture",
    target_page: targetPage,
    target_slug: normalizeText(record.target_slug) || null,
    target_hint: "selected_area",
    capture_attachment_id: captureAttachmentId,
    capture_attachment_name: normalizeText(record.capture_attachment_name) || null,
    image_asset_attachment_id: normalizeText(record.image_asset_attachment_id) || null,
    image_asset_url: normalizeText(record.image_asset_url) || null,
    status,
  }
}

export function normalizeConversationContext(value: unknown): AiConversationContext {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  const phase = normalizeText(record.phase)
  const clarificationCount = Number(record.clarification_questions_count ?? 0)

  return {
    phase: isConversationPhase(phase) ? phase : null,
    understanding_summary: normalizeText(record.understanding_summary) || null,
    clarification_questions_count: Number.isFinite(clarificationCount)
      ? Math.max(0, Math.min(3, Math.round(clarificationCount)))
      : 0,
    quick_reply_selected: normalizeText(record.quick_reply_selected) || null,
    confirmation_token: normalizeText(record.confirmation_token) || null,
    recent_messages: normalizeRecentMessages(record.recent_messages),
    pending_image_insert: normalizePendingImageInsert(record.pending_image_insert),
  }
}

export function sanitizeConversationText(text: string) {
  return FORBIDDEN_TERMS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text)
    .replace(/\bno pagina\b/gi, "na pagina")
    .replace(/\bdo pagina\b/gi, "da pagina")
    .replace(/\bno estrutura\b/gi, "na estrutura")
    .replace(/\bdo estrutura\b/gi, "da estrutura")
    .trim()
}

export function sanitizeConversationReplies(replies: string[]) {
  return replies.map((reply) => sanitizeConversationText(reply)).filter(Boolean).slice(0, 4)
}

export function buildUnderstandingConfirmationToken(summary: string | null | undefined) {
  const normalized = normalizeComparableText(summary)
  if (!normalized) return null

  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `intent_${(hash >>> 0).toString(16)}`
}

export function matchesUnderstandingConfirmationToken(summary: string | null | undefined, token: string | null | undefined) {
  const normalizedToken = normalizeText(token)
  if (!normalizedToken) return false
  const expected = buildUnderstandingConfirmationToken(summary)
  return Boolean(expected && expected === normalizedToken)
}

function stripLeadingConfirmation(text: string) {
  return normalizeComparableText(text).replace(/^(sim|e isso|isso|certo|perfeito|exatamente)[,!. ]*/, "").trim()
}

export function isExplicitUnderstandingConfirmation(message: string, phase: AiConversationPhase | null) {
  if (phase !== "awaiting_intent_confirmation") return false
  const normalized = normalizeComparableText(message)
  if (!normalized) return false
  if (!AFFIRMATIVE_PATTERNS.some((pattern) => pattern.test(normalized))) return false
  return stripLeadingConfirmation(normalized).length <= 18
}

export function isExplicitUnderstandingRejection(message: string, phase: AiConversationPhase | null) {
  if (phase !== "awaiting_intent_confirmation") return false
  const normalized = normalizeComparableText(message)
  if (!normalized) return false
  return NEGATIVE_PATTERNS.some((pattern) => pattern.test(normalized))
}
