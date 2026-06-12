import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type MouseEvent as ReactMouseEvent } from "react"
import html2canvas from "html2canvas"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, Camera, Check, History, ImagePlus, Loader2, RotateCcw, Send, X } from "lucide-react"
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
import { broadcastBrandingUpdate } from "./site-branding"
import {
  fetchAdminBrandingConfig,
  generateAdminAiHeaderCopyProposal,
  generateAdminAiFooterCopyProposal,
  updateAdminBrandingConfig,
} from "@/services"
import {
  readSitePagePreviewFromSearch,
  storeSitePagePreview,
} from "@/lib/site-page-preview"
import {
  getDefaultStyleCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { APP_DESCRIPTION, APP_HEADER_ANNOUNCEMENT } from "@/lib/constants"
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

type CapturePoint = {
  x: number
  y: number
}

type CaptureRect = {
  left: number
  top: number
  width: number
  height: number
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

function buildConversationIntroMessages(): ChatMessage[] {
  return [
    {
      id: uid("msg"),
      role: "assistant",
      text:
        "Posso ajustar texto, blocos e partes globais do site sem mexer no que não pediste.\n\n" +
        "Como interagir:\n" +
        "- descreve o ajuste de forma direta;\n" +
        "- se a mudança for no header ou footer global, indica isso explicitamente;\n" +
        "- podes colar uma imagem no campo de mensagem ou usar o botão \"Capturar área\" para abrir um seletor e anexar um recorte.\n\n" +
        "Limitações:\n" +
        "- não altero permissões, pagamentos, RLS, integrações ou segredos;\n" +
        "- pedidos vagos tendem a gerar propostas conservadoras para preservar o layout;\n" +
        "- quando uma alteração é concluída, a conversa é reiniciada para poupar tokens.",
    },
  ]
}

function messageTargetsGlobalHeader(message: string) {
  return /\b(header|cabe[cç]alho|topo|navbar)\b/i.test(message)
}

function messageTargetsGlobalFooter(message: string) {
  return /\b(rodape|rodapé|footer)\b/i.test(message)
}

function normalizeCaptureRect(start: CapturePoint, end: CapturePoint): CaptureRect {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return { left, top, width, height }
}

export function SiteAiPageEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const configQuery = useAdminAiPageEditorConfig(isAdmin && !authLoading)
  const generateMutation = useGenerateAdminAiPageEditorProposal()
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const publishMutation = usePublishAdminSitePageVersion()
  const { routeOption, publicPageQuery, pathname, search } = useSupportedCurrentPage()
  const pageDetailQuery = useAdminSitePageDetail(isAdmin && !authLoading && Boolean(routeOption?.slug) ? String(routeOption?.slug) : undefined)
  const navigate = useNavigate()
  const brandingQuery = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: fetchAdminBrandingConfig,
    enabled: isAdmin && !authLoading,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [proposal, setProposal] = useState<AdminAiPageEditorProposal | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() => buildConversationIntroMessages())
  const [feedback, setFeedback] = useState<string | null>(null)
  const [awaitingImplementation, setAwaitingImplementation] = useState(false)
  const [pendingPublication, setPendingPublication] = useState<PendingPublicationState | null>(null)
  const [isCapturingPage, setIsCapturingPage] = useState(false)
  const [isSelectingCaptureArea, setIsSelectingCaptureArea] = useState(false)
  const [captureStartPoint, setCaptureStartPoint] = useState<CapturePoint | null>(null)
  const [captureRect, setCaptureRect] = useState<CaptureRect | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

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

  const footerDescription = brandingQuery.data?.config_value.footer_description?.trim() || APP_DESCRIPTION
  const headerAnnouncement = brandingQuery.data?.config_value.header_announcement?.trim() || APP_HEADER_ANNOUNCEMENT

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

  const isCaptureModeActive = isSelectingCaptureArea || Boolean(captureRect) || isCapturingPage

  function resetConversation(options?: { keepFeedback?: boolean }) {
    setMessages(buildConversationIntroMessages())
    setMessage("")
    setAttachments([])
    setProposal(null)
    setAwaitingImplementation(false)
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(null)
    setIsCapturingPage(false)
    if (!options?.keepFeedback) {
      setFeedback(null)
    }
  }

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

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [open, messages.length, awaitingImplementation, pendingPublication, feedback, proposal])

  useEffect(() => {
    if (open) return
    if (!isSelectingCaptureArea && !captureStartPoint && !captureRect) return
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(null)
  }, [captureRect, captureStartPoint, isSelectingCaptureArea, open])

  useEffect(() => {
    if (!isCaptureModeActive) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSelectingCaptureArea(false)
        setCaptureStartPoint(null)
        setCaptureRect(null)
        setFeedback("Seleção de área cancelada.")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isCaptureModeActive])

  useEffect(() => {
    if (!isCaptureModeActive || typeof document === "undefined") return

    const { body, documentElement } = document
    const previousBodyCursor = body.style.cursor
    const previousDocumentCursor = documentElement.style.cursor
    const previousBodyUserSelect = body.style.userSelect

    body.style.cursor = "crosshair"
    documentElement.style.cursor = "crosshair"
    body.style.userSelect = "none"

    return () => {
      body.style.cursor = previousBodyCursor
      documentElement.style.cursor = previousDocumentCursor
      body.style.userSelect = previousBodyUserSelect
    }
  }, [isCaptureModeActive])

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

  async function captureSelectedArea(rect: CaptureRect) {
    if (typeof document === "undefined") return false

    const limit = config?.config_value.max_attachments ?? 2
    if (attachments.length >= limit) {
      setFeedback(`Limite de anexos atingido (${limit}). Remove um anexo antes de capturar outra imagem.`)
      return false
    }

    if (rect.width < 24 || rect.height < 24) {
      setFeedback("A área selecionada é demasiado pequena.")
      return false
    }

    setFeedback(null)
    setIsCapturingPage(true)

    try {
      const canvas = await html2canvas(document.body, {
        backgroundColor: "#ffffff",
        useCORS: true,
        scale: Math.min(2, window.devicePixelRatio || 1),
        logging: false,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        ignoreElements: (element) =>
          element instanceof HTMLElement && Boolean(element.closest("[data-ai-page-editor-root]")),
      })

      const dataUrl = canvas.toDataURL("image/jpeg", 0.88)
      setAttachments((current) => [
        ...current,
        {
          id: uid("attachment"),
          name: `recorte-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`,
          mime_type: "image/jpeg",
          data_url: dataUrl,
          size_bytes: Math.round((dataUrl.length * 3) / 4),
        },
      ])
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: "Recorte da área selecionada anexado. Agora descreve o ajuste que queres fazer com base na imagem.",
        },
      ])
      setFeedback("Recorte adicionado como anexo.")
      return true
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível capturar a área selecionada.")
      return false
    } finally {
      setIsCapturingPage(false)
    }
  }

  function beginCaptureSelection() {
    if (typeof document === "undefined") return
    setFeedback(null)
    setCaptureStartPoint(null)
    setCaptureRect(null)
    setIsSelectingCaptureArea(true)
    setMessages((current) => [
      ...current,
      {
        id: uid("msg"),
        role: "system",
        text: "Modo de seleção ativo. Arrasta na página para escolher a área que queres capturar. Carrega em Esc para cancelar.",
      },
    ])
  }

  async function confirmCaptureSelection() {
    if (!captureRect || isCapturingPage) return

    const rect = captureRect
    const captured = await captureSelectedArea(rect)
    if (captured) {
      setCaptureRect(null)
      setCaptureStartPoint(null)
      setIsSelectingCaptureArea(false)
    }
  }

  function cancelCaptureSelection() {
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(null)
    setFeedback("Captura descartada.")
  }

  function handleCaptureSelectionMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    setFeedback(null)
    setCaptureRect(null)
    setCaptureStartPoint({ x: event.clientX, y: event.clientY })
    setCaptureRect({ left: event.clientX, top: event.clientY, width: 0, height: 0 })
  }

  function handleCaptureSelectionMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (!captureStartPoint) return
    event.preventDefault()
    setCaptureRect(normalizeCaptureRect(captureStartPoint, { x: event.clientX, y: event.clientY }))
  }

  async function handleCaptureSelectionMouseUp(event: ReactMouseEvent<HTMLDivElement>) {
    if (!captureStartPoint) return
    event.preventDefault()

    const rect = normalizeCaptureRect(captureStartPoint, { x: event.clientX, y: event.clientY })
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(rect)
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
      setFeedback("Ajustes implementados e página atualizada.")
      resetConversation({ keepFeedback: true })
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
      resetConversation({ keepFeedback: true })
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
      resetConversation({ keepFeedback: true })
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
      setFeedback(`Revisão ${version.version_number} restaurada.`)
      resetConversation({ keepFeedback: true })
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
      if (messageTargetsGlobalHeader(trimmedMessage)) {
        if (!brandingQuery.data) {
          throw new Error("Não foi possível carregar o branding global do site.")
        }

        const result = await generateAdminAiHeaderCopyProposal({
          title: routeOption?.label ?? document.title,
          path: pathname,
          message: trimmedMessage,
          currentHeaderText: headerAnnouncement,
        })

        const updatedBranding = await updateAdminBrandingConfig({
          ...brandingQuery.data.config_value,
          header_announcement: result.header_announcement,
        })

        queryClient.setQueryData(["admin", "branding"], updatedBranding)
        queryClient.setQueryData(["site", "branding"], updatedBranding)
        broadcastBrandingUpdate(updatedBranding.updated_at)

        setProposal(null)
        setAwaitingImplementation(false)
        setAttachments([])
        setMessage("")
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "assistant",
            text: `${result.summary}\n\n${result.explanation}\n\nO cabeçalho global foi atualizado e passa a valer em todas as páginas públicas.`,
          },
        ])
        setFeedback("Cabeçalho global atualizado.")
        resetConversation({ keepFeedback: true })
        return
      }

      if (messageTargetsGlobalFooter(trimmedMessage)) {
        if (!brandingQuery.data) {
          throw new Error("Não foi possível carregar o branding global do site.")
        }

        const result = await generateAdminAiFooterCopyProposal({
          title: routeOption?.label ?? document.title,
          path: pathname,
          message: trimmedMessage,
          currentFooterText: footerDescription,
        })

        const updatedBranding = await updateAdminBrandingConfig({
          ...brandingQuery.data.config_value,
          footer_description: result.footer_description,
        })

        queryClient.setQueryData(["admin", "branding"], updatedBranding)
        queryClient.setQueryData(["site", "branding"], updatedBranding)
        broadcastBrandingUpdate(updatedBranding.updated_at)

        setProposal(null)
        setAwaitingImplementation(false)
        setAttachments([])
        setMessage("")
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "assistant",
            text: `${result.summary}\n\n${result.explanation}\n\nO rodapé global foi atualizado e passa a valer em todas as páginas públicas.`,
          },
        ])
        setFeedback("Rodapé global atualizado.")
        resetConversation({ keepFeedback: true })
        return
      }

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
      {isCaptureModeActive ? (
        <div
          className="fixed inset-0 z-[95] cursor-crosshair bg-transparent pointer-events-auto select-none"
          onMouseDown={handleCaptureSelectionMouseDown}
          onMouseMove={handleCaptureSelectionMouseMove}
          onMouseUp={(event) => void handleCaptureSelectionMouseUp(event)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="absolute left-4 top-4 max-w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm leading-6 text-slate-700 shadow-lg backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Seleção de área</p>
            <p className="mt-1">
              {isCapturingPage
                ? "A capturar a imagem... aguarda um instante."
                : captureRect
                  ? "Área selecionada. Confirma para anexar ou redefine a seleção arrastando novamente."
                  : "Arrasta para selecionar apenas a área que queres capturar. Carrega em Esc para cancelar."}
            </p>
          </div>
          {captureRect ? (
            <div
              className="absolute border-2 border-sky-500 bg-sky-400/20 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
              style={{
                left: `${captureRect.left}px`,
                top: `${captureRect.top}px`,
                width: `${captureRect.width}px`,
                height: `${captureRect.height}px`,
              }}
            />
          ) : null}
          <div className="absolute right-4 top-4 flex flex-wrap gap-2">
            {captureRect && !isCapturingPage ? (
              <button
                type="button"
                className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-lg transition hover:border-sky-300 hover:text-sky-950"
                onClick={() => void confirmCaptureSelection()}
              >
                Confirmar
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-slate-300 hover:text-slate-950"
              onClick={cancelCaptureSelection}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {open && !isCaptureModeActive ? (
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


              <div ref={messagesEndRef} />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              {attachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                    >
                      {attachment.mime_type.startsWith("image/") ? (
                        <img src={attachment.data_url} alt={attachment.name} className="h-5 w-5 rounded object-cover" />
                      ) : null}
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
                  variant="outline"
                  className="h-10 rounded-full"
                  onClick={() => void beginCaptureSelection()}
                  disabled={isCapturingPage || isSelectingCaptureArea}
                >
                  {isCapturingPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A captar...
                    </>
                  ) : isSelectingCaptureArea ? (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Seleciona a área
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Capturar área
                    </>
                  )}
                </Button>

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


