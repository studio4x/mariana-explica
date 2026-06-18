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
  useAdminOptionalSitePageDetail,
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
  convertLegacyHtmlToBuilderDocument,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { APP_DESCRIPTION, APP_HEADER_ANNOUNCEMENT } from "@/lib/constants"
import {
  AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE,
  detectManagedPageOperationDiff,
  normalizeAdminAiPageEditorError,
} from "@/lib/ai-page-editor-response"
import {
  assessAiPageEditorProposal,
  getAiPageEditorRouteCapability,
  isAiPageEditorAllowedPath,
  shouldUsePublishedVersionForAiContext,
} from "@/lib/ai-page-editor"
import type {
  AdminAiPageEditorAttachmentInput,
  AdminAiPageEditorAttachmentMetadata,
  AdminAiPageEditorConversationContext,
  AdminAiPageEditorConversationPhase,
  AdminAiPageEditorConversationResponse,
  AdminAiPageEditorPendingImageInsert,
  AdminAiPageEditorProposal,
  AdminAiPageEditorProposalMetadata,
  AdminSitePageDetail,
  AdminSitePageVersion,
} from "@/types/app.types"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  quickReplies?: string[]
}

type AttachmentItem = AdminAiPageEditorAttachmentInput

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
    reader.onerror = () => reject(new Error("Nao foi possivel ler o anexo."))
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  })
}

function getSanitizedDomSnapshot() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return ""
  }

  const mainContent = document.querySelector("main")
  const root = (mainContent?.cloneNode(true) as HTMLElement | null) ?? (document.body.cloneNode(true) as HTMLElement)
  root.querySelectorAll("[data-ai-page-editor-root]").forEach((node) => node.remove())
  return root.innerHTML
}

function useSupportedCurrentPage() {
  const location = useLocation()
  const routeCapability = getAiPageEditorRouteCapability(location.pathname)
  const publicPageQuery = usePublicSitePage(routeCapability.managedSlug ?? undefined)
  return { routeCapability, publicPageQuery, pathname: location.pathname, search: location.search }
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
        "Posso ajustar texto, partes da pagina e areas globais do site sem mexer no que nao pediste.\n\n" +
        "Como interagir:\n" +
        "- descreve o ajuste de forma direta;\n" +
        "- se a mudanca for no header ou footer global, indica isso explicitamente;\n" +
        "- podes colar uma imagem no campo de mensagem ou usar o botao \"Capturar area\" para abrir um seletor e anexar um recorte.\n\n" +
        "Limites:\n" +
        "- nao altero permissoes, pagamentos, RLS, integracoes ou segredos;\n" +
        "- pedidos vagos tendem a gerar propostas conservadoras para preservar o layout;\n" +
        "- quando uma alteracao e concluida, a conversa recomeca para manter tudo simples.",
    },
  ]
}

function normalizeCaptureRect(start: CapturePoint, end: CapturePoint): CaptureRect {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return { left, top, width, height }
}

function normalizeLauncherComparableText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function stripQuickReplies(messages: ChatMessage[]) {
  return messages.map((entry) => (entry.quickReplies && entry.quickReplies.length > 0 ? { ...entry, quickReplies: [] } : entry))
}

function isPlainUnderstandingConfirmationReply(
  message: string,
  phase: AdminAiPageEditorConversationPhase | null,
  confirmationToken: string | null,
) {
  if (phase !== "awaiting_intent_confirmation" || !confirmationToken) return false
  const normalized = normalizeLauncherComparableText(message)
  if (!normalized) return false
  if (!/^(sim|e isso|isso|certo|perfeito|exatamente)(?:[,.! ]|$)/.test(normalized)) return false
  const trailing = normalized.replace(/^(sim|e isso|isso|certo|perfeito|exatamente)(?:[,.! ]|$)*/, "").trim()
  return trailing.length <= 18
}

function messageLooksLikeVisualSpacingRequest(message: string) {
  const normalizedMessage = normalizeLauncherComparableText(message)
  const hasSpacingSignal =
    /\b(espaco|espaco em branco|espaco vazio|espacamento|faixa branca|distancia|respiro|intervalo visual|padding|margin|margem|gap)\b/.test(
      normalizedMessage,
    ) ||
    /\b(antes da primeira secao|acima da primeira secao|fora da primeira secao|topo da primeira secao|dentro da primeira secao|inicio da pagina|topo da pagina|antes do conteudo)\b/.test(
      normalizedMessage,
    ) ||
    /\b(acima do rodape|antes do rodape|perto do rodape|perto do footer|ultima secao|secao final|fim da pagina)\b/.test(
      normalizedMessage,
    )

  const mentionsVisualBoundary =
    /\bentre o (cabecalho|header|menu|navbar) e a primeira secao\b/.test(normalizedMessage) ||
    /\bfaixa branca entre o (cabecalho|header|menu|navbar) e a primeira secao\b/.test(normalizedMessage) ||
    /\bespaco (em branco )?entre o (cabecalho|header|menu|navbar) e a primeira secao\b/.test(normalizedMessage) ||
    /\bdistancia entre o (cabecalho|header|menu|navbar) e a primeira secao\b/.test(normalizedMessage) ||
    /\brespiro entre o (cabecalho|header|menu|navbar) e a primeira secao\b/.test(normalizedMessage) ||
    /\bfaixa branca entre o (cabecalho|header|menu|navbar) e o conteudo\b/.test(normalizedMessage) ||
    /\bentre a ultima secao(?: da pagina)? e o (rodape|footer)\b/.test(normalizedMessage) ||
    /\bentre a secao final e o (rodape|footer)\b/.test(normalizedMessage) ||
    /\bfaixa branca (acima|antes) do (rodape|footer)\b/.test(normalizedMessage) ||
    /\bespaco (em branco )?(acima|antes|perto) do (rodape|footer)\b/.test(normalizedMessage)

  return hasSpacingSignal || mentionsVisualBoundary
}

