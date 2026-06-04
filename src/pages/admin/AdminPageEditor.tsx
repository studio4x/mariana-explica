import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DragEvent, FocusEvent } from "react"
import type { CSSProperties } from "react"
import { createPortal } from "react-dom"
import { Link, useBlocker, useSearchParams } from "react-router-dom"
import {
  Blocks,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileClock,
  GripVertical,
  History,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Send,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { ErrorState, LoadingState } from "@/components/feedback"
import { RichTextEditor, type RichTextEditorHandle } from "@/components/common/RichTextEditor"
import { Button } from "@/components/ui"
import { BUILD_VERSION } from "@/lib/build"
import {
  useAdminSitePageDetail,
  useAdminSitePages,
  usePublishAdminSitePageVersion,
  useRollbackAdminSitePageVersion,
  useSaveAdminSitePageDraft,
  useUnpublishAdminSitePage,
  useUploadAdminSitePageAssetFile,
} from "@/hooks/useAdmin"
import { ROUTES } from "@/lib/constants"
import { createSitePagePreviewUrl, storeSitePagePreview } from "@/lib/site-page-preview"
import {
  createDefaultBlock,
  getDefaultDocumentForSlug,
  getDefaultStyleCss,
  getBlockLayoutDefaults,
  normalizeLayoutStyle,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
  type BlockLayoutStyle,
  type PageBlock,
  type PageBlockType,
  type SitePageBuilderDocument,
} from "@/lib/site-page-builder"
import type { AdminSitePageAsset, AdminSitePageVersion, SitePageSlug } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

const PAGE_OPTIONS: Array<{ slug: SitePageSlug; label: string; publicPath: string }> = [
  { slug: "home", label: "Home", publicPath: "/" },
  { slug: "sobre", label: "Sobre", publicPath: "/sobre" },
  { slug: "privacidade", label: "Privacidade", publicPath: "/privacidade" },
  { slug: "cookies", label: "Cookies", publicPath: "/cookies" },
  { slug: "termos", label: "Termos de uso", publicPath: "/termos-de-uso" },
]

const BLOCK_LIBRARY: Array<{ type: PageBlockType; label: string }> = [
  { type: "heading", label: "Título" },
  { type: "rich_text", label: "Texto" },
  { type: "image", label: "Imagem" },
  { type: "button", label: "Botão" },
  { type: "container", label: "Container" },
  { type: "columns", label: "Colunas" },
  { type: "divider", label: "Divisor" },
  { type: "spacer", label: "Espaço" },
]

type DragPayload =
  | { kind: "library"; blockType: PageBlockType }
  | { kind: "block"; blockId: string }
  | { kind: "rich_node"; blockId: string; richNodeIndex: number }

type PendingRichInsertPoint = {
  blockId: string
  insertIndex: number
  insertAfterNodeIndex?: number
}

type StructureNodeKind = "section" | "container" | "column" | "block" | "rich_node"

type EditorStructureNode = {
  id: string
  kind: StructureNodeKind
  label: string
  blockId?: string
  containerId?: string
  columnIndex?: number
  richNodeIndex?: number
  children: EditorStructureNode[]
}

function getPublicPathForSlug(slug: SitePageSlug | string) {
  return PAGE_OPTIONS.find((item) => item.slug === slug)?.publicPath ?? "/"
}

function getTitleForSlug(slug: SitePageSlug | string) {
  return PAGE_OPTIONS.find((item) => item.slug === slug)?.label ?? String(slug)
}

function isValidSitePageSlug(value: string | null): value is SitePageSlug {
  if (!value) return false
  return PAGE_OPTIONS.some((item) => item.slug === value)
}

function resolveSlugFromSearchParams(searchParams: URLSearchParams): SitePageSlug | null {
  const raw = searchParams.get("slug")?.trim().toLowerCase() ?? null
  if (!raw) return null
  return isValidSitePageSlug(raw) ? raw : null
}

function resolveInitialVersion(versions: AdminSitePageVersion[], publishedId: string | null, preferredVersionId?: string | null) {
  if (preferredVersionId) {
    const preferredVersion = versions.find((item) => item.id === preferredVersionId)
    if (preferredVersion) return preferredVersion
  }
  if (publishedId) {
    const publishedVersion = versions.find((item) => item.id === publishedId)
    if (publishedVersion) return publishedVersion
  }
  const latestDraft = versions.find((item) => item.status === "draft")
  if (latestDraft) return latestDraft
  return versions[0] ?? null
}

function extractDocumentFromVersion(slug: SitePageSlug, version: AdminSitePageVersion | null): SitePageBuilderDocument {
  return resolveBuilderDocumentFromLayoutJson(slug, version?.layout_json)
}

const EDITABLE_RICH_TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "a",
  "li",
  "blockquote",
  "img",
  ".me-home-eyebrow",
  ".me-home-chip-title",
  ".me-home-pill",
].join(",")

function getEditableRichNodesFromHtml(html: string) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return []
  const parser = new DOMParser()
  const parsed = parser.parseFromString(html, "text/html")
  return Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
}

function isRichTextNodeTextEditable(tagName: string) {
  return ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "li", "blockquote", "span"].includes(tagName)
}

function resolveRichNodeIndexFromTarget(target: HTMLElement | null, scope?: ParentNode | null) {
  const node = target?.closest?.("[data-me-node]") as HTMLElement | null
  if (node) {
    const value = Number(node.getAttribute("data-me-node") ?? "-1")
    if (Number.isFinite(value) && value >= 0) return value
  }

  if (!target || !scope) return null
  const matchedNode = target.closest?.(EDITABLE_RICH_TEXT_SELECTOR) as HTMLElement | null
  if (!matchedNode) return null

  const editableNodes = Array.from(scope.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
  const index = editableNodes.findIndex((item) => item === matchedNode)
  return index >= 0 ? index : null
}

function getRichImagePlaceholderSrc() {
  return [
    "data:image/svg+xml;utf8,",
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <rect width="1200" height="800" rx="36" fill="#eef6ff"/>
        <rect x="40" y="40" width="1120" height="720" rx="28" fill="#ffffff" stroke="#c7d8ef" stroke-width="6"/>
        <path d="M220 590l170-190 130 130 130-160 250 220H220z" fill="#c9dcf3"/>
        <circle cx="430" cy="280" r="58" fill="#dce8f7"/>
        <text x="600" y="675" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#27406b">
          Nova imagem
        </text>
      </svg>`,
    ),
  ].join("")
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function parsePxValue(raw: string | null | undefined, fallback: number) {
  if (!raw) return fallback
  const value = Number.parseFloat(raw.replace("px", "").trim())
  return Number.isFinite(value) ? value : fallback
}

function parsePercentValue(raw: string | null | undefined, fallback: number) {
  if (!raw) return fallback
  const value = raw.trim()
  if (!value.endsWith("%")) return fallback
  const parsed = Number.parseFloat(value.replace("%", "").trim())
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeColorForInput(raw: string | null | undefined, fallback: string) {
  if (!raw) return fallback
  const value = raw.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{3}$/.test(value)) {
    const r = value[1]
    const g = value[2]
    const b = value[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  const rgbMatch = value.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    const [, rRaw, gRaw, bRaw] = rgbMatch
    const r = Math.max(0, Math.min(255, Number.parseInt(rRaw, 10)))
    const g = Math.max(0, Math.min(255, Number.parseInt(gRaw, 10)))
    const b = Math.max(0, Math.min(255, Number.parseInt(bRaw, 10)))
    const toHex = (channel: number) => channel.toString(16).padStart(2, "0")
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }
  return fallback
}

function mapHorizontalAlignToFlex(value: "left" | "center" | "right" | "stretch") {
  if (value === "left") return "flex-start"
  if (value === "center") return "center"
  if (value === "right") return "flex-end"
  return "stretch"
}

function mapVerticalAlignToFlex(value: "top" | "center" | "bottom") {
  if (value === "top") return "flex-start"
  if (value === "center") return "center"
  return "flex-end"
}

function getHtmlForBlockInsertion(block: PageBlock): string {
  if (block.type === "heading") {
    const tag = `h${block.level}`
    return `<${tag} style="color:${escapeHtmlAttribute(block.color)};text-align:${block.align};">${escapeHtmlAttribute(block.content)}</${tag}>`
  }
  if (block.type === "rich_text") return block.content
  if (block.type === "image") {
    const src = block.src || getRichImagePlaceholderSrc()
    return `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(block.alt || "Imagem")}" />`
  }
  if (block.type === "button") {
    const targetAttr = block.openInNewTab ? ` target="_blank" rel="noopener noreferrer"` : ""
    const justifyContent = block.textAlign === "left" ? "flex-start" : block.textAlign === "right" ? "flex-end" : "center"
    const widthCss = block.fullWidth ? "100%" : block.widthPercent > 0 ? `${block.widthPercent}%` : "auto"
    const display = `inline-flex;width:${widthCss};justify-content:${justifyContent};`
    const textTransform = block.fontSize <= 13 ? "uppercase" : "none"
    const letterSpacing = block.fontSize <= 13 ? ".08em" : ".02em"
    return `<a href="${escapeHtmlAttribute(block.href)}"${targetAttr} style="text-decoration:none;font-weight:800;${display}text-align:${block.textAlign};border-style:solid;border-width:${block.borderWidth}px;border-color:${escapeHtmlAttribute(block.borderColor)};border-radius:${block.borderRadius}px;background:${escapeHtmlAttribute(block.backgroundColor)};color:${escapeHtmlAttribute(block.textColor)};padding:${block.paddingY}px ${block.paddingX}px;font-size:${block.fontSize}px;text-transform:${textTransform};letter-spacing:${letterSpacing};">${escapeHtmlAttribute(block.label)}</a>`
  }
  if (block.type === "divider") {
    return `<hr style="border-color:${escapeHtmlAttribute(block.color)};" />`
  }
  if (block.type === "spacer") {
    return `<div style="height:${block.height}px"></div>`
  }
  if (block.type === "columns") {
    const items = block.items
      .slice(0, block.columns)
      .map((item) => {
        const alignItems = mapHorizontalAlignToFlex(block.itemContentAlignX)
        const justifyContent = mapVerticalAlignToFlex(block.itemContentAlignY)
        return `<div style="display:flex;flex-direction:column;align-items:${alignItems};justify-content:${justifyContent};padding:${block.itemPaddingY}px ${block.itemPaddingX}px;border:1px solid rgba(15,23,42,0.08);border-radius:14px;background:#ffffff;">${item}</div>`
      })
      .join("")
    return `<div style="display:grid;grid-template-columns:repeat(${block.columns},minmax(0,1fr));column-gap:${block.gap}px;row-gap:${block.rowGap}px;align-items:${block.alignItems};justify-items:${block.justifyItems};">${items}</div>`
  }
  if (block.type === "container") {
    const alignItems = mapHorizontalAlignToFlex(block.columnContentAlignX)
    const justifyContent = mapVerticalAlignToFlex(block.columnContentAlignY)
    const items: string = block.children
      .slice(0, block.columns)
      .map(
        (columnBlocks: PageBlock[]) =>
          `<div style="min-width:0;display:flex;flex-direction:column;align-items:${alignItems};justify-content:${justifyContent};gap:${block.columnContentGap}px;">${columnBlocks.map((child: PageBlock) => getHtmlForBlockInsertion(child)).join("")}</div>`,
      )
      .join("")
    return `<section style="display:grid;grid-template-columns:repeat(${block.columns},minmax(0,1fr));column-gap:${block.gap}px;row-gap:${block.rowGap}px;align-items:${block.alignItems};justify-items:${block.justifyItems};background:${escapeHtmlAttribute(block.backgroundColor)};border:${block.borderWidth}px solid ${escapeHtmlAttribute(block.borderColor)};border-radius:${block.borderRadius}px;padding:${block.paddingY}px ${block.paddingX}px;">${items}</section>`
  }
  return "<p>Novo bloco</p>"
}

function ActionHint({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div className="relative inline-flex group/action-hint">
      {children}
      <div className="pointer-events-none absolute -top-2 left-1/2 z-50 w-64 -translate-x-1/2 -translate-y-full opacity-0 transition group-hover/action-hint:opacity-100 group-focus-within/action-hint:opacity-100">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-md">{hint}</div>
      </div>
    </div>
  )
}

function getCanvasPreviewCss() {
  return `
${getDefaultStyleCss()}
.me-managed-page-root {
  max-width: none;
  margin: 0;
  padding: 0;
}
.me-managed-block {
  width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.me-home-section {
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding: 40px 0 !important;
}
.me-about-page,
.me-legal-page {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.me-about-page {
  padding: 40px 0 !important;
}
.me-legal-page {
  padding: 20px 0 !important;
}
.me-home-shell {
  width: min(100%, 1120px) !important;
  margin: 0 auto !important;
  padding-left: 20px;
  padding-right: 20px;
  box-sizing: border-box;
}
.me-about-shell,
.me-legal-shell {
  width: min(100%, 1120px) !important;
  margin: 0 auto !important;
  padding-left: 20px;
  padding-right: 20px;
  box-sizing: border-box;
}
.me-home-hero-grid,
.me-home-grid-two {
  align-items: center;
}
.me-about-grid,
.me-about-card-grid,
.me-about-pillar-right,
.me-about-pillar-left,
.me-about-pillar-wide {
  align-items: center;
}
.me-home-hero-copy h1 {
  font-size: clamp(40px, 4vw, 64px);
}
.me-home-hero-copy h2 {
  font-size: clamp(26px, 3vw, 38px);
}
.me-home-display-copy {
  font-size: clamp(26px, 2.8vw, 36px);
}
.me-about-hero h1,
.me-about-section-head h2 {
  font-size: clamp(34px, 4vw, 54px);
}
.me-about-copy p,
.me-about-card p {
  font-size: clamp(17px, 2vw, 21px);
}
.me-about-copy .me-about-lead {
  font-size: clamp(24px, 2.6vw, 32px);
}
.me-about-pillar-tag p {
  font-size: clamp(20px, 2.2vw, 28px);
}
.me-legal-hero-card,
.me-legal-article,
.me-legal-support {
  box-sizing: border-box;
}
.me-legal-hero-card h1 {
  font-size: clamp(32px, 3.6vw, 46px);
}
.me-legal-article h2,
.me-legal-support h2 {
  font-size: clamp(24px, 2.8vw, 34px);
}
.me-home-section-intro h2,
.me-home-reviews h2 {
  font-size: clamp(34px, 4vw, 52px);
}
@media (max-width: 880px) {
  .me-home-shell,
  .me-about-shell,
  .me-legal-shell {
    width: 100% !important;
    padding-left: 14px;
    padding-right: 14px;
  }
  .me-about-grid,
  .me-about-card-grid,
  .me-about-pillar-right,
  .me-about-pillar-left,
  .me-about-pillar-wide {
    grid-template-columns: 1fr !important;
  }
}
  `.trim()
}

function getBlockLabel(block: PageBlock) {
  if (block.type === "heading") return `Título H${block.level}`
  if (block.type === "rich_text") return "Texto rico"
  if (block.type === "image") return "Imagem"
  if (block.type === "button") return "Botão"
  if (block.type === "container") return `Container ${block.columns} colunas`
  if (block.type === "columns") return `Seção ${block.columns} colunas`
  if (block.type === "divider") return "Divisor"
  return "Espaço"
}

function getStructureRichNodeLabel(node: Element, index: number) {
  const tagName = node.tagName.toLowerCase()
  const tagLabelMap: Record<string, string> = {
    h1: "Título H1",
    h2: "Título H2",
    h3: "Título H3",
    h4: "Título H4",
    h5: "Título H5",
    h6: "Título H6",
    p: "Paragrafo",
    a: "Link",
    li: "Item de lista",
    blockquote: "Citacao",
    img: "Imagem",
    span: "Texto",
  }
  const baseLabel = tagLabelMap[tagName] ?? `Elemento ${tagName.toUpperCase()}`
  const rawPreview =
    tagName === "img"
      ? node.getAttribute("alt") || "sem descrição"
      : tagName === "a"
        ? node.textContent?.trim() || node.getAttribute("href") || "link"
        : node.textContent?.trim() || ""
  const preview = rawPreview.replace(/\s+/g, " ").trim()
  if (!preview) return `${baseLabel} ${index + 1}`
  const compact = preview.length > 46 ? `${preview.slice(0, 46)}...` : preview
  return `${baseLabel}: ${compact}`
}

function buildBlockStructureNode(block: PageBlock, nodeId: string): EditorStructureNode {
  if (block.type !== "container") {
    const richChildren: EditorStructureNode[] =
      block.type === "rich_text"
        ? getEditableRichNodesFromHtml(block.content).map((node, richNodeIndex) => ({
            id: `${nodeId}-rich-${richNodeIndex}`,
            kind: "rich_node",
            label: getStructureRichNodeLabel(node, richNodeIndex),
            blockId: block.id,
            richNodeIndex,
            children: [],
          }))
        : []

    return {
      id: nodeId,
      kind: "block",
      label: getBlockLabel(block),
      blockId: block.id,
      children: richChildren,
    }
  }

  const columnNodes: EditorStructureNode[] = block.children.slice(0, block.columns).map((columnBlocks, columnIndex) => ({
    id: `${nodeId}-column-${columnIndex}`,
    kind: "column",
    label: `Coluna ${columnIndex + 1}`,
    blockId: block.id,
    containerId: block.id,
    columnIndex,
    children: columnBlocks.map((childBlock, childIndex) =>
      buildBlockStructureNode(childBlock, `${nodeId}-column-${columnIndex}-child-${childIndex}-${childBlock.id}`),
    ),
  }))

  return {
    id: nodeId,
    kind: "container",
    label: getBlockLabel(block),
    blockId: block.id,
    children: columnNodes,
  }
}

