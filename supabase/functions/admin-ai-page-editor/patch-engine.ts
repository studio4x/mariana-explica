import type { AiEditMode, AiEditOperation, AiEditPlan } from "./contract.ts"
import {
  isPageStartSpacingRequest as isSharedPageStartSpacingRequest,
  wantsOnlyFirstSectionSpacing as wantsSharedFirstSectionSpacing,
  wantsOnlyPageWrapperSpacing as wantsSharedPageWrapperSpacing,
  wantsOnlySectionInternalSpacing as wantsSharedSectionInternalSpacing,
} from "./spacing-intent.ts"

export interface PatchEngineAttachmentContext {
  name: string
  mime_type?: string
}

export interface PatchEngineBaseVersion {
  id: string
  page_id: string
  version_number: number
  status: string
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

export interface PatchEngineInput {
  slug: string
  title: string
  path: string
  message: string
  editPlan: AiEditPlan
  baseVersion: PatchEngineBaseVersion
  proposalLayoutJson?: Record<string, unknown> | null
  proposalStyleJson?: Record<string, unknown> | null
  attachments?: PatchEngineAttachmentContext[]
}

export interface PatchEngineTargetSignalMap {
  id_structural: number
  internal_path: number
  data_attributes: number
  nearest_heading: number
  anchor_text: number
  visual_order: number
  textual_similarity: number
  capture_attachment: number
}

export interface PatchEngineTargetResolution {
  requested_target_id: string
  resolved_target_id: string
  candidate_path: string
  confidence: number
  section_index: number
  block_type: string
  selector: string
  signals: PatchEngineTargetSignalMap
}

export interface PatchEngineResult {
  layoutJson: Record<string, unknown>
  styleJson: Record<string, unknown>
  warnings: string[]
  invariants: Record<string, unknown>
  resolutions: PatchEngineTargetResolution[]
}

export interface SpacingSourceDiagnosis {
  source: "page_wrapper_spacing" | "first_section_spacing" | "section_internal_spacing"
  target_id: string
  selector: string
  detected_value: number | null
  reason: string
}

export interface RefinedSpacingPlanResult {
  editPlan: AiEditPlan
  warnings: string[]
  diagnosis: SpacingSourceDiagnosis[]
}

export interface FooterAdjacentSpacingCandidateDiagnosis {
  target_id: string
  candidate_path: string
  selector: string
  section_index: number
  block_type: string
  heading: string
  text_excerpt: string
  confidence: number
  reasons: string[]
  rejections: string[]
  spacing_values: Record<string, number | null>
}

export interface FooterAdjacentSpacingDiagnosis {
  branch_selected: "localized_visual_patch"
  target_id: "footer_adjacent_spacing"
  slug: string
  path: string
  html_anchor_text: string | null
  html_contains_anchor: boolean | null
  candidate_count: number
  candidates: FooterAdjacentSpacingCandidateDiagnosis[]
  candidate_reasons: string[]
  candidate_rejections: string[]
  confidence_scores: number[]
  recommended_operations: Array<Pick<AiEditOperation, "type" | "target_id" | "path" | "value" | "breakpoint">>
}

interface FooterCssSpacingDiagnosis {
  property: "margin-top" | "padding-top"
  value: number
  selector: string
}

interface TargetCandidate {
  target_id: string
  path: Array<string | number>
  path_key: string
  selector: string
  wrapper_selector: string
  content_selector: string
  scope: "page" | "section" | "block" | "text"
  block_type: string
  section_index: number
  visual_order: number
  text: string
  heading: string
  data_attributes: string[]
  links: string[]
  button_links: string[]
  raw_block: Record<string, unknown> | null
  patch_strategy?: "json_or_css" | "css_only"
}

interface ResolvedTargetCandidate {
  candidate: TargetCandidate
  confidence: number
  signals: PatchEngineTargetSignalMap
}

interface SafeStyleInstruction {
  property: string
  css_property: string
  target: "wrapper" | "content"
  kind: "json" | "css" | "compound"
  json_paths?: string[]
  value: unknown
  mode: "style" | "spacing"
}

const BLOCKED_STYLE_PATTERNS = [
  /<script/i,
  /url\s*\(/i,
  /javascript:/i,
  /expression\s*\(/i,
  /@import/i,
  /position\s*:\s*(fixed|absolute)/i,
  /z-index/i,
  /transform\s*:/i,
] as const

const SAFE_DISPLAY_VALUES = new Set(["block", "inline-block", "flex", "grid", "none"])
const SAFE_FLEX_DIRECTIONS = new Set(["row", "row-reverse", "column", "column-reverse"])
const SAFE_TEXT_ALIGN_VALUES = new Set(["left", "center", "right", "justify"])
const SAFE_ALIGN_VALUES = new Set(["start", "center", "end", "stretch", "left", "right", "top", "bottom"])
const SAFE_BACKGROUND_VALUES = /^(transparent|#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|linear-gradient\([^)]+\))$/i
const SAFE_COLOR_VALUES = /^(transparent|currentcolor|#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i
const SAFE_BORDER_VALUES = /^[0-9.]+px\s+(solid|dashed|dotted)\s+(transparent|#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i
const SAFE_BOX_SHADOW_VALUES = /^(none|[0-9.\spxrgba(),#-]+)$/i
const SAFE_GRID_TEMPLATE_VALUES = /^repeat\((1|2|3|4),\s*minmax\(0,\s*1fr\)\)$|^(1fr)(\s+1fr){0,3}$/i

const ORDINAL_HINTS: Array<{ pattern: RegExp; index: number }> = [
  { pattern: /\bprimeir[ao]\b/i, index: 0 },
  { pattern: /\bsegund[ao]\b/i, index: 1 },
  { pattern: /\bterceir[ao]\b/i, index: 2 },
  { pattern: /\bquart[ao]\b/i, index: 3 },
]

const CRITICAL_ROUTE_HINTS = ["/checkout", "/login", "/criar-conta", "/suporte", "/aluno", "/cursos"]
const CTA_LABEL_HINTS = ["comprar", "checkout", "matricule-se", "começar", "comecar", "inscrever", "assinar"]
const KNOWN_SECTION_WRAPPER_TOP_SPACING: Record<string, number> = {
  "me-about-page": 56,
  "me-home-section": 72,
  "me-legal-page": 28,
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9/-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]+/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeIdentifier(value: unknown) {
  return normalizeString(value)
    .replace(/[^a-zA-Z0-9:_./-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function parseSizeToPixels(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const normalized = normalizeString(value).toLowerCase()
  if (!normalized) return null
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px)?$/)
  if (!match) return null
  return Number(match[1])
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
      .map((item) => cloneJsonValue(item as Record<string, unknown>))
  }

  if (Array.isArray(record.blocks)) {
    return record.blocks
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => cloneJsonValue(item as Record<string, unknown>))
  }

  return []
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

function appendCssPatchToStyleJson(styleJson: Record<string, unknown>, cssPatch: string) {
  const nextStyleJson = cloneJsonValue(styleJson ?? {})
  const existingCss = typeof nextStyleJson.css === "string" ? nextStyleJson.css.trim() : ""
  nextStyleJson.css = existingCss ? `${existingCss}\n\n${cssPatch}` : cssPatch
  return nextStyleJson
}

function collectDataAttributes(source: string) {
  const matches = source.match(/data-[a-z0-9:_-]+(?:="[^"]*")?/gi) ?? []
  return matches
    .map((entry) => entry.replace(/"/g, "").trim())
    .filter(Boolean)
}

function collectLinksFromHtml(source: string) {
  const links = Array.from(source.matchAll(/\shref=(['"])(.*?)\1/gi)).map((match) => normalizeString(match[2]))
  return uniqueStrings(links.filter(Boolean))
}

function collectSectionClassNamesFromHtml(source: string) {
  const matches = Array.from(source.matchAll(/<section[^>]*class=(['"])(.*?)\1/gi))
  return uniqueStrings(
    matches.flatMap((match) =>
      normalizeString(match[2])
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function collectSectionClassNamesFromBlock(block: Record<string, unknown>) {
  const type = normalizeString(block.type).toLowerCase()
  const values: string[] = []

  if (type === "rich_text" && typeof block.content === "string") {
    values.push(...collectSectionClassNamesFromHtml(block.content))
  }

  if (type === "columns" && Array.isArray(block.items)) {
    for (const item of block.items) {
      values.push(...collectSectionClassNamesFromHtml(normalizeString(item)))
    }
  }

  if (type === "container" && Array.isArray(block.children)) {
    for (const column of block.children) {
      if (!Array.isArray(column)) continue
      for (const child of column) {
        if (!child || typeof child !== "object" || Array.isArray(child)) continue
        values.push(...collectSectionClassNamesFromBlock(child as Record<string, unknown>))
      }
    }
  }

  return uniqueStrings(values)
}

function getKnownSectionSpacingClass(block: Record<string, unknown>) {
  const classes = collectSectionClassNamesFromBlock(block)
  return (
    classes.find((className) => Object.prototype.hasOwnProperty.call(KNOWN_SECTION_WRAPPER_TOP_SPACING, className)) ?? null
  )
}

function isPageStartSpacingRequest(message: string) {
  return /\b(in[ií]cio da p[aá]gina|come[cç]o da p[aá]gina|espa[cç]o no in[ií]cio|espa[cç]o antes do conte[uú]do da primeira se[cç][aã]o)\b/i.test(
    message,
  )
}

function wantsOnlyPageWrapperSpacing(message: string) {
  return /\b(wrapper global|wrapper da p[aá]gina|page root|page wrapper|me-managed-page-root)\b/i.test(message)
}

function wantsOnlyFirstSectionSpacing(message: string) {
  return /\b(primeira se[cç][aã]o|me-about-page|me-home-section|me-legal-page)\b/i.test(message)
}

function wantsOnlySectionInternalSpacing(message: string) {
  return /\b(interno da se[cç][aã]o|padding interno|bloco inline|bloco interno|dentro da primeira se[cç][aã]o)\b/i.test(message)
}

function collectButtonLinksFromBlock(block: Record<string, unknown>) {
  const type = normalizeString(block.type).toLowerCase()
  if (type === "button") {
    const href = normalizeString(block.href)
    return href ? [href] : []
  }
  return []
}

function stripHtml(source: string) {
  return source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function findFirstHeadingText(value: unknown): string {
  if (typeof value === "string") {
    const match = value.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
    return match ? stripHtml(match[1]) : ""
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstHeadingText(item)
      if (found) return found
    }
    return ""
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (normalizeString(record.type).toLowerCase() === "heading") {
      return normalizeString(record.content)
    }
    for (const item of Object.values(record)) {
      const found = findFirstHeadingText(item)
      if (found) return found
    }
  }

  return ""
}

function collectBlockText(block: Record<string, unknown>): string {
  const type = normalizeString(block.type).toLowerCase()
  if (type === "heading") return normalizeString(block.content)
  if (type === "rich_text") return stripHtml(normalizeString(block.content))
  if (type === "button") return `${normalizeString(block.label)} ${normalizeString(block.href)}`
  if (type === "image") return `${normalizeString(block.alt)} ${normalizeString(block.src)}`
  if (type === "columns") {
    const items = Array.isArray(block.items) ? block.items.map((item) => stripHtml(normalizeString(item))) : []
    return items.join(" ")
  }
  if (type === "container") {
    const children = Array.isArray(block.children) ? block.children : []
    return children
      .flatMap((column) =>
        Array.isArray(column)
          ? column.map((child) => (child && typeof child === "object" && !Array.isArray(child) ? collectBlockText(child as Record<string, unknown>) : ""))
          : [],
      )
      .join(" ")
  }
  return normalizeString((block as Record<string, unknown>).content)
}

function collectBlockDataAttributes(block: Record<string, unknown>) {
  const type = normalizeString(block.type).toLowerCase()
  const values: string[] = []

  if (type === "rich_text" && typeof block.content === "string") {
    values.push(...collectDataAttributes(block.content))
  }

  if (type === "columns" && Array.isArray(block.items)) {
    for (const item of block.items) {
      values.push(...collectDataAttributes(normalizeString(item)))
    }
  }

  if (type === "container" && Array.isArray(block.children)) {
    for (const column of block.children) {
      if (!Array.isArray(column)) continue
      for (const child of column) {
        if (!child || typeof child !== "object" || Array.isArray(child)) continue
        values.push(...collectBlockDataAttributes(child as Record<string, unknown>))
      }
    }
  }

  return uniqueStrings(values)
}

function collectBlockLinks(block: Record<string, unknown>) {
  const type = normalizeString(block.type).toLowerCase()
  const links = [...collectButtonLinksFromBlock(block)]

  if (type === "rich_text" && typeof block.content === "string") {
    links.push(...collectLinksFromHtml(block.content))
  }

  if (type === "columns" && Array.isArray(block.items)) {
    for (const item of block.items) {
      links.push(...collectLinksFromHtml(normalizeString(item)))
    }
  }

  if (type === "container" && Array.isArray(block.children)) {
    for (const column of block.children) {
      if (!Array.isArray(column)) continue
      for (const child of column) {
        if (!child || typeof child !== "object" || Array.isArray(child)) continue
        links.push(...collectBlockLinks(child as Record<string, unknown>))
      }
    }
  }

  return uniqueStrings(links)
}

function candidateContentSelector(block: Record<string, unknown>, wrapperSelector: string) {
  const type = normalizeString(block.type).toLowerCase()
  if (type === "columns") return `${wrapperSelector} > .me-managed-columns`
  if (type === "container") return `${wrapperSelector} > .me-managed-container`
  if (type === "rich_text") return `${wrapperSelector} > .me-managed-richtext`
  if (type === "button") return `${wrapperSelector} a`
  if (type === "heading") {
    const level = clamp(Number(block.level ?? 2), 1, 6)
    return `${wrapperSelector} > h${level}`
  }
  if (type === "image") return `${wrapperSelector} > img`
  if (type === "divider" || type === "spacer") return wrapperSelector
  return wrapperSelector
}

function buildTargetCandidates(blocks: Record<string, unknown>[]) {
  const candidates: TargetCandidate[] = [
    {
      target_id: "page-root",
      path: [],
      path_key: "page-root",
      selector: ".me-managed-page-root",
      wrapper_selector: ".me-managed-page-root",
      content_selector: ".me-managed-page-root",
      scope: "page",
      block_type: "page",
      section_index: -1,
      visual_order: 0,
      text: blocks.map((block) => collectBlockText(block)).join(" "),
      heading: "",
      data_attributes: uniqueStrings(blocks.flatMap((block) => collectBlockDataAttributes(block))),
      links: uniqueStrings(blocks.flatMap((block) => collectBlockLinks(block))),
      button_links: uniqueStrings(blocks.flatMap((block) => collectButtonLinksFromBlock(block))),
      raw_block: null,
    },
    {
      target_id: "page_wrapper_spacing",
      path: [0],
      path_key: "page-wrapper-spacing",
      selector: ".me-managed-page-root",
      wrapper_selector: ".me-managed-page-root",
      content_selector: ".me-managed-page-root",
      scope: "section",
      block_type: "page_wrapper_spacing",
      section_index: 0,
      visual_order: 0,
      text: `wrapper global da pagina me-managed-page-root ${blocks.map((block) => collectBlockText(block)).join(" ")}`,
      heading: "",
      data_attributes: uniqueStrings(blocks.flatMap((block) => collectBlockDataAttributes(block))),
      links: uniqueStrings(blocks.flatMap((block) => collectBlockLinks(block))),
      button_links: uniqueStrings(blocks.flatMap((block) => collectButtonLinksFromBlock(block))),
      raw_block: null,
      patch_strategy: "css_only",
    },
  ]

  let lastHeading = ""

  const visitBlock = (
    block: Record<string, unknown>,
    path: Array<string | number>,
    sectionIndex: number,
    scope: "section" | "block" | "text",
    wrapperSelector: string,
  ) => {
    const blockType = normalizeString(block.type).toLowerCase()
    const heading = blockType === "heading" ? normalizeString(block.content) : findFirstHeadingText(block) || lastHeading
    if (blockType === "heading" && heading) {
      lastHeading = heading
    }

    const candidate: TargetCandidate = {
      target_id: normalizeIdentifier(block.id) || `candidate-${sectionIndex + 1}-${path.join("-")}`,
      path,
      path_key: pathToKey(path),
      selector: wrapperSelector,
      wrapper_selector: wrapperSelector,
      content_selector: candidateContentSelector(block, wrapperSelector),
      scope,
      block_type: blockType,
      section_index: sectionIndex,
      visual_order: sectionIndex + 1,
      text: collectBlockText(block),
      heading,
      data_attributes: collectBlockDataAttributes(block),
      links: collectBlockLinks(block),
      button_links: collectButtonLinksFromBlock(block),
      raw_block: block,
    }
    candidates.push(candidate)

    if (blockType === "container" && Array.isArray(block.children)) {
      block.children.forEach((column, columnIndex) => {
        if (!Array.isArray(column)) return
        column.forEach((child, childIndex) => {
          if (!child || typeof child !== "object" || Array.isArray(child)) return
          visitBlock(
            child as Record<string, unknown>,
            [...path, "children", columnIndex, childIndex],
            sectionIndex,
            blockType === "container" ? "block" : scope,
            `${candidate.content_selector} > .me-managed-container-column:nth-of-type(${columnIndex + 1}) > .me-managed-block:nth-of-type(${childIndex + 1})`,
          )
        })
      })
    }
  }

  blocks.forEach((block, index) => {
    visitBlock(
      block,
      [index],
      index,
      "section",
      `.me-managed-page-root > .me-managed-block:nth-of-type(${index + 1})`,
    )

    if (index === 0) {
      const knownSectionClass = getKnownSectionSpacingClass(block)
      const firstSectionSelector = knownSectionClass
        ? `.me-managed-page-root > .me-managed-block:nth-of-type(1) section.${knownSectionClass}`
        : `.me-managed-page-root > .me-managed-block:nth-of-type(1) section:first-of-type`

      candidates.push({
        target_id: "first_section_spacing",
        path: [index],
        path_key: "first-section-spacing",
        selector: firstSectionSelector,
        wrapper_selector: firstSectionSelector,
        content_selector: firstSectionSelector,
        scope: "section",
        block_type: "first_section_spacing",
        section_index: 0,
        visual_order: 1,
        text: `primeira secao wrapper ${knownSectionClass ?? "section"} ${collectBlockText(block)}`,
        heading: findFirstHeadingText(block),
        data_attributes: collectBlockDataAttributes(block),
        links: collectBlockLinks(block),
        button_links: collectButtonLinksFromBlock(block),
        raw_block: block,
        patch_strategy: "css_only",
      })

      candidates.push({
        target_id: "section_internal_spacing",
        path: [index],
        path_key: "section-internal-spacing",
        selector: `.me-managed-page-root > .me-managed-block:nth-of-type(1)`,
        wrapper_selector: `.me-managed-page-root > .me-managed-block:nth-of-type(1)`,
        content_selector: `.me-managed-page-root > .me-managed-block:nth-of-type(1)`,
        scope: "section",
        block_type: "section_internal_spacing",
        section_index: 0,
        visual_order: 1,
        text: `padding interno primeira secao bloco inline ${collectBlockText(block)}`,
        heading: findFirstHeadingText(block),
        data_attributes: collectBlockDataAttributes(block),
        links: collectBlockLinks(block),
        button_links: collectButtonLinksFromBlock(block),
        raw_block: block,
        patch_strategy: "json_or_css",
      })
    }
  })

  blocks.forEach((block, index) => {
    const distanceFromEnd = blocks.length - 1 - index
    if (distanceFromEnd > 3) return
    candidates.push({
      target_id: "footer_adjacent_spacing",
      path: [index],
      path_key: `footer-adjacent-spacing-${index + 1}`,
      selector: `.me-managed-page-root > .me-managed-block:nth-of-type(${index + 1})`,
      wrapper_selector: `.me-managed-page-root > .me-managed-block:nth-of-type(${index + 1})`,
      content_selector: `.me-managed-page-root > .me-managed-block:nth-of-type(${index + 1})`,
      scope: "section",
      block_type: "footer_adjacent_spacing",
      section_index: index,
      visual_order: index + 1,
      text: `ultima secao fim da pagina espaco antes do rodape footer ${distanceFromEnd === 0 ? "ultimo bloco" : "bloco proximo ao fim"} ${collectBlockText(block)}`,
      heading: findFirstHeadingText(block),
      data_attributes: collectBlockDataAttributes(block),
      links: collectBlockLinks(block),
      button_links: collectButtonLinksFromBlock(block),
      raw_block: block,
      patch_strategy: "json_or_css",
    })
  })

  return candidates
}

function pathToKey(path: Array<string | number>) {
  if (path.length === 0) return "page-root"
  let key = "blocks"
  for (const segment of path) {
    key += typeof segment === "number" ? `[${segment}]` : `.${segment}`
  }
  return key
}

function extractQuotedTexts(message: string) {
  return Array.from(message.matchAll(/["']([^"']+)["']/g)).map((match) => normalizeString(match[1])).filter(Boolean)
}

function extractAnchorTexts(operation: AiEditOperation, message: string) {
  const anchors = [...extractQuotedTexts(message)]
  if (operation.value && typeof operation.value === "object" && !Array.isArray(operation.value)) {
    const record = operation.value as Record<string, unknown>
    anchors.push(normalizeString(record.from))
    anchors.push(normalizeString(record.anchor_text))
    anchors.push(normalizeString(record.text))
    anchors.push(normalizeString(record.target_text))
  }
  return uniqueStrings(anchors.filter(Boolean))
}

function extractVisualOrderHint(message: string) {
  for (const hint of ORDINAL_HINTS) {
    if (hint.pattern.test(message)) return hint.index
  }
  if (/\bultima\b|\búltima\b/i.test(message)) return -1
  return null
}

function compareTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

function buildSignalMap(): PatchEngineTargetSignalMap {
  return {
    id_structural: 0,
    internal_path: 0,
    data_attributes: 0,
    nearest_heading: 0,
    anchor_text: 0,
    visual_order: 0,
    textual_similarity: 0,
    capture_attachment: 0,
  }
}

export function refineSpacingEditPlanForKnownWrappers(input: {
  message: string
  editPlan: AiEditPlan
  baseVersion: PatchEngineBaseVersion
}): RefinedSpacingPlanResult {
  if (input.editPlan.mode !== "spacing_patch" && !isSharedPageStartSpacingRequest(input.message)) {
    return {
      editPlan: input.editPlan,
      warnings: [],
      diagnosis: [],
    }
  }

  const blocks = extractBlocksFromLayoutJson(input.baseVersion.layout_json)
  const firstBlock = blocks[0] ?? null
  if (!firstBlock) {
    return {
      editPlan: input.editPlan,
      warnings: [],
      diagnosis: [],
    }
  }

  const diagnosis: SpacingSourceDiagnosis[] = [
    {
      source: "page_wrapper_spacing",
      target_id: "page_wrapper_spacing",
      selector: ".me-managed-page-root",
      detected_value: 56,
      reason: "A raiz renderizada usa padding-top global conhecido em .me-managed-page-root.",
    },
  ]

  const knownSectionClass = getKnownSectionSpacingClass(firstBlock)
  if (knownSectionClass) {
    diagnosis.push({
      source: "first_section_spacing",
      target_id: "first_section_spacing",
      selector: `.me-managed-page-root > .me-managed-block:nth-of-type(1) section.${knownSectionClass}`,
      detected_value: KNOWN_SECTION_WRAPPER_TOP_SPACING[knownSectionClass] ?? null,
      reason: `A primeira seção renderizada usa a classe conhecida .${knownSectionClass}.`,
    })
  }

  const firstLayout =
    firstBlock.layout && typeof firstBlock.layout === "object" && !Array.isArray(firstBlock.layout)
      ? (firstBlock.layout as Record<string, unknown>)
      : {}
  const internalSpacing = Math.max(
    Number(firstLayout.paddingTop ?? 0) || 0,
    Number(firstLayout.marginTop ?? 0) || 0,
  )
  if (internalSpacing > 0) {
    diagnosis.push({
      source: "section_internal_spacing",
      target_id: "section_internal_spacing",
      selector: ".me-managed-page-root > .me-managed-block:nth-of-type(1)",
      detected_value: internalSpacing,
      reason: "O primeiro bloco inline ainda possui spacing próprio no wrapper gerido.",
    })
  }

  if (!isSharedPageStartSpacingRequest(input.message)) {
    return {
      editPlan: input.editPlan,
      warnings: [],
      diagnosis,
    }
  }

  const sourceById = new Map(diagnosis.map((item) => [item.target_id, item]))
  const explicitTargetIds = input.editPlan.target_ids.filter((targetId) => sourceById.has(targetId))
  const normalizedMessage = normalizeText(input.message)
  const explicitlyTargetsWrapperAndFirstSection =
    explicitTargetIds.includes("page_wrapper_spacing") &&
    explicitTargetIds.includes("first_section_spacing") &&
    /\b(tambem|ambos|nos dois)\b/.test(normalizedMessage)

  let selectedTargetIds: string[]
  if (explicitlyTargetsWrapperAndFirstSection) {
    selectedTargetIds = ["page_wrapper_spacing", "first_section_spacing"]
  } else if (wantsSharedPageWrapperSpacing(input.message)) {
    selectedTargetIds = ["page_wrapper_spacing"]
  } else if (wantsSharedSectionInternalSpacing(input.message)) {
    selectedTargetIds = diagnosis.some((item) => item.target_id === "section_internal_spacing")
      ? ["section_internal_spacing"]
      : []
  } else if (wantsSharedFirstSectionSpacing(input.message)) {
    selectedTargetIds = diagnosis.some((item) => item.target_id === "first_section_spacing")
      ? ["first_section_spacing"]
      : []
  } else if (explicitTargetIds.length > 0) {
    selectedTargetIds = explicitTargetIds
  } else {
    selectedTargetIds = diagnosis.map((item) => item.target_id)
  }

  selectedTargetIds = uniqueStrings(
    selectedTargetIds.filter((targetId) => {
      const source = sourceById.get(targetId)
      return Boolean(source && (source.detected_value === null || source.detected_value > 0))
    }),
  )

  if (selectedTargetIds.length === 0) {
    return {
      editPlan: input.editPlan,
      warnings: [],
      diagnosis,
    }
  }

  const breakpoint = input.editPlan.operations[0]?.breakpoint ?? "all"
  const refinedPlan: AiEditPlan = {
    scope: "section",
    mode: "spacing_patch",
    target_ids: selectedTargetIds,
    risk_level: selectedTargetIds.length > 1 ? "medium" : input.editPlan.risk_level,
    requires_strict_confirmation: true,
    operations: selectedTargetIds.map((targetId) => ({
      type: "set_style",
      target_id: targetId,
      path: "padding-top",
      value: 0,
      breakpoint,
    })),
  }

  const selectedSources = selectedTargetIds.map((targetId) => sourceById.get(targetId)).filter(Boolean) as SpacingSourceDiagnosis[]
  const warnings: string[] = []
  if (selectedSources.length > 1) {
    warnings.push(
      "Encontrei espaço no wrapper da página e dentro da primeira seção. Posso remover apenas um deles ou ambos; por segurança, o plano atual remove apenas as fontes reais de spacing detectadas.",
    )
  }

  return {
    editPlan: refinedPlan,
    warnings,
    diagnosis,
  }
}

function scoreCandidate(input: {
  candidate: TargetCandidate
  requestedTarget: string
  plan: AiEditPlan
  operation: AiEditOperation
  message: string
  attachments: PatchEngineAttachmentContext[]
}) {
  const normalizedRequestedTarget = normalizeIdentifier(input.requestedTarget).toLowerCase()
  const requestedVirtualSpacingTarget = [
    "page_wrapper_spacing",
    "first_section_spacing",
    "section_internal_spacing",
  ].includes(normalizedRequestedTarget)
  const requestedLocalizedTarget =
    normalizedRequestedTarget.startsWith("localized_") ||
    normalizedRequestedTarget.startsWith("localized-")
  const requestedFooterAdjacentSpacingTarget = normalizedRequestedTarget === "footer_adjacent_spacing"
  const requestedLocalizedDivider = requestedLocalizedTarget && normalizedRequestedTarget.includes("divider")
  const requestedLocalizedButton = requestedLocalizedTarget && normalizedRequestedTarget.includes("button")
  const requestedLocalizedCard = requestedLocalizedTarget && normalizedRequestedTarget.includes("card")
  const requestedLocalizedHeading =
    requestedLocalizedTarget &&
    (normalizedRequestedTarget.includes("heading") ||
      normalizedRequestedTarget.includes("title") ||
      normalizedRequestedTarget.includes("titulo"))
  const candidateId = input.candidate.target_id.toLowerCase()
  const candidatePath = input.candidate.path_key.toLowerCase()
  const candidateHeading = input.candidate.heading
  const candidateText = input.candidate.text
  const candidateData = input.candidate.data_attributes.join(" ")
  const signals = buildSignalMap()

  if (normalizedRequestedTarget && candidateId === normalizedRequestedTarget) {
    signals.id_structural = 0.46
  } else if (normalizedRequestedTarget && candidateId.includes(normalizedRequestedTarget)) {
    signals.id_structural = 0.3
  }

  if (requestedLocalizedDivider && ["heading", "rich_text", "container"].includes(input.candidate.block_type)) {
    signals.id_structural = Math.max(signals.id_structural, 0.18)
  }

  if (requestedLocalizedButton && input.candidate.block_type === "button") {
    signals.id_structural = Math.max(signals.id_structural, 0.58)
    if (input.candidate.section_index === 0 || /\b(principal|primary|inicial|primeir[ao]|hero)\b/i.test(input.message)) {
      signals.visual_order = Math.max(signals.visual_order, 0.24)
    }
  }

  if (requestedLocalizedCard && ["container", "columns", "rich_text"].includes(input.candidate.block_type)) {
    const candidateLooksLikeCard = /\b(card|cards|cart[aã]o)\b/i.test(`${candidateId} ${candidateText} ${candidateData}`)
    signals.id_structural = Math.max(signals.id_structural, candidateLooksLikeCard ? 0.8 : 0.12)
    if (/\b(card|cart[aã]o)\b/i.test(input.message) && candidateLooksLikeCard) {
      signals.textual_similarity = Math.max(signals.textual_similarity, 0.22)
      signals.capture_attachment = Math.max(signals.capture_attachment, 0.1)
    }
  }

  if (requestedLocalizedHeading && input.candidate.block_type === "heading") {
    signals.id_structural = Math.max(signals.id_structural, 0.58)
    if (input.candidate.section_index === 0) {
      signals.visual_order = Math.max(signals.visual_order, 0.24)
    }
  }

  const rawTargetPath =
    input.operation.value && typeof input.operation.value === "object" && !Array.isArray(input.operation.value)
      ? normalizeString((input.operation.value as Record<string, unknown>).target_path)
      : ""

  if (rawTargetPath && candidatePath === rawTargetPath.toLowerCase()) {
    signals.internal_path = 0.36
  } else if (normalizedRequestedTarget && candidatePath.includes(normalizedRequestedTarget)) {
    signals.internal_path = 0.14
  }

  if (candidateData) {
    const attributeOverlap = compareTokenOverlap(`${normalizedRequestedTarget} ${input.message}`, candidateData)
    signals.data_attributes = Math.min(0.16, attributeOverlap * 0.2)
  }

  if (isSharedPageStartSpacingRequest(input.message)) {
    if (input.candidate.block_type === "page_wrapper_spacing") {
      signals.id_structural = Math.max(signals.id_structural, 0.34)
      signals.visual_order = Math.max(signals.visual_order, 0.14)
    }

    if (input.candidate.block_type === "first_section_spacing") {
      signals.id_structural = Math.max(signals.id_structural, 0.38)
      signals.visual_order = Math.max(signals.visual_order, 0.2)
    }

    if (input.candidate.block_type === "section_internal_spacing") {
      signals.id_structural = Math.max(signals.id_structural, 0.26)
      signals.visual_order = Math.max(signals.visual_order, 0.16)
    }
  }

  if (wantsSharedPageWrapperSpacing(input.message) && input.candidate.block_type === "page_wrapper_spacing") {
    signals.id_structural = Math.max(signals.id_structural, 0.52)
  }

  if (wantsSharedFirstSectionSpacing(input.message)) {
    if (input.candidate.block_type === "first_section_spacing") {
      signals.id_structural = Math.max(signals.id_structural, 0.5)
    }

    if (input.candidate.block_type === "section_internal_spacing") {
      signals.id_structural = Math.max(signals.id_structural, 0.44)
    }

    if (
      !requestedVirtualSpacingTarget &&
      input.candidate.section_index === 0 &&
      input.candidate.scope === "section" &&
      input.candidate.block_type !== "page_wrapper_spacing" &&
      input.candidate.block_type !== "first_section_spacing" &&
      input.candidate.block_type !== "section_internal_spacing"
    ) {
      signals.id_structural = Math.max(signals.id_structural, 0.62)
      signals.visual_order = Math.max(signals.visual_order, 0.24)
      signals.textual_similarity = Math.max(signals.textual_similarity, 0.16)
    }
  }

  if (wantsSharedSectionInternalSpacing(input.message) && input.candidate.block_type === "section_internal_spacing") {
    signals.id_structural = Math.max(signals.id_structural, 0.48)
  }

  if (requestedFooterAdjacentSpacingTarget && input.candidate.block_type === "footer_adjacent_spacing") {
    signals.id_structural = Math.max(signals.id_structural, 0.64)
    signals.visual_order = Math.max(signals.visual_order, clamp(input.candidate.visual_order / 10, 0.08, 0.24))
    if (input.candidate.text.includes("ultimo bloco")) {
      signals.visual_order = Math.max(signals.visual_order, 0.34)
    } else if (input.candidate.text.includes("bloco proximo ao fim")) {
      signals.visual_order = Math.max(signals.visual_order, 0.12)
    }
    if (/\b(rodape|footer|ultima secao|secao final|fim da pagina)\b/i.test(input.message)) {
      signals.textual_similarity = Math.max(signals.textual_similarity, 0.18)
    }
  }

  if (candidateHeading) {
    const headingOverlap = compareTokenOverlap(`${normalizedRequestedTarget} ${input.message}`, candidateHeading)
    signals.nearest_heading = Math.min(0.18, headingOverlap * 0.22)
  }

  const anchorTexts = extractAnchorTexts(input.operation, input.message)
  if (anchorTexts.length > 0) {
    const anchorHit = anchorTexts.some((anchor) => normalizeText(candidateText).includes(normalizeText(anchor)))
    if (anchorHit) {
      signals.anchor_text = requestedLocalizedTarget || requestedFooterAdjacentSpacingTarget ? 0.54 : 0.28
      if (requestedLocalizedTarget || requestedFooterAdjacentSpacingTarget) {
        signals.nearest_heading = Math.max(signals.nearest_heading, 0.18)
        signals.visual_order = Math.max(signals.visual_order, 0.1)
      }
    }
  }

  const orderHint = extractVisualOrderHint(input.message)
  if (orderHint !== null) {
    if (orderHint === -1) {
      const maxSectionIndex = Math.max(0, ...input.plan.target_ids.map(() => input.candidate.section_index))
      if (input.candidate.section_index === maxSectionIndex) {
        signals.visual_order = Math.max(signals.visual_order, 0.18)
      }
    } else if (input.candidate.section_index === orderHint) {
      signals.visual_order = Math.max(signals.visual_order, 0.22)
    }
  }

  const similarityQuery = [input.message, normalizedRequestedTarget, candidateHeading].filter(Boolean).join(" ")
  const similarityScore = compareTokenOverlap(similarityQuery, `${candidateText} ${candidateHeading} ${candidateData}`)
  signals.textual_similarity = Math.min(0.18, similarityScore * 0.22)

  const attachmentTerms = input.attachments.map((attachment) => attachment.name).join(" ")
  if (attachmentTerms && /\b(anexo|captura|recorte|imagem|area|área)\b/i.test(input.message)) {
    const attachmentOverlap = compareTokenOverlap(attachmentTerms, `${candidateText} ${candidateHeading} ${candidateData} ${candidateId}`)
    signals.capture_attachment = Math.min(0.1, attachmentOverlap * 0.14)
  }

  const confidence = Math.min(
    1,
    signals.id_structural +
      signals.internal_path +
      signals.data_attributes +
      signals.nearest_heading +
      signals.anchor_text +
      signals.visual_order +
      signals.textual_similarity +
      signals.capture_attachment,
  )

  return { confidence, signals }
}

function resolveTargetCandidate(input: {
  blocks: Record<string, unknown>[]
  plan: AiEditPlan
  operation: AiEditOperation
  message: string
  attachments: PatchEngineAttachmentContext[]
}) {
  const requestedTarget = normalizeIdentifier(input.operation.target_id) || input.plan.target_ids[0] || "target"
  const normalizedRequestedTarget = requestedTarget.toLowerCase()
  let candidates = buildTargetCandidates(input.blocks).filter((candidate) => {
    if (input.plan.scope === "page") return candidate.scope === "page"
    if (input.plan.scope === "section") return candidate.scope === "section"
    if (input.plan.scope === "block") return candidate.scope === "section" || candidate.scope === "block"
    if (input.plan.scope === "text") {
      return ["heading", "rich_text", "button", "columns"].includes(candidate.block_type)
    }
    return candidate.scope !== "page"
  })

  if (input.plan.scope === "header" || input.plan.scope === "footer") {
    throw new Error("Este patch engine persistível está restrito a seções de páginas com site_page_versions e não aceita header/footer globais.")
  }

  if (normalizedRequestedTarget === "footer_adjacent_spacing") {
    candidates = candidates.filter((candidate) => candidate.block_type === "footer_adjacent_spacing")
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      ...scoreCandidate({
        candidate,
        requestedTarget,
        plan: input.plan,
        operation: input.operation,
        message: input.message,
        attachments: input.attachments,
      }),
    }))
    .sort((left, right) => right.confidence - left.confidence)

  const best = ranked[0] ?? null
  if (!best || best.confidence < 0.2) {
    throw new Error(`Não encontrei um alvo seguro para "${requestedTarget}" na base atual da página.`)
  }

  if (best.candidate.target_id === "page-root") {
    throw new Error("O patch engine seguro não permite aplicar esta fase diretamente no wrapper raiz da página.")
  }

  return {
    candidate: best.candidate,
    confidence: best.confidence,
    signals: best.signals,
  } satisfies ResolvedTargetCandidate
}

function extractLayoutSpacingValues(block: Record<string, unknown> | null) {
  const layout =
    block?.layout && typeof block.layout === "object" && !Array.isArray(block.layout)
      ? (block.layout as Record<string, unknown>)
      : {}
  return {
    paddingBottom: toNumber(layout.paddingBottom ?? block?.paddingBottom),
    marginBottom: toNumber(layout.marginBottom ?? block?.marginBottom),
    gap: toNumber(block?.gap ?? layout.gap ?? layout.contentGap),
    rowGap: toNumber(block?.rowGap ?? layout.rowGap),
    minHeight: toNumber(layout.minHeight ?? block?.height),
    height: toNumber(block?.height),
  }
}

function isLikelyEmptySpacerBlock(block: Record<string, unknown> | null) {
  if (!block) return false
  const type = normalizeString(block.type).toLowerCase()
  const id = normalizeIdentifier(block.id).toLowerCase()
  const className = normalizeString(block.className ?? block.class_name).toLowerCase()
  const marker = `${type} ${id} ${className}`
  const text = normalizeText(collectBlockText(block))
  const spacerMarker = /\b(spacer|divider|gap|space|section-space|footer-space|separador|divisor)\b/i.test(marker)
  const emptyRichText = type === "rich_text" && text.length === 0
  return spacerMarker || emptyRichText
}

function extractFooterCssSpacing(styleJson: Record<string, unknown>): FooterCssSpacingDiagnosis[] {
  const css = typeof styleJson.css === "string" ? styleJson.css : ""
  if (!css.trim()) return []

  const results: FooterCssSpacingDiagnosis[] = []
  const rulePattern = /([^{}]*(?:footer|rodape|rodap[eé])[^{}]*)\{([^{}]+)\}/gi
  let match: RegExpExecArray | null
  while ((match = rulePattern.exec(css))) {
    const selector = normalizeString(match[1]).trim()
    const body = normalizeString(match[2])
    if (!selector || /header|menu|nav/i.test(selector)) continue
    for (const property of ["margin-top", "padding-top"] as const) {
      const propertyMatch = body.match(new RegExp(`${property}\\s*:\\s*([0-9.]+)px`, "i"))
      const value = propertyMatch ? Number(propertyMatch[1]) : NaN
      if (Number.isFinite(value) && value > 0) {
        results.push({ property, value, selector })
      }
    }
  }
  return results
}

function buildFooterAdjacentDiagnosticOperations(
  values: Record<string, number | null>,
  footerCssSpacing: FooterCssSpacingDiagnosis[] = [],
) {
  const operations: Array<Pick<AiEditOperation, "type" | "target_id" | "path" | "value" | "breakpoint">> = []
  for (const footerSpacing of footerCssSpacing) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: footerSpacing.property === "margin-top" ? "footer-margin-top" : "footer-padding-top",
      value: 0,
      breakpoint: "all",
    })
  }
  if ((values.paddingBottom ?? 0) > 0) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: "padding-bottom",
      value: 0,
      breakpoint: "all",
    })
  }
  if ((values.marginBottom ?? 0) > 0) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: "margin-bottom",
      value: 0,
      breakpoint: "all",
    })
  }
  if ((values.gap ?? 0) > 0) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: "gap",
      value: 0,
      breakpoint: "all",
    })
  }
  if ((values.rowGap ?? 0) > 0) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: "row-gap",
      value: 0,
      breakpoint: "all",
    })
  }
  if ((values.height ?? 0) > 0) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: "height",
      value: 0,
      breakpoint: "all",
    })
  }
  if ((values.minHeight ?? 0) > 0) {
    operations.push({
      type: "set_style",
      target_id: "footer_adjacent_spacing",
      path: "min-height",
      value: 0,
      breakpoint: "all",
    })
  }
  if (operations.length === 0) {
    operations.push(
      {
        type: "set_style",
        target_id: "footer_adjacent_spacing",
        path: "padding-bottom",
        value: 0,
        breakpoint: "all",
      },
      {
        type: "set_style",
        target_id: "footer_adjacent_spacing",
        path: "margin-bottom",
        value: 0,
        breakpoint: "all",
      },
    )
  }
  return operations
}

export function diagnoseFooterAdjacentSpacing(input: {
  slug: string
  path: string
  message: string
  baseVersion: PatchEngineBaseVersion
  currentHtml?: string | null
  attachments?: PatchEngineAttachmentContext[]
}): FooterAdjacentSpacingDiagnosis {
  const blocks = extractBlocksFromLayoutJson(input.baseVersion.layout_json)
  const footerCssSpacing = extractFooterCssSpacing(input.baseVersion.style_json ?? {})
  const plan: AiEditPlan = {
    scope: "section",
    mode: "spacing_patch",
    target_ids: ["footer_adjacent_spacing"],
    risk_level: "low",
    requires_strict_confirmation: false,
    operations: [
      {
        type: "set_style",
        target_id: "footer_adjacent_spacing",
        path: "padding-bottom",
        value: 0,
        breakpoint: "all",
      },
    ],
  }
  const operation = plan.operations[0]
  const anchorTexts = extractAnchorTexts(operation, input.message)
  const firstAnchorText = anchorTexts[0] ?? null
  const htmlContainsAnchor = firstAnchorText
    ? normalizeText(String(input.currentHtml ?? "")).includes(normalizeText(firstAnchorText))
    : null
  const candidates = buildTargetCandidates(blocks)
    .filter((candidate) => candidate.block_type === "footer_adjacent_spacing")
    .map((candidate) => {
      const scored = scoreCandidate({
        candidate,
        requestedTarget: "footer_adjacent_spacing",
        plan,
        operation,
        message: input.message,
        attachments: input.attachments ?? [],
      })
      const values = extractLayoutSpacingValues(candidate.raw_block)
      const reasons: string[] = []
      const rejections: string[] = []
      const hasAnchorHit = anchorTexts.some((anchor) => normalizeText(candidate.text).includes(normalizeText(anchor)))
      const hasExplicitSpacingSource =
        (values.paddingBottom ?? 0) > 0 ||
        (values.marginBottom ?? 0) > 0 ||
        (values.gap ?? 0) > 0 ||
        (values.rowGap ?? 0) > 0 ||
        (values.height ?? 0) > 0 ||
        (values.minHeight ?? 0) > 0 ||
        footerCssSpacing.length > 0
      if (hasAnchorHit) reasons.push("texto informado pelo usuario encontrado neste bloco")
      if (hasAnchorHit && htmlContainsAnchor) reasons.push("texto informado tambem aparece no HTML atual")
      if (candidate.section_index === blocks.length - 1) reasons.push("ultimo bloco gerido antes do rodape")
      if ((values.paddingBottom ?? 0) > 0) reasons.push("padding-bottom detectado no bloco")
      if ((values.marginBottom ?? 0) > 0) reasons.push("margin-bottom detectado no bloco")
      if ((values.gap ?? 0) > 0 || (values.rowGap ?? 0) > 0) reasons.push("gap/row-gap detectado no bloco")
      if (isLikelyEmptySpacerBlock(candidate.raw_block) && ((values.height ?? 0) > 0 || (values.minHeight ?? 0) > 0)) {
        reasons.push("spacer vazio detectado antes do rodape")
      }
      for (const footerSpacing of footerCssSpacing) {
        reasons.push(`${footerSpacing.property} detectado em CSS do rodape (${footerSpacing.selector})`)
      }
      const confidence = hasExplicitSpacingSource || hasAnchorHit ? scored.confidence : Math.min(scored.confidence, 0.62)
      if (confidence < 0.8) rejections.push("confidence abaixo do limiar seguro")
      if (!hasExplicitSpacingSource) rejections.push("sem espacamento explicito detectado neste candidato")

      return {
        target_id: candidate.target_id,
        candidate_path: candidate.path_key,
        selector: candidate.selector,
        section_index: candidate.section_index,
        block_type: candidate.block_type,
        heading: candidate.heading,
        text_excerpt: candidate.text.slice(0, 180),
        confidence: Math.round(confidence * 1000) / 1000,
        reasons,
        rejections,
        spacing_values: values,
      } satisfies FooterAdjacentSpacingCandidateDiagnosis
    })
    .sort((left, right) => right.confidence - left.confidence)

  const best = candidates[0] ?? null
  const recommendedOperations = buildFooterAdjacentDiagnosticOperations(best?.spacing_values ?? {}, footerCssSpacing)

  return {
    branch_selected: "localized_visual_patch",
    target_id: "footer_adjacent_spacing",
    slug: input.slug,
    path: input.path,
    html_anchor_text: firstAnchorText,
    html_contains_anchor: htmlContainsAnchor,
    candidate_count: candidates.length,
    candidates,
    candidate_reasons: candidates.flatMap((candidate) => candidate.reasons),
    candidate_rejections: candidates.flatMap((candidate) => candidate.rejections),
    confidence_scores: candidates.map((candidate) => candidate.confidence),
    recommended_operations: recommendedOperations,
  }
}

function getBlockAtPath(blocks: Record<string, unknown>[], path: Array<string | number>) {
  let current: unknown = blocks
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return null
      current = current[segment]
      continue
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) return null
    current = (current as Record<string, unknown>)[segment]
  }

