import type { AiConversationContext } from "./conversation.ts"
import type { AiEditOperation, AiEditPlan } from "./contract.ts"
import { resolvePersistibleProposalOperationalState, type PersistibleProposalOperationalState } from "./operational-state.ts"
import type { PatchEngineBaseVersion } from "./patch-engine.ts"
import {
  buildExplicitCssSourceText,
  buildExplicitCssUnderstandingSummary,
  extractExplicitCssIntent,
  type ExplicitCssIntent,
} from "./explicit-css-intent.ts"

type AiProvider = "gemini" | "openai"

export interface ExplicitCssPatchProposalResult {
  providerUsed: AiProvider
  modelUsed: string
  summary: string
  explanation: string
  assistantMessage: string
  warnings: string[]
  conversationPhase: "ready_for_proposal"
  understandingSummary: string | null
  requiresUserConfirmation: false
  canGenerateProposal: true
  editPlan: AiEditPlan
  proposal: {
    slug: string
    title: string
    layout_json: Record<string, unknown>
    style_json: Record<string, unknown>
    metadata: Record<string, unknown>
  }
  operationalState: PersistibleProposalOperationalState
  sourceText: string
  intent: ExplicitCssIntent
}

interface ExplicitCssPatchProposalInput {
  providerUsed: AiProvider
  modelUsed: string
  confirmationMessage: string
  slug: string
  title: string
  path: string
  conversationContext: AiConversationContext
  baseVersion: PatchEngineBaseVersion
  baseVersionSource: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  baseVersionSelectionReason: string
  publishedVersionId?: string | null
  latestDraftId?: string | null
  currentHtml?: string | null
}

export type ExplicitCssPatchMaterializationResult =
  | {
      status: "not_applicable"
      sourceText: string
      understandingSummary: string | null
      reason: "missing_understanding_summary" | "not_explicit_css_intent"
      intent: ExplicitCssIntent | null
    }
  | {
      status: "failed"
      sourceText: string
      understandingSummary: string | null
      reason: string
      assistantMessage: string
      warnings: string[]
      intent: ExplicitCssIntent | null
    }
  | ({
      status: "success"
    } & ExplicitCssPatchProposalResult)

