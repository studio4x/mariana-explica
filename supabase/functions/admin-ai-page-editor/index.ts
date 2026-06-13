import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden, unprocessable } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

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

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
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
  ]

  for (const pattern of targetPatterns) {
    const match = normalized.match(pattern)
    const value = normalizeString(match?.[1])
    if (value) return value
  }

  const anyQuotePatterns = [/"([^"]+)"/, /'([^']+)'/]
  for (const pattern of anyQuotePatterns) {
    const match = normalized.match(pattern)
    const value = normalizeString(match?.[1])
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

function isCssClassEditRequest(message: string) {
  const normalized = normalizeMessageForParsing(message).toLowerCase()
  const cssKeywords = [
    "css",
    "classe",
    "class",
    "seletor",
    "selector",
    "padding",
    "margin",
    "max-width",
    "min-width",
    "width",
    "height",
    "gap",
    "border",
    "border-radius",
    "background",
  ]

  return hasKeyword(normalized, cssKeywords) || /(^|\\s)[.#][a-z0-9_-]+/i.test(normalized)
}

function isManagedBlockPage(layoutJson: Record<string, unknown>) {
  const record = layoutJson && typeof layoutJson === "object" ? layoutJson : {}
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  return (
    (Array.isArray(projectData?.blocks) && projectData.blocks.length > 0) ||
    (Array.isArray(record.blocks) && record.blocks.length > 0)
  )
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

function applyTypographyClassToBlock(
  block: Record<string, unknown>,
  targetPhrase: string,
  className: string,
): { block: Record<string, unknown>; matched: boolean } {
  const nextBlock = cloneJsonValue(block)
  const type = normalizeString(block.type).toLowerCase()

  if (type === "heading" && typeof block.content === "string" && block.content.includes(targetPhrase)) {
    nextBlock.customClassName = normalizeString(`${normalizeString(block.customClassName)} ${className}`)
    return { block: nextBlock, matched: true }
  }

  if (type === "button" && typeof block.label === "string" && block.label.includes(targetPhrase)) {
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

  if (!matched) return null
  return withBlocksAppliedToLayoutJson(currentLayoutJson, nextBlocks)
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

    const mergedTypographyStyle = mergeTypographyOnlyProposalWithCurrentStyles(
      nextStyleJson,
      input.proposal.proposal.style_json,
    )

    if (!mergedTypographyStyle) {
      throw unprocessable(
        "A proposta da IA não devolveu uma regra tipográfica segura para aplicar sem mexer no layout da página.",
      )
    }

    nextStyleJson = mergedTypographyStyle.styleJson
    warnings.push(mergedTypographyStyle.warning)
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

async function recordUsageEvent(
  serviceClient: ReturnType<typeof createServiceClient>,
  event: UsageEventRecord,
) {
  const { error } = await serviceClient.from("ai_page_editor_usage_events").insert(event)
  if (error) {
    throw error
  }
}

async function readUsageMetrics(
  serviceClient: ReturnType<typeof createServiceClient>,
  periodDays: number,
) {
  const sinceIso = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await serviceClient
    .from("ai_page_editor_usage_events")
    .select(
      "id,action,provider,model,slug,path,input_tokens,output_tokens,total_tokens,estimated_cost_usd,currency,request_id,metadata,created_at",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1000)

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
    "Quando precisares propor edição, devolve JSON válido apenas com summary, explanation, warnings e proposal.",
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
  currentLayoutJson: Record<string, unknown>
  currentStyleJson: Record<string, unknown>
}) {
  const textReplacement = extractTextEditReplacement(input.message)
  const typographyRequest = hasTypographyEditRequest(input.message)
  const textContentRequest = hasTextContentEditRequest(input.message) && !(typographyRequest && !textReplacement)
  const typographyTargetPhrase = typographyRequest ? extractQuotedTypographyTarget(input.message) : null
  const typographyDeclarations = typographyRequest ? extractTypographyDeclarations(input.message) : []
  const allowMediaChanges = requestExplicitlyMentionsMediaOrLayout(input.message)
  const structuralLayoutRequest = requestExplicitlyMentionsStructuralLayout(input.message)

  if ((!textContentRequest && !typographyRequest) || structuralLayoutRequest) {
    return input.proposal
  }

  return finalizeSafeTextAndTypographyProposal({
    proposal: input.proposal,
    currentLayoutJson: input.currentLayoutJson,
    currentStyleJson: input.currentStyleJson,
    textReplacement,
    textContentRequest,
    typographyRequest,
    typographyTargetPhrase,
    typographyDeclarations,
    allowMediaChanges,
  })

  if (textReplacement) {
    const replacedLayout = applyQuotedTextReplacementToLayout(input.currentLayoutJson, textReplacement)
    if (replacedLayout) {
      return {
        ...input.proposal,
        warnings: [
          ...input.proposal.warnings,
          "Aplicação protegida: a estrutura original da página foi preservada e apenas o texto solicitado foi alterado.",
        ],
        proposal: {
          ...input.proposal.proposal,
          layout_json: replacedLayout,
          style_json: cloneJsonValue(input.currentStyleJson),
        },
      }
    }
  }

  const mergedLayout = mergeTextOnlyProposalWithCurrentLayout(
    input.currentLayoutJson,
    input.proposal.proposal.layout_json,
    allowMediaChanges,
  )

  if (!mergedLayout) {
    throw unprocessable(
      "A proposta da IA alterou a estrutura da página num pedido textual. Nenhum rascunho foi aplicado para proteger o layout.",
    )
  }

  return {
    ...input.proposal,
    warnings: [
      ...input.proposal.warnings,
      "Aplicação protegida: o layout atual foi preservado e apenas os conteúdos textuais foram atualizados.",
    ],
    proposal: {
      ...input.proposal.proposal,
      layout_json: mergedLayout,
      style_json: cloneJsonValue(input.currentStyleJson),
    },
  }
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
      })
    }

    if (body.action === "generate_proposal") {
      const slug = normalizeString(body.slug)
      const title = normalizeString(body.title)
      const path = normalizeString(body.path)
      const message = normalizeString(body.message)
      const currentHtml = normalizeString(body.currentHtml)
      const currentLayoutJson = body.currentLayoutJson && typeof body.currentLayoutJson === "object" ? body.currentLayoutJson : {}
      const currentStyleJson = body.currentStyleJson && typeof body.currentStyleJson === "object" ? body.currentStyleJson : {}
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

      if (config.config_value.allowed_paths.length > 0 && !config.config_value.allowed_paths.includes(path)) {
        throw forbidden("Rota nao habilitada para o editor via IA")
      }

      if (
        isManagedBlockPage(currentLayoutJson) &&
        isCssClassEditRequest(message) &&
        !hasTypographyEditRequest(message)
      ) {
        throw unprocessable(
          "Pedido de CSS/classe estrutural detectado numa página gerida por blocos. Para proteger o layout, o editor IA só aplica aqui ajustes pontuais de texto e tipografia. Para padding, margens, larguras, grids ou wrappers, usa o editor visual ou um ajuste técnico no builder/base CSS.",
        )
      }

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

      const secrets = await getProviderSecrets(serviceClient)
      const systemPrompt = buildSystemPrompt(config.config_value, title, path)
      const userPrompt = buildUserPrompt({
        message,
        currentHtml,
        currentLayoutJson,
        currentStyleJson,
        attachments: validAttachments,
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
      const proposal = stabilizeProposalForSafeApplication({
        proposal: validateProposal(parsed),
        message,
        currentLayoutJson,
        currentStyleJson,
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
          slug,
          path,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens,
          estimated_cost_usd: pricing?.estimated_cost_usd ?? null,
          currency: "USD",
          request_id: requestId,
          metadata: {
            attachment_count: validAttachments.length,
            require_confirmation: config.config_value.require_confirmation,
            pricing_source: pricing?.pricing_source ?? null,
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
        },
        ...auditMeta,
      })

      logInfo("AI page editor proposal generated", {
        request_id: requestId,
        user_id: context.user.id,
        slug,
        path,
        provider_used: providerUsed,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        provider_used: providerUsed,
        summary: proposal.summary,
        explanation: proposal.explanation,
        warnings: proposal.warnings,
        proposal: proposal.proposal,
      })
    }

    throw badRequest("action invalida")
  } catch (error) {
    logError("Admin AI page editor failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
