import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useLocation } from "react-router-dom"
import { ArrowRight, Link2, PencilLine, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
import { VisualEditorSidebar } from "./VisualEditorSidebar"
import {
  fetchAdminVisualEditorPageDetail,
  fetchPublicVisualEditorPage,
  publishVisualEditorPageVersion,
  restoreVisualEditorPageVersion,
  saveVisualEditorPageDraft,
} from "./api"
import { getVisualEditorPageDefinition } from "./page-definitions"
import type {
  VisualEditorDocument,
  VisualEditorFieldDefinition,
  VisualEditorFieldStyleValue,
  VisualEditorImageValue,
  VisualEditorLinkValue,
  VisualEditorPageDetail,
  VisualEditorPageKey,
  VisualEditorPageVersion,
  VisualEditorPublicPagePayload,
  VisualEditorSelectedEditable,
  VisualEditorStyleDocument,
} from "./types"
import {
  cloneVisualEditorDocument,
  getVisualEditorPathValue,
  mergeVisualEditorDocuments,
  setVisualEditorPathValue,
} from "./utils"
import {
  VISUAL_EDITOR_REFRESH_EVENT,
  broadcastVisualEditorRefresh,
  readVisualEditorRefreshPayload,
} from "./refresh"
import {
  cloneVisualEditorStyleDocument,
  getVisualEditorContainerStyle,
  getVisualEditorImageStyle,
  getVisualEditorImageWrapperStyle,
  getVisualEditorInteractiveStyle,
  getVisualEditorStyleValue,
  getVisualEditorTextStyle,
  isVisualEditorStyleDocumentEqual,
  normalizeVisualEditorStyleDocument,
  resetVisualEditorStyleValue,
  setVisualEditorStyleValue,
} from "./styles"

interface VisualEditorContextValue {
  pageKey: VisualEditorPageKey | string
  pageDefinition: ReturnType<typeof getVisualEditorPageDefinition> | undefined
  pageDetail: VisualEditorPageDetail | null
  publicPage: VisualEditorPublicPagePayload | null
  document: VisualEditorDocument
  baselineDocument: VisualEditorDocument
  styles: VisualEditorStyleDocument
  baselineStyles: VisualEditorStyleDocument
  selectedFieldKey: string | null
  selectedEditable: VisualEditorSelectedEditable | null
  draftValue: unknown
  isAdminEditorRoute: boolean
  isPublicEditorRoute: boolean
  canEdit: boolean
  isEditingActive: boolean
  isPublicEditorPanelOpen: boolean
  isPublicEditorCollapsed: boolean
  isDirty: boolean
  isLoading: boolean
  fieldDefinitions: VisualEditorFieldDefinition[]
  setSelectedFieldKey: (fieldKey: string | null) => void
  selectField: (fieldKey: string) => void
  clearSelection: () => void
  openEditor: (fieldKey: string) => void
  closeEditor: () => void
  openPublicEditorPanel: () => void
  closePublicEditorPanel: () => void
  activatePublicEditor: () => void
  togglePublicEditorCollapsed: () => void
  cancelEditor: () => void
  restoreFallback: () => void
  setDraftValue: (value: unknown) => void
  setFieldValue: (fieldKey: string, value: unknown) => void
  setStyleValue: (fieldKey: string, value: unknown) => void
  resetDocument: () => void
  restoreStyleFallback: () => void
  saveDraft: () => Promise<VisualEditorPageVersion>
  saveEditor: () => Promise<VisualEditorPageVersion>
  publishDraft: () => Promise<VisualEditorPageVersion>
  publishEditor: () => Promise<VisualEditorPageVersion>
  restoreVersion: (versionId: string) => Promise<VisualEditorPageVersion>
  refresh: () => Promise<void>
  getFieldValue: (fieldKey: string, fallback?: unknown) => unknown
  getLinkField: (fieldKey: string, fallback: VisualEditorLinkValue) => VisualEditorLinkValue
  getImageField: (fieldKey: string, fallback: VisualEditorImageValue) => VisualEditorImageValue
  getStyleValue: (fieldKey: string) => VisualEditorFieldStyleValue | null
  setStatusMessage: (message: string | null) => void
  statusMessage: string | null
}

const VisualEditorContext = createContext<VisualEditorContextValue | undefined>(undefined)

function isPathUnderEditor(pathname: string) {
  return pathname.startsWith("/admin/editor-visual")
}

function isDeepEqual(left: VisualEditorDocument, right: VisualEditorDocument) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function shouldHandleVisualEditorRefreshPayload(
  payload: { pageKey: string } | null,
  currentPageKey: string,
) {
  return Boolean(payload && payload.pageKey === currentPageKey)
}

function buildSelectedFieldLabel(field: VisualEditorFieldDefinition | undefined) {
  return field ? `${field.label}` : "Campo visual"
}

function normalizeEditableValue(field: VisualEditorFieldDefinition | undefined, rawValue: unknown) {
  if (!field) return rawValue

  if (field.kind === "link") {
    const fallback = typeof rawValue === "object" && rawValue ? (rawValue as Record<string, unknown>) : {}
    return {
      label: typeof fallback.label === "string" ? fallback.label : "",
      href: typeof fallback.href === "string" ? fallback.href : "",
    }
  }

  if (field.kind === "image") {
    const fallback = typeof rawValue === "object" && rawValue ? (rawValue as Record<string, unknown>) : {}
    return {
      src: typeof fallback.src === "string" ? fallback.src : "",
      alt: typeof fallback.alt === "string" ? fallback.alt : "",
    }
  }

  if (field.kind === "container") {
    return typeof rawValue === "string" ? rawValue : ""
  }

  if (field.kind === "textarea" || field.kind === "text") {
    return typeof rawValue === "string" ? rawValue : ""
  }

  return rawValue ?? ""
}

function resolveEditableValue(document: VisualEditorDocument, field: VisualEditorFieldDefinition) {
  return normalizeEditableValue(field, getVisualEditorPathValue(document, field.key))
}

export function VisualEditorProvider(props: {
  pageKey: VisualEditorPageKey | string
  children: ReactNode
}) {
  const { pageKey, children } = props
  const { isAdmin, loading: authLoading } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const pageDefinition = getVisualEditorPageDefinition(pageKey)
  const pageQuery = useQuery({
    queryKey: ["visual-editor", "public", pageKey],
    queryFn: () => fetchPublicVisualEditorPage(pageKey),
    staleTime: 60_000,
    enabled: Boolean(pageKey),
  })
  const isAdminEditorRoute = Boolean(isAdmin && !authLoading && isPathUnderEditor(location.pathname))
  const isPublicEditorRoute = Boolean(
    isAdmin && !authLoading && pageDefinition?.publicPath && location.pathname === pageDefinition.publicPath,
  )
  const adminQuery = useQuery({
    queryKey: ["visual-editor", "admin", pageKey],
    queryFn: () => fetchAdminVisualEditorPageDetail(pageKey),
    staleTime: 30_000,
    enabled: Boolean(pageKey) && (isAdminEditorRoute || isPublicEditorRoute),
  })

  const pageDetail = adminQuery.data ?? null
  const publicPage = pageQuery.data ?? null
  const baseDocument = useMemo(() => {
    const sourceDocument =
      pageDetail?.latestDraft?.entries_json ??
      pageDetail?.publishedVersion?.entries_json ??
      publicPage?.version.entries_json ??
      null
    return mergeVisualEditorDocuments(pageDefinition?.defaultDocument ?? {}, sourceDocument)
  }, [pageDefinition?.defaultDocument, pageDetail?.latestDraft?.entries_json, pageDetail?.publishedVersion?.entries_json, publicPage?.version.entries_json])
  const baseStyleDocument = useMemo(() => {
    const sourceStyles =
      pageDetail?.latestDraft?.style_json ??
      pageDetail?.publishedVersion?.style_json ??
      publicPage?.version.style_json ??
      null
    return normalizeVisualEditorStyleDocument(sourceStyles, pageDefinition?.fields ?? [])
  }, [pageDefinition?.fields, pageDetail?.latestDraft?.style_json, pageDetail?.publishedVersion?.style_json, publicPage?.version.style_json])

  const [document, setDocument] = useState<VisualEditorDocument>(() => cloneVisualEditorDocument(baseDocument))
  const [baselineDocument, setBaselineDocument] = useState<VisualEditorDocument>(() =>
    cloneVisualEditorDocument(baseDocument),
  )
  const [styles, setStyles] = useState<VisualEditorStyleDocument>(() => cloneVisualEditorStyleDocument(baseStyleDocument))
  const [baselineStyles, setBaselineStyles] = useState<VisualEditorStyleDocument>(() =>
    cloneVisualEditorStyleDocument(baseStyleDocument),
  )
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [draftValue, setDraftValueState] = useState<unknown>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isPublicEditorPanelOpen, setIsPublicEditorPanelOpen] = useState(false)
  const [isPublicEditorCollapsed, setIsPublicEditorCollapsed] = useState(false)
  const [isEditingUnlocked, setIsEditingUnlocked] = useState(false)

  useEffect(() => {
    if (!isDeepEqual(document, baselineDocument)) {
      return
    }

    if (isDeepEqual(baselineDocument, baseDocument)) {
      return
    }

    setDocument(cloneVisualEditorDocument(baseDocument))
    setBaselineDocument(cloneVisualEditorDocument(baseDocument))
  }, [baseDocument, baselineDocument, document])

  useEffect(() => {
    if (!isVisualEditorStyleDocumentEqual(styles, baselineStyles)) {
      return
    }

    if (isVisualEditorStyleDocumentEqual(baselineStyles, baseStyleDocument)) {
      return
    }

    setStyles(cloneVisualEditorStyleDocument(baseStyleDocument))
    setBaselineStyles(cloneVisualEditorStyleDocument(baseStyleDocument))
  }, [baseStyleDocument, baselineStyles, styles])

  useEffect(() => {
    setSelectedFieldKey(null)
    setDraftValueState(null)
    setStatusMessage(null)
    setIsPublicEditorPanelOpen(false)
    setIsPublicEditorCollapsed(false)
    setIsEditingUnlocked(false)
    setStyles(cloneVisualEditorStyleDocument(baseStyleDocument))
    setBaselineStyles(cloneVisualEditorStyleDocument(baseStyleDocument))
  }, [pageKey])

  useEffect(() => {
    if (!isPublicEditorRoute) {
      setIsPublicEditorPanelOpen(false)
      setIsPublicEditorCollapsed(false)
      setIsEditingUnlocked(false)
      return
    }

    setSelectedFieldKey(null)
    setDraftValueState(null)
    setStatusMessage(null)
    setIsPublicEditorPanelOpen(false)
    setIsPublicEditorCollapsed(false)
    setIsEditingUnlocked(false)
    setStyles(cloneVisualEditorStyleDocument(baseStyleDocument))
    setBaselineStyles(cloneVisualEditorStyleDocument(baseStyleDocument))
  }, [isPublicEditorRoute])

  useEffect(() => {
    const invalidateCurrentPage = async () => {
      await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
      await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })
      await queryClient.refetchQueries({ queryKey: ["visual-editor", "public", pageKey], type: "active" })
      await queryClient.refetchQueries({ queryKey: ["visual-editor", "admin", pageKey], type: "active" })
    }

    const handleRefreshPayload = (payload: { pageKey: string } | null) => {
      if (!shouldHandleVisualEditorRefreshPayload(payload, pageKey)) {
        return
      }

      void invalidateCurrentPage()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "mariana-explica:visual-editor-refresh") {
        return
      }

      handleRefreshPayload(readVisualEditorRefreshPayload(event.newValue))
    }

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>
      handleRefreshPayload(readVisualEditorRefreshPayload(JSON.stringify(customEvent.detail)))
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(VISUAL_EDITOR_REFRESH_EVENT, handleCustomEvent)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(VISUAL_EDITOR_REFRESH_EVENT, handleCustomEvent)
    }
  }, [pageKey, queryClient])

  const fieldDefinitions = pageDefinition?.fields ?? []
  const currentField = selectedFieldKey ? fieldDefinitions.find((field) => field.key === selectedFieldKey) : undefined
  const selectedEditable = useMemo<VisualEditorSelectedEditable | null>(() => {
    if (!selectedFieldKey || !currentField || !pageDefinition) {
      return null
    }

    return {
      pageKey,
      entryKey: selectedFieldKey,
      entryType: currentField.kind,
      label: currentField.label,
      fallback: resolveEditableValue(pageDefinition.defaultDocument, currentField),
      currentValue: resolveEditableValue(document, currentField),
      fallbackStyle: {},
      currentStyle: getVisualEditorStyleValue(styles, selectedFieldKey) ?? {},
      schema: currentField,
    }
  }, [baseStyleDocument, currentField, document, pageDefinition, pageKey, selectedFieldKey, styles])
  const canEdit = Boolean(
    isAdmin &&
      !authLoading &&
      (isAdminEditorRoute || isPublicEditorRoute || location.search.includes("visual-editor=1")),
  )
  const isEditingActive = Boolean(isAdminEditorRoute || (isPublicEditorRoute && isPublicEditorPanelOpen && isEditingUnlocked))
  const canInteractWithEditable = isEditingActive
  const isDocumentDirty = !isDeepEqual(document, baselineDocument)
  const isStyleDirty = !isVisualEditorStyleDocumentEqual(styles, baselineStyles)
  const isDirty = isDocumentDirty || isStyleDirty
  const isLoading = pageQuery.isLoading || ((isAdminEditorRoute || isPublicEditorRoute) && adminQuery.isLoading)

  const getFieldValue = (fieldKey: string, fallback?: unknown) => {
    const value = getVisualEditorPathValue(document, fieldKey)
    return value ?? fallback
  }

  const getLinkField = (fieldKey: string, fallback: VisualEditorLinkValue) => {
    const value = getFieldValue(fieldKey, fallback)
    if (value && typeof value === "object") {
      const candidate = value as Partial<VisualEditorLinkValue>
      return {
        label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label : fallback.label,
        href: typeof candidate.href === "string" && candidate.href.trim() ? candidate.href : fallback.href,
      }
    }

    return fallback
  }

  const getImageField = (fieldKey: string, fallback: VisualEditorImageValue) => {
    const value = getFieldValue(fieldKey, fallback)
    if (value && typeof value === "object") {
      const candidate = value as Partial<VisualEditorImageValue>
      return {
        src: typeof candidate.src === "string" && candidate.src.trim() ? candidate.src : fallback.src,
        alt: typeof candidate.alt === "string" && candidate.alt.trim() ? candidate.alt : fallback.alt,
      }
    }

    return fallback
  }

  const getStyleValue = (fieldKey: string) => {
    return getVisualEditorStyleValue(styles, fieldKey)
  }

  const getSelectedFieldBaselineValue = () => {
    if (!currentField) {
      return undefined
    }

    return resolveEditableValue(baselineDocument, currentField)
  }

  const getSelectedFieldBaselineStyleValue = () => {
    if (!selectedFieldKey) {
      return undefined
    }

    return getVisualEditorStyleValue(baselineStyles, selectedFieldKey)
  }

  const openEditor = (fieldKey: string) => {
    if (!canInteractWithEditable) {
      return
    }

    const nextField = fieldDefinitions.find((field) => field.key === fieldKey)
    if (!nextField) return

    const nextValue = resolveEditableValue(document, nextField)
    setSelectedFieldKey(fieldKey)
    setDraftValueState(nextValue)
    setStatusMessage(null)
  }

  const closeEditor = () => {
    setSelectedFieldKey(null)
    setDraftValueState(null)
    if (isPublicEditorRoute) {
      setIsPublicEditorPanelOpen(false)
      setIsPublicEditorCollapsed(false)
      setIsEditingUnlocked(false)
    }
  }

  const openPublicEditorPanel = () => {
    if (!isPublicEditorRoute) {
      return
    }

    setIsPublicEditorPanelOpen(true)
    setIsPublicEditorCollapsed(false)
    setSelectedFieldKey(null)
    setDraftValueState(null)
    setStatusMessage(null)
  }

  const closePublicEditorPanel = () => {
    setSelectedFieldKey(null)
    setDraftValueState(null)
    setStatusMessage(null)
    setIsPublicEditorPanelOpen(false)
    setIsPublicEditorCollapsed(false)
    setIsEditingUnlocked(false)
  }

  const activatePublicEditor = () => {
    if (!isPublicEditorRoute) {
      return
    }

    setIsPublicEditorPanelOpen(true)
    setIsPublicEditorCollapsed(false)
    setIsEditingUnlocked(true)
    setStatusMessage("Edicao ativada. Clique num elemento para editar.")
  }

  const togglePublicEditorCollapsed = () => {
    setIsPublicEditorCollapsed((current) => !current)
  }

  const restoreFallback = () => {
    if (!currentField || !pageDefinition || !selectedFieldKey) {
      return
    }

    if (currentField.kind === "container") {
      setStatusMessage("Este bloco não possui conteúdo direto para restaurar.")
      return
    }

    const fallbackValue = resolveEditableValue(pageDefinition.defaultDocument, currentField)
    setDocument((current) => setVisualEditorPathValue(current, selectedFieldKey, fallbackValue))
    setDraftValueState(fallbackValue)
    setStatusMessage(`Campo ${currentField.label} restaurado para o fallback hardcoded.`)
  }

  const restoreStyleFallback = () => {
    if (!selectedFieldKey || !currentField) {
      return
    }

    setStyles((current) => resetVisualEditorStyleValue(current, selectedFieldKey))
    setStatusMessage(`Estilo de ${currentField.label} restaurado para o fallback hardcoded.`)
  }

  const cancelEditor = () => {
    if (!selectedFieldKey || !currentField) {
      closeEditor()
      return
    }

    const baselineValue = getSelectedFieldBaselineValue()
    const baselineStyleValue = getSelectedFieldBaselineStyleValue()
    if (baselineValue !== undefined) {
      setDocument((current) => setVisualEditorPathValue(current, selectedFieldKey, baselineValue))
      setDraftValueState(baselineValue)
    }

    if (baselineStyleValue && Object.keys(baselineStyleValue).length > 0) {
      setStyles((current) => {
        const next = cloneVisualEditorStyleDocument(current)
        next.fields[selectedFieldKey] = baselineStyleValue
        return next
      })
    } else {
      setStyles((current) => resetVisualEditorStyleValue(current, selectedFieldKey))
    }

    setStatusMessage(`Alteracoes de ${currentField.label} canceladas.`)

    closeEditor()
  }

  const setFieldValue = (fieldKey: string, value: unknown) => {
    setDocument((current) => setVisualEditorPathValue(current, fieldKey, value))
    if (selectedFieldKey === fieldKey) {
      setDraftValueState(value)
    }
  }

  const setDraftValue = (value: unknown) => {
    setDraftValueState(value)
    if (selectedFieldKey) {
      setDocument((current) => setVisualEditorPathValue(current, selectedFieldKey, value))
    }
  }

  const setStyleValue = (fieldKey: string, value: unknown) => {
    const fieldDefinition = fieldDefinitions.find((field) => field.key === fieldKey)
    setStyles((current) => {
      const currentStyleValue = getVisualEditorStyleValue(current, fieldKey) ?? {}
      const nextValue =
        value && typeof value === "object" && !Array.isArray(value)
          ? { ...currentStyleValue, ...(value as Record<string, unknown>) }
          : value

      return setVisualEditorStyleValue(current, fieldKey, fieldDefinition, nextValue)
    })
  }

  const resetDocument = () => {
    setDocument(cloneVisualEditorDocument(baselineDocument))
    setStyles(cloneVisualEditorStyleDocument(baselineStyles))
    setSelectedFieldKey(null)
    setDraftValueState(null)
    setStatusMessage("Alteracoes revertidas para a ultima versao carregada.")
  }

  const saveDraft = async () => {
    if (!pageDefinition) {
      throw new Error("Definicao da pagina visual nao encontrada.")
    }

    const saved = await saveVisualEditorPageDraft({
      pageKey,
      document,
      styles,
      title: pageDetail?.page.title ?? pageDefinition.title,
    })

    const normalizedDocument = mergeVisualEditorDocuments(pageDefinition.defaultDocument, saved.version.entries_json)
    const normalizedStyles = normalizeVisualEditorStyleDocument(saved.version.style_json, pageDefinition.fields)
    setBaselineDocument(cloneVisualEditorDocument(normalizedDocument))
    setDocument(cloneVisualEditorDocument(normalizedDocument))
    setBaselineStyles(cloneVisualEditorStyleDocument(normalizedStyles))
    setStyles(cloneVisualEditorStyleDocument(normalizedStyles))
    if (selectedFieldKey && currentField) {
      setDraftValueState(resolveEditableValue(normalizedDocument, currentField))
    }
    setStatusMessage(`Rascunho salvo na versao ${saved.version.version_number}.`)

    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })

    return saved.version
  }

  const publishDraft = async () => {
    const draftVersion = isDirty || !pageDetail?.latestDraft ? await saveDraft() : pageDetail.latestDraft
    const published = await publishVisualEditorPageVersion({ pageKey, versionId: draftVersion.id })
    const normalizedDocument = mergeVisualEditorDocuments(pageDefinition?.defaultDocument ?? {}, published.version.entries_json)
    const normalizedStyles = normalizeVisualEditorStyleDocument(published.version.style_json, pageDefinition?.fields ?? [])
    setBaselineDocument(cloneVisualEditorDocument(normalizedDocument))
    setDocument(cloneVisualEditorDocument(normalizedDocument))
    setBaselineStyles(cloneVisualEditorStyleDocument(normalizedStyles))
    setStyles(cloneVisualEditorStyleDocument(normalizedStyles))
    if (selectedFieldKey && currentField) {
      setDraftValueState(resolveEditableValue(normalizedDocument, currentField))
    }
    setStatusMessage(`Versao ${published.version.version_number} publicada com sucesso.`)

    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })
    broadcastVisualEditorRefresh(pageKey)

    return published.version
  }

  const restoreVersion = async (versionId: string) => {
    const restored = await restoreVisualEditorPageVersion({ pageKey, versionId })
    const normalizedDocument = mergeVisualEditorDocuments(pageDefinition?.defaultDocument ?? {}, restored.version.entries_json)
    const normalizedStyles = normalizeVisualEditorStyleDocument(restored.version.style_json, pageDefinition?.fields ?? [])
    setBaselineDocument(cloneVisualEditorDocument(normalizedDocument))
    setDocument(cloneVisualEditorDocument(normalizedDocument))
    setBaselineStyles(cloneVisualEditorStyleDocument(normalizedStyles))
    setStyles(cloneVisualEditorStyleDocument(normalizedStyles))
    if (selectedFieldKey && currentField) {
      setDraftValueState(resolveEditableValue(normalizedDocument, currentField))
    }
    setStatusMessage(`Versao ${restored.version.version_number} restaurada como novo rascunho.`)

    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })

    return restored.version
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })
  }

  const selectedFieldLabel = buildSelectedFieldLabel(currentField)
  const saveEditor = saveDraft
  const publishEditor = publishDraft

  const contextValue = useMemo<VisualEditorContextValue>(
    () => ({
      pageKey,
      pageDefinition,
      pageDetail,
      publicPage,
      document,
      baselineDocument,
      styles,
      baselineStyles,
      selectedFieldKey,
      selectedEditable,
      draftValue,
      isAdminEditorRoute,
      isPublicEditorRoute,
      canEdit,
      isEditingActive,
      isPublicEditorPanelOpen,
      isPublicEditorCollapsed,
      isDirty,
      isLoading,
      fieldDefinitions,
      setSelectedFieldKey,
      selectField: openEditor,
      clearSelection: closeEditor,
      openEditor,
      closeEditor,
      openPublicEditorPanel,
      closePublicEditorPanel,
      activatePublicEditor,
      togglePublicEditorCollapsed,
      cancelEditor,
      restoreFallback,
      restoreStyleFallback,
      setDraftValue,
      setFieldValue,
      setStyleValue,
      resetDocument,
      saveDraft,
      saveEditor,
      publishDraft,
      publishEditor,
      restoreVersion,
      refresh,
      getFieldValue,
      getLinkField,
      getImageField,
      getStyleValue,
      setStatusMessage,
      statusMessage,
    }),
    [
      baselineDocument,
      baselineStyles,
      canEdit,
      isEditingActive,
      isPublicEditorPanelOpen,
      isPublicEditorCollapsed,
      cancelEditor,
      closeEditor,
      openPublicEditorPanel,
      closePublicEditorPanel,
      activatePublicEditor,
      togglePublicEditorCollapsed,
      document,
      styles,
      fieldDefinitions,
      draftValue,
      getFieldValue,
      getImageField,
      getLinkField,
      getStyleValue,
      isAdminEditorRoute,
      isPublicEditorRoute,
      isDirty,
      isLoading,
      pageDefinition,
      pageDetail,
      pageKey,
      publicPage,
      openEditor,
      refresh,
      resetDocument,
      restoreFallback,
      restoreStyleFallback,
      restoreVersion,
      saveEditor,
      saveDraft,
      publishDraft,
      publishEditor,
      selectedFieldKey,
      selectedEditable,
      setStatusMessage,
      setDraftValue,
      setStyleValue,
      statusMessage,
    ],
  )

  const showPublicLauncher = canEdit && isPublicEditorRoute && !isPublicEditorPanelOpen
  const showPublicPanel = canEdit && isPublicEditorRoute && isPublicEditorPanelOpen

  return (
    <VisualEditorContext.Provider value={contextValue}>
      {isAdminEditorRoute ? (
        <div className="sticky top-0 z-30 border-b border-sky-200 bg-sky-50/95 px-4 py-3 text-sky-950 shadow-sm backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">
                <span>Editor visual</span>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] text-sky-900">
                  {pageDefinition?.title ?? selectedFieldLabel}
                </span>
              </div>
              <p className="text-sm leading-6 text-sky-950">
                {selectedFieldKey ? `Campo ativo: ${selectedFieldLabel}` : "Clique num elemento da pagina para editá-lo."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {statusMessage ? (
                <span className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
                  {statusMessage}
                </span>
              ) : null}
              <Button type="button" variant="outline" className="h-10 rounded-full bg-white" onClick={() => void refresh()}>
                Atualizar
              </Button>
              {isAdminEditorRoute ? (
                <>
                  <Button type="button" variant="outline" className="h-10 rounded-full bg-white" onClick={resetDocument}>
                    Reverter
                  </Button>
                  <Button type="button" className="h-10 rounded-full" onClick={() => void saveDraft()} disabled={!isDirty}>
                    Guardar rascunho
                  </Button>
                  <Button type="button" className="h-10 rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={() => void publishDraft()}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Publicar
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {showPublicLauncher ? (
        <button
          type="button"
          onClick={openPublicEditorPanel}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-800 shadow-[0_20px_45px_rgba(14,165,233,0.18)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-900"
        >
          <PencilLine className="h-4 w-4" />
          Abrir editor visual
        </button>
      ) : null}
      {showPublicPanel ? (
        <VisualEditorSidebar
          mode="fixed"
          canEdit={canEdit}
          isEditingUnlocked={isEditingUnlocked}
          isCollapsed={isPublicEditorCollapsed}
          pageDefinition={pageDefinition}
          pageDetail={pageDetail}
          publicPage={publicPage}
          selectedEditable={selectedEditable}
          draftValue={draftValue}
          isDirty={isDirty}
          statusMessage={statusMessage}
          setStatusMessage={setStatusMessage}
          setDraftValue={setDraftValue}
          setStyleValue={setStyleValue}
          closeEditor={closeEditor}
          cancelEditor={cancelEditor}
          restoreFallback={restoreFallback}
          restoreStyleFallback={restoreStyleFallback}
          resetDocument={resetDocument}
          saveEditor={saveEditor}
          publishEditor={publishEditor}
          restoreVersion={restoreVersion}
          refresh={refresh}
          activateEditing={activatePublicEditor}
          toggleCollapsed={togglePublicEditorCollapsed}
        />
      ) : null}
      <div className={cn(showPublicPanel && "lg:pr-[448px]")}>{children}</div>
    </VisualEditorContext.Provider>
  )
}

function useVisualEditorContext() {
  const context = useContext(VisualEditorContext)
  if (!context) {
    throw new Error("VisualEditorProvider nao encontrado.")
  }
  return context
}

function useEditableElementState(fieldKey: string) {
  const { canEdit, isEditingActive, selectedFieldKey, selectField, clearSelection, fieldDefinitions } =
    useVisualEditorContext()
  const fieldDefinition = fieldDefinitions.find((field) => field.key === fieldKey)
  const isSelected = selectedFieldKey === fieldKey

  const select = () => {
    if (!isEditingActive) return
    selectField(fieldKey)
  }

  return { canEdit, isEditingActive, isSelected, select, clearSelection, fieldDefinition }
}

function EditableMarker(props: { label: string; kind: string; selected: boolean }) {
  const { label, kind, selected } = props

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -top-3 right-3 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] shadow-sm transition",
        selected ? "border-sky-300 bg-sky-600 text-white" : "border-sky-200 bg-white text-sky-700 opacity-0 group-hover:opacity-100",
      )}
    >
      <PencilLine className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="font-medium tracking-normal opacity-80">{kind}</span>
    </span>
  )
}

