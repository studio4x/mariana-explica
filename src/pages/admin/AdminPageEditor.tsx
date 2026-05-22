import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DragEvent, FocusEvent } from "react"
import type { CSSProperties } from "react"
import { useBlocker } from "react-router-dom"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileClock,
  GripVertical,
  ImagePlus,
  PanelLeftClose,
  PanelLeftOpen,
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
  convertLegacyHtmlToBuilderDocument,
  createDefaultBlock,
  expandStructuredRichTextBlocks,
  getDefaultDocumentForSlug,
  getDefaultStyleCss,
  getBlockLayoutDefaults,
  normalizeBuilderDocument,
  normalizeLayoutStyle,
  renderDocumentToHtml,
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

function getPublicPathForSlug(slug: SitePageSlug | string) {
  return PAGE_OPTIONS.find((item) => item.slug === slug)?.publicPath ?? "/"
}

function getTitleForSlug(slug: SitePageSlug | string) {
  return PAGE_OPTIONS.find((item) => item.slug === slug)?.label ?? String(slug)
}

function resolveInitialVersion(versions: AdminSitePageVersion[], publishedId: string | null) {
  if (publishedId) {
    const publishedVersion = versions.find((item) => item.id === publishedId)
    if (publishedVersion) return publishedVersion
  }
  const latestDraft = versions.find((item) => item.status === "draft")
  if (latestDraft) return latestDraft
  return versions[0] ?? null
}

