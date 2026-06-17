import {
  isExplicitFooterTextEditRequest,
  isExplicitHeaderTextEditRequest,
  isFooterAdjacentSpacingRequest,
  isHeaderAdjacentSpacingRequest,
  isHeaderVisualSpacingRequest,
  isVisualSpacingIntent,
  wantsOnlyFirstSectionSpacing,
  wantsOnlyPageWrapperSpacing,
  wantsOnlySectionInternalSpacing,
} from "./spacing-intent.ts"

export const EDIT_SCOPES = ["text", "block", "section", "page", "header", "footer"] as const
export const EDIT_MODES = [
  "text_patch",
  "style_patch",
  "spacing_patch",
  "section_layout_patch",
  "image_patch",
  "section_replace",
] as const
export const RISK_LEVELS = ["low", "medium", "high"] as const
export const EDIT_OPERATION_TYPES = [
  "set_style",
  "remove_style",
  "update_text",
  "set_asset",
  "move_node",
  "replace_section",
  "set_responsive_rule",
  "wrap_children",
  "unwrap_children",
  "change_columns",
] as const
export const EDIT_BREAKPOINTS = ["mobile", "tablet", "desktop", "all"] as const

export type AiEditScope = (typeof EDIT_SCOPES)[number]
export type AiEditMode = (typeof EDIT_MODES)[number]
export type AiRiskLevel = (typeof RISK_LEVELS)[number]
export type AiEditOperationType = (typeof EDIT_OPERATION_TYPES)[number]
export type AiEditBreakpoint = (typeof EDIT_BREAKPOINTS)[number]
export type AiEditPlanSource = "model" | "heuristic" | "legacy_compat"

export interface AiEditOperation {
  type: AiEditOperationType
  target_id: string
  path?: string
  value?: unknown
  breakpoint: AiEditBreakpoint
}

export interface AiEditPlan {
  scope: AiEditScope
  mode: AiEditMode
  target_ids: string[]
  risk_level: AiRiskLevel
  requires_strict_confirmation: boolean
  operations: AiEditOperation[]
}

export interface NormalizedAiEditPlanResult {
  editPlan: AiEditPlan
  planSource: AiEditPlanSource
  invariants: Record<string, unknown>
}

export interface NormalizeAiEditPlanInput {
  rawEditPlan: unknown
  message: string
  slug?: string | null
  path?: string | null
  legacyContractFallback?: boolean
}

const MODE_ALIASES: Record<string, AiEditMode> = {
  text: "text_patch",
  text_patch: "text_patch",
  textpatch: "text_patch",
  copy_patch: "text_patch",
  typography_patch: "style_patch",
  style_patch: "style_patch",
  stylepatch: "style_patch",
  visual_patch: "style_patch",
  spacing_patch: "spacing_patch",
  spacingpatch: "spacing_patch",
  layout_patch: "section_layout_patch",
  section_layout_patch: "section_layout_patch",
  "section-layout-patch": "section_layout_patch",
  sectionlayoutpatch: "section_layout_patch",
  image_patch: "image_patch",
  imagepatch: "image_patch",
  section_replace: "section_replace",
  "section-replace": "section_replace",
  replace_section: "section_replace",
  sectionreplace: "section_replace",
}

const SCOPE_ALIASES: Record<string, AiEditScope> = {
  text: "text",
  phrase: "text",
  block: "block",
  card: "block",
  section: "section",
  hero: "section",
  page: "page",
  full_page: "page",
  header: "header",
  global_header: "header",
  footer: "footer",
  global_footer: "footer",
}

const OPERATION_ALIASES: Record<string, AiEditOperationType> = {
  set_style: "set_style",
  remove_style: "remove_style",
  update_text: "update_text",
  set_asset: "set_asset",
  move_node: "move_node",
  replace_section: "replace_section",
  set_responsive_rule: "set_responsive_rule",
  wrap_children: "wrap_children",
  unwrap_children: "unwrap_children",
  change_columns: "change_columns",
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => normalizeString(item)).filter(Boolean)
}

function toJsonSafeValue(value: unknown) {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    return normalizeString(value)
  }
}

