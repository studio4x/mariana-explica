import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useLocation } from "react-router-dom"
import { ArrowRight, Image as ImageIcon, Link2, PencilLine, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
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
  VisualEditorImageValue,
  VisualEditorLinkValue,
  VisualEditorPageDetail,
  VisualEditorPageKey,
  VisualEditorPageVersion,
  VisualEditorPublicPagePayload,
} from "./types"
import {
  cloneVisualEditorDocument,
  getVisualEditorPathValue,
  mergeVisualEditorDocuments,
  setVisualEditorPathValue,
} from "./utils"

interface VisualEditorContextValue {
  pageKey: VisualEditorPageKey | string
  pageDefinition: ReturnType<typeof getVisualEditorPageDefinition> | undefined
  pageDetail: VisualEditorPageDetail | null
  publicPage: VisualEditorPublicPagePayload | null
  document: VisualEditorDocument
  baselineDocument: VisualEditorDocument
  selectedFieldKey: string | null
  isAdminEditorRoute: boolean
  canEdit: boolean
  isDirty: boolean
  isLoading: boolean
  fieldDefinitions: VisualEditorFieldDefinition[]
  setSelectedFieldKey: (fieldKey: string | null) => void
  selectField: (fieldKey: string) => void
  clearSelection: () => void
  setFieldValue: (fieldKey: string, value: unknown) => void
  resetDocument: () => void
  saveDraft: () => Promise<VisualEditorPageVersion>
  publishDraft: () => Promise<VisualEditorPageVersion>
  restoreVersion: (versionId: string) => Promise<VisualEditorPageVersion>
  refresh: () => Promise<void>
  getFieldValue: (fieldKey: string, fallback?: unknown) => unknown
  getLinkField: (fieldKey: string, fallback: VisualEditorLinkValue) => VisualEditorLinkValue
  getImageField: (fieldKey: string, fallback: VisualEditorImageValue) => VisualEditorImageValue
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

function buildSelectedFieldLabel(field: VisualEditorFieldDefinition | undefined) {
  return field ? `${field.label}` : "Campo visual"
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

  const [document, setDocument] = useState<VisualEditorDocument>(() => cloneVisualEditorDocument(baseDocument))
  const [baselineDocument, setBaselineDocument] = useState<VisualEditorDocument>(() =>
    cloneVisualEditorDocument(baseDocument),
  )
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

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

  const fieldDefinitions = pageDefinition?.fields ?? []
  const currentField = selectedFieldKey ? fieldDefinitions.find((field) => field.key === selectedFieldKey) : undefined
  const canEdit = Boolean(
    isAdmin &&
      !authLoading &&
      (isAdminEditorRoute || isPublicEditorRoute || location.search.includes("visual-editor=1")),
  )
  const isDirty = !isDeepEqual(document, baselineDocument)
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

  const setFieldValue = (fieldKey: string, value: unknown) => {
    setDocument((current) => setVisualEditorPathValue(current, fieldKey, value))
  }

  const resetDocument = () => {
    setDocument(cloneVisualEditorDocument(baselineDocument))
    setSelectedFieldKey(null)
    setStatusMessage("Alteracoes revertidas para a ultima versao carregada.")
  }

  const saveDraft = async () => {
    if (!pageDefinition) {
      throw new Error("Definicao da pagina visual nao encontrada.")
    }

    const saved = await saveVisualEditorPageDraft({
      pageKey,
      document,
      title: pageDetail?.page.title ?? pageDefinition.title,
    })

    const normalizedDocument = mergeVisualEditorDocuments(pageDefinition.defaultDocument, saved.version.entries_json)
    setBaselineDocument(cloneVisualEditorDocument(normalizedDocument))
    setDocument(cloneVisualEditorDocument(normalizedDocument))
    setSelectedFieldKey(null)
    setStatusMessage(`Rascunho salvo na versao ${saved.version.version_number}.`)

    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })

