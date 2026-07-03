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
} from "@/types/app.types"

export type AiPageEditorRouteKind = "public_content" | "sensitive" | "private"

export interface AiPageEditorRouteOption {
  slug: string | null
  label: string
  path: string
  kind?: AiPageEditorRouteKind
}

export interface AiPageEditorRouteCapability {
  routeOption: AiPageEditorRouteOption | null
  normalizedPath: string
  managedSlug: string | null
  routeIsAllowed: boolean
  routeIsPublic: boolean
  routeIsSensitive: boolean
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
  { slug: "home", label: "Home", path: "/", kind: "public_content" },
  { slug: "sobre", label: "Sobre", path: "/sobre", kind: "public_content" },
  { slug: "explicacoes", label: "Explicacoes", path: "/explicacoes", kind: "public_content" },
  { slug: "materiais", label: "Materiais", path: "/materiais", kind: "public_content" },
  { slug: "suporte", label: "Suporte", path: "/suporte", kind: "public_content" },
  { slug: "privacidade", label: "Privacidade", path: "/privacidade", kind: "public_content" },
  { slug: "cookies", label: "Cookies", path: "/cookies", kind: "public_content" },
  { slug: "termos", label: "Termos de uso", path: "/termos-de-uso", kind: "public_content" },
  { slug: null, label: "Autenticacao · Login", path: "/login", kind: "sensitive" },
  { slug: null, label: "Autenticacao · Criar conta", path: "/criar-conta", kind: "sensitive" },
  { slug: null, label: "Checkout", path: "/checkout", kind: "sensitive" },
  { slug: null, label: "Checkout · Confirmacao", path: "/checkout/confirmacao", kind: "sensitive" },
  { slug: null, label: "Pagina do material", path: "/materiais/:slug", kind: "sensitive" },
  { slug: null, label: "Área do aluno · Dashboard", path: "/aluno/dashboard" },
  { slug: null, label: "Área do aluno · Materiais", path: "/aluno/cursos" },
  { slug: null, label: "Área do aluno · Detalhe do material", path: "/aluno/cursos/:courseId" },
  { slug: null, label: "Área do aluno · Player do curso", path: "/aluno/cursos/:courseId/player/*" },
  { slug: null, label: "Área do aluno · Downloads", path: "/aluno/downloads" },
  { slug: null, label: "Área do aluno · Pagamentos", path: "/aluno/pagamentos" },
  { slug: null, label: "Área do aluno · Notificações", path: "/aluno/notificacoes" },
  { slug: null, label: "Área do aluno · Suporte", path: "/aluno/suporte" },
  { slug: null, label: "Área do aluno · Perfil", path: "/aluno/perfil" },
]

const AI_PAGE_EDITOR_SPECIAL_SLUGS: Record<string, string> = {
  "/": "home",
  "/termos-de-uso": "termos",
}

const PRIVATE_ROUTE_PREFIXES = ["/admin", "/aluno"]
const SENSITIVE_ROUTE_PREFIXES = ["/checkout", "/login", "/criar-conta", "/cadastro"]

export const AI_PAGE_EDITOR_DEFAULT_ALLOWED_PATHS = AI_PAGE_EDITOR_ROUTE_OPTIONS.filter(
  (item) => item.slug && !item.path.includes(":") && !item.path.includes("*"),
).map((item) => item.path)
export const AI_PAGE_EDITOR_PERSISTIBLE_ROUTE_OPTIONS = AI_PAGE_EDITOR_ROUTE_OPTIONS.filter(
  (item): item is AiPageEditorRouteOption & { slug: string } => Boolean(item.slug),
)

const SEMI_ASSISTED_OPERATION_TYPES = new Set<AdminAiPageEditorOperationType>([
  "move_node",
  "wrap_children",
  "unwrap_children",
])

const LOW_CONFIDENCE_THRESHOLD = 0.65
const REVIEW_CONFIDENCE_THRESHOLD = 0.8

