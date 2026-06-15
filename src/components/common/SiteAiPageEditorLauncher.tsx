import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react"
import { flushSync } from "react-dom"
import html2canvas from "html2canvas"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, Camera, Check, History, ImagePlus, Loader2, RotateCcw, Send, X } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import {
  useAdminAiPageEditorConfig,
  usePublishAdminSitePageVersion,
  useRollbackAdminSitePageVersion,
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
  composeManagedPageCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { APP_DESCRIPTION, APP_HEADER_ANNOUNCEMENT } from "@/lib/constants"
import { normalizeAdminAiPageEditorError } from "@/lib/ai-page-editor-response"
import {
  assessAiPageEditorProposal,
  formatAiPageEditorBreakpointLabel,
  formatAiPageEditorConfidence,
  formatAiPageEditorModeLabel,
  formatAiPageEditorOperationTypeLabel,
  formatAiPageEditorRiskLabel,
  formatAiPageEditorScopeLabel,
  getAiPageEditorRouteCapability,
  getAiPageEditorRouteOption,
  isAiPageEditorAllowedPath,
  shouldUsePublishedVersionForAiContext,
} from "@/lib/ai-page-editor"
import type {
  AdminAiPageEditorProposal,
  AdminAiPageEditorProposalMetadata,
  AdminSitePageDetail,
  AdminSitePageVersion,
  SitePageSlug,
} from "@/types/app.types"

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
  if (role === "assistant") return "Mariana"
  return "Aviso"
}