    return saved.version
  }

  const publishDraft = async () => {
    const draftVersion = pageDetail?.latestDraft && !isDirty ? pageDetail.latestDraft : await saveDraft()
    const published = await publishVisualEditorPageVersion({ pageKey, versionId: draftVersion.id })
    const normalizedDocument = mergeVisualEditorDocuments(pageDefinition?.defaultDocument ?? {}, published.version.entries_json)
    setBaselineDocument(cloneVisualEditorDocument(normalizedDocument))
    setDocument(cloneVisualEditorDocument(normalizedDocument))
    setStatusMessage(`Versao ${published.version.version_number} publicada com sucesso.`)

    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "public", pageKey] })
    await queryClient.invalidateQueries({ queryKey: ["visual-editor", "admin", pageKey] })

    return published.version
  }

  const restoreVersion = async (versionId: string) => {
    const restored = await restoreVisualEditorPageVersion({ pageKey, versionId })
    const normalizedDocument = mergeVisualEditorDocuments(pageDefinition?.defaultDocument ?? {}, restored.version.entries_json)
    setBaselineDocument(cloneVisualEditorDocument(normalizedDocument))
    setDocument(cloneVisualEditorDocument(normalizedDocument))
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

  const contextValue = useMemo<VisualEditorContextValue>(
    () => ({
      pageKey,
      pageDefinition,
      pageDetail,
      publicPage,
      document,
      baselineDocument,
      selectedFieldKey,
      isAdminEditorRoute,
      canEdit,
      isDirty,
      isLoading,
      fieldDefinitions,
      setSelectedFieldKey,
      selectField: (fieldKey: string) => {
        setSelectedFieldKey(fieldKey)
      },
      clearSelection: () => setSelectedFieldKey(null),
      setFieldValue,
      resetDocument,
      saveDraft,
      publishDraft,
      restoreVersion,
      refresh,
      getFieldValue,
      getLinkField,
      getImageField,
      setStatusMessage,
      statusMessage,
    }),
    [
      baselineDocument,
      canEdit,
      document,
      fieldDefinitions,
      getFieldValue,
      getImageField,
      getLinkField,
      isAdminEditorRoute,
      isDirty,
      isLoading,
      pageDefinition,
      pageDetail,
      pageKey,
      publicPage,
      refresh,
      resetDocument,
      restoreVersion,
      saveDraft,
      publishDraft,
      selectedFieldKey,
      setStatusMessage,
      statusMessage,
    ],
  )

  return (
    <VisualEditorContext.Provider value={contextValue}>
      {canEdit ? (
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
            </div>
          </div>
        </div>
      ) : null}
      {children}
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
  const { canEdit, selectedFieldKey, selectField, clearSelection } = useVisualEditorContext()
  const isSelected = selectedFieldKey === fieldKey

  const select = () => {
    if (!canEdit) return
    selectField(fieldKey)
  }

  return { canEdit, isSelected, select, clearSelection }
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
  const { canEdit } = useVisualEditorContext()
  const { title, description, className, children } = props

  return (
    <section
      data-visual-editor-scope={title}
      className={cn("relative", canEdit && "rounded-[2rem] outline outline-1 outline-dashed outline-sky-200/80", className)}
    >
      {canEdit ? (
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
  const { getFieldValue, canEdit } = useVisualEditorContext()
  const { isSelected, select } = useEditableElementState(fieldKey)
  const value = String(getFieldValue(fieldKey, fallback) ?? fallback)
  const Element = as as keyof JSX.IntrinsicElements

  return (
    <Element
      data-visual-editor-field={fieldKey}
      className={cn(
        className,
        canEdit && "cursor-pointer transition",
        canEdit && "hover:outline hover:outline-2 hover:outline-sky-300/80",
        isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
      )}
      onClick={canEdit ? select : undefined}
      onKeyDown={
        canEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                select()
              }
            }
          : undefined
      }
      tabIndex={canEdit ? 0 : undefined}
      role={canEdit ? "button" : undefined}
    >
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
  const { getLinkField, canEdit } = useVisualEditorContext()
  const { isSelected, select } = useEditableElementState(fieldKey)
  const value = getLinkField(fieldKey, fallback)

  if (canEdit) {
    return (
      <button
        type="button"
        data-visual-editor-field={fieldKey}
        className={cn(
          "inline-flex items-center gap-2 text-left",
          className,
          "cursor-pointer transition hover:outline hover:outline-2 hover:outline-sky-300/80",
          isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
        )}
        onClick={select}
      >
        <Link2 className="h-4 w-4" />
        <span>{value.label}</span>
      </button>
    )
  }

  return (
    <Link to={value.href} className={className}>
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
  const { getLinkField, canEdit } = useVisualEditorContext()
  const { isSelected, select } = useEditableElementState(fieldKey)
  const value = getLinkField(fieldKey, fallback)
  const baseClassName =
    variant === "secondary"
      ? "inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
      : "inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"

  if (canEdit) {
    return (
      <button
        type="button"
        data-visual-editor-field={fieldKey}
        className={cn(
          baseClassName,
          className,
          "cursor-pointer",
          isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
        )}
        onClick={select}
      >
        <ArrowRight className="mr-2 h-4 w-4" />
        {value.label}
      </button>
    )
  }

  return value.href.startsWith("/") ? (
    <Link to={value.href} className={cn(baseClassName, className)}>
      {value.label}
    </Link>
  ) : (
    <a href={value.href} className={cn(baseClassName, className)}>
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
  const { getImageField, canEdit } = useVisualEditorContext()
  const { isSelected, select } = useEditableElementState(fieldKey)
  const value = getImageField(fieldKey, fallback)

  return (
    <button
      type="button"
      data-visual-editor-field={fieldKey}
      className={cn(
        "group relative block overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]",
        canEdit && "cursor-pointer transition hover:border-sky-300 hover:shadow-[0_20px_50px_rgba(2,132,199,0.16)]",
        isSelected && "outline outline-2 outline-sky-500 outline-offset-4",
        className,
      )}
      onClick={canEdit ? select : undefined}
    >
      <img src={value.src} alt={value.alt} className="h-full w-full object-cover" />
      {canEdit ? (
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-sky-700 shadow-sm">
          <ImageIcon className="h-3.5 w-3.5" />
          Editar imagem
        </span>
      ) : null}
    </button>
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

            {selectedField.kind === "textarea" ? (
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
