import type {
  AdminAiPageEditorBaseVersionInfo,
  AdminAiPageEditorBreakpoint,
  AdminAiPageEditorEditPlan,
  AdminAiPageEditorMode,
  AdminAiPageEditorOperationType,
  AdminAiPageEditorProposal,
  AdminAiPageEditorProposalMetadata,
  AdminAiPageEditorRiskLevel,
  AdminAiPageEditorScope,
  AdminAiPageEditorTargetResolution,
  SitePageSlug,
} from "@/types/app.types"

export interface AiPageEditorRouteOption {
  slug: SitePageSlug | null
  label: string
  path: string
}

export interface AiPageEditorRouteCapability {
  routeOption: AiPageEditorRouteOption | null
  supportsPersistibleFlow: boolean
  mode: "managed_site_page" | "context_only"
  reason: string | null
}

export interface AiPageEditorProposalAssessment {
  status: "ready" | "review" | "blocked"
  canApply: boolean
  requiresStrictConfirmation: boolean
  needsUserClarification: boolean
  routeSupportsPersistibleFlow: boolean
  metadata: AdminAiPageEditorProposalMetadata
  baseVersion: AdminAiPageEditorBaseVersionInfo | null
  targetResolutions: AdminAiPageEditorTargetResolution[]
  highlightSelectors: string[]
  targetIds: string[]
  minConfidence: number | null
  averageConfidence: number | null
  lowConfidenceTargets: AdminAiPageEditorTargetResolution[]
  reviewTargets: AdminAiPageEditorTargetResolution[]
  unsupportedOperationTypes: AdminAiPageEditorOperationType[]
  previewRenderable: boolean
  desktopRenderable: boolean
  mobileRenderable: boolean
  warnings: string[]
  reasons: string[]
}

export const AI_PAGE_EDITOR_ROUTE_OPTIONS: AiPageEditorRouteOption[] = [
  { slug: "home", label: "Home", path: "/" },
  { slug: "sobre", label: "Sobre", path: "/sobre" },
  { slug: "privacidade", label: "Privacidade", path: "/privacidade" },
  { slug: "cookies", label: "Cookies", path: "/cookies" },
  { slug: "termos", label: "Termos de uso", path: "/termos-de-uso" },
  { slug: null, label: "Área do aluno · Dashboard", path: "/aluno/dashboard" },
  { slug: null, label: "Área do aluno · Materiais", path: "/aluno/cursos" },
  { slug: null, label: "Área do aluno · Detalhe do material", path: "/aluno/cursos/:courseId" },
  { slug: null, label: "Área do aluno · Player do curso", path: "/aluno/cursos/:courseId/player/*" },
  { slug: null, label: "Área do aluno · Downloads", path: "/aluno/downloads" },
  { slug: null, label: "Área do aluno · Pagamentos", path: "/aluno/pagamentos" },
  { slug: null, label: "Área do aluno · Notificações", path: "/aluno/notificacoes" },
  { slug: null, label: "Área do aluno · Chamados", path: "/aluno/chamados" },
  { slug: null, label: "Área do aluno · Perfil", path: "/aluno/perfil" },
]

export const AI_PAGE_EDITOR_DEFAULT_ALLOWED_PATHS = AI_PAGE_EDITOR_ROUTE_OPTIONS.map((item) => item.path)
export const AI_PAGE_EDITOR_PERSISTIBLE_ROUTE_OPTIONS = AI_PAGE_EDITOR_ROUTE_OPTIONS.filter(
  (item): item is AiPageEditorRouteOption & { slug: SitePageSlug } => Boolean(item.slug),
)

const SEMI_ASSISTED_OPERATION_TYPES = new Set<AdminAiPageEditorOperationType>([
  "move_node",
  "wrap_children",
  "unwrap_children",
])

const LOW_CONFIDENCE_THRESHOLD = 0.65
const REVIEW_CONFIDENCE_THRESHOLD = 0.8

function normalizePathname(pathname: string) {
  const trimmed = String(pathname ?? "").trim()
  if (!trimmed) return "/"
  if (trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeLayoutSearchText(value: unknown): string {
  if (typeof value === "string") {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeLayoutSearchText(item)).join(" ")
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizeLayoutSearchText(item))
      .join(" ")
  }

  return ""
}

