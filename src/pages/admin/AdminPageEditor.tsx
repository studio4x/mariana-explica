import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import grapesjs, { type Editor } from "grapesjs"
import "grapesjs/dist/css/grapes.min.css"
import tinymce from "tinymce/tinymce"
import "tinymce/icons/default"
import "tinymce/models/dom"
import "tinymce/themes/silver"
import "tinymce/plugins/autolink"
import "tinymce/plugins/code"
import "tinymce/plugins/link"
import "tinymce/plugins/lists"
import "tinymce/plugins/table"
import "tinymce/plugins/wordcount"
import {
  Eye,
  FileClock,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Type,
  UploadCloud,
  X,
} from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  useAdminSitePageDetail,
  useAdminSitePages,
  usePublishAdminSitePageVersion,
  useRollbackAdminSitePageVersion,
  useSaveAdminSitePageDraft,
  useUploadAdminSitePageAssetFile,
} from "@/hooks/useAdmin"
import { ROUTES } from "@/lib/constants"
import type { AdminSitePageAsset, AdminSitePageVersion, SitePageSlug } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"
import { getEditorBaselineHtml } from "@/pages/public/editorBaseline"
import "@/styles/admin-page-editor.css"

const PAGE_OPTIONS: Array<{ slug: SitePageSlug; label: string; publicPath: string }> = [
  { slug: "home", label: "Home", publicPath: "/" },
  { slug: "sobre", label: "Sobre", publicPath: "/sobre" },
  { slug: "privacidade", label: "Privacidade", publicPath: "/privacidade" },
  { slug: "cookies", label: "Cookies", publicPath: "/cookies" },
  { slug: "termos", label: "Termos de uso", publicPath: "/termos-de-uso" },
]

const DEFAULT_PAGE_TITLES: Record<SitePageSlug, string> = {
  home: "Home",
  sobre: "Sobre",
  privacidade: "Privacidade",
  cookies: "Cookies",
  termos: "Termos de uso",
}

const DEFAULT_CANVAS_HTML =
  '<section class="me-section"><div class="me-container"><h2>Nova secao</h2><p>Edite os blocos desta pagina visualmente.</p></div></section>'

function normalizeProjectData(layoutJson: Record<string, unknown>) {
  const projectDataCandidate =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : layoutJson

  const hasPages = Array.isArray(projectDataCandidate.pages) && projectDataCandidate.pages.length > 0

  if (!hasPages) {
    return null
  }

  return projectDataCandidate
}

function getTitleForSlug(slug: SitePageSlug | string) {
  const option = PAGE_OPTIONS.find((item) => item.slug === slug)
  if (option) return option.label
  return String(slug)
}

function getPublicPathForSlug(slug: SitePageSlug | string) {
  const option = PAGE_OPTIONS.find((item) => item.slug === slug)
  if (option) return option.publicPath
  return "/"
}

function extractCss(styleJson: Record<string, unknown> | undefined) {
  if (!styleJson || typeof styleJson !== "object") return ""
  const css = styleJson.css
  if (typeof css === "string") return css
  return ""
}

