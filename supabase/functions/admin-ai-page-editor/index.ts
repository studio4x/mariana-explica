import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden, unprocessable } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo, logWarn } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import {
  normalizeAiEditPlan,
  isKnownManagedSitePageSlug,
  type AiEditMode,
  type AiEditScope,
  type AiRiskLevel,
} from "./contract.ts"
import {
  applyPatchPlan,
  refineSpacingEditPlanForKnownWrappers,
  type PatchEngineBaseVersion,
} from "./patch-engine.ts"
import { materializeConfirmedIntentProposal } from "./confirmed-intent.ts"
import {
  extractPersistibleProposalInvariants,
  requirePersistiblePageEditorProposal,
} from "./proposal-guards.ts"
import {
  resolvePersistibleProposalOperationalState,
  resolveTextProposalOperationalState,
  type AiPageEditorChangeSummary,
  type AiPageEditorFinalStatus,
} from "./operational-state.ts"
import { isPathAllowedByPatterns, selectAiBaseVersion, toPatchEngineBaseVersion } from "./safety.ts"
import {
  isExplicitUnderstandingConfirmation,
  isExplicitUnderstandingRejection,
  buildUnderstandingConfirmationToken,
  matchesUnderstandingConfirmationToken,
  normalizeConversationContext,
  sanitizeConversationReplies,
  sanitizeConversationText,
  type AiConversationContext,
  type AiConversationPhase,
} from "./conversation.ts"

type Action =
  | "get_config"
  | "update_config"
  | "test_providers"
  | "generate_proposal"
  | "generate_header_copy"
  | "generate_footer_copy"
  | "get_usage_metrics"

interface AttachmentInput {
  name: string
  mime_type: string
  data_url: string
  size_bytes: number
}

interface Body {
  action: Action
  periodDays?: number
  slug?: string
  title?: string
  path?: string
  message?: string
  configValue?: Record<string, unknown>
  geminiApiKey?: string | null
  openaiApiKey?: string | null
  currentLayoutJson?: Record<string, unknown>
  currentStyleJson?: Record<string, unknown>
  currentHtml?: string
  currentHeaderText?: string
  currentFooterText?: string
  attachments?: AttachmentInput[]
  conversationContext?: Record<string, unknown>
  client_request_id?: string
}

const CONFIG_KEY = "ai_page_editor_config"
const GEMINI_SECRET_NAME = "mariana_explica_ai_gemini_api_key"
const OPENAI_SECRET_NAME = "mariana_explica_ai_openai_api_key"
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
const DEFAULT_AI_PAGE_EDITOR_BASE_PROMPT =
  "Atua como editora sênior da Mariana Explica. Faz sempre a menor alteração possível. Prioriza pedidos pontuais de texto e tipografia, incluindo frases citadas pelo utilizador. Se o pedido for tipográfico, altera apenas o estilo mínimo necessário e preserva layout, rotas, CTAs, estrutura, responsividade e segurança de conteúdo. Se o pedido for de texto, muda apenas o trecho solicitado e não reescreve a página. Responde apenas com JSON válido no formato do editor, com summary, explanation, warnings e proposal. Nunca inventes secções nem alteres áreas privadas; assinala em warnings qualquer pedido estrutural que deva ser evitado."
const MAX_PROMPT_LENGTH = 24_000
const DEFAULT_USAGE_PERIOD_DAYS = 30
const MAX_USAGE_PERIOD_DAYS = 365
const sitePageSelect = "id,slug,title,status,published_version_id,created_by,created_at,updated_at"
const sitePageVersionSelect = "id,page_id,version_number,status,layout_json,style_json,metadata,created_by,created_at"

type AiProvider = "gemini" | "openai"
type UsageAction = "generate_proposal" | "test_providers"

interface ModelPricing {
  input_per_million_usd: number
  output_per_million_usd: number
  source_label: string
}

interface UsageSnapshot {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

interface UsageEventRecord {
  action: UsageAction
  provider: AiProvider
  model: string
  user_id: string | null
  slug: string | null
  path: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number | null
  currency: "USD"
  request_id: string
  mode?: AiEditMode | null
  scope?: AiEditScope | null
  risk_level?: AiRiskLevel | null
  target_ids?: string[]
  requires_strict_confirmation?: boolean
  contract_version?: string | null
  invariants?: Record<string, unknown>
  metadata: Record<string, unknown>
}

const MODEL_PRICING_CATALOG: Record<AiProvider, Array<{ match: RegExp; pricing: ModelPricing }>> = {
  gemini: [
    {
      match: /^gemini-3\.5-flash(?:$|-)/i,
      pricing: {
        input_per_million_usd: 1.5,
        output_per_million_usd: 9,
        source_label: "Gemini 3.5 Flash Standard",
      },
    },
    {
      match: /^gemini-3\.1-flash-lite(?:$|-)/i,
      pricing: {
        input_per_million_usd: 0.25,
        output_per_million_usd: 1.5,
        source_label: "Gemini 3.1 Flash-Lite Standard",
      },
    },
    {
      match: /^gemini-2\.0-flash(?:$|-)/i,
      pricing: {
        input_per_million_usd: 0.1,
        output_per_million_usd: 0.4,
        source_label: "Gemini 2.0 Flash Standard",
      },
    },
    {
      match: /^gemini-2\.5-flash-lite(?:$|-)/i,
      pricing: {
        input_per_million_usd: 0.1,
        output_per_million_usd: 0.4,
        source_label: "Gemini 2.5 Flash-Lite Standard",
      },
    },
    {
      match: /^gemini-2\.5-flash(?:$|-)/i,
      pricing: {
        input_per_million_usd: 0.3,
        output_per_million_usd: 2.5,
        source_label: "Gemini 2.5 Flash Standard",
      },
    },
    {
      match: /^gemini-2\.5-pro(?:$|-)/i,
      pricing: {
        input_per_million_usd: 1.25,
        output_per_million_usd: 10,
        source_label: "Gemini 2.5 Pro Standard",
      },
    },
  ],
  openai: [
    {
      match: /^gpt-4\.1-mini(?:$|-)/i,
      pricing: {
        input_per_million_usd: 0.4,
        output_per_million_usd: 1.6,
        source_label: "GPT-4.1 mini",
      },
    },
    {
      match: /^gpt-4\.1(?:$|-)/i,
      pricing: {
        input_per_million_usd: 2,
        output_per_million_usd: 8,
        source_label: "GPT-4.1",
      },
    },
    {
      match: /^gpt-4o-mini(?:$|-)/i,
      pricing: {
        input_per_million_usd: 0.15,
        output_per_million_usd: 0.6,
        source_label: "GPT-4o mini",
      },
    },
  ],
}

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    explanation: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    edit_plan: {
      type: "object",
      additionalProperties: false,
      properties: {
        scope: {
          type: "string",
          enum: ["text", "block", "section", "page", "header", "footer"],
        },
        mode: {
          type: "string",
          enum: ["text_patch", "style_patch", "spacing_patch", "section_layout_patch", "section_replace"],
        },
        target_ids: {
          type: "array",
          items: { type: "string" },
        },
        risk_level: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        requires_strict_confirmation: {
          type: "boolean",
        },
        operations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: [
                  "set_style",
                  "remove_style",
                  "update_text",
                  "move_node",
                  "replace_section",
                  "set_responsive_rule",
                  "wrap_children",
                  "unwrap_children",
                  "change_columns",
                ],
              },
              target_id: { type: "string" },
              path: { type: "string" },
              value: {
                type: ["string", "number", "boolean", "object", "array", "null"],
              },
              breakpoint: {
                type: "string",
                enum: ["mobile", "tablet", "desktop", "all"],
              },
            },
            required: ["type", "target_id"],
          },
        },
      },
      required: ["scope", "mode", "target_ids", "risk_level", "requires_strict_confirmation", "operations"],
    },
    proposal: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string" },
        title: { type: "string" },
        layout_json: {
          type: "string",
          description:
            "JSON serializado com a estrutura de layout. Deve incluir projectData.blocks, blocks no root ou html convertível.",
        },
        style_json: {
          type: "string",
          description: "JSON serializado com os estilos da página. Usa {} quando não houver estilos específicos.",
        },
        metadata: {
          type: "string",
          description: "JSON serializado com metadados adicionais. Usa {} quando não houver metadados.",
        },
      },
      required: ["slug", "title", "layout_json", "style_json", "metadata"],
    },
  },
  required: ["summary", "explanation", "warnings", "proposal"],
} as const

const footerCopySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    explanation: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    footer_description: { type: "string" },
  },
  required: ["summary", "explanation", "warnings", "footer_description"],
} as const

const headerCopySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    explanation: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    header_announcement: { type: "string" },
  },
  required: ["summary", "explanation", "warnings", "header_announcement"],
} as const

const understandingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    phase: {
      type: "string",
      enum: ["needs_clarification", "awaiting_intent_confirmation"],
    },
    classification: {
      type: "string",
      enum: ["clear", "ambiguous", "incomplete", "multiple_targets"],
    },
    assistant_message: { type: "string" },
    understanding_summary: { type: "string" },
    clarification_question: { type: ["string", "null"] },
    quick_replies: {
      type: "array",
      items: { type: "string" },
    },
    ambiguity_detected: { type: "boolean" },
  },
  required: [
    "phase",
    "classification",
    "assistant_message",
    "understanding_summary",
    "clarification_question",
    "quick_replies",
    "ambiguity_detected",
  ],
} as const

interface UnderstandingTurn {
  phase: "needs_clarification" | "awaiting_intent_confirmation"
  classification: "clear" | "ambiguous" | "incomplete" | "multiple_targets"
  assistant_message: string
  understanding_summary: string
  clarification_question: string | null
  quick_replies: string[]
  ambiguity_detected: boolean
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function createEmptyChangeSummary(): AiPageEditorChangeSummary {
  return {
    layout_changed: false,
    style_changed: false,
    html_changed: false,
  }
}

function createConversationOperationalState(phase: AiConversationPhase) {
  return {
    final_status: phase === "needs_clarification" ? "needs_clarification" : "awaiting_intent_confirmation",
    change_detected: false,
    draft_saved: false as const,
    preview_available: false as const,
    change_summary: createEmptyChangeSummary(),
  }
}

function createFriendlyConfirmedIntentFailureResponse(input: {
  requestId: string
  clientRequestId: string | null
  providerUsed: AiProvider
  understandingSummary: string | null
  assistantMessage: string
  warnings?: string[]
}) {
  return {
    success: true as const,
    request_id: input.requestId,
    client_request_id: input.clientRequestId,
    provider_used: input.providerUsed,
    conversation_phase: "ready_for_proposal" as const,
    assistant_message: input.assistantMessage,
    quick_replies: [] as string[],
    understanding_summary: input.understandingSummary,
    confirmation_token: null,
    confirmation_consumed: true,
    requires_user_confirmation: false,
    can_generate_proposal: false,
    warnings: input.warnings ?? [],
    final_status: "error" as const,
    change_detected: false,
    draft_saved: false as const,
    preview_available: false as const,
    change_summary: createEmptyChangeSummary(),
  }
}

function normalizeConversationReplies(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return sanitizeConversationReplies(
    value.map((item) => normalizeString(item)).filter(Boolean),
  )
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
}

function normalizeProvider(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "openai" ? "openai" : "gemini"
}

function normalizePeriodDays(value: unknown) {
  return Math.max(1, Math.min(MAX_USAGE_PERIOD_DAYS, Number(value ?? DEFAULT_USAGE_PERIOD_DAYS) || DEFAULT_USAGE_PERIOD_DAYS))
}

function normalizeTokenCount(value: unknown) {
  return Math.max(0, Math.round(Number(value ?? 0) || 0))
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function getModelPricing(provider: AiProvider, model: string) {
  const normalizedModel = normalizeString(model).toLowerCase()
  return MODEL_PRICING_CATALOG[provider].find((entry) => entry.match.test(normalizedModel))?.pricing ?? null
}

function estimateUsageCostUsd(
  provider: AiProvider,
  model: string,
  usage: UsageSnapshot,
) {
  const pricing = getModelPricing(provider, model)
  if (!pricing) {
    return {
      estimated_cost_usd: null,
      pricing_source: null,
    }
  }

  const estimatedCostUsd =
    (usage.input_tokens / 1_000_000) * pricing.input_per_million_usd +
    (usage.output_tokens / 1_000_000) * pricing.output_per_million_usd

  return {
    estimated_cost_usd: roundUsd(estimatedCostUsd),
    pricing_source: pricing.source_label,
  }
}

function resolveUsageEventCostUsd(
  provider: AiProvider,
  model: string,
  usage: UsageSnapshot,
  storedEstimatedCostUsd: unknown,
) {
  if (storedEstimatedCostUsd !== null && storedEstimatedCostUsd !== undefined) {
    return roundUsd(Number(storedEstimatedCostUsd) || 0)
  }

  const pricing = estimateUsageCostUsd(provider, model, usage)
  return pricing.estimated_cost_usd
}

function normalizeConfigValue(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const allowedPaths = normalizeStringArray(value.allowed_paths)

  return {
    enabled: value.enabled === true,
    launcher_label: normalizeString(value.launcher_label, "Editar com IA"),
    allowed_paths: allowedPaths,
    primary_provider: normalizeProvider(value.primary_provider),
    fallback_provider: normalizeProvider(value.fallback_provider === "gemini" ? "gemini" : "openai"),
    gemini_model: normalizeString(value.gemini_model, DEFAULT_GEMINI_MODEL),
    openai_model: normalizeString(value.openai_model, DEFAULT_OPENAI_MODEL),
    max_attachments: Math.max(0, Math.min(6, Number(value.max_attachments ?? 2))),
    max_attachment_size_mb: Math.max(1, Math.min(20, Number(value.max_attachment_size_mb ?? 8))),
    base_prompt: normalizeString(value.base_prompt, ""),
    require_confirmation: value.require_confirmation !== false,
    panel_width: String(value.panel_width ?? "wide") === "compact" ? "compact" : "wide",
  }
}

function normalizeSecretStatus(geminiPresent: boolean, openaiPresent: boolean) {
  return {
    gemini_api_key_present: geminiPresent,
    openai_api_key_present: openaiPresent,
  }
}

function parseJsonFromString(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function fetchManagedBaseVersion(
  serviceClient: ReturnType<typeof createServiceClient>,
  slug: string,
) {
  const { data: page, error: pageError } = await serviceClient
    .from("site_pages")
    .select(sitePageSelect)
    .eq("slug", slug)
    .maybeSingle()

  if (pageError) throw pageError
  if (!page) {
    throw badRequest("Pagina nao encontrada")
  }

  const { data: versions, error: versionsError } = await serviceClient
    .from("site_page_versions")
    .select(sitePageVersionSelect)
    .eq("page_id", page.id)
    .order("version_number", { ascending: false })
    .limit(60)

  if (versionsError) throw versionsError

  const publishedVersion =
    page.published_version_id
      ? (versions ?? []).find((item) => item.id === page.published_version_id) ?? null
      : null
  const latestDraft = (versions ?? []).find((item) => item.status === "draft") ?? null
  const selectedBaseVersion = selectAiBaseVersion({
    latestDraft,
    publishedVersion,
  })
  const baseVersion = selectedBaseVersion.baseVersion

  if (!baseVersion) {
    throw unprocessable("Nao encontrei uma base_version segura para esta pagina.")
  }

  return {
    page,
    baseVersion: toPatchEngineBaseVersion(baseVersion),
    publishedVersion,
    latestDraft,
    baseVersionSource: selectedBaseVersion.source,
    degradedDraftBypassed: selectedBaseVersion.degradedDraftBypassed,
    baseVersionSelectionReason: selectedBaseVersion.reason,
  }
}

function normalizeJsonObjectField(value: unknown, fieldName: string, fallbackToEmptyObject = false) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === "string") {
    const parsed = parseJsonFromString(value)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }

    if (fieldName === "layout_json") {
      const trimmed = value.trim()
      if (trimmed.includes("<") && trimmed.includes(">")) {
        return { html: trimmed }
      }
    }

    if (!value.trim() && fallbackToEmptyObject) {
      return {}
    }

    throw unprocessable(`A proposta da IA devolveu ${fieldName} em formato inválido`)
  }

  if (fallbackToEmptyObject) {
    return {}
  }

  return null
}

function normalizeMessageForParsing(value: string) {
  return value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
}

function hasKeyword(value: string, keywords: string[]) {
  const normalized = value.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword))
}

function extractQuotedTextReplacement(message: string) {
  const normalized = normalizeMessageForParsing(message)
  const patterns = [
    /(?:altera(?:r)?|troca(?:r)?|substitu[ií](?:r)?|muda(?:r)?)(?:\s+o\s+(?:texto|t[ií]tulo|conte[uú]do|copy|par[aá]grafo|headline|subt[ií]tulo|cta|bot[aã]o|bloco|trecho|frase))?\s+"([^"]+)"\s+(?:para|por)\s+"([^"]+)"/i,
    /(?:altera(?:r)?|troca(?:r)?|substitu[ií](?:r)?|muda(?:r)?)(?:\s+o\s+(?:texto|t[ií]tulo|conte[uú]do|copy|par[aá]grafo|headline|subt[ií]tulo|cta|bot[aã]o|bloco|trecho|frase))?\s+'([^']+)'\s+(?:para|por)\s+'([^']+)'/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue
    const from = normalizeString(match[1])
    const to = String(match[2] ?? "")
    if (from) {
      return { from, to }
    }
  }

  return null
}

function extractQuotedTextInsertion(message: string) {
  const normalized = normalizeMessageForParsing(message)
  const patterns = [
    /(?:insira|adicione|acrescente|coloque|inclua|introduza)\s+(?:um|uma|o|a)?\s+"([^"]+)"\s+(?:ao|no)\s+(final|fim|in[ií]cio|come[cç]o)\s+(?:do\s+)?texto\s+"([^"]+)"/i,
    /(?:insira|adicione|acrescente|coloque|inclua|introduza)\s+(?:um|uma|o|a)?\s+'([^']+)'\s+(?:ao|no)\s+(final|fim|in[ií]cio|come[cç]o)\s+(?:do\s+)?texto\s+'([^']+)'/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue

    const insertion = normalizeString(match[1])
    const position = normalizeString(match[2]).toLowerCase()
    const target = normalizeString(match[3])
    if (!insertion || !target) continue

    const to = position === "inicio" || position === "início" || position === "comeco" || position === "começo"
      ? `${insertion}${target}`
      : `${target}${insertion}`

    return { from: target, to }
  }

  return null
}