function countManagedBlocks(layoutJson: Record<string, unknown>) {
  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : null

  if (Array.isArray(projectData?.blocks)) return projectData.blocks.length
  if (Array.isArray(layoutJson.blocks)) return layoutJson.blocks.length
  return 0
}

function matchPathPattern(pathname: string, pattern: string) {
  const normalizedPath = normalizePathname(pathname)
  const normalizedPattern = normalizePathname(pattern)

  if (normalizedPattern === normalizedPath) {
    return true
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean)
  const patternSegments = normalizedPattern.split("/").filter(Boolean)
  const hasWildcard = patternSegments[patternSegments.length - 1] === "*"
  const comparablePatternSegments = hasWildcard ? patternSegments.slice(0, -1) : patternSegments

  if (!hasWildcard && comparablePatternSegments.length !== pathSegments.length) {
    return false
  }

  if (hasWildcard && comparablePatternSegments.length > pathSegments.length) {
    return false
  }

  for (let index = 0; index < comparablePatternSegments.length; index += 1) {
    const patternSegment = comparablePatternSegments[index]
    const pathSegment = pathSegments[index]

    if (patternSegment?.startsWith(":")) {
      if (!pathSegment) return false
      continue
    }

    if (patternSegment !== pathSegment) {
      return false
    }
  }

  return hasWildcard || comparablePatternSegments.length === pathSegments.length
}

export function getAiPageEditorRouteOption(pathname: string) {
  return AI_PAGE_EDITOR_ROUTE_OPTIONS.find((item) => matchPathPattern(pathname, item.path)) ?? null
}

export function isAiPageEditorAllowedPath(pathname: string, allowedPaths: string[]) {
  if (allowedPaths.length === 0) return false
  return allowedPaths.some((pattern) => matchPathPattern(pathname, pattern))
}

export function shouldUsePublishedVersionForAiContext(
  draft: { version_number: number; layout_json: Record<string, unknown> } | null | undefined,
  published: { version_number: number; layout_json: Record<string, unknown> } | null | undefined,
) {
  if (!draft || !published) return false

  if (draft.version_number < published.version_number) return true

  const draftBlocks = countManagedBlocks(draft.layout_json)
  const publishedBlocks = countManagedBlocks(published.layout_json)
  if (publishedBlocks > 0 && draftBlocks === 0) return true
  if (publishedBlocks > 0 && draftBlocks > 0 && draftBlocks < publishedBlocks) return true

  const draftText = normalizeLayoutSearchText(draft.layout_json)
  const publishedText = normalizeLayoutSearchText(published.layout_json)
  if (publishedText.length > 500 && draftText.length === 0) return true
  if (publishedText.length > 500 && draftText.length < publishedText.length * 0.6) return true

  return false
}

export function isAiPageEditorManagedPersistibleRoute(pathname: string) {
  return Boolean(getAiPageEditorRouteOption(pathname)?.slug)
}

export function getAiPageEditorRouteCapability(pathname: string): AiPageEditorRouteCapability {
  const routeOption = getAiPageEditorRouteOption(pathname)
  const supportsPersistibleFlow = Boolean(routeOption?.slug)

  return {
    routeOption,
    supportsPersistibleFlow,
    mode: supportsPersistibleFlow ? "managed_site_page" : "context_only",
    reason: supportsPersistibleFlow
      ? null
      : "Nesta fase, o fluxo com draft, preview, publish e rollback fica restrito a páginas públicas geridas por slug conhecido em site_page_versions.",
  }
}

export function getAiPageEditorProposalMetadata(
  proposal: AdminAiPageEditorProposal | null | undefined,
): AdminAiPageEditorProposalMetadata {
  if (!proposal?.proposal?.metadata || typeof proposal.proposal.metadata !== "object") {
    return {}
  }
  return proposal.proposal.metadata
}

export function formatAiPageEditorScopeLabel(scope: AdminAiPageEditorScope) {
  switch (scope) {
    case "text":
      return "Texto"
    case "block":
      return "Bloco"
    case "section":
      return "Seção"
    case "page":
      return "Página"
    case "header":
      return "Header"
    case "footer":
      return "Footer"
    default:
      return scope
  }
}

export function formatAiPageEditorModeLabel(mode: AdminAiPageEditorMode) {
  switch (mode) {
    case "text_patch":
      return "Patch de texto"
    case "style_patch":
      return "Patch de estilo"
    case "spacing_patch":
      return "Patch de spacing"
    case "section_layout_patch":
      return "Patch de layout da seção"
    case "section_replace":
      return "Substituição de seção"
    default:
      return mode
  }
}