  return current && typeof current === "object" && !Array.isArray(current) ? (current as Record<string, unknown>) : null
}

function updateBlockAtPath(
  blocks: Record<string, unknown>[],
  path: Array<string | number>,
  updater: (block: Record<string, unknown>) => Record<string, unknown>,
) {
  const nextBlocks = cloneJsonValue(blocks)

  const update = (current: unknown, segments: Array<string | number>): unknown => {
    if (segments.length === 0) {
      if (!current || typeof current !== "object" || Array.isArray(current)) return current
      return updater(current as Record<string, unknown>)
    }

    const [head, ...tail] = segments
    if (typeof head === "number") {
      if (!Array.isArray(current) || !current[head]) return current
      current[head] = update(current[head], tail)
      return current
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) return current
    const record = current as Record<string, unknown>
    record[head] = update(record[head], tail)
    return record
  }

  update(nextBlocks, path)
  return nextBlocks
}

function replaceBlockAtPath(blocks: Record<string, unknown>[], path: Array<string | number>, replacement: Record<string, unknown>) {
  const nextBlocks = cloneJsonValue(blocks)
  const parentPath = path.slice(0, -1)
  const last = path[path.length - 1]
  let current: unknown = nextBlocks

  for (const segment of parentPath) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return nextBlocks
      current = current[segment]
      continue
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) return nextBlocks
    current = (current as Record<string, unknown>)[segment]
  }

  if (typeof last === "number" && Array.isArray(current)) {
    current[last] = cloneJsonValue(replacement)
  } else if (typeof last === "string" && current && typeof current === "object" && !Array.isArray(current)) {
    ;(current as Record<string, unknown>)[last] = cloneJsonValue(replacement)
  }

  return nextBlocks
}