function extractTextEditReplacement(message: string) {
  return extractQuotedTextReplacement(message) ?? extractQuotedTextInsertion(message)
}

function extractQuotedTypographyTarget(message: string) {
  const normalized = normalizeMessageForParsing(message)
  const targetPatterns = [
    /(?:frase|texto|trecho|palavra|par[aá]grafo|t[ií]tulo|headline|copy)\s+"([^"]+)"/i,
    /(?:frase|texto|trecho|palavra|par[aá]grafo|t[ií]tulo|headline|copy)\s+'([^']+)'/i,
    /(?:frase|texto|trecho|palavra|par[aá]grafo|t[ií]tulo|headline|copy)\s*:\s*["']?(.+?)\s+(?:para|com|em)\s+(?:fonte|font-size|font size|tamanho da fonte|tamanho|peso|line-height|line height|letter-spacing)\b/i,
    /(?:frase|texto|trecho|palavra|par[aá]grafo|t[ií]tulo|headline|copy)\s*:\s*["']?(.+?)\s+para\s+[0-9.]+(?:px|rem|em|%)?\b/i,
  ]

  for (const pattern of targetPatterns) {
    const match = normalized.match(pattern)
    const value = normalizeString(match?.[1]).replace(/^["']+|["']+$/g, "").trim()
    if (value) return value
  }

  const anyQuotePatterns = [/"([^"]+)"/, /'([^']+)'/]
  for (const pattern of anyQuotePatterns) {
    const match = normalized.match(pattern)
    const value = normalizeString(match?.[1]).replace(/^["']+|["']+$/g, "").trim()
    if (value) return value
  }

  return null
}

function normalizeTypographyValue(property: string, value: string) {
  const trimmed = value.trim().replace(/[;,]+$/, "")
  if (!trimmed) return null

  if (property === "font-size" || property === "line-height") {
    return /^-?\d+(?:\.\d+)?(?:px|rem|em|%)?$/.test(trimmed) ? trimmed : null
  }

  if (property === "font-weight") {
    return /^(?:100|200|300|400|500|600|700|800|900|normal|bold|bolder|lighter)$/i.test(trimmed) ? trimmed : null
  }

  if (property === "font-family") {
    const sanitized = trimmed.replace(/["']/g, "").trim()
    return /^[a-zA-Z0-9,\s_-]+$/.test(sanitized) ? sanitized : null
  }

  if (property === "letter-spacing") {
    return /^-?\d+(?:\.\d+)?(?:px|rem|em)$/.test(trimmed) ? trimmed : null
  }

  if (property === "text-transform") {
    return /^(?:uppercase|lowercase|capitalize|none)$/i.test(trimmed) ? trimmed.toLowerCase() : null
  }

  return null
}

function extractTypographyDeclarations(message: string) {
  const normalized = normalizeMessageForParsing(message)
  const declarations = new Map<string, string>()
  const explicitPatterns: Array<{ property: string; pattern: RegExp }> = [
    { property: "font-size", pattern: /(?:font-size|font size|tamanho da fonte|tamanho)\s*[:=]?\s*([0-9.]+(?:px|rem|em|%)?)/i },
    { property: "font-weight", pattern: /(?:font-weight|font weight|fotn-weight|peso da fonte|peso)\s*[:=]?\s*((?:100|200|300|400|500|600|700|800|900)|normal|bold|bolder|lighter)/i },
    { property: "font-family", pattern: /(?:font-family|font family|fam[ií]lia da fonte)\s*[:=]?\s*([^\n;]+)/i },
    { property: "line-height", pattern: /(?:line-height|line height|entrelinha)\s*[:=]?\s*([0-9.]+(?:px|rem|em|%)?)/i },
    { property: "letter-spacing", pattern: /(?:letter-spacing|letter spacing)\s*[:=]?\s*(-?[0-9.]+(?:px|rem|em))/i },
    { property: "text-transform", pattern: /(?:text-transform)\s*[:=]?\s*(uppercase|lowercase|capitalize|none)/i },
  ]

  for (const entry of explicitPatterns) {
    const value = normalizeTypographyValue(entry.property, normalizeString(normalized.match(entry.pattern)?.[1]))
    if (value) {
      declarations.set(entry.property, value)
    }
  }

  if (!declarations.has("font-size")) {
    const inferredFontSizePatterns = [
      /(?:aumenta(?:r)?|aumente|deixa(?:r)?|deixe|coloca(?:r)?|coloque|mete|ponha|põe|ajusta(?:r)?|ajuste|passa(?:r)?)(?:\s+[^\n]{0,120}?)?\s+para\s*([0-9.]+(?:px|rem|em|%)?)/i,
      /(?:fonte|font-size|font size|tamanho da fonte|tamanho)\s*(?:em|para|com|de)?\s*([0-9.]+(?:px|rem|em|%)?)/i,
      /([0-9.]+(?:px|rem|em|%)?)\s*(?:de\s+fonte|de\s+font-size|de\s+tamanho)/i,
    ]

    const mentionsTypographyScale = /(?:fonte|font-size|font size|tamanho da fonte|tamanho|tipografia)\b/i.test(normalized)
    if (mentionsTypographyScale) {
      for (const pattern of inferredFontSizePatterns) {
        const inferredValue = normalizeTypographyValue("font-size", normalizeString(normalized.match(pattern)?.[1]))
        if (inferredValue) {
          declarations.set("font-size", inferredValue)
          break
        }
      }
    }
  }

  if (!declarations.has("text-transform")) {
    if (/\bcaixa alta\b/i.test(normalized) || /\buppercase\b/i.test(normalized)) {
      declarations.set("text-transform", "uppercase")
    } else if (/\bcaixa baixa\b/i.test(normalized) || /\blowercase\b/i.test(normalized)) {
      declarations.set("text-transform", "lowercase")
    } else if (/\bcapitalize\b/i.test(normalized)) {
      declarations.set("text-transform", "capitalize")
    }
  }

  return Array.from(declarations.entries()).map(([property, value]) => ({ property, value }))
}

function hasTextContentEditRequest(message: string) {
  const normalized = normalizeMessageForParsing(message).toLowerCase()
  if (extractTextEditReplacement(message)) return true

  const textKeywords = [
    "texto",
    "frase",
    "palavra",
    "paragrafo",
    "parágrafo",
    "titulo",
    "título",
    "subtitulo",
    "subtítulo",
    "headline",
    "copy",
  ]
  const disallowedKeywords = [
    "layout",
    "estrutura",
    "grid",
    "coluna",
    "secao",
    "seção",
    "secção",
    "hero",
    "header",
    "footer",
    "imagem",
    "foto",
    "icone",
    "ícone",
    "video",
    "vÃ­deo",
  ]

  return hasKeyword(normalized, textKeywords) && !hasKeyword(normalized, disallowedKeywords)
}

function hasTypographyEditRequest(message: string) {
  const normalized = normalizeMessageForParsing(message).toLowerCase()
  return hasKeyword(normalized, [
    "tipografia",
    "fonte",
    "font",
    "font-size",
    "font size",
    "font-family",
    "font family",
    "font-weight",
    "fotn-weight",
    "font weight",
    "font-style",
    "font style",
    "line-height",
    "line height",
    "entrelinha",
    "letter-spacing",
    "letter spacing",
    "tamanho",
    "tamanho da fonte",
    "familia da fonte",
    "famÃ­lia da fonte",
    "peso",
    "peso da fonte",
    "caixa alta",
    "caixa baixa",
    "maiuscula",
    "maiÃºscula",
    "minuscula",
    "minÃºscula",
    "uppercase",
    "lowercase",
    "capitalize",
  ])
}

function requestExplicitlyMentionsStructuralLayout(message: string) {
  const normalized = normalizeMessageForParsing(message).toLowerCase()
  return hasKeyword(normalized, [
    "layout",
    "estrutura",
    "grid",
    "coluna",
    "secao",
    "seÃ§Ã£o",
    "secÃ§Ã£o",
    "hero",
    "header",
    "footer",
    "padding",
    "margin",
    "max-width",
    "min-width",
    "width",
    "height",
    "gap",
    "borda",
    "border",
    "border-radius",
    "background",
    "fundo",
    "reposicionar",
    "reorganizar",
    "mover bloco",
    "trocar secao",
    "trocar seÃ§Ã£o",
    "trocar secÃ§Ã£o",
  ])
}

function requestExplicitlyMentionsMediaOrLayout(message: string) {
  const normalized = normalizeMessageForParsing(message).toLowerCase()
  return hasKeyword(normalized, [
    "imagem",
    "foto",
    "media",
    "mídia",
    "video",
    "vídeo",
    "layout",
    "estrutura",
    "grid",
    "secao",
    "seção",
    "secção",
    "hero",
    "header",
    "footer",
    "cor",
    "fundo",
  ])
}

function extractBlocksFromLayoutJson(layoutJson: Record<string, unknown>) {
  const record = layoutJson && typeof layoutJson === "object" ? layoutJson : {}
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  if (Array.isArray(projectData?.blocks)) {
    return projectData.blocks
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>)
  }

  if (Array.isArray(record.blocks)) {
    return record.blocks
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>)
  }

  const htmlFromRecord = typeof record.html === "string" ? record.html.trim() : ""
  const htmlFromProjectData = projectData && typeof projectData.html === "string" ? String(projectData.html).trim() : ""
  const html = htmlFromRecord || htmlFromProjectData

  if (html) {
    return [buildFallbackRichTextBlock(html)]
  }

  return null
}

function withBlocksAppliedToLayoutJson(layoutJson: Record<string, unknown>, blocks: Record<string, unknown>[]) {
  const record = cloneJsonValue(layoutJson)
  const nextBlocks = cloneJsonValue(blocks)
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? ({ ...(record.projectData as Record<string, unknown>) } satisfies Record<string, unknown>)
      : {}

  projectData.blocks = nextBlocks
  record.projectData = projectData
  record.blocks = nextBlocks
  return record
}

function replaceAllText(source: string, from: string, to: string) {
  if (!from) return { value: source, replacements: 0 }
  const parts = source.split(from)
  if (parts.length <= 1) return { value: source, replacements: 0 }
  return {
    value: parts.join(to),
    replacements: parts.length - 1,
  }
}

function applyQuotedReplacementToBlock(
  block: Record<string, unknown>,
  replacement: { from: string; to: string },
): { block: Record<string, unknown>; replacements: number } {
  const type = normalizeString(block.type).toLowerCase()
  const nextBlock = cloneJsonValue(block)

  if (type === "rich_text" && typeof block.content === "string") {
    const updated = replaceAllText(block.content, replacement.from, replacement.to)
    nextBlock.content = updated.value
    return { block: nextBlock, replacements: updated.replacements }
  }

  if (type === "heading" && typeof block.content === "string") {
    const updated = replaceAllText(block.content, replacement.from, replacement.to)
    nextBlock.content = updated.value
    return { block: nextBlock, replacements: updated.replacements }
  }

  if (type === "button" && typeof block.label === "string") {
    const updated = replaceAllText(block.label, replacement.from, replacement.to)
    nextBlock.label = updated.value
    return { block: nextBlock, replacements: updated.replacements }
  }

  if (type === "columns" && Array.isArray(block.items)) {
    let replacements = 0
    nextBlock.items = block.items.map((item) => {
      const updated = replaceAllText(String(item ?? ""), replacement.from, replacement.to)
      replacements += updated.replacements
      return updated.value
    })
    return { block: nextBlock, replacements }
  }

  if (type === "container" && Array.isArray(block.children)) {
    let replacements = 0
    nextBlock.children = block.children.map((column) => {
      if (!Array.isArray(column)) return column
      return column.map((child) => {
        if (!child || typeof child !== "object" || Array.isArray(child)) return child
        const updated = applyQuotedReplacementToBlock(child as Record<string, unknown>, replacement)
        replacements += updated.replacements
        return updated.block
      })
    })
    return { block: nextBlock, replacements }
  }

  return { block: nextBlock, replacements: 0 }
}

function applyQuotedTextReplacementToLayout(
  currentLayoutJson: Record<string, unknown>,
  replacement: { from: string; to: string },
) {
  const currentBlocks = extractBlocksFromLayoutJson(currentLayoutJson)
  if (!currentBlocks || currentBlocks.length === 0) return null

  let replacements = 0
  const nextBlocks = currentBlocks.map((block) => {
    const updated = applyQuotedReplacementToBlock(block, replacement)
    replacements += updated.replacements
    return updated.block
  })

  if (replacements === 0) {
    return null
  }

  return withBlocksAppliedToLayoutJson(currentLayoutJson, nextBlocks)
}

function richTextIntroducesUnexpectedImage(currentContent: unknown, proposedContent: unknown) {
  const current = typeof currentContent === "string" ? currentContent.toLowerCase() : ""
  const proposed = typeof proposedContent === "string" ? proposedContent.toLowerCase() : ""
  if (!proposed.includes("<img")) return false
  if (current.includes("<img")) return false
  return proposed.includes("nova imagem") || proposed.includes("placeholder") || proposed.includes('src=""') || proposed.includes('src="#"')
}

function richTextLooksLikePartialFragment(currentContent: unknown, proposedContent: unknown) {
  const current = typeof currentContent === "string" ? currentContent : ""
  const proposed = typeof proposedContent === "string" ? proposedContent : ""
  const normalizedCurrent = normalizeTypographyTargetText(current)
  const normalizedProposed = normalizeTypographyTargetText(proposed)

  if (!normalizedCurrent || !normalizedProposed || normalizedCurrent === normalizedProposed) {
    return false
  }

  const currentLength = normalizedCurrent.length
  const proposedLength = normalizedProposed.length
  const currentSectionCount = (current.match(/<section\b/gi) ?? []).length + (current.match(/<article\b/gi) ?? []).length
  const proposedSectionCount = (proposed.match(/<section\b/gi) ?? []).length + (proposed.match(/<article\b/gi) ?? []).length

  if (normalizedCurrent.includes(normalizedProposed) && proposedLength < currentLength * 0.82) {
    return true
  }

  if (current.includes("data-me-page-canonical") && !proposed.includes("data-me-page-canonical") && proposedLength < currentLength * 0.9) {
    return true
  }

  if (currentSectionCount > 1 && proposedSectionCount > 0 && proposedSectionCount < currentSectionCount) {
    return true
  }

  return false
}

function collectHtmlTagCounts(content: string) {
  const tags = ["section", "article", "div", "header", "footer", "main", "aside", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "img", "span"]
  return Object.fromEntries(
    tags.map((tag) => [tag, (content.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length]),
  ) as Record<string, number>
}

function richTextPreservesStructuralFootprint(currentContent: unknown, proposedContent: unknown) {
  const current = typeof currentContent === "string" ? currentContent : ""
  const proposed = typeof proposedContent === "string" ? proposedContent : ""
  if (!current.trim() || !proposed.trim()) return false

  const currentHasCanonical = current.includes("data-me-page-canonical")
  const proposedHasCanonical = proposed.includes("data-me-page-canonical")
  if (currentHasCanonical !== proposedHasCanonical) {
    return false
  }

  const currentTags = collectHtmlTagCounts(current)
  const proposedTags = collectHtmlTagCounts(proposed)

  return Object.keys(currentTags).every((tag) => currentTags[tag] === proposedTags[tag])
}

function mergeTextOnlyBlocks(
  currentBlock: Record<string, unknown>,
  proposedBlock: Record<string, unknown>,
  allowMediaChanges: boolean,
): { valid: boolean; changed: number; block: Record<string, unknown> } {
  const currentType = normalizeString(currentBlock.type).toLowerCase()
  const proposedType = normalizeString(proposedBlock.type).toLowerCase()

  if (!currentType || currentType !== proposedType) {
    return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
  }

  const nextBlock = cloneJsonValue(currentBlock)

  if (currentType === "rich_text") {
    if (typeof proposedBlock.content === "string" && proposedBlock.content.trim()) {
      if (!allowMediaChanges && richTextIntroducesUnexpectedImage(currentBlock.content, proposedBlock.content)) {
        return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
      }

      if (richTextLooksLikePartialFragment(currentBlock.content, proposedBlock.content)) {
        return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
      }

      if (!richTextPreservesStructuralFootprint(currentBlock.content, proposedBlock.content)) {
        return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
      }

      const changed = proposedBlock.content !== currentBlock.content ? 1 : 0
      nextBlock.content = proposedBlock.content
      return { valid: true, changed, block: nextBlock }
    }

    return { valid: true, changed: 0, block: nextBlock }
  }

  if (currentType === "heading") {
    if (typeof proposedBlock.content === "string" && proposedBlock.content.trim()) {
      const changed = proposedBlock.content !== currentBlock.content ? 1 : 0
      nextBlock.content = proposedBlock.content
      return { valid: true, changed, block: nextBlock }
    }

    return { valid: true, changed: 0, block: nextBlock }
  }

  if (currentType === "button") {
    if (typeof proposedBlock.label === "string" && proposedBlock.label.trim()) {
      const changed = proposedBlock.label !== currentBlock.label ? 1 : 0
      nextBlock.label = proposedBlock.label
      return { valid: true, changed, block: nextBlock }
    }

    return { valid: true, changed: 0, block: nextBlock }
  }

  if (currentType === "columns") {
    const currentItems = Array.isArray(currentBlock.items) ? currentBlock.items : []
    const proposedItems = Array.isArray(proposedBlock.items) ? proposedBlock.items : []
    if (currentItems.length !== proposedItems.length) {
      return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
    }

    let changed = 0
    nextBlock.items = currentItems.map((item, index) => {
      const nextItem = typeof proposedItems[index] === "string" ? String(proposedItems[index]) : String(item ?? "")
      if (nextItem !== item) changed += 1
      return nextItem
    })
    return { valid: true, changed, block: nextBlock }
  }

  if (currentType === "container") {
    const currentChildren = Array.isArray(currentBlock.children) ? currentBlock.children : []
    const proposedChildren = Array.isArray(proposedBlock.children) ? proposedBlock.children : []
    if (currentChildren.length !== proposedChildren.length) {
      return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
    }

    let changed = 0
    const nextChildren = []
    for (let columnIndex = 0; columnIndex < currentChildren.length; columnIndex += 1) {
      const currentColumn = Array.isArray(currentChildren[columnIndex]) ? currentChildren[columnIndex] : []
      const proposedColumn = Array.isArray(proposedChildren[columnIndex]) ? proposedChildren[columnIndex] : []
      if (currentColumn.length !== proposedColumn.length) {
        return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
      }

      const nextColumn = []
      for (let blockIndex = 0; blockIndex < currentColumn.length; blockIndex += 1) {
        const childCurrent = currentColumn[blockIndex]
        const childProposed = proposedColumn[blockIndex]
        if (!childCurrent || typeof childCurrent !== "object" || Array.isArray(childCurrent)) {
          nextColumn.push(childCurrent)
          continue
        }
        if (!childProposed || typeof childProposed !== "object" || Array.isArray(childProposed)) {
          return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
        }

        const mergedChild = mergeTextOnlyBlocks(
          childCurrent as Record<string, unknown>,
          childProposed as Record<string, unknown>,
          allowMediaChanges,
        )
        if (!mergedChild.valid) {
          return { valid: false, changed: 0, block: cloneJsonValue(currentBlock) }
        }
        changed += mergedChild.changed
        nextColumn.push(mergedChild.block)
      }

      nextChildren.push(nextColumn)
    }

    nextBlock.children = nextChildren
    return { valid: true, changed, block: nextBlock }
  }

  return { valid: true, changed: 0, block: nextBlock }
}

function collectLocalizedTextChanges(
  currentBlock: Record<string, unknown>,
  proposedBlock: Record<string, unknown>,
  changes: string[],
): boolean {
  const currentType = normalizeString(currentBlock.type).toLowerCase()
  const proposedType = normalizeString(proposedBlock.type).toLowerCase()

  if (!currentType || currentType !== proposedType) {
    return false
  }

  if (currentType === "rich_text") {
    const currentContent = typeof currentBlock.content === "string" ? currentBlock.content : ""
    const proposedContent = typeof proposedBlock.content === "string" ? proposedBlock.content : ""
    if (proposedContent.trim() && currentContent !== proposedContent) {
      changes.push(`rich_text:${normalizeString(currentBlock.id) || crypto.randomUUID()}`)
    }
    return true
  }

  if (currentType === "heading") {
    const currentContent = typeof currentBlock.content === "string" ? currentBlock.content : ""
    const proposedContent = typeof proposedBlock.content === "string" ? proposedBlock.content : ""
    if (proposedContent.trim() && currentContent !== proposedContent) {
      changes.push(`heading:${normalizeString(currentBlock.id) || crypto.randomUUID()}`)
    }
    return true
  }

  if (currentType === "button") {
    const currentLabel = typeof currentBlock.label === "string" ? currentBlock.label : ""
    const proposedLabel = typeof proposedBlock.label === "string" ? proposedBlock.label : ""
    if (proposedLabel.trim() && currentLabel !== proposedLabel) {
      changes.push(`button:${normalizeString(currentBlock.id) || crypto.randomUUID()}`)
    }
    return true
  }

  if (currentType === "columns") {
    const currentItems = Array.isArray(currentBlock.items) ? currentBlock.items : []
    const proposedItems = Array.isArray(proposedBlock.items) ? proposedBlock.items : []
    if (currentItems.length !== proposedItems.length) return false

    for (let index = 0; index < currentItems.length; index += 1) {
      const currentItem = String(currentItems[index] ?? "")
      const proposedItem = String(proposedItems[index] ?? "")
      if (currentItem !== proposedItem) {
        changes.push(`columns:${normalizeString(currentBlock.id) || crypto.randomUUID()}:${index}`)
      }
    }
    return true
  }

  if (currentType === "container") {
    const currentChildren = Array.isArray(currentBlock.children) ? currentBlock.children : []
    const proposedChildren = Array.isArray(proposedBlock.children) ? proposedBlock.children : []
    if (currentChildren.length !== proposedChildren.length) return false

    for (let columnIndex = 0; columnIndex < currentChildren.length; columnIndex += 1) {
      const currentColumn = Array.isArray(currentChildren[columnIndex]) ? currentChildren[columnIndex] : []
      const proposedColumn = Array.isArray(proposedChildren[columnIndex]) ? proposedChildren[columnIndex] : []
      if (currentColumn.length !== proposedColumn.length) return false

      for (let blockIndex = 0; blockIndex < currentColumn.length; blockIndex += 1) {
        const childCurrent = currentColumn[blockIndex]
        const childProposed = proposedColumn[blockIndex]
        if (!childCurrent || typeof childCurrent !== "object" || Array.isArray(childCurrent)) continue
        if (!childProposed || typeof childProposed !== "object" || Array.isArray(childProposed)) return false
        if (!collectLocalizedTextChanges(childCurrent as Record<string, unknown>, childProposed as Record<string, unknown>, changes)) {
          return false
        }
      }
    }

    return true
  }

  return true
}

function proposalRepresentsLocalizedTextPatch(
  currentLayoutJson: Record<string, unknown>,
  proposedLayoutJson: Record<string, unknown>,
) {
  const currentBlocks = extractBlocksFromLayoutJson(currentLayoutJson)
  const proposedBlocks = extractBlocksFromLayoutJson(proposedLayoutJson)

  if (!currentBlocks || !proposedBlocks || currentBlocks.length !== proposedBlocks.length) {
    return false
  }

  const changes: string[] = []
  for (let index = 0; index < currentBlocks.length; index += 1) {
    if (!collectLocalizedTextChanges(currentBlocks[index], proposedBlocks[index], changes)) {
      return false
    }
  }

  return new Set(changes).size <= 1
}

function blockPreservesLayoutEnvelope(currentBlock: Record<string, unknown>, proposedBlock: Record<string, unknown>): boolean {
  const currentType = normalizeString(currentBlock.type).toLowerCase()
  const proposedType = normalizeString(proposedBlock.type).toLowerCase()

  if (!currentType || currentType !== proposedType) {
    return false
  }

  if (currentType === "rich_text") {
    return richTextPreservesStructuralFootprint(currentBlock.content, proposedBlock.content)
  }

  if (currentType === "columns") {
    const currentItems = Array.isArray(currentBlock.items) ? currentBlock.items : []
    const proposedItems = Array.isArray(proposedBlock.items) ? proposedBlock.items : []
    return currentItems.length === proposedItems.length
  }

  if (currentType === "container") {
    const currentChildren = Array.isArray(currentBlock.children) ? currentBlock.children : []
    const proposedChildren = Array.isArray(proposedBlock.children) ? proposedBlock.children : []
    if (currentChildren.length !== proposedChildren.length) return false

    for (let columnIndex = 0; columnIndex < currentChildren.length; columnIndex += 1) {
      const currentColumn = Array.isArray(currentChildren[columnIndex]) ? currentChildren[columnIndex] : []
      const proposedColumn = Array.isArray(proposedChildren[columnIndex]) ? proposedChildren[columnIndex] : []
      if (currentColumn.length !== proposedColumn.length) return false

      for (let blockIndex = 0; blockIndex < currentColumn.length; blockIndex += 1) {
        const currentChild = currentColumn[blockIndex]
        const proposedChild = proposedColumn[blockIndex]
        if (!currentChild || typeof currentChild !== "object" || Array.isArray(currentChild)) continue
        if (!proposedChild || typeof proposedChild !== "object" || Array.isArray(proposedChild)) return false
        if (!blockPreservesLayoutEnvelope(currentChild as Record<string, unknown>, proposedChild as Record<string, unknown>)) {
          return false
        }
      }
    }
  }

  return true
}

function proposalPreservesLayoutEnvelope(
  currentLayoutJson: Record<string, unknown>,
  proposedLayoutJson: Record<string, unknown>,
) {
  const currentBlocks = extractBlocksFromLayoutJson(currentLayoutJson)
  const proposedBlocks = extractBlocksFromLayoutJson(proposedLayoutJson)

  if (!currentBlocks || !proposedBlocks || currentBlocks.length !== proposedBlocks.length) {
    return false
  }

  for (let index = 0; index < currentBlocks.length; index += 1) {
    if (!blockPreservesLayoutEnvelope(currentBlocks[index], proposedBlocks[index])) {
      return false
    }
  }

  return true
}

function mergeTextOnlyProposalWithCurrentLayout(
  currentLayoutJson: Record<string, unknown>,
  proposedLayoutJson: Record<string, unknown>,
  allowMediaChanges: boolean,
) {
  const currentBlocks = extractBlocksFromLayoutJson(currentLayoutJson)
  const proposedBlocks = extractBlocksFromLayoutJson(proposedLayoutJson)

  if (!currentBlocks || !proposedBlocks || currentBlocks.length !== proposedBlocks.length) {
    return null
  }

  let changed = 0
  const nextBlocks = []
  for (let index = 0; index < currentBlocks.length; index += 1) {
    const merged = mergeTextOnlyBlocks(currentBlocks[index], proposedBlocks[index], allowMediaChanges)
    if (!merged.valid) {
      return null
    }
    changed += merged.changed
    nextBlocks.push(merged.block)
  }

  if (changed === 0) {
    return null
  }

  return withBlocksAppliedToLayoutJson(currentLayoutJson, nextBlocks)
}

const SAFE_TYPOGRAPHY_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "line-height",
  "text-align",
  "text-decoration",
  "text-transform",
])

function selectorIsSafeForTypographyRule(selector: string) {
  const normalized = selector.trim().toLowerCase()
  if (!normalized || normalized.startsWith("@")) return false
  if (normalized.includes("{") || normalized.includes("}")) return false
  return normalized.includes(".me-")
}

function declarationValueIsSafe(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false

  return !(
    normalized.includes("url(") ||
    normalized.includes("expression(") ||
    normalized.includes("@import") ||
    normalized.includes("javascript:") ||
    normalized.includes("</style")
  )
}

function sanitizeTypographyCss(css: string) {
  const safeRules: string[] = []
  let droppedRules = 0
  let droppedDeclarations = 0
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g

  for (const match of css.matchAll(rulePattern)) {
    const rawSelectors = String(match[1] ?? "")
    const rawDeclarations = String(match[2] ?? "")
    const selectors = rawSelectors
      .split(",")
      .map((selector) => selector.trim())
      .filter(selectorIsSafeForTypographyRule)

    if (selectors.length === 0) {
      droppedRules += 1
      continue
    }

    const declarations = rawDeclarations
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .flatMap((declaration) => {
        const colonIndex = declaration.indexOf(":")
        if (colonIndex <= 0) {
          droppedDeclarations += 1
          return []
        }

        const property = declaration.slice(0, colonIndex).trim().toLowerCase()
        const value = declaration.slice(colonIndex + 1).trim()
        if (!SAFE_TYPOGRAPHY_PROPERTIES.has(property) || !declarationValueIsSafe(value)) {
          droppedDeclarations += 1
          return []
        }

        return [`${property}: ${value}`]
      })

    if (declarations.length === 0) {
      droppedRules += 1
      continue
    }

    safeRules.push(`${selectors.join(", ")} {\n  ${declarations.join(";\n  ")};\n}`)
  }

  return {
    css: safeRules.join("\n\n"),
    droppedRules,
    droppedDeclarations,
  }
}

function mergeTypographyOnlyProposalWithCurrentStyles(
  currentStyleJson: Record<string, unknown>,
  proposedStyleJson: Record<string, unknown>,
) {
  const proposedCss = normalizeString(proposedStyleJson.css)
  if (!proposedCss) {
    return null
  }

  const sanitized = sanitizeTypographyCss(proposedCss)
  if (!sanitized.css.trim()) {
    return null
  }

  const nextStyleJson = cloneJsonValue(currentStyleJson)
  const currentCss = typeof nextStyleJson.css === "string" ? String(nextStyleJson.css).trim() : ""
  nextStyleJson.css = [currentCss, "/* Mariana AI: typography patch */", sanitized.css].filter(Boolean).join("\n\n")

  return {
    styleJson: nextStyleJson,
    warning:
      sanitized.droppedRules > 0 || sanitized.droppedDeclarations > 0
        ? "Aplicação protegida: apenas regras tipográficas seguras foram aproveitadas; qualquer trecho estrutural foi ignorado."
        : "Aplicação protegida: o layout atual foi preservado e apenas a tipografia pedida foi aplicada.",
  }
}

function appendCssPatchToStyleJson(styleJson: Record<string, unknown>, cssPatch: string) {
  const nextStyleJson = cloneJsonValue(styleJson)
  const currentCss = typeof nextStyleJson.css === "string" ? String(nextStyleJson.css).trim() : ""
  const patch = cssPatch.trim()
  nextStyleJson.css = [currentCss, patch].filter(Boolean).join("\n\n")
  return nextStyleJson
}

function addClassToTag(tagHtml: string, className: string) {
  if (!tagHtml.trim()) return tagHtml
  if (/\bclass\s*=/i.test(tagHtml)) {
    return tagHtml.replace(/\bclass\s*=\s*(['"])([^'"]*)\1/i, (_match, quote: string, classes: string) => {
      const nextClasses = `${classes} ${className}`.trim()
      return `class=${quote}${nextClasses}${quote}`
    })
  }

  return tagHtml.replace(/<([a-z0-9-]+)/i, `<$1 class="${className}"`)
}

function normalizeTypographyTargetText(value: string) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’‚‛‹›]/g, "'")
    .replace(/[.,!?;:()[\]{}]+/g, " ")
    .replace(/["']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function matchesTypographyTarget(content: string, targetPhrase: string) {
  if (!content.includes(targetPhrase)) {
    return normalizeTypographyTargetText(content).includes(normalizeTypographyTargetText(targetPhrase))
  }

  return true
}

function applyTypographyClassToHtmlContent(content: string, targetPhrase: string, className: string) {
  const tagPatterns = [
    /<p\b[^>]*>[\s\S]*?<\/p>/gi,
    /<li\b[^>]*>[\s\S]*?<\/li>/gi,
    /<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi,
    /<span\b[^>]*>[\s\S]*?<\/span>/gi,
    /<a\b[^>]*>[\s\S]*?<\/a>/gi,
    /<div\b[^>]*>[\s\S]*?<\/div>/gi,
    /<article\b[^>]*>[\s\S]*?<\/article>/gi,
    /<section\b[^>]*>[\s\S]*?<\/section>/gi,
  ]

  for (const pattern of tagPatterns) {
    const match = content.match(pattern)?.find((chunk) => matchesTypographyTarget(chunk, targetPhrase))
    if (!match) continue
    const openingTagMatch = match.match(/^<[^>]+>/)
    if (!openingTagMatch) continue
    const updatedChunk = `${addClassToTag(openingTagMatch[0], className)}${match.slice(openingTagMatch[0].length)}`
    return {
      content: content.replace(match, updatedChunk),
      matched: true,
    }
  }

  if (!content.includes(targetPhrase)) {
    return { content, matched: false }
  }

  return {
    content: content.replace(targetPhrase, `<span class="${className}">${targetPhrase}</span>`),
    matched: true,
  }
}

function applyTypographyClassToJsonValue(
  value: unknown,
  targetPhrase: string,
  className: string,
): { value: unknown; matched: boolean } {
  if (typeof value === "string") {
    return applyTypographyClassToHtmlContent(value, targetPhrase, className)
  }

  if (Array.isArray(value)) {
    let matched = false
    const nextValue = value.map((item) => {
      const updated = applyTypographyClassToJsonValue(item, targetPhrase, className)
      matched = matched || updated.matched
      return updated.value
    })
    return { value: nextValue, matched }
  }

  if (value && typeof value === "object") {
    let matched = false
    const nextValue: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const updated = applyTypographyClassToJsonValue(item, targetPhrase, className)
      matched = matched || updated.matched
      nextValue[key] = updated.value
    }
    return { value: nextValue, matched }
  }

  return { value, matched: false }
}

function applyTypographyClassToBlock(
  block: Record<string, unknown>,
  targetPhrase: string,
  className: string,
): { block: Record<string, unknown>; matched: boolean } {
  const nextBlock = cloneJsonValue(block)
  const type = normalizeString(block.type).toLowerCase()

  if (type === "heading" && typeof block.content === "string" && matchesTypographyTarget(block.content, targetPhrase)) {
    nextBlock.customClassName = normalizeString(`${normalizeString(block.customClassName)} ${className}`)
    return { block: nextBlock, matched: true }
  }

  if (type === "button" && typeof block.label === "string" && matchesTypographyTarget(block.label, targetPhrase)) {
    nextBlock.customClassName = normalizeString(`${normalizeString(block.customClassName)} ${className}`)
    return { block: nextBlock, matched: true }
  }

  if (type === "rich_text" && typeof block.content === "string") {
    const updated = applyTypographyClassToHtmlContent(block.content, targetPhrase, className)
    if (updated.matched) {
      nextBlock.content = updated.content
      return { block: nextBlock, matched: true }
    }
    return { block: nextBlock, matched: false }
  }

  if (type === "columns" && Array.isArray(block.items)) {
    for (let index = 0; index < block.items.length; index += 1) {
      const item = String(block.items[index] ?? "")
      const updated = applyTypographyClassToHtmlContent(item, targetPhrase, className)
      if (updated.matched) {
        const nextItems = [...block.items]
        nextItems[index] = updated.content
        nextBlock.items = nextItems
        return { block: nextBlock, matched: true }
      }
    }
    return { block: nextBlock, matched: false }
  }

  if (type === "container" && Array.isArray(block.children)) {
    const nextChildren = cloneJsonValue(block.children)
    for (let columnIndex = 0; columnIndex < nextChildren.length; columnIndex += 1) {
      const column = nextChildren[columnIndex]
      if (!Array.isArray(column)) continue
      for (let blockIndex = 0; blockIndex < column.length; blockIndex += 1) {
        const child = column[blockIndex]
        if (!child || typeof child !== "object" || Array.isArray(child)) continue
        const updated = applyTypographyClassToBlock(child as Record<string, unknown>, targetPhrase, className)
        if (updated.matched) {
          column[blockIndex] = updated.block
          nextBlock.children = nextChildren
          return { block: nextBlock, matched: true }
        }
      }
    }
  }

  return { block: nextBlock, matched: false }
}

function applyTypographyTargetToLayout(
  currentLayoutJson: Record<string, unknown>,
  targetPhrase: string,
  className: string,
) {
  const currentBlocks = extractBlocksFromLayoutJson(currentLayoutJson)
  if (!currentBlocks || currentBlocks.length === 0) return null

  const nextBlocks: Record<string, unknown>[] = []
  let matched = false

  for (const block of currentBlocks) {
    if (matched) {
      nextBlocks.push(cloneJsonValue(block))
      continue
    }

    const updated = applyTypographyClassToBlock(block, targetPhrase, className)
    nextBlocks.push(updated.block)
    matched = updated.matched
  }

  if (matched) {
    return withBlocksAppliedToLayoutJson(currentLayoutJson, nextBlocks)
  }

  const recursiveUpdate = applyTypographyClassToJsonValue(currentLayoutJson, targetPhrase, className)
  if (!recursiveUpdate.matched || !recursiveUpdate.value || typeof recursiveUpdate.value !== "object" || Array.isArray(recursiveUpdate.value)) {
    return null
  }

  return recursiveUpdate.value as Record<string, unknown>
}

function buildTypographyCssRule(
  className: string,
  declarations: Array<{ property: string; value: string }>,
) {
  const safeDeclarations = declarations
    .filter((entry) => SAFE_TYPOGRAPHY_PROPERTIES.has(entry.property) && declarationValueIsSafe(entry.value))
    .map((entry) => `${entry.property}: ${entry.value};`)

  if (safeDeclarations.length === 0) {
    return ""
  }

  return `.${className} {\n  ${safeDeclarations.join("\n  ")}\n}`
}

function finalizeSafeTextAndTypographyProposal(input: {
  proposal: ReturnType<typeof validateProposal>
  currentLayoutJson: Record<string, unknown>
  currentStyleJson: Record<string, unknown>
  textReplacement: { from: string; to: string } | null
  textContentRequest: boolean
  typographyRequest: boolean
  typographyTargetPhrase: string | null
  typographyDeclarations: Array<{ property: string; value: string }>
  allowMediaChanges: boolean
}) {
  const warnings = [...input.proposal.warnings]
  let nextLayoutJson = input.currentLayoutJson
  let nextStyleJson = input.currentStyleJson

  if (input.textContentRequest) {
    if (input.textReplacement) {
      const replacedLayout = applyQuotedTextReplacementToLayout(input.currentLayoutJson, input.textReplacement)
      if (replacedLayout) {
        nextLayoutJson = replacedLayout
        warnings.push("Aplicação protegida: a estrutura original da página foi preservada e apenas o texto solicitado foi alterado.")
      }
    }

    if (nextLayoutJson === input.currentLayoutJson) {
      if (!proposalRepresentsLocalizedTextPatch(input.currentLayoutJson, input.proposal.proposal.layout_json)) {
        throw unprocessable(
          "A proposta da IA alterou mais do que o trecho pedido. Apenas ajustes locais num único ponto da página podem ser aplicados.",
        )
      }

      const mergedLayout = mergeTextOnlyProposalWithCurrentLayout(
        input.currentLayoutJson,
        input.proposal.proposal.layout_json,
        input.allowMediaChanges,
      )

      if (!mergedLayout) {
        throw unprocessable(
          "A proposta da IA alterou a estrutura da página num pedido textual. Nenhum rascunho foi aplicado para proteger o layout.",
        )
      }

      nextLayoutJson = mergedLayout
      warnings.push("Aplicação protegida: o layout atual foi preservado e apenas os conteúdos textuais foram atualizados.")
    }
  }

  if (input.typographyRequest) {
    const deterministicTargetClassName =
      input.typographyTargetPhrase && input.typographyDeclarations.length > 0
        ? `me-ai-typography-target-${crypto.randomUUID().replace(/-/g, "")}`
        : null

    if (deterministicTargetClassName && input.typographyTargetPhrase) {
      const targetedLayout = applyTypographyTargetToLayout(nextLayoutJson, input.typographyTargetPhrase, deterministicTargetClassName)
      const targetedCssRule = buildTypographyCssRule(deterministicTargetClassName, input.typographyDeclarations)

      if (targetedLayout && targetedCssRule) {
        nextLayoutJson = targetedLayout
        nextStyleJson = appendCssPatchToStyleJson(nextStyleJson, `/* Mariana AI: targeted typography patch */\n${targetedCssRule}`)
        warnings.push("Aplicação protegida: a tipografia foi ajustada apenas no trecho pedido, sem alterar a estrutura da página.")
        return {
          ...input.proposal,
          warnings,
          proposal: {
            ...input.proposal.proposal,
            layout_json: nextLayoutJson,
            style_json: nextStyleJson,
          },
        }
      }
    }
    throw unprocessable(
      "Não encontrei um alvo tipográfico local e seguro na página atual para aplicar esse ajuste sem mexer no resto da página.",
    )
  }

  return {
    ...input.proposal,
    warnings,
    proposal: {
      ...input.proposal.proposal,
      layout_json: nextLayoutJson,
      style_json: nextStyleJson,
    },
  }
}

function extractDataUrlParts(dataUrl: string) {
  const trimmed = String(dataUrl ?? "").trim()
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i)
  if (!match) return null
  return {
    mimeType: match[1],
    base64: match[2],
  }
}

function extractTextFromGeminiResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  const candidates = Array.isArray(record.candidates) ? record.candidates : []

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const candidateRecord = candidate as Record<string, unknown>
    const content = candidateRecord.content
    if (!content || typeof content !== "object") continue
    const contentRecord = content as Record<string, unknown>
    const parts = Array.isArray(contentRecord.parts) ? contentRecord.parts : []
    const text = parts
      .map((part) => {
        if (!part || typeof part !== "object") return ""
        const partRecord = part as Record<string, unknown>
        return typeof partRecord.text === "string" ? partRecord.text : ""
      })
      .join("")
    if (text.trim()) return text
  }

  return typeof record.text === "string" ? record.text : ""
}

function extractTextFromOpenAIResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text
  }

  const output = Array.isArray(record.output) ? record.output : []
  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const itemRecord = item as Record<string, unknown>
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : []
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") continue
      const chunkRecord = chunk as Record<string, unknown>
      if (typeof chunkRecord.text === "string" && chunkRecord.text.trim()) {
        return chunkRecord.text
      }
    }
  }

  return ""
}

function extractGeminiUsage(payload: unknown): UsageSnapshot {
  if (!payload || typeof payload !== "object") {
    return { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  }

  const usageMetadata =
    "usageMetadata" in (payload as Record<string, unknown>) && typeof (payload as Record<string, unknown>).usageMetadata === "object"
      ? ((payload as Record<string, unknown>).usageMetadata as Record<string, unknown>)
      : {}

  const input_tokens = normalizeTokenCount(usageMetadata.promptTokenCount)
  const output_tokens = normalizeTokenCount(usageMetadata.candidatesTokenCount)
  const total_tokens = normalizeTokenCount(usageMetadata.totalTokenCount) || input_tokens + output_tokens

  return {
    input_tokens,
    output_tokens,
    total_tokens,
  }
}

function extractOpenAIUsage(payload: unknown): UsageSnapshot {
  if (!payload || typeof payload !== "object") {
    return { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  }

  const usage =
    "usage" in (payload as Record<string, unknown>) && typeof (payload as Record<string, unknown>).usage === "object"
      ? ((payload as Record<string, unknown>).usage as Record<string, unknown>)
      : {}

  const input_tokens = normalizeTokenCount(usage.input_tokens)
  const output_tokens = normalizeTokenCount(usage.output_tokens)
  const total_tokens = normalizeTokenCount(usage.total_tokens) || input_tokens + output_tokens

  return {
    input_tokens,
    output_tokens,
    total_tokens,
  }
}

function readResponseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback
  const record = payload as Record<string, unknown>
  if (typeof record.error === "object" && record.error) {
    const errorRecord = record.error as Record<string, unknown>
    return normalizeString(errorRecord.message, fallback)
  }
  return fallback
}

function isQuotaExceededErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limits") ||
    normalized.includes("current quota") ||
    normalized.includes("billing") ||
    normalized.includes("free_tier") ||
    normalized.includes("retry in")
  )
}