export function formatAiPageEditorRiskLabel(risk: AdminAiPageEditorRiskLevel) {
  switch (risk) {
    case "low":
      return "Baixo"
    case "medium":
      return "Médio"
    case "high":
      return "Alto"
    default:
      return risk
  }
}

export function formatAiPageEditorOperationTypeLabel(type: AdminAiPageEditorOperationType) {
  switch (type) {
    case "set_style":
      return "Definir estilo"
    case "remove_style":
      return "Remover estilo"
    case "update_text":
      return "Atualizar texto"
    case "move_node":
      return "Mover nó"
    case "replace_section":
      return "Substituir seção"
    case "set_responsive_rule":
      return "Regra responsiva"
    case "wrap_children":
      return "Agrupar filhos"
    case "unwrap_children":
      return "Desagrupar filhos"
    case "change_columns":
      return "Alterar colunas"
    default:
      return type
  }
}

export function formatAiPageEditorBreakpointLabel(breakpoint: AdminAiPageEditorBreakpoint) {
  switch (breakpoint) {
    case "mobile":
      return "Mobile"
    case "tablet":
      return "Tablet"
    case "desktop":
      return "Desktop"
    case "all":
      return "Todos"
    default:
      return breakpoint
  }
}

export function formatAiPageEditorConfidence(confidence: number | null) {
  if (confidence === null) return "n/a"
  return `${Math.round(confidence * 100)}%`
}

function normalizeEditPlanTargetIds(plan: AdminAiPageEditorEditPlan | null | undefined) {
  const operationTargetIds = Array.isArray(plan?.operations)
    ? plan!.operations.map((operation) => operation.target_id)
    : []
  return uniqueStrings([...(plan?.target_ids ?? []), ...operationTargetIds])
}

function normalizeTargetResolutions(metadata: AdminAiPageEditorProposalMetadata) {
  const resolutions = metadata.ai_invariants?.target_resolutions
  return Array.isArray(resolutions) ? resolutions : []
}

function collectConfidenceStats(targetResolutions: AdminAiPageEditorTargetResolution[]) {
  const values = targetResolutions
    .map((item) => toFiniteNumber(item.confidence))
    .filter((value): value is number => value !== null)

  if (values.length === 0) {
    return {
      minConfidence: null,
      averageConfidence: null,
    }
  }

  const minConfidence = Math.min(...values)
  const averageConfidence = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    minConfidence,
    averageConfidence,
  }
}