function replaceTextOnce(source: string, from: string, to: string) {
  if (!from) return { value: source, changed: false }
  const index = source.indexOf(from)
  if (index < 0) return { value: source, changed: false }
  return {
    value: `${source.slice(0, index)}${to}${source.slice(index + from.length)}`,
    changed: true,
  }
}

function updateTextWithinBlock(block: Record<string, unknown>, replacement: { from: string; to: string }) {
  const type = normalizeString(block.type).toLowerCase()
  const nextBlock = cloneJsonValue(block)

  if (type === "heading" || type === "rich_text") {
    const updated = replaceTextOnce(normalizeString(block.content), replacement.from, replacement.to)
    if (!updated.changed) return null
    nextBlock.content = updated.value
    return nextBlock
  }

  if (type === "button") {
    const updated = replaceTextOnce(normalizeString(block.label), replacement.from, replacement.to)
    if (!updated.changed) return null
    nextBlock.label = updated.value
    return nextBlock
  }

  if (type === "columns" && Array.isArray(block.items)) {
    let changed = false
    nextBlock.items = block.items.map((item) => {
      const updated = replaceTextOnce(normalizeString(item), replacement.from, replacement.to)
      if (updated.changed) changed = true
      return updated.value
    })
    return changed ? nextBlock : null
  }

  if (type === "container" && Array.isArray(block.children)) {
    let changed = false
    nextBlock.children = block.children.map((column) => {
      if (!Array.isArray(column)) return column
      return column.map((child) => {
        if (!child || typeof child !== "object" || Array.isArray(child)) return child
        const updated = updateTextWithinBlock(child as Record<string, unknown>, replacement)
        if (updated) changed = true
        return updated ?? child
      })
    })
    return changed ? nextBlock : null
  }

  return null
}

