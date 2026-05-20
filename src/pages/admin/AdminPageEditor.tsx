import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import grapesjs, { type Editor as GrapesEditor } from "grapesjs"
import "grapesjs/dist/css/grapes.min.css"
import "tinymce/skins/ui/oxide/skin.css"
import "tinymce/skins/content/default/content.css"
import {
  Eye,
  FileClock,
  ImagePlus,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  UploadCloud,
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
import {
  appendImageSection,
  createCanvasStyleLinks,
  extractProjectDataFromVersion,
  getGrapesSnapshot,
  registerDefaultBlocks,
  registerTinyMceRte,
  syncEditorAssets,
} from "@/pages/admin/page-editor/grapesEditor"
import { getEditorBaselineHtml } from "@/pages/public/editorBaseline"
import type { AdminSitePageAsset, AdminSitePageVersion, SitePageSlug } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"
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

function resolveInitialVersion(versions: AdminSitePageVersion[], publishedId: string | null) {
  if (publishedId) {
    const publishedVersion = versions.find((item) => item.id === publishedId)
    if (publishedVersion) return publishedVersion
  }

  const latestDraft = versions.find((item) => item.status === "draft")
  if (latestDraft) return latestDraft

  return versions[0] ?? null
}

export function AdminPageEditor() {
  const [selectedSlug, setSelectedSlug] = useState<SitePageSlug>("home")
  const [selectedVersionId, setSelectedVersionId] = useState<string>("")
  const [isDirty, setIsDirty] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [editorReady, setEditorReady] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [uploadingAsset, setUploadingAsset] = useState(false)

  const editorRef = useRef<GrapesEditor | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const richTextToolbarRef = useRef<HTMLDivElement | null>(null)
  const loadedVersionIdRef = useRef<string>("")
  const loadedSlugRef = useRef<string>("")
  const hydratingEditorRef = useRef(false)

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
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions],
  )

  const destroyEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.destroy()
    editorRef.current = null
    setEditorReady(false)
  }, [])

  const mountEditorForVersion = useCallback(
    (version: AdminSitePageVersion | null) => {
      const container = editorContainerRef.current
      if (!container) return

      const fallbackHtml = getEditorBaselineHtml(selectedSlug)
      const pageTitle = detailQuery.data?.page.title ?? pageSummary?.title ?? DEFAULT_PAGE_TITLES[selectedSlug]
      const projectData = extractProjectDataFromVersion({
        slug: selectedSlug,
        title: pageTitle,
        layoutJson: version?.layout_json,
        styleJson: version?.style_json,
        fallbackHtml,
      })

      destroyEditor()
      hydratingEditorRef.current = true
      setEditorReady(false)
      container.innerHTML = ""

      const editor = grapesjs.init({
        container,
        height: "100%",
        width: "auto",
        storageManager: false,
        noticeOnUnload: false,
        selectorManager: {
          componentFirst: true,
        },
        assetManager: {
          upload: false,
          autoAdd: false,
          assets: [],
        },
        deviceManager: {
          devices: [
            { id: "desktop", name: "Desktop", width: "" },
            { id: "tablet", name: "Tablet", width: "768px", widthMedia: "992px" },
            { id: "mobile", name: "Mobile", width: "390px", widthMedia: "575px" },
          ],
        },
        styleManager: {
          sectors: [
            {
              name: "Layout",
              open: true,
              properties: ["display", "position", "top", "right", "bottom", "left"],
            },
            {
              name: "Espacamento",
              open: true,
              properties: [
                "margin",
                "padding",
                "width",
                "height",
                "max-width",
                "min-height",
              ],
            },
            {
              name: "Tipografia",
              open: true,
              properties: [
                "font-family",
                "font-size",
                "font-weight",
                "line-height",
                "letter-spacing",
                "color",
                "text-align",
                "text-decoration",
                "text-transform",
              ],
            },
            {
              name: "Decoracao",
              open: false,
              properties: [
                "background-color",
                "border",
                "border-radius",
                "box-shadow",
                "opacity",
              ],
            },
          ],
        },
        canvas: {
          styles: createCanvasStyleLinks(),
        },
        plugins: [
          (instance) => {
            registerTinyMceRte(instance, richTextToolbarRef.current)
            registerDefaultBlocks(instance)
          },
        ],
      })

      editorRef.current = editor

      editor.on("load", () => {
        editor.loadProjectData(projectData)
        syncEditorAssets(editor, assets)

        window.setTimeout(() => {
          if (editorRef.current !== editor) return

          editor.clearDirtyCount()
          editor.refresh({ tools: true })
          hydratingEditorRef.current = false
          setEditorReady(true)
          setIsDirty(false)
        }, 0)
      })

      editor.on("update", () => {
        if (hydratingEditorRef.current) return
        setIsDirty(true)
      })
    },
    [assets, destroyEditor, detailQuery.data?.page.title, pageSummary?.title, selectedSlug],
  )

  useEffect(() => {
    return () => {
      destroyEditor()
    }
  }, [destroyEditor])

  useEffect(() => {
    if (!isFullscreen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  useEffect(() => {
    if (!detailQuery.data) return

    const versionToLoad = resolveInitialVersion(versions, publishedVersionId)

    if (!versionToLoad) {
      loadedSlugRef.current = selectedSlug
      loadedVersionIdRef.current = ""
      setSelectedVersionId("")
      mountEditorForVersion(null)
      return
    }

    if (loadedVersionIdRef.current === versionToLoad.id && loadedSlugRef.current === selectedSlug) {
      return
    }

    loadedSlugRef.current = selectedSlug
    loadedVersionIdRef.current = versionToLoad.id
    setSelectedVersionId(versionToLoad.id)
    mountEditorForVersion(versionToLoad)
  }, [detailQuery.data, mountEditorForVersion, publishedVersionId, selectedSlug, versions])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    syncEditorAssets(editor, assets)
  }, [assets])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editorReady) return

    window.setTimeout(() => {
      editor.refresh({ tools: true })
    }, 0)
  }, [editorReady, isFullscreen])

  const handleSaveDraft = async () => {
    const editor = editorRef.current
    if (!editor) {
      setFeedback({ tone: "danger", message: "O editor ainda nao terminou de carregar." })
      return
    }

    setFeedback(null)

    try {
      const snapshot = getGrapesSnapshot(editor)
      const response = await saveDraftMutation.mutateAsync({
        slug: selectedSlug,
        title: detailQuery.data?.page.title ?? pageSummary?.title ?? DEFAULT_PAGE_TITLES[selectedSlug],
        layoutJson: {
          editor: "grapesjs",
          schema_version: 2,
          projectData: snapshot.projectData,
          html: snapshot.html,
        },
        styleJson: {
          css: snapshot.css,
        },
        metadata: {
          editor: "grapesjs",
          updated_at: new Date().toISOString(),
        },
      })

      editor.clearDirtyCount()
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
    loadedSlugRef.current = selectedSlug
    loadedVersionIdRef.current = version.id
    setSelectedVersionId(version.id)
    mountEditorForVersion(version)
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
        syncEditorAssets(editorRef.current, [...assets, response.asset])
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

  const appendImageBlock = (asset: AdminSitePageAsset) => {
    const editor = editorRef.current
    if (!editor) {
      setFeedback({ tone: "danger", message: "O editor ainda nao terminou de carregar." })
      return
    }

    appendImageSection(editor, {
      publicUrl: asset.public_url,
      fileName: asset.file_name,
    })

    setIsDirty(true)
    setFeedback({ tone: "success", message: "Bloco de imagem inserido no fim da pagina." })
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
    <div
      className={[
        "space-y-6",
        isFullscreen
          ? "fixed inset-0 z-[90] overflow-auto bg-[#f3f7fa] p-4 sm:p-6 lg:p-8"
          : "",
      ].join(" ")}
    >
      <PageHeader
        title="Editor Visual de Paginas"
        description="Editor com GrapesJS + TinyMCE para Home e paginas institucionais, com rascunho, publicacao e historico."
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
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setIsFullscreen((current) => !current)}>
              {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
              {isFullscreen ? "Fechar tela cheia" : "Abrir tela cheia"}
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

      <section className="space-y-6">
        <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
              Canvas GrapesJS - {getTitleForSlug(selectedSlug)}
            </p>
            <div
              ref={richTextToolbarRef}
              className="me-page-editor-rte-toolbar mt-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2"
            />
          </div>

          <div className={["me-page-editor-grapes-shell", isFullscreen ? "me-page-editor-grapes-shell--fullscreen" : ""].join(" ")}>
            <div ref={editorContainerRef} className="me-page-editor-grapes-root" />
            {(detailQuery.isLoading || !editorReady) ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <LoadingState message="A carregar conteudo da pagina..." />
              </div>
            ) : null}
          </div>
        </article>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full rounded-full"
                    onClick={() => appendImageBlock(asset)}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Inserir bloco de imagem
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
      </section>

      <footer className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-6 text-slate-600">
        <p>
          Migracao controlada: o editor usa <strong>GrapesJS</strong> com texto rico em <strong>TinyMCE</strong>, mas continua a publicar HTML/CSS compatibilizados com o renderer atual.
        </p>
        <p>
          Home: para manter as reviews dinamicas, usa o bloco <strong>Widget Reviews</strong>.
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