function extractHtml(layoutJson: Record<string, unknown> | undefined) {
  if (!layoutJson || typeof layoutJson !== "object") return ""

  const htmlFromRoot = layoutJson.html
  if (typeof htmlFromRoot === "string" && htmlFromRoot.trim().length > 0) {
    return htmlFromRoot
  }

  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : layoutJson

  const pages = Array.isArray(projectData.pages) ? projectData.pages : []
  const firstPage = pages[0]
  if (!firstPage || typeof firstPage !== "object") return ""

  const pageAsRecord = firstPage as Record<string, unknown>
  const component = pageAsRecord.component
  if (typeof component === "string" && component.trim().length > 0) {
    return component
  }

  const frames = Array.isArray(pageAsRecord.frames) ? pageAsRecord.frames : []
  const firstFrame = frames[0]
  if (!firstFrame || typeof firstFrame !== "object") return ""

  const frameComponent = (firstFrame as Record<string, unknown>).component
  if (typeof frameComponent === "string" && frameComponent.trim().length > 0) {
    return frameComponent
  }

  return ""
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

function registerDefaultBlocks(editor: Editor) {
  const blockManager = editor.BlockManager

  blockManager.add("me-section", {
    label: "Section",
    category: "Estrutura",
    content:
      '<section class="me-section"><div class="me-container"><h2>Titulo da secao</h2><p>Descricao da secao.</p></div></section>',
  })

  blockManager.add("me-container", {
    label: "Container",
    category: "Estrutura",
    content: '<div class="me-container"><p>Container</p></div>',
  })

  blockManager.add("me-columns", {
    label: "Columns",
    category: "Estrutura",
    content:
      '<div class="me-columns"><div class="me-column"><p>Coluna A</p></div><div class="me-column"><p>Coluna B</p></div></div>',
  })

  blockManager.add("me-heading", {
    label: "Heading",
    category: "Conteudo",
    content: "<h2>Titulo</h2>",
  })

  blockManager.add("me-rich-text", {
    label: "Rich Text",
    category: "Conteudo",
    content: '<div data-rich-text="true"><p>Texto com formatacao.</p></div>',
  })

  blockManager.add("me-image", {
    label: "Image",
    category: "Conteudo",
    content: { type: "image", attributes: { alt: "Imagem", src: "https://placehold.co/960x540?text=Imagem" } },
  })

  blockManager.add("me-button", {
    label: "Button",
    category: "Conteudo",
    content: '<a class="me-btn" href="#">Botao</a>',
  })

  blockManager.add("me-divider", {
    label: "Divider",
    category: "Conteudo",
    content: '<hr class="me-divider" />',
  })

  blockManager.add("me-spacer", {
    label: "Spacer",
    category: "Conteudo",
    content: '<div class="me-spacer" style="height:32px"></div>',
  })

  blockManager.add("me-widget-home-reviews", {
    label: "Widget Reviews (Home)",
    category: "Widgets",
    content:
      '<section data-me-widget="home-reviews" class="me-widget-slot"><div class="me-widget-slot__label">Widget dinamico: reviews da Home</div></section>',
  })
}

function upsertEditorAssets(editor: Editor, assets: AdminSitePageAsset[]) {
  const manager = editor.AssetManager
  manager.getAll().reset()
  manager.add(
    assets.map((asset) => ({
      src: asset.public_url,
      name: asset.file_name,
      type: "image",
    })),
  )
}

export function AdminPageEditor() {
  const [selectedSlug, setSelectedSlug] = useState<SitePageSlug>("home")
  const [selectedVersionId, setSelectedVersionId] = useState<string>("")
  const [isDirty, setIsDirty] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [uploadingAsset, setUploadingAsset] = useState(false)
  const [tinyOpen, setTinyOpen] = useState(false)
  const [tinyDraftContent, setTinyDraftContent] = useState("")

  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const tinyRef = useRef<{
    remove: () => void
    getContent: () => string
    setContent: (content: string) => void
  } | null>(null)
  const activeTextComponentRef = useRef<unknown>(null)
  const isApplyingRemoteStateRef = useRef(false)
  const loadedVersionIdRef = useRef<string>("")
  const loadedSlugRef = useRef<string>("")

  const pagesQuery = useAdminSitePages()
  const detailQuery = useAdminSitePageDetail(selectedSlug)
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const publishMutation = usePublishAdminSitePageVersion()
  const rollbackMutation = useRollbackAdminSitePageVersion()
  const uploadAssetMutation = useUploadAdminSitePageAssetFile()

  const pageSummary = useMemo(() => {
    return (pagesQuery.data ?? []).find((page) => page.slug === selectedSlug) ?? null
  }, [pagesQuery.data, selectedSlug])

  const versions = detailQuery.data?.versions ?? []
  const assets = detailQuery.data?.assets ?? []
  const publishedVersionId = detailQuery.data?.page.published_version_id ?? null

  const publishTargetVersionId = selectedVersionId || resolveInitialVersion(versions, publishedVersionId)?.id || ""

  const applyVersionIntoEditor = useCallback((version: AdminSitePageVersion | null, baselineHtml?: string) => {
    const editor = editorRef.current
    if (!editor) return
    const safeBaselineHtml = baselineHtml && baselineHtml.trim().length > 0 ? baselineHtml : DEFAULT_CANVAS_HTML

    isApplyingRemoteStateRef.current = true
    try {
      if (!version) {
        editor.setComponents(safeBaselineHtml)
        editor.setStyle("")
        setSelectedVersionId("")
        setIsDirty(false)
        loadedVersionIdRef.current = ""
        return
      }

      const projectData = normalizeProjectData(version.layout_json)
      if (projectData) {
        editor.loadProjectData(projectData as never)
      } else {
        const fallbackHtml = extractHtml(version.layout_json) || safeBaselineHtml
        editor.setComponents(fallbackHtml)
      }
      editor.setStyle(extractCss(version.style_json))
      setSelectedVersionId(version.id)
      setIsDirty(false)
      loadedVersionIdRef.current = version.id
    } finally {
      isApplyingRemoteStateRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!editorContainerRef.current || editorRef.current) return

    const editor = grapesjs.init({
      container: editorContainerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      selectorManager: {
        componentFirst: true,
      },
      assetManager: {
        upload: false,
      },
      canvas: {
        styles: [
          "body { margin:0; font-family: Inter, sans-serif; background: #ffffff; color:#0f172a; }",
          ".me-section { padding: 48px 0; }",
          ".me-container { width: min(1100px, calc(100% - 32px)); margin: 0 auto; }",
          ".me-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap: 24px; }",
          ".me-btn { display:inline-flex; align-items:center; justify-content:center; border-radius:9999px; padding: 12px 22px; background:#0f172a; color:#ffffff; text-decoration:none; font-weight:700; }",
          ".me-divider { border: 0; border-top: 1px solid #cbd5e1; }",
          ".me-spacer { width:100%; }",
          ".me-widget-slot { border:1px dashed #0f172a; border-radius:16px; padding:16px; background:#f8fafc; }",
          ".me-widget-slot__label { font-family: Inter, sans-serif; font-size: 13px; font-weight:700; color:#0f172a; text-align:center; }",
          "@media (max-width: 767px) { .me-columns { grid-template-columns: 1fr; } }",
        ],
      },
      styleManager: {
        sectors: [
          {
            name: "Espacamento",
            open: true,
            properties: ["margin", "padding"],
          },
          {
            name: "Tipografia",
            open: false,
            properties: ["font-family", "font-size", "font-weight", "letter-spacing", "line-height", "color", "text-align"],
          },
          {
            name: "Decoracao",
            open: false,
            properties: ["background-color", "background", "border", "border-radius", "box-shadow", "opacity"],
          },
          {
            name: "Layout",
            open: false,
            properties: ["display", "width", "height", "max-width", "min-height", "flex", "align-items", "justify-content"],
          },
        ],
      },
    })

    registerDefaultBlocks(editor)

    editor.on("update", () => {
      if (isApplyingRemoteStateRef.current) return
      setIsDirty(true)
    })

    editorRef.current = editor
    applyVersionIntoEditor(null, getEditorBaselineHtml(selectedSlug))

    return () => {
      editor.destroy()
      editorRef.current = null
    }
  }, [applyVersionIntoEditor, selectedSlug])

  useEffect(() => {
    if (!editorRef.current) return
    upsertEditorAssets(editorRef.current, assets)
  }, [assets])

  useEffect(() => {
    if (!detailQuery.data || !editorRef.current) return
    const baselineHtml = getEditorBaselineHtml(selectedSlug)

    const versionToLoad = resolveInitialVersion(versions, publishedVersionId)
    if (!versionToLoad) {
      loadedSlugRef.current = selectedSlug
      applyVersionIntoEditor(null, baselineHtml)
      return
    }

    if (loadedVersionIdRef.current === versionToLoad.id && loadedSlugRef.current === selectedSlug) {
      return
    }

    loadedSlugRef.current = selectedSlug
    applyVersionIntoEditor(versionToLoad, baselineHtml)
  }, [applyVersionIntoEditor, detailQuery.data, publishedVersionId, selectedSlug, versions])

  useEffect(() => {
    if (!tinyOpen || !textareaRef.current) return

    let active = true
    const target = textareaRef.current

    const initialize = async () => {
      const instances = await tinymce.init({
        target,
        menubar: false,
        branding: false,
        promotion: false,
        height: 360,
        plugins: "autolink link lists table code wordcount",
        toolbar:
          "undo redo | blocks | bold italic underline forecolor | alignleft aligncenter alignright | bullist numlist | link table | code",
        skin: false,
        content_css: false,
      })

      if (!active) {
        instances.forEach((instance) => instance.remove())
        return
      }

      tinyRef.current = instances[0] ?? null
      tinyRef.current?.setContent(tinyDraftContent || "<p></p>")
    }

    void initialize()

    return () => {
      active = false
      tinyRef.current?.remove()
      tinyRef.current = null
    }
  }, [tinyDraftContent, tinyOpen])

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions],
  )

  const openTinyEditor = () => {
    const editor = editorRef.current
    if (!editor) return

    const selected = editor.getSelected()
    if (!selected) {
      setFeedback({ tone: "danger", message: "Seleciona um bloco de texto para editar com TinyMCE." })
      return
    }

    const selectedType = String(selected.get("type") ?? "")
    const canEdit =
      selectedType === "text" ||
      selectedType === "textnode" ||
      selectedType === "link" ||
      Boolean(selected.get("editable"))

    if (!canEdit) {
      setFeedback({ tone: "danger", message: "Este bloco nao suporta edicao de texto rica." })
      return
    }

    activeTextComponentRef.current = selected
    const currentContent = String(selected.get("content") ?? selected.view?.el?.innerHTML ?? "")
    setTinyDraftContent(currentContent)
    setTinyOpen(true)
    setFeedback(null)
  }

  const closeTinyEditor = () => {
    setTinyOpen(false)
  }

  const applyTinyContent = () => {
    const selected = activeTextComponentRef.current as { set: (name: string, value: unknown) => void } | null
    const nextHtml = tinyRef.current?.getContent() ?? ""

    if (!selected) {
      setFeedback({ tone: "danger", message: "Bloco de texto nao encontrado. Seleciona novamente." })
      setTinyOpen(false)
      return
    }

    selected.set("content", nextHtml)
    setTinyOpen(false)
    setFeedback({ tone: "success", message: "Texto atualizado com TinyMCE." })
  }

  const handleSaveDraft = async () => {
    const editor = editorRef.current
    if (!editor) return

    setFeedback(null)
    try {
      const response = await saveDraftMutation.mutateAsync({
        slug: selectedSlug,
        title: detailQuery.data?.page.title ?? pageSummary?.title ?? DEFAULT_PAGE_TITLES[selectedSlug],
        layoutJson: {
          projectData: editor.getProjectData() as Record<string, unknown>,
        },
        styleJson: {
          css: editor.getCss(),
        },
        metadata: {
          editor: "grapesjs",
          updated_at: new Date().toISOString(),
        },
      })

      loadedVersionIdRef.current = response.version.id
      setSelectedVersionId(response.version.id)
      setIsDirty(false)
      setFeedback({ tone: "success", message: "Rascunho guardado com sucesso." })
      await detailQuery.refetch()
      await pagesQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel guardar o rascunho.",
      })
    }
  }

  const handlePublish = async () => {
    if (!publishTargetVersionId) {
      setFeedback({ tone: "danger", message: "Nao ha versao selecionada para publicar." })
      return
    }

    setFeedback(null)
    try {
      await publishMutation.mutateAsync({
        slug: selectedSlug,
        versionId: publishTargetVersionId,
      })

      setFeedback({ tone: "success", message: "Pagina publicada com sucesso." })
      await detailQuery.refetch()
      await pagesQuery.refetch()
      setIsDirty(false)
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel publicar esta versao.",
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
      setIsDirty(false)
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel executar o rollback.",
      })
    }
  }

  const handleLoadVersion = (version: AdminSitePageVersion) => {
    applyVersionIntoEditor(version, getEditorBaselineHtml(selectedSlug))
    setFeedback({ tone: "success", message: `Versao ${version.version_number} carregada no editor.` })
  }

  const handleUploadAsset = async (file: File) => {
    setUploadingAsset(true)
    setFeedback(null)
    try {
      const response = await uploadAssetMutation.mutateAsync({
        slug: selectedSlug,
        file,
      })

      if (editorRef.current) {
        const assetUrl = response.asset.public_url || response.upload.public_url || ""
        if (assetUrl) {
          editorRef.current.AssetManager.add({
            src: assetUrl,
            name: response.asset.file_name,
            type: "image",
          })
        }
      }

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

  const applyAssetToCanvas = (asset: AdminSitePageAsset) => {
    const editor = editorRef.current
    if (!editor) return

    const selected = editor.getSelected()
    const selectedType = String(selected?.get("type") ?? "")
    if (selected && selectedType === "image") {
      selected.addAttributes({
        src: asset.public_url,
        alt: asset.file_name,
      })
      setFeedback({ tone: "success", message: "Imagem substituida no bloco selecionado." })
      return
    }

    const wrapper = editor.getWrapper()
    if (!wrapper) return
    wrapper.append({
      type: "image",
      attributes: {
        src: asset.public_url,
        alt: asset.file_name,
      },
    })
    setFeedback({ tone: "success", message: "Imagem inserida no canvas." })
  }

  const handlePreview = () => {
    const publicPath = getPublicPathForSlug(selectedSlug)
    window.open(publicPath, "_blank", "noopener,noreferrer")
  }

  const isSaving =
    saveDraftMutation.isPending ||
    publishMutation.isPending ||
    rollbackMutation.isPending ||
    uploadAssetMutation.isPending

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
        description="Edita Home e paginas institucionais em modo visual com rascunho, publicacao e historico."
      />

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Pagina</span>
            <select
              value={selectedSlug}
              onChange={(event) => setSelectedSlug(event.target.value as SitePageSlug)}
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
            <Button type="button" className="rounded-full" onClick={() => void handleSaveDraft()} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {saveDraftMutation.isPending ? "A guardar..." : "Guardar rascunho"}
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void handlePublish()} disabled={isSaving || !publishTargetVersionId}>
              <Send className="mr-2 h-4 w-4" />
              {publishMutation.isPending ? "A publicar..." : "Publicar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void handleRollback()}
              disabled={isSaving || !selectedVersionId}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Rollback
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={openTinyEditor}>
              <Type className="mr-2 h-4 w-4" />
              Editar texto (TinyMCE)
            </Button>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge
              label={
                isDirty
                  ? "Rascunho com alteracoes"
                  : publishedVersionId
                    ? "Publicado"
                    : "Sem publicacao"
              }
              tone={isDirty ? "warning" : publishedVersionId ? "success" : "neutral"}
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                void detailQuery.refetch()
                void pagesQuery.refetch()
                setFeedback(null)
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
              Canvas GrapesJS - {getTitleForSlug(selectedSlug)}
            </p>
          </div>
          <div className="me-page-editor-canvas">
            <div ref={editorContainerRef} className="h-full w-full" />
            {detailQuery.isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <LoadingState message="A carregar conteudo da pagina..." />
              </div>
            ) : null}
          </div>
        </article>

        <aside className="space-y-6">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full rounded-full"
                      onClick={() => applyAssetToCanvas(asset)}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      Inserir / substituir
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleLoadVersion(version)}
                        >
                          {isLoaded ? "Carregada" : "Carregar"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
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
          </article>
        </aside>
      </section>

      {tinyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Editor de texto (TinyMCE)</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Atualiza o texto rico do bloco selecionado no canvas.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={closeTinyEditor}
                aria-label="Fechar editor de texto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <textarea ref={textareaRef} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={closeTinyEditor}>
                  Cancelar
                </Button>
                <Button type="button" className="rounded-full" onClick={applyTinyContent}>
                  Aplicar texto
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-6 text-slate-600">
        <p>
          Dica: para substituir uma imagem, seleciona um bloco de imagem no canvas e depois clica em{" "}
          <strong>Inserir / substituir</strong> na biblioteca de assets.
        </p>
        <p>
          Home: para manter as reviews dinamicas, usa o bloco <strong>Widget Reviews (Home)</strong> ou o placeholder{" "}
          <code>{"{{ME_WIDGET:home-reviews}}"}</code>.
        </p>
        <p>
          Preview publico:{" "}
          <a href={getPublicPathForSlug(selectedSlug)} target="_blank" rel="noreferrer" className="font-semibold underline">
            {window.location.origin}
            {getPublicPathForSlug(selectedSlug)}
          </a>
        </p>
        <p>
          Atalho: rota administrativa em{" "}
          <a href={ROUTES.ADMIN_PAGE_EDITOR} className="font-semibold underline">
            {ROUTES.ADMIN_PAGE_EDITOR}
          </a>
        </p>
      </footer>
    </div>
  )
}
