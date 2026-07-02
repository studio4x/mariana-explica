import type { CSSProperties } from "react"
import type {
  VisualEditorFieldDefinition,
  VisualEditorFieldStyleValue,
  VisualEditorStyleDocument,
  VisualEditorStyleGroup,
  VisualEditorTextSemanticTag,
} from "./types"

export interface VisualEditorFontPreset {
  label: string
  value: string
}

export const VISUAL_EDITOR_FONT_PRESETS: VisualEditorFontPreset[] = [
  { label: "Arvo", value: '"Arvo", Georgia, serif' },
  { label: "Inter", value: '"Inter", system-ui, sans-serif' },
  { label: "DM Sans", value: '"DM Sans", system-ui, sans-serif' },
  { label: "Lora", value: '"Lora", Georgia, serif' },
  { label: "Manrope", value: '"Manrope", system-ui, sans-serif' },
  { label: "Merriweather", value: '"Merriweather", Georgia, serif' },
  { label: "Montserrat", value: '"Montserrat", system-ui, sans-serif' },
  { label: "Oswald", value: '"Oswald", Arial, sans-serif' },
  { label: "Playfair Display", value: '"Playfair Display", Georgia, serif' },
  { label: "Poppins", value: '"Poppins", system-ui, sans-serif' },
  { label: "Readex Pro", value: '"Readex Pro", system-ui, sans-serif' },
]

export const VISUAL_EDITOR_FONT_WEIGHT_OPTIONS = [
  { label: "300", value: "300" },
  { label: "400", value: "400" },
  { label: "500", value: "500" },
  { label: "600", value: "600" },
  { label: "700", value: "700" },
  { label: "800", value: "800" },
  { label: "900", value: "900" },
  { label: "Normal", value: "normal" },
  { label: "Bold", value: "bold" },
]

export const VISUAL_EDITOR_TEXT_ALIGN_OPTIONS = [
  { label: "Esquerda", value: "left" },
  { label: "Centro", value: "center" },
  { label: "Direita", value: "right" },
  { label: "Justificar", value: "justify" },
]

export const VISUAL_EDITOR_TEXT_TRANSFORM_OPTIONS = [
  { label: "Normal", value: "none" },
  { label: "Uppercase", value: "uppercase" },
  { label: "Lowercase", value: "lowercase" },
  { label: "Capitalize", value: "capitalize" },
]

export const VISUAL_EDITOR_FONT_STYLE_OPTIONS = [
  { label: "Normal", value: "normal" },
  { label: "Italico", value: "italic" },
]

export const VISUAL_EDITOR_TEXT_DECORATION_OPTIONS = [
  { label: "Nenhuma", value: "none" },
  { label: "Sublinhado", value: "underline" },
  { label: "Riscado", value: "line-through" },
  { label: "Sobrelinha", value: "overline" },
]

export const VISUAL_EDITOR_BORDER_STYLE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
]

export const VISUAL_EDITOR_OBJECT_FIT_OPTIONS = [
  { label: "Cover", value: "cover" },
  { label: "Contain", value: "contain" },
]

export const VISUAL_EDITOR_BACKGROUND_SIZE_OPTIONS = [
  { label: "Cover", value: "cover" },
  { label: "Contain", value: "contain" },
  { label: "Auto", value: "auto" },
]

export const VISUAL_EDITOR_BACKGROUND_POSITION_OPTIONS = [
  { label: "Centro", value: "center" },
  { label: "Topo", value: "top" },
  { label: "Base", value: "bottom" },
  { label: "Esquerda", value: "left" },
  { label: "Direita", value: "right" },
]

export const VISUAL_EDITOR_BACKGROUND_REPEAT_OPTIONS = [
  { label: "Sem repeticao", value: "no-repeat" },
  { label: "Repetir", value: "repeat" },
  { label: "Repetir horizontalmente", value: "repeat-x" },
  { label: "Repetir verticalmente", value: "repeat-y" },
]

export const VISUAL_EDITOR_HEADING_TAG_OPTIONS = [
  { label: "Paragrafo", value: "p" },
  { label: "H1", value: "h1" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
  { label: "H4", value: "h4" },
  { label: "H5", value: "h5" },
  { label: "H6", value: "h6" },
]

export const VISUAL_EDITOR_BOX_SHADOW_OPTIONS = [
  { label: "Nenhuma", value: "none" },
  { label: "Soft", value: "0 12px 28px rgba(15, 23, 42, 0.08)" },
  { label: "Medium", value: "0 20px 45px rgba(15, 23, 42, 0.12)" },
  { label: "Strong", value: "0 24px 60px rgba(15, 23, 42, 0.18)" },
  { label: "Glow", value: "0 18px 45px rgba(14, 165, 233, 0.18)" },
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T
}

function normalizeHexColor(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return undefined
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)) {
    return normalized
  }
  return undefined
}