async function readConfig(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_by,updated_at")
    .eq("config_key", CONFIG_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  const config = normalizeConfigValue(data?.config_value ?? {})
  return {
    config_key: data?.config_key ?? CONFIG_KEY,
    config_value: config,
    description: data?.description ?? "Configuração do editor via IA",
    is_public: data?.is_public ?? false,
    updated_at: data?.updated_at ?? null,
  }
}

async function upsertConfig(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  configValue: ReturnType<typeof normalizeConfigValue>,
) {
  const { data, error } = await serviceClient
    .from("site_config")
    .upsert(
      {
        config_key: CONFIG_KEY,
        config_value: configValue,
        description:
          "Configuração do editor via IA embutido no frontend. As chaves sensíveis ficam no backend seguro.",
        is_public: false,
        updated_by: userId,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return {
    config_key: data.config_key,
    config_value: normalizeConfigValue(data.config_value),
    description: data.description,
    is_public: data.is_public,
    updated_at: data.updated_at,
  }
}

async function readSecret(serviceClient: ReturnType<typeof createServiceClient>, name: string) {
  const { data, error } = await serviceClient.rpc("get_platform_vault_secret", {
    p_name: name,
  })

  if (error) {
    throw error
  }

  return typeof data === "string" && data.trim() ? data.trim() : null
}

async function writeSecret(
  serviceClient: ReturnType<typeof createServiceClient>,
  name: string,
  secret: string,
  description: string,
) {
  const { error } = await serviceClient.rpc("upsert_platform_vault_secret", {
    p_name: name,
    p_secret: secret,
    p_description: description,
  })

  if (error) {
    throw error
  }
}

function isAiPageEditorUsageSchemaMismatch(error: unknown) {
  if (!error || typeof error !== "object") return false
  const record = error as Record<string, unknown>
  const fullText = `${record.code ?? ""} ${record.message ?? ""} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase()
  return (
    fullText.includes("schema cache") ||
    (fullText.includes("column") && fullText.includes("does not exist")) ||
    (fullText.includes("could not find") && fullText.includes("column"))
  )
}

async function recordUsageEvent(
  serviceClient: ReturnType<typeof createServiceClient>,
  event: UsageEventRecord,
) {
  const { error } = await serviceClient.from("ai_page_editor_usage_events").insert(event)
  if (!error) {
    return
  }

  if (!isAiPageEditorUsageSchemaMismatch(error)) {
    throw error
  }

  const legacyMetadata = {
    ...event.metadata,
    mode: event.mode ?? null,
    scope: event.scope ?? null,
    risk_level: event.risk_level ?? null,
    target_ids: event.target_ids ?? [],
    requires_strict_confirmation: event.requires_strict_confirmation ?? false,
    contract_version: event.contract_version ?? "hybrid_v1",
    invariants: event.invariants ?? {},
  }

  const { error: legacyError } = await serviceClient.from("ai_page_editor_usage_events").insert({
    action: event.action,
    provider: event.provider,
    model: event.model,
    user_id: event.user_id,
    slug: event.slug,
    path: event.path,
    input_tokens: event.input_tokens,
    output_tokens: event.output_tokens,
    total_tokens: event.total_tokens,
    estimated_cost_usd: event.estimated_cost_usd,
    currency: event.currency,
    request_id: event.request_id,
    metadata: legacyMetadata,
  })

  if (legacyError) {
    throw legacyError
  }
}

async function readUsageMetrics(
  serviceClient: ReturnType<typeof createServiceClient>,
  periodDays: number,
) {
  const sinceIso = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  let data: unknown[] | null = null
  let error: unknown = null

  const richQuery = await serviceClient
    .from("ai_page_editor_usage_events")
    .select(
      "id,action,provider,model,slug,path,input_tokens,output_tokens,total_tokens,estimated_cost_usd,currency,request_id,mode,scope,risk_level,target_ids,requires_strict_confirmation,contract_version,invariants,metadata,created_at",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1000)

  data = Array.isArray(richQuery.data) ? (richQuery.data as unknown[]) : null
  error = richQuery.error

  if (error && isAiPageEditorUsageSchemaMismatch(error)) {
    const legacyQuery = await serviceClient
      .from("ai_page_editor_usage_events")
      .select(
        "id,action,provider,model,slug,path,input_tokens,output_tokens,total_tokens,estimated_cost_usd,currency,request_id,metadata,created_at",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1000)

    data = Array.isArray(legacyQuery.data) ? (legacyQuery.data as unknown[]) : null
    error = legacyQuery.error
  }

  if (error) {
    throw error
  }

  const events = Array.isArray(data)
    ? data
        .filter((item) => item && typeof item === "object")
        .map((item) => item as Record<string, unknown>)
    : []

  const summary = {
    period_days: periodDays,
    currency: "USD" as const,
    total_requests: 0,
    total_generate_requests: 0,
    total_test_requests: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_tokens: 0,
    total_estimated_cost_usd: 0,
    priced_requests: 0,
    unpriced_requests: 0,
    last_event_at: null as string | null,
    by_mode: {} as Record<string, number>,
    by_scope: {} as Record<string, number>,
    by_risk_level: {} as Record<string, number>,
  }

  const breakdownMap = new Map<
    string,
    {
      provider: AiProvider
      model: string
      action: UsageAction
      requests: number
      input_tokens: number
      output_tokens: number
      total_tokens: number
      estimated_cost_usd: number
      priced_requests: number
      unpriced_requests: number
      last_event_at: string | null
    }
  >()

  const recent_events = events.slice(0, 20).map((event) => ({
    id: normalizeString(event.id),
    created_at: normalizeString(event.created_at),
    action: normalizeString(event.action) === "test_providers" ? "test_providers" : "generate_proposal",
    provider: normalizeProvider(event.provider) as AiProvider,
    model: normalizeString(event.model),
    slug: normalizeString(event.slug) || null,
    path: normalizeString(event.path) || null,
    mode:
      normalizeString(event.mode) ||
      normalizeString(
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>).mode
          : null,
      ) ||
      null,
    scope:
      normalizeString(event.scope) ||
      normalizeString(
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>).scope
          : null,
      ) ||
      null,
    risk_level:
      normalizeString(event.risk_level) ||
      normalizeString(
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>).risk_level
          : null,
      ) ||
      null,
    target_ids:
      Array.isArray(event.target_ids)
        ? normalizeStringArray(event.target_ids)
        : event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? normalizeStringArray((event.metadata as Record<string, unknown>).target_ids)
          : [],
    requires_strict_confirmation:
      event.requires_strict_confirmation === true ||
      (event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>).requires_strict_confirmation === true
        : false),
    contract_version:
      normalizeString(event.contract_version) ||
      normalizeString(
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>).contract_version
          : null,
      ) ||
      null,
    invariants:
      event.invariants && typeof event.invariants === "object" && !Array.isArray(event.invariants)
        ? (event.invariants as Record<string, unknown>)
        : event.metadata &&
            typeof event.metadata === "object" &&
            !Array.isArray(event.metadata) &&
            (event.metadata as Record<string, unknown>).invariants &&
            typeof (event.metadata as Record<string, unknown>).invariants === "object" &&
            !Array.isArray((event.metadata as Record<string, unknown>).invariants)
          ? ((event.metadata as Record<string, unknown>).invariants as Record<string, unknown>)
          : {},
    input_tokens: normalizeTokenCount(event.input_tokens),
    output_tokens: normalizeTokenCount(event.output_tokens),
    total_tokens: normalizeTokenCount(event.total_tokens),
    estimated_cost_usd: resolveUsageEventCostUsd(
      normalizeProvider(event.provider) as AiProvider,
      normalizeString(event.model),
      {
        input_tokens: normalizeTokenCount(event.input_tokens),
        output_tokens: normalizeTokenCount(event.output_tokens),
        total_tokens: normalizeTokenCount(event.total_tokens),
      },
      event.estimated_cost_usd,
    ),
    currency: normalizeString(event.currency, "USD"),
    request_id: normalizeString(event.request_id) || null,
    metadata:
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : {},
  }))

  for (const event of events) {
    const provider = normalizeProvider(event.provider) as AiProvider
    const action = normalizeString(event.action) === "test_providers" ? "test_providers" : "generate_proposal"
    const model = normalizeString(event.model)
    const inputTokens = normalizeTokenCount(event.input_tokens)
    const outputTokens = normalizeTokenCount(event.output_tokens)
    const totalTokens = normalizeTokenCount(event.total_tokens)
    const estimatedCostUsd = resolveUsageEventCostUsd(provider, model, {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
    }, event.estimated_cost_usd)
    const createdAt = normalizeString(event.created_at) || null
    const eventMetadata =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : {}
    const mode = normalizeString(event.mode) || normalizeString(eventMetadata.mode)
    const scope = normalizeString(event.scope) || normalizeString(eventMetadata.scope)
    const riskLevel = normalizeString(event.risk_level) || normalizeString(eventMetadata.risk_level)

    summary.total_requests += 1
    summary.total_input_tokens += inputTokens
    summary.total_output_tokens += outputTokens
    summary.total_tokens += totalTokens
    if (action === "generate_proposal") {
      summary.total_generate_requests += 1
    } else {
      summary.total_test_requests += 1
    }
    if (estimatedCostUsd === null) {
      summary.unpriced_requests += 1
    } else {
      summary.priced_requests += 1
      summary.total_estimated_cost_usd = roundUsd(summary.total_estimated_cost_usd + estimatedCostUsd)
    }
    if (!summary.last_event_at || (createdAt && createdAt > summary.last_event_at)) {
      summary.last_event_at = createdAt
    }
    if (mode) {
      summary.by_mode[mode] = (summary.by_mode[mode] ?? 0) + 1
    }
    if (scope) {
      summary.by_scope[scope] = (summary.by_scope[scope] ?? 0) + 1
    }
    if (riskLevel) {
      summary.by_risk_level[riskLevel] = (summary.by_risk_level[riskLevel] ?? 0) + 1
    }

    const key = `${provider}:${model}:${action}`
    const current =
      breakdownMap.get(key) ?? {
        provider,
        model,
        action,
        requests: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
        priced_requests: 0,
        unpriced_requests: 0,
        last_event_at: null,
      }

    current.requests += 1
    current.input_tokens += inputTokens
    current.output_tokens += outputTokens
    current.total_tokens += totalTokens
    if (estimatedCostUsd === null) {
      current.unpriced_requests += 1
    } else {
      current.priced_requests += 1
      current.estimated_cost_usd = roundUsd(current.estimated_cost_usd + estimatedCostUsd)
    }
    if (!current.last_event_at || (createdAt && createdAt > current.last_event_at)) {
      current.last_event_at = createdAt
    }

    breakdownMap.set(key, current)
  }

  const breakdown = Array.from(breakdownMap.values()).sort((left, right) => {
    if (right.estimated_cost_usd !== left.estimated_cost_usd) {
      return right.estimated_cost_usd - left.estimated_cost_usd
    }
    return right.requests - left.requests
  })

  return {
    summary,
    breakdown,
    recent_events,
    pricing_reference: {
      currency: "USD" as const,
      source: "Tabela interna baseada nos preços oficiais dos provedores para tokens de entrada e saída.",
    },
  }
}

function buildSystemPrompt(config: ReturnType<typeof normalizeConfigValue>, currentTitle: string, currentPath: string) {
  return [
    config.base_prompt || DEFAULT_AI_PAGE_EDITOR_BASE_PROMPT,
    "Modo padrão: alteração cirúrgica e localizada.",
    "Antes de responder, analisa com atenção o pedido do usuário e a área exata da página onde a mudança acontece.",
    "Observa também os elementos próximos, o impacto visual e a relação com o restante da página antes de propor qualquer alteração.",
    "Depois da análise, explica em linguagem simples e direta o que será feito, sem termos técnicos, siglas internas ou nomes de ficheiros.",
    "Preserva a estrutura visual, o layout, o grid, o header, o footer, a navegação, os CTAs, os estados de loading/erro/vazio e a lógica funcional existente.",
    "Não alteres tipografia, cores, espaçamentos, alinhamentos, responsividade, ordem dos blocos ou wrappers globais a menos que o usuário peça isso de forma expressa.",
    "Se a solicitação puder ser atendida com uma mudança pontual, faz apenas essa mudança e mantém todo o resto igual.",
    "Se o pedido implicar mudanças estruturais ou de layout, deves assinalar isso claramente em warnings e evitar reestruturar a página sem pedido explícito.",
    "Quando a página já estiver em blocos, devolve a mesma estrutura de blocos e altera só o conteúdo necessário. Mantém os ids dos blocos, a ordem e os estilos de layout sempre que possível.",
    "Não alteres o admin nem áreas privadas.",
    "Quando precisares propor edição, devolve JSON válido apenas com summary, explanation, warnings, edit_plan e proposal.",
    "Em edit_plan, usa obrigatoriamente um mode entre text_patch, style_patch, spacing_patch, section_layout_patch e section_replace.",
    "Em edit_plan, usa obrigatoriamente um scope entre text, block, section, page, header e footer.",
    "Em edit_plan.operations, usa apenas operações compatíveis com o contrato: set_style, remove_style, update_text, move_node, replace_section, set_responsive_rule, wrap_children, unwrap_children, change_columns.",
    "Em update_text, preenche value preferencialmente com {\"from\":\"...\",\"to\":\"...\"}.",
    "Em set_style e set_responsive_rule, preenche path com a propriedade canónica e value com o valor final concreto, por exemplo layout.paddingTop=0, gap=16, columns=2 ou text-align=center.",
    "Se precisares reorganizar ou substituir só uma seção, o proposal pode servir como template apenas dessa seção, mas o edit_plan deve continuar específico ao alvo.",
    "Se houver risco estrutural, marca risk_level como high e requires_strict_confirmation como true.",
    "Dentro de proposal, devolve layout_json, style_json e metadata como strings JSON válidas, não como objetos literais.",
    `Página atual: ${currentTitle} (${currentPath})`,
    "A proposta deve continuar compatível com o builder atual de páginas públicas.",
    "Pedidos de texto e de tipografia pontual s\u00e3o permitidos e devem ser tratados sem reescrever a p\u00e1gina inteira.",
    "Se o pedido citar uma frase existente, trata essa frase como alvo exato do ajuste, mesmo que venha com aspas, HTML ou quebras de linha.",
    "Se o pedido for apenas de tipografia, preserva o layout_json atual e prop\u00f5e apenas o CSS/estilo m\u00ednimo necess\u00e1rio para fonte, tamanho, peso, entrelinha, espa\u00e7amento entre letras ou capitaliza\u00e7\u00e3o.",
    "Se o pedido combinar texto e tipografia, altera apenas o conte\u00fado solicitado e o ajuste tipogr\u00e1fico correspondente, sem mexer no resto da p\u00e1gina.",
  ].join("\n")
}

function buildFooterCopySystemPrompt(config: ReturnType<typeof normalizeConfigValue>, currentTitle: string, currentPath: string) {
  return [
    config.base_prompt || DEFAULT_AI_PAGE_EDITOR_BASE_PROMPT,
    "Modo padrão: alteração cirúrgica e localizada.",
    "Antes de responder, analisa com atenção o pedido do usuário e o texto global atual do rodapé.",
    "Depois da análise, explica em linguagem simples e direta o que será feito, sem termos técnicos, siglas internas ou nomes de ficheiros.",
    "O objetivo é atualizar apenas o texto global do rodapé do site.",
    "Não inventes secções novas nem alteres o layout da página.",
    "Mantém o tom claro, educacional e confiável da marca.",
    "Se a solicitação for apenas uma alteração pontual, devolve um texto final curto e consistente.",
    "Se houver ambiguidade, prefere a menor alteração possível e explica isso em warnings.",
    "Devolve JSON válido apenas com summary, explanation, warnings e footer_description.",
    "footer_description deve ser uma string final pronta para publicar no rodapé global.",
    `Página atual: ${currentTitle} (${currentPath})`,
  ].join("\n")
}

function buildHeaderCopySystemPrompt(config: ReturnType<typeof normalizeConfigValue>, currentTitle: string, currentPath: string) {
  return [
    config.base_prompt || DEFAULT_AI_PAGE_EDITOR_BASE_PROMPT,
    "Modo padrão: alteração cirúrgica e localizada.",
    "Antes de responder, analisa com atenção o pedido do usuário e o texto global atual do cabeçalho.",
    "Depois da análise, explica em linguagem simples e direta o que será feito, sem termos técnicos, siglas internas ou nomes de ficheiros.",
    "O objetivo é atualizar apenas o texto global do cabeçalho do site.",
    "Não inventes secções novas nem alteres o layout da página.",
    "Mantém o tom claro, educacional e confiável da marca.",
    "Se a solicitação for apenas uma alteração pontual, devolve um texto final curto e consistente.",
    "Se houver ambiguidade, prefere a menor alteração possível e explica isso em warnings.",
    "Devolve JSON válido apenas com summary, explanation, warnings e header_announcement.",
    "header_announcement deve ser uma string final pronta para publicar no cabeçalho global.",
    `Página atual: ${currentTitle} (${currentPath})`,
  ].join("\n")
}

function buildUserPrompt(input: {
  message: string
  currentHtml: string
  currentLayoutJson: Record<string, unknown>
  currentStyleJson: Record<string, unknown>
  attachments: AttachmentInput[]
  understandingSummary?: string | null
}) {
  const attachmentsSummary = input.attachments.length
    ? input.attachments
        .map(
          (attachment, index) =>
            `${index + 1}. ${attachment.name} (${attachment.mime_type}, ${Math.round(attachment.size_bytes / 1024)} KB)`,
        )
        .join("\n")
    : "Nenhum anexo"

  const prompt = [
    "Pedido do editor:",
    input.message.trim(),
    ...(input.understandingSummary
      ? ["", "Entendimento confirmado:", input.understandingSummary.trim()]
      : []),
    "",
    "Regra de execução:",
    "Executa apenas a alteração pedida, de forma pontual.",
    "Analisa o pedido e a área da página ao redor do ponto pedido antes de responder.",
    "Depois da análise, descreve com palavras simples exatamente o que será alterado.",
    "Não uses termos técnicos, nomes internos, siglas ou linguagem de sistema na resposta.",
    "Mantém o layout e a estrutura original inalterados, salvo se o pedido mencionar explicitamente redesign, reorganização, troca de secções, mudança de grid ou mudança visual ampla.",
    "Se houver ambiguidade, preferir a menor alteração possível e avisar em warnings.",
    "Se a página atual já usa projectData.blocks, devolve a mesma estrutura e muda apenas o(s) bloco(s) necessário(s), sem recriar a página do zero.",
    "Se precisares mudar apenas uma frase, altera apenas o campo de conteúdo do bloco correspondente.",
    "Se o pedido citar uma frase existente apenas para identificar o alvo de um ajuste de tipografia, trata essa frase como referência visual e não como pedido de reescrita do conteúdo.",
    "Quando o pedido for tipográfico, usa preferencialmente classes e seletores .me- já existentes no HTML atual para aplicar o CSS mínimo necessário, sem mexer no layout_json.",
    "Se o pedido mencionar HTML bruto, por exemplo um <hr> ou um fragmento de marcação, não devolvas só o fragmento: atualiza a estrutura completa e mantém projectData.blocks ou html como JSON válido.",
    "Preenche edit_plan com scope, mode, target_ids, risk_level, requires_strict_confirmation e operations antes de devolver proposal.",
    "Em operations, evita instruções vagas. Sempre que souberes o alvo, devolve target_id estável, path canónico e value final concreto.",
    "Para text_patch, usa update_text com value {\"from\":\"texto atual\",\"to\":\"texto novo\"}.",
    "Para spacing_patch ou style_patch, usa set_style ou set_responsive_rule com path específico, por exemplo layout.paddingTop, gap, background, color, border-radius ou columns.",
    "Usa exatamente o nome section_layout_patch para pedidos de layout interno por seção.",
    "Dentro de proposal, devolve layout_json, style_json e metadata como strings JSON válidas. Exemplo: \"{\\\"projectData\\\":{\\\"blocks\\\":[...]}}\".",
    "",
    "HTML atual de referência:",
    input.currentHtml.slice(0, MAX_PROMPT_LENGTH),
    "",
    "Layout JSON atual:",
    JSON.stringify(input.currentLayoutJson).slice(0, MAX_PROMPT_LENGTH),
    "",
    "Style JSON atual:",
    JSON.stringify(input.currentStyleJson).slice(0, MAX_PROMPT_LENGTH),
    "",
    "Anexos:",
    attachmentsSummary,
    "",
    "Responde apenas com JSON válido.",
  ].join("\n")

  return prompt.slice(0, MAX_PROMPT_LENGTH)
}

function buildConversationTranscript(context: AiConversationContext) {
  if (context.recent_messages.length === 0) return "Sem histÃ³rico anterior."

  return context.recent_messages
    .map((message, index) => `${index + 1}. ${message.role === "assistant" ? "Assistente" : "Mariana"}: ${message.text}`)
    .join("\n")
}

function buildUnderstandingSystemPrompt(config: ReturnType<typeof normalizeConfigValue>, currentTitle: string, currentPath: string) {
  return [
    config.base_prompt || DEFAULT_AI_PAGE_EDITOR_BASE_PROMPT,
    "Neste momento ainda nao vais propor a edicao tecnica da pagina.",
    "Primeiro tens de entender o que a Mariana quer dizer.",
    "Fala sempre em portugues simples, natural e acolhedor.",
    "Nunca uses termos tecnicos como padding, margin, wrapper, layout, patch, proposal, invariants, edit_plan, css, DOM ou target resolution.",
    "Se faltar contexto, faz apenas uma pergunta curta por vez.",
    "Se houver dois alvos provaveis, mostra opcoes simples e claras.",
    "Se ja estiver claro, resume em linguagem simples o que entendeste e pergunta se esta certo.",
    "Quando estiver claro, devolve phase=awaiting_intent_confirmation.",
    "Quando ainda faltar contexto, devolve phase=needs_clarification.",
    "understanding_summary deve descrever em uma frase simples o que sera mudado, sem linguagem tecnica.",
    "assistant_message deve ser amigavel e pronta para aparecer no chat.",
    "quick_replies deve trazer de 0 a 4 respostas curtas e clicaveis.",
    `Pagina atual: ${currentTitle} (${currentPath})`,
  ].join("\n")
}

function buildUnderstandingUserPrompt(input: {
  message: string
  currentTitle: string
  currentPath: string
  conversationContext: AiConversationContext
}) {
  const clarificationCount = input.conversationContext.clarification_questions_count
  const mustStopAsking =
    clarificationCount >= 2 || input.conversationContext.phase === "awaiting_intent_confirmation"

  return [
    "Pedido atual da Mariana:",
    input.message.trim(),
    "",
    "Resumo anterior do entendimento:",
    input.conversationContext.understanding_summary ?? "Sem resumo anterior.",
    "",
    "Ultima resposta rapida escolhida:",
    input.conversationContext.quick_reply_selected ?? "Nenhuma.",
    "",
    "Historico curto da conversa:",
    buildConversationTranscript(input.conversationContext),
    "",
    `Perguntas ja feitas: ${clarificationCount}.`,
    mustStopAsking
      ? "Agora evita fazer mais perguntas. Faz o melhor resumo simples do que entendeste e pede confirmacao."
      : "Se ainda houver ambiguidade, podes fazer uma pergunta curta para fechar o alvo.",
    "",
    `Pagina atual: ${input.currentTitle} (${input.currentPath})`,
    "",
    "Responde apenas com JSON valido.",
  ].join("\n")
}

function buildFooterCopyUserPrompt(input: {
  message: string
  currentFooterText: string
  currentTitle: string
  currentPath: string
}) {
  const prompt = [
    "Pedido do editor:",
    input.message.trim(),
    "",
    "Texto global atual do footer:",
    input.currentFooterText.trim(),
    "",
    "Regra de execução:",
    "Executa apenas a alteração pedida, de forma pontual.",
    "Analisa com cuidado o pedido e o texto do rodapé antes de responder.",
    "Depois da análise, descreve com palavras simples exatamente o que será alterado.",
    "Não uses termos técnicos, nomes internos, siglas ou linguagem de sistema na resposta.",
    "Mantém o footer global como uma única frase coerente.",
    "Se precisares alterar apenas uma palavra ou sinal de pontuação, altera só isso.",
    "Se a solicitação for ambígua, preferir a menor alteração possível e avisar em warnings.",
    "",
    `Página atual: ${input.currentTitle} (${input.currentPath})`,
    "",
    "Responde apenas com JSON válido.",
  ].join("\n")

  return prompt.slice(0, MAX_PROMPT_LENGTH)
}

function buildHeaderCopyUserPrompt(input: {
  message: string
  currentHeaderText: string
  currentTitle: string
  currentPath: string
}) {
  const prompt = [
    "Pedido do editor:",
    input.message.trim(),
    "",
    "Texto global atual do header:",
    input.currentHeaderText.trim(),
    "",
    "Regra de execução:",
    "Executa apenas a alteração pedida, de forma pontual.",
    "Analisa com cuidado o pedido e o texto do cabeçalho antes de responder.",
    "Depois da análise, descreve com palavras simples exatamente o que será alterado.",
    "Não uses termos técnicos, nomes internos, siglas ou linguagem de sistema na resposta.",
    "Mantém o header global como um texto curto e coerente.",
    "Se precisares alterar apenas uma palavra ou sinal de pontuação, altera só isso.",
    "Se a solicitação for ambígua, preferir a menor alteração possível e avisar em warnings.",
    "",
    `Página atual: ${input.currentTitle} (${input.currentPath})`,
    "",
    "Responde apenas com JSON válido.",
  ].join("\n")

  return prompt.slice(0, MAX_PROMPT_LENGTH)
}

async function generateUnderstandingTurn(input: {
  config: ReturnType<typeof normalizeConfigValue>
  secrets: Awaited<ReturnType<typeof getProviderSecrets>>
  title: string
  path: string
  message: string
  conversationContext: AiConversationContext
}) {
  const systemPrompt = buildUnderstandingSystemPrompt(input.config, input.title, input.path)
  const userPrompt = buildUnderstandingUserPrompt({
    message: input.message,
    currentTitle: input.title,
    currentPath: input.path,
    conversationContext: input.conversationContext,
  })

  const providerCandidates = [
    {
      provider: input.config.primary_provider,
      model: input.config.primary_provider === "gemini" ? input.config.gemini_model : input.config.openai_model,
      apiKey: input.config.primary_provider === "gemini" ? input.secrets.geminiApiKey : input.secrets.openaiApiKey,
    },
    {
      provider: input.config.fallback_provider,
      model: input.config.fallback_provider === "gemini" ? input.config.gemini_model : input.config.openai_model,
      apiKey: input.config.fallback_provider === "gemini" ? input.secrets.geminiApiKey : input.secrets.openaiApiKey,
    },
  ] as const

  let lastError: unknown = null
  const providerFailures: Array<{ provider: AiProvider; message: string }> = []
  let rawText = ""
  let providerUsed: AiProvider | null = null
  let modelUsed = ""
  let rawPayload: unknown = null

  for (const candidate of providerCandidates) {
    if (!candidate.apiKey) {
      const message = `${candidate.provider} sem chave configurada`
      providerFailures.push({ provider: candidate.provider, message })
      lastError = new Error(message)
      continue
    }

    try {
      const result =
        candidate.provider === "gemini"
          ? await callGemini({
              apiKey: candidate.apiKey,
              model: candidate.model || DEFAULT_GEMINI_MODEL,
              systemPrompt,
              userPrompt,
              attachments: [],
              responseSchema: understandingSchema,
            })
          : await callOpenAI({
              apiKey: candidate.apiKey,
              model: candidate.model || DEFAULT_OPENAI_MODEL,
              systemPrompt,
              userPrompt,
              attachments: [],
              responseSchema: understandingSchema,
            })

      rawText = result.text
      providerUsed = candidate.provider
      modelUsed = candidate.model
      rawPayload = result.raw
      lastError = null
      break
    } catch (error) {
      providerFailures.push({
        provider: candidate.provider,
        message: error instanceof Error ? error.message : String(error),
      })
      lastError = error
    }
  }

  if (!providerUsed || !rawText.trim()) {
    const details = formatProviderFailureDetails(
      providerFailures,
      lastError instanceof Error ? lastError.message : "sem detalhes adicionais",
    )
    throw new Error(`Nenhum provedor disponÃ­vel para entender o pedido. ${details}`)
  }

  const parsed = parseJsonFromString(rawText)
  const turn = validateUnderstandingTurn(parsed)
  const usage =
    providerUsed === "gemini"
      ? extractGeminiUsage(rawPayload)
      : extractOpenAIUsage(rawPayload)
  const pricing = estimateUsageCostUsd(
    providerUsed,
    modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
    usage,
  )

  return {
    providerUsed,
    modelUsed: modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
    rawPayload,
    providerFailures,
    usage,
    pricing,
    turn,
  }
}

function buildFallbackRichTextBlock(html: string) {
  return {
    id: `ai-text-${crypto.randomUUID()}`,
    type: "rich_text",
    content: html,
    layout: {
      gridColumns: 12,
      align: "left",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      backgroundColor: "transparent",
      backgroundImageUrl: "",
      backgroundImageSize: "cover",
      borderRadius: 0,
      contentAlignX: "stretch",
      contentAlignY: "top",
      contentGap: 0,
      minHeight: 0,
    },
  }
}

function coerceLayoutJsonToBuilderCompatibleJson(layoutJson: Record<string, unknown>) {
  const record = layoutJson && typeof layoutJson === "object" ? layoutJson : {}
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  const rootBlocks = Array.isArray(record.blocks) ? record.blocks : null
  const projectBlocks = Array.isArray(projectData?.blocks) ? projectData.blocks : null
  const htmlFromRecord = typeof record.html === "string" ? record.html.trim() : ""
  const htmlFromProjectData = projectData && typeof projectData.html === "string" ? String(projectData.html).trim() : ""
  const html = htmlFromRecord || htmlFromProjectData

  if (html) {
    const parsedHtml = parseJsonFromString(html)
    if (parsedHtml && typeof parsedHtml === "object" && !Array.isArray(parsedHtml)) {
      return coerceLayoutJsonToBuilderCompatibleJson(parsedHtml as Record<string, unknown>)
    }
  }

  if (projectBlocks && projectBlocks.length > 0) {
    return {
      ...record,
      projectData: {
        ...projectData,
        blocks: projectBlocks,
      },
    }
  }

  if (rootBlocks && rootBlocks.length > 0) {
    return {
      ...record,
      projectData: {
        ...(projectData ?? {}),
        blocks: rootBlocks,
      },
    }
  }

  if (html) {
    return {
      ...record,
      projectData: {
        ...(projectData ?? {}),
        blocks: [buildFallbackRichTextBlock(html)],
      },
      html,
    }
  }

  return null
}

async function callGemini(input: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  attachments: AttachmentInput[]
  responseSchema: Record<string, unknown>
}) {
  const parts = [{ text: input.userPrompt }]
  for (const attachment of input.attachments) {
    const parsed = extractDataUrlParts(attachment.data_url)
    if (!parsed) continue
    parts.push({
      inline_data: {
        mime_type: parsed.mimeType,
        data: parsed.base64,
      },
    } as Record<string, unknown>)
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseJsonSchema: input.responseSchema,
        },
      }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseErrorMessage(payload, `Gemini retornou ${response.status}`))
  }

  const text = extractTextFromGeminiResponse(payload)
  if (!text.trim()) {
    throw unprocessable("Gemini não devolveu um JSON válido")
  }

  return {
    raw: payload,
    text,
  }
}

async function callOpenAI(input: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  attachments: AttachmentInput[]
  responseSchema: Record<string, unknown>
}) {
  const inputItems: Array<Record<string, unknown>> = [
    {
      role: "user",
      content: [{ type: "input_text", text: input.userPrompt }],
    },
  ]

  for (const attachment of input.attachments) {
    if (!attachment.data_url.trim()) continue
    inputItems.push({
      role: "user",
      content: [
        {
          type: "input_image",
          image_url: attachment.data_url,
          detail: "high",
        },
      ],
    })
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      instructions: input.systemPrompt,
      input: inputItems,
      temperature: 0.3,
      max_output_tokens: 3000,
      text: {
        format: {
          type: "json_schema",
          name: "ai_page_editor_proposal",
          strict: true,
          schema: input.responseSchema,
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseErrorMessage(payload, `OpenAI retornou ${response.status}`))
  }

  const text = extractTextFromOpenAIResponse(payload)
  if (!text.trim()) {
    throw unprocessable("OpenAI não devolveu um JSON válido")
  }

  return {
    raw: payload,
    text,
  }
}

function formatProviderFailureDetails(
  failures: Array<{ provider: AiProvider; message: string }>,
  fallbackMessage = "sem detalhes adicionais",
) {
  return failures.length
    ? failures.map((item) => `${item.provider}: ${item.message}`).join(" | ")
    : fallbackMessage
}

function validateUnderstandingTurn(value: unknown): UnderstandingTurn {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw unprocessable("A resposta de entendimento da IA veio em formato invÃ¡lido.")
  }

  const record = value as Record<string, unknown>
  const phase =
    record.phase === "needs_clarification" || record.phase === "awaiting_intent_confirmation"
      ? record.phase
      : null

  if (!phase) {
    throw unprocessable("A resposta de entendimento da IA nÃ£o informou uma fase vÃ¡lida.")
  }

  const classification =
    record.classification === "clear" ||
      record.classification === "ambiguous" ||
      record.classification === "incomplete" ||
      record.classification === "multiple_targets"
      ? record.classification
      : null

  if (!classification) {
    throw unprocessable("A resposta de entendimento da IA nÃ£o informou uma classificaÃ§Ã£o vÃ¡lida.")
  }

  const understandingSummary = sanitizeConversationText(normalizeString(record.understanding_summary))
  const clarificationQuestion = sanitizeConversationText(normalizeString(record.clarification_question))
  const assistantMessage = sanitizeConversationText(normalizeString(record.assistant_message))
  const quickReplies = normalizeConversationReplies(record.quick_replies)

  if (!assistantMessage || !understandingSummary) {
    throw unprocessable("A resposta de entendimento da IA veio incompleta.")
  }

  return {
    phase,
    classification,
    assistant_message:
      phase === "needs_clarification" && clarificationQuestion
        ? [assistantMessage, clarificationQuestion].filter(Boolean).join("\n\n")
        : assistantMessage,
    understanding_summary: understandingSummary,
    clarification_question: clarificationQuestion || null,
    quick_replies:
      quickReplies.length > 0
        ? quickReplies
        : phase === "awaiting_intent_confirmation"
          ? ["Sim, Ã© isso", "NÃ£o, quero explicar melhor"]
          : [],
    ambiguity_detected: record.ambiguity_detected === true,
  }
}

function validateProposal(value: unknown) {
  if (!value || typeof value !== "object") {
    throw unprocessable("Resposta da IA em formato inválido")
  }

  const record = value as Record<string, unknown>
  const summary = normalizeString(record.summary)
  const explanation = normalizeString(record.explanation)
  const warnings = normalizeStringArray(record.warnings)
  const proposal = record.proposal && typeof record.proposal === "object" ? (record.proposal as Record<string, unknown>) : null

  if (!summary) throw unprocessable("A IA não devolveu um resumo válido")
  if (!explanation) throw unprocessable("A IA não devolveu uma explicação válida")
  if (!proposal) throw unprocessable("A IA não devolveu uma proposta válida")

  const slug = normalizeString(proposal.slug)
  const title = normalizeString(proposal.title)
  const layoutJson = normalizeJsonObjectField(proposal.layout_json, "layout_json")
  const styleJson = normalizeJsonObjectField(proposal.style_json, "style_json", true)
  const metadata = normalizeJsonObjectField(proposal.metadata, "metadata", true)

  if (!slug || !title || !layoutJson || !styleJson) {
    throw unprocessable("A proposta da IA está incompleta")
  }

  const normalizedLayoutJson = coerceLayoutJsonToBuilderCompatibleJson(layoutJson)
  if (!normalizedLayoutJson) {
    throw unprocessable("A proposta da IA precisa incluir projectData.blocks ou um HTML convertível")
  }

  return {
    summary,
    explanation,
    warnings,
    edit_plan: record.edit_plan ?? null,
    proposal: {
      slug,
      title,
      layout_json: normalizedLayoutJson,
      style_json: styleJson,
      metadata,
    },
  }
}

function validateFooterCopyProposal(value: unknown) {
  if (!value || typeof value !== "object") {
    throw unprocessable("Resposta da IA em formato inválido")
  }

  const record = value as Record<string, unknown>
  const summary = normalizeString(record.summary)
  const explanation = normalizeString(record.explanation)
  const warnings = normalizeStringArray(record.warnings)
  const footerDescription = normalizeString(record.footer_description)

  if (!summary) throw unprocessable("A IA não devolveu um resumo válido")
  if (!explanation) throw unprocessable("A IA não devolveu uma explicação válida")
  if (!footerDescription) throw unprocessable("A IA não devolveu um texto válido para o rodapé")

  return {
    summary,
    explanation,
    warnings,
    footer_description: footerDescription,
  }
}

function validateHeaderCopyProposal(value: unknown) {
  if (!value || typeof value !== "object") {
    throw unprocessable("Resposta da IA em formato inválido")
  }

  const record = value as Record<string, unknown>
  const summary = normalizeString(record.summary)
  const explanation = normalizeString(record.explanation)
  const warnings = normalizeStringArray(record.warnings)
  const headerAnnouncement = normalizeString(record.header_announcement)

  if (!summary) throw unprocessable("A IA não devolveu um resumo válido")
  if (!explanation) throw unprocessable("A IA não devolveu uma explicação válida")
  if (!headerAnnouncement) throw unprocessable("A IA não devolveu um texto válido para o header")

  return {
    summary,
    explanation,
    warnings,
    header_announcement: headerAnnouncement,
  }
}

function stabilizeProposalForSafeApplication(input: {
  proposal: ReturnType<typeof validateProposal>
  message: string
  slug: string
  title: string
  path: string
  baseVersion: PatchEngineBaseVersion
  baseVersionSource: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  baseVersionSelectionReason: string
  publishedVersionId?: string | null
  latestDraftId?: string | null
  attachments: AttachmentInput[]
}) {
  const sourceProposal = requirePersistiblePageEditorProposal(input.proposal, "stabilize_proposal_input", {
    allowMissingEditPlan: true,
  })
  const rawEditPlan = input.proposal.edit_plan
  const normalizedPlan = normalizeAiEditPlan({
    rawEditPlan,
    message: input.message,
    slug: input.slug,
    path: input.path,
    legacyContractFallback: !rawEditPlan,
  })
  const refinedSpacingPlan = refineSpacingEditPlanForKnownWrappers({
    message: input.message,
    editPlan: normalizedPlan.editPlan,
    baseVersion: input.baseVersion,
  })
  if (!isKnownManagedSitePageSlug(input.slug)) {
    throw unprocessable("Esta fase do editor seguro está restrita a páginas com slug conhecido e site_page_versions.")
  }

  let patched
  try {
    patched = applyPatchPlan({
      slug: input.slug,
      title: input.title,
      path: input.path,
      message: input.message,
      editPlan: refinedSpacingPlan.editPlan,
      baseVersion: input.baseVersion,
      proposalLayoutJson: sourceProposal.proposal.layout_json,
      proposalStyleJson: sourceProposal.proposal.style_json,
      attachments: input.attachments.map((attachment) => ({
        name: attachment.name,
        mime_type: attachment.mime_type,
      })),
    })
  } catch (error) {
    throw unprocessable(error instanceof Error ? error.message : String(error))
  }

  return requirePersistiblePageEditorProposal({
    ...sourceProposal,
    warnings: [
      ...sourceProposal.warnings,
      ...(normalizedPlan.planSource === "legacy_compat"
        ? [
            "Compatibilidade protegida: o plano de edição foi inferido no backend a partir do pedido atual para manter o contrato novo sem quebrar o launcher atual.",
          ]
        : []),
      ...refinedSpacingPlan.warnings,
      ...patched.warnings,
    ],
    edit_plan: refinedSpacingPlan.editPlan,
    proposal: {
      slug: input.slug,
      title: input.title,
      layout_json: patched.layoutJson,
      style_json: patched.styleJson,
      metadata: {
        ...sourceProposal.proposal.metadata,
        ai_contract_version: "hybrid_v1",
        ai_edit_plan: refinedSpacingPlan.editPlan,
        ai_invariants: {
          ...normalizedPlan.invariants,
          ...patched.invariants,
          spacing_diagnosis: refinedSpacingPlan.diagnosis,
          target_resolutions: patched.resolutions,
          context_source: input.baseVersionSource,
          degraded_draft_bypassed: input.degradedDraftBypassed,
          context_selection_reason: input.baseVersionSelectionReason,
          published_version_id: input.publishedVersionId ?? null,
          latest_draft_id: input.latestDraftId ?? null,
        },
        base_version: {
          id: input.baseVersion.id,
          version_number: input.baseVersion.version_number,
          status: input.baseVersion.status,
        },
      },
    },
  }, "stabilize_proposal_output")
}

async function getProviderSecrets(serviceClient: ReturnType<typeof createServiceClient>) {
  const [geminiApiKey, openaiApiKey] = await Promise.all([
    readSecret(serviceClient, GEMINI_SECRET_NAME),
    readSecret(serviceClient, OPENAI_SECRET_NAME),
  ])

  return {
    geminiApiKey,
    openaiApiKey,
    secret_status: normalizeSecretStatus(Boolean(geminiApiKey), Boolean(openaiApiKey)),
  }
}

async function testProviderByName(input: {
  provider: AiProvider
  model: string
  apiKey: string | null
}) {
  if (!input.apiKey) {
    return {
      ok: false,
      status: "missing_key" as const,
      message: `${input.provider} sem chave configurada`,
    }
  }

  const systemPrompt = "Responde apenas com JSON válido com o formato {\"ok\":true}."
  const userPrompt = "Gera JSON mínimo para testar conectividade."

  if (input.provider === "gemini") {
    try {
      const result = await callGemini({
        apiKey: input.apiKey,
        model: input.model || DEFAULT_GEMINI_MODEL,
        systemPrompt,
        userPrompt,
        attachments: [],
        responseSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
          },
          required: ["ok"],
        },
      })
      const parsed = parseJsonFromString(result.text)
      return {
        ok: Boolean(parsed && typeof parsed === "object"),
        status: "ok" as const,
        message: "Gemini respondeu com sucesso",
        usage: extractGeminiUsage(result.raw),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no Gemini"
      return {
        ok: false,
        status: isQuotaExceededErrorMessage(message) ? "quota_exceeded" : "error",
        message,
        usage: null,
      }
    }
  }

  try {
    const result = await callOpenAI({
      apiKey: input.apiKey,
      model: input.model || DEFAULT_OPENAI_MODEL,
      systemPrompt,
      userPrompt,
      attachments: [],
      responseSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean" },
        },
        required: ["ok"],
      },
    })
    const parsed = parseJsonFromString(result.text)
    return {
      ok: Boolean(parsed && typeof parsed === "object"),
      status: "ok" as const,
      message: "OpenAI respondeu com sucesso",
      usage: extractOpenAIUsage(result.raw),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no OpenAI"
    return {
      ok: false,
      status: isQuotaExceededErrorMessage(message) ? "quota_exceeded" : "error",
      message,
      usage: null,
    }
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const serviceClient = createServiceClient()
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<Body>(req)

    if (!body.action) {
      throw badRequest("action e obrigatorio")
    }

    if (body.action === "get_config") {
      const [config, secrets] = await Promise.all([readConfig(serviceClient), getProviderSecrets(serviceClient)])

      return jsonResponse({
        success: true,
        request_id: requestId,
        config,
        secret_status: secrets.secret_status,
      })
    }

    if (body.action === "update_config") {
      const configValue = normalizeConfigValue(body.configValue ?? {})
      const savedConfig = await upsertConfig(serviceClient, context.user.id, configValue)

      if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) {
        await writeSecret(
          serviceClient,
          GEMINI_SECRET_NAME,
          body.geminiApiKey.trim(),
          "Chave Gemini usada pelo editor via IA",
        )
      }

      if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) {
        await writeSecret(
          serviceClient,
          OPENAI_SECRET_NAME,
          body.openaiApiKey.trim(),
          "Chave OpenAI usada como fallback do editor via IA",
        )
      }
      const secrets = await getProviderSecrets(serviceClient)

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_config_updated",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          enabled: configValue.enabled,
          allowed_paths: configValue.allowed_paths,
          primary_provider: configValue.primary_provider,
          fallback_provider: configValue.fallback_provider,
          gemini_secret_present: secrets.secret_status.gemini_api_key_present,
          openai_secret_present: secrets.secret_status.openai_api_key_present,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        config: savedConfig,
        secret_status: secrets.secret_status,
      })
    }

    if (body.action === "test_providers") {
      const config = await readConfig(serviceClient)
      const secrets = await getProviderSecrets(serviceClient)

      const providerOrder = [
        {
          provider: config.config_value.primary_provider,
          model: config.config_value.primary_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.primary_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
        {
          provider: config.config_value.fallback_provider,
          model: config.config_value.fallback_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.fallback_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
      ] as const

      const outcomes = []
      const providerResults = []
      for (const provider of providerOrder) {
        const result = await testProviderByName(provider)
        providerResults.push({
          provider: provider.provider,
          ok: result.ok,
          status: result.status,
          message: result.message,
        })
        outcomes.push(`${provider.provider}: ${result.message}`)

        if (result.ok && result.usage) {
          const pricing = estimateUsageCostUsd(provider.provider, provider.model, result.usage)
          await recordUsageEvent(serviceClient, {
            action: "test_providers",
            provider: provider.provider,
            model: provider.model,
            user_id: context.user.id,
            slug: null,
            path: null,
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            total_tokens: result.usage.total_tokens,
            estimated_cost_usd: pricing.estimated_cost_usd,
            currency: "USD",
            request_id: requestId,
            metadata: {
              pricing_source: pricing.pricing_source,
              result_status: result.status,
            },
          })
        }
      }

      const anyQuotaIssue = providerResults.some((item) => item.status === "quota_exceeded")
      const anyMissingKey = providerResults.some((item) => item.status === "missing_key")
      const summary = anyQuotaIssue
        ? "Teste executado, mas um provedor excedeu a quota disponível."
        : anyMissingKey
          ? "Teste executado, mas ao menos um provedor não tem chave configurada."
          : "Teste dos provedores executado com sucesso."

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_provider_tested",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          outcomes,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        provider_used: null,
        details: outcomes.join(" | "),
        summary,
        provider_results: providerResults,
        secret_status: secrets.secret_status,
      })
    }

    if (body.action === "get_usage_metrics") {
      const periodDays = normalizePeriodDays(body.periodDays)
      const metrics = await readUsageMetrics(serviceClient, periodDays)

      return jsonResponse({
        success: true,
        request_id: requestId,
        ...metrics,
      })
    }

    if (body.action === "generate_header_copy") {
      const title = normalizeString(body.title)
      const path = normalizeString(body.path)
      const message = normalizeString(body.message)
      const currentHeaderText = normalizeString(body.currentHeaderText ?? body.currentHtml)

      if (!title) throw badRequest("title e obrigatorio")
      if (!path) throw badRequest("path e obrigatorio")
      if (!message) throw badRequest("message e obrigatorio")
      if (!currentHeaderText) throw badRequest("currentHeaderText e obrigatorio")

      const config = await readConfig(serviceClient)
      if (!config.config_value.enabled) {
        throw forbidden("Editor via IA desativado")
      }

      const secrets = await getProviderSecrets(serviceClient)
      const systemPrompt = buildHeaderCopySystemPrompt(config.config_value, title, path)
      const userPrompt = buildHeaderCopyUserPrompt({
        message,
        currentHeaderText,
        currentTitle: title,
        currentPath: path,
      })

      const providerCandidates = [
        {
          provider: config.config_value.primary_provider,
          model: config.config_value.primary_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.primary_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
        {
          provider: config.config_value.fallback_provider,
          model: config.config_value.fallback_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.fallback_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
      ] as const

      let lastError: unknown = null
      const providerFailures: Array<{ provider: AiProvider; message: string }> = []
      let rawText = ""
      let providerUsed: AiProvider | null = null
      let modelUsed = ""
      let rawPayload: unknown = null

      for (const candidate of providerCandidates) {
        if (!candidate.apiKey) {
          const message = `${candidate.provider} sem chave configurada`
          providerFailures.push({ provider: candidate.provider, message })
          lastError = new Error(message)
          continue
        }

        try {
          const result =
            candidate.provider === "gemini"
              ? await callGemini({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_GEMINI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: [],
                  responseSchema: headerCopySchema,
                })
              : await callOpenAI({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_OPENAI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: [],
                  responseSchema: headerCopySchema,
                })

          rawText = result.text
          providerUsed = candidate.provider
          modelUsed = candidate.model
          rawPayload = result.raw
          lastError = null
          break
        } catch (error) {
          providerFailures.push({
            provider: candidate.provider,
            message: error instanceof Error ? error.message : String(error),
          })
          lastError = error
        }
      }

      if (!providerUsed || !rawText.trim()) {
        const details = providerFailures.length
          ? providerFailures.map((item) => `${item.provider}: ${item.message}`).join(" | ")
          : lastError instanceof Error
            ? lastError.message
            : "sem detalhes adicionais"
        throw new Error(`Nenhum provedor disponível para gerar a proposta. ${details}`)
      }

      const parsed = parseJsonFromString(rawText)
      const headerProposal = validateHeaderCopyProposal(parsed)
      const headerOperationalState = resolveTextProposalOperationalState({
        currentText: currentHeaderText,
        nextText: headerProposal.header_announcement,
      })

      const usage =
        providerUsed === "gemini"
          ? extractGeminiUsage(rawPayload)
          : providerUsed === "openai"
            ? extractOpenAIUsage(rawPayload)
            : { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
      const pricing =
        providerUsed
          ? estimateUsageCostUsd(
              providerUsed,
              modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
              usage,
            )
          : null

      if (providerUsed) {
        await recordUsageEvent(serviceClient, {
          action: "generate_proposal",
          provider: providerUsed,
          model: modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
          user_id: context.user.id,
          slug: "global-header",
          path,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens,
          estimated_cost_usd: pricing?.estimated_cost_usd ?? null,
          currency: "USD",
          request_id: requestId,
          metadata: {
            target_scope: "global_header",
            pricing_source: pricing?.pricing_source ?? null,
          },
        })
      }

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_header_copy_generated",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          path,
          provider_used: providerUsed,
        },
        ...auditMeta,
      })

      logInfo("AI page editor header copy generated", {
        request_id: requestId,
        user_id: context.user.id,
        path,
        provider_used: providerUsed,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        provider_used: providerUsed,
        summary: headerProposal.summary,
        explanation: headerProposal.explanation,
        warnings: headerProposal.warnings,
        header_announcement: headerProposal.header_announcement,
        final_status: headerOperationalState.final_status,
        change_detected: headerOperationalState.change_detected,
        draft_saved: headerOperationalState.draft_saved,
        preview_available: headerOperationalState.preview_available,
        change_summary: headerOperationalState.change_summary,
      })
    }

    if (body.action === "generate_footer_copy") {
      const title = normalizeString(body.title)
      const path = normalizeString(body.path)
      const message = normalizeString(body.message)
      const currentFooterText = normalizeString(body.currentFooterText ?? body.currentHtml)

      if (!title) throw badRequest("title e obrigatorio")
      if (!path) throw badRequest("path e obrigatorio")
      if (!message) throw badRequest("message e obrigatorio")
      if (!currentFooterText) throw badRequest("currentFooterText e obrigatorio")

      const config = await readConfig(serviceClient)
      if (!config.config_value.enabled) {
        throw forbidden("Editor via IA desativado")
      }

      const secrets = await getProviderSecrets(serviceClient)
      const systemPrompt = buildFooterCopySystemPrompt(config.config_value, title, path)
      const userPrompt = buildFooterCopyUserPrompt({
        message,
        currentFooterText,
        currentTitle: title,
        currentPath: path,
      })

      const providerCandidates = [
        {
          provider: config.config_value.primary_provider,
          model: config.config_value.primary_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.primary_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
        {
          provider: config.config_value.fallback_provider,
          model: config.config_value.fallback_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.fallback_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
      ] as const

      let lastError: unknown = null
      const providerFailures: Array<{ provider: AiProvider; message: string }> = []
      let rawText = ""
      let providerUsed: AiProvider | null = null
      let modelUsed = ""
      let rawPayload: unknown = null

      for (const candidate of providerCandidates) {
        if (!candidate.apiKey) {
          const message = `${candidate.provider} sem chave configurada`
          providerFailures.push({ provider: candidate.provider, message })
          lastError = new Error(message)
          continue
        }

        try {
          const result =
            candidate.provider === "gemini"
              ? await callGemini({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_GEMINI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: [],
                  responseSchema: footerCopySchema,
                })
              : await callOpenAI({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_OPENAI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: [],
                  responseSchema: footerCopySchema,
                })

          rawText = result.text
          providerUsed = candidate.provider
          modelUsed = candidate.model
          rawPayload = result.raw
          lastError = null
          break
        } catch (error) {
          providerFailures.push({
            provider: candidate.provider,
            message: error instanceof Error ? error.message : String(error),
          })
          lastError = error
        }
      }

      if (!providerUsed || !rawText.trim()) {
        const details = formatProviderFailureDetails(
          providerFailures,
          lastError instanceof Error ? lastError.message : "sem detalhes adicionais",
        )
        throw new Error(`Nenhum provedor disponível para gerar a proposta. ${details}`)
      }

      const parsed = parseJsonFromString(rawText)
      const footerProposal = validateFooterCopyProposal(parsed)
      const footerOperationalState = resolveTextProposalOperationalState({
        currentText: currentFooterText,
        nextText: footerProposal.footer_description,
      })

      const usage =
        providerUsed === "gemini"
          ? extractGeminiUsage(rawPayload)
          : providerUsed === "openai"
            ? extractOpenAIUsage(rawPayload)
            : { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
      const pricing =
        providerUsed
          ? estimateUsageCostUsd(
              providerUsed,
              modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
              usage,
            )
          : null

      if (providerUsed) {
        await recordUsageEvent(serviceClient, {
          action: "generate_proposal",
          provider: providerUsed,
          model: modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
          user_id: context.user.id,
          slug: "global-footer",
          path,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens,
          estimated_cost_usd: pricing?.estimated_cost_usd ?? null,
          currency: "USD",
          request_id: requestId,
          metadata: {
            target_scope: "global_footer",
            pricing_source: pricing?.pricing_source ?? null,
          },
        })
      }

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_footer_copy_generated",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          path,
          provider_used: providerUsed,
        },
        ...auditMeta,
      })

      logInfo("AI page editor footer copy generated", {
        request_id: requestId,
        user_id: context.user.id,
        path,
        provider_used: providerUsed,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        provider_used: providerUsed,
        summary: footerProposal.summary,
        explanation: footerProposal.explanation,
        warnings: footerProposal.warnings,
        footer_description: footerProposal.footer_description,
        final_status: footerOperationalState.final_status,
        change_detected: footerOperationalState.change_detected,
        draft_saved: footerOperationalState.draft_saved,
        preview_available: footerOperationalState.preview_available,
        change_summary: footerOperationalState.change_summary,
      })
    }

    if (body.action === "generate_proposal") {
      const slug = normalizeString(body.slug)
      const title = normalizeString(body.title)
      const path = normalizeString(body.path)
      const message = normalizeString(body.message)
      const currentHtml = normalizeString(body.currentHtml)
      const attachments = Array.isArray(body.attachments) ? body.attachments : []

      if (!slug) throw badRequest("slug e obrigatorio")
      if (!title) throw badRequest("title e obrigatorio")
      if (!path) throw badRequest("path e obrigatorio")
      if (!message) throw badRequest("message e obrigatorio")
      if (!attachments.every((item) => item && typeof item === "object")) {
        throw badRequest("attachments invalido")
      }

      const config = await readConfig(serviceClient)
      if (!config.config_value.enabled) {
        throw forbidden("Editor via IA desativado")
      }

      if (config.config_value.allowed_paths.length > 0 && !isPathAllowedByPatterns(path, config.config_value.allowed_paths)) {
        throw forbidden("Rota nao habilitada para o editor via IA")
      }

      if (!isKnownManagedSitePageSlug(slug)) {
        throw unprocessable("Esta fase do editor seguro está restrita a páginas públicas com slug conhecido.")
      }

      const managedPageContext = await fetchManagedBaseVersion(serviceClient, slug)
      const authoritativeLayoutJson = managedPageContext.baseVersion.layout_json
      const authoritativeStyleJson = managedPageContext.baseVersion.style_json

      const validAttachments = attachments.map((item, index) => {
        const attachment = item as AttachmentInput
        const name = normalizeString(attachment.name, `anexo-${index + 1}`)
        const mime_type = normalizeString(attachment.mime_type)
        const data_url = normalizeString(attachment.data_url)
        const size_bytes = Math.max(0, Number(attachment.size_bytes ?? 0))
        if (!data_url.startsWith("data:")) {
          throw badRequest(`Anexo ${index + 1} sem data URL valida`)
        }
        if (size_bytes > config.config_value.max_attachment_size_mb * 1024 * 1024) {
          throw badRequest(`Anexo ${index + 1} excede o limite configurado`)
        }
        return {
          name,
          mime_type,
          data_url,
          size_bytes,
        }
      })

      if (validAttachments.length > config.config_value.max_attachments) {
        throw badRequest("Número de anexos acima do limite configurado")
      }

      const conversationContext = normalizeConversationContext(body.conversationContext)
      const clientRequestId = normalizeString(body.client_request_id) || null
      const confirmationTokenMatches = matchesUnderstandingConfirmationToken(
        conversationContext.understanding_summary,
        conversationContext.confirmation_token,
      )
      const understandingConfirmed =
        isExplicitUnderstandingConfirmation(message, conversationContext.phase) &&
        Boolean(conversationContext.understanding_summary) &&
        (!conversationContext.confirmation_token || confirmationTokenMatches)
      const understandingRejected = isExplicitUnderstandingRejection(message, conversationContext.phase)
      const routingContext = {
        request_id: requestId,
        client_request_id: clientRequestId,
        slug,
        path,
        conversation_phase_received: conversationContext.phase,
        understanding_summary_used: conversationContext.understanding_summary,
        confirmation_message: message,
        confirmation_token_received: conversationContext.confirmation_token,
        confirmation_token_matches: confirmationTokenMatches,
      }

      logInfo("AI page editor conversation routing evaluated", {
        ...routingContext,
        explicit_confirmation_detected: isExplicitUnderstandingConfirmation(message, conversationContext.phase),
        explicit_rejection_detected: understandingRejected,
        understanding_confirmed: understandingConfirmed,
      })

      if (!understandingConfirmed) {
        const secrets = await getProviderSecrets(serviceClient)
        const understanding = await generateUnderstandingTurn({
          config: config.config_value,
          secrets,
          title,
          path,
          message,
          conversationContext: understandingRejected
            ? {
                ...conversationContext,
                phase: "needs_clarification",
                understanding_summary: null,
              }
            : conversationContext,
        })
        const operationalState = createConversationOperationalState(understanding.turn.phase)

        await recordUsageEvent(serviceClient, {
          action: "generate_proposal",
          provider: understanding.providerUsed,
          model: understanding.modelUsed,
          user_id: context.user.id,
          slug,
          path,
          input_tokens: understanding.usage.input_tokens,
          output_tokens: understanding.usage.output_tokens,
          total_tokens: understanding.usage.total_tokens,
          estimated_cost_usd: understanding.pricing.estimated_cost_usd ?? null,
          currency: "USD",
          request_id: requestId,
          metadata: {
            attachment_count: validAttachments.length,
            conversation_phase: understanding.turn.phase,
            clarification_questions_count:
              understanding.turn.phase === "needs_clarification"
                ? Math.min(3, conversationContext.clarification_questions_count + 1)
                : conversationContext.clarification_questions_count,
            user_confirmed_understanding: false,
            understanding_summary: understanding.turn.understanding_summary,
            ambiguity_detected: understanding.turn.ambiguity_detected,
            quick_reply_selected: conversationContext.quick_reply_selected,
            quick_replies: understanding.turn.quick_replies,
            provider_failures: understanding.providerFailures,
            pricing_source: understanding.pricing.pricing_source ?? null,
          },
        })

        logInfo("AI page editor understanding progressed", {
          request_id: requestId,
          client_request_id: clientRequestId,
          user_id: context.user.id,
          slug,
          path,
          conversation_phase: understanding.turn.phase,
          branch_selected: "understanding_turn",
        })

        return jsonResponse({
          success: true,
          request_id: requestId,
          client_request_id: clientRequestId,
          provider_used: understanding.providerUsed,
          conversation_phase: understanding.turn.phase,
          assistant_message: understanding.turn.assistant_message,
          quick_replies: understanding.turn.quick_replies,
          understanding_summary: understanding.turn.understanding_summary,
          confirmation_token:
            understanding.turn.phase === "awaiting_intent_confirmation"
              ? buildUnderstandingConfirmationToken(understanding.turn.understanding_summary)
              : null,
          confirmation_consumed: false,
          requires_user_confirmation: understanding.turn.phase === "awaiting_intent_confirmation",
          can_generate_proposal: false,
          warnings: [],
          ...operationalState,
        })
      }

      const deterministicProposal = materializeConfirmedIntentProposal({
        providerUsed: config.config_value.primary_provider,
        modelUsed:
          config.config_value.primary_provider === "gemini"
            ? config.config_value.gemini_model || DEFAULT_GEMINI_MODEL
            : config.config_value.openai_model || DEFAULT_OPENAI_MODEL,
        confirmationMessage: message,
        slug,
        title,
        path,
        conversationContext,
        baseVersion: managedPageContext.baseVersion,
        baseVersionSource: managedPageContext.baseVersionSource,
        degradedDraftBypassed: managedPageContext.degradedDraftBypassed,
        baseVersionSelectionReason: managedPageContext.baseVersionSelectionReason,
        publishedVersionId: managedPageContext.publishedVersion?.id ? String(managedPageContext.publishedVersion.id) : null,
        latestDraftId: managedPageContext.latestDraft?.id ? String(managedPageContext.latestDraft.id) : null,
      })

      logInfo("AI page editor confirmed intent branch decided", {
        ...routingContext,
        branch_selected:
          deterministicProposal.status === "success"
            ? "confirmed_intent_patch"
            : deterministicProposal.status === "failed"
              ? "confirmed_intent_patch_failed"
              : "provider_full_proposal",
        confirmed_intent_scope: deterministicProposal.scope,
        fallback_reason: deterministicProposal.status === "not_applicable" ? deterministicProposal.reason : null,
        patch_failure_reason: deterministicProposal.status === "failed" ? deterministicProposal.reason : null,
      })

      if (deterministicProposal.status === "success") {
        const proposalInvariants = extractPersistibleProposalInvariants({
          proposal: deterministicProposal.proposal,
        })

        await recordUsageEvent(serviceClient, {
          action: "generate_proposal",
          provider: deterministicProposal.providerUsed,
          model: deterministicProposal.modelUsed,
          user_id: context.user.id,
          slug,
          path,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0,
          currency: "USD",
          request_id: requestId,
          mode: deterministicProposal.editPlan.mode,
          scope: deterministicProposal.editPlan.scope,
          risk_level: deterministicProposal.editPlan.risk_level,
          target_ids: deterministicProposal.editPlan.target_ids,
          requires_strict_confirmation: deterministicProposal.editPlan.requires_strict_confirmation,
          contract_version: normalizeString(deterministicProposal.proposal.metadata.ai_contract_version, "hybrid_v1"),
          invariants: proposalInvariants,
          metadata: {
            attachment_count: validAttachments.length,
            conversation_phase: deterministicProposal.conversationPhase,
            clarification_questions_count: conversationContext.clarification_questions_count,
            user_confirmed_understanding: true,
            understanding_summary: deterministicProposal.understandingSummary,
            ambiguity_detected: false,
            quick_reply_selected: conversationContext.quick_reply_selected,
            proposal_summary: deterministicProposal.summary,
            edit_plan_operation_count: deterministicProposal.editPlan.operations.length,
            warning_count: deterministicProposal.warnings.length,
            target_resolution_count: Array.isArray(proposalInvariants.target_resolutions)
              ? proposalInvariants.target_resolutions.length
              : 0,
            require_confirmation: config.config_value.require_confirmation,
            pricing_source: "deterministic_confirmed_intent",
            base_version_id: managedPageContext.baseVersion.id,
            base_version_number: managedPageContext.baseVersion.version_number,
            base_version_status: managedPageContext.baseVersion.status,
            context_source: managedPageContext.baseVersionSource,
            degraded_draft_bypassed: managedPageContext.degradedDraftBypassed,
            context_selection_reason: managedPageContext.baseVersionSelectionReason,
            published_version_id: managedPageContext.publishedVersion?.id ?? null,
            latest_draft_id: managedPageContext.latestDraft?.id ?? null,
            provider_failures: [],
            mode: deterministicProposal.editPlan.mode,
            scope: deterministicProposal.editPlan.scope,
            risk_level: deterministicProposal.editPlan.risk_level,
            target_ids: deterministicProposal.editPlan.target_ids,
            requires_strict_confirmation: deterministicProposal.editPlan.requires_strict_confirmation,
            contract_version: normalizeString(deterministicProposal.proposal.metadata.ai_contract_version, "hybrid_v1"),
            invariants: proposalInvariants,
            final_status: deterministicProposal.operationalState.final_status,
            change_detected: deterministicProposal.operationalState.change_detected,
            draft_saved: deterministicProposal.operationalState.draft_saved,
            preview_available: deterministicProposal.operationalState.preview_available,
            change_summary: deterministicProposal.operationalState.change_summary,
            materialized_deterministically: true,
            confirmed_intent_source_text: deterministicProposal.sourceText,
          },
        })

        await writeAuditLog(serviceClient, context, {
          action: "admin.ai_page_editor_proposal_generated",
          entityType: "site_config",
          entityId: null,
          metadata: {
            config_key: CONFIG_KEY,
            slug,
            path,
            provider_used: deterministicProposal.providerUsed,
            attachment_count: validAttachments.length,
            conversation_phase: deterministicProposal.conversationPhase,
            clarification_questions_count: conversationContext.clarification_questions_count,
            user_confirmed_understanding: true,
            understanding_summary: deterministicProposal.understandingSummary,
            ambiguity_detected: false,
            quick_reply_selected: conversationContext.quick_reply_selected,
            proposal_summary: deterministicProposal.summary,
            edit_plan_operation_count: deterministicProposal.editPlan.operations.length,
            warning_count: deterministicProposal.warnings.length,
            target_resolution_count: Array.isArray(proposalInvariants.target_resolutions)
              ? proposalInvariants.target_resolutions.length
              : 0,
            base_version_id: managedPageContext.baseVersion.id,
            base_version_number: managedPageContext.baseVersion.version_number,
            base_version_status: managedPageContext.baseVersion.status,
            context_source: managedPageContext.baseVersionSource,
            degraded_draft_bypassed: managedPageContext.degradedDraftBypassed,
            context_selection_reason: managedPageContext.baseVersionSelectionReason,
            published_version_id: managedPageContext.publishedVersion?.id ?? null,
            latest_draft_id: managedPageContext.latestDraft?.id ?? null,
            provider_failures: [],
            mode: deterministicProposal.editPlan.mode,
            scope: deterministicProposal.editPlan.scope,
            risk_level: deterministicProposal.editPlan.risk_level,
            target_ids: deterministicProposal.editPlan.target_ids,
            requires_strict_confirmation: deterministicProposal.editPlan.requires_strict_confirmation,
            contract_version: normalizeString(deterministicProposal.proposal.metadata.ai_contract_version, "hybrid_v1"),
            invariants: proposalInvariants,
            final_status: deterministicProposal.operationalState.final_status,
            change_detected: deterministicProposal.operationalState.change_detected,
            draft_saved: deterministicProposal.operationalState.draft_saved,
            preview_available: deterministicProposal.operationalState.preview_available,
            change_summary: deterministicProposal.operationalState.change_summary,
            materialized_deterministically: true,
            confirmed_intent_source_text: deterministicProposal.sourceText,
          },
          ...auditMeta,
        })

        logInfo("AI page editor proposal materialized from confirmed intent", {
          request_id: requestId,
          client_request_id: clientRequestId,
          user_id: context.user.id,
          slug,
          path,
          conversation_phase: deterministicProposal.conversationPhase,
          target_ids: deterministicProposal.editPlan.target_ids,
          branch_selected: "confirmed_intent_patch",
        })

        return jsonResponse({
          success: true,
          request_id: requestId,
          client_request_id: clientRequestId,
          provider_used: deterministicProposal.providerUsed,
          conversation_phase: deterministicProposal.conversationPhase,
          assistant_message: deterministicProposal.assistantMessage,
          quick_replies: [],
          understanding_summary: deterministicProposal.understandingSummary,
          confirmation_token: null,
          confirmation_consumed: true,
          requires_user_confirmation: deterministicProposal.requiresUserConfirmation,
          can_generate_proposal: deterministicProposal.canGenerateProposal,
          warnings: deterministicProposal.warnings,
          summary: deterministicProposal.summary,
          explanation: deterministicProposal.explanation,
          edit_plan: deterministicProposal.editPlan,
          proposal: deterministicProposal.proposal,
          ...deterministicProposal.operationalState,
        })
      }

      if (deterministicProposal.status === "failed") {
        const friendlyFailure = createFriendlyConfirmedIntentFailureResponse({
          requestId,
          clientRequestId,
          providerUsed: config.config_value.primary_provider,
          understandingSummary: deterministicProposal.understandingSummary,
          assistantMessage: deterministicProposal.assistantMessage,
          warnings: deterministicProposal.warnings,
        })

        await writeAuditLog(serviceClient, context, {
          action: "admin.ai_page_editor_proposal_generated",
          entityType: "site_config",
          entityId: null,
          metadata: {
            config_key: CONFIG_KEY,
            slug,
            path,
            provider_used: config.config_value.primary_provider,
            conversation_phase: friendlyFailure.conversation_phase,
            user_confirmed_understanding: true,
            understanding_summary: deterministicProposal.understandingSummary,
            quick_reply_selected: conversationContext.quick_reply_selected,
            final_status: friendlyFailure.final_status,
            branch_selected: "confirmed_intent_patch",
            fallback_allowed: false,
            fallback_reason: deterministicProposal.reason,
            confirmed_intent_scope: deterministicProposal.scope,
            confirmed_intent_source_text: deterministicProposal.sourceText,
          },
          ...auditMeta,
        })

        logWarn("AI page editor confirmed intent patch failed without provider fallback", {
          ...routingContext,
          branch_selected: "confirmed_intent_patch",
          final_status: friendlyFailure.final_status,
          confirmed_intent_scope: deterministicProposal.scope,
          fallback_allowed: false,
          fallback_reason: deterministicProposal.reason,
        })

        return jsonResponse(friendlyFailure)
      }

      const secrets = await getProviderSecrets(serviceClient)
      const systemPrompt = buildSystemPrompt(config.config_value, title, path)
      const userPrompt = buildUserPrompt({
        message,
        currentHtml,
        currentLayoutJson: authoritativeLayoutJson,
        currentStyleJson: authoritativeStyleJson,
        attachments: validAttachments,
        understandingSummary: conversationContext.understanding_summary,
      })

      const providerCandidates = [
        {
          provider: config.config_value.primary_provider,
          model: config.config_value.primary_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.primary_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
        {
          provider: config.config_value.fallback_provider,
          model: config.config_value.fallback_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.fallback_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
      ] as const

      let lastError: unknown = null
      const providerFailures: Array<{ provider: AiProvider; message: string }> = []
      let rawText = ""
      let providerUsed: AiProvider | null = null
      let modelUsed = ""
      let rawPayload: unknown = null

      for (const candidate of providerCandidates) {
        if (!candidate.apiKey) {
          const message = `${candidate.provider} sem chave configurada`
          providerFailures.push({ provider: candidate.provider, message })
          lastError = new Error(message)
          continue
        }

        try {
          const result =
            candidate.provider === "gemini"
              ? await callGemini({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_GEMINI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: validAttachments,
                  responseSchema: proposalSchema,
                })
              : await callOpenAI({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_OPENAI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: validAttachments,
                  responseSchema: proposalSchema,
                })

          rawText = result.text
          providerUsed = candidate.provider
          modelUsed = candidate.model
          rawPayload = result.raw
          lastError = null
          break
        } catch (error) {
          providerFailures.push({
            provider: candidate.provider,
            message: error instanceof Error ? error.message : String(error),
          })
          lastError = error
        }
      }

      if (!providerUsed || !rawText.trim()) {
        const details = formatProviderFailureDetails(
          providerFailures,
          lastError instanceof Error ? lastError.message : "sem detalhes adicionais",
        )
        throw new Error(`Nenhum provedor disponível para gerar a proposta. ${details}`)
      }

      const parsed = parseJsonFromString(rawText)
      const proposal = requirePersistiblePageEditorProposal(stabilizeProposalForSafeApplication({
        proposal: validateProposal(parsed),
        message,
        slug,
        title,
        path,
        baseVersion: managedPageContext.baseVersion,
        baseVersionSource: managedPageContext.baseVersionSource,
        degradedDraftBypassed: managedPageContext.degradedDraftBypassed,
        baseVersionSelectionReason: managedPageContext.baseVersionSelectionReason,
        publishedVersionId: managedPageContext.publishedVersion?.id ? String(managedPageContext.publishedVersion.id) : null,
        latestDraftId: managedPageContext.latestDraft?.id ? String(managedPageContext.latestDraft.id) : null,
        attachments: validAttachments,
      }), "generate_proposal_response")
      const editPlan = proposal.edit_plan
      const proposalInvariants = extractPersistibleProposalInvariants(proposal)
      const previewRenderable = proposalInvariants.preview_renderable !== false
      const desktopRenderable = proposalInvariants.desktop_renderable !== false
      const mobileRenderable = proposalInvariants.mobile_renderable !== false
      const operationalState = resolvePersistibleProposalOperationalState({
        editPlan,
        baseLayoutJson: managedPageContext.baseVersion.layout_json,
        baseStyleJson: managedPageContext.baseVersion.style_json,
        proposalLayoutJson: proposal.proposal.layout_json,
        proposalStyleJson: proposal.proposal.style_json,
        targetResolutions: Array.isArray(proposalInvariants.target_resolutions)
          ? proposalInvariants.target_resolutions
          : [],
        previewRenderable,
        desktopRenderable,
        mobileRenderable,
      })
      const confirmedUnderstandingSummary = sanitizeConversationText(
        conversationContext.understanding_summary ?? proposal.summary,
      )
      const assistantMessage =
        operationalState.final_status === "no_visible_change"
          ? "Entendi, mas esta tentativa nÃ£o mostrou uma mudanÃ§a visÃ­vel. Se quiseres, explica de outra forma."
          : operationalState.final_status === "blocked" || operationalState.final_status === "error"
            ? "Entendi o pedido, mas ainda nÃ£o consegui preparar isso com seguranÃ§a. Se quiseres, posso tentar de novo com mais detalhe."
            : "Entendi. Vou preparar a alteraÃ§Ã£o para tu veres antes de publicar."

      const usage =
        providerUsed === "gemini"
          ? extractGeminiUsage(rawPayload)
          : providerUsed === "openai"
            ? extractOpenAIUsage(rawPayload)
            : { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
      const pricing =
        providerUsed
          ? estimateUsageCostUsd(
              providerUsed,
              modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
              usage,
            )
          : null

      if (providerUsed) {
        await recordUsageEvent(serviceClient, {
          action: "generate_proposal",
          provider: providerUsed,
          model: modelUsed || (providerUsed === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
          user_id: context.user.id,
          slug,
          path,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens,
          estimated_cost_usd: pricing?.estimated_cost_usd ?? null,
          currency: "USD",
          request_id: requestId,
          mode: editPlan?.mode ?? null,
          scope: editPlan?.scope ?? null,
          risk_level: editPlan?.risk_level ?? null,
          target_ids: editPlan?.target_ids ?? [],
          requires_strict_confirmation: editPlan?.requires_strict_confirmation ?? false,
          contract_version: normalizeString(proposal.proposal.metadata.ai_contract_version, "hybrid_v1"),
          invariants: proposalInvariants,
          metadata: {
            attachment_count: validAttachments.length,
            conversation_phase: "ready_for_proposal",
            clarification_questions_count: conversationContext.clarification_questions_count,
            user_confirmed_understanding: true,
            understanding_summary: confirmedUnderstandingSummary,
            ambiguity_detected: false,
            quick_reply_selected: conversationContext.quick_reply_selected,
            proposal_summary: proposal.summary,
            edit_plan_operation_count: editPlan?.operations.length ?? 0,
            warning_count: proposal.warnings.length,
            target_resolution_count: Array.isArray(proposalInvariants.target_resolutions)
              ? proposalInvariants.target_resolutions.length
              : 0,
            require_confirmation: config.config_value.require_confirmation,
            pricing_source: pricing?.pricing_source ?? null,
            base_version_id: managedPageContext.baseVersion.id,
            base_version_number: managedPageContext.baseVersion.version_number,
            base_version_status: managedPageContext.baseVersion.status,
            context_source: managedPageContext.baseVersionSource,
            degraded_draft_bypassed: managedPageContext.degradedDraftBypassed,
            context_selection_reason: managedPageContext.baseVersionSelectionReason,
            published_version_id: managedPageContext.publishedVersion?.id ?? null,
            latest_draft_id: managedPageContext.latestDraft?.id ?? null,
            provider_failures: providerFailures,
            mode: editPlan?.mode ?? null,
            scope: editPlan?.scope ?? null,
            risk_level: editPlan?.risk_level ?? null,
            target_ids: editPlan?.target_ids ?? [],
            requires_strict_confirmation: editPlan?.requires_strict_confirmation ?? false,
            contract_version: normalizeString(proposal.proposal.metadata.ai_contract_version, "hybrid_v1"),
            invariants: proposalInvariants,
            final_status: operationalState.final_status,
            change_detected: operationalState.change_detected,
            draft_saved: operationalState.draft_saved,
            preview_available: operationalState.preview_available,
            change_summary: operationalState.change_summary,
            branch_selected: "provider_full_proposal",
            fallback_reason: deterministicProposal.reason,
          },
        })
      }

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_proposal_generated",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          slug,
          path,
          provider_used: providerUsed,
          attachment_count: validAttachments.length,
          conversation_phase: "ready_for_proposal",
          clarification_questions_count: conversationContext.clarification_questions_count,
          user_confirmed_understanding: true,
          understanding_summary: confirmedUnderstandingSummary,
          ambiguity_detected: false,
          quick_reply_selected: conversationContext.quick_reply_selected,
          proposal_summary: proposal.summary,
          edit_plan_operation_count: editPlan?.operations.length ?? 0,
          warning_count: proposal.warnings.length,
          target_resolution_count: Array.isArray(proposalInvariants.target_resolutions)
            ? proposalInvariants.target_resolutions.length
            : 0,
          base_version_id: managedPageContext.baseVersion.id,
          base_version_number: managedPageContext.baseVersion.version_number,
          base_version_status: managedPageContext.baseVersion.status,
          context_source: managedPageContext.baseVersionSource,
          degraded_draft_bypassed: managedPageContext.degradedDraftBypassed,
          context_selection_reason: managedPageContext.baseVersionSelectionReason,
          published_version_id: managedPageContext.publishedVersion?.id ?? null,
          latest_draft_id: managedPageContext.latestDraft?.id ?? null,
          provider_failures: providerFailures,
          mode: editPlan?.mode ?? null,
          scope: editPlan?.scope ?? null,
          risk_level: editPlan?.risk_level ?? null,
          target_ids: editPlan?.target_ids ?? [],
          requires_strict_confirmation: editPlan?.requires_strict_confirmation ?? false,
          contract_version: normalizeString(proposal.proposal.metadata.ai_contract_version, "hybrid_v1"),
          invariants: proposalInvariants,
          final_status: operationalState.final_status,
          change_detected: operationalState.change_detected,
          draft_saved: operationalState.draft_saved,
          preview_available: operationalState.preview_available,
          change_summary: operationalState.change_summary,
          branch_selected: "provider_full_proposal",
          fallback_reason: deterministicProposal.reason,
        },
        ...auditMeta,
      })

      logInfo("AI page editor proposal generated", {
        request_id: requestId,
        user_id: context.user.id,
        slug,
        path,
        provider_used: providerUsed,
        mode: editPlan?.mode ?? null,
        scope: editPlan?.scope ?? null,
        risk_level: editPlan?.risk_level ?? null,
        client_request_id: clientRequestId,
        branch_selected: "provider_full_proposal",
        fallback_reason: deterministicProposal.reason,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        client_request_id: clientRequestId,
        provider_used: providerUsed,
        conversation_phase: "ready_for_proposal",
        assistant_message: assistantMessage,
        quick_replies: [],
        understanding_summary: confirmedUnderstandingSummary,
        confirmation_token: null,
        confirmation_consumed: true,
        requires_user_confirmation: false,
        can_generate_proposal: true,
        summary: proposal.summary,
        explanation: proposal.explanation,
        warnings: proposal.warnings,
        edit_plan: proposal.edit_plan,
        proposal: proposal.proposal,
        final_status: operationalState.final_status,
        change_detected: operationalState.change_detected,
        draft_saved: operationalState.draft_saved,
        preview_available: operationalState.preview_available,
        change_summary: operationalState.change_summary,
      })
    }

    throw badRequest("action invalida")
  } catch (error) {
    logError("Admin AI page editor failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