function inferTextReplacement(operation: AiEditOperation, message: string) {
  if (operation.value && typeof operation.value === "object" && !Array.isArray(operation.value)) {
    const record = operation.value as Record<string, unknown>
    const from = normalizeString(record.from)
    const to = typeof record.to === "string" ? record.to : normalizeString(record.to)
    if (from) return { from, to }
  }

  const normalized = message.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  const patterns = [
    /(?:altera(?:r)?|troca(?:r)?|substitu[ií](?:r)?|muda(?:r)?)[^"']*"([^"]+)"\s+(?:para|por)\s+"([^"]+)"/i,
    /(?:altera(?:r)?|troca(?:r)?|substitu[ií](?:r)?|muda(?:r)?)[^"']*'([^']+)'\s+(?:para|por)\s+'([^']+)'/i,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue
    return { from: normalizeString(match[1]), to: String(match[2] ?? "") }
  }
  return null
}

function isValueSafe(value: string) {
  return !BLOCKED_STYLE_PATTERNS.some((pattern) => pattern.test(value))
}

function canonicalizeStyleProperty(path: unknown) {
  const raw = normalizeString(path)
    .replace(/^style\./i, "")
    .replace(/^layout\./i, "layout.")
    .replace(/^spacing\./i, "")
    .replace(/^responsive\./i, "")
    .replace(/^section\./i, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\./g, "-")
    .toLowerCase()

  const aliases: Record<string, string> = {
    "layout-padding-top": "padding-top",
    "layout-padding-bottom": "padding-bottom",
    "layout-padding-left": "padding-left",
    "layout-padding-right": "padding-right",
    "layout-margin-top": "margin-top",
    "layout-margin-bottom": "margin-bottom",
    "layout-margin-left": "margin-left",
    "layout-margin-right": "margin-right",
    "layout-min-height": "min-height",
    "layout-background-color": "background",
    "layout-border-radius": "border-radius",
    "layout-content-gap": "gap",
    "paddingtop": "padding-top",
    "padding-top": "padding-top",
    "paddingbottom": "padding-bottom",
    "padding-bottom": "padding-bottom",
    "paddingleft": "padding-left",
    "padding-left": "padding-left",
    "paddingright": "padding-right",
    "padding-right": "padding-right",
    "padding": "padding",
    "margin": "margin",
    "margintop": "margin-top",
    "margin-top": "margin-top",
    "marginbottom": "margin-bottom",
    "margin-bottom": "margin-bottom",
    "marginleft": "margin-left",
    "margin-left": "margin-left",
    "marginright": "margin-right",
    "margin-right": "margin-right",
    "gap": "gap",
    "row-gap": "row-gap",
    "min-height": "min-height",
    "height": "height",
    "width": "width",
    "max-width": "max-width",
    "min-width": "min-width",
    "background": "background",
    "background-color": "background",
    "color": "color",
    "border": "border",
    "border-color": "border-color",
    "border-width": "border-width",
    "border-radius": "border-radius",
    "box-shadow": "box-shadow",
    "opacity": "opacity",
    "text-align": "text-align",
    "align-items": "align-items",
    "justify-content": "justify-content",
    "display": "display",
    "flex-direction": "flex-direction",
    "grid-template-columns": "grid-template-columns",
    "columns": "columns",
  }

  return aliases[raw] ?? null
}

function buildStyleInstructionFromExplicitOperation(operation: AiEditOperation, mode: AiEditMode): SafeStyleInstruction[] | null {
  const property = canonicalizeStyleProperty(operation.path)
  if (!property) return null
  const normalizedMode = mode === "spacing_patch" ? "spacing" : "style"

  if (property === "padding") {
    const size = parseSizeToPixels(operation.value)
    if (size === null) return null
    return [
      {
        property,
        css_property: "padding",
        target: "wrapper",
        kind: "compound",
        json_paths: ["layout.paddingTop", "layout.paddingRight", "layout.paddingBottom", "layout.paddingLeft"],
        value: clamp(size, 0, 240),
        mode: normalizedMode,
      },
    ]
  }

  if (property === "margin") {
    const size = parseSizeToPixels(operation.value)
    if (size === null) return null
    return [
      {
        property,
        css_property: "margin",
        target: "wrapper",
        kind: "compound",
        json_paths: ["layout.marginTop", "layout.marginRight", "layout.marginBottom", "layout.marginLeft"],
        value: clamp(size, 0, 240),
        mode: normalizedMode,
      },
    ]
  }

  const instructionMap: Record<string, Omit<SafeStyleInstruction, "value" | "mode">> = {
    "padding-top": { property, css_property: "padding-top", target: "wrapper", kind: "json", json_paths: ["layout.paddingTop"] },
    "padding-bottom": { property, css_property: "padding-bottom", target: "wrapper", kind: "json", json_paths: ["layout.paddingBottom"] },
    "padding-left": { property, css_property: "padding-left", target: "wrapper", kind: "json", json_paths: ["layout.paddingLeft"] },
    "padding-right": { property, css_property: "padding-right", target: "wrapper", kind: "json", json_paths: ["layout.paddingRight"] },
    "margin-top": { property, css_property: "margin-top", target: "wrapper", kind: "json", json_paths: ["layout.marginTop"] },
    "margin-bottom": { property, css_property: "margin-bottom", target: "wrapper", kind: "json", json_paths: ["layout.marginBottom"] },
    "margin-left": { property, css_property: "margin-left", target: "wrapper", kind: "json", json_paths: ["layout.marginLeft"] },
    "margin-right": { property, css_property: "margin-right", target: "wrapper", kind: "json", json_paths: ["layout.marginRight"] },
    "gap": { property, css_property: "gap", target: "content", kind: "json", json_paths: ["gap", "layout.contentGap", "columnContentGap"] },
    "row-gap": { property, css_property: "row-gap", target: "content", kind: "json", json_paths: ["rowGap"] },
    "min-height": { property, css_property: "min-height", target: "wrapper", kind: "json", json_paths: ["layout.minHeight", "height"] },
    "height": { property, css_property: "height", target: "wrapper", kind: "css" },
    "width": { property, css_property: "width", target: "wrapper", kind: "css" },
    "max-width": { property, css_property: "max-width", target: "wrapper", kind: "css" },
    "min-width": { property, css_property: "min-width", target: "wrapper", kind: "css" },
    "background": { property, css_property: "background", target: "content", kind: "json", json_paths: ["layout.backgroundColor", "backgroundColor"] },
    "color": { property, css_property: "color", target: "content", kind: "json", json_paths: ["color", "textColor"] },
    "border": { property, css_property: "border", target: "content", kind: "json", json_paths: ["borderWidth", "borderColor"] },
    "border-color": { property, css_property: "border-color", target: "content", kind: "json", json_paths: ["borderColor"] },
    "border-width": { property, css_property: "border-width", target: "content", kind: "json", json_paths: ["borderWidth"] },
    "border-radius": { property, css_property: "border-radius", target: "content", kind: "json", json_paths: ["layout.borderRadius", "borderRadius", "radius"] },
    "box-shadow": { property, css_property: "box-shadow", target: "content", kind: "css" },
    "opacity": { property, css_property: "opacity", target: "wrapper", kind: "css" },
    "text-align": { property, css_property: "text-align", target: "content", kind: "json", json_paths: ["align", "textAlign"] },
    "align-items": { property, css_property: "align-items", target: "content", kind: "json", json_paths: ["alignItems"] },
    "justify-content": { property, css_property: "justify-content", target: "content", kind: "css" },
    "display": { property, css_property: "display", target: "content", kind: "css" },
    "flex-direction": { property, css_property: "flex-direction", target: "content", kind: "css" },
    "grid-template-columns": { property, css_property: "grid-template-columns", target: "content", kind: "json", json_paths: ["columns"] },
    "columns": { property, css_property: "grid-template-columns", target: "content", kind: "json", json_paths: ["columns"] },
  }

  const template = instructionMap[property]
  if (!template) return null
  return [{ ...template, value: operation.value, mode: normalizedMode }]
}

function buildStyleInstructionFromMessage(message: string, mode: AiEditMode): SafeStyleInstruction[] | null {
  const normalized = normalizeText(message)
  const normalizedMode = mode === "spacing_patch" ? "spacing" : "style"

  if (/(remover|tirar|zerar).*(padding-top|espaco acima|espaçamento acima|padding superior)/i.test(message)) {
    return [
      {
        property: "padding-top",
        css_property: "padding-top",
        target: "wrapper",
        kind: "json",
        json_paths: ["layout.paddingTop"],
        value: 0,
        mode: normalizedMode,
      },
    ]
  }

  if (/(reduzir|diminuir).*\bgap\b/i.test(message)) {
    const explicitValue = normalizeString(message).match(/(\d+)\s*px/i)
    if (explicitValue) {
      return [
        {
          property: "gap",
          css_property: "gap",
          target: "content",
          kind: "json",
          json_paths: ["gap", "layout.contentGap", "columnContentGap"],
          value: clamp(Number(explicitValue[1]), 0, 120),
          mode: normalizedMode,
        },
      ]
    }
  }

  if (normalized.includes("mobile") && /(padding|margin|gap|altura|height|width)/i.test(message)) {
    const explicitValue = normalizeString(message).match(/(\d+)\s*px/i)
    if (explicitValue) {
      return [
        {
          property: normalized.includes("gap") ? "gap" : normalized.includes("padding") ? "padding-top" : "min-height",
          css_property: normalized.includes("gap") ? "gap" : normalized.includes("padding") ? "padding-top" : "min-height",
          target: normalized.includes("gap") ? "content" : "wrapper",
          kind: "css",
          value: `${explicitValue[1]}px`,
          mode: normalizedMode,
        },
      ]
    }
  }

  return null
}

function compareAllowedDiffs(
  currentBlock: Record<string, unknown>,
  proposedBlock: Record<string, unknown>,
  mode: AiEditMode,
) {
  const diffs: SafeStyleInstruction[] = []
  const compareRoot = (property: string, currentValue: unknown, proposedValue: unknown, modeKey: "style" | "spacing", options?: Omit<SafeStyleInstruction, "property" | "value" | "mode">) => {
    if (JSON.stringify(currentValue) === JSON.stringify(proposedValue)) return
    diffs.push({
      property,
      css_property: options?.css_property ?? property,
      target: options?.target ?? "content",
      kind: options?.kind ?? "json",
      json_paths: options?.json_paths,
      value: proposedValue,
      mode: modeKey,
    })
  }

  const normalizedMode = mode === "spacing_patch" ? "spacing" : "style"
  const currentLayout =
    currentBlock.layout && typeof currentBlock.layout === "object" && !Array.isArray(currentBlock.layout)
      ? (currentBlock.layout as Record<string, unknown>)
      : {}
  const proposedLayout =
    proposedBlock.layout && typeof proposedBlock.layout === "object" && !Array.isArray(proposedBlock.layout)
      ? (proposedBlock.layout as Record<string, unknown>)
      : {}

  compareRoot("padding-top", currentLayout.paddingTop, proposedLayout.paddingTop, "spacing", {
    css_property: "padding-top",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.paddingTop"],
  })
  compareRoot("padding-bottom", currentLayout.paddingBottom, proposedLayout.paddingBottom, "spacing", {
    css_property: "padding-bottom",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.paddingBottom"],
  })
  compareRoot("padding-left", currentLayout.paddingLeft, proposedLayout.paddingLeft, "spacing", {
    css_property: "padding-left",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.paddingLeft"],
  })
  compareRoot("padding-right", currentLayout.paddingRight, proposedLayout.paddingRight, "spacing", {
    css_property: "padding-right",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.paddingRight"],
  })
  compareRoot("margin-top", currentLayout.marginTop, proposedLayout.marginTop, "spacing", {
    css_property: "margin-top",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.marginTop"],
  })
  compareRoot("margin-bottom", currentLayout.marginBottom, proposedLayout.marginBottom, "spacing", {
    css_property: "margin-bottom",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.marginBottom"],
  })
  compareRoot("min-height", currentLayout.minHeight, proposedLayout.minHeight, "spacing", {
    css_property: "min-height",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.minHeight"],
  })
  compareRoot("background", currentLayout.backgroundColor, proposedLayout.backgroundColor, normalizedMode, {
    css_property: "background",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.backgroundColor"],
  })
  compareRoot("border-radius", currentLayout.borderRadius, proposedLayout.borderRadius, normalizedMode, {
    css_property: "border-radius",
    target: "wrapper",
    kind: "json",
    json_paths: ["layout.borderRadius"],
  })

  const rootProperties = [
    "gap",
    "rowGap",
    "alignItems",
    "justifyItems",
    "columnContentGap",
    "backgroundColor",
    "borderColor",
    "borderWidth",
    "borderRadius",
    "paddingY",
    "paddingX",
    "align",
    "textAlign",
    "color",
    "textColor",
    "columns",
  ]

  for (const property of rootProperties) {
    if (JSON.stringify(currentBlock[property]) === JSON.stringify(proposedBlock[property])) continue
    const canonical =
      property === "rowGap"
        ? "row-gap"
        : property === "backgroundColor"
          ? "background"
          : property === "borderColor"
            ? "border-color"
            : property === "borderWidth"
              ? "border-width"
              : property === "borderRadius"
                ? "border-radius"
                : property === "textColor"
                  ? "color"
                  : property === "columns"
                    ? "columns"
                    : property === "paddingY" || property === "paddingX"
                      ? "padding"
                      : property === "align"
                        ? "text-align"
                        : property === "textAlign"
                          ? "text-align"
                          : property
    diffs.push({
      property: canonical,
      css_property:
        canonical === "columns"
          ? "grid-template-columns"
          : canonical,
      target: ["gap", "row-gap", "align-items", "justify-items", "columns"].includes(canonical) ? "content" : "content",
      kind: "json",
      json_paths: [property],
      value: proposedBlock[property],
      mode: canonical === "columns" || canonical.includes("gap") || canonical.includes("padding") ? "spacing" : normalizedMode,
    })
  }

  return diffs.filter((diff) => (mode === "spacing_patch" ? diff.mode === "spacing" : true))
}

function coerceReplacementBlock(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return cloneJsonValue(value as Record<string, unknown>)
  }
  return null
}

function isStructuredInstructionValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) && "instruction" in (value as Record<string, unknown>)
}