function normalizePresetValue<T extends string>(value: unknown, allowed: readonly T[]) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return undefined
  return allowed.includes(normalized as T) ? (normalized as T) : undefined
}

export function normalizeVisualEditorTextSemanticTag(value: unknown): VisualEditorTextSemanticTag | undefined {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "p" || /^h[1-6]$/.test(normalized)) {
    return normalized as VisualEditorTextSemanticTag
  }

  return undefined
}

function normalizeLengthValue(value: unknown, defaultUnit: "px" | "rem" | "em" | "%" = "px", allowUnitless = false) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}${defaultUnit}`
  }

  const normalized = String(value ?? "").trim()
  if (!normalized) return undefined

  if (allowUnitless && /^-?\d+(\.\d+)?$/.test(normalized)) {
    return normalized
  }

  if (/^-?\d+(\.\d+)?(px|rem|em|%)$/.test(normalized)) {
    return normalized
  }

  return undefined
}

function normalizeShadowValue(value: unknown) {
  return normalizePresetValue(value, VISUAL_EDITOR_BOX_SHADOW_OPTIONS.map((option) => option.value))
}

function normalizeBackgroundImageValue(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return undefined

  const lower = normalized.toLowerCase()
  if (lower.includes("javascript:") || lower.includes("expression(") || lower.startsWith("url(")) {
    return undefined
  }

  if (/^https:\/\/[^\s"']+$/i.test(normalized)) {
    return normalized
  }

  if (/^data:image\//i.test(normalized)) {
    return normalized
  }

  return undefined
}

function getFieldStyleGroup(fieldDefinition?: VisualEditorFieldDefinition): VisualEditorStyleGroup {
  if (fieldDefinition?.styleGroup) {
    return fieldDefinition.styleGroup
  }

  switch (fieldDefinition?.kind) {
    case "link":
      return "interactive"
    case "image":
      return "image"
    case "container":
      return "container"
    case "textarea":
    case "text":
    default:
      return "text"
  }
}

function normalizeTextStyle(rawValue: unknown): VisualEditorFieldStyleValue {
  const record = isPlainObject(rawValue) ? rawValue : {}
  const textAlign = normalizePresetValue(record.textAlign, VISUAL_EDITOR_TEXT_ALIGN_OPTIONS.map((option) => option.value)) as
    | VisualEditorFieldStyleValue["textAlign"]
    | undefined
  const textTransform = normalizePresetValue(
    record.textTransform,
    VISUAL_EDITOR_TEXT_TRANSFORM_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["textTransform"] | undefined
  const fontStyle = normalizePresetValue(record.fontStyle, VISUAL_EDITOR_FONT_STYLE_OPTIONS.map((option) => option.value)) as
    | VisualEditorFieldStyleValue["fontStyle"]
    | undefined
  const textDecoration = normalizePresetValue(
    record.textDecoration,
    VISUAL_EDITOR_TEXT_DECORATION_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["textDecoration"] | undefined
  const headingTag =
    normalizeVisualEditorTextSemanticTag(record.headingTag) ?? normalizeVisualEditorTextSemanticTag(record.textTag)

  const next: VisualEditorFieldStyleValue = {}
  const color = normalizeHexColor(record.color)
  if (color) next.color = color
  const backgroundColor = normalizeHexColor(record.backgroundColor)
  if (backgroundColor) next.backgroundColor = backgroundColor
  const fontFamily = normalizePresetValue(
    record.fontFamily,
    VISUAL_EDITOR_FONT_PRESETS.map((preset) => preset.value),
  )
  if (fontFamily) next.fontFamily = fontFamily
  const fontSize = normalizeLengthValue(record.fontSize, "px")
  if (fontSize) next.fontSize = fontSize
  const fontWeight = normalizePresetValue(
    record.fontWeight,
    VISUAL_EDITOR_FONT_WEIGHT_OPTIONS.map((option) => option.value),
  )
  if (fontWeight) next.fontWeight = fontWeight
  const lineHeight = normalizeLengthValue(record.lineHeight, "px", true)
  if (lineHeight) next.lineHeight = lineHeight
  const letterSpacing = normalizeLengthValue(record.letterSpacing, "px")
  if (letterSpacing) next.letterSpacing = letterSpacing
  if (textAlign) next.textAlign = textAlign
  if (textTransform) next.textTransform = textTransform
  if (fontStyle) next.fontStyle = fontStyle
  if (textDecoration) next.textDecoration = textDecoration
  if (headingTag) next.headingTag = headingTag

  return next
}

function normalizeInteractiveStyle(rawValue: unknown): VisualEditorFieldStyleValue {
  const record = isPlainObject(rawValue) ? rawValue : {}
  const textAlign = normalizePresetValue(record.textAlign, VISUAL_EDITOR_TEXT_ALIGN_OPTIONS.map((option) => option.value)) as
    | VisualEditorFieldStyleValue["textAlign"]
    | undefined
  const next: VisualEditorFieldStyleValue = {}
  const color = normalizeHexColor(record.color)
  if (color) next.color = color
  const backgroundColor = normalizeHexColor(record.backgroundColor)
  if (backgroundColor) next.backgroundColor = backgroundColor
  const fontFamily = normalizePresetValue(
    record.fontFamily,
    VISUAL_EDITOR_FONT_PRESETS.map((preset) => preset.value),
  )
  if (fontFamily) next.fontFamily = fontFamily
  const fontSize = normalizeLengthValue(record.fontSize, "px")
  if (fontSize) next.fontSize = fontSize
  const fontWeight = normalizePresetValue(
    record.fontWeight,
    VISUAL_EDITOR_FONT_WEIGHT_OPTIONS.map((option) => option.value),
  )
  if (fontWeight) next.fontWeight = fontWeight
  const textDecoration = normalizePresetValue(
    record.textDecoration,
    VISUAL_EDITOR_TEXT_DECORATION_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["textDecoration"] | undefined
  if (textDecoration) next.textDecoration = textDecoration
  const borderRadius = normalizeLengthValue(record.borderRadius, "px")
  if (borderRadius) next.borderRadius = borderRadius
  const borderWidth = normalizeLengthValue(record.borderWidth, "px")
  if (borderWidth) next.borderWidth = borderWidth
  const borderStyle = normalizePresetValue(
    record.borderStyle,
    VISUAL_EDITOR_BORDER_STYLE_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["borderStyle"] | undefined
  if (borderStyle) next.borderStyle = borderStyle
  const borderColor = normalizeHexColor(record.borderColor)
  if (borderColor) next.borderColor = borderColor
  const paddingX = normalizeLengthValue(record.paddingX, "px")
  if (paddingX) next.paddingX = paddingX
  const paddingY = normalizeLengthValue(record.paddingY, "px")
  if (paddingY) next.paddingY = paddingY
  const boxShadow = normalizeShadowValue(record.boxShadow)
  if (boxShadow) next.boxShadow = boxShadow
  if (textAlign) next.textAlign = textAlign

  return next
}

function normalizeImageStyle(rawValue: unknown): VisualEditorFieldStyleValue {
  const record = isPlainObject(rawValue) ? rawValue : {}
  const next: VisualEditorFieldStyleValue = {}
  const borderRadius = normalizeLengthValue(record.borderRadius, "px")
  if (borderRadius) next.borderRadius = borderRadius
  const width = normalizeLengthValue(record.width, "px")
  if (width) next.width = width
  const height = normalizeLengthValue(record.height, "px")
  if (height) next.height = height
  const maxWidth = normalizeLengthValue(record.maxWidth, "px", true)
  if (maxWidth) next.maxWidth = maxWidth
  const objectFit = normalizePresetValue(record.objectFit, VISUAL_EDITOR_OBJECT_FIT_OPTIONS.map((option) => option.value)) as
    | VisualEditorFieldStyleValue["objectFit"]
    | undefined
  if (objectFit) next.objectFit = objectFit
  const boxShadow = normalizeShadowValue(record.boxShadow)
  if (boxShadow) next.boxShadow = boxShadow

  return next
}

function normalizeContainerStyle(rawValue: unknown): VisualEditorFieldStyleValue {
  const record = isPlainObject(rawValue) ? rawValue : {}
  const next: VisualEditorFieldStyleValue = {}
  const color = normalizeHexColor(record.color)
  if (color) next.color = color
  const backgroundColor = normalizeHexColor(record.backgroundColor)
  if (backgroundColor) next.backgroundColor = backgroundColor
  const backgroundImage = normalizeBackgroundImageValue(record.backgroundImage)
  if (backgroundImage) next.backgroundImage = backgroundImage
  const backgroundSize = normalizePresetValue(
    record.backgroundSize,
    VISUAL_EDITOR_BACKGROUND_SIZE_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["backgroundSize"] | undefined
  if (backgroundSize) next.backgroundSize = backgroundSize
  const backgroundPosition = normalizePresetValue(
    record.backgroundPosition,
    VISUAL_EDITOR_BACKGROUND_POSITION_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["backgroundPosition"] | undefined
  if (backgroundPosition) next.backgroundPosition = backgroundPosition
  const backgroundRepeat = normalizePresetValue(
    record.backgroundRepeat,
    VISUAL_EDITOR_BACKGROUND_REPEAT_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["backgroundRepeat"] | undefined
  if (backgroundRepeat) next.backgroundRepeat = backgroundRepeat
  const borderRadius = normalizeLengthValue(record.borderRadius, "px")
  if (borderRadius) next.borderRadius = borderRadius
  const borderWidth = normalizeLengthValue(record.borderWidth, "px")
  if (borderWidth) next.borderWidth = borderWidth
  const borderStyle = normalizePresetValue(
    record.borderStyle,
    VISUAL_EDITOR_BORDER_STYLE_OPTIONS.map((option) => option.value),
  ) as VisualEditorFieldStyleValue["borderStyle"] | undefined
  if (borderStyle) next.borderStyle = borderStyle
  const borderColor = normalizeHexColor(record.borderColor)
  if (borderColor) next.borderColor = borderColor
  const paddingX = normalizeLengthValue(record.paddingX, "px")
  if (paddingX) next.paddingX = paddingX
  const paddingY = normalizeLengthValue(record.paddingY, "px")
  if (paddingY) next.paddingY = paddingY
  const paddingTop = normalizeLengthValue(record.paddingTop, "px")
  if (paddingTop) next.paddingTop = paddingTop
  const paddingRight = normalizeLengthValue(record.paddingRight, "px")
  if (paddingRight) next.paddingRight = paddingRight
  const paddingBottom = normalizeLengthValue(record.paddingBottom, "px")
  if (paddingBottom) next.paddingBottom = paddingBottom
  const paddingLeft = normalizeLengthValue(record.paddingLeft, "px")
  if (paddingLeft) next.paddingLeft = paddingLeft
  const marginTop = normalizeLengthValue(record.marginTop, "px")
  if (marginTop) next.marginTop = marginTop
  const marginRight = normalizeLengthValue(record.marginRight, "px")
  if (marginRight) next.marginRight = marginRight
  const marginBottom = normalizeLengthValue(record.marginBottom, "px")
  if (marginBottom) next.marginBottom = marginBottom
  const marginLeft = normalizeLengthValue(record.marginLeft, "px")
  if (marginLeft) next.marginLeft = marginLeft
  const width = normalizeLengthValue(record.width, "px")
  if (width) next.width = width
  const maxWidth = normalizeLengthValue(record.maxWidth, "px", true)
  if (maxWidth) next.maxWidth = maxWidth
  const boxShadow = normalizeShadowValue(record.boxShadow)
  if (boxShadow) next.boxShadow = boxShadow

  return next
}

export function cloneVisualEditorStyleDocument(document: VisualEditorStyleDocument): VisualEditorStyleDocument {
  return {
    fields: cloneRecord(document?.fields ?? {}),
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)

    return `{${entries.join(",")}}`
  }

  return JSON.stringify(value)
}

export function isVisualEditorStyleDocumentEqual(
  left: VisualEditorStyleDocument | null | undefined,
  right: VisualEditorStyleDocument | null | undefined,
) {
  return stableStringify(left ?? { fields: {} }) === stableStringify(right ?? { fields: {} })
}

export function normalizeVisualEditorStyleDocument(
  raw: unknown,
  fieldDefinitions: VisualEditorFieldDefinition[] = [],
): VisualEditorStyleDocument {
  const source = isPlainObject(raw)
    ? isPlainObject(raw.fields)
      ? (raw.fields as Record<string, unknown>)
      : raw
    : {}

  const fieldDefinitionByKey = new Map(fieldDefinitions.map((definition) => [definition.key, definition]))
  const fields: Record<string, VisualEditorFieldStyleValue> = {}

  Object.entries(source).forEach(([fieldKey, value]) => {
    const fieldDefinition = fieldDefinitionByKey.get(fieldKey)
    const styleGroup = getFieldStyleGroup(fieldDefinition)

    let normalized: VisualEditorFieldStyleValue | null = null
    if (styleGroup === "heading" || styleGroup === "text") {
      normalized = normalizeTextStyle(value)
    } else if (styleGroup === "interactive") {
      normalized = normalizeInteractiveStyle(value)
    } else if (styleGroup === "image") {
      normalized = normalizeImageStyle(value)
    } else if (styleGroup === "container") {
      normalized = normalizeContainerStyle(value)
    }

    if (normalized && Object.keys(normalized).length > 0) {
      fields[fieldKey] = normalized
    }
  })

  return { fields }
}

export function getVisualEditorStyleValue(document: VisualEditorStyleDocument, fieldKey: string) {
  const value = document?.fields?.[fieldKey]
  return isPlainObject(value) ? (cloneRecord(value) as VisualEditorFieldStyleValue) : null
}

export function setVisualEditorStyleValue(
  document: VisualEditorStyleDocument,
  fieldKey: string,
  fieldDefinition: VisualEditorFieldDefinition | undefined,
  value: unknown,
) {
  const nextDocument = cloneVisualEditorStyleDocument(document)
  const styleGroup = getFieldStyleGroup(fieldDefinition)

  let normalized: VisualEditorFieldStyleValue = {}
  if (styleGroup === "heading" || styleGroup === "text") {
    normalized = normalizeTextStyle(value)
  } else if (styleGroup === "interactive") {
    normalized = normalizeInteractiveStyle(value)
  } else if (styleGroup === "image") {
    normalized = normalizeImageStyle(value)
  } else if (styleGroup === "container") {
    normalized = normalizeContainerStyle(value)
  }

  if (Object.keys(normalized).length === 0) {
    delete nextDocument.fields[fieldKey]
    return nextDocument
  }

  nextDocument.fields[fieldKey] = normalized
  return nextDocument
}

export function resetVisualEditorStyleValue(document: VisualEditorStyleDocument, fieldKey: string) {
  const nextDocument = cloneVisualEditorStyleDocument(document)
  delete nextDocument.fields[fieldKey]
  return nextDocument
}

export function getVisualEditorStyleGroup(fieldDefinition?: VisualEditorFieldDefinition) {
  return getFieldStyleGroup(fieldDefinition)
}

export function parseVisualEditorLengthValue(value: string | undefined, fallbackUnit: "px" | "rem" | "em" | "%" = "px") {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return { value: "", unit: fallbackUnit }
  }

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/)
  if (!match) {
    return { value: normalized, unit: fallbackUnit }
  }

  return {
    value: match[1] ?? "",
    unit: (match[2] as "px" | "rem" | "em" | "%") ?? fallbackUnit,
  }
}

export function normalizeVisualEditorColorInput(value: string) {
  return normalizeHexColor(value) ?? ""
}

export function getVisualEditorTextStyle(value: VisualEditorFieldStyleValue | null | undefined, allowHeadingTag = false) {
  const style: CSSProperties = {}
  if (!value) return { style, headingTag: undefined as VisualEditorFieldStyleValue["headingTag"] | undefined }

  if (value.color) style.color = value.color
  if (value.backgroundColor) style.backgroundColor = value.backgroundColor
  if (value.fontFamily) style.fontFamily = value.fontFamily
  if (value.fontSize) style.fontSize = value.fontSize
  if (value.fontWeight) style.fontWeight = value.fontWeight
  if (value.lineHeight) style.lineHeight = value.lineHeight
  if (value.letterSpacing) style.letterSpacing = value.letterSpacing
  if (value.textAlign) style.textAlign = value.textAlign
  if (value.textTransform) style.textTransform = value.textTransform
  if (value.fontStyle) style.fontStyle = value.fontStyle
  if (value.textDecoration) style.textDecoration = value.textDecoration

  return {
    style,
    headingTag: allowHeadingTag ? normalizeVisualEditorTextSemanticTag(value.headingTag) : undefined,
  }
}

export function getVisualEditorInteractiveStyle(value: VisualEditorFieldStyleValue | null | undefined) {
  const style: CSSProperties = {}
  if (!value) return style

  if (value.color) style.color = value.color
  if (value.backgroundColor) style.backgroundColor = value.backgroundColor
  if (value.fontFamily) style.fontFamily = value.fontFamily
  if (value.fontSize) style.fontSize = value.fontSize
  if (value.fontWeight) style.fontWeight = value.fontWeight
  if (value.borderRadius) style.borderRadius = value.borderRadius
  if (value.borderWidth) style.borderWidth = value.borderWidth
  if (value.borderStyle) style.borderStyle = value.borderStyle
  if (value.borderColor) style.borderColor = value.borderColor
  if (value.boxShadow) style.boxShadow = value.boxShadow
  if (value.textAlign) style.textAlign = value.textAlign
  if (value.textDecoration) style.textDecoration = value.textDecoration

  const paddingY = value.paddingY
  const paddingX = value.paddingX
  if (paddingY || paddingX) {
    style.padding = `${paddingY ?? "0px"} ${paddingX ?? "0px"}`
  }

  return style
}

export function getVisualEditorImageWrapperStyle(value: VisualEditorFieldStyleValue | null | undefined) {
  const style: CSSProperties = {}
  if (!value) return style

  if (value.borderRadius) style.borderRadius = value.borderRadius
  if (value.width) style.width = value.width
  if (value.height) style.height = value.height
  if (value.maxWidth) style.maxWidth = value.maxWidth
  if (value.boxShadow) style.boxShadow = value.boxShadow
  return style
}

export function getVisualEditorImageStyle(value: VisualEditorFieldStyleValue | null | undefined) {
  const style: CSSProperties = {}
  if (!value) return style

  if (value.objectFit) style.objectFit = value.objectFit
  if (value.width) style.width = value.width
  if (value.height) style.height = value.height
  return style
}

export function getVisualEditorContainerStyle(value: VisualEditorFieldStyleValue | null | undefined) {
  const style: CSSProperties = {}
  if (!value) return style

  if (value.color) style.color = value.color
  if (value.backgroundColor) style.backgroundColor = value.backgroundColor
  if (value.backgroundImage) style.backgroundImage = `url("${value.backgroundImage}")`
  if (value.backgroundSize) style.backgroundSize = value.backgroundSize
  if (value.backgroundPosition) style.backgroundPosition = value.backgroundPosition
  if (value.backgroundRepeat) style.backgroundRepeat = value.backgroundRepeat
  if (value.borderRadius) style.borderRadius = value.borderRadius
  if (value.borderWidth) style.borderWidth = value.borderWidth
  if (value.borderStyle) style.borderStyle = value.borderStyle
  if (value.borderColor) style.borderColor = value.borderColor
  if (value.boxShadow) style.boxShadow = value.boxShadow
  if (value.width) style.width = value.width
  if (value.maxWidth) style.maxWidth = value.maxWidth
  if (value.marginTop) style.marginTop = value.marginTop
  if (value.marginRight) style.marginRight = value.marginRight
  if (value.marginBottom) style.marginBottom = value.marginBottom
  if (value.marginLeft) style.marginLeft = value.marginLeft

  if (value.paddingTop || value.paddingRight || value.paddingBottom || value.paddingLeft) {
    style.paddingTop = value.paddingTop ?? "0px"
    style.paddingRight = value.paddingRight ?? "0px"
    style.paddingBottom = value.paddingBottom ?? "0px"
    style.paddingLeft = value.paddingLeft ?? "0px"
  } else if (value.paddingY || value.paddingX) {
    style.padding = `${value.paddingY ?? "0px"} ${value.paddingX ?? "0px"}`
  }

  return style
}

export function getVisualEditorStyleSummary(value: VisualEditorFieldStyleValue | null | undefined) {
  if (!value) return "Sem estilo personalizado."
  const parts: string[] = []
  if (value.color) parts.push(`cor ${value.color}`)
  if (value.backgroundColor) parts.push(`fundo ${value.backgroundColor}`)
  if (value.backgroundImage) parts.push("imagem de fundo")
  if (value.borderColor) parts.push(`borda ${value.borderColor}`)
  if (value.fontFamily) parts.push("fonte personalizada")
  if (value.fontSize) parts.push(`tamanho ${value.fontSize}`)
  if (value.fontWeight) parts.push(`peso ${value.fontWeight}`)
  if (value.textDecoration) parts.push(`decoração ${value.textDecoration}`)
  if (value.borderRadius) parts.push(`raio ${value.borderRadius}`)
  if (value.boxShadow) parts.push("sombra")
  if (value.objectFit) parts.push(`imagem ${value.objectFit}`)
  return parts.length > 0 ? parts.join(" | ") : "Sem estilo personalizado."
}
