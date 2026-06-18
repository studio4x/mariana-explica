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

export interface AiEditorCaptureViewport {
  width: number
  height: number
  scrollX: number
  scrollY: number
  devicePixelRatio: number
}

export interface AiEditorSelectionRect {
  x: number
  y: number
  width: number
  height: number
  pageX: number
  pageY: number
}

export interface AiEditorDomCandidate {
  candidateId: string
  tagName: string
  safeSelector?: string
  domPath?: string
  managedNodeId?: string
  blockId?: string
  componentId?: string
  role?: string
  classNames: string[]
  idAttribute?: string
  textContent?: string
  normalizedText?: string
  textFingerprint?: string
  rect: {
    x: number
    y: number
    width: number
    height: number
    top: number
    left: number
    right: number
    bottom: number
  }
  intersectsSelection: boolean
  intersectionRatio: number
  isTextBearing: boolean
  isHeading: boolean
  isButton: boolean
  isImage: boolean
  isEditableManagedContent: boolean
  computedStyle?: {
    color?: string
    backgroundColor?: string
    fontSize?: string
    fontWeight?: string
    textAlign?: string
    display?: string
  }
  parentContext?: {
    tagName?: string
    classNames?: string[]
    textSnippet?: string
    managedNodeId?: string
    blockId?: string
  }
  confidence: number
  source: "elementsFromPoint" | "rect_intersection" | "text_node"
}

export interface AiEditorTargetCapture {
  id: string
  role: "target_capture"
  pathname: string
  capturedAt: string
  viewport: AiEditorCaptureViewport
  selectionRect: AiEditorSelectionRect
  screenshot?: {
    attachmentId?: string
    mimeType?: string
    width?: number
    height?: number
  }
  domCandidates: AiEditorDomCandidate[]
  primaryCandidate?: AiEditorDomCandidate
  textFragments: string[]
  captureDiagnostics: {
    elementCount: number
    textCandidateCount: number
    primaryCandidateConfidence: number
    source: "live_dom_selection"
  }
}

export interface AiConversationPendingTargetClarification {
  requestedAt: string
  intent: "set_text_color" | "set_style" | "replace_image" | "other"
  textAnchor?: string | null
  requestedProperty?: string | null
  requestedValue?: string | null
  awaiting: "capture" | "context_text" | "selection_confirmation"
  capturedTarget?: AiEditorTargetCapture | null
}

export interface AiConversationContextInput {
  phase?: string | null
  understanding_summary?: string | null
  clarification_questions_count?: number | null
  quick_reply_selected?: string | null
  confirmation_token?: string | null
  recent_messages?: AiConversationContextMessage[] | null
  pending_image_insert?: AiConversationPendingImageInsert | null
  pending_target_clarification?: AiConversationPendingTargetClarification | null
}

export interface AiConversationContext {
  phase: AiConversationPhase | null
  understanding_summary: string | null
  clarification_questions_count: number
  quick_reply_selected: string | null
  confirmation_token: string | null
  recent_messages: AiConversationContextMessage[]
  pending_image_insert: AiConversationPendingImageInsert | null
  pending_target_clarification: AiConversationPendingTargetClarification | null
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

function normalizeFiniteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => normalizeText(item)).filter(Boolean)
}

function normalizeTargetCaptureCandidate(value: unknown): AiEditorDomCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const candidateId = normalizeText(record.candidateId)
  const tagName = normalizeText(record.tagName)
  const source = normalizeText(record.source)
  const rect = record.rect && typeof record.rect === "object" && !Array.isArray(record.rect)
    ? (record.rect as Record<string, unknown>)
    : null

  if (
    !candidateId ||
    !tagName ||
    !rect ||
    (source !== "elementsFromPoint" && source !== "rect_intersection" && source !== "text_node")
  ) {
    return null
  }

  return {
    candidateId,
    tagName,
    safeSelector: normalizeText(record.safeSelector) || undefined,
    domPath: normalizeText(record.domPath) || undefined,
    managedNodeId: normalizeText(record.managedNodeId) || undefined,
    blockId: normalizeText(record.blockId) || undefined,
    componentId: normalizeText(record.componentId) || undefined,
    role: normalizeText(record.role) || undefined,
    classNames: normalizeStringArray(record.classNames),
    idAttribute: normalizeText(record.idAttribute) || undefined,
    textContent: normalizeText(record.textContent) || undefined,
    normalizedText: normalizeText(record.normalizedText) || undefined,
    textFingerprint: normalizeText(record.textFingerprint) || undefined,
    rect: {
      x: normalizeFiniteNumber(rect.x),
      y: normalizeFiniteNumber(rect.y),
      width: normalizeFiniteNumber(rect.width),
      height: normalizeFiniteNumber(rect.height),
      top: normalizeFiniteNumber(rect.top),
      left: normalizeFiniteNumber(rect.left),
      right: normalizeFiniteNumber(rect.right),
      bottom: normalizeFiniteNumber(rect.bottom),
    },
    intersectsSelection: record.intersectsSelection === true,
    intersectionRatio: normalizeFiniteNumber(record.intersectionRatio),
    isTextBearing: record.isTextBearing === true,
    isHeading: record.isHeading === true,
    isButton: record.isButton === true,
    isImage: record.isImage === true,
    isEditableManagedContent: record.isEditableManagedContent === true,
    computedStyle:
      record.computedStyle && typeof record.computedStyle === "object" && !Array.isArray(record.computedStyle)
        ? {
            color: normalizeText((record.computedStyle as Record<string, unknown>).color) || undefined,
            backgroundColor: normalizeText((record.computedStyle as Record<string, unknown>).backgroundColor) || undefined,
            fontSize: normalizeText((record.computedStyle as Record<string, unknown>).fontSize) || undefined,
            fontWeight: normalizeText((record.computedStyle as Record<string, unknown>).fontWeight) || undefined,
            textAlign: normalizeText((record.computedStyle as Record<string, unknown>).textAlign) || undefined,
            display: normalizeText((record.computedStyle as Record<string, unknown>).display) || undefined,
          }
        : undefined,
    parentContext:
      record.parentContext && typeof record.parentContext === "object" && !Array.isArray(record.parentContext)
        ? {
            tagName: normalizeText((record.parentContext as Record<string, unknown>).tagName) || undefined,
            classNames: normalizeStringArray((record.parentContext as Record<string, unknown>).classNames),
            textSnippet: normalizeText((record.parentContext as Record<string, unknown>).textSnippet) || undefined,
            managedNodeId: normalizeText((record.parentContext as Record<string, unknown>).managedNodeId) || undefined,
            blockId: normalizeText((record.parentContext as Record<string, unknown>).blockId) || undefined,
          }
        : undefined,
    confidence: normalizeFiniteNumber(record.confidence),
    source,
  }
}