function buildConversationIntroMessages(): ChatMessage[] {
  return [
    {
      id: uid("msg"),
      role: "assistant",
      text:
        "Posso ajustar texto, partes da página e áreas globais do site sem mexer no que não pediste.\n\n" +
        "Como interagir:\n" +
        "- descreve o ajuste de forma direta;\n" +
        "- se a mudança for no header ou footer global, indica isso explicitamente;\n" +
        "- podes colar uma imagem no campo de mensagem ou usar o botão \"Capturar área\" para abrir um seletor e anexar um recorte.\n\n" +
        "Limitações:\n" +
        "- não altero permissões, pagamentos, RLS, integrações ou segredos;\n" +
        "- pedidos vagos tendem a gerar propostas conservadoras para preservar o layout;\n" +
        "- quando uma alteração é concluída, a conversa recomeça para manter tudo simples.",
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

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function normalizeProposalMetadata(
  metadata: AdminAiPageEditorProposalMetadata | Record<string, unknown> | null | undefined,
) {
  if (!metadata || typeof metadata !== "object") return {}
  return metadata as AdminAiPageEditorProposalMetadata
}

function buildPreviewProposalPayload(proposal: AdminAiPageEditorProposal) {
  const metadata = normalizeProposalMetadata(proposal.proposal.metadata)
  return {
    summary: proposal.summary,
    explanation: proposal.explanation,
    warnings: proposal.warnings,
    editPlan: proposal.edit_plan,
    baseVersion: metadata.base_version ?? null,
    targetResolutions: metadata.ai_invariants?.target_resolutions ?? [],
    aiInvariants: metadata.ai_invariants ?? null,
    highlightSelectors: (metadata.ai_invariants?.target_resolutions ?? [])
      .map((item) => item.selector)
      .filter((selector): selector is string => typeof selector === "string" && selector.trim().length > 0),
  }
}

export function SiteAiPageEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const configQuery = useAdminAiPageEditorConfig(isAdmin && !authLoading)
  const generateMutation = useGenerateAdminAiPageEditorProposal()
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const publishMutation = usePublishAdminSitePageVersion()
  const rollbackMutation = useRollbackAdminSitePageVersion()
  const { routeOption, publicPageQuery, pathname, search } = useSupportedCurrentPage()
  const routeCapability = useMemo(() => getAiPageEditorRouteCapability(pathname), [pathname])
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
  const [sendStatus, setSendStatus] = useState<string | null>(null)
  const [awaitingImplementation, setAwaitingImplementation] = useState(false)
  const [pendingPublication, setPendingPublication] = useState<PendingPublicationState | null>(null)
  const [postApplyDecision, setPostApplyDecision] = useState<AdminSitePageVersion | null>(null)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null)
  const [isCapturingPage, setIsCapturingPage] = useState(false)
  const [isSelectingCaptureArea, setIsSelectingCaptureArea] = useState(false)
  const [captureStartPoint, setCaptureStartPoint] = useState<CapturePoint | null>(null)
  const [captureRect, setCaptureRect] = useState<CaptureRect | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const config = configQuery.data
  const allowedPath = !config || isAiPageEditorAllowedPath(pathname, config.config_value.allowed_paths)
  const canRenderLauncher = Boolean(isAdmin && !authLoading && allowedPath)
  const pageSlug = routeCapability.routeOption?.slug ?? null
  const previewPayload = useMemo(() => {
    if (!pageSlug) return null
    return readSitePagePreviewFromSearch(pageSlug, search)
  }, [pageSlug, search])

  const pageContextVersion = useMemo(() => {
    if (
      pageDetailQuery.data?.latest_draft &&
      !shouldUsePublishedVersionForAiContext(pageDetailQuery.data.latest_draft, pageDetailQuery.data.published_version)
    ) {
      return pageDetailQuery.data.latest_draft
    }
    if (pageDetailQuery.data?.published_version) return pageDetailQuery.data.published_version
    if (publicPageQuery.data?.version) return publicPageQuery.data.version
    return null
  }, [pageDetailQuery.data?.latest_draft, pageDetailQuery.data?.published_version, publicPageQuery.data?.version])

  const footerDescription = brandingQuery.data?.config_value.footer_description?.trim() || APP_DESCRIPTION
  const headerAnnouncement = brandingQuery.data?.config_value.header_announcement?.trim() || APP_HEADER_ANNOUNCEMENT

  const canPersistDraft = routeCapability.supportsPersistibleFlow && Boolean(pageSlug)

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
    return pageDetailQuery.data?.versions ?? []
  }, [pageDetailQuery.data?.versions])

  const selectedRevision = useMemo(() => {
    if (!selectedRevisionId) return null
    return revisions.find((version) => version.id === selectedRevisionId) ?? null
  }, [revisions, selectedRevisionId])

  const isCaptureModeActive = isSelectingCaptureArea || Boolean(captureRect) || isCapturingPage
  const proposalAssessment = useMemo(() => assessAiPageEditorProposal(proposal, { canPersistDraft }), [proposal, canPersistDraft])

  function buildCurrentVersionSnapshot() {
    if (!pageContextVersion) return null

    return {
      title: pageDetailQuery.data?.page.title ?? routeOption?.label ?? document.title,
      layout_json: structuredClone(pageContextVersion.layout_json),
      style_json: structuredClone(pageContextVersion.style_json),
      metadata: structuredClone(pageContextVersion.metadata ?? {}),
    }
  }

  function resetConversation(options?: { keepFeedback?: boolean }) {
    setMessages(buildConversationIntroMessages())
    setMessage("")
    setAttachments([])
    setProposal(null)
    setAwaitingImplementation(false)
    setSendStatus(null)
    setPostApplyDecision(null)
    setSelectedRevisionId(null)
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
    setOpen(false)
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
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(null)
    setOpen(true)
    if (captured) {
      setFeedback("Recorte adicionado como anexo.")
    }
  }

  function cancelCaptureSelection() {
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(null)
    setOpen(true)
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

  async function refreshCurrentPageContent() {
    if (!pageSlug) return

    const publicPageKey = ["site", "page", pageSlug] as const
    const adminPageKey = ["admin", "site-pages", pageSlug] as const

    queryClient.removeQueries({ queryKey: publicPageKey, exact: true })
    queryClient.removeQueries({ queryKey: adminPageKey, exact: true })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: publicPageKey }),
      queryClient.invalidateQueries({ queryKey: adminPageKey }),
      queryClient.refetchQueries({ queryKey: publicPageKey, type: "active" }),
      queryClient.refetchQueries({ queryKey: adminPageKey, type: "active" }),
    ])
  }

  function pushPreviewToCurrentPage(
    version: Pick<AdminSitePageVersion, "layout_json" | "style_json">,
    previewContext?: ReturnType<typeof buildPreviewProposalPayload> | null,
  ) {
    if (!pageSlug) return
    const document = resolveBuilderDocumentFromLayoutJson(pageSlug as SitePageSlug, version.layout_json)
    const html = renderDocumentToHtml(document)
    const css = composeManagedPageCss(
      typeof version.style_json.css === "string" && String(version.style_json.css).trim()
        ? String(version.style_json.css)
        : "",
    )
    const token = storeSitePagePreview({
      slug: pageSlug,
      html,
      css,
      summary: previewContext?.summary,
      explanation: previewContext?.explanation,
      warnings: previewContext?.warnings,
      editPlan: previewContext?.editPlan,
      baseVersion: previewContext?.baseVersion,
      targetResolutions: previewContext?.targetResolutions,
      aiInvariants: previewContext?.aiInvariants,
      highlightSelectors: previewContext?.highlightSelectors,
    })
    if (!token) return

    const nextParams = new URLSearchParams(search)
    nextParams.set("builder-preview", token)
    navigate({ pathname, search: `?${nextParams.toString()}` }, { replace: true })
  }

  function syncPageDetailCache(nextVersion: AdminSitePageVersion, nextPage = pageDetailQuery.data?.page) {
    if (!pageSlug || !nextPage) return

    const cacheKey = ["admin", "site-pages", pageSlug] as const
    const currentDetail = queryClient.getQueryData<AdminSitePageDetail>(cacheKey) ?? pageDetailQuery.data ?? null
    const currentVersions = currentDetail?.versions ?? []
    const filteredVersions = currentVersions.filter((version) => version.id !== nextVersion.id)

    queryClient.setQueryData<AdminSitePageDetail>(cacheKey, {
      page: nextPage,
      versions: [nextVersion, ...filteredVersions],
      published_version: currentDetail?.published_version ?? null,
      latest_draft: nextVersion,
      assets: currentDetail?.assets ?? [],
    })
  }

  async function applyDraftFromProposal(nextProposal: AdminAiPageEditorProposal) {
    const nextAssessment = assessAiPageEditorProposal(nextProposal, { canPersistDraft })
    if (!nextProposal || !pageSlug || !canPersistDraft) {
      setFeedback("Esta área ainda não guarda alterações automáticas.")
      return
    }
    if (!nextAssessment?.canApply) {
      setFeedback(nextAssessment?.reasons[0] ?? "Esta proposta precisa de revisão antes de ser aplicada.")
      return
    }

    setFeedback(null)
    try {
      const previousVersionSnapshot = buildCurrentVersionSnapshot()

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

      pushPreviewToCurrentPage(result.version, buildPreviewProposalPayload(nextProposal))
      syncPageDetailCache(result.version, result.page)
      setPendingPublication({
        draftVersion: result.version,
        previousVersionSnapshot,
      })
      setSelectedRevisionId(null)
      setProposal(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setFeedback("Rascunho derivado do patch seguro aplicado. Revê a prévia antes de publicar.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível guardar a alteração.")
    }
  }

  async function handleConfirmAppliedChanges() {
    if (!pageSlug || !pendingPublication?.draftVersion.id) {
      setFeedback("Não encontrei uma alteração pronta para confirmar.")
      return
    }

    setFeedback(null)
    try {
      const result = await publishMutation.mutateAsync({
        slug: pageSlug,
        versionId: pendingPublication.draftVersion.id,
      })

      clearPreviewFromCurrentPage()
      await refreshCurrentPageContent()
      setPendingPublication(null)
      setSelectedRevisionId(null)
      setProposal(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setPostApplyDecision(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: "A alteração foi confirmada e já está visível no site.",
        },
      ])
      setFeedback(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível confirmar a alteração.")
    }
  }

  async function handleUndoAppliedChanges() {
    if (!pageSlug || !pendingPublication?.previousVersionSnapshot) {
      setFeedback("Não encontrei um estado anterior para desfazer esta alteração.")
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
      syncPageDetailCache(result.version, result.page)
      setPendingPublication(null)
      setSelectedRevisionId(null)
      setProposal(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setPostApplyDecision(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: "A alteração foi desfeita e a página voltou ao estado anterior.",
        },
      ])
      setFeedback(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível desfazer a alteração.")
    }
  }

  async function handleRestoreRevision(version: AdminSitePageVersion) {
    if (!pageSlug || !canPersistDraft) {
      setFeedback("Esta página ainda não guarda esse tipo de alteração.")
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
          text: "A página voltou ao estado escolhido.",
        },
      ])
      setProposal(null)
      setPendingPublication(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setFeedback("A página foi atualizada.")
      resetConversation({ keepFeedback: true })
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível restaurar a alteração.")
    }
  }

  void handleRestoreRevision

  function handlePreviewRevision(version: AdminSitePageVersion) {
    setSelectedRevisionId(version.id)
    pushPreviewToCurrentPage(version)
    setProposal(null)
    setPendingPublication(null)
    setAwaitingImplementation(false)
    setPostApplyDecision(null)
    setFeedback(`Pré-visualização da versão ${version.version_number} carregada. Se estiver certa, usa "Definir esta revisão".`)
  }

  function handleCancelRevisionPreview() {
    clearPreviewFromCurrentPage()
    setSelectedRevisionId(null)
    setFeedback("Pré-visualização descartada. A página voltou à versão publicada.")
  }

  async function handleApplySelectedRevision() {
    if (!pageSlug || !selectedRevision) {
      setFeedback("Seleciona uma revisão antes de defini-la.")
      return
    }

    setFeedback(null)
    try {
      const result = await rollbackMutation.mutateAsync({
        slug: pageSlug,
        versionId: selectedRevision.id,
      })

      clearPreviewFromCurrentPage()
      await refreshCurrentPageContent()
      setSelectedRevisionId(null)
      setPendingPublication(null)
      setProposal(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setPostApplyDecision(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: `A versão ${selectedRevision.version_number} foi definida como a revisão atual da página.`,
        },
      ])
      setFeedback(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível definir esta revisão.")
    }
  }

  function continueAppliedSession() {
    if (!postApplyDecision) return
    setPostApplyDecision(null)
    setFeedback("Sessão mantida aberta para novos ajustes.")
  }

  function finalizeAppliedSession() {
    if (!postApplyDecision) return
    setPostApplyDecision(null)
    setPendingPublication(null)
    setFeedback("Sessão finalizada. Nova conversa iniciada.")
    resetConversation({ keepFeedback: true })
  }

  async function handleSend() {
    if (!canRenderLauncher) return
    if (config?.config_value.enabled === false) {
      setFeedback("O editor de IA está desativado nas configurações.")
      return
    }
    const trimmedMessage = message.trim()
    if (!trimmedMessage && attachments.length === 0) return

    flushSync(() => {
      setFeedback(null)
      setSendStatus("Mensagem recebida. Estou a analisar o pedido e a área da página agora.")
      setMessages((current) => [
        ...current,
        { id: uid("msg"), role: "user", text: trimmedMessage || "Anexo enviado para análise visual." },
      ])
    })

    await waitForNextPaint()

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
            text: `${result.summary}\n\n${result.explanation}\n\nO topo do site foi atualizado.`,
          },
        ])
        setFeedback("Topo do site atualizado.")
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
            text: `${result.summary}\n\n${result.explanation}\n\nO rodapé do site foi atualizado.`,
          },
        ])
        setFeedback("Rodapé do site atualizado.")
        resetConversation({ keepFeedback: true })
        return
      }

      if (!canPersistDraft) {
        const blockedMessage =
          routeCapability.reason ??
          "Nesta fase, o editor com IA aplica patches persistíveis apenas em páginas públicas com slug conhecido."

        setProposal(null)
        setAwaitingImplementation(false)
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "assistant",
            text:
              `${blockedMessage}\n\n` +
              "Se quiseres editar uma seção com preview e publicação segura, abre uma página pública gerida por `site_page_versions` como Home, Sobre, Privacidade, Cookies ou Termos.",
          },
        ])
        setFeedback(blockedMessage)
        setMessage("")
        return
      }

      const result = await generateMutation.mutateAsync({
        slug: pageSlug ?? pathname,
        title: routeOption?.label ?? document.title,
        path: pathname,
        message:
          trimmedMessage ||
          "Analisar os anexos e propor a melhor alteração pontual, preservando a página como está e mudando apenas o ponto solicitado.",
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
        edit_plan: result.edit_plan,
        proposal: result.proposal,
      }
      const nextAssessment = assessAiPageEditorProposal(nextProposal, { canPersistDraft })
      const planLabel = `${formatAiPageEditorModeLabel(result.edit_plan.mode)} · ${formatAiPageEditorScopeLabel(result.edit_plan.scope)} · risco ${formatAiPageEditorRiskLabel(result.edit_plan.risk_level).toLowerCase()}`
      const nextMinConfidence = nextAssessment?.minConfidence ?? null
      const confidenceSummary =
        nextMinConfidence !== null
          ? `Confidence mínima: ${formatAiPageEditorConfidence(nextMinConfidence)}.`
          : "Confidence não informada pelo resolvedor de alvo."
      const reviewMessage =
        nextAssessment && nextAssessment.status === "blocked"
          ? `Preciso que refines o pedido antes de aplicar.\n\nMotivo principal: ${nextAssessment.reasons[0] ?? "o alvo ainda está ambíguo."}`
          : nextAssessment?.status === "review"
            ? "Encontrei um alvo com confidence intermediária. A proposta continua disponível, mas exige revisão cuidadosa antes de aplicar."
            : "A proposta ficou pronta para o fluxo de draft, preview e confirmação."

      setProposal(nextProposal)
      setAwaitingImplementation(Boolean(nextAssessment?.canApply))
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "assistant",
          text:
            `Analisei o pedido e gerei um plano derivado do patch engine.\n\n` +
            `${result.summary}\n\n` +
            `${result.explanation}\n\n` +
            `Plano: ${planLabel}\n${confidenceSummary}\n\n${reviewMessage}`,
        },
      ])
      setMessage("")
      setFeedback(
        nextAssessment?.status === "blocked"
          ? nextAssessment.reasons[0] ?? "A proposta precisa de refinamento antes da aplicação."
          : nextAssessment?.status === "review"
            ? "A proposta ficou em revisão: confirme o alvo antes de aplicar."
            : null,
      )
    } catch (error) {
      const errorMessage = normalizeAdminAiPageEditorError(error).message
      setFeedback(errorMessage)
      setMessages((current) => [...current, { id: uid("msg"), role: "system", text: errorMessage }])
    } finally {
      setSendStatus(null)
    }
  }

  function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    void handleSend()
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void handleSend()
    }
  }

  if (!canRenderLauncher) {
    return null
  }

  const panelTitle = config?.config_value.launcher_label ?? "Fazer ajustes"
  const currentLabel = routeOption?.label ?? pathname
  const currentVersionId = pageDetailQuery.data?.published_version?.id ?? pageContextVersion?.id ?? null
  const isChatBusy = Boolean(sendStatus) || generateMutation.isPending
  const isEditorDisabled = config?.config_value.enabled === false
  const showPersistibleRestriction = !canPersistDraft
  const proposalWarnings = proposalAssessment?.warnings ?? proposal?.warnings ?? []
  const shouldDisableApply = saveDraftMutation.isPending || !proposalAssessment?.canApply
  const composerPlaceholder = isEditorDisabled
    ? "Editor desativado nas configurações."
    : isChatBusy
      ? "Envio em processamento. Aguarda a resposta..."
      : showPersistibleRestriction
        ? "Header/footer global ainda podem ser editados; o fluxo persistível por seção fica nas páginas públicas geridas."
        : "Ex.: remove o padding-top da primeira seção e mantém o resto da página intacto..."

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
          <div
            className="absolute right-4 top-4 flex flex-wrap gap-2"
            onMouseDown={(event) => event.stopPropagation()}
            onMouseUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {captureRect && !isCapturingPage ? (
              <button
                type="button"
                className="rounded-full border border-emerald-300 bg-emerald-500 px-5 py-2.5 text-sm font-bold tracking-wide text-white shadow-[0_16px_30px_rgba(16,185,129,0.35)] transition hover:bg-emerald-600 hover:border-emerald-400 hover:shadow-[0_18px_36px_rgba(16,185,129,0.42)] focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
                onClick={() => void confirmCaptureSelection()}
              >
                Confirmar
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-rose-300 bg-white px-5 py-2.5 text-sm font-bold tracking-wide text-rose-700 shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2"
              onClick={cancelCaptureSelection}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {open && !isCaptureModeActive ? (
        <div className="pointer-events-auto flex h-[min(78vh,720px)] w-[min(92vw,460px)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
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
              {showPersistibleRestriction ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Escopo desta fase</p>
                  <p className="mt-2">
                    {routeCapability.reason}
                  </p>
                  <p className="mt-2">
                    Header e footer globais continuam suportados. Para preview persistível por seção, usa uma página pública com slug conhecido.
                  </p>
                </div>
              ) : null}

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

              {proposal && proposalAssessment ? (
                <div
                  className={[
                    "rounded-2xl border px-3 py-3",
                    proposalAssessment.status === "blocked"
                      ? "border-rose-200 bg-rose-50"
                      : proposalAssessment.status === "review"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">Plano derivado</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      {formatAiPageEditorModeLabel(proposal.edit_plan.mode)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      {formatAiPageEditorScopeLabel(proposal.edit_plan.scope)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      Risco {formatAiPageEditorRiskLabel(proposal.edit_plan.risk_level).toLowerCase()}
                    </span>
                    {proposalAssessment.baseVersion ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-800">
                        Base v{proposalAssessment.baseVersion.version_number}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-950">{proposal.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{proposal.explanation}</p>

                  <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-900">Resolução de alvo</p>
                      <p className="mt-1">Targets: {proposalAssessment.targetIds.length > 0 ? proposalAssessment.targetIds.join(", ") : "escopo amplo"}</p>
                      <p className="mt-1">Confidence mínima: {formatAiPageEditorConfidence(proposalAssessment.minConfidence)}</p>
                      <p className="mt-1">Confidence média: {formatAiPageEditorConfidence(proposalAssessment.averageConfidence)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-900">Invariantes</p>
                      <p className="mt-1">Preview: {proposalAssessment.previewRenderable ? "renderizável" : "inválido"}</p>
                      <p className="mt-1">Desktop: {proposalAssessment.desktopRenderable ? "ok" : "falhou"}</p>
                      <p className="mt-1">Mobile: {proposalAssessment.mobileRenderable ? "ok" : "falhou"}</p>
                    </div>
                  </div>

                  {proposal.edit_plan.operations.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold text-slate-900">Operações</p>
                      <div className="mt-2 space-y-2">
                        {proposal.edit_plan.operations.slice(0, 6).map((operation, index) => (
                          <div key={`${operation.type}-${operation.target_id}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                            <p className="font-semibold text-slate-900">
                              {formatAiPageEditorOperationTypeLabel(operation.type)} · {operation.target_id}
                            </p>
                            <p className="mt-1">
                              Breakpoint: {formatAiPageEditorBreakpointLabel(operation.breakpoint)}
                              {operation.path ? ` · path ${operation.path}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {proposalAssessment.targetResolutions.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold text-slate-900">Targets resolvidos</p>
                      <div className="mt-2 space-y-2">
                        {proposalAssessment.targetResolutions.slice(0, 4).map((resolution) => (
                          <div key={`${resolution.requested_target_id}-${resolution.resolved_target_id}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                            <p className="font-semibold text-slate-900">
                              {resolution.requested_target_id} → {resolution.resolved_target_id}
                            </p>
                            <p className="mt-1">
                              Confidence {formatAiPageEditorConfidence(resolution.confidence)} · seção {resolution.section_index + 1}
                            </p>
                            <p className="mt-1 break-all text-slate-500">{resolution.selector || resolution.candidate_path}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {proposalWarnings.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-950">
                      <p className="font-semibold text-amber-900">Warnings</p>
                      <ul className="mt-2 space-y-1">
                        {proposalWarnings.map((warning) => (
                          <li key={warning}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {proposalAssessment.reasons.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-950">
                      <p className="font-semibold text-rose-900">Bloqueios desta proposta</p>
                      <ul className="mt-2 space-y-1">
                        {proposalAssessment.reasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {proposal && awaitingImplementation ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Confirmação</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    Desejas que eu implemente este plano derivado na base v{proposalAssessment?.baseVersion?.version_number ?? "?"}, gere o draft e atualize a prévia da página?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-full"
                      onClick={() => void applyDraftFromProposal(proposal)}
                      disabled={shouldDisableApply}
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
                    As alterações já foram aplicadas e estão visíveis apenas para ti. Se confirmares, esta mudança vai para o site. Se não confirmares, podes desfazer e voltar ao que estava antes.
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
                      {saveDraftMutation.isPending ? "A desfazer..." : "Desfazer e voltar"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {postApplyDecision ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Ajuste guardado</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    A alteração foi guardada. Podes continuar a mesma conversa para mais ajustes ou terminar e começar uma nova.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="h-9 rounded-full" onClick={continueAppliedSession}>
                      Manter esta sessão
                    </Button>
                    <Button type="button" variant="outline" className="h-9 rounded-full" onClick={finalizeAppliedSession}>
                      Terminar e começar nova
                    </Button>
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {feedback}
                </div>
              ) : null}

              {sendStatus ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">A processar</p>
                  <p className="mt-1 leading-6">{sendStatus}</p>
                </div>
              ) : null}


              <div ref={messagesEndRef} />
            </div>

            <form
              className="rounded-3xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
              onSubmit={handleComposerSubmit}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
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
                  onKeyDown={handleComposerKeyDown}
                  rows={3}
                  disabled={isChatBusy || isEditorDisabled}
                  aria-busy={isChatBusy}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder={composerPlaceholder}
                />
              </label>

              <div className="mt-3 flex items-center gap-2">
                <label
                  className={[
                    "inline-flex h-10 items-center gap-2 rounded-full border bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition",
                    isChatBusy || isEditorDisabled
                      ? "cursor-not-allowed border-slate-100 opacity-60"
                      : "cursor-pointer border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                >
                  <ImagePlus className="h-4 w-4" />
                  Anexo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={isChatBusy || isEditorDisabled}
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
                  disabled={isCapturingPage || isSelectingCaptureArea || isChatBusy}
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
                  type="submit"
                  className="h-10 flex-1 rounded-full"
                  disabled={isChatBusy || isEditorDisabled}
                >
                  {isChatBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A processar...
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
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {revisions.map((version) => {
                      const isCurrent = version.id === currentVersionId
                      const isSelected = version.id === selectedRevisionId
                      return (
                        <div
                          key={version.id}
                          className={[
                            "rounded-2xl border bg-white px-3 py-2 transition",
                            isSelected ? "border-sky-300 shadow-sm" : "border-slate-200",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">Versão {version.version_number}</p>
                              <p className="text-xs text-slate-500">
                                {version.status} • {formatDateTime(version.created_at)}
                              </p>
                            </div>
                            {isCurrent ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Atual</span> : null}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => handlePreviewRevision(version)}
                              disabled={saveDraftMutation.isPending || rollbackMutation.isPending}
                            >
                              <History className="mr-2 h-3.5 w-3.5" />
                              {isSelected ? "Prévia carregada" : "Ver revisão"}
                            </Button>
                            {isSelected ? (
                              <Button
                                type="button"
                                className="h-8 rounded-full"
                                onClick={() => void handleApplySelectedRevision()}
                                disabled={isCurrent || rollbackMutation.isPending}
                              >
                                <Check className="mr-2 h-3.5 w-3.5" />
                                {rollbackMutation.isPending ? "A definir..." : isCurrent ? "Já atual" : "Definir esta revisão"}
                              </Button>
                            ) : null}
                            {isSelected ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 rounded-full"
                                onClick={handleCancelRevisionPreview}
                                disabled={rollbackMutation.isPending}
                              >
                                <X className="mr-2 h-3.5 w-3.5" />
                                Voltar à publicada
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
            </form>
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