function normalizeIdentifier(value: unknown) {
  const normalized = normalizeString(value)
    .replace(/[^a-zA-Z0-9:_./-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
  return normalized
}

function normalizePath(value: unknown) {
  const normalized = normalizeString(value)
    .replace(/\s+/g, "")
    .replace(/\.\.+/g, ".")
  return normalized || undefined
}

function normalizeScope(value: unknown) {
  const normalized = normalizeString(value).toLowerCase().replace(/\s+/g, "_")
  return SCOPE_ALIASES[normalized] ?? null
}

function normalizeMode(value: unknown) {
  const normalized = normalizeString(value).toLowerCase().replace(/\s+/g, "_")
  return MODE_ALIASES[normalized] ?? null
}

function normalizeRiskLevel(value: unknown) {
  const normalized = normalizeString(value).toLowerCase()
  return RISK_LEVELS.find((item) => item === normalized) ?? null
}

function normalizeOperationType(value: unknown) {
  const normalized = normalizeString(value).toLowerCase().replace(/\s+/g, "_")
  return OPERATION_ALIASES[normalized] ?? null
}

function normalizeBreakpoint(value: unknown) {
  const normalized = normalizeString(value, "all").toLowerCase()
  return EDIT_BREAKPOINTS.find((item) => item === normalized) ?? "all"
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function extractQuotedTextReplacement(message: string) {
  const normalized = message.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  const patterns = [
    /(?:altera(?:r)?|troca(?:r)?|substitu[ií](?:r)?|muda(?:r)?)(?:\s+o\s+(?:texto|t[ií]tulo|conte[uú]do|copy|par[aá]grafo|headline|subt[ií]tulo|cta|bot[aã]o|bloco|trecho|frase))?\s+"([^"]+)"\s+(?:para|por)\s+"([^"]+)"/i,
    /(?:altera(?:r)?|troca(?:r)?|substitu[ií](?:r)?|muda(?:r)?)(?:\s+o\s+(?:texto|t[ií]tulo|conte[uú]do|copy|par[aá]grafo|headline|subt[ií]tulo|cta|bot[aã]o|bloco|trecho|frase))?\s+'([^']+)'\s+(?:para|por)\s+'([^']+)'/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue
    const from = normalizeString(match[1])
    const to = String(match[2] ?? "")
    if (from) return { from, to }
  }

  return null
}

function hasKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword))
}

function classifyScopeFromMessage(message: string): AiEditScope {
  const normalized = normalizeString(message).toLowerCase()

  if (/\b(header|cabe[cç]alho|topo|navbar)\b/i.test(message)) return "header"
  if (/\b(rodape|rodapé|footer)\b/i.test(message)) return "footer"
  if (hasKeyword(normalized, ["página inteira", "pagina inteira", "toda a página", "toda a pagina", "site inteiro"])) return "page"
  if (hasKeyword(normalized, ["seção", "secao", "secção", "hero", "sessão"])) return "section"
  if (hasKeyword(normalized, ["bloco", "card", "cartão", "cartao", "wrapper", "container", "coluna"])) return "block"
  return "text"
}

function classifyModeFromMessage(message: string): AiEditMode {
  const normalized = normalizeString(message).toLowerCase()

  if (
    hasKeyword(normalized, [
      "substituir a seção",
      "substituir a secao",
      "trocar a seção inteira",
      "trocar a secao inteira",
      "recriar a seção",
      "recriar a secao",
    ])
  ) {
    return "section_replace"
  }

  if (
    hasKeyword(normalized, [
      "padding",
      "margin",
      "gap",
      "spacing",
      "espaçamento",
      "espacamento",
      "espaço acima",
      "espaco acima",
      "min-height",
      "max-width",
      "width",
      "altura",
      "largura",
    ])
  ) {
    return "spacing_patch"
  }

  if (
    hasKeyword(normalized, [
      "layout",
      "estrutura",
      "grid",
      "coluna",
      "reorganizar",
      "reposicionar",
      "mover bloco",
      "mudar layout interno",
      "mudar a estrutura",
      "wrap",
      "wrapper",
      "alinhar cards",
    ])
  ) {
    return "section_layout_patch"
  }

  if (
    hasKeyword(normalized, [
      "tipografia",
      "fonte",
      "font",
      "cor",
      "color",
      "fundo",
      "background",
      "border",
      "borda",
      "linha",
      "divisor",
      "separador",
      "sombra",
      "shadow",
      "radius",
      "alinhamento",
      "uppercase",
      "lowercase",
      "letter-spacing",
      "line-height",
    ])
  ) {
    return "style_patch"
  }

  return "text_patch"
}