function extractDocumentFromVersion(slug: SitePageSlug, version: AdminSitePageVersion | null): SitePageBuilderDocument {
  const json = version?.layout_json
  if (!json || typeof json !== "object") {
    return getDefaultDocumentForSlug(slug)
  }

  const record = json as Record<string, unknown>
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  const hasBlocks = Array.isArray(projectData?.blocks) && projectData.blocks.length > 0
  if (hasBlocks && projectData) {
    return expandStructuredRichTextBlocks(normalizeBuilderDocument(projectData, slug))
  }

  const htmlFromRecord = typeof record.html === "string" ? record.html : null
  const htmlFromProjectData = projectData && typeof projectData.html === "string" ? projectData.html : null
  const legacyHtml = htmlFromRecord ?? htmlFromProjectData

  if (legacyHtml) {
    return expandStructuredRichTextBlocks(convertLegacyHtmlToBuilderDocument(legacyHtml, slug))
  }

  if (projectData) {
    return expandStructuredRichTextBlocks(normalizeBuilderDocument(projectData, slug))
  }

  return getDefaultDocumentForSlug(slug)
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
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [inlineEditingBlockId, setInlineEditingBlockId] = useState<string | null>(null)
  const [showLayoutGuides, setShowLayoutGuides] = useState(true)
  const [snapSpacingToGrid, setSnapSpacingToGrid] = useState(true)
  const [richSelectionMode, setRichSelectionMode] = useState(true)
  const [selectedRichNodeIndex, setSelectedRichNodeIndex] = useState<number | null>(null)

  const richTextRef = useRef<RichTextEditorHandle | null>(null)
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
    if (typeof window === "undefined" || typeof DOMParser === "undefined") return null
    const parser = new DOMParser()
    const parsed = parser.parseFromString(selectedBlock.content, "text/html")
    const nodes = Array.from(parsed.body.children)
    const node = nodes[selectedRichNodeIndex]
    return node ? node.outerHTML : null
  }, [selectedBlock, selectedRichNodeIndex])

  const selectedRichNodeText = useMemo(() => {
    if (!selectedRichNodeHtml || typeof window === "undefined" || typeof DOMParser === "undefined") return ""
    const parser = new DOMParser()
    const parsed = parser.parseFromString(selectedRichNodeHtml, "text/html")
    return parsed.body.textContent?.trim() ?? ""
  }, [selectedRichNodeHtml])

  const autosaveLabel = useMemo(() => {
    if (!autosaveEnabled) return "Autosave desligado"
    if (autosaveStatus === "saving") return "Autosave a guardar..."
    if (autosaveStatus === "error") return "Erro no autosave"
    if (autosaveStatus === "saved" && autosaveSavedAt) return `Autosave ${formatDateTime(autosaveSavedAt)}`
    return "Autosave ativo"
  }, [autosaveEnabled, autosaveSavedAt, autosaveStatus])

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
    (html: string, activeIndex: number | null) => {
      if (typeof window === "undefined" || typeof DOMParser === "undefined") return html
      const parser = new DOMParser()
      const parsed = parser.parseFromString(html, "text/html")
      const children = Array.from(parsed.body.children)
      children.forEach((child, index) => {
        child.setAttribute("data-me-node", String(index))
        const baseStyle = child.getAttribute("style") ?? ""
        const activeStyle =
          activeIndex === index
            ? "outline:2px solid #38bdf8;outline-offset:2px;cursor:pointer;"
            : "outline:1px dashed rgba(56,189,248,.35);outline-offset:2px;cursor:pointer;"
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
      const nodes = Array.from(parsed.body.children)
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

  const confirmDiscardChanges = useCallback(
    (nextActionLabel: string) => {
      if (!isDirty) return true
      return window.confirm(`Existem alteracoes nao guardadas. Queres continuar para ${nextActionLabel}?`)
    },
    [isDirty],
  )

  const createSnapshot = useCallback(() => {
    const html = renderDocumentToHtml(documentDraft)
    const css = getDefaultStyleCss()
    return {
      projectData: {
        blocks: documentDraft.blocks,
      },
      html,
      css,
    }
  }, [documentDraft])

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
            message: error instanceof Error ? error.message : "Nao foi possivel guardar o rascunho.",
          })
        }
      }
    },
    [createSnapshot, detailQuery, pageSummary?.title, pagesQuery, saveDraftMutation, selectedSlug],
  )

  useEffect(() => {
    if (!detailQuery.data) return

    const initialVersion = resolveInitialVersion(versions, publishedVersionId)
    const initialDoc = extractDocumentFromVersion(selectedSlug, initialVersion)
    const shouldReload = loadedSlugRef.current !== selectedSlug || loadedVersionRef.current !== (initialVersion?.id ?? "")

    if (!shouldReload) return

    loadedSlugRef.current = selectedSlug
    loadedVersionRef.current = initialVersion?.id ?? ""
    setSelectedVersionId(initialVersion?.id ?? "")
    setDocumentDraft(initialDoc)
    setSelectedBlockId(initialDoc.blocks[0]?.id ?? "")
    setInlineEditingBlockId(null)
    setIsDirty(false)
    setAutosaveStatus("idle")
    setAutosaveSavedAt(null)
  }, [detailQuery.data, publishedVersionId, selectedSlug, versions])

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
    const block = createDefaultBlock(type)
    updateDocument((current) => ({
      blocks: [...current.blocks, block],
    }))
    setSelectedBlockId(block.id)
  }

  useEffect(() => {
    if (selectedBlock?.type !== "rich_text") {
      setSelectedRichNodeIndex(null)
      setRichSelectionMode(true)
    }
  }, [selectedBlock])

  const insertBlockAtIndex = useCallback(
    (type: PageBlockType, rawIndex: number) => {
      const block = createDefaultBlock(type)
      updateDocument((current) => {
        const nextBlocks = [...current.blocks]
        const index = Math.max(0, Math.min(rawIndex, nextBlocks.length))
        nextBlocks.splice(index, 0, block)
        return { blocks: nextBlocks }
      })
      setSelectedBlockId(block.id)
      setInlineEditingBlockId(block.id)
    },
    [updateDocument],
  )

  const handleRemoveBlock = (blockId: string) => {
    updateDocument((current) => ({
      blocks: current.blocks.filter((block) => block.id !== blockId),
    }))
    setSelectedBlockId((current) => (current === blockId ? "" : current))
    setInlineEditingBlockId((current) => (current === blockId ? null : current))
  }

  const handleDuplicateBlock = (blockId: string) => {
    updateDocument((current) => {
      const index = current.blocks.findIndex((block) => block.id === blockId)
      if (index < 0) return current
      const source = current.blocks[index]
      const duplicate = { ...source, id: createDefaultBlock(source.type).id } as PageBlock
      const nextBlocks = [...current.blocks]
      nextBlocks.splice(index + 1, 0, duplicate)
      return { blocks: nextBlocks }
    })
  }

  const handleMoveBlock = (blockId: string, direction: -1 | 1) => {
    updateDocument((current) => {
      const index = current.blocks.findIndex((block) => block.id === blockId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.blocks.length) return current
      const nextBlocks = [...current.blocks]
      const [block] = nextBlocks.splice(index, 1)
      nextBlocks.splice(nextIndex, 0, block)
      return { blocks: nextBlocks }
    })
  }

  const handlePublish = async () => {
    if (!selectedVersionId) {
      setFeedback({ tone: "danger", message: "Seleciona uma versao para publicar." })
      return
    }
    setFeedback(null)
    try {
      await publishMutation.mutateAsync({
        slug: selectedSlug,
        versionId: selectedVersionId,
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
    setSelectedBlockId(nextDoc.blocks[0]?.id ?? "")
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
    setSelectedBlockId(newImage.id)
  }

  const startDragFromLibrary = (blockType: PageBlockType, event: DragEvent<HTMLElement>) => {
    dragPayloadRef.current = { kind: "library", blockType }
    event.dataTransfer.effectAllowed = "copyMove"
    event.dataTransfer.setData("text/plain", `library:${blockType}`)
  }

  const startDragBlock = (blockId: string, event: DragEvent<HTMLElement>) => {
    dragPayloadRef.current = { kind: "block", blockId }
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", `block:${blockId}`)
    setSelectedBlockId(blockId)
  }

  const clearDragState = useCallback(() => {
    dragPayloadRef.current = null
    setDragOverIndex(null)
  }, [])

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
      setSelectedBlockId(payload.blockId)
    },
    [clearDragState, insertBlockAtIndex, updateDocument],
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
        description="Fase 3: layout avancado com secao em 12 colunas, espacamentos finos, guias e edicao inline."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
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
            <Button type="button" className="rounded-full" onClick={() => void handleSaveDraft("manual")} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {saveDraftMutation.isPending ? "A guardar..." : "Guardar"}
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void handlePublish()} disabled={isSaving || !selectedVersionId}>
              <Send className="mr-2 h-4 w-4" />
              {publishMutation.isPending ? "A publicar..." : "Publicar"}
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => handlePreview()} disabled={isSaving}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleRollback()} disabled={isSaving || !selectedVersionId}>
              <FileClock className="mr-2 h-4 w-4" />
              Rollback
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleUnpublish()} disabled={isSaving || !publishedVersionId}>
              <XCircle className="mr-2 h-4 w-4" />
              Despublicar
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setAutosaveEnabled((current) => !current)}>
              {autosaveEnabled ? "Autosave ligado" : "Autosave desligado"}
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowLayoutGuides((current) => !current)}>
              {showLayoutGuides ? "Guias on" : "Guias off"}
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setSnapSpacingToGrid((current) => !current)}>
              {snapSpacingToGrid ? "Snap 4px on" : "Snap 4px off"}
            </Button>
          </div>
        </div>

        {feedback ? (
          <div
            className={[
              "mt-3 rounded-xl border px-4 py-3 text-sm font-medium",
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 gap-3">
        <aside
          className={[
            "flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 transition-all",
            leftSidebarCollapsed ? "w-14" : "w-[300px]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            {!leftSidebarCollapsed ? (
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Blocos e estrutura</p>
            ) : null}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLeftSidebarCollapsed((current) => !current)}>
              {leftSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {leftSidebarCollapsed ? (
            <div className="flex flex-1 items-center justify-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 [writing-mode:vertical-rl]">
              Blocos
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Biblioteca</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {BLOCK_LIBRARY.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={(event) => startDragFromLibrary(item.type, event)}
                    onClick={() => handleAddBlock(item.type)}
                    className="flex items-center justify-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 transition hover:border-sky-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Estrutura</p>
              <div className="mt-3 space-y-2">
                {documentDraft.blocks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">Nenhum bloco ainda.</p>
                ) : (
                  documentDraft.blocks.map((block, index) => (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={(event) => startDragBlock(block.id, event)}
                      onDragEnd={clearDragState}
                      className={[
                        "rounded-xl border bg-white p-2.5",
                        selectedBlockId === block.id ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200",
                      ].join(" ")}
                    >
                      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setSelectedBlockId(block.id)}>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Bloco {index + 1}</span>
                          <span className="block truncate text-xs font-semibold text-slate-900">{getBlockLabel(block)}</span>
                        </span>
                        <GripVertical className="h-4 w-4 text-slate-400" />
                      </button>
                      <div className="mt-2 flex gap-1.5">
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg" onClick={() => handleMoveBlock(block.id, -1)} disabled={index === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg" onClick={() => handleMoveBlock(block.id, 1)} disabled={index === documentDraft.blocks.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg" onClick={() => handleDuplicateBlock(block.id)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg text-rose-600" onClick={() => handleRemoveBlock(block.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>

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

          <div className="relative h-[calc(100vh-220px)] min-h-[760px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4 xl:min-h-[820px]">
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
                "relative z-10 mb-2 h-2 rounded-full transition",
                dragOverIndex === 0 ? "bg-sky-400" : "bg-transparent",
              ].join(" ")}
            />

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
                        draggable
                        onDragStart={(event) => startDragBlock(block.id, event)}
                        onDragEnd={clearDragState}
                        onClick={() => {
                          setSelectedBlockId(block.id)
                        }}
                        onDoubleClick={() => {
                          setSelectedBlockId(block.id)
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
                        <div className="pointer-events-none absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                          <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                            <GripVertical className="mr-1 h-3 w-3" /> arrastar
                          </span>
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
                          <div
                            className="rich-text-editor min-h-[70px] max-w-full overflow-hidden leading-8 [&_*]:max-w-full [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                            onClick={(event) => {
                              setSelectedBlockId(block.id)
                              if (!richSelectionMode) {
                                setSelectedRichNodeIndex(null)
                                return
                              }
                              const target = event.target as HTMLElement | null
                              const node = target?.closest?.("[data-me-node]") as HTMLElement | null
                              if (!node) {
                                setSelectedRichNodeIndex(null)
                                return
                              }
                              const value = Number(node.getAttribute("data-me-node") ?? "-1")
                              if (Number.isFinite(value) && value >= 0) {
                                setSelectedRichNodeIndex(value)
                              }
                            }}
                            dangerouslySetInnerHTML={{
                              __html:
                                isSelected && richSelectionMode
                                  ? annotateRichTextNodes(block.content, selectedRichNodeIndex)
                                  : block.content,
                            }}
                          />
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
                            <span
                              contentEditable={isInlineEditing}
                              suppressContentEditableWarning
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
                              className={isInlineEditing ? "inline-flex rounded-full bg-[#242742] px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-white ring-2 ring-sky-200 outline-none" : "inline-flex rounded-full bg-[#242742] px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-white"}
                            >
                              {block.label}
                            </span>
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
                          "my-2 h-2 rounded-full transition",
                          dragOverIndex === index + 1 ? "bg-sky-400" : "bg-transparent",
                        ].join(" ")}
                      />
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
              {!selectedBlock ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  Seleciona um bloco no canvas para editar.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-900">{getBlockLabel(selectedBlock)}</p>

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
                    <>
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
                    </>
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

      <section className="grid gap-3 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileClock className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-950">Historico de versoes</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {versions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Ainda nao ha versoes para esta pagina.
              </p>
            ) : (
              versions.map((version) => {
                const isPublished = version.id === publishedVersionId
                const isLoaded = version.id === selectedVersion?.id
                return (
                  <div key={version.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">Versao {version.version_number}</p>
                      {isPublished ? (
                        <StatusBadge label="Publicada" tone="success" />
                      ) : version.status === "draft" ? (
                        <StatusBadge label="Draft" tone="warning" />
                      ) : (
                        <StatusBadge label="Arquivada" tone="neutral" />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(version.created_at)}</p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => handleLoadVersion(version)}>
                        {isLoaded ? "Carregada" : "Carregar"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelectedVersionId(version.id)}>
                        Selecionar
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
          <p>
            Builder Fase 3: colunas, controle de layout por secao (12-grid, padding/margin/fundo), guias visuais e snap de espacamento.
          </p>
          <p>
            Preview publico:{" "}
            <a href={getPublicPathForSlug(selectedSlug)} target="_blank" rel="noreferrer" className="font-semibold underline">
              {window.location.origin}
              {getPublicPathForSlug(selectedSlug)}
            </a>
          </p>
          <p>
            Atalho:{" "}
            <a href={ROUTES.ADMIN_PAGE_EDITOR} className="font-semibold underline">
              {ROUTES.ADMIN_PAGE_EDITOR}
            </a>
          </p>
        </article>
      </section>
    </div>
  )
}