function resolveTemplateCandidate(
  currentResolution: ResolvedTargetCandidate,
  proposalBlocks: Record<string, unknown>[],
  plan: AiEditPlan,
  operation: AiEditOperation,
  message: string,
  attachments: PatchEngineAttachmentContext[],
) {
  const samePath = getBlockAtPath(proposalBlocks, currentResolution.candidate.path)
  if (samePath) {
    return {
      candidate: {
        ...currentResolution.candidate,
        raw_block: samePath,
      },
      confidence: 1,
      signals: buildSignalMap(),
    } satisfies ResolvedTargetCandidate
  }

  return resolveTargetCandidate({
    blocks: proposalBlocks,
    plan,
    operation,
    message,
    attachments,
  })
}

function validateCssValue(property: string, value: unknown) {
  const normalized = normalizeString(value)
  if (!normalized || !isValueSafe(normalized)) {
    throw new Error(`Valor inseguro bloqueado para ${property}.`)
  }

  if (property === "display" && !SAFE_DISPLAY_VALUES.has(normalized)) {
    throw new Error(`display=${normalized} não é permitido neste patch seguro.`)
  }

  if (property === "flex-direction" && !SAFE_FLEX_DIRECTIONS.has(normalized)) {
    throw new Error(`flex-direction=${normalized} não é permitido.`)
  }

  if (property === "text-align" && !SAFE_TEXT_ALIGN_VALUES.has(normalized)) {
    throw new Error(`text-align=${normalized} não é permitido.`)
  }

  if (property === "align-items" || property === "justify-content") {
    if (!SAFE_ALIGN_VALUES.has(normalized)) {
      throw new Error(`${property}=${normalized} não é permitido.`)
    }
  }

  if (property === "background" && !SAFE_BACKGROUND_VALUES.test(normalized)) {
    throw new Error("background fora da allowlist segura.")
  }

  if ((property === "color" || property === "border-color") && !SAFE_COLOR_VALUES.test(normalized)) {
    throw new Error(`${property} fora da allowlist segura.`)
  }

  if (property === "border" && !SAFE_BORDER_VALUES.test(normalized)) {
    throw new Error("border fora da allowlist segura.")
  }

  if (property === "box-shadow" && !SAFE_BOX_SHADOW_VALUES.test(normalized)) {
    throw new Error("box-shadow fora da allowlist segura.")
  }

  if (property === "grid-template-columns" && !SAFE_GRID_TEMPLATE_VALUES.test(normalized)) {
    throw new Error("grid-template-columns fora da allowlist segura.")
  }

  return normalized
}

