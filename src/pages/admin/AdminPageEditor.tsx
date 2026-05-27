import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DragEvent, FocusEvent } from "react"
import type { CSSProperties } from "react"
import { createPortal } from "react-dom"
import { Link, useBlocker } from "react-router-dom"
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileClock,
  GripVertical,
  ImagePlus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  Send,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { ErrorState, LoadingState } from "@/components/feedback"
import { RichTextEditor, type RichTextEditorHandle } from "@/components/common/RichTextEditor"
import { Button } from "@/components/ui"
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
  { type: "heading", label: "Titulo" },
  { type: "rich_text", label: "Texto" },
  { type: "image", label: "Imagem" },
  { type: "button", label: "Botao" },
  { type: "columns", label: "Colunas" },
  { type: "divider", label: "Divisor" },
  { type: "spacer", label: "Espaco" },
]

type DragPayload =
  | { kind: "library"; blockType: PageBlockType }
  | { kind: "block"; blockId: string }

type PendingRichInsertPoint = {
  blockId: string
  insertIndex: number
  insertAfterNodeIndex?: number
}

function getPublicPathForSlug(slug: SitePageSlug | string) {
  return PAGE_OPTIONS.find((item) => item.slug === slug)?.publicPath ?? "/"
}

function getTitleForSlug(slug: SitePageSlug | string) {
  return PAGE_OPTIONS.find((item) => item.slug === slug)?.label ?? String(slug)
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

function resolveRichNodeIndexFromTarget(target: HTMLElement | null) {
  const node = target?.closest?.("[data-me-node]") as HTMLElement | null
  if (!node) return null
  const value = Number(node.getAttribute("data-me-node") ?? "-1")
  if (!Number.isFinite(value) || value < 0) return null
  return value
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

function getHtmlForBlockInsertion(block: PageBlock) {
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
    const display = block.fullWidth ? "inline-flex;width:100%;justify-content:center;" : "inline-flex;"
    const textTransform = block.fontSize <= 13 ? "uppercase" : "none"
    const letterSpacing = block.fontSize <= 13 ? ".08em" : ".02em"
    return `<a href="${escapeHtmlAttribute(block.href)}"${targetAttr} style="text-decoration:none;font-weight:800;${display}border-style:solid;border-width:${block.borderWidth}px;border-color:${escapeHtmlAttribute(block.borderColor)};border-radius:${block.borderRadius}px;background:${escapeHtmlAttribute(block.backgroundColor)};color:${escapeHtmlAttribute(block.textColor)};padding:${block.paddingY}px ${block.paddingX}px;font-size:${block.fontSize}px;text-transform:${textTransform};letter-spacing:${letterSpacing};">${escapeHtmlAttribute(block.label)}</a>`
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
      .map((item) => `<div>${item}</div>`)
      .join("")
    return `<div style="display:grid;grid-template-columns:repeat(${block.columns},minmax(0,1fr));gap:${block.gap}px;">${items}</div>`
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
  if (block.type === "heading") return `Titulo H${block.level}`
  if (block.type === "rich_text") return "Texto rico"
  if (block.type === "image") return "Imagem"
  if (block.type === "button") return "Botao"
  if (block.type === "columns") return `Secao ${block.columns} colunas`
  if (block.type === "divider") return "Divisor"
  return "Espaco"
}

function canInlineEdit(block: PageBlock) {
  return block.type === "heading" || block.type === "button" || block.type === "columns"
}

function getBlockContainerStyle(layout?: BlockLayoutStyle): CSSProperties {
  const normalized = normalizeLayoutStyle(layout ?? getBlockLayoutDefaults())
  const widthPercent = Math.round((normalized.gridColumns / 12) * 10000) / 100
  const widthCss = `min(100%, ${widthPercent}%)`

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
    boxSizing: "border-box",
  }
}

function moveBlockToIndex(blocks: PageBlock[], blockId: string, rawTargetIndex: number): PageBlock[] {
  const fromIndex = blocks.findIndex((item) => item.id === blockId)
  if (fromIndex < 0) return blocks
  const targetIndex = Math.max(0, Math.min(rawTargetIndex, blocks.length - 1))
  if (fromIndex === targetIndex) return blocks

  const next = [...blocks]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

export function AdminPageEditor() {
  const [selectedSlug, setSelectedSlug] = useState<SitePageSlug>("home")
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
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDraggingCanvasBlock, setIsDraggingCanvasBlock] = useState(false)
  const [inlineEditingBlockId, setInlineEditingBlockId] = useState<string | null>(null)
  const [showLayoutGuides, setShowLayoutGuides] = useState(true)
  const [snapSpacingToGrid, setSnapSpacingToGrid] = useState(true)
  const [richSelectionMode, setRichSelectionMode] = useState(true)
  const [selectedRichNodeIndex, setSelectedRichNodeIndex] = useState<number | null>(null)
  const [isLayoutCardVisible, setIsLayoutCardVisible] = useState(false)
  const [isVersionHistoryExpanded, setIsVersionHistoryExpanded] = useState(false)
  const [pendingRichInsertPoint, setPendingRichInsertPoint] = useState<PendingRichInsertPoint | null>(null)

  const richTextRef = useRef<RichTextEditorHandle | null>(null)
  const selectedRichNodeEditorRef = useRef<RichTextEditorHandle | null>(null)
  const loadedSlugRef = useRef<string>("")
  const loadedVersionRef = useRef<string>("")
  const autosaveTimerRef = useRef<number | null>(null)
  const dragPayloadRef = useRef<DragPayload | null>(null)

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
    () => documentDraft.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [documentDraft.blocks, selectedBlockId],
  )
  const selectedLayout = useMemo(
    () => normalizeLayoutStyle(selectedBlock?.layout ?? getBlockLayoutDefaults()),
    [selectedBlock],
  )

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
    return {
      tagName,
      outerHtml: element.outerHTML,
      innerHtml: element.innerHTML,
      textContent: element.textContent?.trim() ?? "",
      isTextEditable: isRichTextNodeTextEditable(tagName),
      isImage: tagName === "img",
      isLink: tagName === "a",
      linkHref: element.getAttribute("href") ?? "",
      textColor: element.style.color || "",
      backgroundColor: element.style.backgroundColor || "",
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

  const updateDocument = useCallback((updater: (current: SitePageBuilderDocument) => SitePageBuilderDocument) => {
    setDocumentDraft((current) => updater(current))
    setIsDirty(true)
    setAutosaveStatus((prev) => (prev === "saving" ? prev : "idle"))
  }, [])

  const updateSelectedBlock = useCallback(
    (updater: (block: PageBlock) => PageBlock) => {
      if (!selectedBlockId) return
      updateDocument((current) => ({
        blocks: current.blocks.map((block) => (block.id === selectedBlockId ? updater(block) : block)),
      }))
    },
    [selectedBlockId, updateDocument],
  )

  const selectBlockForEdit = useCallback((blockId: string) => {
    setSelectedBlockId(blockId)
    setIsLayoutCardVisible(true)
  }, [])

  const selectBlockSilently = useCallback((blockId: string) => {
    setSelectedBlockId(blockId)
    setIsLayoutCardVisible(false)
  }, [])

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
    (html: string, activeIndex: number | null, showInsertAfter = false) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return html
      const parser = new DOMParser()
      const parsed = parser.parseFromString(html, "text/html")
      const editableNodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      if (showInsertAfter && activeIndex !== null && editableNodes[activeIndex]) {
        const slot = parsed.createElement("div")
        slot.setAttribute("data-me-drop-slot", String(activeIndex + 1))
        slot.setAttribute("data-me-drop-after", String(activeIndex))
        slot.setAttribute(
          "style",
          "height:32px;border:1px dashed rgba(56,189,248,.65);border-radius:999px;background:rgba(224,242,254,.88);margin:10px 0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.04em;color:#0f4c81;cursor:copy;",
        )
        slot.textContent = "+ Inserir aqui"
        const activeNode = editableNodes[activeIndex]
        activeNode.parentNode?.insertBefore(slot, activeNode.nextSibling)
      }
      editableNodes.forEach((child, index) => {
        child.setAttribute("data-me-node", String(index))
        const baseStyle = child.getAttribute("style") ?? ""
        const activeStyle =
          activeIndex === index
            ? "outline:2px solid #38bdf8;outline-offset:2px;cursor:pointer;"
            : "cursor:pointer;"
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

  const applyRichNodeInnerContentEdit = useCallback(
    (nextInnerHtml: string) => {
      if (!selectedBlock || selectedBlock.type !== "rich_text") return
      if (selectedRichNodeIndex === null) return
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return

      const parser = new DOMParser()
      const parsed = parser.parseFromString(selectedBlock.content, "text/html")
      const nodes = Array.from(parsed.body.querySelectorAll(EDITABLE_RICH_TEXT_SELECTOR))
      const targetNode = nodes[selectedRichNodeIndex] as HTMLElement | undefined
      if (!targetNode) return

      targetNode.innerHTML = nextInnerHtml
      updateSelectedBlock((block) => (block.type === "rich_text" ? { ...block, content: parsed.body.innerHTML } : block))
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
      return window.confirm(`Existem alteracoes nao guardadas. Queres continuar para ${nextActionLabel}?`)
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
    (document: SitePageBuilderDocument): SitePageBuilderDocument => ({
      blocks: document.blocks.map((block) =>
        block.type === "rich_text" ? { ...block, content: sanitizeRichTextContentForPersist(block.content) } : block,
      ),
    }),
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
      selectedRichNodeEditorRef.current?.flush()
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
            message: error instanceof Error ? error.message : "Nao foi possivel guardar o rascunho.",
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
    if (window.confirm("Existem alteracoes nao guardadas. Queres sair desta pagina mesmo assim?")) {
      navigationBlocker.proceed()
      return
    }
    navigationBlocker.reset()
  }, [navigationBlocker])

  const handleAddBlock = (type: PageBlockType) => {
    if (pendingRichInsertPoint) {
      const nextBlock = createDefaultBlock(type)
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

    if (selectedBlock?.type === "rich_text" && selectedRichNodeIndex !== null) {
      const nextBlock = createDefaultBlock(type)
      const inserted = insertRichNodeAtIndex(selectedBlock.id, selectedRichNodeIndex + 1, getHtmlForBlockInsertion(nextBlock))
      if (inserted) {
        setSelectedRichNodeIndex(selectedRichNodeIndex + 1)
        selectBlockSilently(selectedBlock.id)
        return
      }
    }

    if (type === "image" && replaceSelectedRichNodeWithImage()) {
      return
    }
    const block = createDefaultBlock(type)
    updateDocument((current) => {
      if (!selectedBlockId) {
        return { blocks: [...current.blocks, block] }
      }
      const index = current.blocks.findIndex((item) => item.id === selectedBlockId)
      if (index < 0) {
        return { blocks: [...current.blocks, block] }
      }
      const nextBlocks = [...current.blocks]
      nextBlocks.splice(index + 1, 0, block)
      return { blocks: nextBlocks }
    })
    selectBlockSilently(block.id)
  }

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      const block = documentDraft.blocks.find((item) => item.id === blockId)
      if (!block) return

      if (block.type === "rich_text" && selectedRichNodeIndex !== null) {
        if (!window.confirm("Queres mesmo excluir o elemento selecionado dentro desta secao?")) return
        removeSelectedRichNode()
        return
      }

      if (!window.confirm(`Queres mesmo excluir o bloco "${getBlockLabel(block)}"?`)) return

      updateDocument((current) => ({
        blocks: current.blocks.filter((item) => item.id !== blockId),
      }))
      setSelectedBlockId((current) => (current === blockId ? "" : current))
      setInlineEditingBlockId((current) => (current === blockId ? null : current))
      setSelectedRichNodeIndex(null)
      setIsLayoutCardVisible(false)
    },
    [documentDraft.blocks, removeSelectedRichNode, selectedRichNodeIndex, updateDocument],
  )

  useEffect(() => {
    if (selectedBlock?.type !== "rich_text") {
      setSelectedRichNodeIndex(null)
      setRichSelectionMode(true)
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
      selectedRichNodeEditorRef.current?.flush()

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
        setFeedback({ tone: "danger", message: "Seleciona uma versao para publicar." })
        return
      }

      await publishMutation.mutateAsync({
        slug: selectedSlug,
        versionId: versionIdToPublish,
      })
      setFeedback({ tone: "success", message: "Pagina publicada com sucesso." })
      setIsDirty(false)
      await detailQuery.refetch()
      await pagesQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel publicar esta versao.",
      })
    }
  }

  const handleUnpublish = async () => {
    if (!publishedVersionId) {
      setFeedback({ tone: "danger", message: "Esta pagina ainda nao esta publicada." })
      return
    }
    if (!window.confirm("Queres mesmo despublicar esta pagina?")) return
    setFeedback(null)
    try {
      await unpublishMutation.mutateAsync({ slug: selectedSlug })
      setFeedback({ tone: "success", message: "Pagina despublicada com sucesso." })
      await detailQuery.refetch()
      await pagesQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel despublicar.",
      })
    }
  }

  const handleRollback = async () => {
    if (!selectedVersionId) {
      setFeedback({ tone: "danger", message: "Seleciona uma versao para rollback." })
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
        message: error instanceof Error ? error.message : "Nao foi possivel aplicar rollback.",
      })
    }
  }

  const handleLoadVersion = (version: AdminSitePageVersion) => {
    if (!confirmDiscardChanges(`carregar a versao ${version.version_number}`)) return
    const nextDoc = extractDocumentFromVersion(selectedSlug, version)
    loadedVersionRef.current = version.id
    setSelectedVersionId(version.id)
    setDocumentDraft(nextDoc)
    setSelectedBlockId("")
    setIsLayoutCardVisible(false)
    setInlineEditingBlockId(null)
    setIsDirty(false)
    setAutosaveStatus("idle")
    setAutosaveSavedAt(null)
    setFeedback({ tone: "success", message: `Versao ${version.version_number} carregada no editor.` })
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
        message: error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.",
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
        message: error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.",
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

      updateDocument((current) => {
        const fromIndex = current.blocks.findIndex((item) => item.id === payload.blockId)
        if (fromIndex < 0) return current
        const targetIndex = Math.max(0, Math.min(rawIndex, current.blocks.length))
        const normalizedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
        const nextBlocks = moveBlockToIndex(current.blocks, payload.blockId, normalizedTarget)
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

      let movedBlock: PageBlock | null = null
      updateDocument((current) => {
        movedBlock = current.blocks.find((item) => item.id === payload.blockId) ?? null
        if (!movedBlock) return current

        const nextBlocks = current.blocks
          .filter((item) => item.id !== payload.blockId)
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
    [clearDragState, insertRichNodeAtIndex, selectBlockSilently, updateDocument],
  )

  const onDropZoneDragOver = (index: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragOverIndex(index)
    event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
  }

  const handleInlineTextCommit = (blockId: string, event: FocusEvent<HTMLElement>) => {
    const nextValue = event.currentTarget.innerText.trim()
    updateDocument((current) => ({
      blocks: current.blocks.map((item) => {
        if (item.id !== blockId || item.type !== "heading") return item
        return {
          ...item,
          content: nextValue || "Titulo",
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
        title="Nao foi possivel carregar as paginas"
        message={pagesQuery.error instanceof Error ? pagesQuery.error.message : "Tenta novamente em instantes."}
        onRetry={() => void pagesQuery.refetch()}
      />
    )
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar a pagina selecionada"
        message={detailQuery.error instanceof Error ? detailQuery.error.message : "Tenta novamente em instantes."}
        onRetry={() => void detailQuery.refetch()}
      />
    )
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-110px)] flex-col gap-3">
      <PageHeader
        title="Editor Visual de Paginas"
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
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Pagina</span>
            <select
              value={selectedSlug}
              onChange={(event) => {
                const nextSlug = event.target.value as SitePageSlug
                if (nextSlug === selectedSlug) return
                if (!confirmDiscardChanges(`abrir a pagina ${getTitleForSlug(nextSlug)}`)) {
                  event.target.value = selectedSlug
                  return
                }
                setSelectedSlug(nextSlug)
                setFeedback(null)
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400"
            >
              {PAGE_OPTIONS.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
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
            <ActionHint hint="Guarda um novo rascunho da pagina sem publicar.">
              <Button type="button" className="rounded-full" onClick={() => void handleSaveDraft("manual")} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {saveDraftMutation.isPending ? "A guardar..." : "Guardar"}
              </Button>
            </ActionHint>
            <ActionHint hint="Publica a versao atual para o site publico.">
              <Button type="button" className="rounded-full" onClick={() => void handlePublish()} disabled={isSaving || !selectedVersionId}>
                <Send className="mr-2 h-4 w-4" />
                {publishMutation.isPending ? "A publicar..." : "Publicar"}
              </Button>
            </ActionHint>
            <ActionHint hint="Abre uma pre-visualizacao da pagina com o estado atual do editor.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => handlePreview()} disabled={isSaving}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </ActionHint>
            <ActionHint hint="Restaura o conteudo da versao selecionada.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleRollback()} disabled={isSaving || !selectedVersionId}>
                <FileClock className="mr-2 h-4 w-4" />
                Rollback
              </Button>
            </ActionHint>
            <ActionHint hint="Remove a versao publicada do site publico.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleUnpublish()} disabled={isSaving || !publishedVersionId}>
                <XCircle className="mr-2 h-4 w-4" />
                Despublicar
              </Button>
            </ActionHint>
            <ActionHint hint="Liga ou desliga o autosave periodico do editor.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setAutosaveEnabled((current) => !current)}>
                {autosaveEnabled ? "Autosave ligado" : "Autosave desligado"}
              </Button>
            </ActionHint>
            <ActionHint hint="Mostra ou oculta guias visuais de alinhamento no canvas.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowLayoutGuides((current) => !current)}>
                {showLayoutGuides ? "Guias on" : "Guias off"}
              </Button>
            </ActionHint>
            <ActionHint hint="Ativa ou desativa o ajuste automatico de espacamento para grade de 4px.">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setSnapSpacingToGrid((current) => !current)}>
                {snapSpacingToGrid ? "Snap 4px on" : "Snap 4px off"}
              </Button>
            </ActionHint>
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

      <section className="rounded-2xl border border-slate-200 bg-white/98 p-2.5 shadow-sm backdrop-blur">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Biblioteca de blocos</p>
          <p className="text-xs text-slate-500">
            Clique para inserir abaixo do bloco selecionado ou arraste para o ponto exato no canvas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
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
      </div>

      <section className="flex min-h-0 flex-1 gap-3">
        <article className="min-h-0 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Canvas visual</p>
              <p className="text-xs text-slate-500">Arrasta blocos para dentro, reposiciona por drag-and-drop e edita em duplo clique.</p>
            </div>
            {livePreviewUrl ? (
              <a href={livePreviewUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 underline">
                Ultimo preview
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
                isDraggingCanvasBlock ? "h-10 opacity-100" : "h-3 opacity-70",
                dragOverIndex === 0 ? "border-sky-500 bg-sky-100 text-sky-900" : "border-slate-300 bg-transparent text-slate-400",
              ].join(" ")}
            >
              {isDraggingCanvasBlock ? "Solta aqui" : null}
            </div>

            {documentDraft.blocks.length === 0 ? (
              <div
                onDragOver={(event) => onDropZoneDragOver(0, event)}
                onDrop={(event) => handleDropAtIndex(0, event)}
                className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600"
              >
                Arrasta blocos da esquerda para montar a pagina.
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
                          selectBlockForEdit(block.id)
                          if (block.type === "rich_text" && richSelectionMode) {
                            setSelectedRichNodeIndex(resolveRichNodeIndexFromTarget(target))
                          }
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
                          className="absolute right-2 top-2 z-10 inline-flex cursor-grab items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white opacity-0 transition active:cursor-grabbing group-hover:opacity-100"
                          aria-label={`Arrastar bloco ${index + 1}`}
                          title="Arrastar bloco"
                        >
                          <GripVertical className="mr-1 h-3 w-3" /> arrastar
                        </button>

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
                              className="rich-text-editor min-h-[70px] max-w-full overflow-hidden leading-8 [&_*]:max-w-full [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                              onClick={(event) => {
                                selectBlockForEdit(block.id)
                                if (!richSelectionMode) {
                                  setSelectedRichNodeIndex(null)
                                  return
                                }
                                const target = event.target as HTMLElement | null
                                const dropSlot = target?.closest?.("[data-me-drop-slot]") as HTMLElement | null
                                if (dropSlot) {
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
                                const nextIndex = resolveRichNodeIndexFromTarget(target)
                                if (nextIndex === null) {
                                  setSelectedRichNodeIndex(null)
                                  setPendingRichInsertPoint(null)
                                  return
                                }
                                setPendingRichInsertPoint(null)
                                setSelectedRichNodeIndex(nextIndex)
                              }}
                              onDragOver={(event) => {
                                const target = event.target as HTMLElement | null
                                const richNode = target?.closest?.("[data-me-node]") as HTMLElement | null
                                const dropSlot = target?.closest?.("[data-me-drop-slot]") as HTMLElement | null
                                if (richNode) {
                                  const nextIndex = Number(richNode.getAttribute("data-me-node") ?? "-1")
                                  if (Number.isFinite(nextIndex) && nextIndex >= 0) {
                                    if (selectedBlockId !== block.id) {
                                      selectBlockForEdit(block.id)
                                    }
                                    if (selectedRichNodeIndex !== nextIndex) {
                                      setSelectedRichNodeIndex(nextIndex)
                                    }
                                    event.preventDefault()
                                    event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
                                    return
                                  }
                                }
                                if (!dropSlot) return
                                event.preventDefault()
                                event.dataTransfer.dropEffect = dragPayloadRef.current?.kind === "library" ? "copy" : "move"
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
                                if (!dropSlot) return
                                const insertIndex = Number(dropSlot.getAttribute("data-me-drop-slot") ?? "-1")
                                if (!Number.isFinite(insertIndex) || insertIndex < 0) return
                                handleDropIntoRichText(block.id, insertIndex, event)
                              }}
                              dangerouslySetInnerHTML={{
                                __html:
                                  isSelected && richSelectionMode
                                    ? annotateRichTextNodes(block.content, selectedRichNodeIndex, selectedRichNodeIndex !== null)
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
                                block.fullWidth ? "flex w-full justify-center" : "inline-flex",
                                isInlineEditing ? "ring-2 ring-sky-200" : "",
                              ].join(" ")}
                              style={{
                                borderStyle: "solid",
                                borderWidth: `${block.borderWidth}px`,
                                borderColor: block.borderColor,
                                borderRadius: `${block.borderRadius}px`,
                                background: block.backgroundColor,
                                color: block.textColor,
                                padding: `${block.paddingY}px ${block.paddingX}px`,
                                fontSize: `${block.fontSize}px`,
                                textTransform: block.fontSize <= 13 ? "uppercase" : "none",
                                letterSpacing: block.fontSize <= 13 ? "0.08em" : "0.02em",
                              }}
                            >
                              {block.label}
                            </button>
                          </div>
                        ) : null}

                        {block.type === "columns" ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))`,
                              gap: `${block.gap}px`,
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
                          isDraggingCanvasBlock ? "h-10 opacity-100" : "h-3 opacity-70",
                          dragOverIndex === index + 1
                            ? "border-sky-500 bg-sky-100 text-sky-900"
                            : "border-slate-300 bg-transparent text-slate-400",
                        ].join(" ")}
                      >
                        {isDraggingCanvasBlock ? "Solta aqui" : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </article>

        <aside
          className={[
            "flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white transition-all",
            rightSidebarCollapsed ? "w-14" : "w-[350px]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            {!rightSidebarCollapsed ? <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Inspector</p> : null}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightSidebarCollapsed((current) => !current)}>
              {rightSidebarCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </Button>
          </div>

          {rightSidebarCollapsed ? (
            <div className="flex flex-1 items-center justify-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 [writing-mode:vertical-rl]">
              Inspector
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <article className="mb-4 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
                  onClick={() => setIsVersionHistoryExpanded((state) => !state)}
                  aria-expanded={isVersionHistoryExpanded}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileClock className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-950">Historico de versoes</h2>
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
                        Ainda nao ha versoes para esta pagina.
                      </p>
                    ) : (
                      versions.map((version) => {
                        const isPublished = version.id === publishedVersionId
                        const isLoaded = version.id === selectedVersion?.id
                        return (
                          <div key={version.id} className="rounded-lg border border-slate-200 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <p className="text-xs font-bold text-slate-900">Versao {version.version_number}</p>
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

              {!selectedBlock ? (
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
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Layout da secao</p>
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
                          Nivel
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
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={richSelectionMode ? "default" : "outline"}
                          size="sm"
                          className="rounded-full"
                          onClick={() => {
                            setRichSelectionMode((current) => !current)
                            setSelectedRichNodeIndex(null)
                          }}
                        >
                          {richSelectionMode ? "Selecao interna on" : "Selecao interna off"}
                        </Button>
                        <span className="text-[11px] text-slate-500">
                          Clica num texto, imagem ou link dentro do bloco para editar so esse trecho.
                        </span>
                      </div>

                      {richSelectionMode && selectedRichNodeHtml ? (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                            {selectedRichNodeText ? `Trecho selecionado: ${selectedRichNodeText}` : "Trecho HTML selecionado no canvas."}
                          </div>
                          {selectedRichNodeDescriptor?.isTextEditable ? (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-600">Conteudo do elemento</p>
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
                              {selectedRichNodeDescriptor.isLink ? (
                                <textarea
                                  key={`${selectedBlock.id}-${selectedRichNodeIndex}-text-link`}
                                  value={selectedRichNodeDescriptor.textContent}
                                  onChange={(event) => applyRichNodeTextContentEdit(event.target.value)}
                                  className="min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                />
                              ) : (
                                <RichTextEditor
                                  key={`${selectedBlock.id}-${selectedRichNodeIndex}-text`}
                                  ref={selectedRichNodeEditorRef}
                                  value={selectedRichNodeDescriptor.innerHtml}
                                  onChange={applyRichNodeInnerContentEdit}
                                  toolbarVariant="compact"
                                  minHeightPx={140}
                                />
                              )}
                            </div>
                          ) : null}
                          {selectedRichNodeDescriptor?.isLink ? (
                            <label className="block text-xs font-semibold text-slate-600">
                              Link do botao
                              <input
                                value={selectedRichNodeDescriptor.linkHref}
                                onChange={(event) => applyRichNodeLinkEdit({ href: event.target.value })}
                                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                              />
                            </label>
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
                                    Ainda nao existem imagens nesta pagina.
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
                            Ainda nao existem imagens nesta pagina.
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
                      <label className="block text-xs font-semibold text-slate-600">
                        Alinhamento
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
                          Largura
                          <select
                            value={selectedBlock.fullWidth ? "full" : "auto"}
                            onChange={(event) =>
                              updateSelectedBlock((block) => (block.type === "button" ? { ...block, fullWidth: event.target.value === "full" } : block))
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                          >
                            <option value="auto">Conteudo</option>
                            <option value="full">Largura total</option>
                          </select>
                        </label>
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

                  {selectedBlock.type === "columns" ? (
                    <>
                      <label className="block text-xs font-semibold text-slate-600">
                        Numero de colunas
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
                        Gap entre colunas (px)
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
              )}

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
                      Ainda nao existem imagens para esta pagina.
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
            </div>
          )}
        </aside>
      </section>

      {pendingRichInsertPoint && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" onClick={() => setPendingRichInsertPoint(null)}>
              <div
                className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Inserir bloco aqui</p>
                    <p className="text-xs text-slate-500">Escolhe o tipo de bloco a inserir no ponto selecionado.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setPendingRichInsertPoint(null)}>
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