function normalizePathname(pathname: string) {
  const trimmed = String(pathname ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/, 1)[0]
  if (!trimmed) return "/"
  if (trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

function normalizeTextToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function slugifyRouteSegment(value: string) {
  return normalizeTextToken(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function formatDynamicRouteLabel(pathname: string) {
  if (pathname === "/") return "Home"
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .split("-")
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" "),
    )
    .join(" / ")
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

export function isAiPageEditorSensitivePath(pathname: string) {
  const normalizedPath = normalizePathname(pathname)
  if (!normalizedPath.startsWith("/")) return true
  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return true
  }
  return SENSITIVE_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
}

export function isAiPageEditorPublicContentPath(pathname: string) {
  const normalizedPath = normalizePathname(pathname)
  return normalizedPath.startsWith("/") && !isAiPageEditorSensitivePath(normalizedPath)
}

export function resolveAiPageEditorManagedSlug(pathname: string) {
  const normalizedPath = normalizePathname(pathname)
  if (!isAiPageEditorPublicContentPath(normalizedPath)) return null
  if (AI_PAGE_EDITOR_SPECIAL_SLUGS[normalizedPath]) {
    return AI_PAGE_EDITOR_SPECIAL_SLUGS[normalizedPath]
  }

  const slug = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => slugifyRouteSegment(segment))
    .filter(Boolean)
    .join("--")

  return slug || "home"
}

export function getAiPageEditorRouteOption(pathname: string) {
  const normalizedPath = normalizePathname(pathname)
  const matchedRoute = AI_PAGE_EDITOR_ROUTE_OPTIONS.find((item) => matchPathPattern(normalizedPath, item.path)) ?? null
  if (matchedRoute) return matchedRoute

  if (!isAiPageEditorPublicContentPath(normalizedPath)) {
    return null
  }

  return {
    slug: resolveAiPageEditorManagedSlug(normalizedPath),
    label: formatDynamicRouteLabel(normalizedPath),
    path: normalizedPath,
    kind: "public_content" as const,
  }
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

export function isAiPageEditorManagedPersistibleRoute(pathname: string, allowedPaths?: string[]) {
  return getAiPageEditorRouteCapability(pathname, { allowedPaths }).supportsPersistibleFlow
}

export function getAiPageEditorRouteCapability(
  pathname: string,
  options?: { allowedPaths?: string[] },
): AiPageEditorRouteCapability {
  const normalizedPath = normalizePathname(pathname)
  const routeOption = getAiPageEditorRouteOption(normalizedPath)
  const routeIsPublic = isAiPageEditorPublicContentPath(normalizedPath)
  const routeIsSensitive = !routeIsPublic
  const routeIsAllowed = options?.allowedPaths ? isAiPageEditorAllowedPath(normalizedPath, options.allowedPaths) : true
  const managedSlug = routeIsPublic ? resolveAiPageEditorManagedSlug(normalizedPath) : null
  const supportsPersistibleFlow = Boolean(routeIsPublic && routeIsAllowed && managedSlug)
  let reason: string | null = null

  if (!supportsPersistibleFlow) {
    if (routeIsSensitive) {
      reason = 'Esta area continua bloqueada para edicao segura com draft, preview e publicacao porque e privada, administrativa, de autenticacao ou sensivel.'
    } else if (!routeIsAllowed) {
      reason = 'A rota atual ainda nao esta nas Rotas permitidas do editor com IA.'
    } else {
      reason = 'Ainda nao consegui preparar uma rota publica segura e estavel para este caminho.'
    }
  }

  return {
    routeOption,
    normalizedPath,
    managedSlug,
    routeIsAllowed,
    routeIsPublic,
    routeIsSensitive,
    supportsPersistibleFlow,
    mode: supportsPersistibleFlow ? 'managed_site_page' : 'context_only',
    reason,
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
    case "image_patch":
      return "Patch de imagem"
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
    case "set_asset":
      return "Atualizar asset"
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

function normalizeEditPlanTargetIds(
  plan: AdminAiPageEditorEditPlan | null | undefined,
  metadata?: AdminAiPageEditorProposalMetadata | null,
) {
  const branchSelected = metadata?.ai_invariants?.branch_selected
  const explicitCssSelector =
    typeof metadata?.ai_invariants?.explicit_css_selector === "string"
      ? metadata.ai_invariants.explicit_css_selector.trim()
      : ""
  const operationTargetIds = Array.isArray(plan?.operations)
    ? plan!.operations
        .map((operation) => String(operation.target_id ?? "").trim())
        .filter((targetId) => !(branchSelected === "explicit_css_patch" && targetId === "explicit_css_selector"))
    : []
  const targetIds = uniqueStrings(
    [...(plan?.target_ids ?? []), ...operationTargetIds].map((targetId) =>
      branchSelected === "explicit_css_patch" && targetId === "explicit_css_selector" && explicitCssSelector
        ? explicitCssSelector
        : String(targetId ?? "").trim(),
    ),
  )

  if (branchSelected === "explicit_css_patch" && explicitCssSelector) {
    return uniqueStrings([...targetIds, explicitCssSelector])
  }

  return targetIds
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
  const branchSelected = String(aiInvariants.branch_selected ?? "").trim()
  const isExplicitCssPatch = branchSelected === "explicit_css_patch"
  const explicitCssSelector =
    typeof aiInvariants.explicit_css_selector === "string" ? aiInvariants.explicit_css_selector.trim() : ""
  const explicitCssProperties = Array.isArray(aiInvariants.explicit_css_properties)
    ? aiInvariants.explicit_css_properties.map((item) => String(item ?? "").trim()).filter(Boolean)
    : []
  const explicitCssValues = Array.isArray(aiInvariants.explicit_css_values)
    ? aiInvariants.explicit_css_values.map((item) => String(item ?? "").trim()).filter(Boolean)
    : []
  const targetIds = normalizeEditPlanTargetIds(proposal.edit_plan, metadata)
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

  if (isExplicitCssPatch && !proposal.change_summary.style_changed) {
    reasons.push("O patch CSS explicito nao alterou o style_json persistivel desta pagina.")
  }

  if (isExplicitCssPatch && !explicitCssSelector) {
    reasons.push("A proposta CSS explicita nao devolveu o seletor validado para abrir a previa segura.")
  }

  if (isExplicitCssPatch && (explicitCssProperties.length === 0 || explicitCssValues.length === 0)) {
    reasons.push("A proposta CSS explicita nao devolveu propriedades e valores suficientes para auditoria local.")
  }

  if (isExplicitCssPatch && aiInvariants.explicit_css_patch_applied !== true) {
    reasons.push("O backend nao confirmou que o explicit_css_patch foi materializado com seguranca.")
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

  if (!isExplicitCssPatch && targetIds.length > targetResolutions.length) {
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