function buildCssRule(selector: string, property: string, value: unknown, breakpoint: AiEditOperation["breakpoint"]) {
  const normalizedValue = typeof value === "number" ? `${value}px` : validateCssValue(property, value)
  const declaration = `${property}: ${normalizedValue} !important;`
  const rule = `${selector} {\n  ${declaration}\n}`

  if (breakpoint === "mobile") {
    return `@media (max-width: 767px) {\n${indentCss(rule)}\n}`
  }

  if (breakpoint === "tablet") {
    return `@media (min-width: 768px) and (max-width: 1023px) {\n${indentCss(rule)}\n}`
  }

  if (breakpoint === "desktop") {
    return `@media (min-width: 1024px) {\n${indentCss(rule)}\n}`
  }

  return rule
}

function wrapCssForBreakpoint(rule: string, breakpoint: AiEditOperation["breakpoint"]) {
  if (breakpoint === "mobile") {
    return `@media (max-width: 767px) {\n${indentCss(rule)}\n}`
  }

  if (breakpoint === "tablet") {
    return `@media (min-width: 768px) and (max-width: 1023px) {\n${indentCss(rule)}\n}`
  }

  if (breakpoint === "desktop") {
    return `@media (min-width: 1024px) {\n${indentCss(rule)}\n}`
  }

  return rule
}

