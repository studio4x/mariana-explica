import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useBlocker } from "react-router-dom"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileClock,
  ImagePlus,
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
import {
  createSitePagePreviewUrl,
  storeSitePagePreview,
} from "@/lib/site-page-preview"
import {
  createDefaultBlock,
  getDefaultDocumentForSlug,
  getDefaultStyleCss,
  normalizeBuilderDocument,
  renderDocumentToHtml,
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
  { type: "divider", label: "Divisor" },
  { type: "spacer", label: "Espaco" },
]

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

  const projectData =
    json.projectData && typeof json.projectData === "object"
      ? (json.projectData as Record<string, unknown>)
      : json

  return normalizeBuilderDocument(projectData, slug)
}

function getBlockLabel(block: PageBlock) {
  if (block.type === "heading") return `Titulo H${block.level}`
  if (block.type === "rich_text") return "Texto rico"
  if (block.type === "image") return "Imagem"
  if (block.type === "button") return "Botao"
  if (block.type === "divider") return "Divisor"
  return "Espaco"
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

  const richTextRef = useRef<RichTextEditorHandle | null>(null)
  const loadedSlugRef = useRef<string>("")
  const loadedVersionRef = useRef<string>("")
  const autosaveTimerRef = useRef<number | null>(null)

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

  const confirmDiscardChanges = useCallback((nextActionLabel: string) => {
    if (!isDirty) return true
    return window.confirm(`Existem alteracoes nao guardadas. Queres continuar para ${nextActionLabel}?`)
  }, [isDirty])

  useEffect(() => {
    if (!detailQuery.data) return

    const initialVersion = resolveInitialVersion(versions, publishedVersionId)
    const initialDoc = extractDocumentFromVersion(selectedSlug, initialVersion)
    const shouldReload =
      loadedSlugRef.current !== selectedSlug ||
      loadedVersionRef.current !== (initialVersion?.id ?? "")

    if (!shouldReload) return

    loadedSlugRef.current = selectedSlug
    loadedVersionRef.current = initialVersion?.id ?? ""
    setSelectedVersionId(initialVersion?.id ?? "")
    setDocumentDraft(initialDoc)
    setSelectedBlockId(initialDoc.blocks[0]?.id ?? "")
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
    }, 5000)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [autosaveEnabled, isDirty, isSaving])

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

  const handleRemoveBlock = (blockId: string) => {
    updateDocument((current) => ({
      blocks: current.blocks.filter((block) => block.id !== blockId),
    }))
    setSelectedBlockId((current) => (current === blockId ? "" : current))
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

  const updateSelectedBlock = (updater: (block: PageBlock) => PageBlock) => {
    if (!selectedBlockId) return
    updateDocument((current) => ({
      blocks: current.blocks.map((block) => (block.id === selectedBlockId ? updater(block) : block)),
    }))
  }

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

  const handleSaveDraft = useCallback(async (trigger: "manual" | "autosave" = "manual") => {
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
  }, [createSnapshot, detailQuery, pageSummary?.title, pagesQuery, saveDraftMutation, selectedSlug])

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
    <div className="space-y-6">
      <PageHeader
        title="Editor Visual de Paginas"
        description="Builder proprio por blocos com fluxo estilo Elementor: selecao, canvas e painel lateral de propriedades."
      />

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-end">
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

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-full" onClick={() => void handleSaveDraft("manual")} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {saveDraftMutation.isPending ? "A guardar..." : "Guardar rascunho"}
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void handlePublish()} disabled={isSaving || !selectedVersionId}>
              <Send className="mr-2 h-4 w-4" />
              {publishMutation.isPending ? "A publicar..." : "Publicar"}
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleUnpublish()} disabled={isSaving || !publishedVersionId}>
              <XCircle className="mr-2 h-4 w-4" />
              {unpublishMutation.isPending ? "A despublicar..." : "Despublicar"}
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleRollback()} disabled={isSaving || !selectedVersionId}>
              <FileClock className="mr-2 h-4 w-4" />
              Rollback
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge
              label={isDirty ? "Rascunho com alteracoes" : publishedVersionId ? "Publicado" : "Sem publicacao"}
              tone={isDirty ? "warning" : publishedVersionId ? "success" : "neutral"}
            />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">
              {autosaveLabel}
            </span>
            <Button
              type="button"
              variant={autosaveEnabled ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setAutosaveEnabled((current) => !current)}
            >
              {autosaveEnabled ? "Autosave ligado" : "Autosave desligado"}
            </Button>
          </div>
        </div>

        {feedback ? (
          <div
            className={[
              "mt-4 rounded-2xl border px-4 py-3 text-sm font-medium",
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Blocos</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {BLOCK_LIBRARY.map((item) => (
              <Button key={item.type} type="button" variant="outline" size="sm" className="justify-start rounded-xl" onClick={() => handleAddBlock(item.type)}>
                <Plus className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
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
                  className={[
                    "rounded-xl border bg-white p-3",
                    selectedBlockId === block.id ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200",
                  ].join(" ")}
                >
                  <button type="button" className="w-full text-left" onClick={() => setSelectedBlockId(block.id)}>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Bloco {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{getBlockLabel(block)}</p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleMoveBlock(block.id, -1)} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleMoveBlock(block.id, 1)} disabled={index === documentDraft.blocks.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleDuplicateBlock(block.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 rounded-lg text-rose-600" onClick={() => handleRemoveBlock(block.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Canvas visual</p>
            {livePreviewUrl ? (
              <a href={livePreviewUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 underline">
                Ultimo preview
              </a>
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 min-h-[620px]">
            {documentDraft.blocks.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600">
                Adiciona blocos no painel da esquerda para montar a pagina.
              </div>
            ) : (
              documentDraft.blocks.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setSelectedBlockId(block.id)}
                  className={[
                    "w-full rounded-xl border bg-white p-4 text-left transition",
                    selectedBlockId === block.id ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200",
                  ].join(" ")}
                >
                  {block.type === "heading" ? (
                    <p className="font-display text-3xl font-bold" style={{ color: block.color, textAlign: block.align }}>
                      {block.content}
                    </p>
                  ) : null}
                  {block.type === "rich_text" ? (
                    <div className="rich-text-editor" dangerouslySetInnerHTML={{ __html: block.content }} />
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
                      <span className="inline-flex rounded-full bg-[#242742] px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-white">
                        {block.label}
                      </span>
                    </div>
                  ) : null}
                  {block.type === "divider" ? <hr style={{ borderColor: block.color }} /> : null}
                  {block.type === "spacer" ? <div style={{ height: `${block.height}px` }} /> : null}
                </button>
              ))
            )}
          </div>
        </article>

        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Inspector</p>
          {!selectedBlock ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Seleciona um bloco no canvas para editar as propriedades.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm font-bold text-slate-900">{getBlockLabel(selectedBlock)}</p>
              {selectedBlock.type === "heading" ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600">
                    Texto
                    <input
                      value={selectedBlock.content}
                      onChange={(event) => updateSelectedBlock((block) => block.type === "heading" ? { ...block, content: event.target.value } : block)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Nivel
                      <select
                        value={selectedBlock.level}
                        onChange={(event) => updateSelectedBlock((block) => block.type === "heading" ? { ...block, level: Number(event.target.value) as 1 | 2 | 3 | 4 } : block)}
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
                        onChange={(event) => updateSelectedBlock((block) => block.type === "heading" ? { ...block, align: event.target.value as "left" | "center" | "right" } : block)}
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
                <RichTextEditor
                  ref={richTextRef}
                  value={selectedBlock.content}
                  onChange={(value) => updateSelectedBlock((block) => block.type === "rich_text" ? { ...block, content: value } : block)}
                  toolbarVariant="compact"
                  minHeightPx={200}
                />
              ) : null}
              {selectedBlock.type === "image" ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600">
                    URL da imagem
                    <input
                      value={selectedBlock.src}
                      onChange={(event) => updateSelectedBlock((block) => block.type === "image" ? { ...block, src: event.target.value } : block)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Alt
                    <input
                      value={selectedBlock.alt}
                      onChange={(event) => updateSelectedBlock((block) => block.type === "image" ? { ...block, alt: event.target.value } : block)}
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
                      onChange={(event) => updateSelectedBlock((block) => block.type === "button" ? { ...block, label: event.target.value } : block)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    URL
                    <input
                      value={selectedBlock.href}
                      onChange={(event) => updateSelectedBlock((block) => block.type === "button" ? { ...block, href: event.target.value } : block)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Alinhamento
                    <select
                      value={selectedBlock.align}
                      onChange={(event) => updateSelectedBlock((block) => block.type === "button" ? { ...block, align: event.target.value as "left" | "center" | "right" } : block)}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    >
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                    </select>
                  </label>
                </>
              ) : null}
              {selectedBlock.type === "divider" ? (
                <label className="block text-xs font-semibold text-slate-600">
                  Cor (CSS)
                  <input
                    value={selectedBlock.color}
                    onChange={(event) => updateSelectedBlock((block) => block.type === "divider" ? { ...block, color: event.target.value } : block)}
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
                    max={240}
                    onChange={(event) => updateSelectedBlock((block) => block.type === "spacer" ? { ...block, height: Number(event.target.value) } : block)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </label>
              ) : null}
            </div>
          )}
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Biblioteca de imagens</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">Assets</h2>
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-300 hover:bg-white">
              <UploadCloud className="mr-2 h-4 w-4" />
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

          <div className="space-y-3">
            {assets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Ainda nao existem imagens para esta pagina.
              </p>
            ) : (
              assets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img src={asset.public_url} alt={asset.file_name} className="h-full w-full object-cover" />
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-900">{asset.file_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(asset.created_at)}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3 w-full rounded-full" onClick={() => handleInsertImage(asset)}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Inserir no canvas
                  </Button>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileClock className="h-4 w-4 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-950">Historico de versoes</h2>
          </div>
          <div className="space-y-3">
            {versions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Ainda nao ha versoes para esta pagina.
              </p>
            ) : (
              versions.map((version) => {
                const isPublished = version.id === publishedVersionId
                const isLoaded = version.id === selectedVersion?.id
                return (
                  <div key={version.id} className="rounded-2xl border border-slate-200 p-3">
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
      </section>

      <footer className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-6 text-slate-600">
        <p>
          Builder Fase 1: blocos nativos com inspetor lateral, autosave, preview, publicacao e rollback.
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
      </footer>
    </div>
  )
}