const BLOCKED_SELECTOR_PATTERNS = [/^\*$/, /^html$/i, /^body$/i, /^:root$/i, /,/]
const BLOCKED_VALUE_PATTERNS = [/<script/i, /url\s*\(/i, /javascript:/i, /expression\s*\(/i, /@import/i]
const BLOCKED_PROPERTY_VALUES: Array<{ property: string; pattern: RegExp }> = [
  { property: "position", pattern: /(fixed|absolute|sticky)/i },
  { property: "z-index", pattern: /.+/ },
  { property: "transform", pattern: /.+/ },
]
const SAFE_DISPLAY_VALUES = new Set(["block", "inline-block", "flex", "grid", "none"])
const SAFE_TEXT_ALIGN_VALUES = new Set(["left", "center", "right", "justify"])
const SAFE_ALIGNMENT_VALUES = new Set(["start", "center", "end", "stretch", "space-between", "space-around", "space-evenly"])
const SAFE_COLOR_VALUE = /^(transparent|none|#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i
const SAFE_BOX_SHADOW_VALUE = /^(none|[-0-9.\spxrgba(),#]+)$/i
const SAFE_BORDER_VALUE = /^(0|0px|[0-9.]+px\s+(solid|dashed|dotted)\s+(transparent|#[0-9a-f]{3,8}|rgba?\([^)]+\)|[a-z]+))$/i
const SAFE_FONT_WEIGHT_VALUE = /^(normal|bold|bolder|lighter|[1-9]00)$/i
const SAFE_LINE_HEIGHT_VALUE = /^([0-9.]+|[0-9.]+(px|rem|em|%))$/i
const SAFE_SIZE_TOKEN = /^-?[0-9.]+(px|rem|em|%|vh|vw)?$/i

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function appendCssPatch(styleJson: Record<string, unknown>, cssPatch: string) {
  const next = cloneJsonValue(styleJson)
  const existingCss = typeof next.css === "string" ? next.css.trim() : ""
  next.css = existingCss ? `${existingCss}\n\n${cssPatch}` : cssPatch
  return next
}

function normalizeCssValue(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function isSafeSelector(selector: string) {
  if (!selector.trim()) return false
  if (BLOCKED_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector.trim()))) return false
  return /^([.#][a-zA-Z0-9_-]+)([\s>+~][.#]?[a-zA-Z0-9_-]+)*$/.test(selector.trim())
}

function isSizeList(value: string, allowAuto = false) {
  const tokens = value.split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 4) return false
  return tokens.every((token) => SAFE_SIZE_TOKEN.test(token) || (allowAuto && token.toLowerCase() === "auto"))
}

function validateExplicitCssValue(property: string, value: string) {
  const normalizedValue = normalizeCssValue(value)
  if (!normalizedValue || BLOCKED_VALUE_PATTERNS.some((pattern) => pattern.test(normalizedValue))) {
    throw new Error(`Valor bloqueado para ${property}.`)
  }

  const blockedProperty = BLOCKED_PROPERTY_VALUES.find((entry) => entry.property === property)
  if (blockedProperty && blockedProperty.pattern.test(normalizedValue)) {
    throw new Error(`A propriedade ${property} nao e permitida neste patch seguro.`)
  }

  if (property.startsWith("margin")) {
    if (!isSizeList(normalizedValue, true)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property.startsWith("padding") || property === "gap" || property === "row-gap" || property === "column-gap" || property === "max-width" || property === "width" || property === "min-height" || property === "font-size" || property === "border-width") {
    if (!isSizeList(normalizedValue, false)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property === "background" || property === "background-color" || property === "color" || property === "border-color") {
    if (!SAFE_COLOR_VALUE.test(normalizedValue)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property === "border" || property === "border-top" || property === "border-bottom") {
    if (!SAFE_BORDER_VALUE.test(normalizedValue)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property === "border-radius") {
    if (!isSizeList(normalizedValue, false)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property === "box-shadow") {
    if (!SAFE_BOX_SHADOW_VALUE.test(normalizedValue)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property === "text-align") {
    if (!SAFE_TEXT_ALIGN_VALUES.has(normalizedValue.toLowerCase())) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue.toLowerCase()
  }

  if (property === "font-weight") {
    if (!SAFE_FONT_WEIGHT_VALUE.test(normalizedValue)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue.toLowerCase()
  }

  if (property === "line-height") {
    if (!SAFE_LINE_HEIGHT_VALUE.test(normalizedValue)) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue
  }

  if (property === "display") {
    if (!SAFE_DISPLAY_VALUES.has(normalizedValue.toLowerCase())) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue.toLowerCase()
  }

  if (property === "align-items" || property === "justify-content") {
    if (!SAFE_ALIGNMENT_VALUES.has(normalizedValue.toLowerCase())) throw new Error(`Valor invalido para ${property}.`)
    return normalizedValue.toLowerCase()
  }

  throw new Error(`A propriedade ${property} nao e suportada neste patch explicito.`)
}

function findPreviousCssValue(css: string, selector: string, property: string) {
  const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const propertyPattern = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\}`, "gi")
  let match: RegExpExecArray | null
  let latestValue: string | null = null
  while ((match = regex.exec(css))) {
    const block = String(match[1] ?? "")
    const propertyMatch = block.match(new RegExp(`${propertyPattern}\\s*:\\s*([^;]+)`, "i"))
    if (propertyMatch?.[1]) latestValue = normalizeCssValue(propertyMatch[1])
  }
  return latestValue
}

function selectorExistsInHtml(selector: string, currentHtml: string) {
  if (!currentHtml.trim()) return selector === ".me-managed-page-root"
  if (selector === ".me-managed-page-root") return true

  if (selector.startsWith(".")) {
    const className = selector.slice(1)
    const classPattern = new RegExp(`class=["'][^"']*\\b${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    return classPattern.test(currentHtml)
  }

  if (selector.startsWith("#")) {
    const idName = selector.slice(1)
    const idPattern = new RegExp(`id=["']${idName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i")
    return idPattern.test(currentHtml)
  }

  return false
}

function buildCssRule(selector: string, declarations: ExplicitCssIntent["declarations"]) {
  const body = declarations
    .map((declaration) => `  ${declaration.property}: ${normalizeCssValue(declaration.value)} !important;`)
    .join("\n")
  return `${selector} {\n${body}\n}`
}

function buildEditPlan(intent: ExplicitCssIntent): AiEditPlan {
  const operations: AiEditOperation[] = intent.declarations.map((declaration) => ({
    type: "set_style",
    target_id: "explicit_css_selector",
    path: declaration.property,
    value: declaration.value,
    breakpoint: "all",
  }))

  return {
    scope: intent.selector === ".me-managed-page-root" ? "page" : "section",
    mode: "style_patch",
    target_ids: [intent.selector],
    risk_level: "low",
    requires_strict_confirmation: false,
    operations,
  }
}

function buildUserFacingCopy(intent: ExplicitCssIntent, title: string) {
  const propertyList = intent.declarations.map((item) => item.property).join(", ")
  const footerContext = intent.context === "footer_spacing"
  if (intent.declarations.length === 1) {
    const declaration = intent.declarations[0]
    return {
      summary: `Ajustar ${declaration.property} da classe ${intent.selector} na pagina ${title}.`,
      explanation: footerContext
        ? `Preparei um ajuste localizado na regra ${intent.selector}, alterando apenas ${declaration.property} para remover o espaco antes do rodape.`
        : `Preparei um ajuste localizado na regra ${intent.selector}, alterando apenas ${declaration.property}.`,
      assistantMessage: footerContext
        ? `Preparei uma previa ajustando o ${declaration.property} da classe ${intent.selector} para remover o espaco antes do rodape, mantendo o restante da pagina igual.`
        : `Preparei uma previa ajustando o ${declaration.property} da classe ${intent.selector}, mantendo o restante da pagina igual.`,
    }
  }

  return {
    summary: `Atualizar a regra CSS ${intent.selector} na pagina ${title}.`,
    explanation: `Preparei um ajuste localizado na regra ${intent.selector}, aplicando apenas ${propertyList}.`,
    assistantMessage: `Preparei uma previa atualizando a regra ${intent.selector} com os valores pedidos, mantendo o restante da pagina igual.`,
  }
}

function buildFailure(input: {
  sourceText: string
  understandingSummary: string | null
  reason: string
  intent: ExplicitCssIntent | null
}) {
  return {
    status: "failed" as const,
    sourceText: input.sourceText,
    understandingSummary: input.understandingSummary,
    reason: input.reason,
    assistantMessage:
      "Entendi a instrucao tecnica, mas nao consegui validar esse seletor ou essa propriedade com seguranca. Confirma a classe exata ou envia a regra CSS completa para eu preparar a previa certa.",
    warnings: [],
    intent: input.intent,
  }
}

export function materializeExplicitCssPatchProposal(
  input: ExplicitCssPatchProposalInput,
): ExplicitCssPatchMaterializationResult {
  const sourceText = buildExplicitCssSourceText({
    message: input.confirmationMessage,
    conversationContext: input.conversationContext,
  })
  const understandingSummary = normalizeString(input.conversationContext.understanding_summary) || null
  if (!understandingSummary) {
    return {
      status: "not_applicable",
      sourceText,
      understandingSummary,
      reason: "missing_understanding_summary",
      intent: null,
    }
  }

  const intent = extractExplicitCssIntent(sourceText)
  if (!intent) {
    return {
      status: "not_applicable",
      sourceText,
      understandingSummary,
      reason: "not_explicit_css_intent",
      intent: null,
    }
  }

  try {
    if (!isSafeSelector(intent.selector)) {
      throw new Error(`Seletor nao seguro: ${intent.selector}`)
    }

    const currentHtml = normalizeString(input.currentHtml)
    const existingCss = typeof input.baseVersion.style_json?.css === "string" ? String(input.baseVersion.style_json.css) : ""
    const selectorFound = selectorExistsInHtml(intent.selector, currentHtml) || existingCss.includes(intent.selector)
    const ruleFound = existingCss.includes(intent.selector)

    if (!selectorFound) {
      throw new Error(`Nao encontrei o seletor ${intent.selector} no HTML ou CSS atual.`)
    }

    const validatedDeclarations = intent.declarations.map((declaration) => ({
      property: declaration.property,
      value: validateExplicitCssValue(declaration.property, declaration.value),
    }))

    const previousValue =
      validatedDeclarations.length === 1
        ? findPreviousCssValue(existingCss, intent.selector, validatedDeclarations[0].property)
        : Object.fromEntries(
            validatedDeclarations.map((declaration) => [
              declaration.property,
              findPreviousCssValue(existingCss, intent.selector, declaration.property),
            ]),
          )

    const cssPatch = buildCssRule(intent.selector, validatedDeclarations)
    const nextStyleJson = appendCssPatch(input.baseVersion.style_json ?? {}, cssPatch)
    const editPlan = buildEditPlan({
      ...intent,
      declarations: validatedDeclarations,
    })
    const targetResolutions = [
      {
        requested_target_id: intent.selector,
        resolved_target_id: intent.selector,
        candidate_path: intent.selector,
        confidence: 1,
        section_index: -1,
        block_type: "explicit_css_selector",
        selector: intent.selector,
        signals: {
          id_structural: 1,
          internal_path: 1,
          data_attributes: 1,
          nearest_heading: 0,
          anchor_text: 0,
          visual_order: 0,
          textual_similarity: 1,
          capture_attachment: 0,
        },
      },
    ]

    const operationalState = resolvePersistibleProposalOperationalState({
      editPlan,
      baseLayoutJson: input.baseVersion.layout_json,
      baseStyleJson: input.baseVersion.style_json,
      proposalLayoutJson: input.baseVersion.layout_json,
      proposalStyleJson: nextStyleJson,
      targetResolutions,
      previewRenderable: true,
      desktopRenderable: true,
      mobileRenderable: true,
    })

    if (!operationalState.change_detected || !operationalState.change_summary.style_changed) {
      throw new Error("O patch explicito nao gerou alteracao real no style_json.")
    }

    const appliedCss = String(nextStyleJson.css ?? "")
    for (const declaration of validatedDeclarations) {
      const expectedFragment = `${declaration.property}: ${declaration.value} !important;`
      if (!appliedCss.includes(expectedFragment)) {
        throw new Error(`A propriedade ${declaration.property} nao foi aplicada com o valor pedido.`)
      }
    }

    const copy = buildUserFacingCopy(intent, input.title)
    const explicitCssValidation = {
      selector_found: selectorFound,
      rule_found: ruleFound,
      rule_created: !ruleFound,
      style_changed: operationalState.change_summary.style_changed,
      change_detected: operationalState.change_detected,
      properties_validated: validatedDeclarations.map((item) => item.property),
      values_validated: validatedDeclarations.map((item) => item.value),
    }

    return {
      status: "success",
      providerUsed: input.providerUsed,
      modelUsed: input.modelUsed,
      summary: copy.summary,
      explanation: copy.explanation,
      assistantMessage: copy.assistantMessage,
      warnings: [],
      conversationPhase: "ready_for_proposal",
      understandingSummary: buildExplicitCssUnderstandingSummary(intent),
      requiresUserConfirmation: false,
      canGenerateProposal: true,
      editPlan,
      proposal: {
        slug: input.slug,
        title: input.title,
        layout_json: cloneJsonValue(input.baseVersion.layout_json),
        style_json: nextStyleJson,
        metadata: {
          ai_contract_version: "hybrid_v1",
          ai_edit_plan: editPlan,
          ai_invariants: {
            plan_source: "explicit_css_patch",
            branch_selected: "explicit_css_patch",
            explicit_css_selector: intent.selector,
            explicit_css_properties: validatedDeclarations.map((item) => item.property),
            explicit_css_values: validatedDeclarations.map((item) => item.value),
            explicit_css_source_text: sourceText,
            explicit_css_patch_applied: true,
            explicit_css_validation: explicitCssValidation,
            previous_value: previousValue,
            next_value:
              validatedDeclarations.length === 1
                ? validatedDeclarations[0].value
                : Object.fromEntries(validatedDeclarations.map((item) => [item.property, item.value])),
            style_changed: true,
            selector_found: selectorFound,
            rule_found: ruleFound,
            rule_created: !ruleFound,
            scoped_patch: true,
            supports_persistible_flow: true,
            target_resolutions: targetResolutions,
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
      operationalState: {
        ...operationalState,
        final_status: "proposal_ready",
        preview_available: true,
      },
      sourceText,
      intent,
    }
  } catch (error) {
    return buildFailure({
      sourceText,
      understandingSummary,
      reason: error instanceof Error ? error.message : String(error),
      intent,
    })
  }
}