function collectDuplicateResolvedTargetIds(targetResolutions: AdminAiPageEditorTargetResolution[]) {
  const counts = new Map<string, number>()
  targetResolutions.forEach((item) => {
    const key = String(item.resolved_target_id ?? "").trim()
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([targetId]) => targetId)
}

export function assessAiPageEditorProposal(
  proposal: AdminAiPageEditorProposal | null | undefined,
  options: { canPersistDraft: boolean },
): AiPageEditorProposalAssessment | null {
  if (!proposal) return null

  const metadata = getAiPageEditorProposalMetadata(proposal)
  const aiInvariants = metadata.ai_invariants ?? {}
  const baseVersion = metadata.base_version ?? null
  const targetResolutions = normalizeTargetResolutions(metadata)
  const targetIds = normalizeEditPlanTargetIds(proposal.edit_plan)
  const highlightSelectors = uniqueStrings(targetResolutions.map((item) => item.selector))
  const { minConfidence, averageConfidence } = collectConfidenceStats(targetResolutions)
  const lowConfidenceTargets = targetResolutions.filter((item) => (toFiniteNumber(item.confidence) ?? 0) < LOW_CONFIDENCE_THRESHOLD)
  const reviewTargets = targetResolutions.filter((item) => {
    const confidence = toFiniteNumber(item.confidence) ?? 0
    return confidence >= LOW_CONFIDENCE_THRESHOLD && confidence < REVIEW_CONFIDENCE_THRESHOLD
  })
  const unsupportedOperationTypes = Array.from(
    new Set(
      proposal.edit_plan.operations
        .map((operation) => operation.type)
        .filter((type) => SEMI_ASSISTED_OPERATION_TYPES.has(type)),
    ),
  )
  const duplicateResolvedTargetIds = collectDuplicateResolvedTargetIds(targetResolutions)
  const previewRenderable = normalizeBoolean(aiInvariants.preview_renderable, true)
  const desktopRenderable = normalizeBoolean(aiInvariants.desktop_renderable, true)
  const mobileRenderable = normalizeBoolean(aiInvariants.mobile_renderable, true)
  const routeSupportsPersistibleFlow =
    options.canPersistDraft &&
    metadata.ai_invariants?.supports_persistible_flow !== false &&
    Boolean(baseVersion)

  const reasons: string[] = []
  const warnings = [...proposal.warnings]
  const backendStatus = proposal.final_status

  if (!options.canPersistDraft) {
    reasons.push("A rota atual não participa do fluxo persistível desta fase.")
  }

  if (!proposal.change_detected) {
    reasons.push("O backend não detectou diff real entre a base e o resultado final desta tentativa.")
  }

  if (options.canPersistDraft && !proposal.preview_available) {
    reasons.push("O backend não conseguiu garantir uma pré-visualização válida para esta tentativa.")
  }

  if (backendStatus === "no_visible_change") {
    reasons.push("A tentativa foi classificada pelo backend como sem alteração visível.")
  }

  if (backendStatus === "needs_clarification") {
    reasons.push("O backend pediu refinamento adicional do alvo antes de seguir com a aplicação.")
  }

  if (backendStatus === "blocked" || backendStatus === "error") {
    reasons.push("O backend não marcou a proposta como pronta para o fluxo seguro atual.")
  }

  if (!baseVersion) {
    reasons.push("O backend não devolveu uma base_version válida para esta proposta.")
  }

  if (metadata.ai_invariants?.supports_persistible_flow === false) {
    reasons.push("O backend marcou a proposta como fora do fluxo persistível suportado.")
  }

  if (!previewRenderable || !desktopRenderable || !mobileRenderable) {
    reasons.push("O resultado derivado do patch engine não ficou renderizável em todos os contextos exigidos.")
  }

  if (unsupportedOperationTypes.length > 0) {
    reasons.push(
      `A proposta depende de operações semiassistidas ainda não promovidas como fluxo principal nesta fase: ${unsupportedOperationTypes.join(", ")}.`,
    )
  }

  if (targetIds.length > 0 && targetResolutions.length === 0) {
    reasons.push("A proposta não trouxe resoluções de alvo suficientes para aplicar o patch com segurança.")
  }

  if (targetIds.length > targetResolutions.length) {
    reasons.push("Nem todos os targets pedidos foram resolvidos pelo backend com confiança suficiente.")
  }

  if (lowConfidenceTargets.length > 0) {
    reasons.push("Há alvos com confidence baixa; a aplicação automática foi bloqueada para evitar mexer no lugar errado.")
  }

  if (reviewTargets.length > 0) {
    warnings.push("Há alvos com confidence intermediária. Revise o plano e refine o pedido se necessário.")
  }

  if (duplicateResolvedTargetIds.length > 0) {
    warnings.push(
      `Mais de um target pedido convergiu para o mesmo alvo resolvido (${duplicateResolvedTargetIds.join(", ")}). Confira se a intenção está específica o suficiente.`,
    )
  }

  const canApply =
    routeSupportsPersistibleFlow &&
    proposal.change_detected &&
    proposal.preview_available &&
    reasons.length === 0 &&
    previewRenderable &&
    desktopRenderable &&
    mobileRenderable

  const status =
    canApply
      ? (backendStatus === "awaiting_intent_confirmation" || reviewTargets.length > 0 ? "review" : "ready")
      : "blocked"
  const requiresStrictConfirmation =
    proposal.edit_plan.requires_strict_confirmation ||
    backendStatus === "awaiting_intent_confirmation" ||
    proposal.edit_plan.risk_level === "high" ||
    status !== "ready"

  return {
    status,
    canApply,
    requiresStrictConfirmation,
    needsUserClarification: status === "blocked",
    routeSupportsPersistibleFlow,
    metadata,
    baseVersion,
    targetResolutions,
    highlightSelectors,
    targetIds,
    minConfidence,
    averageConfidence,
    lowConfidenceTargets,
    reviewTargets,
    unsupportedOperationTypes,
    previewRenderable,
    desktopRenderable,
    mobileRenderable,
    warnings: uniqueStrings(warnings),
    reasons,
  }
}
