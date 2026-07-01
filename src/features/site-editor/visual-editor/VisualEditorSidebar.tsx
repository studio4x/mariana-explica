import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ChevronDown, ChevronUp, RefreshCcw, Sparkles, X } from "lucide-react"
import { RichTextEditor } from "@/components/common"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
import { isRichTextEmpty, richTextToPlainText, sanitizeRichTextHtml } from "@/lib/rich-text"
import type {
  VisualEditorPageDetail,
  VisualEditorPageVersion,
  VisualEditorPublicPagePayload,
  VisualEditorSelectedEditable,
} from "./types"
import {
  VISUAL_EDITOR_BORDER_STYLE_OPTIONS,
  VISUAL_EDITOR_BOX_SHADOW_OPTIONS,
  VISUAL_EDITOR_BACKGROUND_POSITION_OPTIONS,
  VISUAL_EDITOR_BACKGROUND_REPEAT_OPTIONS,
  VISUAL_EDITOR_BACKGROUND_SIZE_OPTIONS,
  VISUAL_EDITOR_FONT_PRESETS,
  VISUAL_EDITOR_FONT_STYLE_OPTIONS,
  VISUAL_EDITOR_FONT_WEIGHT_OPTIONS,
  VISUAL_EDITOR_HEADING_TAG_OPTIONS,
  VISUAL_EDITOR_OBJECT_FIT_OPTIONS,
  VISUAL_EDITOR_TEXT_ALIGN_OPTIONS,
  VISUAL_EDITOR_TEXT_TRANSFORM_OPTIONS,
  getVisualEditorContainerStyle,
  getVisualEditorStyleGroup,
  getVisualEditorStyleSummary,
  normalizeVisualEditorTextSemanticTag,
  parseVisualEditorLengthValue,
} from "./styles"

type SidebarMode = "fixed" | "inline"
type SidebarTab = "content" | "style" | "advanced"
type StyleLengthUnit = "px" | "rem" | "em" | "%"
type TextPresentationMode = "title" | "paragraph"

const LENGTH_UNIT_OPTIONS: Array<{ label: string; value: StyleLengthUnit }> = [
  { label: "px", value: "px" },
  { label: "rem", value: "rem" },
  { label: "em", value: "em" },
  { label: "%", value: "%" },
]

const HEADING_ONLY_OPTIONS = VISUAL_EDITOR_HEADING_TAG_OPTIONS.filter((option) => option.value !== "p")
const HEADING_PREVIEW_CLASS_BY_TAG: Record<string, string> = {
  h1: "font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-slate-950 md:text-4xl",
  h2: "font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-slate-950 md:text-3xl",
  h3: "font-display text-xl font-bold leading-tight tracking-[-0.02em] text-slate-950 md:text-2xl",
  h4: "font-display text-lg font-bold leading-tight tracking-[-0.01em] text-slate-950",
  h5: "font-display text-base font-semibold leading-tight text-slate-950",
  h6: "font-display text-sm font-semibold leading-tight text-slate-950",
}

function isTextEditable(selectedEditable: VisualEditorSelectedEditable | null) {
  return selectedEditable?.entryType === "text" || selectedEditable?.entryType === "textarea"
}

function resolveDefaultTextMode(selectedEditable: VisualEditorSelectedEditable) {
  const explicitTag = normalizeVisualEditorTextSemanticTag(selectedEditable.currentStyle.headingTag)
  if (explicitTag === "p") {
    return "paragraph" as const
  }

  if (explicitTag) {
    return "title" as const
  }

  const defaultTag = String(selectedEditable.defaultTextTag ?? "").toLowerCase()
  if (defaultTag === "p") {
    return "paragraph" as const
  }

  if (/^h[1-6]$/.test(defaultTag)) {
    return "title" as const
  }

  if (selectedEditable.entryType === "textarea") {
    return "paragraph" as const
  }

  return selectedEditable.schema.styleGroup === "heading" ? "title" : "paragraph"
}

function resolveHeadingTag(selectedEditable: VisualEditorSelectedEditable) {
  const explicitTag = normalizeVisualEditorTextSemanticTag(selectedEditable.currentStyle.headingTag)
  if (explicitTag && explicitTag !== "p") {
    return explicitTag
  }

  const defaultTag = String(selectedEditable.defaultTextTag ?? "").toLowerCase()
  if (/^h[1-6]$/.test(defaultTag)) {
    return defaultTag
  }

  return selectedEditable.schema.styleGroup === "heading" ? "h2" : "h3"
}

