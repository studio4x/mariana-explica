import { useState } from "react"
import { Check, RefreshCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
import type {
  VisualEditorPageDefinition,
  VisualEditorPageDetail,
  VisualEditorPageVersion,
  VisualEditorPublicPagePayload,
  VisualEditorSelectedEditable,
} from "./types"

type SidebarMode = "fixed" | "inline"

export function VisualEditorSidebar(props: {
  mode?: SidebarMode
  className?: string
  canEdit: boolean
  pageDefinition?: VisualEditorPageDefinition
  pageDetail: VisualEditorPageDetail | null
  publicPage: VisualEditorPublicPagePayload | null
  selectedEditable: VisualEditorSelectedEditable | null
  draftValue: unknown
  isDirty: boolean
  statusMessage: string | null
  setStatusMessage: (message: string | null) => void
  setDraftValue: (value: unknown) => void
  closeEditor: () => void
  cancelEditor: () => void
  restoreFallback: () => void
  resetDocument: () => void
  saveEditor: () => Promise<VisualEditorPageVersion>
  publishEditor: () => Promise<VisualEditorPageVersion>
  restoreVersion: (versionId: string) => Promise<VisualEditorPageVersion>
  refresh: () => Promise<void>
}) {
  const {
    mode = "inline",
    className,
    canEdit,
    pageDefinition,
    pageDetail,
    publicPage,
    selectedEditable,
    draftValue,
    isDirty,
    statusMessage,
    setStatusMessage,
    setDraftValue,
    closeEditor,
    cancelEditor,
    restoreFallback,
    resetDocument,
    saveEditor,
    publishEditor,
    restoreVersion,
    refresh,
  } = props
  const [busyAction, setBusyAction] = useState<string | null>(null)

  if (!canEdit) {
    return null
  }

  const isFixed = mode === "fixed"

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
    list: "Lista",
    json: "JSON",
  }

  const renderValuePreview = (value: unknown) => {
    if (typeof value === "string") {
      return value || "Vazio"
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

  const wrapperClassName = isFixed
    ? "pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:inset-y-24 lg:right-4 lg:bottom-4 lg:left-auto lg:w-[420px]"
    : "space-y-4"

  const panelClassName = isFixed
    ? "pointer-events-auto mx-auto flex max-h-[88vh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-2xl lg:rounded-[1.75rem]"
    : "space-y-4"

  const shellClassName = isFixed ? "flex-1 overflow-y-auto p-4 lg:p-5" : "space-y-4"

  const selectedValue = draftValue ?? selectedEditable?.currentValue ?? ""

  return (
    <div className={cn(wrapperClassName, className)}>
      <div className={panelClassName}>
        <div className={cn("border-b border-slate-200 bg-slate-50/80", isFixed ? "px-4 py-4 lg:px-5" : "rounded-[1.75rem] border p-4 shadow-sm")}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Editor visual</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">{pageDefinition?.title ?? "Pagina visual"}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{pageDefinition?.description}</p>
            </div>

            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Fechar editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", isDirty ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
              {isDirty ? "Alteracoes pendentes" : "Tudo sincronizado"}
            </span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
              {publicPage?.page.page_key ?? pageDefinition?.pageKey ?? "visual"}
            </span>
          </div>
        </div>

        <div className={shellClassName}>
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
              {selectedEditable ? (
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

            {selectedEditable ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-800">Valor atual</p>
                  <p className="mt-1 break-words">{renderValuePreview(selectedEditable.currentValue)}</p>
                  <p className="mt-3 font-semibold text-slate-800">Fallback hardcoded</p>
                  <p className="mt-1 break-words">{renderValuePreview(selectedEditable.fallback)}</p>
                </div>

                {selectedEditable.entryType === "textarea" ? (
                  <label className="block text-sm font-semibold text-slate-700">
                    Editar texto
                    <textarea
                      value={String(selectedValue ?? "")}
                      onChange={(event) => setDraftValue(event.target.value)}
                      className="mt-2 min-h-[160px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-sky-400"
                    />
                  </label>
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
                  <div className="space-y-3">
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
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                Clique em um titulo, botao, link ou imagem para abrir a edicao.
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="h-10 rounded-full"
                onClick={() => void runAction("save", saveEditor)}
                disabled={!isDirty || busyAction === "save"}
              >
                <Check className="mr-2 h-4 w-4" />
                Guardar rascunho
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => void runAction("publish", publishEditor)}
                disabled={busyAction === "publish"}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Publicar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => void runAction("cancel", async () => cancelEditor())}
                disabled={!selectedEditable || busyAction === "cancel"}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => void runAction("reset", async () => resetDocument())}
                disabled={busyAction === "reset"}
              >
                Reverter pagina
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-full"
              onClick={() => void runAction("refresh", refresh)}
              disabled={busyAction === "refresh"}
            >
              Atualizar preview
            </Button>
          </section>

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
                          {isPublished ? " • publicada" : ""}
                          {isDraft ? " • rascunho atual" : ""}
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
              <p>Edite o valor, veja o preview mudar em tempo real e depois salve ou publique.</p>
              <p>Use cancelar para voltar ao valor carregado, ou restaurar fallback para voltar ao hardcoded.</p>
            </div>
          </section>

          {statusMessage ? (
            <section className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
              {statusMessage}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
