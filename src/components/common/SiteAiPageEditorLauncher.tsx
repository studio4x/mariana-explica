import { useEffect, useMemo, useState, type ClipboardEvent } from "react"
import { Bot, Check, ImagePlus, Loader2, Send, X } from "lucide-react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useAdminAiPageEditorConfig, useGenerateAdminAiPageEditorProposal, useSaveAdminSitePageDraft } from "@/hooks/useAdmin"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import { Button } from "@/components/ui"
import { StatusBadge } from "./StatusBadge"
import {
  createSitePagePreviewUrl,
  storeSitePagePreview,
} from "@/lib/site-page-preview"
import {
  getDefaultStyleCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { getAiPageEditorRouteOption, isAiPageEditorAllowedPath } from "@/lib/ai-page-editor"
import type { AdminAiPageEditorProposal, SitePageSlug } from "@/types/app.types"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text: string
}

type AttachmentItem = {
  id: string
  name: string
  mime_type: string
  data_url: string
  size_bytes: number
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Não foi possível ler o anexo."))
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  })
}

function getSanitizedDomSnapshot() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return ""
  }

  const bodyClone = document.body.cloneNode(true) as HTMLElement
  bodyClone.querySelectorAll("[data-ai-page-editor-root]").forEach((node) => node.remove())
  return bodyClone.innerHTML
}

function useSupportedCurrentPage() {
  const location = useLocation()
  const routeOption = getAiPageEditorRouteOption(location.pathname)
  const publicPageQuery = usePublicSitePage(routeOption?.slug)
  return { routeOption, publicPageQuery, pathname: location.pathname }
}