function normalizeTargetCapture(value: unknown): AiEditorTargetCapture | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = normalizeText(record.id)
  const pathname = normalizeText(record.pathname)
  const capturedAt = normalizeText(record.capturedAt)
  const role = normalizeText(record.role)
  const viewport = record.viewport && typeof record.viewport === "object" && !Array.isArray(record.viewport)
    ? (record.viewport as Record<string, unknown>)
    : null
  const selectionRect =
    record.selectionRect && typeof record.selectionRect === "object" && !Array.isArray(record.selectionRect)
      ? (record.selectionRect as Record<string, unknown>)
      : null

  if (!id || !pathname || !capturedAt || role !== "target_capture" || !viewport || !selectionRect) {
    return null
  }

  const domCandidates = Array.isArray(record.domCandidates)
    ? record.domCandidates
        .map((item) => normalizeTargetCaptureCandidate(item))
        .filter((item): item is AiEditorDomCandidate => Boolean(item))
        .slice(0, 48)
    : []
  const primaryCandidate = normalizeTargetCaptureCandidate(record.primaryCandidate)
  const captureDiagnostics =
    record.captureDiagnostics && typeof record.captureDiagnostics === "object" && !Array.isArray(record.captureDiagnostics)
      ? (record.captureDiagnostics as Record<string, unknown>)
      : null

  return {
    id,
    role: "target_capture",
    pathname,
    capturedAt,
    viewport: {
      width: normalizeFiniteNumber(viewport.width),
      height: normalizeFiniteNumber(viewport.height),
      scrollX: normalizeFiniteNumber(viewport.scrollX),
      scrollY: normalizeFiniteNumber(viewport.scrollY),
      devicePixelRatio: normalizeFiniteNumber(viewport.devicePixelRatio),
    },
    selectionRect: {
      x: normalizeFiniteNumber(selectionRect.x),
      y: normalizeFiniteNumber(selectionRect.y),
      width: normalizeFiniteNumber(selectionRect.width),
      height: normalizeFiniteNumber(selectionRect.height),
      pageX: normalizeFiniteNumber(selectionRect.pageX),
      pageY: normalizeFiniteNumber(selectionRect.pageY),
    },
    screenshot:
      record.screenshot && typeof record.screenshot === "object" && !Array.isArray(record.screenshot)
        ? {
            attachmentId: normalizeText((record.screenshot as Record<string, unknown>).attachmentId) || undefined,
            mimeType: normalizeText((record.screenshot as Record<string, unknown>).mimeType) || undefined,
            width: normalizeFiniteNumber((record.screenshot as Record<string, unknown>).width) || undefined,
            height: normalizeFiniteNumber((record.screenshot as Record<string, unknown>).height) || undefined,
          }
        : undefined,
    domCandidates,
    primaryCandidate: primaryCandidate ?? undefined,
    textFragments: normalizeStringArray(record.textFragments).slice(0, 12),
    captureDiagnostics: {
      elementCount: captureDiagnostics ? normalizeFiniteNumber(captureDiagnostics.elementCount) : domCandidates.length,
      textCandidateCount: captureDiagnostics ? normalizeFiniteNumber(captureDiagnostics.textCandidateCount) : domCandidates.filter((item) => item.isTextBearing).length,
      primaryCandidateConfidence: captureDiagnostics ? normalizeFiniteNumber(captureDiagnostics.primaryCandidateConfidence) : primaryCandidate?.confidence ?? 0,
      source: "live_dom_selection",
    },
  }
}

function normalizePendingTargetClarification(value: unknown): AiConversationPendingTargetClarification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const requestedAt = normalizeText(record.requestedAt)
  const intent = normalizeText(record.intent)
  const awaiting = normalizeText(record.awaiting)

  if (
    !requestedAt ||
    !["set_text_color", "set_style", "replace_image", "other"].includes(intent) ||
    !["capture", "context_text", "selection_confirmation"].includes(awaiting)
  ) {
    return null
  }

  return {
    requestedAt,
    intent: intent as AiConversationPendingTargetClarification["intent"],
    textAnchor: normalizeText(record.textAnchor) || null,
    requestedProperty: normalizeText(record.requestedProperty) || null,
    requestedValue: normalizeText(record.requestedValue) || null,
    awaiting: awaiting as AiConversationPendingTargetClarification["awaiting"],
    capturedTarget: normalizeTargetCapture(record.capturedTarget),
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
    pending_target_clarification: normalizePendingTargetClarification(record.pending_target_clarification),
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