function classifyScopeFromMessageV2(message: string): AiEditScope {
  const normalized = normalizeString(message).toLowerCase()

  if (isExplicitHeaderTextEditRequest(message)) return "header"
  if (isExplicitFooterTextEditRequest(message)) return "footer"
  if (isFooterAdjacentSpacingRequest(message)) return "section"
  if (isHeaderAdjacentSpacingRequest(message) || wantsOnlyPageWrapperSpacing(message)) return "page"
  if (wantsOnlyFirstSectionSpacing(message) || wantsOnlySectionInternalSpacing(message)) return "section"
  if (isHeaderVisualSpacingRequest(message)) return "header"
  if (isVisualSpacingIntent(message)) {
    return hasKeyword(normalized, ["seção", "secao", "secção", "hero", "sessão"]) ? "section" : "page"
  }
  if (hasKeyword(normalized, ["página inteira", "pagina inteira", "toda a página", "toda a pagina", "site inteiro"])) return "page"
  if (hasKeyword(normalized, ["seção", "secao", "secção", "hero", "sessão"])) return "section"
  if (hasKeyword(normalized, ["bloco", "card", "cartão", "cartao", "wrapper", "container", "coluna"])) return "block"
  if (/\b(header|cabe[cç]alho|navbar)\b/i.test(message)) return "header"
  return "text"
}

function classifyModeFromMessageV2(message: string): AiEditMode {
  const normalized = normalizeString(message).toLowerCase()

  if (
    hasKeyword(normalized, [
      "substituir a seção",
      "substituir a secao",
      "trocar a seção inteira",
      "trocar a secao inteira",
      "recriar a seção",
      "recriar a secao",
    ])
  ) {
    return "section_replace"
  }

  if (
    isFooterAdjacentSpacingRequest(message) ||
    isVisualSpacingIntent(message) ||
    hasKeyword(normalized, [
      "padding",
      "margin",
      "gap",
      "spacing",
      "espaçamento",
      "espacamento",
      "espaço acima",
      "espaco acima",
      "min-height",
      "max-width",
      "width",
      "altura",
      "largura",
    ])
  ) {
    return "spacing_patch"
  }

  if (
    hasKeyword(normalized, [
      "layout",
      "estrutura",
      "grid",
      "coluna",
      "reorganizar",
      "reposicionar",
      "mover bloco",
      "mudar layout interno",
      "mudar a estrutura",
      "wrap",
      "wrapper",
      "alinhar cards",
    ])
  ) {
    return "section_layout_patch"
  }

  if (
    hasKeyword(normalized, [
      "tipografia",
      "fonte",
      "font",
      "cor",
      "color",
      "fundo",
      "background",
      "border",
      "borda",
      "linha",
      "divisor",
      "separador",
      "sombra",
      "shadow",
      "radius",
      "alinhamento",
      "uppercase",
      "lowercase",
      "letter-spacing",
      "line-height",
    ])
  ) {
    return "style_patch"
  }

  return "text_patch"
}

function inferOperationTypeFromMode(mode: AiEditMode, message: string): AiEditOperationType {
  const normalized = normalizeString(message).toLowerCase()

  if (mode === "text_patch") return "update_text"
  if (mode === "style_patch") {
    if (hasKeyword(normalized, ["mobile", "tablet", "desktop", "responsivo", "responsiva", "breakpoint"])) {
      return "set_responsive_rule"
    }
    if (hasKeyword(normalized, ["remov", "tirar", "limpar"]) && hasKeyword(normalized, ["cor", "fundo", "borda", "border", "linha", "divisor", "separador", "sombra", "shadow", "classe", "style"])) {
      return "remove_style"
    }
    return "set_style"
  }
  if (mode === "spacing_patch") return "set_style"
  if (mode === "section_replace") return "replace_section"
  if (hasKeyword(normalized, ["wrap", "envolver", "wrapper"])) return "wrap_children"
  if (hasKeyword(normalized, ["unwrap", "desagrupar"])) return "unwrap_children"
  if (hasKeyword(normalized, ["coluna", "columns"])) return "change_columns"
  return "move_node"
}