function buildLocalizedDividerRemovalCssPatch(
  resolution: ResolvedTargetCandidate,
  breakpoint: AiEditOperation["breakpoint"],
) {
  const scopeSelector = resolution.candidate.content_selector || resolution.candidate.wrapper_selector
  const dividerSelectors = [
    `${scopeSelector} h1 + hr`,
    `${scopeSelector} h2 + hr`,
    `${scopeSelector} h3 + hr`,
    `${scopeSelector} h4 + hr`,
    `${scopeSelector} .divider`,
    `${scopeSelector} .separator`,
    `${scopeSelector} .line`,
    `${scopeSelector} [class*="divider"]`,
    `${scopeSelector} [class*="separator"]`,
    `${scopeSelector} [class*="line"]`,
    `${scopeSelector} [data-me-divider]`,
    `${scopeSelector} hr`,
  ].join(",\n")
  const headingSelectors = [
    `${scopeSelector} h1`,
    `${scopeSelector} h2`,
    `${scopeSelector} h3`,
    `${scopeSelector} h4`,
    `${scopeSelector} h5`,
    `${scopeSelector} h6`,
  ].join(",\n")
  const rule = [
    `${dividerSelectors} {`,
    "  display: none !important;",
    "  border: 0px solid transparent !important;",
    "  box-shadow: none !important;",
    "  background: transparent !important;",
    "  height: 0px !important;",
    "}",
    "",
    `${headingSelectors} {`,
    "  border-bottom: 0px solid transparent !important;",
    "  box-shadow: none !important;",
    "}",
  ].join("\n")

  return wrapCssForBreakpoint(rule, breakpoint)
}

function buildLocalizedCssPatch(input: {
  operation: AiEditOperation
  resolution: ResolvedTargetCandidate
}) {
  const requestedTarget = normalizeIdentifier(input.operation.target_id).toLowerCase()
  const path = normalizeString(input.operation.path).toLowerCase()
  if (
    requestedTarget === "footer_adjacent_spacing" &&
    (path === "footer-margin-top" || path === "footer-padding-top")
  ) {
    const property = path === "footer-margin-top" ? "margin-top" : "padding-top"
    const rule = [
      ".me-site-footer,",
      "footer {",
      `  ${property}: 0px !important;`,
      "}",
    ].join("\n")
    return wrapCssForBreakpoint(rule, input.operation.breakpoint)
  }

  if (
    input.operation.type === "remove_style" &&
    (path === "localized-divider" || requestedTarget.includes("localized_divider"))
  ) {
    return buildLocalizedDividerRemovalCssPatch(input.resolution, input.operation.breakpoint)
  }

  return null
}

function indentCss(rule: string) {
  return rule
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")
}

function setValueAtJsonPath(block: Record<string, unknown>, jsonPath: string, value: unknown) {
  const nextBlock = cloneJsonValue(block)
  const segments = jsonPath.split(".")
  let current: Record<string, unknown> = nextBlock

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const next = current[segment]
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  current[segments[segments.length - 1]] = value
  return nextBlock
}

function applyJsonStyleInstructionToBlock(block: Record<string, unknown>, instruction: SafeStyleInstruction) {
  const nextInstructions = instruction.json_paths ?? []
  if (nextInstructions.length === 0) {
    return cloneJsonValue(block)
  }

  if (instruction.property === "border") {
    const normalized = validateCssValue("border", instruction.value)
    const borderMatch = normalized.match(/^([0-9.]+)px\s+(solid|dashed|dotted)\s+(.+)$/i)
    if (!borderMatch) {
      throw new Error("border fora do formato seguro.")
    }
    let nextBlock = cloneJsonValue(block)
    nextBlock = setValueAtJsonPath(nextBlock, "borderWidth", Number(borderMatch[1]))
    nextBlock = setValueAtJsonPath(nextBlock, "borderColor", borderMatch[3])
    return nextBlock
  }

  if (instruction.property === "columns") {
    const numericColumns = clamp(Number(instruction.value ?? 0), 1, 4)
    const blockType = normalizeString(block.type).toLowerCase()
    if (blockType === "columns") {
      const safeColumns = clamp(numericColumns, 2, 4)
      let nextBlock = setValueAtJsonPath(block, "columns", safeColumns)
      const items = Array.isArray(nextBlock.items) ? nextBlock.items.map((item) => normalizeString(item)) : []
      while (items.length < safeColumns) items.push("<p>Coluna vazia.</p>")
      if (items.length > safeColumns) {
        const overflow = items.slice(safeColumns - 1).join(" ")
        nextBlock.items = [...items.slice(0, safeColumns - 1), overflow]
      } else {
        nextBlock.items = items
      }
      return nextBlock
    }

    if (blockType === "container") {
      let nextBlock = setValueAtJsonPath(block, "columns", numericColumns)
      const children = Array.isArray(nextBlock.children) ? nextBlock.children.map((item) => (Array.isArray(item) ? item : [])) : []
      while (children.length < numericColumns) children.push([])
      if (children.length > numericColumns) {
        const merged = children.slice(0, numericColumns)
        const overflow = children.slice(numericColumns)
        merged[merged.length - 1] = [...(merged[merged.length - 1] ?? []), ...overflow.flat()]
        nextBlock.children = merged
      } else {
        nextBlock.children = children
      }
      return nextBlock
    }
  }

  let nextBlock = cloneJsonValue(block)
  for (const jsonPath of nextInstructions) {
    if (instruction.property.includes("padding") || instruction.property.includes("margin") || instruction.property === "gap" || instruction.property === "row-gap" || instruction.property === "min-height" || instruction.property === "border-width" || instruction.property === "border-radius" || instruction.property === "height") {
      const numericValue = parseSizeToPixels(instruction.value)
      if (numericValue === null) {
        throw new Error(`Valor inválido para ${instruction.property}.`)
      }
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, clamp(numericValue, 0, 1200))
      continue
    }

    if (instruction.property === "opacity") {
      const numericValue = Number(instruction.value)
      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1) {
        throw new Error("opacity fora do intervalo seguro.")
      }
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, numericValue)
      continue
    }

    if (instruction.property === "background") {
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, validateCssValue("background", instruction.value))
      continue
    }

    if (instruction.property === "color") {
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, validateCssValue("color", instruction.value))
      continue
    }

    if (instruction.property === "border-color") {
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, validateCssValue("border-color", instruction.value))
      continue
    }

    if (instruction.property === "text-align") {
      const normalized = normalizeString(instruction.value).toLowerCase()
      if (!SAFE_TEXT_ALIGN_VALUES.has(normalized)) {
        throw new Error("text-align fora da allowlist.")
      }
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, normalized)
      continue
    }

    if (instruction.property === "align-items") {
      const normalized = normalizeString(instruction.value).toLowerCase()
      if (!SAFE_ALIGN_VALUES.has(normalized)) {
        throw new Error("align-items fora da allowlist.")
      }
      nextBlock = setValueAtJsonPath(nextBlock, jsonPath, normalized)
      continue
    }

    nextBlock = setValueAtJsonPath(nextBlock, jsonPath, instruction.value)
  }

  return nextBlock
}

function deriveStyleInstructions(input: {
  operation: AiEditOperation
  mode: AiEditMode
  message: string
  currentBlock: Record<string, unknown>
  templateBlock: Record<string, unknown> | null
}) {
  const explicit = buildStyleInstructionFromExplicitOperation(input.operation, input.mode)
  if (explicit && explicit.length > 0) return explicit

  const messageDerived = buildStyleInstructionFromMessage(input.message, input.mode)
  if (messageDerived && messageDerived.length > 0) return messageDerived

  if (input.templateBlock) {
    const inferred = compareAllowedDiffs(input.currentBlock, input.templateBlock, input.mode)
    if (inferred.length > 0) return inferred
  }

  throw new Error("Não consegui derivar uma operação de estilo segura e determinística para o alvo pedido.")
}

function applyReplaceSection(
  blocks: Record<string, unknown>[],
  resolution: ResolvedTargetCandidate,
  replacement: Record<string, unknown>,
) {
  if (resolution.candidate.section_index < 0) {
    throw new Error("A substituição de seção exige um alvo de seção real.")
  }

  return replaceBlockAtPath(blocks, resolution.candidate.path, replacement)
}

function collectCriticalLinks(blocks: Record<string, unknown>[]) {
  const allLinks = uniqueStrings(blocks.flatMap((block) => collectBlockLinks(block)))
  return allLinks.filter((link) => {
    const normalized = link.toLowerCase()
    return normalized.startsWith("/") || CRITICAL_ROUTE_HINTS.some((hint) => normalized.includes(hint))
  })
}

function collectCriticalCtas(blocks: Record<string, unknown>[]) {
  const ctas: string[] = []

  for (const block of blocks) {
    const blockType = normalizeString(block.type).toLowerCase()
    if (blockType === "button") {
      const label = normalizeText(normalizeString(block.label))
      const href = normalizeString(block.href)
      if (CTA_LABEL_HINTS.some((hint) => label.includes(hint)) || href.startsWith("/")) {
        ctas.push(`${label}|${href}`)
      }
    }

    if (blockType === "container" && Array.isArray(block.children)) {
      for (const column of block.children) {
        if (!Array.isArray(column)) continue
        ctas.push(...collectCriticalCtas(column.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown>[]))
      }
    }
  }

  return uniqueStrings(ctas)
}