function buildStructureTree(blocks: PageBlock[]): EditorStructureNode[] {
  return blocks.map((block, index) => {
    const rootNode = buildBlockStructureNode(block, `section-${index}-${block.id}-root`)
    const normalizedRootNode =
      block.type === "rich_text"
        ? {
            ...rootNode,
            label: "Container",
          }
        : rootNode

    return {
      id: `section-${index}-${block.id}`,
      kind: "section" as const,
      label: `Seção ${index + 1}`,
      blockId: block.id,
      children: [normalizedRootNode],
    }
  })
}

function canInlineEdit(block: PageBlock) {
  return block.type === "heading" || block.type === "button" || block.type === "columns"
}

function getBlockContainerStyle(layout?: BlockLayoutStyle): CSSProperties {
  const normalized = normalizeLayoutStyle(layout ?? getBlockLayoutDefaults())
  const widthPercent = Math.round((normalized.gridColumns / 12) * 10000) / 100
  const widthCss = `min(100%, ${widthPercent}%)`

  const contentAlignItems = mapHorizontalAlignToFlex(normalized.contentAlignX)
  const contentJustifyContent = mapVerticalAlignToFlex(normalized.contentAlignY)

  return {
    width: widthCss,
    marginTop: normalized.marginTop,
    marginBottom: normalized.marginBottom,
    marginLeft: normalized.align === "right" ? "auto" : normalized.align === "center" ? "auto" : 0,
    marginRight: normalized.align === "left" ? "auto" : normalized.align === "center" ? "auto" : 0,
    paddingTop: normalized.paddingTop,
    paddingRight: normalized.paddingRight,
    paddingBottom: normalized.paddingBottom,
    paddingLeft: normalized.paddingLeft,
    background: normalized.backgroundColor,
    borderRadius: normalized.borderRadius,
    display: "flex",
    flexDirection: "column",
    alignItems: contentAlignItems,
    justifyContent: contentJustifyContent,
    gap: normalized.contentGap,
    minHeight: normalized.minHeight,
    boxSizing: "border-box",
  }
}

type BlockPlacement =
  | {
      parentKind: "root"
      index: number
    }
  | {
      parentKind: "container"
      containerId: string
      columnIndex: number
      index: number
    }

function findBlockPlacement(
  blocks: PageBlock[],
  blockId: string,
  context?: { containerId: string; columnIndex: number },
): BlockPlacement | null {
  const rootIndex = blocks.findIndex((item) => item.id === blockId)
  if (rootIndex >= 0) {
    if (context) {
      return {
        parentKind: "container",
        containerId: context.containerId,
        columnIndex: context.columnIndex,
        index: rootIndex,
      }
    }
    return {
      parentKind: "root",
      index: rootIndex,
    }
  }

  for (const block of blocks) {
    if (block.type !== "container") continue
    for (let columnIndex = 0; columnIndex < block.children.length; columnIndex += 1) {
      const columnBlocks = block.children[columnIndex] ?? []
      const childIndex = columnBlocks.findIndex((item) => item.id === blockId)
      if (childIndex >= 0) {
        return {
          parentKind: "container",
          containerId: block.id,
          columnIndex,
          index: childIndex,
        }
      }
      const nested = findBlockPlacement(columnBlocks, blockId, { containerId: block.id, columnIndex })
      if (nested) return nested
    }
  }

  return null
}

function findBlockByIdInTree(blocks: PageBlock[], blockId: string): PageBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) return block
    if (block.type !== "container") continue
    for (const columnBlocks of block.children) {
      const nested = findBlockByIdInTree(columnBlocks, blockId)
      if (nested) return nested
    }
  }
  return null
}

function updateBlockByIdInTree(
  blocks: PageBlock[],
  blockId: string,
  updater: (block: PageBlock) => PageBlock,
): { blocks: PageBlock[]; updated: boolean } {
  let updated = false
  const nextBlocks = blocks.map((block) => {
    if (block.id === blockId) {
      updated = true
      return updater(block)
    }
    if (block.type !== "container") return block

    let nestedUpdated = false
    const nextChildren = block.children.map((columnBlocks) => {
      const nested = updateBlockByIdInTree(columnBlocks, blockId, updater)
      if (nested.updated) nestedUpdated = true
      return nested.blocks
    })
    if (!nestedUpdated) return block
    updated = true
    return {
      ...block,
      children: nextChildren,
    }
  })

  return { blocks: nextBlocks, updated }
}

function insertBlockAfterIdInTree(
  blocks: PageBlock[],
  targetBlockId: string,
  newBlock: PageBlock,
): { blocks: PageBlock[]; inserted: boolean } {
  const index = blocks.findIndex((item) => item.id === targetBlockId)
  if (index >= 0) {
    const nextBlocks = [...blocks]
    nextBlocks.splice(index + 1, 0, newBlock)
    return { blocks: nextBlocks, inserted: true }
  }

  let inserted = false
  const nextBlocks = blocks.map((block) => {
    if (block.type !== "container") return block
    let nestedInserted = false
    const nextChildren = block.children.map((columnBlocks) => {
      const nested = insertBlockAfterIdInTree(columnBlocks, targetBlockId, newBlock)
      if (nested.inserted) nestedInserted = true
      return nested.blocks
    })
    if (!nestedInserted) return block
    inserted = true
    return {
      ...block,
      children: nextChildren,
    }
  })
  return { blocks: nextBlocks, inserted }
}

function appendBlockToContainerColumnInTree(
  blocks: PageBlock[],
  containerId: string,
  columnIndex: number,
  newBlock: PageBlock,
): { blocks: PageBlock[]; inserted: boolean } {
  return insertBlockIntoContainerColumnInTree(blocks, containerId, columnIndex, newBlock)
}

function insertBlockIntoContainerColumnInTree(
  blocks: PageBlock[],
  containerId: string,
  columnIndex: number,
  newBlock: PageBlock,
  rawInsertIndex?: number,
): { blocks: PageBlock[]; inserted: boolean } {
  let inserted = false
  const nextBlocks = blocks.map((block) => {
    if (block.id === containerId && block.type === "container") {
      const safeColumnIndex = Math.max(0, Math.min(columnIndex, block.columns - 1))
      const nextChildren = block.children.map((columnBlocks, index) => {
        if (index !== safeColumnIndex) return columnBlocks
        const insertIndex = Math.max(0, Math.min(rawInsertIndex ?? columnBlocks.length, columnBlocks.length))
        const nextColumnBlocks = [...columnBlocks]
        nextColumnBlocks.splice(insertIndex, 0, newBlock)
        return nextColumnBlocks
      })
      inserted = true
      return {
        ...block,
        children: nextChildren,
      }
    }

    if (block.type !== "container") return block
    let nestedInserted = false
    const nextChildren = block.children.map((columnBlocks) => {
      const nested = insertBlockIntoContainerColumnInTree(columnBlocks, containerId, columnIndex, newBlock, rawInsertIndex)
      if (nested.inserted) nestedInserted = true
      return nested.blocks
    })
    if (!nestedInserted) return block
    inserted = true
    return {
      ...block,
      children: nextChildren,
    }
  })
  return { blocks: nextBlocks, inserted }
}

function removeBlockByIdInTree(blocks: PageBlock[], blockId: string): { blocks: PageBlock[]; removed: boolean } {
  let removed = false
  const directFiltered = blocks.filter((block) => {
    if (block.id !== blockId) return true
    removed = true
    return false
  })

  const nextBlocks = directFiltered.map((block) => {
    if (block.type !== "container") return block
    let nestedRemoved = false
    const nextChildren = block.children.map((columnBlocks) => {
      const nested = removeBlockByIdInTree(columnBlocks, blockId)
      if (nested.removed) nestedRemoved = true
      return nested.blocks
    })
    if (!nestedRemoved) return block
    removed = true
    return {
      ...block,
      children: nextChildren,
    }
  })

  return { blocks: nextBlocks, removed }
}

function duplicateBlockWithNewIds(block: PageBlock): PageBlock {
  const duplicatedId = `${block.type}-${crypto.randomUUID()}`
  if (block.type === "container") {
    return {
      ...block,
      id: duplicatedId,
      children: block.children.map((columnBlocks) => columnBlocks.map((child) => duplicateBlockWithNewIds(child))),
    }
  }
  return {
    ...block,
    id: duplicatedId,
  }
}