function ProposalPreview({
  proposal,
  routePath,
  slug,
}: {
  proposal: AdminAiPageEditorProposal | null
  routePath: string
  slug: string | null
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!proposal || !slug) {
      setPreviewUrl(null)
      return
    }

    const resolvedDocument = resolveBuilderDocumentFromLayoutJson(slug as SitePageSlug, proposal.proposal.layout_json)
    const html = renderDocumentToHtml(resolvedDocument)
    const css = typeof proposal.proposal.style_json.css === "string" && proposal.proposal.style_json.css.trim()
      ? String(proposal.proposal.style_json.css)
      : getDefaultStyleCss()
    const token = storeSitePagePreview({ slug, html, css })
    if (!token) {
      setPreviewUrl(null)
      return
    }

    setPreviewUrl(createSitePagePreviewUrl(routePath, token))
  }, [proposal, routePath, slug])

  if (!proposal || !slug) {
    return (
      <div className="flex min-h-[340px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
        O preview do rascunho aparece aqui quando a IA gerar uma proposta para uma rota suportada.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Preview</p>
        <p className="mt-2 text-sm text-slate-600">{proposal.summary}</p>
        {proposal.warnings.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.warnings.map((warning) => (
              <span key={warning} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {warning}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <iframe
        title="Pré-visualização do rascunho"
        src={previewUrl ?? undefined}
        className="h-[360px] w-full rounded-3xl border border-slate-200 bg-white"
      />
    </div>
  )
}

export function SiteAiPageEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const configQuery = useAdminAiPageEditorConfig(isAdmin && !authLoading)
  const generateMutation = useGenerateAdminAiPageEditorProposal()
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const { routeOption, publicPageQuery, pathname } = useSupportedCurrentPage()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [proposal, setProposal] = useState<AdminAiPageEditorProposal | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)

  const config = configQuery.data
  const allowedPath = Boolean(config && isAiPageEditorAllowedPath(pathname, config.config_value.allowed_paths))
  const isReady = Boolean(isAdmin && !authLoading && config?.config_value.enabled && allowedPath)
  const canPersistDraft = Boolean(routeOption && publicPageQuery.data?.version)

  const currentLayoutJson = useMemo(() => {
    if (routeOption && publicPageQuery.data?.version) {
      return publicPageQuery.data.version.layout_json
    }
    return {}
  }, [publicPageQuery.data?.version, routeOption])

  const currentStyleJson = useMemo(() => {
    if (routeOption && publicPageQuery.data?.version) {
      return publicPageQuery.data.version.style_json
    }
    return {}
  }, [publicPageQuery.data?.version, routeOption])

  const currentHtml = useMemo(() => {
    if (routeOption && publicPageQuery.data?.version) {
      const document = resolveBuilderDocumentFromLayoutJson(routeOption.slug, publicPageQuery.data.version.layout_json)
      return renderDocumentToHtml(document)
    }
    if (typeof document !== "undefined") {
      return getSanitizedDomSnapshot()
    }
    return ""
  }, [publicPageQuery.data?.version, routeOption])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  function addAttachmentsFromFiles(files: FileList | File[]) {
    const limit = config?.config_value.max_attachments ?? 2
    const nextFiles = Array.from(files).slice(0, Math.max(0, limit - attachments.length))
    void Promise.all(
      nextFiles.map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file)
        return {
          id: uid("attachment"),
          name: file.name,
          mime_type: file.type || "application/octet-stream",
          data_url: dataUrl,
          size_bytes: file.size,
        } satisfies AttachmentItem
      }),
    ).then((items) => {
      setAttachments((current) => [...current, ...items])
    })
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith("image/"))
    if (files.length === 0) return
    event.preventDefault()
    addAttachmentsFromFiles(files)
  }

  async function handleSend() {
    if (!config || !isReady) return
    const trimmedMessage = message.trim()
    if (!trimmedMessage && attachments.length === 0) return

    setFeedback(null)
    setMessages((current) => [
      ...current,
      { id: uid("msg"), role: "user", text: trimmedMessage || "Anexo enviado para análise visual." },
    ])

    try {
      const result = await generateMutation.mutateAsync({
        slug: routeOption?.slug ?? pathname,
        title: routeOption?.label ?? document.title,
        path: pathname,
        message: trimmedMessage || "Analisar os anexos e propor a melhor alteração.",
        currentLayoutJson,
        currentStyleJson,
        currentHtml,
        attachments,
      })

      const normalizedProposal = result.proposal
      const nextProposal: AdminAiPageEditorProposal = {
        provider_used: result.provider_used,
        summary: result.summary,
        explanation: result.explanation,
        warnings: result.warnings,
        proposal: normalizedProposal,
      }

      setProposal(nextProposal)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "assistant",
          text: `${result.summary}\n\n${result.explanation}`,
        },
      ])
      setMessage("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível gerar a proposta."
      setFeedback(errorMessage)
      setMessages((current) => [...current, { id: uid("msg"), role: "system", text: errorMessage }])
    }
  }

  async function handleApplyDraft() {
    if (!proposal || !routeOption || !canPersistDraft) {
      setFeedback("Este caminho ainda não está mapeado para persistência de rascunho.")
      return
    }

    setFeedback(null)
    try {
      await saveDraftMutation.mutateAsync({
        slug: routeOption.slug,
        title: proposal.proposal.title,
        layoutJson: proposal.proposal.layout_json,
        styleJson: proposal.proposal.style_json,
        metadata: {
          ...proposal.proposal.metadata,
          editor: "ai-page-editor",
          source: proposal.provider_used,
          updated_at: new Date().toISOString(),
        },
      })

      setFeedback("Rascunho guardado com sucesso. A publicação continua manual.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível guardar o rascunho.")
    }
  }

  if (!isReady) {
    return null
  }

  if (configQuery.isError) {
    return null
  }

  const panelTitle = config?.config_value.launcher_label ?? "Editar com IA"
  const previewSupported = Boolean(routeOption && routeOption.slug && publicPageQuery.data?.version)

  return (
    <div data-ai-page-editor-root className="fixed bottom-5 right-5 z-[80]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-slate-950 px-5 text-sm font-bold text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5"
      >
        <Bot className="h-5 w-5" />
        {open ? "Fechar editor" : panelTitle}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-end bg-slate-950/30 p-3 backdrop-blur-sm sm:items-end sm:p-5">
          <div
            className={[
              "flex h-[92vh] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.2)]",
              config?.config_value.panel_width === "compact"
                ? "max-w-[960px]"
                : "max-w-[1260px]",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Editor via IA</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">{panelTitle}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Rascunho manual com Gemini como principal e OpenAI como fallback.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={routeOption ? routeOption.label : "Rota customizada"} tone={routeOption ? "success" : "warning"} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
                  aria-label="Fechar editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="min-h-0 overflow-y-auto rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={routeOption ? `Página ${routeOption.path}` : pathname} tone="neutral" />
                  <StatusBadge label={config?.config_value.enabled ? "Editor ativo" : "Editor desligado"} tone={config?.config_value.enabled ? "success" : "warning"} />
                  <StatusBadge label={canPersistDraft ? "Rascunho persistível" : "Somente preview"} tone={canPersistDraft ? "success" : "warning"} />
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Contexto atual</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{routeOption?.label ?? "Rota customizada"}</p>
                  <p className="mt-1 text-sm text-slate-600">{pathname}</p>
                  {previewSupported ? (
                    <p className="mt-2 text-xs text-emerald-700">A rota suporta preview e gravação de rascunho via builder.</p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      Esta rota pode ser analisada pela IA, mas a persistência de rascunho não está mapeada para ela.
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Mensagem para a IA</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onPaste={(event) => void handlePaste(event)}
                      rows={7}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                      placeholder="Ex.: deixa o hero mais direto e destaca o CTA principal..."
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                      <ImagePlus className="h-4 w-4" />
                      Anexar imagem
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          if (event.target.files?.length) {
                            addAttachmentsFromFiles(event.target.files)
                          }
                          event.target.value = ""
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => void handleSend()}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          A gerar...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar para IA
                        </>
                      )}
                    </Button>
                  </div>

                  {attachments.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Anexos</p>
                      <div className="grid gap-2">
                        {attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{attachment.name}</p>
                              <p className="text-xs text-slate-500">
                                {attachment.mime_type} • {Math.round(attachment.size_bytes / 1024)} KB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-rose-200 hover:text-rose-700"
                              aria-label={`Remover ${attachment.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {feedback ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {feedback}
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {messages.length > 0 ? (
                    messages.map((entry) => (
                      <div
                        key={entry.id}
                        className={[
                          "rounded-3xl border px-4 py-3 text-sm leading-6",
                          entry.role === "user"
                            ? "border-slate-200 bg-white text-slate-800"
                            : entry.role === "assistant"
                              ? "border-sky-200 bg-sky-50 text-sky-950"
                              : "border-amber-200 bg-amber-50 text-amber-950",
                        ].join(" ")}
                      >
                        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.24em] opacity-70">{entry.role}</p>
                        <p className="whitespace-pre-line">{entry.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                      Envia uma mensagem para começar. Podes colar imagens diretamente no campo de texto.
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Proposta</p>
                    <h3 className="mt-2 font-display text-2xl font-bold text-slate-950">
                      {proposal?.proposal.title ?? "Ainda sem proposta"}
                    </h3>
                  </div>
                  {proposal ? (
                    <StatusBadge label={proposal.provider_used === "gemini" ? "Gemini" : "OpenAI"} tone="info" />
                  ) : null}
                </div>

                {proposal ? (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm leading-6 text-slate-700">{proposal.summary}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600 whitespace-pre-line">{proposal.explanation}</p>
                    {proposal.warnings.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {proposal.warnings.map((warning) => (
                          <StatusBadge key={warning} label={warning} tone="warning" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    A resposta da IA vai aparecer aqui com o resumo, a explicação e os avisos de aplicação.
                  </div>
                )}

                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => void handleApplyDraft()}
                      disabled={!proposal || !canPersistDraft || saveDraftMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {saveDraftMutation.isPending ? "A guardar..." : "Aplicar como rascunho"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setProposal(null)
                        setMessages([])
                        setFeedback(null)
                        setAttachments([])
                        setMessage("")
                      }}
                    >
                      Limpar conversa
                    </Button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {canPersistDraft
                      ? "A aplicação grava apenas rascunho. A publicação segue manual no builder."
                      : "Esta rota fica apenas em modo de análise/preview. Não há persistência automática."}
                  </p>
                </div>

                <div className="mt-4">
                  <ProposalPreview proposal={proposal} routePath={routeOption?.path ?? pathname} slug={routeOption?.slug ?? null} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