function validateTemplateNotTruncated(baseBlocks: Record<string, unknown>[], templateBlocks: Record<string, unknown>[]) {
  if (templateBlocks.length < baseBlocks.length) {
    throw new Error("A proposta da IA parece truncada e removeu seções da página. O patch seguro recusou aplicar essa versão.")
  }
}

function validateFinalInvariants(input: {
  beforeBlocks: Record<string, unknown>[]
  afterBlocks: Record<string, unknown>[]
  plan: AiEditPlan
  touchedSectionIndexes: number[]
  resolutions: ResolvedTargetCandidate[]
  warnings: string[]
  styleJson: Record<string, unknown>
}) {
  if (input.plan.scope === "header" || input.plan.scope === "footer") {
    throw new Error("Header e footer globais não podem ser alterados por este patch engine persistível.")
  }

  if (input.beforeBlocks.length !== input.afterBlocks.length) {
    throw new Error("A operação tentou truncar a página ou alterar a quantidade global de seções.")
  }

  const touched = new Set(input.touchedSectionIndexes)
  for (let index = 0; index < input.beforeBlocks.length; index += 1) {
    if (touched.has(index)) continue
    if (JSON.stringify(input.beforeBlocks[index]) !== JSON.stringify(input.afterBlocks[index])) {
      throw new Error("Uma seção fora do alvo foi alterada. O patch seguro recusou a proposta.")
    }
  }

  const beforeLinks = collectCriticalLinks(input.beforeBlocks)
  const afterLinks = collectCriticalLinks(input.afterBlocks)
  for (const link of beforeLinks) {
    if (!afterLinks.includes(link)) {
      throw new Error(`Um link crítico foi removido ou alterado (${link}).`)
    }
  }

  const beforeCtas = collectCriticalCtas(input.beforeBlocks)
  const afterCtas = collectCriticalCtas(input.afterBlocks)
  for (const cta of beforeCtas) {
    if (!afterCtas.includes(cta)) {
      const isInsideTouchedSection = input.resolutions.some((resolution) => {
        const block = input.beforeBlocks[resolution.candidate.section_index]
        return block && collectCriticalCtas([block]).includes(cta)
      })

      if (isInsideTouchedSection) {
        input.warnings.push("A proposta altera um CTA crítico dentro da seção alvo. Revise com atenção antes de publicar.")
      } else {
        throw new Error("Um CTA crítico fora da seção alvo foi alterado.")
      }
    }
  }

  const finalCss = typeof input.styleJson.css === "string" ? input.styleJson.css : ""
  if (finalCss && BLOCKED_STYLE_PATTERNS.some((pattern) => pattern.test(finalCss))) {
    throw new Error("O CSS final ficou fora da allowlist segura.")
  }

  if (input.plan.mode === "text_patch") {
    const afterStyleCss = normalizeString(finalCss)
    if (afterStyleCss) {
      throw new Error("text_patch não pode introduzir CSS adicional nesta fase.")
    }
  }
}

export function applyPatchPlan(input: PatchEngineInput): PatchEngineResult {
  if (input.editPlan.scope === "header" || input.editPlan.scope === "footer") {
    throw new Error("Header/footer globais devem continuar no fluxo dedicado. O patch engine de páginas recusou este pedido.")
  }

  const baseBlocks = extractBlocksFromLayoutJson(input.baseVersion.layout_json)
  if (baseBlocks.length === 0) {
    throw new Error("A base_version atual da página não contém blocos geridos suficientes para aplicar o patch.")
  }

  const proposalBlocks = input.proposalLayoutJson ? extractBlocksFromLayoutJson(input.proposalLayoutJson) : []
  if (proposalBlocks.length > 0) {
    validateTemplateNotTruncated(baseBlocks, proposalBlocks)
  }

  let nextBlocks = cloneJsonValue(baseBlocks)
  let nextStyleJson = cloneJsonValue(input.baseVersion.style_json ?? {})
  const warnings: string[] = []
  const resolutions: PatchEngineTargetResolution[] = []
  const resolvedCandidates: ResolvedTargetCandidate[] = []
  const touchedSectionIndexes: number[] = []

  for (const operation of input.editPlan.operations) {
    const resolution = resolveTargetCandidate({
      blocks: nextBlocks,
      plan: input.editPlan,
      operation,
      message: input.message,
      attachments: input.attachments ?? [],
    })
    resolvedCandidates.push(resolution)
    touchedSectionIndexes.push(resolution.candidate.section_index)

    const currentBlock = resolution.candidate.raw_block ?? getBlockAtPath(nextBlocks, resolution.candidate.path)
    if (!currentBlock && resolution.candidate.patch_strategy !== "css_only") {
      throw new Error(`O alvo resolvido para "${operation.target_id}" deixou de existir durante a aplicação do patch.`)
    }

    const templateResolution =
      proposalBlocks.length > 0
        ? resolveTemplateCandidate(
            resolution,
            proposalBlocks,
            input.editPlan,
            operation,
            input.message,
            input.attachments ?? [],
          )
        : null
    const templateBlock = templateResolution?.candidate.raw_block ?? null

    if (input.editPlan.mode === "text_patch" || operation.type === "update_text") {
      const replacement = inferTextReplacement(operation, input.message)
      if (!replacement) {
        throw new Error("text_patch exige um texto de origem/alvo claro para aplicar a mudança com segurança.")
      }
      const updatedBlock = updateTextWithinBlock(currentBlock, replacement)
      if (!updatedBlock) {
        throw new Error(`Não encontrei o texto alvo dentro da base_version atual para "${replacement.from}".`)
      }
      nextBlocks = updateBlockAtPath(nextBlocks, resolution.candidate.path, () => updatedBlock)
      continue
    }

    if (operation.type === "replace_section" || input.editPlan.mode === "section_replace") {
      if (resolution.candidate.section_index < 0) {
        throw new Error("section_replace exige um alvo de seção persistível.")
      }

      const replacement =
        coerceReplacementBlock(operation.value) ??
        coerceReplacementBlock(
          templateBlock &&
            (templateResolution?.candidate.section_index ?? -1) >= 0 &&
            getBlockAtPath(proposalBlocks, [templateResolution!.candidate.section_index]),
        )
      if (!replacement) {
        throw new Error("Não encontrei conteúdo seguro para substituir a seção alvo.")
      }
      nextBlocks = applyReplaceSection(nextBlocks, resolution, replacement)
      warnings.push("A seção alvo foi substituída mantendo a posição original na página.")
      continue
    }

    if (operation.type === "change_columns") {
      const columnsValue =
        operation.value && typeof operation.value === "object" && !Array.isArray(operation.value)
          ? (operation.value as Record<string, unknown>).columns
          : operation.value
      const updatedBlock = applyJsonStyleInstructionToBlock(currentBlock, {
        property: "columns",
        css_property: "grid-template-columns",
        target: "content",
        kind: "json",
        json_paths: ["columns"],
        value: columnsValue,
        mode: "spacing",
      })
      nextBlocks = updateBlockAtPath(nextBlocks, resolution.candidate.path, () => updatedBlock)
      continue
    }

    if (operation.type === "move_node" || operation.type === "wrap_children" || operation.type === "unwrap_children") {
      if (!templateBlock) {
        throw new Error(`${operation.type} exige contexto estrutural adicional do template da IA nesta fase.`)
      }
      nextBlocks = updateBlockAtPath(nextBlocks, resolution.candidate.path, () => cloneJsonValue(templateBlock))
      warnings.push("A seção alvo foi reorganizada usando apenas o template da seção correspondente, sem tocar nas demais.")
      continue
    }

    const localizedCssPatch = buildLocalizedCssPatch({ operation, resolution })
    if (localizedCssPatch) {
      nextStyleJson = appendCssPatchToStyleJson(nextStyleJson, localizedCssPatch)
      warnings.push("Ajuste visual localizado aplicado sem alterar a estrutura da pagina.")
      continue
    }

    const instructions = deriveStyleInstructions({
      operation,
      mode: input.editPlan.mode,
      message: input.message,
      currentBlock: currentBlock ?? {},
      templateBlock,
    })

    for (const instruction of instructions) {
      if (input.editPlan.mode === "spacing_patch" && instruction.mode !== "spacing") {
        throw new Error(`spacing_patch só aceita propriedades de spacing/layout controlado. Recebi ${instruction.property}.`)
      }

      if (input.editPlan.mode === "style_patch" && instruction.mode === "spacing" && !["gap", "row-gap", "min-height"].includes(instruction.property)) {
        // style_patch pode conviver com alguns ajustes leves; o resto fica no caminho natural de spacing_patch.
      }

      const shouldEmitCss =
        operation.breakpoint !== "all" || instruction.kind === "css" || resolution.candidate.patch_strategy === "css_only"
      if (shouldEmitCss) {
        const selector = instruction.target === "wrapper" ? resolution.candidate.wrapper_selector : resolution.candidate.content_selector
        nextStyleJson = appendCssPatchToStyleJson(
          nextStyleJson,
          buildCssRule(selector, instruction.css_property, instruction.value, operation.breakpoint),
        )
        continue
      }

      if (!currentBlock) {
        throw new Error(`O alvo "${operation.target_id}" só aceita patch CSS seguro nesta fase.`)
      }

      const updatedBlock = applyJsonStyleInstructionToBlock(currentBlock, instruction)
      nextBlocks = updateBlockAtPath(nextBlocks, resolution.candidate.path, () => updatedBlock)
    }
  }

  const finalLayoutJson = withBlocksAppliedToLayoutJson(input.baseVersion.layout_json, nextBlocks)

  validateFinalInvariants({
    beforeBlocks: baseBlocks,
    afterBlocks: nextBlocks,
    plan: input.editPlan,
    touchedSectionIndexes,
    resolutions: resolvedCandidates,
    warnings,
    styleJson: nextStyleJson,
  })

  resolvedCandidates.forEach((resolution, index) => {
    resolutions.push({
      requested_target_id: normalizeIdentifier(input.editPlan.operations[index]?.target_id) || "target",
      resolved_target_id: resolution.candidate.target_id,
      candidate_path: resolution.candidate.path_key,
      confidence: Math.round(resolution.confidence * 1000) / 1000,
      section_index: resolution.candidate.section_index,
      block_type: resolution.candidate.block_type,
      selector: resolution.candidate.selector,
      signals: resolution.signals,
    })
  })

  return {
    layoutJson: finalLayoutJson,
    styleJson: nextStyleJson,
    warnings,
    resolutions,
    invariants: {
      patch_engine_version: "phase5_wrapper_spacing_v1",
      base_version_id: input.baseVersion.id,
      base_version_number: input.baseVersion.version_number,
      base_version_status: input.baseVersion.status,
      scoped_patch: true,
      touched_section_indexes: uniqueStrings(touchedSectionIndexes.map((item) => String(item))),
      resolution_count: resolutions.length,
      preview_renderable: true,
      desktop_renderable: true,
      mobile_renderable: true,
      preserved_global_section_order: input.editPlan.mode !== "section_replace",
    },
  }
}