function messageStrictlyTargetsGlobalHeader(message: string) {
  const normalizedMessage = normalizeLauncherComparableText(message)
  const mentionsHeader =
    /\b(header|navbar)\b/.test(normalizedMessage) ||
    /\bcabecalho(?:\s+(?:global|do site))?\b/.test(normalizedMessage) ||
    /\btopo do site\b/.test(normalizedMessage) ||
    /\banuncio do topo\b/.test(normalizedMessage)

  if (!mentionsHeader || messageLooksLikeVisualSpacingRequest(normalizedMessage)) {
    return false
  }

  return (
    /\b(texto|copy|mensagem|anuncio|headline|titulo|subtitulo|cta|chamada)\b/.test(normalizedMessage) ||
    /\b(mudar|alterar|atualizar|trocar|substituir|reescrever|encurtar|ajustar)\b/.test(normalizedMessage)
  )
}

function messageStrictlyTargetsGlobalFooter(message: string) {
  const normalizedMessage = normalizeLauncherComparableText(message)
  const mentionsFooter = /\bfooter\b/.test(normalizedMessage) || /\brodape(?:\s+(?:global|do site))?\b/.test(normalizedMessage)
  if (!mentionsFooter || messageLooksLikeVisualSpacingRequest(normalizedMessage)) {
    return false
  }

  return (
    /\b(texto|copy|frase|conteudo|descricao|copyright|pontuacao|mensagem|institucional)\b/.test(normalizedMessage) ||
    /\b(mudar|alterar|atualizar|trocar|substituir|reescrever|corrigir|encurtar|ajustar)\b/.test(normalizedMessage)
  )
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function messageLooksLikeReferenceImage(value: string) {
  const normalized = normalizeLauncherComparableText(value)
  return /\b(referencia|inspiracao|inspiracao visual|estilo de referencia|exemplo visual)\b/.test(normalized)
}

function handleNextPendingImageInsertAfterAttachmentRemoval(
  pendingImageInsert: AdminAiPageEditorPendingImageInsert | null,
  attachmentId: string,
) {
  if (!pendingImageInsert) return null
  if (pendingImageInsert.capture_attachment_id === attachmentId) {
    return null
  }
  if (pendingImageInsert.image_asset_attachment_id === attachmentId) {
    return {
      ...pendingImageInsert,
      image_asset_attachment_id: null,
      status: "waiting_for_image_asset" as const,
    }
  }
  return pendingImageInsert
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

function getProposalBranchSelected(proposal: AdminAiPageEditorProposal | null | undefined) {
  const metadata = proposal?.proposal?.metadata
  if (!metadata || typeof metadata !== "object") return ""
  const aiInvariants =
    "ai_invariants" in metadata && metadata.ai_invariants && typeof metadata.ai_invariants === "object"
      ? (metadata.ai_invariants as Record<string, unknown>)
      : null
  return typeof aiInvariants?.branch_selected === "string" ? aiInvariants.branch_selected.trim() : ""
}

function getExplicitCssSelector(proposal: AdminAiPageEditorProposal | null | undefined) {
  const metadata = proposal?.proposal?.metadata
  if (!metadata || typeof metadata !== "object") return null
  const aiInvariants =
    "ai_invariants" in metadata && metadata.ai_invariants && typeof metadata.ai_invariants === "object"
      ? (metadata.ai_invariants as Record<string, unknown>)
      : null
  const selector = typeof aiInvariants?.explicit_css_selector === "string" ? aiInvariants.explicit_css_selector.trim() : ""
  return selector || null
}

function buildPreparedPreviewMessage(proposal: AdminAiPageEditorProposal) {
  const explicitCssSelector = getExplicitCssSelector(proposal)
  if (getProposalBranchSelected(proposal) === "explicit_css_patch" && explicitCssSelector) {
    return `Previa preparada ajustando a regra \`${explicitCssSelector}\`. Verifica a pagina antes de publicar.`
  }
  if (getProposalBranchSelected(proposal) === "image_insert_patch") {
    return "Previa preparada com a imagem inserida na area selecionada. Verifica a pagina antes de publicar."
  }
  return "Previa preparada com o ajuste pedido. Verifica a pagina antes de publicar."
}

function messageRequestsPreviewPreparation(message: string) {
  const normalizedMessage = normalizeLauncherComparableText(message)
  return (
    /\b(prepara(?:r)? a previa|abr(?:e|ir) a previa|gera(?:r)? a previa|mostra(?:r)? a previa|ver a previa)\b/.test(normalizedMessage) ||
    /\b(faca|faz|fa[cç]a|pode|sim)\s+(?:o\s+)?ajuste\b/.test(normalizedMessage)
  )
}

function messageRequestsProposalApply(message: string) {
  const normalizedMessage = normalizeLauncherComparableText(message)
  return (
    messageRequestsPreviewPreparation(message) ||
    /\b(pode aplicar|aplique|implemente|implementar|pode implementar|sim aplica)\b/.test(normalizedMessage)
  )
}

function messageRequestsPublish(message: string) {
  const normalizedMessage = normalizeLauncherComparableText(message)
  return /\b(publica|publique|publicar|pode publicar|confirma|confirmar|confirme|pode confirmar)\b/.test(normalizedMessage)
}

function shouldAutoApplyProposalFromConversation(
  proposal: AdminAiPageEditorProposal,
  currentPhase: AdminAiPageEditorConversationPhase | null,
  message: string,
) {
  const branchSelected = getProposalBranchSelected(proposal)
  if (branchSelected !== "explicit_css_patch" && branchSelected !== "image_insert_patch") return false
  if (messageRequestsProposalApply(message) || messageRequestsPublish(message)) {
    return true
  }
  return currentPhase === "awaiting_intent_confirmation"
}

function proposalRequiresPersistedPreview(proposal: AdminAiPageEditorProposal) {
  return proposal.final_status === "proposal_ready" || proposal.final_status === "awaiting_intent_confirmation"
}

function proposalAllowsDraftFlow(proposal: AdminAiPageEditorProposal) {
  return proposal.change_detected && proposal.preview_available && proposalRequiresPersistedPreview(proposal)
}

function hasConversationProposal(
  response: AdminAiPageEditorConversationResponse,
): response is AdminAiPageEditorConversationResponse &
  Required<Pick<AdminAiPageEditorConversationResponse, "proposal" | "edit_plan" | "summary" | "explanation">> {
  return Boolean(
    response.can_generate_proposal &&
      response.proposal &&
      response.edit_plan &&
      response.summary &&
      response.explanation,
  )
}

function resolveConversationStatusCopy(phase: AdminAiPageEditorConversationPhase | null, sendStatus: string | null) {
  if (sendStatus) return null
  if (phase === "needs_clarification") {
    return "Ainda estou a perceber melhor o que queres mudar."
  }
  if (phase === "awaiting_intent_confirmation") {
    return "Percebi o pedido e falta so a tua confirmacao."
  }
  if (phase === "ready_for_proposal") {
    return "Ja preparei o proximo passo para veres antes de publicar."
  }
  return null
}

export function SiteAiPageEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const configQuery = useAdminAiPageEditorConfig(isAdmin && !authLoading)
  const generateMutation = useGenerateAdminAiPageEditorProposal()
  const saveDraftMutation = useSaveAdminSitePageDraft()
  const publishMutation = usePublishAdminSitePageVersion()
  const rollbackMutation = useRollbackAdminSitePageVersion()
  const { routeCapability: discoveredRouteCapability, publicPageQuery, pathname, search } = useSupportedCurrentPage()
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
  const [conversationPhase, setConversationPhase] = useState<AdminAiPageEditorConversationPhase | null>(null)
  const [understandingSummary, setUnderstandingSummary] = useState<string | null>(null)
  const [clarificationQuestionsCount, setClarificationQuestionsCount] = useState(0)
  const [lastQuickReplySelected, setLastQuickReplySelected] = useState<string | null>(null)
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null)
  const [pendingImageInsert, setPendingImageInsert] = useState<AdminAiPageEditorPendingImageInsert | null>(null)
  const [awaitingImplementation, setAwaitingImplementation] = useState(false)
  const [pendingPublication, setPendingPublication] = useState<PendingPublicationState | null>(null)
  const [postApplyDecision, setPostApplyDecision] = useState<AdminSitePageVersion | null>(null)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null)
  const [isCapturingPage, setIsCapturingPage] = useState(false)
  const [isSelectingCaptureArea, setIsSelectingCaptureArea] = useState(false)
  const [captureStartPoint, setCaptureStartPoint] = useState<CapturePoint | null>(null)
  const [captureRect, setCaptureRect] = useState<CaptureRect | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const activeClientRequestIdRef = useRef<string | null>(null)
  const requestSequenceRef = useRef(0)

  const config = configQuery.data
  const allowedPath = !config || isAiPageEditorAllowedPath(pathname, config.config_value.allowed_paths)
  const routeCapability = useMemo(
    () => getAiPageEditorRouteCapability(pathname, { allowedPaths: config?.config_value.allowed_paths }),
    [config?.config_value.allowed_paths, pathname],
  )
  const canRenderLauncher = Boolean(isAdmin && !authLoading && allowedPath)
  const routeOption = routeCapability.routeOption ?? discoveredRouteCapability.routeOption
  const pageSlug = routeCapability.managedSlug
  const pageDetailQuery = useAdminOptionalSitePageDetail(
    isAdmin && !authLoading && routeCapability.routeIsPublic && pageSlug ? String(pageSlug) : undefined,
  )
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

  const importedPageBaseline = useMemo(() => {
    if (pageContextVersion || !pageSlug || typeof document === "undefined") {
      return null
    }

    const html = getSanitizedDomSnapshot()
    if (!html.trim()) {
      return null
    }

    const builderDocument = convertLegacyHtmlToBuilderDocument(html, pageSlug)
    return {
      html,
      layoutJson: {
        html,
        projectData: structuredClone(builderDocument),
      } as Record<string, unknown>,
      styleJson: {
        css: [
          ".me-managed-page-root{max-width:none;margin:0;padding:0;}",
          ".me-managed-block{width:100%;margin:0;}",
          ".me-managed-block + .me-managed-block{margin-top:0;}",
          ".me-managed-richtext{color:inherit;font:inherit;line-height:inherit;}",
        ].join(""),
      } as Record<string, unknown>,
    }
  }, [pageContextVersion, pageSlug, pathname])

  const currentLayoutJson = useMemo(() => {
    if (pageContextVersion) return pageContextVersion.layout_json
    return importedPageBaseline?.layoutJson ?? {}
  }, [importedPageBaseline?.layoutJson, pageContextVersion])

  const currentStyleJson = useMemo(() => {
    if (pageContextVersion) return pageContextVersion.style_json
    return importedPageBaseline?.styleJson ?? {}
  }, [importedPageBaseline?.styleJson, pageContextVersion])

  const currentHtml = useMemo(() => {
    if (previewPayload?.html) {
      return previewPayload.html
    }

    if (pageSlug && pageContextVersion) {
      const document = resolveBuilderDocumentFromLayoutJson(pageSlug, pageContextVersion.layout_json)
      return renderDocumentToHtml(document)
    }

    if (importedPageBaseline?.html) {
      return importedPageBaseline.html
    }

    return ""
  }, [importedPageBaseline?.html, pageContextVersion, pageSlug, previewPayload?.html])

  const revisions = useMemo(() => {
    return pageDetailQuery.data?.versions ?? []
  }, [pageDetailQuery.data?.versions])

  const selectedRevision = useMemo(() => {
    if (!selectedRevisionId) return null
    return revisions.find((version) => version.id === selectedRevisionId) ?? null
  }, [revisions, selectedRevisionId])

  const isCaptureModeActive = isSelectingCaptureArea || Boolean(captureRect) || isCapturingPage
  const proposalAssessment = useMemo(() => assessAiPageEditorProposal(proposal, { canPersistDraft }), [proposal, canPersistDraft])
  const conversationStatusCopy = useMemo(
    () => resolveConversationStatusCopy(conversationPhase, sendStatus),
    [conversationPhase, sendStatus],
  )

  function buildCurrentVersionSnapshot() {
    if (!pageContextVersion) {
      if (!importedPageBaseline) return null

      return {
        title: pageDetailQuery.data?.page.title ?? routeOption?.label ?? document.title,
        layout_json: structuredClone(importedPageBaseline.layoutJson),
        style_json: structuredClone(importedPageBaseline.styleJson),
        metadata: {
          editor: "ai-page-editor",
          source: "allowed_path_bootstrap",
          pathname,
        },
      }
    }

    return {
      title: pageDetailQuery.data?.page.title ?? routeOption?.label ?? document.title,
      layout_json: structuredClone(pageContextVersion.layout_json),
      style_json: structuredClone(pageContextVersion.style_json),
      metadata: structuredClone(pageContextVersion.metadata ?? {}),
    }
  }

  function buildConversationContext(): AdminAiPageEditorConversationContext {
    return {
      phase: conversationPhase,
      understanding_summary: understandingSummary,
      clarification_questions_count: clarificationQuestionsCount,
      quick_reply_selected: lastQuickReplySelected,
      confirmation_token: confirmationToken,
      pending_image_insert: pendingImageInsert,
      recent_messages: messages
        .flatMap((entry) =>
          entry.role === "user" || entry.role === "assistant"
            ? [
                {
                  role: entry.role,
                  text: entry.text,
                },
              ]
            : [],
        )
        .slice(-6),
    }
  }

  function resetConversation(options?: { keepFeedback?: boolean }) {
    setMessages(buildConversationIntroMessages())
    setMessage("")
    setAttachments([])
    setProposal(null)
    setAwaitingImplementation(false)
    setSendStatus(null)
    setConversationPhase(null)
    setUnderstandingSummary(null)
    setClarificationQuestionsCount(0)
    setLastQuickReplySelected(null)
    setConfirmationToken(null)
    setPendingImageInsert(null)
    setPostApplyDecision(null)
    setSelectedRevisionId(null)
    setIsSelectingCaptureArea(false)
    setCaptureStartPoint(null)
    setCaptureRect(null)
    setIsCapturingPage(false)
    activeClientRequestIdRef.current = null
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
        setFeedback("Selecao de area cancelada.")
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

  function addAttachmentsFromFiles(
    files: FileList | File[],
    options?: {
      role?: AttachmentItem["role"]
      metadata?: AdminAiPageEditorAttachmentMetadata | null
    },
  ) {
    const limit = config?.config_value.max_attachments ?? 2
    const nextFiles = Array.from(files).slice(0, Math.max(0, limit - attachments.length))
    const inferredRole =
      options?.role ??
      (pendingImageInsert?.status === "waiting_for_image_asset"
        ? "insert_image_asset"
        : messageLooksLikeReferenceImage(message)
          ? "reference_image"
          : "unknown")
    void Promise.all(
      nextFiles.map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file)
        return {
          id: uid("attachment"),
          name: file.name,
          mime_type: file.type || "application/octet-stream",
          data_url: dataUrl,
          size_bytes: file.size,
          role: inferredRole,
          metadata: options?.metadata ?? {
            source: "upload",
            target_path: pathname,
            target_slug: pageSlug,
          },
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
    addAttachmentsFromFiles(files, {
      metadata: {
        source: "paste",
        target_path: pathname,
        target_slug: pageSlug,
      },
    })
  }

  async function captureSelectedArea(rect: CaptureRect) {
    if (typeof document === "undefined") return false

    const limit = config?.config_value.max_attachments ?? 2
    if (attachments.length >= limit) {
      setFeedback(`Limite de anexos atingido (${limit}). Remove um anexo antes de capturar outra imagem.`)
      return false
    }

    if (rect.width < 24 || rect.height < 24) {
      setFeedback("A area selecionada e demasiado pequena.")
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
          role: "target_capture",
          metadata: {
            source: "capture",
            target_path: pathname,
            target_slug: pageSlug,
            capture_rect: rect,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        },
      ])
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: "Recorte da area selecionada anexado. Agora descreve o ajuste que queres fazer com base na imagem.",
        },
      ])
      setFeedback("Recorte adicionado como anexo.")
      return true
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel capturar a area selecionada.")
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
        text: "Modo de selecao ativo. Arrasta na pagina para escolher a area que queres capturar. Carrega em Esc para cancelar.",
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

  function renderManagedVersionHtml(version: Pick<AdminSitePageVersion, "layout_json">) {
    if (!pageSlug) return ""
    const document = resolveBuilderDocumentFromLayoutJson(pageSlug, version.layout_json)
    return renderDocumentToHtml(document)
  }

  function pushPreviewToCurrentPage(
    version: Pick<AdminSitePageVersion, "layout_json" | "style_json">,
    previewContext?: ReturnType<typeof buildPreviewProposalPayload> | null,
  ) {
    if (!pageSlug) return null
    const html = renderManagedVersionHtml(version)
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
    if (!token) return null

    const nextParams = new URLSearchParams(search)
    nextParams.set("builder-preview", token)
    navigate({ pathname, search: `?${nextParams.toString()}` }, { replace: true })
    return token
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

  function validateExplicitCssDraftPersistence(
    nextProposal: AdminAiPageEditorProposal,
    persistedVersion: Pick<AdminSitePageVersion, "style_json">,
  ) {
    if (getProposalBranchSelected(nextProposal) !== "explicit_css_patch") return

    const metadata = normalizeProposalMetadata(nextProposal.proposal.metadata)
    const aiInvariants = metadata.ai_invariants ?? {}
    const selector = typeof aiInvariants.explicit_css_selector === "string" ? aiInvariants.explicit_css_selector.trim() : ""
    const properties = Array.isArray(aiInvariants.explicit_css_properties)
      ? aiInvariants.explicit_css_properties.map((item) => String(item ?? "").trim()).filter(Boolean)
      : []
    const values = Array.isArray(aiInvariants.explicit_css_values)
      ? aiInvariants.explicit_css_values.map((item) => String(item ?? "").trim()).filter(Boolean)
      : []
    const persistedCss =
      typeof persistedVersion.style_json.css === "string" ? String(persistedVersion.style_json.css) : ""

    if (!selector || !persistedCss.includes(selector)) {
      throw new Error("O draft salvo nao manteve o seletor CSS explicito pedido.")
    }

    properties.forEach((property, index) => {
      const value = values[index] ?? ""
      if (!persistedCss.includes(`${property}: ${value} !important;`)) {
        throw new Error(`O draft salvo nao persistiu ${property} com o valor pedido.`)
      }
    })
  }

  async function applyDraftFromProposal(
    nextProposal: AdminAiPageEditorProposal,
    options?: {
      successMessage?: string
    },
  ) {
    const nextAssessment = assessAiPageEditorProposal(nextProposal, { canPersistDraft })
    if (!nextProposal || !pageSlug || !canPersistDraft) {
      setFeedback("Esta area ainda nao guarda alteracoes automaticas.")
      return
    }
    if (!proposalAllowsDraftFlow(nextProposal)) {
      setAwaitingImplementation(false)
      setFeedback(
        nextProposal.final_status === "no_visible_change" || !nextProposal.change_detected
          ? AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE
          : "Ainda nao existe evidencia suficiente para abrir o fluxo seguro de draft e previa desta proposta.",
      )
      return
    }
    if (!nextAssessment?.canApply) {
      setFeedback(nextAssessment?.reasons[0] ?? "Esta proposta precisa de revisao antes de ser aplicada.")
      return
    }

    setFeedback(null)
    try {
      const previousVersionSnapshot = buildCurrentVersionSnapshot()
      if (!previousVersionSnapshot) {
        throw new Error("Nao foi possivel confirmar a base atual da pagina antes de guardar o rascunho.")
      }

      const result = await saveDraftMutation.mutateAsync({
        slug: pageSlug,
        title: nextProposal.proposal.title,
        layoutJson: nextProposal.proposal.layout_json,
        styleJson: nextProposal.proposal.style_json,
        metadata: {
          ...nextProposal.proposal.metadata,
          ai_frontend: {
            branch_selected: getProposalBranchSelected(nextProposal) || null,
            frontend_assessment_status: nextAssessment.status,
            frontend_assessment_reason: nextAssessment.reasons[0] ?? null,
            draft_apply_attempted: true,
            explicit_css_validation: nextAssessment.metadata.ai_invariants?.explicit_css_validation ?? null,
          },
          editor: "ai-page-editor",
          source: nextProposal.provider_used,
          updated_at: new Date().toISOString(),
          ai_revision_kind: "proposal_apply",
        },
      })

      syncPageDetailCache(result.version, result.page)
      validateExplicitCssDraftPersistence(nextProposal, result.version)

      const persistedDiff = detectManagedPageOperationDiff(
        {
          title: previousVersionSnapshot.title,
          layout_json: previousVersionSnapshot.layout_json,
          style_json: previousVersionSnapshot.style_json,
          html: renderManagedVersionHtml({ layout_json: previousVersionSnapshot.layout_json }),
        },
        {
          title: nextProposal.proposal.title,
          layout_json: result.version.layout_json,
          style_json: result.version.style_json,
          html: renderManagedVersionHtml(result.version),
        },
      )

      if (!persistedDiff.change_detected) {
        setPendingPublication(null)
        setAwaitingImplementation(false)
        setFeedback(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE)
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "system",
            text: AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE,
          },
        ])
        return
      }

      const previewToken = pushPreviewToCurrentPage(result.version, {
        ...buildPreviewProposalPayload(nextProposal),
        aiInvariants: {
          ...(normalizeProposalMetadata(nextProposal.proposal.metadata).ai_invariants ?? {}),
          frontend_flow: {
            branch_selected: getProposalBranchSelected(nextProposal) || null,
            frontend_assessment_status: nextAssessment.status,
            frontend_assessment_reason: nextAssessment.reasons[0] ?? null,
            draft_apply_attempted: true,
            draft_saved: true,
            preview_token_created: true,
            preview_url_opened: true,
            pending_publication_set: true,
            explicit_css_validation: nextAssessment.metadata.ai_invariants?.explicit_css_validation ?? null,
          },
        },
      })
      if (proposalRequiresPersistedPreview(nextProposal) && !previewToken) {
        setPendingPublication(null)
        setAwaitingImplementation(false)
        setFeedback("O rascunho foi salvo, mas a pre-visualizacao segura nao ficou disponivel. Nenhum sucesso foi confirmado.")
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "system",
            text: "Guardei o rascunho, mas a pre-visualizacao segura nao ficou disponivel. Vou precisar de uma nova tentativa antes de confirmar sucesso.",
          },
        ])
        return
      }

      setPendingPublication({
        draftVersion: result.version,
        previousVersionSnapshot,
      })
      setSelectedRevisionId(null)
      setProposal(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setPendingImageInsert(null)
      const preparedMessage = options?.successMessage ?? buildPreparedPreviewMessage(nextProposal)
      setMessages((current) => [...current, { id: uid("msg"), role: "assistant", text: preparedMessage }])
      setFeedback(preparedMessage)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel guardar a alteracao.")
    }
  }

  async function handleConfirmAppliedChanges() {
    if (!pageSlug || !pendingPublication?.draftVersion.id) {
      setFeedback("Nao encontrei uma alteracao pronta para confirmar.")
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
      setPendingImageInsert(null)
      setPostApplyDecision(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: "A alteracao foi confirmada e ja esta visivel no site.",
        },
      ])
      setFeedback(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel confirmar a alteracao.")
    }
  }

  async function handleUndoAppliedChanges() {
    if (!pageSlug || !pendingPublication?.previousVersionSnapshot) {
      setFeedback("Nao encontrei um estado anterior para desfazer esta alteracao.")
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
      setPendingImageInsert(null)
      setPostApplyDecision(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: "A alteracao foi desfeita e a pagina voltou ao estado anterior.",
        },
      ])
      setFeedback(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel desfazer a alteracao.")
    }
  }

  async function handleRestoreRevision(version: AdminSitePageVersion) {
    if (!pageSlug || !canPersistDraft) {
      setFeedback("Esta pagina ainda nao guarda esse tipo de alteracao.")
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
          text: "A pagina voltou ao estado escolhido.",
        },
      ])
      setProposal(null)
      setPendingPublication(null)
      setAwaitingImplementation(false)
      setAttachments([])
      setPendingImageInsert(null)
      setFeedback("A pagina foi atualizada.")
      resetConversation({ keepFeedback: true })
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel restaurar a alteracao.")
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
    setFeedback(`Pre-visualizacao da versao ${version.version_number} carregada. Se estiver certa, usa "Definir esta revisao".`)
  }

  function handleCancelRevisionPreview() {
    clearPreviewFromCurrentPage()
    setSelectedRevisionId(null)
    setFeedback("Pre-visualizacao descartada. A pagina voltou a versao publicada.")
  }

  async function handleApplySelectedRevision() {
    if (!pageSlug || !selectedRevision) {
      setFeedback("Seleciona uma revisao antes de defini-la.")
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
      setPendingImageInsert(null)
      setPostApplyDecision(result.version)
      setMessages((current) => [
        ...current,
        {
          id: uid("msg"),
          role: "system",
          text: `A versao ${selectedRevision.version_number} foi definida como a revisao atual da pagina.`,
        },
      ])
      setFeedback(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel definir esta revisao.")
    }
  }

  function continueAppliedSession() {
    if (!postApplyDecision) return
    setPostApplyDecision(null)
    setFeedback("Sessao mantida aberta para novos ajustes.")
  }

  function finalizeAppliedSession() {
    if (!postApplyDecision) return
    setPostApplyDecision(null)
    setPendingPublication(null)
    setFeedback("Sessao finalizada. Nova conversa iniciada.")
    resetConversation({ keepFeedback: true })
  }

  function handleQuickReply(reply: string) {
    if (isChatBusy || isEditorDisabled) return
    setLastQuickReplySelected(reply)
    void handleSend(reply, { quickReplySelected: reply })
  }

  async function handleSend(
    messageOverride?: string,
    options?: {
      quickReplySelected?: string | null
    },
  ) {
    if (!canRenderLauncher) return
    if (config?.config_value.enabled === false) {
      setFeedback("O editor de IA esta desativado nas configuracoes.")
      return
    }
    const trimmedMessage = (messageOverride ?? message).trim()
    if (!trimmedMessage && attachments.length === 0) return

    const publishRequested = messageRequestsPublish(trimmedMessage)
    const applyRequested = messageRequestsProposalApply(trimmedMessage)

    if (!messageOverride && attachments.length === 0 && proposal && awaitingImplementation && (applyRequested || publishRequested)) {
      flushSync(() => {
        setFeedback(null)
        setSendStatus("Estou a guardar a previa segura desta alteracao.")
        setMessages((current) => [
          ...stripQuickReplies(current),
          { id: uid("msg"), role: "user", text: trimmedMessage },
        ])
      })
      await waitForNextPaint()

      try {
        await applyDraftFromProposal(proposal)
        setMessage("")
      } finally {
        setSendStatus(null)
      }
      return
    }

    if (!messageOverride && attachments.length === 0 && pendingPublication && (publishRequested || applyRequested)) {
      flushSync(() => {
        setFeedback(null)
        setMessages((current) => [
          ...stripQuickReplies(current),
          { id: uid("msg"), role: "user", text: trimmedMessage },
        ])
      })
      await waitForNextPaint()

      if (publishRequested) {
        try {
          setSendStatus("Estou a publicar a alteracao que ja esta em previa.")
          await handleConfirmAppliedChanges()
          setMessage("")
        } finally {
          setSendStatus(null)
        }
      } else {
        const confirmationMessage = "A previa ja esta pronta. Confirma que queres publicar esta alteracao?"
        setMessages((current) => [...current, { id: uid("msg"), role: "assistant", text: confirmationMessage }])
        setFeedback(confirmationMessage)
        setMessage("")
      }
      return
    }

    const conversationContext = buildConversationContext()
    const clientRequestId = `ai-editor-${Date.now()}-${requestSequenceRef.current + 1}`
    const consumesPendingConfirmation = isPlainUnderstandingConfirmationReply(
      trimmedMessage,
      conversationContext.phase ?? null,
      conversationContext.confirmation_token ?? null,
    )
    requestSequenceRef.current += 1
    activeClientRequestIdRef.current = clientRequestId

    flushSync(() => {
      setFeedback(null)
      setSendStatus("Estou a tentar perceber exatamente o que queres mudar.")
      if (consumesPendingConfirmation) {
        setConversationPhase(null)
        setConfirmationToken(null)
      }
      setMessages((current) => [
        ...stripQuickReplies(current),
        { id: uid("msg"), role: "user", text: trimmedMessage || "Anexo enviado para analise visual." },
      ])
    })

    await waitForNextPaint()

    try {
      if (messageStrictlyTargetsGlobalHeader(trimmedMessage)) {
        if (!brandingQuery.data) {
          throw new Error("Nao foi possivel carregar o branding global do site.")
        }

        const result = await generateAdminAiHeaderCopyProposal({
          title: routeOption?.label ?? document.title,
          path: pathname,
          message: trimmedMessage,
          currentHeaderText: headerAnnouncement,
        })

        if (result.final_status === "no_visible_change" || !result.change_detected) {
          setProposal(null)
          setAwaitingImplementation(false)
          setMessage("")
          setMessages((current) => [
            ...current,
            {
              id: uid("msg"),
              role: "assistant",
              text: `${result.summary}\n\n${result.explanation}\n\n${AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE}`,
            },
          ])
          setFeedback(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE)
          return
        }

        if (result.final_status !== "proposal_ready") {
          const blockedMessage = "Ainda nao existe confirmacao suficiente para atualizar o topo global com seguranca."
          setProposal(null)
          setAwaitingImplementation(false)
          setMessage("")
          setMessages((current) => [
            ...current,
            {
              id: uid("msg"),
              role: "assistant",
              text: `${result.summary}\n\n${result.explanation}\n\n${blockedMessage}`,
            },
          ])
          setFeedback(blockedMessage)
          return
        }

        const updatedBranding = await updateAdminBrandingConfig({
          ...brandingQuery.data.config_value,
          header_announcement: result.header_announcement,
        })
        const persistedHeaderText = normalizeLauncherComparableText(updatedBranding.config_value.header_announcement)
        const requestedHeaderText = normalizeLauncherComparableText(result.header_announcement)
        const previousHeaderText = normalizeLauncherComparableText(headerAnnouncement)

        if (persistedHeaderText !== requestedHeaderText || persistedHeaderText === previousHeaderText) {
          throw new Error("O topo global nao confirmou uma alteracao persistida. Nenhum sucesso foi validado.")
        }

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

      if (messageStrictlyTargetsGlobalFooter(trimmedMessage)) {
        if (!brandingQuery.data) {
          throw new Error("Nao foi possivel carregar o branding global do site.")
        }

        const result = await generateAdminAiFooterCopyProposal({
          title: routeOption?.label ?? document.title,
          path: pathname,
          message: trimmedMessage,
          currentFooterText: footerDescription,
        })

        if (result.final_status === "no_visible_change" || !result.change_detected) {
          setProposal(null)
          setAwaitingImplementation(false)
          setMessage("")
          setMessages((current) => [
            ...current,
            {
              id: uid("msg"),
              role: "assistant",
              text: `${result.summary}\n\n${result.explanation}\n\n${AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE}`,
            },
          ])
          setFeedback(AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE)
          return
        }

        if (result.final_status !== "proposal_ready") {
          const blockedMessage = "Ainda nao existe confirmacao suficiente para atualizar o rodape global com seguranca."
          setProposal(null)
          setAwaitingImplementation(false)
          setMessage("")
          setMessages((current) => [
            ...current,
            {
              id: uid("msg"),
              role: "assistant",
              text: `${result.summary}\n\n${result.explanation}\n\n${blockedMessage}`,
            },
          ])
          setFeedback(blockedMessage)
          return
        }

        const updatedBranding = await updateAdminBrandingConfig({
          ...brandingQuery.data.config_value,
          footer_description: result.footer_description,
        })
        const persistedFooterText = normalizeLauncherComparableText(updatedBranding.config_value.footer_description)
        const requestedFooterText = normalizeLauncherComparableText(result.footer_description)
        const previousFooterText = normalizeLauncherComparableText(footerDescription)

        if (persistedFooterText !== requestedFooterText || persistedFooterText === previousFooterText) {
          throw new Error("O rodape global nao confirmou uma alteracao persistida. Nenhum sucesso foi validado.")
        }

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
            text: `${result.summary}\n\n${result.explanation}\n\nO rodape do site foi atualizado.`,
          },
        ])
        setFeedback("Rodape do site atualizado.")
        resetConversation({ keepFeedback: true })
        return
      }

      if (!canPersistDraft) {
        const blockedMessage =
          routeCapability.reason ??
          "Esta rota ainda nao entrou no fluxo seguro do editor com IA."

        setProposal(null)
        setAwaitingImplementation(false)
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "assistant",
            text:
              `${blockedMessage}\n\n` +
              "Para seguir com preview, draft, publicacao e rollback, usa apenas uma rota publica adicionada em Rotas permitidas.",
          },
        ])
        setFeedback(blockedMessage)
        setMessage("")
        return
      }

      const result = await generateMutation.mutateAsync({
        clientRequestId,
        slug: pageSlug ?? pathname,
        title: routeOption?.label ?? document.title,
        path: pathname,
        message:
          trimmedMessage ||
          "Analisar os anexos e propor a melhor alteracao pontual, preservando a pagina como esta e mudando apenas o ponto solicitado.",
        currentLayoutJson,
        currentStyleJson,
        currentHtml,
        attachments,
        conversationContext: {
          ...conversationContext,
          quick_reply_selected: options?.quickReplySelected ?? conversationContext.quick_reply_selected ?? null,
        },
      })
      if (!result || typeof result !== "object") {
        throw new Error("O editor com IA recebeu uma resposta incompleta do servidor. Nenhuma alteracao foi aplicada.")
      }

      if (result.client_request_id && result.client_request_id !== clientRequestId) {
        return
      }
      if (activeClientRequestIdRef.current !== clientRequestId) {
        return
      }

      const nextConversationPhase =
        result.final_status === "blocked" || result.final_status === "error" ? null : result.conversation_phase

      setConversationPhase(nextConversationPhase)
      setUnderstandingSummary(result.understanding_summary)
      if (Object.prototype.hasOwnProperty.call(result, "pending_image_insert")) {
        setPendingImageInsert(result.pending_image_insert ?? null)
      }
      setClarificationQuestionsCount((current) => {
        if (nextConversationPhase === "needs_clarification") {
          return Math.min(3, current + 1)
        }
        if (nextConversationPhase === "ready_for_proposal") {
          return 0
        }
        return current
      })
      setConfirmationToken(
        result.confirmation_consumed
          ? null
          : nextConversationPhase === "awaiting_intent_confirmation"
            ? result.confirmation_token ?? null
            : null,
      )
      setLastQuickReplySelected(null)

      let nextProposal: AdminAiPageEditorProposal | null = null
      let feedbackMessage: string | null = null
      let shouldAwaitImplementation = false
      let shouldAutoApplyProposal = false

      if (hasConversationProposal(result)) {
        nextProposal = {
          provider_used: result.provider_used,
          summary: result.summary,
          explanation: result.explanation,
          warnings: result.warnings,
          edit_plan: result.edit_plan,
          proposal: result.proposal,
          final_status: result.final_status,
          change_detected: result.change_detected,
          draft_saved: result.draft_saved,
          preview_available: result.preview_available,
          change_summary: result.change_summary,
        }

        const nextAssessment = assessAiPageEditorProposal(nextProposal, { canPersistDraft })
        shouldAwaitImplementation = Boolean(nextAssessment?.canApply)
        shouldAutoApplyProposal = Boolean(
          nextProposal &&
            nextAssessment?.canApply &&
            shouldAutoApplyProposalFromConversation(nextProposal, conversationContext.phase ?? null, trimmedMessage),
        )

        if (result.final_status === "no_visible_change" || !result.change_detected) {
          nextProposal = null
          shouldAwaitImplementation = false
          shouldAutoApplyProposal = false
          feedbackMessage = AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE
        } else if (result.final_status === "blocked" || result.final_status === "error") {
          shouldAwaitImplementation = false
          shouldAutoApplyProposal = false
          feedbackMessage = nextAssessment?.reasons[0] ?? "Ainda nao consegui preparar esta mudanca com seguranca."
        }
      }

      setProposal(nextProposal)
      setAwaitingImplementation(shouldAwaitImplementation)
      setMessage("")
      if (shouldAutoApplyProposal && nextProposal) {
        try {
          setSendStatus("Estou a guardar a previa segura desta alteracao.")
          await applyDraftFromProposal(nextProposal)
        } finally {
          setSendStatus(null)
        }
      } else {
        setMessages((current) => [
          ...current,
          {
            id: uid("msg"),
            role: "assistant",
            text: result.assistant_message,
            quickReplies: result.quick_replies,
          },
        ])
        setFeedback(feedbackMessage)
      }
    } catch (error) {
      if (activeClientRequestIdRef.current !== clientRequestId) {
        return
      }
      const errorMessage = normalizeAdminAiPageEditorError(error).message
      setFeedback(errorMessage)
      setMessages((current) => [...current, { id: uid("msg"), role: "system", text: errorMessage }])
    } finally {
      if (activeClientRequestIdRef.current === clientRequestId) {
        activeClientRequestIdRef.current = null
        setSendStatus(null)
      }
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
  const showBootstrapStatus = canPersistDraft && !pageContextVersion && Boolean(importedPageBaseline)
  const shouldDisableApply = saveDraftMutation.isPending || !proposalAssessment?.canApply
  const composerPlaceholder = isEditorDisabled
    ? "Editor desativado nas configuracoes."
    : isChatBusy
      ? "Envio em processamento. Aguarda a resposta..."
      : showPersistibleRestriction
        ? "Header/footer global ainda podem ser editados; o fluxo persistivel por secao fica apenas nas rotas publicas permitidas."
        : showBootstrapStatus
          ? "Estou a preparar esta pagina para edicao segura pela primeira vez. Ja a seguir podes criar uma previa antes de publicar."
          : "Ex.: esta parte esta muito afastada la em cima e quero mexer so aqui..."

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
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Selecao de area</p>
            <p className="mt-1">
              {isCapturingPage
                ? "A capturar a imagem... aguarda um instante."
                : captureRect
                  ? "Area selecionada. Confirma para anexar ou redefine a selecao arrastando novamente."
                  : "Arrasta para selecionar apenas a area que queres capturar. Carrega em Esc para cancelar."}
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
                    Header e footer globais continuam suportados. Para preview persistivel por secao, usa apenas uma rota publica adicionada em Rotas permitidas.
                  </p>
                </div>
              ) : null}

              {showBootstrapStatus ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-6 text-sky-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Primeira edicao segura</p>
                  <p className="mt-2">
                    Estou a preparar esta pagina para edicao segura pela primeira vez. Ja a seguir podes criar uma previa antes de publicar.
                  </p>
                </div>
              ) : null}

              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                  Ola! O site esta carregado. O que gostarias de alterar?
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
                  {entry.quickReplies && entry.quickReplies.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.quickReplies.map((reply) => (
                        <Button
                          key={`${entry.id}-${reply}`}
                          type="button"
                          variant="outline"
                          className="h-8 rounded-full bg-white"
                          onClick={() => handleQuickReply(reply)}
                          disabled={isChatBusy || isEditorDisabled}
                        >
                          {reply}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              {conversationStatusCopy ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-6 text-sky-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Conversa</p>
                  <p className="mt-2">{conversationStatusCopy}</p>
                </div>
              ) : null}

              {proposal && proposalAssessment ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">Resumo</p>
                  <p className="mt-2">
                    {understandingSummary
                      ? `Percebi assim: ${understandingSummary}`
                      : "Ja tenho contexto suficiente para preparar a pre-visualizacao desta mudanca."}
                  </p>
                  {proposalAssessment.baseVersion ? (
                    <p className="mt-2 text-xs text-slate-500">Base usada: versao {proposalAssessment.baseVersion.version_number}.</p>
                  ) : null}
                </div>
              ) : null}


              {proposal && awaitingImplementation ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Proximo passo</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    Se estiver certo, preparo uma versao para tu veres antes de publicar.
                    {proposalAssessment?.baseVersion ? ` Base usada: versao ${proposalAssessment.baseVersion.version_number}.` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-full"
                      onClick={() => void applyDraftFromProposal(proposal)}
                      disabled={shouldDisableApply}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {saveDraftMutation.isPending ? "A preparar..." : "Preparar previa"}
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
                            text: "Tudo bem. Fico por aqui ate quereres continuar.",
                          },
                        ])
                      }}
                    >
                      Ainda nao
                    </Button>
                  </div>
                </div>
              ) : null}

              {pendingPublication ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-700">Revisao pronta</p>
                  <p className="mt-2 text-sm leading-6 text-indigo-950">
                    As alteracoes ja foram aplicadas e estao visiveis apenas para ti. Se confirmares, esta mudanca vai para o site. Se nao confirmares, podes desfazer e voltar ao que estava antes.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-full"
                      onClick={() => void handleConfirmAppliedChanges()}
                      disabled={publishMutation.isPending || saveDraftMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {publishMutation.isPending ? "A publicar..." : "Confirmar alteracoes"}
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
                    A alteracao foi guardada. Podes continuar a mesma conversa para mais ajustes ou terminar e comecar uma nova.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="h-9 rounded-full" onClick={continueAppliedSession}>
                      Manter esta sessao
                    </Button>
                    <Button type="button" variant="outline" className="h-9 rounded-full" onClick={finalizeAppliedSession}>
                      Terminar e comecar nova
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
                        onClick={() =>
                          setAttachments((current) => {
                            setPendingImageInsert((pending) =>
                              handleNextPendingImageInsertAfterAttachmentRemoval(pending, attachment.id),
                            )
                            return current.filter((item) => item.id !== attachment.id)
                          })
                        }
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
                      Seleciona a area
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-4 w-4" />
                      Capturar area
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
                    Revisoes
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
                              <p className="text-sm font-semibold text-slate-950">Versao {version.version_number}</p>
                              <p className="text-xs text-slate-500">
                                {version.status} - {formatDateTime(version.created_at)}
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
                              {isSelected ? "Previa carregada" : "Ver revisao"}
                            </Button>
                            {isSelected ? (
                              <Button
                                type="button"
                                className="h-8 rounded-full"
                                onClick={() => void handleApplySelectedRevision()}
                                disabled={isCurrent || rollbackMutation.isPending}
                              >
                                <Check className="mr-2 h-3.5 w-3.5" />
                                {rollbackMutation.isPending ? "A definir..." : isCurrent ? "Ja atual" : "Definir esta revisao"}
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
                                Voltar a publicada
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