function buildFallbackTargetIds(scope: AiEditScope, slug?: string | null, path?: string | null) {
  const normalizedSlug = normalizeIdentifier(slug)
  if (scope === "header") return ["global-header"]
  if (scope === "footer") return ["global-footer"]
  if (scope === "page") return [normalizedSlug || normalizeIdentifier(path) || "page-root"]
  if (scope === "section") return [normalizedSlug ? `${normalizedSlug}-section` : "section-target"]
  if (scope === "block") return [normalizedSlug ? `${normalizedSlug}-block` : "block-target"]
  return [normalizedSlug ? `${normalizedSlug}-text` : "text-target"]
}

function buildFallbackTargetIdsV2(
  scope: AiEditScope,
  slug?: string | null,
  path?: string | null,
  message?: string,
  mode?: AiEditMode,
) {
  if (mode === "spacing_patch") {
    if (isFooterAdjacentSpacingRequest(message ?? "")) {
      return ["footer_adjacent_spacing"]
    }
    if (wantsOnlyPageWrapperSpacing(message ?? "") || isHeaderAdjacentSpacingRequest(message ?? "")) {
      return ["page_wrapper_spacing"]
    }
    if (wantsOnlyFirstSectionSpacing(message ?? "")) return ["first_section_spacing"]
    if (wantsOnlySectionInternalSpacing(message ?? "")) return ["section_internal_spacing"]
    if (isHeaderVisualSpacingRequest(message ?? "")) return ["global-header"]
  }

  return buildFallbackTargetIds(scope, slug, path)
}

function normalizeOperation(
  rawOperation: unknown,
  input: {
    mode: AiEditMode
    message: string
    fallbackTargetId: string
  },
) {
  if (!rawOperation || typeof rawOperation !== "object" || Array.isArray(rawOperation)) {
    return null
  }

  const record = rawOperation as Record<string, unknown>
  const type = normalizeOperationType(record.type) ?? inferOperationTypeFromMode(input.mode, input.message)
  const targetId = normalizeIdentifier(record.target_id) || input.fallbackTargetId
  const path = normalizePath(record.path)
  const breakpoint = normalizeBreakpoint(record.breakpoint)
  const hasValue = Object.prototype.hasOwnProperty.call(record, "value")

  return {
    type,
    target_id: targetId,
    path,
    value: hasValue ? toJsonSafeValue(record.value) : undefined,
    breakpoint,
  } satisfies AiEditOperation
}

function buildSyntheticOperation(input: {
  mode: AiEditMode
  message: string
  targetId: string
}): AiEditOperation {
  const type = inferOperationTypeFromMode(input.mode, input.message)
  const replacement = input.mode === "text_patch" ? extractQuotedTextReplacement(input.message) : null

  return {
    type,
    target_id: input.targetId,
    path:
      input.mode === "text_patch"
        ? "content"
        : input.mode === "spacing_patch"
          ? "layout"
          : input.mode === "style_patch"
            ? "style"
            : input.mode === "section_layout_patch"
              ? "section"
              : "section.replace",
    value: replacement ?? { instruction: normalizeString(input.message) },
    breakpoint: "all",
  }
}

function classifyRiskLevel(input: {
  scope: AiEditScope
  mode: AiEditMode
  operations: AiEditOperation[]
}) {
  if (
    input.mode === "section_replace" ||
    input.scope === "page" ||
    input.scope === "header" ||
    input.scope === "footer"
  ) {
    return "high" as const
  }

  if (
    input.mode === "section_layout_patch" ||
    input.operations.some((operation) => ["move_node", "wrap_children", "unwrap_children", "change_columns"].includes(operation.type))
  ) {
    return "high" as const
  }

  if (
    input.mode === "spacing_patch" ||
    input.scope === "section" ||
    input.operations.length > 1 ||
    input.operations.some((operation) => operation.breakpoint !== "all")
  ) {
    return "medium" as const
  }

  return "low" as const
}