export function VisualEditorSidebar(props: {
  mode?: SidebarMode
  className?: string
  canEdit: boolean
  isEditingUnlocked?: boolean
  isCollapsed?: boolean
  pageDefinition?: {
    title: string
    description: string
    pageKey: string
  }
  pageDetail: VisualEditorPageDetail | null
  publicPage: VisualEditorPublicPagePayload | null
  selectedEditable: VisualEditorSelectedEditable | null
  draftValue: unknown
  isDirty: boolean
  statusMessage: string | null
  setStatusMessage: (message: string | null) => void
  setDraftValue: (value: unknown) => void
  setStyleValue: (fieldKey: string, value: unknown) => void
  closeEditor: () => void
  cancelEditor: () => void
  restoreFallback: () => void
  restoreStyleFallback: () => void
  resetDocument: () => void
  saveEditor: () => Promise<VisualEditorPageVersion>
  publishEditor: () => Promise<VisualEditorPageVersion>
  restoreVersion: (versionId: string) => Promise<VisualEditorPageVersion>
  refresh: () => Promise<void>
  activateEditing?: () => void
  toggleCollapsed?: () => void
}) {
  const {
    mode = "inline",
    className,
    canEdit,
    isEditingUnlocked = true,
    isCollapsed = false,
    pageDefinition,
    pageDetail,
    publicPage,
    selectedEditable,
    draftValue,
    isDirty,
    statusMessage,
    setStatusMessage,
    setDraftValue,
    setStyleValue,
    closeEditor,
    cancelEditor,
    restoreFallback,
    restoreStyleFallback,
    resetDocument,
    saveEditor,
    publishEditor,
    restoreVersion,
    refresh,
    activateEditing,
    toggleCollapsed,
  } = props
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SidebarTab>("content")

  useEffect(() => {
    setActiveTab(selectedEditable?.entryType === "container" ? "style" : "content")
  }, [selectedEditable?.entryKey, selectedEditable?.entryType])

  if (!canEdit) {
    return null
  }

  const isFixed = mode === "fixed"
  const isLocked = isFixed && !isEditingUnlocked
  const selectedValue = draftValue ?? selectedEditable?.currentValue ?? ""
  const selectedStyle = selectedEditable?.currentStyle ?? {}
  const fallbackStyle = selectedEditable?.fallbackStyle ?? {}
  const styleGroup = getVisualEditorStyleGroup(selectedEditable?.schema)
  const isSelectedTextField = isTextEditable(selectedEditable)
  const textPresentationMode = selectedEditable && isSelectedTextField ? resolveDefaultTextMode(selectedEditable) : null
  const selectedHeadingTag = selectedEditable && isSelectedTextField ? resolveHeadingTag(selectedEditable) : "h2"

  const runAction = async (actionName: string, action: () => Promise<unknown>) => {
    setBusyAction(actionName)
    try {
      await action()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.")
    } finally {
      setBusyAction(null)
    }
  }

  const kindLabel: Record<string, string> = {
    text: "Texto curto",
    textarea: "Texto longo",
    link: "Link / botao",
    image: "Imagem",
    container: "Container / card",
    list: "Lista",
    json: "JSON",
  }

  const renderValuePreview = (value: unknown) => {
    if (typeof value === "string") {
      return richTextToPlainText(value) || value || "Vazio"
    }

    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value)
      } catch {
        return "Valor complexo"
      }
    }

    if (value === null || value === undefined) {
      return "Vazio"
    }

    return String(value)
  }

  const renderTextPreviewNode = (value: string) => {
    if (isRichTextEmpty(value)) {
      return <p className="text-sm italic text-slate-400">Vazio</p>
    }

    const sanitizedValue = sanitizeRichTextHtml(value)

    if (isSelectedTextField && textPresentationMode === "title") {
      return (
        <div
          className={cn(
            "rich-text-content break-words",
            HEADING_PREVIEW_CLASS_BY_TAG[selectedHeadingTag] ?? HEADING_PREVIEW_CLASS_BY_TAG.h2,
          )}
          dangerouslySetInnerHTML={{ __html: sanitizedValue }}
        />
      )
    }

    return (
      <div
        className="rich-text-content break-words text-sm leading-6 text-slate-600"
        dangerouslySetInnerHTML={{ __html: sanitizedValue }}
      />
    )
  }

  const renderValuePreviewNode = (value: unknown): ReactNode => {
    if (typeof value === "string" && isSelectedTextField) {
      return renderTextPreviewNode(value)
    }

    return <p className="break-words">{renderValuePreview(value)}</p>
  }

  const updateStyle = (patch: Record<string, unknown>) => {
    if (!selectedEditable) return
    setStyleValue(selectedEditable.entryKey, {
      ...selectedStyle,
      ...patch,
    })
  }

  const removeStyleKey = (key: string) => {
    if (!selectedEditable) return
    const nextStyle = { ...selectedStyle }
    delete nextStyle[key]
    setStyleValue(selectedEditable.entryKey, nextStyle)
  }

  const updateLengthStyle = (key: string, value: string, unit: StyleLengthUnit, allowEmpty = true) => {
    if (!selectedEditable) return
    if (!value.trim()) {
      if (allowEmpty) {
        removeStyleKey(key)
      }
      return
    }

    updateStyle({ [key]: `${value}${unit}` })
  }

  const updateUnitlessStyle = (key: string, value: string, allowEmpty = true) => {
    if (!selectedEditable) return
    if (!value.trim()) {
      if (allowEmpty) {
        removeStyleKey(key)
      }
      return
    }

    updateStyle({ [key]: value.trim() })
  }

  const updateTextPresentationMode = (mode: TextPresentationMode) => {
    if (!selectedEditable || !isTextEditable(selectedEditable)) return

    if (mode === "paragraph") {
      updateStyle({ headingTag: "p" })
      return
    }

    updateStyle({ headingTag: selectedHeadingTag })
    setDraftValue(richTextToPlainText(String(selectedValue ?? "")))
  }

  const updateTextHeadingTag = (nextHeadingTag: string) => {
    if (!selectedEditable || !isTextEditable(selectedEditable)) return
    updateStyle({ headingTag: nextHeadingTag })
    setDraftValue(richTextToPlainText(String(selectedValue ?? "")))
  }

  const imageAssets = (pageDetail?.assets ?? []).filter((asset) => {
    const mimeType = String(asset.mime_type ?? "").toLowerCase()
    return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(asset.file_name)
  })

  const wrapperClassName = isFixed
    ? "pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:inset-y-24 lg:right-4 lg:bottom-4 lg:left-auto lg:w-[440px]"
    : "space-y-4"

  const panelClassName = isFixed
    ? "pointer-events-auto mx-auto flex max-h-[88vh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl lg:rounded-[1.75rem]"
    : "space-y-4"

  const shellClassName = isFixed ? "flex-1 overflow-y-auto p-4 lg:p-5" : "space-y-4"

  return (
    <div className={cn(wrapperClassName, className)}>
      <div className={panelClassName}>
        <div
          className={cn(
            "border-b border-slate-200 bg-slate-50/80",
            isFixed ? "px-4 py-4 lg:px-5" : "rounded-[1.75rem] border p-4 shadow-sm",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Editor visual</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">{pageDefinition?.title ?? "Pagina visual"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{pageDefinition?.description}</p>
            </div>

            <div className="flex items-center gap-2">
              {isLocked && activateEditing ? (
                <Button type="button" className="h-10 rounded-full" onClick={activateEditing}>
                  Ativar edicao
                </Button>
              ) : null}

              {isFixed && toggleCollapsed ? (
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  aria-label={isCollapsed ? "Expandir modal" : "Recolher modal"}
                >
                  {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {isCollapsed ? "Expandir" : "Recolher"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Fechar editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
              {publicPage?.page.page_key ?? pageDefinition?.pageKey ?? "visual"}
            </span>
            {isFixed ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold",
                  isLocked ? "bg-slate-100 text-slate-600" : "bg-sky-50 text-sky-700",
                )}
              >
                {isLocked ? "Aguardando ativacao" : "Edicao ativa"}
              </span>
            ) : null}
          </div>

          {isFixed && !isCollapsed ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-900">Modo de edicao visual</p>
              <p className="mt-1">
                {isLocked
                  ? "Abra o modal e ative a edicao para clicar nos elementos da pagina."
                  : "Clique em um elemento editavel para selecionar o campo, ajustar conteudo e definir estilo."}
              </p>
            </div>
          ) : null}
        </div>

        {!isCollapsed ? (
          <div className={shellClassName}>
            {isLocked ? null : (
              <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Elemento selecionado</p>
                    {selectedEditable ? (
                      <>
                        <h3 className="mt-2 text-base font-black text-slate-950">{selectedEditable.label}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {kindLabel[selectedEditable.entryType] ?? selectedEditable.entryType}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-base font-black text-slate-950">Nenhum elemento selecionado</p>
                    )}
                  </div>
                  {selectedEditable && selectedEditable.entryType !== "container" ? (
                    <button
                      type="button"
                      onClick={restoreFallback}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Restaurar fallback
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(["content", "style", "advanced"] as SidebarTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition",
                        activeTab === tab ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                      )}
                    >
                      {tab === "content" ? "Conteudo" : tab === "style" ? "Estilo" : "Avancado"}
                    </button>
                  ))}
                </div>

                {selectedEditable ? (
                  <div className="space-y-4">
                    {activeTab === "content" ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                          <p className="font-semibold text-slate-800">Valor atual</p>
                          <div className="mt-1">{renderValuePreviewNode(selectedEditable.currentValue)}</div>
                          <p className="mt-3 font-semibold text-slate-800">Fallback hardcoded</p>
                          <div className="mt-1">{renderValuePreviewNode(selectedEditable.fallback)}</div>
                        </div>

                        {selectedEditable.entryType === "container" ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                            Este bloco não possui conteúdo textual direto. Use a aba Estilo para editar a aparência.
                          </div>
                        ) : isSelectedTextField && textPresentationMode ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Tipo de texto
                                <select
                                  value={textPresentationMode}
                                  onChange={(event) => updateTextPresentationMode(event.target.value as TextPresentationMode)}
                                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="title">Titulo</option>
                                  <option value="paragraph">Paragrafo</option>
                                </select>
                              </label>

                              {textPresentationMode === "title" ? (
                                <label className="block text-sm font-semibold text-slate-700">
                                  Tag do titulo
                                  <select
                                    value={selectedHeadingTag}
                                    onChange={(event) => updateTextHeadingTag(event.target.value)}
                                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                  >
                                    {HEADING_ONLY_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : (
                                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                                  O campo passa a aceitar formatacao rica diretamente no painel lateral.
                                </div>
                              )}
                            </div>

                            {textPresentationMode === "paragraph" ? (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-700">Editar conteudo</p>
                                <RichTextEditor
                                  value={String(selectedValue ?? "")}
                                  onChange={(value) => setDraftValue(value)}
                                  toolbarVariant="compact"
                                  minHeightPx={180}
                                />
                              </div>
                            ) : (
                              <label className="block text-sm font-semibold text-slate-700">
                                Editar texto
                                <input
                                  value={String(selectedValue ?? "")}
                                  onChange={(event) => setDraftValue(event.target.value)}
                                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                                />
                              </label>
                            )}
                          </div>
                        ) : selectedEditable.entryType === "link" ? (
                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-slate-700">
                              Rotulo
                              <input
                                value={String((selectedValue as { label?: string })?.label ?? "")}
                                onChange={(event) =>
                                  setDraftValue({
                                    ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                                    label: event.target.value,
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                              />
                            </label>
                            <label className="block text-sm font-semibold text-slate-700">
                              Destino
                              <input
                                value={String((selectedValue as { href?: string })?.href ?? "")}
                                onChange={(event) =>
                                  setDraftValue({
                                    ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                                    href: event.target.value,
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                              />
                            </label>
                          </div>
                        ) : selectedEditable.entryType === "image" ? (
                          <div className="space-y-4">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              <img
                                src={String((selectedValue as { src?: string })?.src ?? "")}
                                alt={String((selectedValue as { alt?: string })?.alt ?? "")}
                                className="h-40 w-full object-cover"
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                URL da imagem
                                <input
                                  value={String((selectedValue as { src?: string })?.src ?? "")}
                                  onChange={(event) =>
                                    setDraftValue({
                                      ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                                      src: event.target.value,
                                    })
                                  }
                                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                                />
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Asset existente
                                <select
                                  value={String((selectedValue as { src?: string })?.src ?? "")}
                                  onChange={(event) =>
                                    setDraftValue({
                                      ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                                      src: event.target.value,
                                    })
                                  }
                                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Escolher asset publicado</option>
                                  {imageAssets.map((asset) => (
                                    <option key={asset.id} value={asset.public_url}>
                                      {asset.file_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <label className="block text-sm font-semibold text-slate-700">
                              Texto alternativo
                              <input
                                value={String((selectedValue as { alt?: string })?.alt ?? "")}
                                onChange={(event) =>
                                  setDraftValue({
                                    ...(selectedValue && typeof selectedValue === "object" ? selectedValue : {}),
                                    alt: event.target.value,
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                              />
                            </label>

                            <div className="grid gap-2 md:grid-cols-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-full"
                                onClick={() => void runAction("restore-image", async () => restoreFallback())}
                              >
                                Restaurar imagem fallback
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-full"
                                onClick={() => void runAction("restore-image", async () => restoreFallback())}
                              >
                                Remover imagem personalizada
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <label className="block text-sm font-semibold text-slate-700">
                            Editar texto
                            <input
                              value={String(selectedValue ?? "")}
                              onChange={(event) => setDraftValue(event.target.value)}
                              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                            />
                          </label>
                        )}

                        {isFixed ? (
                          <div className="space-y-5 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Estilo rapido</p>
                              <p className="text-xs text-slate-500">Os controles abaixo ficam sempre visiveis no modo publico.</p>
                            </div>

                            {styleGroup === "heading" || styleGroup === "text" ? (
                              <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Cor do texto
                                    <input
                                      type="color"
                                      value={String(selectedStyle.color ?? "#000000")}
                                      onChange={(event) => updateStyle({ color: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                    />
                                  </label>
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Fonte
                                    <select
                                      value={String(selectedStyle.fontFamily ?? "")}
                                      onChange={(event) => updateStyle({ fontFamily: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                    >
                                      <option value="">Padrao</option>
                                      {VISUAL_EDITOR_FONT_PRESETS.map((preset) => (
                                        <option key={preset.value} value={preset.value}>
                                          {preset.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <LengthField
                                    label="Tamanho da fonte"
                                    value={selectedStyle.fontSize}
                                    onChange={(nextValue) => updateLengthStyle("fontSize", nextValue.value, nextValue.unit)}
                                  />
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Peso da fonte
                                    <select
                                      value={String(selectedStyle.fontWeight ?? "")}
                                      onChange={(event) => updateStyle({ fontWeight: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                    >
                                      <option value="">Padrao</option>
                                      {VISUAL_EDITOR_FONT_WEIGHT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              </div>
                            ) : styleGroup === "image" ? (
                              <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <LengthField
                                    label="Border radius"
                                    value={selectedStyle.borderRadius}
                                    onChange={(nextValue) => updateLengthStyle("borderRadius", nextValue.value, nextValue.unit)}
                                  />
                                  <LengthField
                                    label="Largura"
                                    value={selectedStyle.width}
                                    onChange={(nextValue) => updateLengthStyle("width", nextValue.value, nextValue.unit)}
                                  />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <LengthField
                                    label="Altura"
                                    value={selectedStyle.height}
                                    onChange={(nextValue) => updateLengthStyle("height", nextValue.value, nextValue.unit)}
                                  />
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Object fit
                                    <select
                                      value={String(selectedStyle.objectFit ?? "")}
                                      onChange={(event) => updateStyle({ objectFit: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                    >
                                      <option value="">Padrao</option>
                                      {VISUAL_EDITOR_OBJECT_FIT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              </div>
                            ) : styleGroup === "container" ? (
                              <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Cor de fundo
                                    <input
                                      type="color"
                                      value={String(selectedStyle.backgroundColor ?? "#ffffff")}
                                      onChange={(event) => updateStyle({ backgroundColor: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                    />
                                  </label>
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Cor do texto
                                    <input
                                      type="color"
                                      value={String(selectedStyle.color ?? "#000000")}
                                      onChange={(event) => updateStyle({ color: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                    />
                                  </label>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <LengthField
                                    label="Border radius"
                                    value={selectedStyle.borderRadius}
                                    onChange={(nextValue) => updateLengthStyle("borderRadius", nextValue.value, nextValue.unit)}
                                  />
                                  <LengthField
                                    label="Border width"
                                    value={selectedStyle.borderWidth}
                                    onChange={(nextValue) => updateLengthStyle("borderWidth", nextValue.value, nextValue.unit)}
                                  />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Border style
                                    <select
                                      value={String(selectedStyle.borderStyle ?? "")}
                                      onChange={(event) => updateStyle({ borderStyle: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                    >
                                      <option value="">Padrao</option>
                                      {VISUAL_EDITOR_BORDER_STYLE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Cor da borda
                                    <input
                                      type="color"
                                      value={String(selectedStyle.borderColor ?? "#000000")}
                                      onChange={(event) => updateStyle({ borderColor: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : styleGroup === "interactive" ? (
                              <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Cor de fundo
                                    <input
                                      type="color"
                                      value={String(selectedStyle.backgroundColor ?? "#ffffff")}
                                      onChange={(event) => updateStyle({ backgroundColor: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                    />
                                  </label>
                                  <label className="block text-sm font-semibold text-slate-700">
                                    Cor do texto
                                    <input
                                      type="color"
                                      value={String(selectedStyle.color ?? "#000000")}
                                      onChange={(event) => updateStyle({ color: event.target.value })}
                                      className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                    />
                                  </label>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <LengthField
                                    label="Border radius"
                                    value={selectedStyle.borderRadius}
                                    onChange={(nextValue) => updateLengthStyle("borderRadius", nextValue.value, nextValue.unit)}
                                  />
                                  <LengthField
                                    label="Border width"
                                    value={selectedStyle.borderWidth}
                                    onChange={(nextValue) => updateLengthStyle("borderWidth", nextValue.value, nextValue.unit)}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                      </>
                    ) : activeTab === "style" ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                          <p className="font-semibold text-slate-800">Estilo atual</p>
                          <p className="mt-1">{getVisualEditorStyleSummary(selectedStyle)}</p>
                          <p className="mt-3 font-semibold text-slate-800">Fallback hardcoded</p>
                          <p className="mt-1">{getVisualEditorStyleSummary(fallbackStyle)}</p>
                        </div>

                        {styleGroup === "heading" || styleGroup === "text" ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor do texto
                                <input
                                  type="color"
                                  value={String(selectedStyle.color ?? "#000000")}
                                  onChange={(event) => updateStyle({ color: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Fonte
                                <select
                                  value={String(selectedStyle.fontFamily ?? "")}
                                  onChange={(event) => updateStyle({ fontFamily: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_FONT_PRESETS.map((preset) => (
                                    <option key={preset.value} value={preset.value}>
                                      {preset.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Tamanho da fonte"
                                value={selectedStyle.fontSize}
                                onChange={(nextValue) => updateLengthStyle("fontSize", nextValue.value, nextValue.unit)}
                              />
                              <label className="block text-sm font-semibold text-slate-700">
                                Peso da fonte
                                <select
                                  value={String(selectedStyle.fontWeight ?? "")}
                                  onChange={(event) => updateStyle({ fontWeight: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_FONT_WEIGHT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Altura da linha
                                <input
                                  type="number"
                                  min="0"
                                  step="0.05"
                                  value={String(selectedStyle.lineHeight ?? "")}
                                  onChange={(event) => updateUnitlessStyle("lineHeight", event.target.value)}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                />
                              </label>
                              <LengthField
                                label="Espaçamento entre letras"
                                value={selectedStyle.letterSpacing}
                                onChange={(nextValue) => updateLengthStyle("letterSpacing", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Alinhamento
                                <select
                                  value={String(selectedStyle.textAlign ?? "")}
                                  onChange={(event) => updateStyle({ textAlign: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_TEXT_ALIGN_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Transformação de texto
                                <select
                                  value={String(selectedStyle.textTransform ?? "")}
                                  onChange={(event) => updateStyle({ textTransform: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_TEXT_TRANSFORM_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Estilo
                                <select
                                  value={String(selectedStyle.fontStyle ?? "")}
                                  onChange={(event) => updateStyle({ fontStyle: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_FONT_STYLE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {styleGroup === "heading" ? (
                                <label className="block text-sm font-semibold text-slate-700">
                                  Tag do titulo
                                  <select
                                    value={String(selectedStyle.headingTag ?? "")}
                                    onChange={(event) => updateStyle({ headingTag: event.target.value })}
                                    className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                  >
                                    <option value="">Padrão</option>
                                    {VISUAL_EDITOR_HEADING_TAG_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                            </div>
                          </div>
                        ) : styleGroup === "interactive" ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor do texto
                                <input
                                  type="color"
                                  value={String(selectedStyle.color ?? "#000000")}
                                  onChange={(event) => updateStyle({ color: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor de fundo
                                <input
                                  type="color"
                                  value={String(selectedStyle.backgroundColor ?? "#000000")}
                                  onChange={(event) => updateStyle({ backgroundColor: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Fonte
                                <select
                                  value={String(selectedStyle.fontFamily ?? "")}
                                  onChange={(event) => updateStyle({ fontFamily: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_FONT_PRESETS.map((preset) => (
                                    <option key={preset.value} value={preset.value}>
                                      {preset.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <LengthField
                                label="Tamanho da fonte"
                                value={selectedStyle.fontSize}
                                onChange={(nextValue) => updateLengthStyle("fontSize", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Peso da fonte
                                <select
                                  value={String(selectedStyle.fontWeight ?? "")}
                                  onChange={(event) => updateStyle({ fontWeight: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_FONT_WEIGHT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <LengthField
                                label="Border radius"
                                value={selectedStyle.borderRadius}
                                onChange={(nextValue) => updateLengthStyle("borderRadius", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Border width"
                                value={selectedStyle.borderWidth}
                                onChange={(nextValue) => updateLengthStyle("borderWidth", nextValue.value, nextValue.unit)}
                              />
                              <label className="block text-sm font-semibold text-slate-700">
                                Border style
                                <select
                                  value={String(selectedStyle.borderStyle ?? "")}
                                  onChange={(event) => updateStyle({ borderStyle: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_BORDER_STYLE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor da borda
                                <input
                                  type="color"
                                  value={String(selectedStyle.borderColor ?? "#000000")}
                                  onChange={(event) => updateStyle({ borderColor: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Sombra
                                <select
                                  value={String(selectedStyle.boxShadow ?? "")}
                                  onChange={(event) => updateStyle({ boxShadow: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_BOX_SHADOW_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Padding horizontal"
                                value={selectedStyle.paddingX}
                                onChange={(nextValue) => updateLengthStyle("paddingX", nextValue.value, nextValue.unit)}
                              />
                              <LengthField
                                label="Padding vertical"
                                value={selectedStyle.paddingY}
                                onChange={(nextValue) => updateLengthStyle("paddingY", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-full"
                                onClick={() => void runAction("style-reset", async () => restoreStyleFallback())}
                              >
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Resetar estilo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-full"
                                onClick={() =>
                                  updateStyle({
                                    textAlign: "center",
                                  })
                                }
                              >
                                Centralizar texto
                              </Button>
                            </div>
                          </div>
                        ) : styleGroup === "container" ? (
                          <div className="space-y-5">
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor de fundo
                                <input
                                  type="color"
                                  value={String(selectedStyle.backgroundColor ?? "#ffffff")}
                                  onChange={(event) => updateStyle({ backgroundColor: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor do texto
                                <input
                                  type="color"
                                  value={String(selectedStyle.color ?? "#000000")}
                                  onChange={(event) => updateStyle({ color: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Border radius"
                                value={selectedStyle.borderRadius}
                                onChange={(nextValue) => updateLengthStyle("borderRadius", nextValue.value, nextValue.unit)}
                              />
                              <LengthField
                                label="Border width"
                                value={selectedStyle.borderWidth}
                                onChange={(nextValue) => updateLengthStyle("borderWidth", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Border style
                                <select
                                  value={String(selectedStyle.borderStyle ?? "")}
                                  onChange={(event) => updateStyle({ borderStyle: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_BORDER_STYLE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-semibold text-slate-700">
                                Cor da borda
                                <input
                                  type="color"
                                  value={String(selectedStyle.borderColor ?? "#000000")}
                                  onChange={(event) => updateStyle({ borderColor: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white p-1"
                                />
                              </label>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Sombra
                                <select
                                  value={String(selectedStyle.boxShadow ?? "")}
                                  onChange={(event) => updateStyle({ boxShadow: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_BOX_SHADOW_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <LengthField
                                label="Largura"
                                value={selectedStyle.width}
                                onChange={(nextValue) => updateLengthStyle("width", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Padding horizontal"
                                value={selectedStyle.paddingX}
                                onChange={(nextValue) => updateLengthStyle("paddingX", nextValue.value, nextValue.unit)}
                              />
                              <LengthField
                                label="Padding vertical"
                                value={selectedStyle.paddingY}
                                onChange={(nextValue) => updateLengthStyle("paddingY", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Margin top"
                                value={selectedStyle.marginTop}
                                onChange={(nextValue) => updateLengthStyle("marginTop", nextValue.value, nextValue.unit)}
                              />
                              <LengthField
                                label="Margin bottom"
                                value={selectedStyle.marginBottom}
                                onChange={(nextValue) => updateLengthStyle("marginBottom", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Margin left"
                                value={selectedStyle.marginLeft}
                                onChange={(nextValue) => updateLengthStyle("marginLeft", nextValue.value, nextValue.unit)}
                              />
                              <LengthField
                                label="Margin right"
                                value={selectedStyle.marginRight}
                                onChange={(nextValue) => updateLengthStyle("marginRight", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Max width"
                                value={selectedStyle.maxWidth}
                                onChange={(nextValue) => updateLengthStyle("maxWidth", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">Fundo</p>
                                  <p className="text-xs text-slate-500">Imagem de fundo segura e normalizada pelo editor.</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-full"
                                  onClick={() => removeStyleKey("backgroundImage")}
                                >
                                  Remover imagem de fundo
                                </Button>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block text-sm font-semibold text-slate-700">
                                  URL da imagem de fundo
                                  <input
                                    value={String(selectedStyle.backgroundImage ?? "")}
                                    onChange={(event) => updateStyle({ backgroundImage: event.target.value })}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                                  />
                                </label>
                                <label className="block text-sm font-semibold text-slate-700">
                                  Asset existente
                                  <select
                                    value={String(selectedStyle.backgroundImage ?? "")}
                                    onChange={(event) => updateStyle({ backgroundImage: event.target.value })}
                                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                  >
                                    <option value="">Escolher asset publicado</option>
                                    {imageAssets.map((asset) => (
                                      <option key={asset.id} value={asset.public_url}>
                                        {asset.file_name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block text-sm font-semibold text-slate-700">
                                  Tamanho do fundo
                                  <select
                                    value={String(selectedStyle.backgroundSize ?? "")}
                                    onChange={(event) => updateStyle({ backgroundSize: event.target.value })}
                                    className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                  >
                                    <option value="">Padrão</option>
                                    {VISUAL_EDITOR_BACKGROUND_SIZE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-semibold text-slate-700">
                                  Posição do fundo
                                  <select
                                    value={String(selectedStyle.backgroundPosition ?? "")}
                                    onChange={(event) => updateStyle({ backgroundPosition: event.target.value })}
                                    className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                  >
                                    <option value="">Padrão</option>
                                    {VISUAL_EDITOR_BACKGROUND_POSITION_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <label className="block text-sm font-semibold text-slate-700">
                                Repetição do fundo
                                <select
                                  value={String(selectedStyle.backgroundRepeat ?? "")}
                                  onChange={(event) => updateStyle({ backgroundRepeat: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_BACKGROUND_REPEAT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Preview do fundo</p>
                                <div
                                  className="mt-3 min-h-24 rounded-2xl border border-dashed border-slate-200 bg-slate-100"
                                  style={getVisualEditorContainerStyle(selectedStyle)}
                                />
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 rounded-full"
                              onClick={() => void runAction("style-reset", async () => restoreStyleFallback())}
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Resetar estilo
                            </Button>
                          </div>
                        ) : styleGroup === "image" ? (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Border radius"
                                value={selectedStyle.borderRadius}
                                onChange={(nextValue) => updateLengthStyle("borderRadius", nextValue.value, nextValue.unit)}
                              />
                              <LengthField
                                label="Largura"
                                value={selectedStyle.width}
                                onChange={(nextValue) => updateLengthStyle("width", nextValue.value, nextValue.unit)}
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <LengthField
                                label="Altura"
                                value={selectedStyle.height}
                                onChange={(nextValue) => updateLengthStyle("height", nextValue.value, nextValue.unit)}
                              />
                              <label className="block text-sm font-semibold text-slate-700">
                                Object fit
                                <select
                                  value={String(selectedStyle.objectFit ?? "")}
                                  onChange={(event) => updateStyle({ objectFit: event.target.value })}
                                  className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                                >
                                  <option value="">Padrão</option>
                                  {VISUAL_EDITOR_OBJECT_FIT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <label className="block text-sm font-semibold text-slate-700">
                              Sombra
                              <select
                                value={String(selectedStyle.boxShadow ?? "")}
                                onChange={(event) => updateStyle({ boxShadow: event.target.value })}
                                className="mt-2 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
                              >
                                <option value="">Padrão</option>
                                {VISUAL_EDITOR_BOX_SHADOW_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 rounded-full"
                              onClick={() => void runAction("style-reset", async () => restoreStyleFallback())}
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Resetar estilo
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                            Este tipo de elemento ainda nao tem controles de estilo dedicados nesta fase.
                          </div>
                        )}

                      </>
                    ) : (
                      <>
                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900">Pagina</span>
                            <span className="font-mono text-xs">{selectedEditable.pageKey}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900">Campo</span>
                            <span className="font-mono text-xs">{selectedEditable.entryKey}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900">Tipo</span>
                            <span className="font-mono text-xs">{selectedEditable.entryType}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900">Grupo de estilo</span>
                            <span className="font-mono text-xs">{styleGroup}</span>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {selectedEditable.entryType !== "container" ? (
                            <Button type="button" variant="outline" className="h-10 rounded-full" onClick={restoreFallback}>
                              Restaurar conteudo
                            </Button>
                          ) : null}
                          <Button type="button" variant="outline" className="h-10 rounded-full" onClick={restoreStyleFallback}>
                            Resetar estilo
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                    Clique em um titulo, botao, link ou imagem para abrir a edicao.
                  </div>
                )}

                <Button type="button" variant="outline" className="h-10 w-full rounded-full" onClick={() => void runAction("refresh", refresh)} disabled={busyAction === "refresh"}>
                  Atualizar preview
                </Button>
              </section>
            )}

            {isLocked ? null : (
              <>
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Versoes</p>
                  <div className="mt-3 space-y-2">
                    {(pageDetail?.versions ?? []).slice(0, 6).map((version) => {
                      const isPublished = pageDetail?.publishedVersion?.id === version.id
                      const isDraft = pageDetail?.latestDraft?.id === version.id

                      return (
                        <div key={version.id} className="rounded-2xl border border-slate-200 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-950">Versao {version.version_number}</p>
                              <p className="text-xs text-slate-500">
                                {version.status}
                                {isPublished ? " | publicada" : ""}
                                {isDraft ? " | rascunho atual" : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => void runAction(`restore-${version.id}`, () => restoreVersion(version.id))}
                              disabled={busyAction === `restore-${version.id}`}
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
                </section>

                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Como usar</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <p>Clique num elemento editavel para preencher esta sidebar.</p>
                    <p>Edite o valor, ajuste o estilo, veja o preview mudar em tempo real e depois salve ou publique.</p>
                    <p>Use cancelar para voltar ao valor carregado, ou restaurar fallback para voltar ao hardcoded.</p>
                  </div>
                </section>
              </>
            )}

            {!isFixed && statusMessage ? (
              <section className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
                {statusMessage}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LengthField(props: {
  label: string
  value?: string
  onChange: (value: { value: string; unit: StyleLengthUnit }) => void
}) {
  const { label, value, onChange } = props
  const parsed = useMemo(() => parseVisualEditorLengthValue(value), [value])

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-2">
        <input
          type="number"
          aria-label={label}
          value={parsed.value}
          min="0"
          step="0.1"
          onChange={(event) => onChange({ value: event.target.value, unit: parsed.unit })}
          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400"
        />
        <select
          aria-label={`${label} unidade`}
          value={parsed.unit}
          onChange={(event) => onChange({ value: parsed.value, unit: event.target.value as StyleLengthUnit })}
          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-2 text-sm outline-none transition focus:border-sky-400"
        >
          {LENGTH_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
