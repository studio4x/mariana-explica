export type AiConversationPhase =
  | "understanding"
  | "needs_clarification"
  | "awaiting_intent_confirmation"
  | "ready_for_proposal"

export interface AiConversationContextMessage {
  role: "user" | "assistant"
  text: string
}

export interface AiConversationContextInput {
  phase?: string | null
  understanding_summary?: string | null
  clarification_questions_count?: number | null
  quick_reply_selected?: string | null
  recent_messages?: AiConversationContextMessage[] | null
}

export interface AiConversationContext {
  phase: AiConversationPhase | null
  understanding_summary: string | null
  clarification_questions_count: number
  quick_reply_selected: string | null
  recent_messages: AiConversationContextMessage[]
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
    recent_messages: normalizeRecentMessages(record.recent_messages),
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
