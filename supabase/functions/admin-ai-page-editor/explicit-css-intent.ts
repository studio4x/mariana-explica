import type { AiConversationContext } from "./conversation.ts"

export type ExplicitCssIntentContext = "footer_spacing" | "page_top_spacing" | "generic_style"

export interface ExplicitCssDeclaration {
  property: string
  value: string
}

export interface ExplicitCssIntent {
  selector: string
  declarations: ExplicitCssDeclaration[]
  source_text: string
  context: ExplicitCssIntentContext
  selector_from_context: boolean
  uses_rule_block: boolean
}

const CSS_PROPERTY_ALIASES: Record<string, string> = {
  margin: "margin",
  "margin-top": "margin-top",
  margintop: "margin-top",
  "margin-right": "margin-right",
  marginright: "margin-right",
  "margin-bottom": "margin-bottom",
  marginbottom: "margin-bottom",
  "margin-left": "margin-left",
  marginleft: "margin-left",
  padding: "padding",
  "padding-top": "padding-top",
  paddingtop: "padding-top",
  "padding-right": "padding-right",
  paddingright: "padding-right",
  "padding-bottom": "padding-bottom",
  paddingbottom: "padding-bottom",
  "padding-left": "padding-left",
  paddingleft: "padding-left",
  gap: "gap",
  "row-gap": "row-gap",
  rowgap: "row-gap",
  "column-gap": "column-gap",
  columngap: "column-gap",
  "max-width": "max-width",
  maxwidth: "max-width",
  width: "width",
  "min-height": "min-height",
  minheight: "min-height",
  background: "background",
  "background-color": "background-color",
  backgroundcolor: "background-color",
  color: "color",
  border: "border",
  "border-top": "border-top",
  bordertop: "border-top",
  "border-bottom": "border-bottom",
  borderbottom: "border-bottom",
  "border-color": "border-color",
  bordercolor: "border-color",
  "border-width": "border-width",
  borderwidth: "border-width",
  "border-radius": "border-radius",
  borderradius: "border-radius",
  "box-shadow": "box-shadow",
  boxshadow: "box-shadow",
  "text-align": "text-align",
  textalign: "text-align",
  "font-size": "font-size",
  fontsize: "font-size",
  "font-weight": "font-weight",
  fontweight: "font-weight",
  "line-height": "line-height",
  lineheight: "line-height",
  display: "display",
  position: "position",
  "z-index": "z-index",
  zindex: "z-index",
  transform: "transform",
  "align-items": "align-items",
  alignitems: "align-items",
  "justify-content": "justify-content",
  justifycontent: "justify-content",
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function normalizeIdentifier(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeCssProperty(raw: string) {
  const compact = raw
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, "-")
  return CSS_PROPERTY_ALIASES[compact] ?? null
}

function sanitizeExplicitCssValue(raw: string) {
  return raw
    .replace(/^["']|["']$/g, "")
    .replace(
      /\s+\b(antes do rodape|antes do footer|antes da primeira secao|acima da primeira secao|nessa classe|dessa classe|nesta classe|nesta pagina|na pagina|no topo da pagina|antes do conteudo comecar)\b.*$/i,
      "",
    )
    .trim()
}

function inferContext(sourceText: string): ExplicitCssIntentContext {
  if (/\b(rodape|rodape|footer|ultima secao|secao final|fim da pagina)\b/i.test(sourceText)) {
    return "footer_spacing"
  }

  if (/\b(primeira secao|inicio da pagina|topo da pagina|cabecalho|menu)\b/i.test(sourceText)) {
    return "page_top_spacing"
  }

  return "generic_style"
}

function extractCssRuleBlocks(sourceText: string) {
  const matches = Array.from(sourceText.matchAll(/([.#][a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g))
  return matches
    .map((match) => {
      const selector = normalizeIdentifier(match[1])
      const body = String(match[2] ?? "")
      const declarations = body
        .split(";")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const separatorIndex = chunk.indexOf(":")
          if (separatorIndex < 0) return null
          const property = normalizeCssProperty(chunk.slice(0, separatorIndex))
          const value = chunk.slice(separatorIndex + 1).trim()
          if (!property || !value) return null
          return {
            property,
            value,
          } satisfies ExplicitCssDeclaration
        })
        .filter((item): item is ExplicitCssDeclaration => Boolean(item))

      if (!selector || declarations.length === 0) return null
      return {
        selector,
        declarations,
      }
    })
    .filter((item): item is { selector: string; declarations: ExplicitCssDeclaration[] } => Boolean(item))
}

function extractSelectorMentions(sourceText: string) {
  return uniqueStrings(
    Array.from(sourceText.matchAll(/(\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|\*|:root|\bhtml\b|\bbody\b)/gi)).map((match) =>
      normalizeIdentifier(match[1]),
    ),
  )
}

function resolveLatestSelector(sourceText: string) {
  const selectorMentions = extractSelectorMentions(sourceText)
  if (selectorMentions.length > 0) {
    return selectorMentions[selectorMentions.length - 1]
  }

  const quotedSelector =
    sourceText.match(/["']([.#][a-zA-Z0-9_-]+|\*|:root|html|body)["']/i)?.[1] ??
    sourceText.match(/\bclasse\s+([.#][a-zA-Z0-9_-]+|\*|:root|html|body)\b/i)?.[1] ??
    null

  return quotedSelector ? normalizeIdentifier(quotedSelector) : null
}

function extractPropertyInstruction(sourceText: string) {
  const normalized = normalizeText(sourceText).toLowerCase()
  const orderedAliases = Object.keys(CSS_PROPERTY_ALIASES).sort((left, right) => right.length - left.length)
  for (const alias of orderedAliases) {
    const removalPattern = new RegExp(`\\b(remov\\w*|tir\\w*|zer\\w*|sem)\\b[\\s\\S]{0,48}\\b${alias.replace(/[-]/g, "[- ]?")}\\b`, "i")
    if (!removalPattern.test(normalized)) continue
    return {
      property: CSS_PROPERTY_ALIASES[alias],
      value:
        CSS_PROPERTY_ALIASES[alias] === "box-shadow"
          ? "none"
          : CSS_PROPERTY_ALIASES[alias] === "border"
            ? "0px solid transparent"
            : CSS_PROPERTY_ALIASES[alias] === "background"
              ? "transparent"
              : "0px",
    } satisfies ExplicitCssDeclaration
  }

  for (const alias of orderedAliases) {
    const pattern = new RegExp(`\\b${alias.replace(/[-]/g, "[- ]?")}\\b`, "i")
    if (!pattern.test(normalized)) continue
    const property = CSS_PROPERTY_ALIASES[alias]

    const explicitValue =
      normalized.match(new RegExp(`${alias.replace(/[-]/g, "[- ]?")}\\s+(?:para|como|=)\\s+([^\\n.;]+)`, "i"))?.[1]?.trim() ??
      normalized.match(new RegExp(`${alias.replace(/[-]/g, "[- ]?")}\\s*:\\s*([^\\n;]+)`, "i"))?.[1]?.trim() ??
      ""

    if (explicitValue) {
      return {
        property,
        value: sanitizeExplicitCssValue(explicitValue),
      } satisfies ExplicitCssDeclaration
    }

    if (/\b(remov|tir|zer|sem)\b/i.test(normalized)) {
      return {
        property,
        value:
          property === "box-shadow"
            ? "none"
            : property === "border"
              ? "0px solid transparent"
              : property === "background"
                ? "transparent"
                : "0px",
      } satisfies ExplicitCssDeclaration
    }
  }

  return null
}

function extractClassScopedIntent(sourceText: string) {
  const selector = resolveLatestSelector(sourceText)
  const recentInstructionLine =
    sourceText
      .split(/\n+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .at(-1) ?? sourceText
  const propertyInstruction = extractPropertyInstruction(recentInstructionLine) ?? extractPropertyInstruction(sourceText)
  if (!selector || !propertyInstruction) return null

  return {
    selector,
    declarations: [propertyInstruction],
  }
}

export function buildExplicitCssSourceText(input: {
  message: string
  conversationContext: AiConversationContext
}) {
  const recentUserMessages = input.conversationContext.recent_messages
    .filter((entry) => entry.role === "user")
    .map((entry) => String(entry.text ?? "").trim())
    .filter(Boolean)
  const understandingSummary = String(input.conversationContext.understanding_summary ?? "").trim()

  return uniqueStrings([understandingSummary, ...recentUserMessages, input.message.trim()]).join("\n")
}

export function extractExplicitCssIntent(sourceText: string): ExplicitCssIntent | null {
  const normalizedSourceText = normalizeText(sourceText)
  const cssRuleBlocks = extractCssRuleBlocks(normalizedSourceText)
  if (cssRuleBlocks.length > 0) {
    const block = cssRuleBlocks[cssRuleBlocks.length - 1]
    return {
      selector: block.selector,
      declarations: block.declarations,
      source_text: sourceText,
      context: inferContext(normalizedSourceText),
      selector_from_context: false,
      uses_rule_block: true,
    }
  }

  const classScopedIntent =
    extractClassScopedIntent(normalizedSourceText) ??
    (() => {
      const selector = resolveLatestSelector(sourceText)
      const recentInstructionLine =
        sourceText
          .split(/\n+/)
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .at(-1) ?? sourceText
      const propertyInstruction =
        extractPropertyInstruction(recentInstructionLine) ?? extractPropertyInstruction(sourceText)
      if (!selector || !propertyInstruction) return null
      return {
        selector,
        declarations: [propertyInstruction],
      }
    })()
  if (!classScopedIntent) return null

  return {
    selector: classScopedIntent.selector,
    declarations: classScopedIntent.declarations,
    source_text: sourceText,
    context: inferContext(normalizedSourceText),
    selector_from_context: true,
    uses_rule_block: false,
  }
}

export function isExplicitCssIntent(sourceText: string) {
  return Boolean(extractExplicitCssIntent(sourceText))
}

export function buildExplicitCssUnderstandingSummary(intent: ExplicitCssIntent) {
  const summaryParts = intent.declarations.map((declaration) => `${declaration.property} = ${declaration.value}`)
  return `ajustar a classe ${intent.selector} em CSS, aplicando ${summaryParts.join(", ")}`
}