export function AdminPageEditor() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSlug, setSelectedSlug] = useState<SitePageSlug>(() => resolveSlugFromSearchParams(searchParams) ?? "home")
  const [pendingSelectedSlug, setPendingSelectedSlug] = useState<SitePageSlug>(() => resolveSlugFromSearchParams(searchParams) ?? "home")
  const [pageOpenRequestSlug, setPageOpenRequestSlug] = useState<SitePageSlug | null>(null)
  const [documentDraft, setDocumentDraft] = useState<SitePageBuilderDocument>(getDefaultDocumentForSlug("home"))
  const [selectedVersionId, setSelectedVersionId] = useState<string>("")
  const [selectedBlockId, setSelectedBlockId] = useState<string>("")
  const [isDirty, setIsDirty] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [autosaveEnabled, setAutosaveEnabled] = useState(true)
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [autosaveSavedAt, setAutosaveSavedAt] = useState<string | null>(null)
  const [uploadingAsset, setUploadingAsset] = useState(false)
  const [uploadingInspectorAsset, setUploadingInspectorAsset] = useState(false)
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<"blocks" | "structure" | "inspector" | "versions">("inspector")
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDraggingCanvasBlock, setIsDraggingCanvasBlock] = useState(false)
  const [inlineEditingBlockId, setInlineEditingBlockId] = useState<string | null>(null)
  const [showLayoutGuides, setShowLayoutGuides] = useState(true)
  const [snapSpacingToGrid, setSnapSpacingToGrid] = useState(true)
  const [selectedRichNodeIndex, setSelectedRichNodeIndex] = useState<number | null>(null)
  const [selectedContainerColumnTarget, setSelectedContainerColumnTarget] = useState<{
    containerId: string
    columnIndex: number
  } | null>(null)
  const [pendingContainerInsertPoint, setPendingContainerInsertPoint] = useState<{
    containerId: string
    columnIndex: number
  } | null>(null)
  const [isLayoutCardVisible, setIsLayoutCardVisible] = useState(false)
  const [isVersionHistoryExpanded, setIsVersionHistoryExpanded] = useState(false)
  const [pendingRichInsertPoint, setPendingRichInsertPoint] = useState<PendingRichInsertPoint | null>(null)
  const [isMoreActionsMenuOpen, setIsMoreActionsMenuOpen] = useState(false)

  const richTextRef = useRef<RichTextEditorHandle | null>(null)
  const moreActionsMenuRef = useRef<HTMLDivElement | null>(null)
  const loadedSlugRef = useRef<string>("")
  const loadedVersionRef = useRef<string>("")
  const autosaveTimerRef = useRef<number | null>(null)
  const dragPayloadRef = useRef<DragPayload | null>(null)
  const richSelectionMode = true

  const pagesQuery = useAdminSitePages()
  const detailQuery = useAdminSitePageDetail(selectedSlug)
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const publishMutation = usePublishAdminSitePageVersion()
  const rollbackMutation = useRollbackAdminSitePageVersion()
  const unpublishMutation = useUnpublishAdminSitePage()
  const uploadAssetMutation = useUploadAdminSitePageAssetFile()

  const pageSummary = useMemo(() => {
    return (pagesQuery.data ?? []).find((page) => page.slug === selectedSlug) ?? null
  }, [pagesQuery.data, selectedSlug])

  const versions = useMemo(() => detailQuery.data?.versions ?? [], [detailQuery.data?.versions])
  const assets = useMemo(() => detailQuery.data?.assets ?? [], [detailQuery.data?.assets])
  const publishedVersionId = detailQuery.data?.page.published_version_id ?? null
  const selectedVersion = useMemo(() => versions.find((v) => v.id === selectedVersionId) ?? null, [selectedVersionId, versions])
  const selectedBlock = useMemo(
    () => findBlockByIdInTree(documentDraft.blocks, selectedBlockId),
    [documentDraft.blocks, selectedBlockId],
  )
  const selectedLayout = useMemo(
    () => normalizeLayoutStyle(selectedBlock?.layout ?? getBlockLayoutDefaults()),
    [selectedBlock],
  )
  const structureTree = useMemo(() => buildStructureTree(documentDraft.blocks), [documentDraft.blocks])

  const selectedRichNodeHtml = useMemo(() => {
    if (!selectedBlock || selectedBlock.type !== "rich_text") return null
    if (selectedRichNodeIndex === null) return null
    const nodes = getEditableRichNodesFromHtml(selectedBlock.content)
    const node = nodes[selectedRichNodeIndex]
    return node ? node.outerHTML : null
  }, [selectedBlock, selectedRichNodeIndex])

  const selectedRichNodeDescriptor = useMemo(() => {
    if (!selectedRichNodeHtml || typeof window === "undefined" || typeof DOMParser === "undefined") return null
    const parser = new DOMParser()
    const parsed = parser.parseFromString(selectedRichNodeHtml, "text/html")
    const element = parsed.body.firstElementChild as HTMLElement | null
    if (!element) return null

    const tagName = element.tagName.toLowerCase()
    const marginLeft = element.style.marginLeft.trim()
    const marginRight = element.style.marginRight.trim()
    const buttonAlign: "left" | "center" | "right" =
      marginLeft === "auto" && marginRight === "auto" ? "center" : marginLeft === "auto" ? "right" : "left"
    return {
      tagName,
      outerHtml: element.outerHTML,
      innerHtml: element.innerHTML,
      textContent: element.textContent?.trim() ?? "",
      isTextEditable: isRichTextNodeTextEditable(tagName),
      isImage: tagName === "img",
      isLink: tagName === "a",
      linkHref: element.getAttribute("href") ?? "",
      textColor: normalizeColorForInput(element.style.color, "#0f172a"),
      backgroundColor: normalizeColorForInput(element.style.backgroundColor, "#ffffff"),
      borderWidthPx: parsePxValue(element.style.borderWidth, 0),
      borderColor: normalizeColorForInput(element.style.borderColor, "#242742"),
      borderRadiusPx: parsePxValue(element.style.borderRadius, 999),
      paddingY: parsePxValue(element.style.paddingTop, 14),
      paddingX: parsePxValue(element.style.paddingLeft, 24),
      fontSizePx: parsePxValue(element.style.fontSize, 12),
      textAlign: (["left", "center", "right"].includes(element.style.textAlign) ? element.style.textAlign : "center") as
        | "left"
        | "center"
        | "right",
      buttonAlign,
      widthPercent: Math.max(0, Math.min(100, parsePercentValue(element.style.width, 0))),
      fullWidth: element.style.width === "100%",
      openInNewTab: element.getAttribute("target") === "_blank",
      imageSrc: element.getAttribute("src") ?? "",
      imageAlt: element.getAttribute("alt") ?? "",
    }
  }, [selectedRichNodeHtml])

  const selectedRichNodeText = useMemo(() => {
    return selectedRichNodeDescriptor?.textContent ?? ""
  }, [selectedRichNodeDescriptor])

  const showLayoutSectionCard = useMemo(() => {
    if (!isLayoutCardVisible) return false
    if (selectedBlock?.type === "rich_text" && selectedRichNodeIndex !== null) return false
    return true
  }, [isLayoutCardVisible, selectedBlock?.type, selectedRichNodeIndex])

  const autosaveLabel = useMemo(() => {
    if (!autosaveEnabled) return "Autosave desligado"
    if (autosaveStatus === "saving") return "Autosave a guardar..."
    if (autosaveStatus === "error") return "Erro no autosave"
    if (autosaveStatus === "saved" && autosaveSavedAt) return `Autosave ${formatDateTime(autosaveSavedAt)}`
    return "Autosave ativo"
  }, [autosaveEnabled, autosaveSavedAt, autosaveStatus])

  const canvasPreviewCss = useMemo(() => getCanvasPreviewCss(), [])

  const isSaving =
    saveDraftMutation.isPending ||
    publishMutation.isPending ||
    rollbackMutation.isPending ||
    unpublishMutation.isPending ||
    uploadAssetMutation.isPending
  const hasPendingPageSelection = pendingSelectedSlug !== selectedSlug
  const isPageSelectionLoading =
    pageOpenRequestSlug === selectedSlug && (detailQuery.isLoading || detailQuery.isFetching)
  const isDraggingRichNode = isDraggingCanvasBlock && dragPayloadRef.current?.kind === "rich_node"
  const isDraggingBlockLike = isDraggingCanvasBlock && !isDraggingRichNode

  useEffect(() => {
    const slugFromUrl = resolveSlugFromSearchParams(searchParams) ?? "home"
    if (slugFromUrl === selectedSlug) return

    // Evita "piscar" durante a troca iniciada pelo botao "Abrir pagina":
    // enquanto a URL ainda nao refletiu o slug novo, nao revertemos o estado local.
    if (pageOpenRequestSlug && pageOpenRequestSlug === selectedSlug) return

    setSelectedSlug(slugFromUrl)
    setPendingSelectedSlug(slugFromUrl)
    setFeedback(null)
  }, [pageOpenRequestSlug, searchParams, selectedSlug])

  useEffect(() => {
    if (!pageOpenRequestSlug) return
    if (pageOpenRequestSlug !== selectedSlug) return
    if (detailQuery.isLoading || detailQuery.isFetching) return
    setPageOpenRequestSlug(null)
  }, [detailQuery.isFetching, detailQuery.isLoading, pageOpenRequestSlug, selectedSlug])

  useEffect(() => {
    if (!isMoreActionsMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (moreActionsMenuRef.current?.contains(target)) return
      setIsMoreActionsMenuOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreActionsMenuOpen(false)
      }
    }
    window.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [isMoreActionsMenuOpen])

  const updateDocument = useCallback((updater: (current: SitePageBuilderDocument) => SitePageBuilderDocument) => {
    setDocumentDraft((current) => updater(current))
    setIsDirty(true)
    setAutosaveStatus((prev) => (prev === "saving" ? prev : "idle"))
  }, [])

  const updateSelectedBlock = useCallback(
    (updater: (block: PageBlock) => PageBlock) => {
      if (!selectedBlockId) return
      updateDocument((current) => {
        const next = updateBlockByIdInTree(current.blocks, selectedBlockId, updater)
        if (!next.updated) return current
        return { blocks: next.blocks }
      })
    },
    [selectedBlockId, updateDocument],
  )

  const selectBlockForEdit = useCallback((blockId: string) => {
    if (selectedBlockId !== blockId) {
      setSelectedRichNodeIndex(null)
      setPendingRichInsertPoint(null)
    }
    setSelectedBlockId(blockId)
    setSidebarTab("inspector")
    setSelectedContainerColumnTarget(null)
    setPendingContainerInsertPoint(null)
    setIsLayoutCardVisible(true)
  }, [selectedBlockId])

  const selectBlockSilently = useCallback((blockId: string) => {
    if (selectedBlockId !== blockId) {
      setSelectedRichNodeIndex(null)
      setPendingRichInsertPoint(null)
    }
    setSelectedBlockId(blockId)
    setSelectedContainerColumnTarget(null)
    setPendingContainerInsertPoint(null)
    setIsLayoutCardVisible(false)
  }, [selectedBlockId])

  const selectRichNodeForEdit = useCallback((blockId: string, richNodeIndex: number) => {
    setSelectedBlockId(blockId)
    setSelectedContainerColumnTarget(null)
    setPendingContainerInsertPoint(null)
    setPendingRichInsertPoint(null)
    setSelectedRichNodeIndex(richNodeIndex)
    setSidebarTab("inspector")
    setIsLayoutCardVisible(true)
  }, [])

  const handleSelectStructureNode = useCallback(
    (node: EditorStructureNode, options?: { openInspector?: boolean }) => {
      const openInspector = options?.openInspector ?? false

      if (node.kind === "rich_node" && node.blockId && typeof node.richNodeIndex === "number") {
        if (openInspector) {
          selectRichNodeForEdit(node.blockId, node.richNodeIndex)
        } else {
          setSelectedBlockId(node.blockId)
          setSelectedContainerColumnTarget(null)
          setPendingContainerInsertPoint(null)
          setPendingRichInsertPoint(null)
          setSelectedRichNodeIndex(node.richNodeIndex)
          setIsLayoutCardVisible(false)
        }
        return
      }
      if (node.kind === "column" && node.containerId && typeof node.columnIndex === "number") {
        setSelectedRichNodeIndex(null)
        setPendingRichInsertPoint(null)
        setSelectedBlockId(node.containerId)
        setSelectedContainerColumnTarget({ containerId: node.containerId, columnIndex: node.columnIndex })
        setPendingContainerInsertPoint(null)
        setIsLayoutCardVisible(openInspector)
        if (openInspector) {
          setSidebarTab("inspector")
        }
        return
      }
      if (node.blockId) {
        if (openInspector) {
          selectBlockForEdit(node.blockId)
          return
        }
        selectBlockSilently(node.blockId)
      }
    },
    [selectBlockForEdit, selectBlockSilently, selectRichNodeForEdit],
  )

  const isStructureNodeSelected = useCallback(
    (node: EditorStructureNode) => {
      if (node.kind === "rich_node") {
        return !!node.blockId && node.blockId === selectedBlockId && selectedRichNodeIndex === node.richNodeIndex
      }
      if (node.kind === "column") {
        return (
          selectedContainerColumnTarget?.containerId === node.containerId &&
          selectedContainerColumnTarget?.columnIndex === node.columnIndex
        )
      }
      return !!node.blockId && node.blockId === selectedBlockId
    },
    [selectedBlockId, selectedContainerColumnTarget, selectedRichNodeIndex],
  )

  const duplicateRichNodeAtIndex = useCallback(
    (blockId: string, richNodeIndex: number) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return false
      let duplicated = false
      updateDocument((current) => {
        const next = updateBlockByIdInTree(current.blocks, blockId, (block) => {
          if (block.type !== "rich_text") return block
          const parser = new DOMParser()
          const parsed = parser.parseFromString(block.content, "text/html")
          const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
          const targetNode = nodes[richNodeIndex]
          if (!targetNode || !targetNode.parentNode) return block
          const clone = targetNode.cloneNode(true)
          targetNode.parentNode.insertBefore(clone, targetNode.nextSibling)
          duplicated = true
          return { ...block, content: parsed.body.innerHTML }
        })
        return next.updated ? { blocks: next.blocks } : current
      })
      if (duplicated) {
        setSelectedBlockId(blockId)
        setSelectedRichNodeIndex(richNodeIndex + 1)
      }
      return duplicated
    },
    [updateDocument],
  )

  const removeRichNodeAtIndex = useCallback(
    (blockId: string, richNodeIndex: number) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return false
      let removed = false
      updateDocument((current) => {
        const next = updateBlockByIdInTree(current.blocks, blockId, (block) => {
          if (block.type !== "rich_text") return block
          const parser = new DOMParser()
          const parsed = parser.parseFromString(block.content, "text/html")
          const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
          const targetNode = nodes[richNodeIndex]
          if (!targetNode) return block
          targetNode.remove()
          if (!parsed.body.innerHTML.trim()) {
            parsed.body.innerHTML = "<p></p>"
          }
          removed = true
          return { ...block, content: parsed.body.innerHTML }
        })
        return next.updated ? { blocks: next.blocks } : current
      })
      if (removed) {
        setSelectedBlockId(blockId)
        setSelectedRichNodeIndex(null)
      }
      return removed
    },
    [updateDocument],
  )

  const duplicateContainerColumnContent = useCallback(
    (containerId: string, columnIndex: number) => {
      let duplicated = false
      updateDocument((current) => {
        const next = updateBlockByIdInTree(current.blocks, containerId, (block) => {
          if (block.type !== "container") return block
          const safeIndex = Math.max(0, Math.min(columnIndex, block.columns - 1))
          const sourceBlocks = block.children[safeIndex] ?? []
          if (sourceBlocks.length === 0) return block
          const clonedBlocks = sourceBlocks.map((item) => duplicateBlockWithNewIds(item))
          const nextChildren = block.children.map((columnBlocks, idx) =>
            idx === safeIndex ? [...columnBlocks, ...clonedBlocks] : columnBlocks,
          )
          duplicated = true
          return { ...block, children: nextChildren }
        })
        return next.updated ? { blocks: next.blocks } : current
      })
      if (duplicated) {
        setSelectedBlockId(containerId)
        setSelectedContainerColumnTarget({ containerId, columnIndex })
      }
      return duplicated
    },
    [updateDocument],
  )

  const clearContainerColumnContent = useCallback(
    (containerId: string, columnIndex: number) => {
      let cleared = false
      updateDocument((current) => {
        const next = updateBlockByIdInTree(current.blocks, containerId, (block) => {
          if (block.type !== "container") return block
          const safeIndex = Math.max(0, Math.min(columnIndex, block.columns - 1))
          const sourceBlocks = block.children[safeIndex] ?? []
          if (sourceBlocks.length === 0) return block
          const nextChildren = block.children.map((columnBlocks, idx) => (idx === safeIndex ? [] : columnBlocks))
          cleared = true
          return { ...block, children: nextChildren }
        })
        return next.updated ? { blocks: next.blocks } : current
      })
      if (cleared) {
        setSelectedBlockId(containerId)
        setSelectedContainerColumnTarget({ containerId, columnIndex })
      }
      return cleared
    },
    [updateDocument],
  )

  const snapSpacing = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return 0
      if (!snapSpacingToGrid) return Math.max(0, value)
      return Math.max(0, Math.round(value / 4) * 4)
    },
    [snapSpacingToGrid],
  )

  const updateSelectedBlockLayout = useCallback(
    (partial: Partial<BlockLayoutStyle>) => {
      updateSelectedBlock((block) => ({
        ...block,
        layout: normalizeLayoutStyle({
          ...block.layout,
          ...partial,
        }),
      }))
    },
    [updateSelectedBlock],
  )

  const annotateRichTextNodes = useCallback(
    (html: string, activeIndex: number | null, _showDropSlots = false) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return html
      void _showDropSlots
      const parser = new DOMParser()
      const parsed = parser.parseFromString(html, "text/html")
      const editableNodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      editableNodes.forEach((child, index) => {
        child.setAttribute("data-me-node", String(index))
        child.setAttribute("draggable", "true")
        const baseStyle = child.getAttribute("style") ?? ""
        const activeStyle =
          activeIndex === index
            ? "outline:2px solid #38bdf8;outline-offset:2px;cursor:grab;"
            : "cursor:grab;"
        child.setAttribute("style", `${baseStyle}${baseStyle ? ";" : ""}${activeStyle}`)
      })
      return parsed.body.innerHTML
    },
    [],
  )

  const applyRichNodeEdit = useCallback(
    (nextNodeHtml: string) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      if (!nodes[selectedRichNodeIndex]) return

      const nextNodeDoc = parser.parseFromString(nextNodeHtml, "text/html")
      const replacement = nextNodeDoc.body.firstElementChild
      if (!replacement) return

      nodes[selectedRichNodeIndex].replaceWith(replacement)
      const nextHtml = parsed.body.innerHTML
      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: nextHtml } : block))
    },
    [selectedBlock, selectedRichNodeIndex, updateSelectedBlock],
  )

  const applyRichNodeTextContentEdit = useCallback(
    (nextText: string) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex] as HTMLElement | undefined
      if (!targetNode) return

      targetNode.textContent = nextText
      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML } : block))
    },
    [selectedBlock, selectedRichNodeIndex, updateSelectedBlock],
  )

  const applyRichNodeImageEdit = useCallback(
    (partial: { src?: string; alt?: string }) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex] as HTMLElement | undefined
      if (!targetNode || targetNode.tagName.toLowerCase() !== "img") return

      if (typeof partial.src === "string") {
        targetNode.setAttribute("src", partial.src)
      }
      if (typeof partial.alt === "string") {
        targetNode.setAttribute("alt", partial.alt)
      }

      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML } : block))
    },
    [selectedBlock, selectedRichNodeIndex, updateSelectedBlock],
  )

  const replaceSelectedRichNodeWithImage = useCallback(() => {
    if (!selectedBlock || selectedBlock.type !== "rich_text") return false
    if (selectedRichNodeIndex === null) return false
    const placeholderSrc = getRichImagePlaceholderSrc()
    applyRichNodeEdit(`<img src="${placeholderSrc}" alt="Nova imagem" />`)
    return true
  }, [applyRichNodeEdit, selectedBlock, selectedRichNodeIndex])

  const insertRichNodeAtIndex = useCallback(
    (blockId: string, insertIndex: number, nextNodeHtml: string, insertAfterNodeIndex?: number) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return false
      let inserted = false
      updateDocument((current) => {
        const nextBlocks = current.blocks.map((block) => {
          if (block.id !== blockId || block.type !== "rich_text") return block
          const parser = new DOMParser()
          const parsed = parser.parseFromString(block.content, "text/html")
          const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
          const nextNodeDoc = parser.parseFromString(nextNodeHtml, "text/html")
          const replacement = nextNodeDoc.body.firstElementChild
          if (!replacement) return block
          const anchorIndex = Number.isFinite(insertAfterNodeIndex) ? Number(insertAfterNodeIndex) : -1
          const anchorNode = anchorIndex >= 0 && anchorIndex < nodes.length ? nodes[anchorIndex] : null

          if (anchorNode?.parentNode) {
            anchorNode.parentNode.insertBefore(replacement, anchorNode.nextSibling)
          } else if (insertIndex >= nodes.length) {
            parsed.body.appendChild(replacement)
          } else {
            nodes[insertIndex].parentNode?.insertBefore(replacement, nodes[insertIndex])
          }
          inserted = true
          return { ...block, content: parsed.body.innerHTML }
        })
        return { blocks: nextBlocks }
      })
      return inserted
    },
    [updateDocument],
  )

  const moveRichNodeToIndex = useCallback(
    (sourceBlockId: string, sourceRichNodeIndex: number, targetBlockId: string, rawTargetInsertIndex: number) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return false

      let moved = false
      let finalTargetIndex: number | null = null

      updateDocument((current) => {
        const sourceBlock = findBlockByIdInTree(current.blocks, sourceBlockId)
        const targetBlock = findBlockByIdInTree(current.blocks, targetBlockId)
        if (!sourceBlock || sourceBlock.type !== "rich_text" || !targetBlock || targetBlock.type !== "rich_text") {
          return current
        }

        const parser = new DOMParser()

        if (sourceBlockId === targetBlockId) {
          const parsed = parser.parseFromString(sourceBlock.content, "text/html")
          const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
          const sourceNode = nodes[sourceRichNodeIndex]
          if (!sourceNode) return current

          const nodeHtml = sourceNode.outerHTML
          sourceNode.remove()

          const nextNodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
          const targetInsertIndex =
            sourceRichNodeIndex < rawTargetInsertIndex ? rawTargetInsertIndex - 1 : rawTargetInsertIndex
          const normalizedIndex = Math.max(0, Math.min(targetInsertIndex, nextNodes.length))
          const nextNodeDoc = parser.parseFromString(nodeHtml, "text/html")
          const replacement = nextNodeDoc.body.firstElementChild
          if (!replacement) return current

          if (normalizedIndex >= nextNodes.length) {
            parsed.body.appendChild(replacement)
          } else {
            nextNodes[normalizedIndex].parentNode?.insertBefore(replacement, nextNodes[normalizedIndex])
          }

          finalTargetIndex = normalizedIndex
          moved = true

          const updated = updateBlockByIdInTree(current.blocks, sourceBlockId, (block) =>
            block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML || "<p></p>" } : block,
          )
          return updated.updated ? { blocks: updated.blocks } : current
        }

        const sourceParsed = parser.parseFromString(sourceBlock.content, "text/html")
        const sourceNodes = Array.from(sourceParsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
        const sourceNode = sourceNodes[sourceRichNodeIndex]
        if (!sourceNode) return current

        const nodeHtml = sourceNode.outerHTML
        sourceNode.remove()
        if (!sourceParsed.body.innerHTML.trim()) {
          sourceParsed.body.innerHTML = "<p></p>"
        }

        const removedSource = updateBlockByIdInTree(current.blocks, sourceBlockId, (block) =>
          block.type === "rich_text" ? { ...block, content: sourceParsed.body.innerHTML } : block,
        )
        if (!removedSource.updated) return current

        const targetBlockAfterRemoval = findBlockByIdInTree(removedSource.blocks, targetBlockId)
        if (!targetBlockAfterRemoval || targetBlockAfterRemoval.type !== "rich_text") return current

        const targetParsed = parser.parseFromString(targetBlockAfterRemoval.content, "text/html")
        const targetNodes = Array.from(targetParsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
        const normalizedIndex = Math.max(0, Math.min(rawTargetInsertIndex, targetNodes.length))
        const nextNodeDoc = parser.parseFromString(nodeHtml, "text/html")
        const replacement = nextNodeDoc.body.firstElementChild
        if (!replacement) return current

        if (normalizedIndex >= targetNodes.length) {
          targetParsed.body.appendChild(replacement)
        } else {
          targetNodes[normalizedIndex].parentNode?.insertBefore(replacement, targetNodes[normalizedIndex])
        }

        finalTargetIndex = normalizedIndex
        moved = true

        const insertedTarget = updateBlockByIdInTree(removedSource.blocks, targetBlockId, (block) =>
          block.type === "rich_text" ? { ...block, content: targetParsed.body.innerHTML } : block,
        )
        return insertedTarget.updated ? { blocks: insertedTarget.blocks } : current
      })

      if (moved) {
        setSelectedBlockId(targetBlockId)
        setSelectedRichNodeIndex(finalTargetIndex)
        setPendingRichInsertPoint(null)
        setSidebarTab("inspector")
        setIsLayoutCardVisible(true)
      }

      return moved
    },
    [updateDocument],
  )

  const applyRichNodeLinkEdit = useCallback(
    (partial: { href?: string }) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex] as HTMLElement | undefined
      if (!targetNode || targetNode.tagName.toLowerCase() !== "a") return

      if (typeof partial.href === "string") {
        targetNode.setAttribute("href", partial.href)
      }

      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML } : block))
    },
    [selectedBlock, selectedRichNodeIndex, updateSelectedBlock],
  )

  const applyRichNodeLinkStyleEdit = useCallback(
    (partial: {
      borderWidth?: number
      borderColor?: string
      borderRadius?: number
      backgroundColor?: string
      textColor?: string
      paddingY?: number
      paddingX?: number
      fontSize?: number
      textAlign?: "left" | "center" | "right"
      buttonAlign?: "left" | "center" | "right"
      widthPercent?: number
      fullWidth?: boolean
      openInNewTab?: boolean
    }) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex] as HTMLElement | undefined
      if (!targetNode || targetNode.tagName.toLowerCase() !== "a") return

      targetNode.style.display = "flex"
      targetNode.style.alignItems = "center"
      targetNode.style.justifyContent = "center"
      targetNode.style.textDecoration = "none"
      targetNode.style.fontWeight = "800"
      targetNode.style.borderStyle = "solid"
      targetNode.style.width = targetNode.style.width || "fit-content"

      if (typeof partial.borderWidth === "number") {
        targetNode.style.borderWidth = `${Math.max(0, Math.min(12, partial.borderWidth))}px`
      }
      if (typeof partial.borderColor === "string") {
        targetNode.style.borderColor = partial.borderColor
      }
      if (typeof partial.borderRadius === "number") {
        targetNode.style.borderRadius = `${Math.max(0, Math.min(120, partial.borderRadius))}px`
      }
      if (typeof partial.backgroundColor === "string") {
        targetNode.style.backgroundColor = partial.backgroundColor
      }
      if (typeof partial.textColor === "string") {
        targetNode.style.color = partial.textColor
      }
      if (typeof partial.paddingY === "number") {
        targetNode.style.paddingTop = `${Math.max(6, Math.min(40, partial.paddingY))}px`
        targetNode.style.paddingBottom = `${Math.max(6, Math.min(40, partial.paddingY))}px`
      }
      if (typeof partial.paddingX === "number") {
        targetNode.style.paddingLeft = `${Math.max(12, Math.min(80, partial.paddingX))}px`
        targetNode.style.paddingRight = `${Math.max(12, Math.min(80, partial.paddingX))}px`
      }
      if (typeof partial.fontSize === "number") {
        const safeFontSize = Math.max(10, Math.min(24, partial.fontSize))
        targetNode.style.fontSize = `${safeFontSize}px`
        targetNode.style.textTransform = safeFontSize <= 13 ? "uppercase" : "none"
        targetNode.style.letterSpacing = safeFontSize <= 13 ? "0.08em" : "0.02em"
      }
      if (typeof partial.textAlign === "string") {
        targetNode.style.textAlign = partial.textAlign
        targetNode.style.justifyContent = partial.textAlign === "left" ? "flex-start" : partial.textAlign === "right" ? "flex-end" : "center"
      }
      if (typeof partial.buttonAlign === "string") {
        if (partial.buttonAlign === "center") {
          targetNode.style.marginLeft = "auto"
          targetNode.style.marginRight = "auto"
        } else if (partial.buttonAlign === "right") {
          targetNode.style.marginLeft = "auto"
          targetNode.style.marginRight = "0"
        } else {
          targetNode.style.marginLeft = "0"
          targetNode.style.marginRight = "0"
        }
      }
      if (typeof partial.widthPercent === "number") {
        const safeWidth = Math.max(0, Math.min(100, partial.widthPercent))
        targetNode.style.width = safeWidth > 0 ? `${safeWidth}%` : "fit-content"
      }
      if (typeof partial.fullWidth === "boolean") {
        targetNode.style.width = partial.fullWidth ? "100%" : "fit-content"
      }
      if (typeof partial.openInNewTab === "boolean") {
        if (partial.openInNewTab) {
          targetNode.setAttribute("target", "_blank")
          targetNode.setAttribute("rel", "noopener noreferrer")
        } else {
          targetNode.removeAttribute("target")
          targetNode.removeAttribute("rel")
        }
      }

      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML } : block))
    },
    [selectedBlock, selectedRichNodeIndex, updateSelectedBlock],
  )

  const applyRichNodeTextStyleEdit = useCallback(
    (partial: { color?: string; backgroundColor?: string }) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex] as HTMLElement | undefined
      if (!targetNode) return

      if (typeof partial.color === "string") {
        targetNode.style.color = partial.color
      }
      if (typeof partial.backgroundColor === "string") {
        targetNode.style.backgroundColor = partial.backgroundColor
      }

      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML } : block))
    },
    [selectedBlock, selectedRichNodeIndex, updateSelectedBlock],
  )

  const removeSelectedRichNode = useCallback(() => {
    if (!selectedBlock || selectedBlock.type !== "rich_text") return false
    if (selectedRichNodeIndex === null) return false
    if (typeof window === "undefined" || typeof DOMParser === "undefined") return false

    let removed = false
    updateSelectedBlock((block) => {
      if (block.type !== "rich_text") return block
      const parser = new DOMParser()
      const parsed = parser.parseFromString(block.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex]
      if (!targetNode) return block
      targetNode.remove()
      if (!parsed.body.innerHTML.trim()) {
        parsed.body.innerHTML = "<p></p>"
      }
      removed = true
      return { ...block, content: parsed.body.innerHTML }
    })

    if (removed) {
      setSelectedRichNodeIndex(null)
      setPendingRichInsertPoint(null)
    }
    return removed
  }, [selectedBlock, selectedRichNodeIndex, updateSelectedBlock])

  const confirmDiscardChanges = useCallback(
    (nextActionLabel: string) => {
      if (!isDirty) return true
      return window.confirm(`Existem alterações não guardadas. Queres continuar para ${nextActionLabel}?`)
    },
    [isDirty],
  )

  const sanitizeRichTextContentForPersist = useCallback((html: string) => {
    if (typeof window === "undefined" || typeof DOMParser === "undefined") return html
    const parser = new DOMParser()
    const parsed = parser.parseFromString(html, "text/html")

    Array.from(parsed.body.querySelectorAll("[data-me-drop-slot]")).forEach((slot) => slot.remove())

    const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
    nodes.forEach((node) => {
      node.removeAttribute("data-me-node")

      const element = node as HTMLElement
      const styleValue = element.getAttribute("style")
      if (styleValue) {
        const cleaned = styleValue
          .replace(/outline\s*:[^;]*;?/gi, "")
          .replace(/outline-offset\s*:[^;]*;?/gi, "")
          .replace(/cursor\s*:[^;]*;?/gi, "")
          .replace(/;;+/g, ";")
          .trim()
          .replace(/^;|;$/g, "")
        if (cleaned) element.setAttribute("style", cleaned)
        else element.removeAttribute("style")
      }

      if (element.tagName.toLowerCase() === "a") {
        // Evita estrutura invalida dentro de links/botoes apos edicoes ricas.
        const safeText = element.textContent ?? ""
        element.textContent = safeText
      }
    })

    return parsed.body.innerHTML
  }, [])

  const sanitizeDocumentForPersist = useCallback(
    (document: SitePageBuilderDocument): SitePageBuilderDocument => {
      const sanitizeBlocks = (blocks: PageBlock[]): PageBlock[] =>
        blocks.map((block) => {
          if (block.type === "rich_text") {
            return {
              ...block,
              content: sanitizeRichTextContentForPersist(block.content),
            }
          }
          if (block.type !== "container") return block
          return {
            ...block,
            children: block.children.map((columnBlocks) => sanitizeBlocks(columnBlocks)),
          }
        })

      return {
        blocks: sanitizeBlocks(document.blocks),
      }
    },
    [sanitizeRichTextContentForPersist],
  )

  const createSnapshot = useCallback(() => {
    const sanitizedDocument = sanitizeDocumentForPersist(documentDraft)
    const html = renderDocumentToHtml(sanitizedDocument)
    const css = getDefaultStyleCss()
    return {
      projectData: {
        blocks: sanitizedDocument.blocks,
      },
      html,
      css,
    }
  }, [documentDraft, sanitizeDocumentForPersist])

  const handleSaveDraft = useCallback(
    async (trigger: "manual" | "autosave" = "manual") => {
      const isAutosave = trigger === "autosave"
      richTextRef.current?.flush()
      if (isAutosave) {
        setAutosaveStatus("saving")
      } else {
        setFeedback(null)
      }

      try {
        const snapshot = createSnapshot()
        const response = await saveDraftMutation.mutateAsync({
          slug: selectedSlug,
          title: detailQuery.data?.page.title ?? pageSummary?.title ?? getTitleForSlug(selectedSlug),
          layoutJson: {
            editor: "custom-block-builder",
            schema_version: 1,
            projectData: snapshot.projectData,
            html: snapshot.html,
          },
          styleJson: {
            css: snapshot.css,
          },
          metadata: {
            editor: "custom-block-builder",
            updated_at: new Date().toISOString(),
          },
        })

        loadedVersionRef.current = response.version.id
        setSelectedVersionId(response.version.id)
        setIsDirty(false)
        setAutosaveStatus("saved")
        setAutosaveSavedAt(new Date().toISOString())
        if (!isAutosave) {
          setFeedback({ tone: "success", message: "Rascunho guardado com sucesso." })
        }
        await detailQuery.refetch()
        await pagesQuery.refetch()
      } catch (error) {
        setAutosaveStatus("error")
        if (!isAutosave) {
          setFeedback({
            tone: "danger",
            message: error instanceof Error ? error.message : "Não foi possível guardar o rascunho.",
          })
        }
      }
    },
    [createSnapshot, detailQuery, pageSummary?.title, pagesQuery, saveDraftMutation, selectedSlug],
  )

  useEffect(() => {
    if (!detailQuery.data) return

    const isSameLoadedPage = loadedSlugRef.current === selectedSlug
    const preferredVersionId = isSameLoadedPage ? selectedVersionId || loadedVersionRef.current || null : null
    if (isSameLoadedPage && preferredVersionId && !versions.some((version) => version.id === preferredVersionId)) return
    const initialVersion = resolveInitialVersion(versions, publishedVersionId, preferredVersionId)
    const initialDoc = extractDocumentFromVersion(selectedSlug, initialVersion)
    const shouldReload = loadedSlugRef.current !== selectedSlug || loadedVersionRef.current !== (initialVersion?.id ?? "")

    if (!shouldReload) return

    loadedSlugRef.current = selectedSlug
    loadedVersionRef.current = initialVersion?.id ?? ""
    setSelectedVersionId(initialVersion?.id ?? "")
    setDocumentDraft(initialDoc)
    setSelectedBlockId("")
    setSelectedContainerColumnTarget(null)
    setPendingContainerInsertPoint(null)
    setIsLayoutCardVisible(false)
    setInlineEditingBlockId(null)
    setIsDirty(false)
    setAutosaveStatus("idle")
    setAutosaveSavedAt(null)
  }, [detailQuery.data, publishedVersionId, selectedSlug, selectedVersionId, versions])

  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    if (!autosaveEnabled || !isDirty || isSaving) return

    autosaveTimerRef.current = window.setTimeout(() => {
      void handleSaveDraft("autosave")
      autosaveTimerRef.current = null
    }, 4500)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [autosaveEnabled, handleSaveDraft, isDirty, isSaving])

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const navigationBlocker = useBlocker(isDirty)
  useEffect(() => {
    if (navigationBlocker.state !== "blocked") return
    if (window.confirm("Existem alterações não guardadas. Queres sair desta página mesmo assim?")) {
      navigationBlocker.proceed()
      return
    }
    navigationBlocker.reset()
  }, [navigationBlocker])

  const handleAddBlock = (type: PageBlockType) => {
    const shouldInsertInsideRichText = type !== "button"
    const nextBlock = createDefaultBlock(type)

    if (selectedContainerColumnTarget) {
      updateDocument((current) => {
        const next = appendBlockToContainerColumnInTree(
          current.blocks,
          selectedContainerColumnTarget.containerId,
          selectedContainerColumnTarget.columnIndex,
          nextBlock,
        )
        return next.inserted ? { blocks: next.blocks } : current
      })
      selectBlockSilently(nextBlock.id)
      setInlineEditingBlockId(nextBlock.id)
      setSelectedContainerColumnTarget(null)
      setPendingContainerInsertPoint(null)
      return
    }

    if (pendingRichInsertPoint) {
      const inserted = insertRichNodeAtIndex(
        pendingRichInsertPoint.blockId,
        pendingRichInsertPoint.insertIndex,
        getHtmlForBlockInsertion(nextBlock),
        pendingRichInsertPoint.insertAfterNodeIndex,
      )
      if (inserted) {
        setSelectedBlockId(pendingRichInsertPoint.blockId)
        setSelectedRichNodeIndex(Math.max(0, pendingRichInsertPoint.insertIndex))
      }
      setPendingRichInsertPoint(null)
      return
    }

    if (selectedBlock?.type === "rich_text" && selectedRichNodeIndex !== null && shouldInsertInsideRichText) {
      const inserted = insertRichNodeAtIndex(selectedBlock.id, selectedRichNodeIndex + 1, getHtmlForBlockInsertion(nextBlock))
      if (inserted) {
        setSelectedRichNodeIndex(selectedRichNodeIndex + 1)
        selectBlockSilently(selectedBlock.id)
        return
      }
    }

    if (!shouldInsertInsideRichText) {
      setSelectedRichNodeIndex(null)
    }

    if (type === "image" && replaceSelectedRichNodeWithImage()) {
      return
    }
    updateDocument((current) => {
      if (selectedBlockId) {
        const inserted = insertBlockAfterIdInTree(current.blocks, selectedBlockId, nextBlock)
        if (inserted.inserted) {
          return { blocks: inserted.blocks }
        }
      }
      return { blocks: [...current.blocks, nextBlock] }
    })
    selectBlockSilently(nextBlock.id)
  }

  const handleDuplicateBlock = useCallback(
    (blockId: string) => {
      let duplicatedBlockId = ""
      updateDocument((current) => {
        const source = findBlockByIdInTree(current.blocks, blockId)
        if (!source) return current
        const duplicated = duplicateBlockWithNewIds(source)
        duplicatedBlockId = duplicated.id
        const inserted = insertBlockAfterIdInTree(current.blocks, blockId, duplicated)
        if (inserted.inserted) {
          return { blocks: inserted.blocks }
        }
        return { blocks: [...current.blocks, duplicated] }
      })
      if (duplicatedBlockId) {
        setSelectedBlockId(duplicatedBlockId)
        setInlineEditingBlockId(duplicatedBlockId)
      }
      setSelectedRichNodeIndex(null)
      setSelectedContainerColumnTarget(null)
      setPendingContainerInsertPoint(null)
      setPendingRichInsertPoint(null)
    },
    [updateDocument],
  )

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      const block = findBlockByIdInTree(documentDraft.blocks, blockId)
      if (!block) return

      if (block.type === "rich_text" && selectedRichNodeIndex !== null) {
        if (!window.confirm("Queres mesmo excluir o elemento selecionado dentro desta seção?")) return
        removeSelectedRichNode()
        return
      }

      if (!window.confirm(`Queres mesmo excluir o bloco "${getBlockLabel(block)}"?`)) return

      updateDocument((current) => {
        const next = removeBlockByIdInTree(current.blocks, blockId)
        return next.removed ? { blocks: next.blocks } : current
      })
      setSelectedBlockId((current) => (current === blockId ? "" : current))
      setInlineEditingBlockId((current) => (current === blockId ? null : current))
      setSelectedRichNodeIndex(null)
      setSelectedContainerColumnTarget((current) => (current?.containerId === blockId ? null : current))
      setPendingContainerInsertPoint((current) => (current?.containerId === blockId ? null : current))
      setIsLayoutCardVisible(false)
    },
    [documentDraft.blocks, removeSelectedRichNode, selectedRichNodeIndex, updateDocument],
  )

  const handleEditStructureNode = useCallback(
    (node: EditorStructureNode) => {
      handleSelectStructureNode(node, { openInspector: true })
    },
    [handleSelectStructureNode],
  )

  const handleDuplicateStructureNode = useCallback(
    (node: EditorStructureNode) => {
      if (node.kind === "rich_node" && node.blockId && typeof node.richNodeIndex === "number") {
        duplicateRichNodeAtIndex(node.blockId, node.richNodeIndex)
        return
      }
      if (node.kind === "column" && node.containerId && typeof node.columnIndex === "number") {
        duplicateContainerColumnContent(node.containerId, node.columnIndex)
        return
      }
      if (node.blockId) {
        handleDuplicateBlock(node.blockId)
      }
    },
    [duplicateContainerColumnContent, duplicateRichNodeAtIndex, handleDuplicateBlock],
  )

  const handleDeleteStructureNode = useCallback(
    (node: EditorStructureNode) => {
      if (node.kind === "rich_node" && node.blockId && typeof node.richNodeIndex === "number") {
        if (!window.confirm("Queres mesmo excluir este elemento interno?")) return
        removeRichNodeAtIndex(node.blockId, node.richNodeIndex)
        return
      }
      if (node.kind === "column" && node.containerId && typeof node.columnIndex === "number") {
        if (!window.confirm(`Queres mesmo limpar todos os blocos da coluna ${node.columnIndex + 1}?`)) return
        clearContainerColumnContent(node.containerId, node.columnIndex)
        return
      }
      if (node.blockId) {
        handleRemoveBlock(node.blockId)
      }
    },
    [clearContainerColumnContent, handleRemoveBlock, removeRichNodeAtIndex],
  )

  useEffect(() => {
    if (selectedBlock?.type !== "rich_text") {
      setSelectedRichNodeIndex(null)
      setPendingRichInsertPoint(null)
    }
  }, [selectedBlock])

  useEffect(() => {
    if (!pendingRichInsertPoint) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingRichInsertPoint(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pendingRichInsertPoint])

  const insertBlockAtIndex = useCallback(
    (type: PageBlockType, rawIndex: number) => {
      const block = createDefaultBlock(type)
      updateDocument((current) => {
        const nextBlocks = [...current.blocks]
        const index = Math.max(0, Math.min(rawIndex, nextBlocks.length))
        nextBlocks.splice(index, 0, block)
        return { blocks: nextBlocks }
      })
      selectBlockSilently(block.id)
      setInlineEditingBlockId(block.id)
    },
    [selectBlockSilently, updateDocument],
  )

  const handlePublish = async () => {
    setFeedback(null)
    try {
      richTextRef.current?.flush()

      let versionIdToPublish = selectedVersionId
      if (isDirty || !versionIdToPublish) {
        const snapshot = createSnapshot()
        const draftResponse = await saveDraftMutation.mutateAsync({
          slug: selectedSlug,
          title: detailQuery.data?.page.title ?? pageSummary?.title ?? getTitleForSlug(selectedSlug),
          layoutJson: {
            editor: "custom-block-builder",
            schema_version: 1,
            projectData: snapshot.projectData,
            html: snapshot.html,
          },
          styleJson: {
            css: snapshot.css,
          },
          metadata: {
            editor: "custom-block-builder",
            updated_at: new Date().toISOString(),
          },
        })

        loadedVersionRef.current = draftResponse.version.id
        setSelectedVersionId(draftResponse.version.id)
        versionIdToPublish = draftResponse.version.id
        setIsDirty(false)
        setAutosaveStatus("saved")
        setAutosaveSavedAt(new Date().toISOString())
      }

      if (!versionIdToPublish) {
        setFeedback({ tone: "danger", message: "Seleciona uma versão para publicar." })
        return
      }

      await publishMutation.mutateAsync({
        slug: selectedSlug,
        versionId: versionIdToPublish,
      })
      setFeedback({ tone: "success", message: "Página publicada com sucesso." })
      setIsDirty(false)
      await detailQuery.refetch()
      await pagesQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível publicar esta versão.",
      })
    }
  }

  const handleUnpublish = async () => {
    if (!publishedVersionId) {
      setFeedback({ tone: "danger", message: "Esta página ainda não esta publicada." })
      return
    }
    if (!window.confirm("Queres mesmo despublicar esta página?")) return
    setFeedback(null)
    try {
      await unpublishMutation.mutateAsync({ slug: selectedSlug })
      setFeedback({ tone: "success", message: "Página despublicada com sucesso." })
      await detailQuery.refetch()
      await pagesQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível despublicar.",
      })
    }
  }

  const handleRollback = async () => {
    if (!selectedVersionId) {
      setFeedback({ tone: "danger", message: "Seleciona uma versão para rollback." })
      return
    }
    setFeedback(null)
    try {
      await rollbackMutation.mutateAsync({
        slug: selectedSlug,
        versionId: selectedVersionId,
      })
      setFeedback({ tone: "success", message: "Rollback aplicado com sucesso." })
      await detailQuery.refetch()
      await pagesQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível aplicar rollback.",
      })
    }
  }

  const handleLoadVersion = (version: AdminSitePageVersion) => {
    if (!confirmDiscardChanges(`carregar a versão ${version.version_number}`)) return
    const nextDoc = extractDocumentFromVersion(selectedSlug, version)
    loadedVersionRef.current = version.id
    setSelectedVersionId(version.id)
    setDocumentDraft(nextDoc)
    setSelectedBlockId("")
    setSelectedContainerColumnTarget(null)
    setPendingContainerInsertPoint(null)
    setIsLayoutCardVisible(false)
    setInlineEditingBlockId(null)
    setIsDirty(false)
    setAutosaveStatus("idle")
    setAutosaveSavedAt(null)
    setFeedback({ tone: "success", message: `Versão ${version.version_number} carregada no editor.` })
  }

  const handlePreview = () => {
    const publicPath = getPublicPathForSlug(selectedSlug)
    const snapshot = createSnapshot()
    const token = storeSitePagePreview({
      slug: selectedSlug,
      html: snapshot.html,
      css: snapshot.css,
    })
    const targetUrl = token ? createSitePagePreviewUrl(publicPath, token) : publicPath
    setLivePreviewUrl(targetUrl)
    window.open(targetUrl, "_blank", "noopener,noreferrer")
  }

  const handleUploadAsset = async (file: File) => {
    setUploadingAsset(true)
    setFeedback(null)
    try {
      await uploadAssetMutation.mutateAsync({ slug: selectedSlug, file })
      setFeedback({ tone: "success", message: "Imagem enviada com sucesso." })
      await detailQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
      })
    } finally {
      setUploadingAsset(false)
    }
  }

  const handleInsertImage = (asset: AdminSitePageAsset) => {
    if (selectedBlock?.type === "image") {
      updateSelectedBlock((block) => {
        if (block.type !== "image") return block
        return {
          ...block,
          src: asset.public_url,
          alt: asset.file_name,
        }
      })
      return
    }

    const newImage = createDefaultBlock("image")
    if (newImage.type !== "image") return
    newImage.src = asset.public_url
    newImage.alt = asset.file_name
    updateDocument((current) => ({
      blocks: [...current.blocks, newImage],
    }))
    selectBlockSilently(newImage.id)
  }

  const handleApplyAssetToSelectedImageContext = (asset: AdminSitePageAsset) => {
    if (selectedBlock?.type === "image") {
      handleInsertImage(asset)
      return
    }

    if (selectedBlock?.type === "rich_text" && selectedRichNodeDescriptor?.isImage) {
      applyRichNodeImageEdit({
        src: asset.public_url,
        alt: asset.file_name,
      })
    }
  }

  const handleInspectorImageUpload = async (file: File) => {
    setUploadingInspectorAsset(true)
    try {
      setFeedback(null)
      const uploaded = await uploadAssetMutation.mutateAsync({ slug: selectedSlug, file })
      setFeedback({ tone: "success", message: "Imagem enviada com sucesso." })
      await detailQuery.refetch()

      const uploadedAsset = uploaded.asset
      if (uploadedAsset) {
        handleApplyAssetToSelectedImageContext(uploadedAsset)
      }
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
      })
    } finally {
      setUploadingInspectorAsset(false)
    }
  }

  const startDragFromLibrary = (blockType: PageBlockType, event: DragEvent<HTMLElement>) => {
    dragPayloadRef.current = { kind: "library", blockType }
    setIsDraggingCanvasBlock(true)
    event.dataTransfer.effectAllowed = "copyMove"
    event.dataTransfer.setData("text/plain", `library:${blockType}`)
  }

  const startDragBlock = (blockId: string, event: DragEvent<HTMLElement>) => {
    dragPayloadRef.current = { kind: "block", blockId }
    setIsDraggingCanvasBlock(true)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", `block:${blockId}`)
    selectBlockSilently(blockId)
  }

  const startDragRichNode = (blockId: string, richNodeIndex: number, event: DragEvent<HTMLElement>) => {
    dragPayloadRef.current = { kind: "rich_node", blockId, richNodeIndex }
    setIsDraggingCanvasBlock(true)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", `rich-node:${blockId}:${richNodeIndex}`)
    setSelectedBlockId(blockId)
    setSelectedRichNodeIndex(richNodeIndex)
    setSidebarTab("inspector")
    setIsLayoutCardVisible(true)
  }

  const clearDragState = useCallback(() => {
    dragPayloadRef.current = null
    setIsDraggingCanvasBlock(false)
    setDragOverIndex(null)
  }, [])

  useEffect(() => {
    if (!isDraggingCanvasBlock) return
    const stopDragging = () => clearDragState()
    window.addEventListener("dragend", stopDragging)
    window.addEventListener("drop", stopDragging)
    window.addEventListener("mouseup", stopDragging)
    return () => {
      window.removeEventListener("dragend", stopDragging)
      window.removeEventListener("drop", stopDragging)
      window.removeEventListener("mouseup", stopDragging)
    }
  }, [clearDragState, isDraggingCanvasBlock])

  const handleDropAtIndex = useCallback(
    (rawIndex: number, event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      const payload = dragPayloadRef.current
      clearDragState()
      if (!payload) return

      if (payload.kind === "library") {
        insertBlockAtIndex(payload.blockType, rawIndex)
        return
      }

      if (payload.kind === "rich_node") {
        return
      }

      updateDocument((current) => {
        const movedBlock = findBlockByIdInTree(current.blocks, payload.blockId)
        if (!movedBlock) return current

        const sourcePlacement = findBlockPlacement(current.blocks, payload.blockId)
        const removed = removeBlockByIdInTree(current.blocks, payload.blockId)
        if (!removed.removed) return current

        const targetIndex = Math.max(0, Math.min(rawIndex, current.blocks.length))
        const normalizedTarget =
          sourcePlacement?.parentKind === "root" && sourcePlacement.index < targetIndex ? targetIndex - 1 : targetIndex
        const nextBlocks = [...removed.blocks]
        nextBlocks.splice(normalizedTarget, 0, movedBlock)
        return { blocks: nextBlocks }
      })
      selectBlockSilently(payload.blockId)
    },
    [clearDragState, insertBlockAtIndex, selectBlockSilently, updateDocument],
  )

  const handleDropIntoRichText = useCallback(
    (blockId: string, insertIndex: number, event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      const payload = dragPayloadRef.current
      clearDragState()
      if (!payload) return

      if (payload.kind === "library") {
        const nextBlock = createDefaultBlock(payload.blockType)
        const inserted = insertRichNodeAtIndex(blockId, insertIndex, getHtmlForBlockInsertion(nextBlock))
        if (inserted) selectBlockSilently(blockId)
        return
      }

       if (payload.kind === "rich_node") {
        moveRichNodeToIndex(payload.blockId, payload.richNodeIndex, blockId, insertIndex)
        return
      }

      let movedBlock: PageBlock | null = null
      updateDocument((current) => {
        movedBlock = findBlockByIdInTree(current.blocks, payload.blockId)
        if (!movedBlock) return current

        const removed = removeBlockByIdInTree(current.blocks, payload.blockId)
        if (!removed.removed) return current

        const nextBlocks = removed.blocks
          .map((block) => {
            if (block.id !== blockId || block.type !== "rich_text") return block
            const parser = new DOMParser()
            const parsed = parser.parseFromString(block.content, "text/html")
            const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
            const nextNodeDoc = parser.parseFromString(getHtmlForBlockInsertion(movedBlock as PageBlock), "text/html")
            const replacement = nextNodeDoc.body.firstElementChild
            if (!replacement) return block
            if (insertIndex >= nodes.length) {
              parsed.body.appendChild(replacement)
            } else {
              nodes[insertIndex].parentNode?.insertBefore(replacement, nodes[insertIndex])
            }
            return { ...block, content: parsed.body.innerHTML }
          })

        return { blocks: nextBlocks }
      })
      selectBlockSilently(blockId)
    },
    [clearDragState, insertRichNodeAtIndex, moveRichNodeToIndex, selectBlockSilently, updateDocument],
  )

  const handleDropIntoContainerColumn = useCallback(
    (containerId: string, columnIndex: number, event: DragEvent<HTMLElement>, rawInsertIndex?: number) => {
      event.preventDefault()
      event.stopPropagation()
      const payload = dragPayloadRef.current
      clearDragState()
      if (!payload) return

      if (payload.kind === "library") {
        const nextBlock = createDefaultBlock(payload.blockType)
        updateDocument((current) => {
          const inserted = insertBlockIntoContainerColumnInTree(current.blocks, containerId, columnIndex, nextBlock, rawInsertIndex)
          return inserted.inserted ? { blocks: inserted.blocks } : current
        })
        selectBlockSilently(nextBlock.id)
        return
      }

      if (payload.kind === "rich_node") {
        return
      }

      let movedBlockId = ""
      updateDocument((current) => {
        const movedBlock = findBlockByIdInTree(current.blocks, payload.blockId)
        if (!movedBlock) return current
        movedBlockId = movedBlock.id
        if (movedBlock.id === containerId) return current

        const sourcePlacement = findBlockPlacement(current.blocks, payload.blockId)
        const removed = removeBlockByIdInTree(current.blocks, payload.blockId)
        if (!removed.removed) return current

        const normalizedInsertIndex =
          sourcePlacement?.parentKind === "container" &&
          sourcePlacement.containerId === containerId &&
          sourcePlacement.columnIndex === columnIndex &&
          typeof rawInsertIndex === "number" &&
          sourcePlacement.index < rawInsertIndex
            ? rawInsertIndex - 1
            : rawInsertIndex

        const inserted = insertBlockIntoContainerColumnInTree(
          removed.blocks,
          containerId,
          columnIndex,
          movedBlock,
          normalizedInsertIndex,
        )
        return inserted.inserted ? { blocks: inserted.blocks } : current
      })
      if (movedBlockId) {
        selectBlockSilently(movedBlockId)
      }
    },
    [clearDragState, selectBlockSilently, updateDocument],
  )

  const onDropZoneDragOver = (index: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (dragPayloadRef.current?.kind === "rich_node") {
      event.dataTransfer.dropEffect = "none"
      return
    }
    setDragOverIndex(index)
    event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
  }

  const handleOpenPendingPage = () => {
    if (!hasPendingPageSelection) return
    if (!confirmDiscardChanges(`abrir a página ${getTitleForSlug(pendingSelectedSlug)}`)) {
      return
    }
    setFeedback(null)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set("slug", pendingSelectedSlug)
    setSearchParams(nextSearchParams, { replace: true })
    setPageOpenRequestSlug(pendingSelectedSlug)
    setSelectedSlug(pendingSelectedSlug)
  }

  const handleInlineTextCommit = (blockId: string, event: FocusEvent<HTMLElement>) => {
    const nextValue = event.currentTarget.innerText.trim()
    updateDocument((current) => ({
      blocks: current.blocks.map((item) => {
        if (item.id !== blockId || item.type !== "heading") return item
        return {
          ...item,
          content: nextValue || "Título",
        }
      }),
    }))
    setInlineEditingBlockId(null)
  }

  if (pagesQuery.isLoading && !pagesQuery.data) {
    return <LoadingState message="A carregar editor visual..." />
  }

  if (pagesQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as páginas"
        message={pagesQuery.error instanceof Error ? pagesQuery.error.message : "Tenta novamente em instantes."}
        onRetry={() => void pagesQuery.refetch()}
      />
    )
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar a página selecionada"
        message={detailQuery.error instanceof Error ? detailQuery.error.message : "Tenta novamente em instantes."}
        onRetry={() => void detailQuery.refetch()}
      />
    )
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-110px)] flex-col gap-3">
      <PageHeader
        title="Editor Visual de Páginas"
        backTo={ROUTES.ADMIN}
        actions={
          <Button asChild type="button" variant="outline" className="rounded-full border-slate-300 bg-white shadow-sm">
            <Link to={ROUTES.ADMIN}>Voltar ao dashboard</Link>
          </Button>
        }
      />

      <div className="sticky top-0 z-40 -mx-1 space-y-2 bg-slate-50/95 px-1 pb-2 pt-1 backdrop-blur">
      <section className="rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-sm backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Página</span>
            <select
              value={pendingSelectedSlug}
              onChange={(event) => {
                const nextSlug = event.target.value as SitePageSlug
                setPendingSelectedSlug(nextSlug)
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400"
            >
              {PAGE_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={handleOpenPendingPage}
                disabled={!hasPendingPageSelection || isPageSelectionLoading}
              >
                {isPageSelectionLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                {isPageSelectionLoading ? "A carregar..." : "Abrir página"}
              </Button>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold">{autosaveLabel}</span>
            {publishedVersionId ? (
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                Publicada
              </span>
            ) : (
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
                Sem publicacao ativa
              </span>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <ActionHint hint="Guarda um novo rascunho da página sem publicar.">
              <Button type="button" className="rounded-full" onClick={() => void handleSaveDraft("manual")} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {saveDraftMutation.isPending ? "A guardar..." : "Guardar"}
              </Button>
            </ActionHint>
            <ActionHint hint="Pública a versão atual para o site público.">
              <Button type="button" className="rounded-full" onClick={() => void handlePublish()} disabled={isSaving || !selectedVersionId}>
                <Send className="mr-2 h-4 w-4" />
                {publishMutation.isPending ? "A publicar..." : "Publicar"}
              </Button>
            </ActionHint>
            <ActionHint hint="Abre uma pré-visualização da página com o estado atual do editor.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => handlePreview()} disabled={isSaving}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </ActionHint>
            <div className="relative" ref={moreActionsMenuRef}>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setIsMoreActionsMenuOpen((state) => !state)}
                aria-expanded={isMoreActionsMenuOpen}
                aria-haspopup="menu"
              >
                Mais ações
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>

              {isMoreActionsMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="menu">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void handleRollback()
                      setIsMoreActionsMenuOpen(false)
                    }}
                    disabled={isSaving || !selectedVersionId}
                  >
                    <FileClock className="h-4 w-4" />
                    Rollback
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void handleUnpublish()
                      setIsMoreActionsMenuOpen(false)
                    }}
                    disabled={isSaving || !publishedVersionId}
                  >
                    <XCircle className="h-4 w-4" />
                    Despublicar
                  </button>
                  <div className="my-1 h-px bg-slate-200" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
                    onClick={() => setAutosaveEnabled((current) => !current)}
                  >
                    <span>Autosave</span>
                    <span className="text-xs font-semibold text-slate-500">{autosaveEnabled ? "ligado" : "desligado"}</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
                    onClick={() => setShowLayoutGuides((current) => !current)}
                  >
                    <span>Guias</span>
                    <span className="text-xs font-semibold text-slate-500">{showLayoutGuides ? "on" : "off"}</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
                    onClick={() => setSnapSpacingToGrid((current) => !current)}
                  >
                    <span>Snap 4px</span>
                    <span className="text-xs font-semibold text-slate-500">{snapSpacingToGrid ? "on" : "off"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={[
              "mt-2 rounded-xl border px-3 py-2 text-sm font-medium",
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      </div>

      <section className="flex min-h-0 flex-1 items-start gap-3">
        <article className="min-h-0 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Canvas visual</p>
              <p className="text-xs text-slate-500">Clica para editar seções e elementos internos, e arrasta para reorganizar no canvas.</p>
            </div>
            {livePreviewUrl ? (
              <a href={livePreviewUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 underline">
                Último preview
              </a>
            ) : null}
          </div>

          <div className="relative min-h-[calc(100dvh-220px)] overflow-x-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <style>{canvasPreviewCss}</style>
            {showLayoutGuides ? (
              <div className="pointer-events-none absolute inset-4 z-0">
                <div className="absolute inset-y-0 left-0 w-px bg-sky-200/60" />
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sky-300/70" />
                <div className="absolute inset-y-0 right-0 w-px bg-sky-200/60" />
              </div>
            ) : null}

            <div
              onDragOver={(event) => onDropZoneDragOver(0, event)}
              onDrop={(event) => handleDropAtIndex(0, event)}
              className={[
                "relative z-10 mb-2 flex items-center justify-center rounded-xl border border-dashed text-[11px] font-bold uppercase tracking-[0.14em] transition",
                isDraggingBlockLike ? "h-10 opacity-100" : "h-3 opacity-70",
                dragOverIndex === 0 ? "border-sky-500 bg-sky-100 text-sky-900" : "border-slate-300 bg-transparent text-slate-400",
              ].join(" ")}
            >
              {isDraggingBlockLike ? "Solta aqui" : null}
            </div>

            {documentDraft.blocks.length === 0 ? (
              <div
                onDragOver={(event) => onDropZoneDragOver(0, event)}
                onDrop={(event) => handleDropAtIndex(0, event)}
                className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600"
              >
                Arrasta blocos da esquerda para montar a página.
              </div>
            ) : (
              <div className="relative z-10 space-y-2">
                {documentDraft.blocks.map((block, index) => {
                  const isSelected = selectedBlockId === block.id
                  const isInlineEditing = inlineEditingBlockId === block.id
                  return (
                    <div key={block.id}>
                      <section
                        onClickCapture={(event) => {
                          const target = event.target as HTMLElement | null
                          const anchor = target?.closest?.("a") as HTMLAnchorElement | null
                          if (!anchor) return
                          event.preventDefault()
                          event.stopPropagation()
                          if (block.type === "rich_text" && richSelectionMode) {
                            const richTextRoot = event.currentTarget.querySelector(".rich-text-editor") as HTMLElement | null
                            const nextIndex = resolveRichNodeIndexFromTarget(target, richTextRoot)
                            if (nextIndex !== null) {
                              selectRichNodeForEdit(block.id, nextIndex)
                              return
                            }
                          }
                          selectBlockForEdit(block.id)
                        }}
                        onClick={() => {
                          selectBlockForEdit(block.id)
                        }}
                        onDoubleClick={() => {
                          selectBlockForEdit(block.id)
                          if (canInlineEdit(block)) {
                            setInlineEditingBlockId(block.id)
                          }
                        }}
                        className={[
                          "group relative rounded-xl border bg-white text-left transition",
                          isSelected ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200 hover:border-slate-300",
                        ].join(" ")}
                        style={getBlockContainerStyle(block.layout)}
                      >
                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              selectBlockForEdit(block.id)
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                            aria-label={`Editar bloco ${index + 1}`}
                            title="Editar bloco"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              handleDuplicateBlock(block.id)
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                            aria-label={`Duplicar bloco ${index + 1}`}
                            title="Duplicar bloco"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              handleRemoveBlock(block.id)
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50"
                            aria-label={`Excluir bloco ${index + 1}`}
                            title="Excluir bloco"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => startDragBlock(block.id, event)}
                            onDragEnd={clearDragState}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              selectBlockForEdit(block.id)
                            }}
                            className="inline-flex h-6 cursor-grab items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition active:cursor-grabbing"
                            aria-label={`Arrastar bloco ${index + 1}`}
                            title="Arrastar bloco"
                          >
                            <GripVertical className="mr-1 h-3 w-3" /> arrastar
                          </button>
                        </div>

                        {block.type === "heading" ? (
                          block.level === 1 ? (
                            <h1
                              contentEditable={isInlineEditing}
                              suppressContentEditableWarning
                              onBlur={(event) => handleInlineTextCommit(block.id, event)}
                              className={isInlineEditing ? "outline-none ring-2 ring-sky-200" : "outline-none"}
                              style={{ color: block.color, textAlign: block.align, fontSize: "2.4rem", fontWeight: 800, lineHeight: 1.08 }}
                            >
                              {block.content}
                            </h1>
                          ) : block.level === 2 ? (
                            <h2
                              contentEditable={isInlineEditing}
                              suppressContentEditableWarning
                              onBlur={(event) => handleInlineTextCommit(block.id, event)}
                              className={isInlineEditing ? "outline-none ring-2 ring-sky-200" : "outline-none"}
                              style={{ color: block.color, textAlign: block.align, fontSize: "2rem", fontWeight: 800, lineHeight: 1.1 }}
                            >
                              {block.content}
                            </h2>
                          ) : block.level === 3 ? (
                            <h3
                              contentEditable={isInlineEditing}
                              suppressContentEditableWarning
                              onBlur={(event) => handleInlineTextCommit(block.id, event)}
                              className={isInlineEditing ? "outline-none ring-2 ring-sky-200" : "outline-none"}
                              style={{ color: block.color, textAlign: block.align, fontSize: "1.5rem", fontWeight: 800, lineHeight: 1.1 }}
                            >
                              {block.content}
                            </h3>
                          ) : (
                            <h4
                              contentEditable={isInlineEditing}
                              suppressContentEditableWarning
                              onBlur={(event) => handleInlineTextCommit(block.id, event)}
                              className={isInlineEditing ? "outline-none ring-2 ring-sky-200" : "outline-none"}
                              style={{ color: block.color, textAlign: block.align, fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.15 }}
                            >
                              {block.content}
                            </h4>
                          )
                        ) : null}

                        {block.type === "rich_text" ? (
                          <div className="space-y-2">
                            <div
                              className="rich-text-editor min-h-[70px] max-w-full overflow-hidden [&_*]:max-w-full [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                              onDragStart={(event) => {
                                const target = event.target as HTMLElement | null
                                const richNode = target?.closest?.("[data-me-node]") as HTMLElement | null
                                if (!richNode) return
                                const nextIndex = Number(richNode.getAttribute("data-me-node") ?? "-1")
                                if (!Number.isFinite(nextIndex) || nextIndex < 0) return
                                event.stopPropagation()
                                startDragRichNode(block.id, nextIndex, event)
                              }}
                              onDragEnd={clearDragState}
                              onClick={(event) => {
                                event.stopPropagation()
                                const target = event.target as HTMLElement | null
                                const richTextRoot = event.currentTarget
                                const dropSlot = target?.closest?.("[data-me-drop-slot]") as HTMLElement | null
                                if (dropSlot) {
                                  selectBlockForEdit(block.id)
                                  const insertIndex = Number(dropSlot.getAttribute("data-me-drop-slot") ?? "-1")
                                  const insertAfterNodeIndex = Number(dropSlot.getAttribute("data-me-drop-after") ?? "-1")
                                  if (Number.isFinite(insertIndex) && insertIndex >= 0) {
                                    setPendingRichInsertPoint({
                                      blockId: block.id,
                                      insertIndex,
                                      insertAfterNodeIndex:
                                        Number.isFinite(insertAfterNodeIndex) && insertAfterNodeIndex >= 0
                                          ? insertAfterNodeIndex
                                          : undefined,
                                    })
                                  }
                                  return
                                }
                                const nextIndex = resolveRichNodeIndexFromTarget(target, richTextRoot)
                                if (nextIndex === null) {
                                  selectBlockForEdit(block.id)
                                  return
                                }
                                selectRichNodeForEdit(block.id, nextIndex)
                              }}
                              onDoubleClick={(event) => {
                                event.stopPropagation()
                                const target = event.target as HTMLElement | null
                                const nextIndex = resolveRichNodeIndexFromTarget(target, event.currentTarget)
                                if (nextIndex === null) {
                                  selectBlockForEdit(block.id)
                                  return
                                }
                                selectRichNodeForEdit(block.id, nextIndex)
                              }}
                              onDragOver={(event) => {
                                if (selectedBlockId !== block.id) {
                                  selectBlockSilently(block.id)
                                }
                                event.preventDefault()
                                event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"

                                const target = event.target as HTMLElement | null
                                const richNode = target?.closest?.("[data-me-node]") as HTMLElement | null
                                const dropSlot = target?.closest?.("[data-me-drop-slot]") as HTMLElement | null
                                if (richNode) {
                                  const nextIndex = Number(richNode.getAttribute("data-me-node") ?? "-1")
                                  if (Number.isFinite(nextIndex) && nextIndex >= 0) {
                                    if (selectedRichNodeIndex !== nextIndex) {
                                      setSelectedRichNodeIndex(nextIndex)
                                    }
                                    return
                                  }
                                }
                                if (!dropSlot) return
                              }}
                              onDrop={(event) => {
                                const target = event.target as HTMLElement | null
                                const richNode = target?.closest?.("[data-me-node]") as HTMLElement | null
                                const dropSlot = target?.closest?.("[data-me-drop-slot]") as HTMLElement | null
                                if (richNode) {
                                  const nextIndex = Number(richNode.getAttribute("data-me-node") ?? "-1")
                                  if (Number.isFinite(nextIndex) && nextIndex >= 0) {
                                    handleDropIntoRichText(block.id, nextIndex + 1, event)
                                    return
                                  }
                                }
                                if (dropSlot) {
                                  const insertIndex = Number(dropSlot.getAttribute("data-me-drop-slot") ?? "-1")
                                  if (!Number.isFinite(insertIndex) || insertIndex < 0) return
                                  handleDropIntoRichText(block.id, insertIndex, event)
                                  return
                                }
                                handleDropIntoRichText(block.id, getEditableRichNodesFromHtml(block.content).length, event)
                              }}
                              dangerouslySetInnerHTML={{
                                __html:
                                  isSelected && richSelectionMode
                                    ? annotateRichTextNodes(
                                        block.content,
                                        selectedRichNodeIndex,
                                        isDraggingCanvasBlock || pendingRichInsertPoint?.blockId === block.id,
                                      )
                                    : block.content,
                              }}
                            />
                            {pendingRichInsertPoint?.blockId === block.id ? (
                              <p className="text-xs font-semibold text-sky-700">Ponto de insercao selecionado.</p>
                            ) : null}
                          </div>
                        ) : null}

                        {block.type === "image" ? (
                          block.src ? (
                            <img src={block.src} alt={block.alt} className="h-auto w-full object-cover" style={{ borderRadius: `${block.radius}px` }} />
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-100 p-8 text-center text-sm text-slate-500">
                              Bloco de imagem sem URL
                            </div>
                          )
                        ) : null}

                        {block.type === "button" ? (
                          <div style={{ textAlign: block.align }}>
                            <button
                              type="button"
                              contentEditable={isInlineEditing}
                              suppressContentEditableWarning
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                setSelectedBlockId(block.id)
                              }}
                              onBlur={(event) => {
                                const value = event.currentTarget.innerText.trim()
                                updateDocument((current) => ({
                                  blocks: current.blocks.map((item) => {
                                    if (item.id !== block.id || item.type !== "button") return item
                                    return {
                                      ...item,
                                      label: value || "Call to action",
                                    }
                                  }),
                                }))
                                setInlineEditingBlockId(null)
                              }}
                              className={[
                                "cursor-pointer font-black outline-none",
                                "inline-flex",
                                isInlineEditing ? "ring-2 ring-sky-200" : "",
                              ].join(" ")}
                              style={{
                                width: block.fullWidth ? "100%" : block.widthPercent > 0 ? `${block.widthPercent}%` : "auto",
                                borderStyle: "solid",
                                borderWidth: `${block.borderWidth}px`,
                                borderColor: block.borderColor,
                                borderRadius: `${block.borderRadius}px`,
                                background: block.backgroundColor,
                                color: block.textColor,
                                padding: `${block.paddingY}px ${block.paddingX}px`,
                                fontSize: `${block.fontSize}px`,
                                textAlign: block.textAlign,
                                justifyContent: block.textAlign === "left" ? "flex-start" : block.textAlign === "right" ? "flex-end" : "center",
                                textTransform: block.fontSize <= 13 ? "uppercase" : "none",
                                letterSpacing: block.fontSize <= 13 ? "0.08em" : "0.02em",
                              }}
                            >
                              {block.label}
                            </button>
                          </div>
                        ) : null}

                        {block.type === "container" ? (
                          <section
                            style={{
                              display: "grid",
                              gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))`,
                              columnGap: `${block.gap}px`,
                              rowGap: `${block.rowGap}px`,
                              alignItems: block.alignItems,
                              justifyItems: block.justifyItems,
                              background: block.backgroundColor,
                              borderStyle: "solid",
                              borderColor: block.borderColor,
                              borderWidth: `${block.borderWidth}px`,
                              borderRadius: `${block.borderRadius}px`,
                              padding: `${block.paddingY}px ${block.paddingX}px`,
                            }}
                          >
                            {block.children.slice(0, block.columns).map((columnBlocks, columnIndex) => (
                              <article
                                key={`${block.id}-container-col-${columnIndex}`}
                                className={[
                                  "rounded-xl border bg-white/80 p-3",
                                  selectedContainerColumnTarget?.containerId === block.id &&
                                  selectedContainerColumnTarget.columnIndex === columnIndex
                                    ? "border-sky-300 ring-2 ring-sky-100"
                                    : "border-slate-200/60",
                                ].join(" ")}
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  setSelectedContainerColumnTarget({ containerId: block.id, columnIndex })
                                  setSelectedBlockId(block.id)
                                  setSidebarTab("inspector")
                                }}
                                onDragOver={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  if (dragPayloadRef.current?.kind === "rich_node") {
                                    event.dataTransfer.dropEffect = "none"
                                    return
                                  }
                                  event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
                                }}
                                onDrop={(event) => handleDropIntoContainerColumn(block.id, columnIndex, event)}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Coluna {columnIndex + 1}</p>
                                  <button
                                    type="button"
                                    className={[
                                      "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition",
                                      selectedContainerColumnTarget?.containerId === block.id &&
                                      selectedContainerColumnTarget.columnIndex === columnIndex
                                        ? "border-sky-300 bg-sky-50 text-sky-900"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300",
                                    ].join(" ")}
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      setSelectedContainerColumnTarget({ containerId: block.id, columnIndex })
                                      setPendingContainerInsertPoint({ containerId: block.id, columnIndex })
                                      setSidebarTab("blocks")
                                      setSelectedBlockId(block.id)
                                    }}
                                  >
                                    Inserir aqui
                                  </button>
                                </div>

                                {columnBlocks.length === 0 ? (
                                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-xs text-slate-500">
                                    Coluna vazia.
                                  </p>
                                ) : (
                                  <div
                                    className="space-y-2"
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: mapHorizontalAlignToFlex(block.columnContentAlignX),
                                      justifyContent: mapVerticalAlignToFlex(block.columnContentAlignY),
                                      gap: `${block.columnContentGap}px`,
                                      minHeight: "100%",
                                    }}
                                  >
                                    {columnBlocks.map((childBlock, childIndex) => {
                                      const isChildSelected = selectedBlockId === childBlock.id
                                      return (
                                        <div key={childBlock.id} className="space-y-2">
                                          <div
                                            onDragOver={(event) => {
                                              event.preventDefault()
                                              event.stopPropagation()
                                              if (dragPayloadRef.current?.kind === "rich_node") {
                                                event.dataTransfer.dropEffect = "none"
                                                return
                                              }
                                              event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
                                            }}
                                            onDrop={(event) => handleDropIntoContainerColumn(block.id, columnIndex, event, childIndex)}
                                            className={[
                                              "flex items-center justify-center rounded-xl border border-dashed text-[10px] font-bold uppercase tracking-[0.14em] transition",
                                              isDraggingBlockLike ? "h-8 opacity-100" : "h-2 opacity-60",
                                              "border-slate-300 bg-transparent text-slate-400",
                                            ].join(" ")}
                                          >
                                            {isDraggingBlockLike ? "Solta aqui" : null}
                                          </div>
                                          <button
                                            type="button"
                                            draggable
                                            className={[
                                              "w-full cursor-grab rounded-lg border bg-white p-2 text-left transition active:cursor-grabbing",
                                              isChildSelected ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200 hover:border-sky-300",
                                            ].join(" ")}
                                            onDragStart={(event) => {
                                              event.stopPropagation()
                                              startDragBlock(childBlock.id, event)
                                            }}
                                            onDragEnd={clearDragState}
                                            onClick={(event) => {
                                              event.preventDefault()
                                              event.stopPropagation()
                                              selectBlockForEdit(childBlock.id)
                                            }}
                                          >
                                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{getBlockLabel(childBlock)}</p>
                                            <div
                                              className="pointer-events-none overflow-hidden rounded-md border border-slate-100 bg-white p-2 text-xs text-slate-700"
                                              dangerouslySetInnerHTML={{ __html: getHtmlForBlockInsertion(childBlock) }}
                                            />
                                          </button>
                                        </div>
                                      )
                                    })}
                                    <div
                                      onDragOver={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        if (dragPayloadRef.current?.kind === "rich_node") {
                                          event.dataTransfer.dropEffect = "none"
                                          return
                                        }
                                        event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
                                      }}
                                      onDrop={(event) => handleDropIntoContainerColumn(block.id, columnIndex, event, columnBlocks.length)}
                                      className={[
                                        "flex items-center justify-center rounded-xl border border-dashed text-[10px] font-bold uppercase tracking-[0.14em] transition",
                                        isDraggingBlockLike ? "h-8 opacity-100" : "h-2 opacity-60",
                                        "border-slate-300 bg-transparent text-slate-400",
                                      ].join(" ")}
                                    >
                                      {isDraggingBlockLike ? "Solta aqui" : null}
                                    </div>
                                  </div>
                                )}
                              </article>
                            ))}
                          </section>
                        ) : null}

                        {block.type === "columns" ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))`,
                              columnGap: `${block.gap}px`,
                              rowGap: `${block.rowGap}px`,
                              alignItems: block.alignItems,
                              justifyItems: block.justifyItems,
                            }}
                          >
                            {block.items.slice(0, block.columns).map((item, itemIndex) => (
                              <article
                                key={`${block.id}-col-${itemIndex}`}
                                contentEditable={isInlineEditing}
                                suppressContentEditableWarning
                                onBlur={(event) => {
                                  const html = event.currentTarget.innerHTML.trim() || "<p>Coluna vazia.</p>"
                                  updateDocument((current) => ({
                                    blocks: current.blocks.map((currentBlock) => {
                                      if (currentBlock.id !== block.id || currentBlock.type !== "columns") return currentBlock
                                      const nextItems = [...currentBlock.items]
                                      nextItems[itemIndex] = html
                                      return { ...currentBlock, items: nextItems }
                                    }),
                                  }))
                                  setInlineEditingBlockId(null)
                                }}
                                className={[
                                  "rounded-xl border border-slate-200 bg-white p-4",
                                  isInlineEditing ? "outline-none ring-2 ring-sky-200" : "",
                                ].join(" ")}
                                style={{
                                  padding: `${block.itemPaddingY}px ${block.itemPaddingX}px`,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: mapHorizontalAlignToFlex(block.itemContentAlignX),
                                  justifyContent: mapVerticalAlignToFlex(block.itemContentAlignY),
                                }}
                                dangerouslySetInnerHTML={{ __html: item }}
                              />
                            ))}
                          </div>
                        ) : null}

                        {block.type === "divider" ? <hr style={{ borderColor: block.color }} /> : null}
                        {block.type === "spacer" ? <div style={{ height: `${block.height}px` }} /> : null}
                      </section>

                      <div
                        onDragOver={(event) => onDropZoneDragOver(index + 1, event)}
                        onDrop={(event) => handleDropAtIndex(index + 1, event)}
                        className={[
                          "my-2 flex items-center justify-center rounded-xl border border-dashed text-[11px] font-bold uppercase tracking-[0.14em] transition",
                          isDraggingBlockLike ? "h-10 opacity-100" : "h-3 opacity-70",
                          dragOverIndex === index + 1
                            ? "border-sky-500 bg-sky-100 text-sky-900"
                            : "border-slate-300 bg-transparent text-slate-400",
                        ].join(" ")}
                      >
                        {isDraggingBlockLike ? "Solta aqui" : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </article>

        <div className="sticky top-20 h-[calc(100dvh-96px)] w-[350px] self-start">
        <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white transition-all">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Painel lateral</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Aba de blocos"
                title="Blocos"
                onClick={() => setSidebarTab("blocks")}
                className={[
                  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold uppercase tracking-[0.08em] transition",
                  sidebarTab === "blocks" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <Blocks className="h-4 w-4" />
                <span>Blocos</span>
              </button>
              <button
                type="button"
                aria-label="Aba de inspector"
                title="Inspector"
                onClick={() => setSidebarTab("inspector")}
                className={[
                  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold uppercase tracking-[0.08em] transition",
                  sidebarTab === "inspector"
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button
                type="button"
                aria-label="Aba de estrutura da página"
                title="Estrutura"
                onClick={() => setSidebarTab("structure")}
                className={[
                  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold uppercase tracking-[0.08em] transition",
                  sidebarTab === "structure"
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <GripVertical className="h-4 w-4" />
                <span>Estrut.</span>
              </button>
              <button
                type="button"
                aria-label="Aba de histórico de versões"
                title="Histórico de versões"
                onClick={() => setSidebarTab("versions")}
                className={[
                  "inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold uppercase tracking-[0.08em] transition",
                  sidebarTab === "versions"
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <History className="h-4 w-4" />
                <span>Vers.</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {sidebarTab === "blocks" ? (
              <section className="rounded-2xl border border-slate-200 bg-white/98 p-2.5 shadow-sm backdrop-blur">
                <div className="mb-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Biblioteca de blocos</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Clique para inserir abaixo do bloco selecionado ou arraste para o ponto exato no canvas.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCK_LIBRARY.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      draggable
                      onDragStart={(event) => startDragFromLibrary(item.type, event)}
                      onDragEnd={clearDragState}
                      onClick={() => handleAddBlock(item.type)}
                      className="flex items-center justify-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 transition hover:border-sky-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {sidebarTab === "structure" ? (
              <section className="rounded-2xl border border-slate-200 bg-white/98 p-2.5 shadow-sm backdrop-blur">
                <div className="mb-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Estrutura da página</p>
                  <p className="mt-1 text-xs text-slate-500">Hierarquia: secoes, containers, colunas e blocos.</p>
                </div>
                {structureTree.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                    Ainda não existem blocos nesta página.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {structureTree.map((sectionNode) => {
                      const renderNode = (node: EditorStructureNode, depth: number) => {
                        const isActive = isStructureNodeSelected(node)
                        const kindLabel =
                          node.kind === "section"
                            ? "SEÇÃO"
                            : node.kind === "container"
                              ? "CONTAINER"
                              : node.kind === "column"
                                ? "COLUNA"
                                : node.kind === "rich_node"
                                  ? "ELEMENTO"
                                  : "BLOCO"
                        return (
                          <div key={node.id} className="space-y-1">
                            <div
                              style={{ paddingLeft: `${10 + depth * 14}px` }}
                              className={[
                                "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
                                isActive ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectStructureNode(node)}
                                className="min-w-0 flex-1 text-left text-xs"
                              >
                                <span className="block truncate font-semibold">{node.label}</span>
                              </button>
                              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-slate-600">
                                {kindLabel}
                              </span>
                              <button
                                type="button"
                                aria-label="Editar elemento"
                                title="Editar"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  handleEditStructureNode(node)
                                }}
                                className="shrink-0 rounded-full border border-slate-200 p-1 text-slate-700 transition hover:border-sky-300"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                aria-label="Duplicar elemento"
                                title="Duplicar"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  handleDuplicateStructureNode(node)
                                }}
                                className="shrink-0 rounded-full border border-slate-200 p-1 text-slate-700 transition hover:border-sky-300"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                aria-label="Excluir elemento"
                                title="Excluir"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  handleDeleteStructureNode(node)
                                }}
                                className="shrink-0 rounded-full border border-rose-200 p-1 text-rose-700 transition hover:bg-rose-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            {node.children.length > 0 ? (
                              <div className="space-y-1">
                                {node.children.map((childNode) => renderNode(childNode, depth + 1))}
                              </div>
                            ) : null}
                          </div>
                        )
                      }
                      return renderNode(sectionNode, 0)
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {sidebarTab === "versions" ? (
              <article className="mb-4 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
                  onClick={() => setIsVersionHistoryExpanded((state) => !state)}
                  aria-expanded={isVersionHistoryExpanded}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileClock className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-950">Histórico de versões</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {versions.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <span>{isVersionHistoryExpanded ? "Recolher" : "Expandir"}</span>
                    {isVersionHistoryExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </div>
                </button>

                {isVersionHistoryExpanded ? (
                  <div className="mt-2 grid gap-1.5">
                    {versions.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                        Ainda não ha versões para esta página.
                      </p>
                    ) : (
                      versions.map((version) => {
                        const isPublished = version.id === publishedVersionId
                        const isLoaded = version.id === selectedVersion?.id
                        return (
                          <div key={version.id} className="rounded-lg border border-slate-200 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <p className="text-xs font-bold text-slate-900">Versão {version.version_number}</p>
                              {isPublished ? (
                                <StatusBadge label="Publicada" tone="success" />
                              ) : version.status === "draft" ? (
                                <StatusBadge label="Draft" tone="warning" />
                              ) : (
                                <StatusBadge label="Arquivada" tone="neutral" />
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(version.created_at)}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-full px-2.5 text-[11px]"
                                onClick={() => handleLoadVersion(version)}
                              >
                                {isLoaded ? "Carregada" : "Carregar"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-full px-2.5 text-[11px]"
                                onClick={() => setSelectedVersionId(version.id)}
                              >
                                Selecionar
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                ) : null}
              </article>
            ) : null}

            {sidebarTab === "inspector" ? (
              !selectedBlock ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  Seleciona um bloco no canvas para editar.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{getBlockLabel(selectedBlock)}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => handleRemoveBlock(selectedBlock.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      {selectedBlock.type === "rich_text" && selectedRichNodeIndex !== null ? "Excluir elemento" : "Excluir bloco"}
                    </Button>
                  </div>

                  {showLayoutSectionCard ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Layout da seção</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Largura (1-12)
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={selectedLayout.gridColumns}
                          onChange={(event) =>
                            updateSelectedBlockLayout({
                              gridColumns: Math.max(1, Math.min(12, Number(event.target.value) || 12)),
                            })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Alinhamento
                        <select
                          value={selectedLayout.align}
                          onChange={(event) =>
                            updateSelectedBlockLayout({
                              align: event.target.value as "left" | "center" | "right",
                            })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        >
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Padding top
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={selectedLayout.paddingTop}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ paddingTop: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Padding right
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={selectedLayout.paddingRight}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ paddingRight: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Padding bottom
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={selectedLayout.paddingBottom}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ paddingBottom: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Padding left
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={selectedLayout.paddingLeft}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ paddingLeft: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Margem top
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={selectedLayout.marginTop}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ marginTop: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Margem bottom
                        <input
                          type="number"
                          min={0}
                          max={240}
                          value={selectedLayout.marginBottom}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ marginBottom: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Fundo
                        <input
                          value={selectedLayout.backgroundColor}
                          onChange={(event) => updateSelectedBlockLayout({ backgroundColor: event.target.value })}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Raio (px)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={selectedLayout.borderRadius}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ borderRadius: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Conteúdo horizontal
                        <select
                          value={selectedLayout.contentAlignX}
                          onChange={(event) =>
                            updateSelectedBlockLayout({
                              contentAlignX: event.target.value as "left" | "center" | "right" | "stretch",
                            })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        >
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                          <option value="stretch">Esticar</option>
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Conteúdo vertical
                        <select
                          value={selectedLayout.contentAlignY}
                          onChange={(event) =>
                            updateSelectedBlockLayout({
                              contentAlignY: event.target.value as "top" | "center" | "bottom",
                            })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        >
                          <option value="top">Topo</option>
                          <option value="center">Centro</option>
                          <option value="bottom">Base</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-600">
                        Espacamento interno (px)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={selectedLayout.contentGap}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ contentGap: snapSpacing(Number(event.target.value) || 0) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Altura minima (px)
                        <input
                          type="number"
                          min={0}
                          max={1200}
                          value={selectedLayout.minHeight}
                          onChange={(event) =>
                            updateSelectedBlockLayout({ minHeight: Math.max(0, Math.min(1200, Number(event.target.value) || 0)) })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                        />
                      </label>
                    </div>
                    </div>
                  ) : null}

                  {selectedBlock.type === "heading" ? (
                    <>
                      <label className="block text-xs font-semibold text-slate-600">
                        Texto
                        <input
                          value={selectedBlock.content}
                          onChange={(event) => updateSelectedBlock((block) => (block.type === "heading" ? { ...block, content: event.target.value } : block))}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Nível
                          <select
                            value={selectedBlock.level}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "heading" ? { ...block, level: Number(event.target.value) as 1 | 2 | 3 | 4 } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value={1}>H1</option>
                            <option value={2}>H2</option>
                            <option value={3}>H3</option>
                            <option value={4}>H4</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento
                          <select
                            value={selectedBlock.align}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "heading" ? { ...block, align: event.target.value as "left" | "center" | "right" } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                          </select>
                        </label>
                      </div>
                    </>
                  ) : null}

                  {selectedBlock.type === "rich_text" ? (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                        Clica num texto, imagem ou link no canvas para editar o elemento. Para mover, arrasta o próprio elemento para outra posição.
                      </div>

                      {selectedRichNodeHtml ? (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                            {selectedRichNodeText ? `Trecho selecionado: ${selectedRichNodeText}` : "Trecho HTML selecionado no canvas."}
                          </div>
                          {selectedRichNodeDescriptor?.isTextEditable ? (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-600">Conteúdo do elemento</p>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Cor do texto
                                  <input
                                    type="color"
                                    value={selectedRichNodeDescriptor.textColor || "#0f172a"}
                                    onChange={(event) => applyRichNodeTextStyleEdit({ color: event.target.value })}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Fundo do texto
                                  <input
                                    type="color"
                                    value={selectedRichNodeDescriptor.backgroundColor || "#ffffff"}
                                    onChange={(event) => applyRichNodeTextStyleEdit({ backgroundColor: event.target.value })}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                                  />
                                </label>
                              </div>
                              <textarea
                                key={`${selectedBlock.id}-${selectedRichNodeIndex}-text`}
                                value={selectedRichNodeDescriptor.textContent}
                                onChange={(event) => applyRichNodeTextContentEdit(event.target.value)}
                                className="min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                          ) : null}
                          {selectedRichNodeDescriptor?.isLink ? (
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-slate-600">
                                Link do botão
                                <input
                                  value={selectedRichNodeDescriptor.linkHref}
                                  onChange={(event) => applyRichNodeLinkEdit({ href: event.target.value })}
                                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                />
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Espessura da borda (px)
                                  <input
                                    type="number"
                                    min={0}
                                    max={12}
                                    value={selectedRichNodeDescriptor.borderWidthPx}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        borderWidth: Math.max(0, Math.min(12, Number(event.target.value) || 0)),
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Raio da borda (px)
                                  <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    value={selectedRichNodeDescriptor.borderRadiusPx}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        borderRadius: Math.max(0, Math.min(120, Number(event.target.value) || 0)),
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Cor da borda
                                  <input
                                    type="color"
                                    value={selectedRichNodeDescriptor.borderColor}
                                    onChange={(event) => applyRichNodeLinkStyleEdit({ borderColor: event.target.value })}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Cor do fundo
                                  <input
                                    type="color"
                                    value={selectedRichNodeDescriptor.backgroundColor}
                                    onChange={(event) => applyRichNodeLinkStyleEdit({ backgroundColor: event.target.value })}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Cor do texto
                                  <input
                                    type="color"
                                    value={selectedRichNodeDescriptor.textColor}
                                    onChange={(event) => applyRichNodeLinkStyleEdit({ textColor: event.target.value })}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Tamanho da fonte (px)
                                  <input
                                    type="number"
                                    min={10}
                                    max={24}
                                    value={selectedRichNodeDescriptor.fontSizePx}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        fontSize: Math.max(10, Math.min(24, Number(event.target.value) || 10)),
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Alinhamento do botão
                                  <select
                                    value={selectedRichNodeDescriptor.buttonAlign}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        buttonAlign: event.target.value as "left" | "center" | "right",
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  >
                                    <option value="left">Esquerda</option>
                                    <option value="center">Centro</option>
                                    <option value="right">Direita</option>
                                  </select>
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Alinhamento do texto
                                  <select
                                    value={selectedRichNodeDescriptor.textAlign}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        textAlign: event.target.value as "left" | "center" | "right",
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  >
                                    <option value="left">Esquerda</option>
                                    <option value="center">Centro</option>
                                    <option value="right">Direita</option>
                                  </select>
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Padding vertical (px)
                                  <input
                                    type="number"
                                    min={6}
                                    max={40}
                                    value={selectedRichNodeDescriptor.paddingY}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        paddingY: Math.max(6, Math.min(40, Number(event.target.value) || 6)),
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Padding horizontal (px)
                                  <input
                                    type="number"
                                    min={12}
                                    max={80}
                                    value={selectedRichNodeDescriptor.paddingX}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        paddingX: Math.max(12, Math.min(80, Number(event.target.value) || 12)),
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs font-semibold text-slate-600">
                                  Largura do botão (%)
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={selectedRichNodeDescriptor.widthPercent}
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        widthPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                                        fullWidth: false,
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-600">
                                  Preset de largura
                                  <select
                                    value={
                                      selectedRichNodeDescriptor.fullWidth ? "full" : selectedRichNodeDescriptor.widthPercent > 0 ? "custom" : "auto"
                                    }
                                    onChange={(event) =>
                                      applyRichNodeLinkStyleEdit({
                                        fullWidth: event.target.value === "full",
                                        widthPercent:
                                          event.target.value === "auto"
                                            ? 0
                                            : event.target.value === "custom" && selectedRichNodeDescriptor.widthPercent === 0
                                              ? 60
                                              : selectedRichNodeDescriptor.widthPercent,
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                  >
                                    <option value="auto">Conteúdo</option>
                                    <option value="custom">Largura ajustada</option>
                                    <option value="full">Largura total</option>
                                  </select>
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                                  {selectedRichNodeDescriptor.fullWidth
                                    ? "Atual: largura total (100%)."
                                    : selectedRichNodeDescriptor.widthPercent > 0
                                      ? `Atual: ${selectedRichNodeDescriptor.widthPercent}% do container.`
                                      : "Atual: largura pelo conteúdo do texto."}
                                </div>
                                <label className="inline-flex items-end gap-2 pb-1 text-xs font-semibold text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={selectedRichNodeDescriptor.openInNewTab}
                                    onChange={(event) => applyRichNodeLinkStyleEdit({ openInNewTab: event.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  Abrir em nova aba
                                </label>
                              </div>
                            </div>
                          ) : null}
                          {selectedRichNodeDescriptor?.isImage ? (
                            <div className="grid gap-3">
                              <label className="block text-xs font-semibold text-slate-600">
                                URL da imagem
                                <input
                                  value={selectedRichNodeDescriptor.imageSrc}
                                  onChange={(event) => applyRichNodeImageEdit({ src: event.target.value })}
                                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                />
                              </label>
                              <label className="block text-xs font-semibold text-slate-600">
                                Alt da imagem
                                <input
                                  value={selectedRichNodeDescriptor.imageAlt}
                                  onChange={(event) => applyRichNodeImageEdit({ alt: event.target.value })}
                                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-white">
                                  <UploadCloud className="mr-2 h-3.5 w-3.5" />
                                  {uploadingInspectorAsset ? "A enviar..." : "Upload"}
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                                    className="sr-only"
                                    disabled={uploadingInspectorAsset}
                                    onChange={(event) => {
                                      const file = event.target.files?.[0]
                                      event.target.value = ""
                                      if (file) {
                                        void handleInspectorImageUpload(file)
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-600">Biblioteca de midia</p>
                                {assets.length === 0 ? (
                                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                                    Ainda não existem imagens nesta página.
                                  </p>
                                ) : (
                                  <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                                    {assets.map((asset) => (
                                      <button
                                        key={asset.id}
                                        type="button"
                                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-sky-300 hover:bg-sky-50"
                                        onClick={() => handleApplyAssetToSelectedImageContext(asset)}
                                      >
                                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                          <img src={asset.public_url} alt={asset.file_name} className="h-full w-full object-cover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-semibold text-slate-900">{asset.file_name}</p>
                                          <p className="text-[11px] text-slate-500">{formatDateTime(asset.created_at)}</p>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                          {!selectedRichNodeDescriptor?.isTextEditable && !selectedRichNodeDescriptor?.isImage ? (
                            <label className="block text-xs font-semibold text-slate-600">
                              HTML do trecho selecionado
                              <textarea
                                key={`${selectedBlock.id}-${selectedRichNodeIndex}`}
                                defaultValue={selectedRichNodeHtml}
                                className="mt-1 min-h-[180px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                                onBlur={(event) => {
                                  const next = event.target.value.trim()
                                  if (next) applyRichNodeEdit(next)
                                }}
                              />
                            </label>
                          ) : null}
                          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelectedRichNodeIndex(null)}>
                            Voltar para o bloco inteiro
                          </Button>
                        </div>
                      ) : (
                        <RichTextEditor
                          ref={richTextRef}
                          value={selectedBlock.content}
                          onChange={(value) => updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: value } : block))}
                          toolbarVariant="compact"
                          minHeightPx={200}
                        />
                      )}
                    </div>
                  ) : null}

                  {selectedBlock.type === "image" ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-600">
                        URL da imagem
                        <input
                          value={selectedBlock.src}
                          onChange={(event) => updateSelectedBlock((block) => (block.type === "image" ? { ...block, src: event.target.value } : block))}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Alt
                        <input
                          value={selectedBlock.alt}
                          onChange={(event) => updateSelectedBlock((block) => (block.type === "image" ? { ...block, alt: event.target.value } : block))}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Borda (px)
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={selectedBlock.radius}
                          onChange={(event) => updateSelectedBlock((block) => (block.type === "image" ? { ...block, radius: Number(event.target.value) || 0 } : block))}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-white">
                          <UploadCloud className="mr-2 h-3.5 w-3.5" />
                          {uploadingInspectorAsset ? "A enviar..." : "Upload"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                            className="sr-only"
                            disabled={uploadingInspectorAsset}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ""
                              if (file) {
                                void handleInspectorImageUpload(file)
                              }
                            }}
                          />
                        </label>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600">Biblioteca de midia</p>
                        {assets.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                            Ainda não existem imagens nesta página.
                          </p>
                        ) : (
                          <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                            {assets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-sky-300 hover:bg-sky-50"
                                onClick={() => handleApplyAssetToSelectedImageContext(asset)}
                              >
                                <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                  <img src={asset.public_url} alt={asset.file_name} className="h-full w-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-slate-900">{asset.file_name}</p>
                                  <p className="text-[11px] text-slate-500">{formatDateTime(asset.created_at)}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedBlock.type === "button" ? (
                    <>
                      <label className="block text-xs font-semibold text-slate-600">
                        Label
                        <input
                          value={selectedBlock.label}
                          onChange={(event) => updateSelectedBlock((block) => (block.type === "button" ? { ...block, label: event.target.value } : block))}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        URL
                        <input
                          value={selectedBlock.href}
                          onChange={(event) => updateSelectedBlock((block) => (block.type === "button" ? { ...block, href: event.target.value } : block))}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento do botão
                          <select
                            value={selectedBlock.align}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button" ? { ...block, align: event.target.value as "left" | "center" | "right" } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento do texto
                          <select
                            value={selectedBlock.textAlign}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button" ? { ...block, textAlign: event.target.value as "left" | "center" | "right" } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs font-semibold text-slate-600">
                        Espessura da borda (px)
                        <input
                          type="number"
                          min={0}
                          max={12}
                          value={selectedBlock.borderWidth}
                          onChange={(event) =>
                            updateSelectedBlock((block) =>
                              block.type === "button"
                                ? { ...block, borderWidth: Math.max(0, Math.min(12, Number(event.target.value) || 0)) }
                                : block,
                            )
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Cor da borda
                        <input
                          type="color"
                          value={selectedBlock.borderColor}
                          onChange={(event) =>
                            updateSelectedBlock((block) => (block.type === "button" ? { ...block, borderColor: event.target.value } : block))
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Raio da borda (px)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={selectedBlock.borderRadius}
                          onChange={(event) =>
                            updateSelectedBlock((block) =>
                              block.type === "button"
                                ? { ...block, borderRadius: Math.max(0, Math.min(120, Number(event.target.value) || 0)) }
                                : block,
                            )
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Cor de fundo
                          <input
                            type="color"
                            value={selectedBlock.backgroundColor}
                            onChange={(event) =>
                              updateSelectedBlock((block) => (block.type === "button" ? { ...block, backgroundColor: event.target.value } : block))
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Cor do texto
                          <input
                            type="color"
                            value={selectedBlock.textColor}
                            onChange={(event) =>
                              updateSelectedBlock((block) => (block.type === "button" ? { ...block, textColor: event.target.value } : block))
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Padding vertical (px)
                          <input
                            type="number"
                            min={6}
                            max={40}
                            value={selectedBlock.paddingY}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button" ? { ...block, paddingY: Math.max(6, Math.min(40, Number(event.target.value) || 6)) } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Padding horizontal (px)
                          <input
                            type="number"
                            min={12}
                            max={80}
                            value={selectedBlock.paddingX}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button" ? { ...block, paddingX: Math.max(12, Math.min(80, Number(event.target.value) || 12)) } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Tamanho da fonte (px)
                          <input
                            type="number"
                            min={10}
                            max={24}
                            value={selectedBlock.fontSize}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button" ? { ...block, fontSize: Math.max(10, Math.min(24, Number(event.target.value) || 10)) } : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Largura do botão (%)
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={selectedBlock.widthPercent}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button"
                                  ? { ...block, widthPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)), fullWidth: false }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Preset de largura
                          <select
                            value={selectedBlock.fullWidth ? "full" : selectedBlock.widthPercent > 0 ? "custom" : "auto"}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "button"
                                  ? {
                                      ...block,
                                      fullWidth: event.target.value === "full",
                                      widthPercent:
                                        event.target.value === "auto"
                                          ? 0
                                          : event.target.value === "custom" && block.widthPercent === 0
                                            ? 60
                                            : block.widthPercent,
                                    }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="auto">Conteúdo</option>
                            <option value="custom">Largura ajustada</option>
                            <option value="full">Largura total</option>
                          </select>
                        </label>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                          {selectedBlock.fullWidth
                            ? "Atual: largura total (100%)."
                            : selectedBlock.widthPercent > 0
                              ? `Atual: ${selectedBlock.widthPercent}% do container.`
                              : "Atual: largura pelo conteúdo do texto."}
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedBlock.openInNewTab}
                          onChange={(event) =>
                            updateSelectedBlock((block) => (block.type === "button" ? { ...block, openInNewTab: event.target.checked } : block))
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Abrir link em nova aba
                      </label>
                    </>
                  ) : null}

                  {selectedBlock.type === "container" ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Número de colunas
                          <select
                            value={selectedBlock.columns}
                            onChange={(event) => {
                              const nextColumns = Math.max(1, Math.min(4, Number(event.target.value) || 1)) as 1 | 2 | 3 | 4
                              updateSelectedBlock((block) => {
                                if (block.type !== "container") return block
                                const nextChildren = [...block.children]
                                while (nextChildren.length < nextColumns) nextChildren.push([createDefaultBlock("rich_text") as PageBlock])
                                return { ...block, columns: nextColumns, children: nextChildren.slice(0, nextColumns) }
                              })
                            }}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Gap horizontal (px)
                          <input
                            type="number"
                            min={8}
                            max={64}
                            value={selectedBlock.gap}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, gap: Math.max(8, Math.min(64, snapSpacing(Number(event.target.value) || 8))) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Gap vertical (px)
                          <input
                            type="number"
                            min={8}
                            max={64}
                            value={selectedBlock.rowGap}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, rowGap: Math.max(8, Math.min(64, snapSpacing(Number(event.target.value) || 8))) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Espaço entre elementos (px)
                          <input
                            type="number"
                            min={0}
                            max={80}
                            value={selectedBlock.columnContentGap}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, columnContentGap: Math.max(0, Math.min(80, snapSpacing(Number(event.target.value) || 0))) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento H das colunas
                          <select
                            value={selectedBlock.alignItems}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, alignItems: event.target.value as "start" | "center" | "end" | "stretch" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="start">Inicio</option>
                            <option value="center">Centro</option>
                            <option value="end">Fim</option>
                            <option value="stretch">Esticar</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento V das colunas
                          <select
                            value={selectedBlock.justifyItems}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, justifyItems: event.target.value as "start" | "center" | "end" | "stretch" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="start">Topo</option>
                            <option value="center">Centro</option>
                            <option value="end">Base</option>
                            <option value="stretch">Esticar</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Conteúdo da coluna (H)
                          <select
                            value={selectedBlock.columnContentAlignX}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, columnContentAlignX: event.target.value as "left" | "center" | "right" | "stretch" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                            <option value="stretch">Esticar</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Conteúdo da coluna (V)
                          <select
                            value={selectedBlock.columnContentAlignY}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, columnContentAlignY: event.target.value as "top" | "center" | "bottom" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="top">Topo</option>
                            <option value="center">Centro</option>
                            <option value="bottom">Base</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Cor de fundo
                          <input
                            type="color"
                            value={selectedBlock.backgroundColor}
                            onChange={(event) =>
                              updateSelectedBlock((block) => (block.type === "container" ? { ...block, backgroundColor: event.target.value } : block))
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Cor da borda
                          <input
                            type="color"
                            value={normalizeColorForInput(selectedBlock.borderColor, "#9ca3af")}
                            onChange={(event) =>
                              updateSelectedBlock((block) => (block.type === "container" ? { ...block, borderColor: event.target.value } : block))
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 p-1"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Espessura da borda (px)
                          <input
                            type="number"
                            min={0}
                            max={12}
                            value={selectedBlock.borderWidth}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, borderWidth: Math.max(0, Math.min(12, Number(event.target.value) || 0)) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Raio da borda (px)
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={selectedBlock.borderRadius}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, borderRadius: Math.max(0, Math.min(120, Number(event.target.value) || 0)) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Padding vertical (px)
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={selectedBlock.paddingY}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, paddingY: Math.max(0, Math.min(120, Number(event.target.value) || 0)) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Padding horizontal (px)
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={selectedBlock.paddingX}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "container"
                                  ? { ...block, paddingX: Math.max(0, Math.min(120, Number(event.target.value) || 0)) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        {selectedContainerColumnTarget?.containerId === selectedBlock.id ? (
                          <p className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900">
                            Coluna selecionada no canvas: {selectedContainerColumnTarget.columnIndex + 1}
                          </p>
                        ) : null}
                        <p className="text-xs font-semibold text-slate-600">Blocos por coluna</p>
                        {selectedBlock.children.slice(0, selectedBlock.columns).map((columnBlocks, columnIndex) => (
                          <div key={`${selectedBlock.id}-editor-col-${columnIndex}`} className="space-y-2 rounded-xl border border-slate-200 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-700">Coluna {columnIndex + 1}</p>
                              <div className="flex flex-wrap gap-1">
                                {(["rich_text", "button", "image", "container", "heading"] as PageBlockType[]).map((blockType) => (
                                  <button
                                    key={`${selectedBlock.id}-col-${columnIndex}-add-${blockType}`}
                                    type="button"
                                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:border-sky-300"
                                    onClick={() => {
                                      const newBlock = createDefaultBlock(blockType)
                                      updateDocument((current) => {
                                        const next = appendBlockToContainerColumnInTree(current.blocks, selectedBlock.id, columnIndex, newBlock)
                                        return next.inserted ? { blocks: next.blocks } : current
                                      })
                                      selectBlockForEdit(newBlock.id)
                                      setSelectedContainerColumnTarget(null)
                                    }}
                                  >
                                    + {BLOCK_LIBRARY.find((item) => item.type === blockType)?.label ?? "Bloco"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {columnBlocks.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                                Coluna vazia.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {columnBlocks.map((childBlock) => (
                                  <div key={childBlock.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-[11px] font-bold text-slate-700">{getBlockLabel(childBlock)}</p>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 transition hover:border-sky-300"
                                          onClick={() => selectBlockForEdit(childBlock.id)}
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded-full border border-rose-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700 transition hover:bg-rose-50"
                                          onClick={() => handleRemoveBlock(childBlock.id)}
                                        >
                                          Excluir
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {selectedBlock.type === "columns" ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Número de colunas
                          <select
                            value={selectedBlock.columns}
                            onChange={(event) => {
                              const nextColumns = Math.max(2, Math.min(4, Number(event.target.value) || 2)) as 2 | 3 | 4
                              updateSelectedBlock((block) => {
                                if (block.type !== "columns") return block
                                const nextItems = [...block.items]
                                while (nextItems.length < nextColumns) nextItems.push("<p>Coluna vazia.</p>")
                                return { ...block, columns: nextColumns, items: nextItems.slice(0, nextColumns) }
                              })
                            }}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Gap horizontal (px)
                          <input
                            type="number"
                            min={8}
                            max={64}
                            value={selectedBlock.gap}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, gap: Math.max(8, Math.min(64, snapSpacing(Number(event.target.value) || 8))) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Gap vertical (px)
                          <input
                            type="number"
                            min={8}
                            max={64}
                            value={selectedBlock.rowGap}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, rowGap: Math.max(8, Math.min(64, snapSpacing(Number(event.target.value) || 8))) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento H das colunas
                          <select
                            value={selectedBlock.alignItems}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, alignItems: event.target.value as "start" | "center" | "end" | "stretch" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="start">Inicio</option>
                            <option value="center">Centro</option>
                            <option value="end">Fim</option>
                            <option value="stretch">Esticar</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Alinhamento V das colunas
                          <select
                            value={selectedBlock.justifyItems}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, justifyItems: event.target.value as "start" | "center" | "end" | "stretch" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="start">Topo</option>
                            <option value="center">Centro</option>
                            <option value="end">Base</option>
                            <option value="stretch">Esticar</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Conteúdo do item (H)
                          <select
                            value={selectedBlock.itemContentAlignX}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, itemContentAlignX: event.target.value as "left" | "center" | "right" | "stretch" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                            <option value="stretch">Esticar</option>
                          </select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Conteúdo do item (V)
                          <select
                            value={selectedBlock.itemContentAlignY}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, itemContentAlignY: event.target.value as "top" | "center" | "bottom" }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="top">Topo</option>
                            <option value="center">Centro</option>
                            <option value="bottom">Base</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Padding vertical do item (px)
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={selectedBlock.itemPaddingY}
                            onChange={(event) =>
                              updateSelectedBlock((block) =>
                                block.type === "columns"
                                  ? { ...block, itemPaddingY: Math.max(0, Math.min(120, snapSpacing(Number(event.target.value) || 0))) }
                                  : block,
                              )
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </label>
                      </div>
                      <label className="block text-xs font-semibold text-slate-600">
                        Padding horizontal do item (px)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={selectedBlock.itemPaddingX}
                          onChange={(event) =>
                            updateSelectedBlock((block) =>
                              block.type === "columns"
                                ? { ...block, itemPaddingX: Math.max(0, Math.min(120, snapSpacing(Number(event.target.value) || 0))) }
                                : block,
                            )
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        />
                      </label>
                    </>
                  ) : null}

                  {selectedBlock.type === "divider" ? (
                    <label className="block text-xs font-semibold text-slate-600">
                      Cor (CSS)
                      <input
                        value={selectedBlock.color}
                        onChange={(event) => updateSelectedBlock((block) => (block.type === "divider" ? { ...block, color: event.target.value } : block))}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </label>
                  ) : null}

                  {selectedBlock.type === "spacer" ? (
                    <label className="block text-xs font-semibold text-slate-600">
                      Altura (px)
                      <input
                        type="number"
                        value={selectedBlock.height}
                        min={8}
                        max={300}
                        onChange={(event) =>
                          updateSelectedBlock((block) => (block.type === "spacer" ? { ...block, height: Number(event.target.value) } : block))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </label>
                  ) : null}
                </div>
              )
            ) : null}

            {sidebarTab === "inspector" ? (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Biblioteca de imagens</p>
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-white">
                    <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingAsset ? "A enviar..." : "Upload"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                      className="sr-only"
                      disabled={uploadingAsset}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ""
                        if (file) {
                          void handleUploadAsset(file)
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {assets.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                      Ainda não existem imagens para esta página.
                    </p>
                  ) : (
                    assets.map((asset) => (
                      <div key={asset.id} className="rounded-xl border border-slate-200 p-2.5">
                        <div className="h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img src={asset.public_url} alt={asset.file_name} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-2 truncate text-xs font-semibold text-slate-900">{asset.file_name}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(asset.created_at)}</p>
                        <Button type="button" variant="outline" size="sm" className="mt-2 w-full rounded-full" onClick={() => handleInsertImage(asset)}>
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Inserir no canvas
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
        </div>
      </section>

      <footer className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center justify-start">
          <span className="text-[10px] font-medium tracking-[0.06em] text-[#5F7077]">Build {BUILD_VERSION}</span>
        </div>
      </footer>

      {(pendingRichInsertPoint || pendingContainerInsertPoint) && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4"
              onClick={() => {
                setPendingRichInsertPoint(null)
                setPendingContainerInsertPoint(null)
                setSelectedContainerColumnTarget(null)
              }}
            >
              <div
                className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Inserir bloco aqui</p>
                    <p className="text-xs text-slate-500">
                      {pendingContainerInsertPoint
                        ? `Escolhe o tipo de bloco para a coluna ${pendingContainerInsertPoint.columnIndex + 1}.`
                        : "Escolhe o tipo de bloco a inserir no ponto selecionado."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setPendingRichInsertPoint(null)
                      setPendingContainerInsertPoint(null)
                      setSelectedContainerColumnTarget(null)
                    }}
                  >
                    Fechar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCK_LIBRARY.map((item) => (
                    <Button key={`modal-insert-${item.type}`} type="button" variant="outline" className="justify-start rounded-xl" onClick={() => handleAddBlock(item.type)}>
                      + {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