function getEditableKindLabel(kind: string | undefined) {
  switch (kind) {
    case "textarea":
      return "Texto longo"
    case "link":
      return "Link"
    case "image":
      return "Imagem"
    case "container":
      return "Container"
    case "list":
      return "Lista"
    case "json":
      return "JSON"
    default:
      return "Texto"
  }
}

export function useVisualEditorPage() {
  return useVisualEditorContext()
}

export function SiteContentScope(props: {
  title: string
  description?: string
  className?: string
  children: ReactNode
}) {
  const { isEditingActive } = useVisualEditorContext()
  const { title, description, className, children } = props

  return (
    <section
      data-visual-editor-scope={title}
      className={cn(
        "relative",
        isEditingActive && "rounded-[2rem] outline outline-1 outline-dashed outline-sky-200/80",
        className,
      )}
    >
      {isEditingActive ? (
        <div className="pointer-events-none absolute -top-3 left-5 z-10 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-sky-700 shadow-sm">
          <PencilLine className="h-3.5 w-3.5" />
          <span>{title}</span>
          {description ? <span className="font-medium tracking-normal text-slate-500">{description}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function EditableText(props: {
  fieldKey: string
  as?: keyof JSX.IntrinsicElements
  fallback: string
  className?: string
}) {
  const { fieldKey, as = "p", fallback, className } = props
  const { getFieldValue, getStyleValue, isEditingActive } = useVisualEditorContext()
  const { isSelected, select, fieldDefinition } = useEditableElementState(fieldKey)
  const value = String(getFieldValue(fieldKey, fallback) ?? fallback)
  const styleValue = getStyleValue(fieldKey)
  const { style, headingTag } = getVisualEditorTextStyle(styleValue, fieldDefinition?.styleGroup === "heading")
  const Element = ((headingTag && /^h[1-6]$/.test(String(as))) ? headingTag : as) as keyof JSX.IntrinsicElements

  return (
    <Element
      data-visual-editor-field={fieldKey}
      style={style}
      className={cn(
        "group relative",
        className,
        isEditingActive && "cursor-pointer transition",
        isEditingActive && "hover:outline hover:outline-2 hover:outline-sky-300/80",
        isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
      )}
      onClick={isEditingActive ? select : undefined}
      onKeyDown={
        isEditingActive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                select()
              }
            }
          : undefined
      }
      tabIndex={isEditingActive ? 0 : undefined}
      role={isEditingActive ? "button" : undefined}
    >
      {isEditingActive ? (
        <EditableMarker
          label="Editar"
          kind={getEditableKindLabel(fieldDefinition?.kind)}
          selected={isSelected}
        />
      ) : null}
      {value}
    </Element>
  )
}

export function EditableLink(props: {
  fieldKey: string
  fallback: VisualEditorLinkValue
  className?: string
}) {
  const { fieldKey, fallback, className } = props
  const { getLinkField, getStyleValue, isEditingActive } = useVisualEditorContext()
  const { isSelected, select, fieldDefinition } = useEditableElementState(fieldKey)
  const value = getLinkField(fieldKey, fallback)
  const style = getVisualEditorInteractiveStyle(getStyleValue(fieldKey))

  if (isEditingActive) {
    return (
      <button
        type="button"
        data-visual-editor-field={fieldKey}
        style={style}
        className={cn(
          "group relative inline-flex items-center gap-2 text-left",
          className,
          "cursor-pointer transition hover:outline hover:outline-2 hover:outline-sky-300/80",
          isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
        )}
        onClick={select}
      >
        <Link2 className="h-4 w-4" />
        <span>{value.label}</span>
        <EditableMarker
          label="Editar"
          kind={getEditableKindLabel(fieldDefinition?.kind)}
          selected={isSelected}
        />
      </button>
    )
  }

  return (
    <Link to={value.href} className={className} style={style}>
      {value.label}
    </Link>
  )
}

export function EditableButton(props: {
  fieldKey: string
  fallback: VisualEditorLinkValue
  className?: string
  variant?: "primary" | "secondary"
}) {
  const { fieldKey, fallback, className, variant = "primary" } = props
  const { getLinkField, getStyleValue, isEditingActive } = useVisualEditorContext()
  const { isSelected, select, fieldDefinition } = useEditableElementState(fieldKey)
  const value = getLinkField(fieldKey, fallback)
  const style = getVisualEditorInteractiveStyle(getStyleValue(fieldKey))
  const baseClassName =
    variant === "secondary"
      ? "inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
      : "inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"

  if (isEditingActive) {
    return (
      <button
        type="button"
        data-visual-editor-field={fieldKey}
        style={style}
        className={cn(
          "group relative",
          baseClassName,
          className,
          "cursor-pointer",
          isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
        )}
        onClick={select}
      >
        <ArrowRight className="mr-2 h-4 w-4" />
        {value.label}
        <EditableMarker
          label="Editar"
          kind={getEditableKindLabel(fieldDefinition?.kind)}
          selected={isSelected}
        />
      </button>
    )
  }

  return value.href.startsWith("/") ? (
    <Link to={value.href} className={cn(baseClassName, className)} style={style}>
      {value.label}
    </Link>
  ) : (
    <a href={value.href} className={cn(baseClassName, className)} style={style}>
      {value.label}
    </a>
  )
}

export function EditableImage(props: {
  fieldKey: string
  fallback: VisualEditorImageValue
  className?: string
}) {
  const { fieldKey, fallback, className } = props
  const { getImageField, getStyleValue, isEditingActive } = useVisualEditorContext()
  const { isSelected, select, fieldDefinition } = useEditableElementState(fieldKey)
  const value = getImageField(fieldKey, fallback)
  const styleValue = getStyleValue(fieldKey)
  const wrapperStyle = getVisualEditorImageWrapperStyle(styleValue)
  const imageStyle = getVisualEditorImageStyle(styleValue)

  return (
    <button
      type="button"
      data-visual-editor-field={fieldKey}
      style={wrapperStyle}
      className={cn(
        "group relative block overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]",
        isEditingActive && "cursor-pointer transition hover:border-sky-300 hover:shadow-[0_20px_50px_rgba(2,132,199,0.16)]",
        isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
        className,
      )}
      onClick={isEditingActive ? select : undefined}
    >
      <img src={value.src} alt={value.alt} className="h-full w-full object-cover" style={imageStyle} />
      {isEditingActive ? (
        <EditableMarker
          label="Editar"
          kind={getEditableKindLabel(fieldDefinition?.kind)}
          selected={isSelected}
        />
      ) : null}
    </button>
  )
}

export function EditableContainer(props: {
  fieldKey: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  children: ReactNode
}) {
  const { fieldKey, as = "div", className, children } = props
  const { getStyleValue, isEditingActive } = useVisualEditorContext()
  const { isSelected, select, fieldDefinition } = useEditableElementState(fieldKey)
  const style = getVisualEditorContainerStyle(getStyleValue(fieldKey))
  const Element = as as keyof JSX.IntrinsicElements

  return (
    <Element
      data-visual-editor-field={fieldKey}
      style={style}
      className={cn(
        "group relative",
        className,
        isEditingActive && "transition",
        isEditingActive && "hover:outline hover:outline-2 hover:outline-sky-300/80",
        isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
      )}
      onClick={
        isEditingActive
          ? (event) => {
              const targetField = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-visual-editor-field]")
                ?.dataset.visualEditorField
              if (!targetField || targetField === fieldKey) {
                select()
              }
            }
          : undefined
      }
      onKeyDown={
        isEditingActive
          ? (event) => {
              const targetField = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-visual-editor-field]")
                ?.dataset.visualEditorField
              if ((event.key === "Enter" || event.key === " ") && (!targetField || targetField === fieldKey)) {
                event.preventDefault()
                select()
              }
            }
          : undefined
      }
      tabIndex={isEditingActive ? 0 : undefined}
      role={isEditingActive ? "button" : undefined}
    >
      {isEditingActive ? (
        <EditableMarker
          label="Editar"
          kind={getEditableKindLabel(fieldDefinition?.kind)}
          selected={isSelected}
        />
      ) : null}
      {children}
    </Element>
  )
}

export function VisualEditorInspectorPanel(props: { className?: string }) {
  const { className } = props
  const {
    canEdit,
    fieldDefinitions,
    selectedFieldKey,
    getFieldValue,
    setFieldValue,
    pageDefinition,
    pageDetail,
    publicPage,
    isDirty,
    resetDocument,
    restoreVersion,
    refresh,
    statusMessage,
    setStatusMessage,
  } = useVisualEditorContext()

  if (!canEdit) {
    return null
  }

  const selectedField = selectedFieldKey ? fieldDefinitions.find((field) => field.key === selectedFieldKey) : undefined
  const selectedValue = selectedFieldKey ? getFieldValue(selectedFieldKey, "") : ""

  return (
    <aside className={cn("space-y-4", className)}>
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Pagina visual</p>
            <h2 className="mt-2 text-lg font-black text-slate-950">{pageDefinition?.title ?? "Editor visual"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{pageDefinition?.description}</p>
          </div>
          <div className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
            {isDirty ? "Alteracoes pendentes" : "Tudo sincronizado"}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-full" onClick={() => void refresh()}>
            Atualizar preview
          </Button>
          <Button type="button" variant="outline" className="h-10 rounded-full" onClick={resetDocument}>
            Reverter edicoes
          </Button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Elemento selecionado</p>
        {selectedField ? (
          <div className="mt-3 space-y-3">
            <div>
              <h3 className="text-base font-black text-slate-950">{selectedField.label}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{selectedField.description ?? "Ajuste o valor deste campo."}</p>
            </div>

            {selectedField.kind === "container" ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                Este bloco não possui conteúdo textual direto. Use a aba Estilo para editar a aparência.
              </div>
            ) : selectedField.kind === "textarea" ? (
              <textarea
                value={String(selectedValue ?? "")}
                onChange={(event) => setFieldValue(selectedField.key, event.target.value)}
                className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-sky-400"
              />
            ) : selectedField.kind === "image" ? (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  URL da imagem
                  <input
                    value={String((selectedValue as { src?: string })?.src ?? "")}
                    onChange={(event) =>
                      setFieldValue(selectedField.key, {
                        ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                        src: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Texto alternativo
                  <input
                    value={String((selectedValue as { alt?: string })?.alt ?? "")}
                    onChange={(event) =>
                      setFieldValue(selectedField.key, {
                        ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                        alt: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
                  />
                </label>
              </div>
            ) : selectedField.kind === "link" ? (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Rótulo
                  <input
                    value={String((selectedValue as { label?: string })?.label ?? "")}
                    onChange={(event) =>
                      setFieldValue(selectedField.key, {
                        ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                        label: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Destino
                  <input
                    value={String((selectedValue as { href?: string })?.href ?? "")}
                    onChange={(event) =>
                      setFieldValue(selectedField.key, {
                        ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                        href: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
                  />
                </label>
              </div>
            ) : (
              <input
                value={String(selectedValue ?? "")}
                onChange={(event) => setFieldValue(selectedField.key, event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400"
              />
            )}

            <Button type="button" variant="outline" className="h-10 rounded-full" onClick={() => setStatusMessage(null)}>
              Limpar mensagem
            </Button>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
            Clique em um titulo, botao, link ou imagem para abrir a edição.
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Versoes</p>
        <div className="mt-3 space-y-2">
          {(pageDetail?.versions ?? []).slice(0, 6).map((version) => {
            const isPublished = pageDetail?.publishedVersion?.id === version.id
            const isDraft = pageDetail?.latestDraft?.id === version.id
            return (
              <div key={version.id} className="rounded-2xl border border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">Versao {version.version_number}</p>
                    <p className="text-xs text-slate-500">
                      {version.status}
                      {isPublished ? " • publicada" : ""}
                      {isDraft ? " • rascunho atual" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full"
                    onClick={() => void restoreVersion(version.id)}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            )
          })}
          {(pageDetail?.versions ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Nenhuma versao carregada.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Preview</p>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>{publicPage?.page.title ?? pageDefinition?.title}</p>
          <p className="text-xs text-slate-500">Pagina publica: {publicPage?.page.page_key ?? pageDefinition?.pageKey}</p>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
          {statusMessage}
        </div>
      ) : null}
    </aside>
  )
}