function deriveStrictConfirmation(input: {
  scope: AiEditScope
  mode: AiEditMode
  riskLevel: AiRiskLevel
  operations: AiEditOperation[]
}) {
  return (
    input.riskLevel === "high" ||
    input.scope === "page" ||
    input.scope === "header" ||
    input.scope === "footer" ||
    input.mode === "spacing_patch" ||
    input.mode === "section_layout_patch" ||
    input.mode === "section_replace" ||
    input.operations.length > 1
  )
}

export function isKnownManagedSitePageSlug(slug: string | null | undefined) {
  return ["home", "sobre", "privacidade", "cookies", "termos"].includes(normalizeString(slug).toLowerCase())
}

export function normalizeAiEditPlan(input: NormalizeAiEditPlanInput): NormalizedAiEditPlanResult {
  const record =
    input.rawEditPlan && typeof input.rawEditPlan === "object" && !Array.isArray(input.rawEditPlan)
      ? (input.rawEditPlan as Record<string, unknown>)
      : null

  const classifiedScope = classifyScopeFromMessageV2(input.message)
  const classifiedMode = classifyModeFromMessageV2(input.message)
  const scope = normalizeScope(record?.scope) ?? classifiedScope
  const mode = normalizeMode(record?.mode) ?? classifiedMode

  const rawTargetIds = normalizeStringArray(record?.target_ids).map(normalizeIdentifier).filter(Boolean)
  const fallbackTargetIds = buildFallbackTargetIdsV2(scope, input.slug, input.path, input.message, mode)
  const preliminaryTargetIds = uniqueStrings(rawTargetIds.length > 0 ? rawTargetIds : fallbackTargetIds)
  const fallbackTargetId = preliminaryTargetIds[0] ?? fallbackTargetIds[0] ?? "target"

  const operations: AiEditOperation[] = []
  if (Array.isArray(record?.operations)) {
    for (const operation of record.operations) {
      const normalizedOperation = normalizeOperation(operation, { mode, message: input.message, fallbackTargetId })
      if (normalizedOperation) {
        operations.push(normalizedOperation)
      }
    }
  }

  const targetIds = uniqueStrings([
    ...preliminaryTargetIds,
    ...operations.map((operation) => operation.target_id).filter(Boolean),
  ])

  const normalizedOperations =
    operations.length > 0
      ? operations
      : [buildSyntheticOperation({ mode, message: input.message, targetId: targetIds[0] ?? fallbackTargetId })]

  const riskLevel = normalizeRiskLevel(record?.risk_level) ?? classifyRiskLevel({
    scope,
    mode,
    operations: normalizedOperations,
  })
  const requiresStrictConfirmation =
    typeof record?.requires_strict_confirmation === "boolean"
      ? record.requires_strict_confirmation
      : deriveStrictConfirmation({
          scope,
          mode,
          riskLevel,
          operations: normalizedOperations,
        })

  const planSource: AiEditPlanSource = record
    ? input.legacyContractFallback
      ? "legacy_compat"
      : "model"
    : input.legacyContractFallback
      ? "legacy_compat"
      : "heuristic"

  return {
    editPlan: {
      scope,
      mode,
      target_ids: targetIds.length > 0 ? targetIds : fallbackTargetIds,
      risk_level: riskLevel,
      requires_strict_confirmation: requiresStrictConfirmation,
      operations: normalizedOperations,
    },
    planSource,
    invariants: {
      contract_version: "hybrid_v1",
      plan_source: planSource,
      known_managed_slug: isKnownManagedSitePageSlug(input.slug),
      supports_persistible_flow: isKnownManagedSitePageSlug(input.slug),
      operation_count: normalizedOperations.length,
      operation_types: uniqueStrings(normalizedOperations.map((operation) => operation.type)),
      target_count: targetIds.length > 0 ? targetIds.length : fallbackTargetIds.length,
      global_scope: scope === "page" || scope === "header" || scope === "footer",
      scoped_to_known_target: !(scope === "page" || scope === "header" || scope === "footer") && targetIds.length > 0,
    },
  }
}
