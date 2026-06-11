import { useEffect, useMemo, useState, type ClipboardEvent } from "react"
import { Bot, Check, History, ImagePlus, Loader2, RotateCcw, Send, X } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import {
  useAdminAiPageEditorConfig,
  usePublishAdminSitePageVersion,
  useAdminSitePageDetail,
  useGenerateAdminAiPageEditorProposal,
  useSaveAdminSitePageDraft,
} from "@/hooks/useAdmin"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import { Button } from "@/components/ui"
import {
  readSitePagePreviewFromSearch,
  storeSitePagePreview,
} from "@/lib/site-page-preview"
import {
  getDefaultStyleCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { getAiPageEditorRouteOption, isAiPageEditorAllowedPath } from "@/lib/ai-page-editor"
import type { AdminAiPageEditorProposal, AdminSitePageVersion, SitePageSlug } from "@/types/app.types"

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

type PendingPublicationState = {
  draftVersion: AdminSitePageVersion
  previousVersionSnapshot: {
    title: string
    layout_json: Record<string, unknown>
    style_json: Record<string, unknown>
    metadata: Record<string, unknown>
  } | null
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
  const publicPageQuery = usePublicSitePage(routeOption?.slug ?? undefined)
  return { routeOption, publicPageQuery, pathname: location.pathname, search: location.search }
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getChatRoleLabel(role: ChatMessage["role"]) {
  if (role === "user") return "Tu"
  if (role === "assistant") return "Assistente IA"
  return "Sistema"
}

export function SiteAiPageEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const configQuery = useAdminAiPageEditorConfig(isAdmin && !authLoading)
  const generateMutation = useGenerateAdminAiPageEditorProposal()
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const publishMutation = usePublishAdminSitePageVersion()
  const { routeOption, publicPageQuery, pathname, search } = useSupportedCurrentPage()
  const pageDetailQuery = useAdminSitePageDetail(isAdmin && !authLoading && Boolean(routeOption?.slug) ? String(routeOption?.slug) : undefined)
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [proposal, setProposal] = useState<AdminAiPageEditorProposal | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [awaitingImplementation, setAwaitingImplementation] = useState(false)
  const [pendingPublication, setPendingPublication] = useState<PendingPublicationState | null>(null)

  const config = configQuery.data
  const allowedPath = Boolean(config && isAiPageEditorAllowedPath(pathname, config.config_value.allowed_paths))
  const isReady = Boolean(isAdmin && !authLoading && config?.config_value.enabled && allowedPath)
  const pageSlug = routeOption?.slug ?? null
  const previewPayload = useMemo(() => {
    if (!pageSlug) return null
    return readSitePagePreviewFromSearch(pageSlug, search)
  }, [pageSlug, search])

  const pageContextVersion = useMemo(() => {
    if (pageDetailQuery.data?.latest_draft) return pageDetailQuery.data.latest_draft
    if (pageDetailQuery.data?.published_version) return pageDetailQuery.data.published_version
    if (publicPageQuery.data?.version) return publicPageQuery.data.version
    return null
  }, [pageDetailQuery.data?.latest_draft, pageDetailQuery.data?.published_version, publicPageQuery.data?.version])

  const canPersistDraft = Boolean(pageSlug && pageDetailQuery.data?.page)

  const currentLayoutJson = useMemo(() => {
    if (pageContextVersion) return pageContextVersion.layout_json
    return {}
  }, [pageContextVersion])

  const currentStyleJson = useMemo(() => {
    if (pageContextVersion) return pageContextVersion.style_json
    return {}
  }, [pageContextVersion])

  const currentHtml = useMemo(() => {
    if (previewPayload?.html) {
      return previewPayload.html
    }

    if (pageSlug && pageContextVersion) {
      const document = resolveBuilderDocumentFromLayoutJson(pageSlug as SitePageSlug, pageContextVersion.layout_json)
      return renderDocumentToHtml(document)
    }

    if (typeof document !== "undefined") {
      return getSanitizedDomSnapshot()
    }

    return ""
  }, [pageContextVersion, pageSlug, previewPayload?.html])

  const revisions = useMemo(() => {
    return (pageDetailQuery.data?.versions ?? []).slice(0, 6)
  }, [pageDetailQuery.data?.versions])

  useEffect(() => {
    if (!open) return

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

  function clearPreviewFromCurrentPage() {
    const nextParams = new URLSearchParams(search)
    if (!nextParams.has("builder-preview")) return
    nextParams.delete("builder-preview")
    const nextSearch = nextParams.toString()
    navigate({ pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true })
  }

  function pushPreviewToCurrentPage(version: Pick<AdminSitePageVersion, "layout_json" | "style_json">) {
    if (!pageSlug) return
    const document = resolveBuilderDocumentFromLayoutJson(pageSlug as SitePageSlug, version.layout_json)
    const html = renderDocumentToHtml(document)
    const css =
      typeof version.style_json.css === "string" && String(version.style_json.css).trim()
        ? String(version.style_json.css)
        : getDefaultStyleCss()
    const token = storeSitePagePreview({ slug: pageSlug, html, css })
    if (!token) return

    const nextParams = new URLSearchParams(search)
    nextParams.set("builder-preview", token)
    navigate({ pathname, search: `?${nextParams.toString()}` }, { replace: true })
  }

  async function applyDraftFromProposal(nextProposal: AdminAiPageEditorProposal) {
    if (!nextProposal || !pageSlug || !canPersistDraft) {
      setFeedback("Este caminho ainda não está mapeado para persistência de rascunho.")
      return
    }

    setFeedback(null)
    try {
      const previousVersionSnapshot = pageContextVersion
        ? {
            title: pageDetailQuery.data?.page.title ?? routeOption?.label ?? document.title,
            layout_json: structuredClone(pageContextVersion.layout_json),
            style_json: structuredClone(pageContextVersion.style_json),
            metadata: structuredClone(pageContextVersion.metadata ?? {}),
          }
        : null

      const result = await saveDraftMutation.mutateAsync({
        slug: pageSlug,
        title: nextProposal.proposal.title,
        layoutJson: nextProposal.proposal.layout_json,
        styleJson: nextProposal.proposal.style_json,
        metadata: {
          ...nextProposal.proposal.metadata,
          editor: "ai-page-editor",
          source: nextProposal.provider_used,
          updated_at: new Date().toISOString(),
          ai_revision_kind: "proposal_apply",
        },
      })

      pushPreviewToCurrentPage(result.version)
      setPendingPublication({
        draftVersion: result.version,
        previousVersionSnapshot,
      })
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: `Ajustes implementados apenas para revisão admin. A página foi atualizada para a revisão ${result.version.version_number} e ainda não ficou visível no site público.`,
        },
      ])
      setProposal(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setMessage("")
      setFeedback("Ajustes implementados e página atualizada.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível guardar o rascunho.")
    }
  }

  async function handleConfirmAppliedChanges() {
    if (!pageSlug || !pendingPublication?.draftVersion.id) {
      setFeedback("Não encontrei uma revisão pendente para publicar.")
      return
    }

    setFeedback(null)
    try {
      const result = await publishMutation.mutateAsync({
        slug: pageSlug,
        versionId: pendingPublication.draftVersion.id,
      })

      clearPreviewFromCurrentPage()
      setPendingPublication(null)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: `Alterações confirmadas. A revisão ${result.version.version_number} foi publicada e já está visível no site público.`,
        },
      ])
      setFeedback("Alterações publicadas com sucesso.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível publicar as alterações.")
    }
  }

  async function handleUndoAppliedChanges() {
    if (!pageSlug || !pendingPublication?.previousVersionSnapshot) {
      setFeedback("Não encontrei um estado anterior para desfazer estas alterações.")
      return
    }

    setFeedback(null)
    try {
      const snapshot = pendingPublication.previousVersionSnapshot
      const result = await saveDraftMutation.mutateAsync({
        slug: pageSlug,
        title: snapshot.title,
        layoutJson: snapshot.layout_json,
        styleJson: snapshot.style_json,
        metadata: {
          ...snapshot.metadata,
          editor: "ai-page-editor",
          source: "undo_pending_ai_changes",
          updated_at: new Date().toISOString(),
        },
      })

      pushPreviewToCurrentPage(result.version)
      setPendingPublication(null)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: `Alterações desfeitas. A página voltou ao estado anterior na revisão ${result.version.version_number}.`,
        },
      ])
      setFeedback("Alterações desfeitas para o admin.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível desfazer as alterações.")
    }
  }

  async function handleRestoreRevision(version: AdminSitePageVersion) {
    if (!pageSlug || !canPersistDraft) {
      setFeedback("Esta página não suporta revisão persistível neste momento.")
      return
    }

    setFeedback(null)
    try {
      const title = pageDetailQuery.data?.page.title ?? routeOption?.label ?? document.title
      const result = await saveDraftMutation.mutateAsync({
        slug: pageSlug,
        title,
        layoutJson: version.layout_json,
        styleJson: version.style_json,
        metadata: {
          ...version.metadata,
          editor: "ai-page-editor",
          source: "revision_restore",
          restored_from_version_id: version.id,
          restored_from_version_number: version.version_number,
          updated_at: new Date().toISOString(),
        },
      })

      pushPreviewToCurrentPage(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: `Revisão restaurada para a versão ${version.version_number}. A página foi atualizada.`,
        },
      ])
      setProposal(null)
      setPendingPublication(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setMessage("")
      setFeedback(`Revisão ${version.version_number} restaurada.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível restaurar a revisão.")
    }
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
        slug: pageSlug ?? pathname,
        title: routeOption?.label ?? document.title,
        path: pathname,
        message:
          trimmedMessage ||
          "Analisar os anexos e propor a melhor alteração pontual, preservando o layout existente e mudando apenas o ponto solicitado.",
        currentLayoutJson,
        currentStyleJson,
        currentHtml,
        attachments,
      })

      const nextProposal: AdminAiPageEditorProposal = {
        provider_used: result.provider_used,
        summary: result.summary,
        explanation: result.explanation,
        warnings: result.warnings,
        proposal: result.proposal,
      }

      setProposal(nextProposal)
      setAwaitingImplementation(canPersistDraft)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "assistant",
          text: canPersistDraft
            ? `${result.summary}\n\n${result.explanation}\n\nVou fazer isto de forma pontual e sem alterar o layout, a não ser que tenhas pedido isso explicitamente.\nQueres que eu implemente estes ajustes?`
            : `${result.summary}\n\n${result.explanation}\n\nEstou a analisar esta área no modo de preview admin. O launcher já pode acompanhar o contexto da área do aluno e do visualizador, mas a aplicação automática ainda não está ativa nesta superfície.`,
        },
      ])
      setMessage("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível gerar a proposta."
      setFeedback(errorMessage)
      setMessages((current) => [...current, { id: uid("msg"), role: "system", text: errorMessage }])
    }
  }

  if (!isReady) {
    return null
  }

  if (configQuery.isError) {
    return null
  }

  const panelTitle = config?.config_value.launcher_label ?? "Editar com IA"
  const currentLabel = routeOption?.label ?? pathname
  const currentVersionId = pageContextVersion?.id ?? null

  return (
    <div data-ai-page-editor-root className="fixed bottom-5 right-5 z-[80] pointer-events-none">
      {open ? (
        <div className="pointer-events-auto flex h-[min(78vh,720px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-500">Editor via IA</p>
              <h2 className="mt-1 truncate font-display text-lg font-bold text-slate-950">{panelTitle}</h2>
              <p className="mt-1 truncate text-xs leading-5 text-slate-600">{currentLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              aria-label="Fechar editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
            <div className="min-h-0 flex-1 overflow-y-auto space-y-3 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                  Olá! O site está carregado. O que gostarias de alterar?
                </div>
              ) : null}

              {messages.map((entry) => (
                <div
                  key={entry.id}
                  className={[
                    "rounded-2xl border px-3 py-2 text-sm leading-6 shadow-sm",
                    entry.role === "user"
                      ? "ml-4 border-slate-200 bg-white text-slate-800"
                      : entry.role === "assistant"
                        ? "mr-4 border-sky-200 bg-sky-50 text-sky-950"
                        : "border-amber-200 bg-amber-50 text-amber-950",
                  ].join(" ")}
                >
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.24em] opacity-70">
                    {getChatRoleLabel(entry.role)}
                  </p>
                  <p className="whitespace-pre-line break-words">{entry.text}</p>
                </div>
              ))}

              {proposal && awaitingImplementation ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Confirmação</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    Desejas que eu implemente estes ajustes na página e atualize a visualização?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-full"
                      onClick={() => void applyDraftFromProposal(proposal)}
                      disabled={saveDraftMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {saveDraftMutation.isPending ? "A aplicar..." : "Implementar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full"
                      onClick={() => {
                        setAwaitingImplementation(false)
                        setMessages((current) => [
                          ...current,
                          {
                            id: uid("msg"),
                            role: "system",
                            text: "Tudo bem. Mantive a proposta apenas na conversa.",
                          },
                        ])
                      }}
                    >
                      Não agora
                    </Button>
                  </div>
                </div>
              ) : null}

              {pendingPublication ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-700">Revisão pronta</p>
                  <p className="mt-2 text-sm leading-6 text-indigo-950">
                    As alterações estão visíveis apenas para ti neste preview admin. Quando confirmares, a revisão{" "}
                    {pendingPublication.draftVersion.version_number} será publicada no site público.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-full"
                      onClick={() => void handleConfirmAppliedChanges()}
                      disabled={publishMutation.isPending || saveDraftMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {publishMutation.isPending ? "A publicar..." : "Confirmar alterações"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full"
                      onClick={() => void handleUndoAppliedChanges()}
                      disabled={publishMutation.isPending || saveDraftMutation.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {saveDraftMutation.isPending ? "A desfazer..." : "Desfazer alterações"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {feedback}
                </div>
              ) : null}

              {false && pageSlug && revisions.length > 0 ? (
                <details className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                    <History className="h-4 w-4" />
                    Revisões
                  </summary>
                  <div className="mt-3 space-y-2">
                    {revisions.map((version) => {
                      const isCurrent = version.id === currentVersionId
                      return (
                        <div key={version.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">Versão {version.version_number}</p>
                              <p className="text-xs text-slate-500">
                                {version.status} • {formatDateTime(version.created_at)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => void handleRestoreRevision(version)}
                              disabled={isCurrent || saveDraftMutation.isPending}
                            >
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />
                              {isCurrent ? "Atual" : "Reverter"}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              {attachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                    >
                      <span className="truncate">{attachment.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        className="text-slate-500 transition hover:text-rose-700"
                        aria-label={`Remover ${attachment.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Mensagem</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onPaste={(event) => void handlePaste(event)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-slate-400"
                  placeholder="Ex.: deixa o hero mais direto e destaca o CTA principal..."
                />
              </label>

              <div className="mt-3 flex items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                  <ImagePlus className="h-4 w-4" />
                  Anexo
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
                  className="h-10 flex-1 rounded-full"
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
                      Enviar
                    </>
                  )}
                </Button>
              </div>

              {pageSlug && revisions.length > 0 ? (
                <details className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-500">
                  <summary className="flex cursor-pointer items-center gap-2 font-medium text-slate-500 transition hover:text-slate-700">
                    <History className="h-3.5 w-3.5" />
                    Revisões
                  </summary>
                  <div className="mt-3 space-y-2">
                    {revisions.map((version) => {
                      const isCurrent = version.id === currentVersionId
                      return (
                        <div key={version.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">Versão {version.version_number}</p>
                              <p className="text-xs text-slate-500">
                                {version.status} • {formatDateTime(version.created_at)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => void handleRestoreRevision(version)}
                              disabled={isCurrent || saveDraftMutation.isPending}
                            >
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />
                              {isCurrent ? "Atual" : "Reverter"}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto inline-flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-slate-950 px-5 text-sm font-bold text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5"
        >
          <Bot className="h-5 w-5" />
          {panelTitle}
        </button>
      ) : null}
    </div>
  )
}
