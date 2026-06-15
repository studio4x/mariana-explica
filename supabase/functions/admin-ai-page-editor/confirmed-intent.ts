import type { AiEditPlan } from "./contract.ts"
import type { AiConversationContext } from "./conversation.ts"
import type { AiPageEditorFinalStatus, PersistibleProposalOperationalState } from "./operational-state.ts"
import { resolvePersistibleProposalOperationalState } from "./operational-state.ts"
import {
  applyPatchPlan,
  refineSpacingEditPlanForKnownWrappers,
  type PatchEngineBaseVersion,
  type SpacingSourceDiagnosis,
} from "./patch-engine.ts"

type ConfirmedSpacingScope =
  | "wrapper_only"
  | "first_section_only"
  | "section_internal_only"
  | "wrapper_and_first_section"

export interface ConfirmedIntentProposalResult {
  providerUsed: "gemini" | "openai"
  modelUsed: string
  summary: string
  explanation: string
  assistantMessage: string
  warnings: string[]
  conversationPhase: "ready_for_proposal"
  understandingSummary: string | null
  requiresUserConfirmation: false
  canGenerateProposal: true
  editPlan: AiEditPlan
  proposal: {
    slug: string
    title: string
    layout_json: Record<string, unknown>
    style_json: Record<string, unknown>
    metadata: Record<string, unknown>
  }
  operationalState: PersistibleProposalOperationalState
  diagnosis: SpacingSourceDiagnosis[]
  sourceText: string
  scope: ConfirmedSpacingScope
}

interface ConfirmedIntentProposalInput {
  providerUsed: "gemini" | "openai"
  modelUsed: string
  confirmationMessage: string
  slug: string
  title: string
  path: string
  conversationContext: AiConversationContext
  baseVersion: PatchEngineBaseVersion
  baseVersionSource: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  baseVersionSelectionReason: string
  publishedVersionId?: string | null
  latestDraftId?: string | null
}

export type ConfirmedIntentMaterializationResult =
  | {
      status: "not_applicable"
      scope: null
      sourceText: string
      understandingSummary: string | null
      reason: "missing_understanding_summary" | "not_known_spacing_intent"
    }
  | {
      status: "failed"
      scope: ConfirmedSpacingScope
      sourceText: string
      understandingSummary: string | null
      reason: string
      assistantMessage: string
      warnings: string[]
    }
  | ({
      status: "success"
    } & ConfirmedIntentProposalResult)

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function buildConfirmedIntentSourceTexts(input: {
  confirmationMessage: string
  conversationContext: AiConversationContext
}) {
  const understandingSummary = String(input.conversationContext.understanding_summary ?? "").trim()
  const recentUserMessages = input.conversationContext.recent_messages
    .filter((entry) => entry.role === "user")
    .map((entry) => String(entry.text ?? "").trim())
    .filter(Boolean)
    .filter((text) => normalizeText(text) !== normalizeText(input.confirmationMessage))

  return {
    understandingSummary,
    aggregate: uniqueStrings([understandingSummary, ...recentUserMessages]).join(" | "),
  }
}

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

function resolveConfirmedSpacingScope(input: {
  sourceText: string
  quickReplySelected: string | null
}) {
  const normalized = normalizeText(input.sourceText)
  const quickReply = normalizeText(input.quickReplySelected)

  const mentionsBroadRewrite = includesAny(normalized, [
    /\breescrev/,
    /\brecria/,
    /\bsubstitu/,
    /\btroca(r)? a secao inteira\b/,
    /\bmudar layout\b/,
    /\bduas colunas\b/,
  ])
  if (mentionsBroadRewrite) return null

  const mentionsSpacing = includesAny(normalized, [
    /\bespaco\b/,
    /\bespaco em branco\b/,
    /\bespaco vazio\b/,
    /\bespacamento\b/,
    /\bpadding\b/,
    /\bmargin\b/,
    /\bgap\b/,
    /\btopo\b/,
    /\binicio\b/,
    /\bantes do conteudo\b/,
  ])
  if (!mentionsSpacing) return null

  const mentionsInternal = includesAny(normalized, [
    /\bdentro da primeira secao\b/,
    /\binterno da primeira secao\b/,
    /\bpadding interno\b/,
    /\bdentro da secao\b/,
  ])
  if (mentionsInternal) return "section_internal_only" satisfies ConfirmedSpacingScope

  const mentionsWrapper = includesAny(normalized, [
    /\bwrapper global\b/,
    /\bwrapper da pagina\b/,
    /\bpage root\b/,
    /\bpage wrapper\b/,
    /\bme-managed-page-root\b/,
  ])
  const mentionsFirstSection = includesAny(normalized, [
    /\bprimeira secao\b/,
    /\btopo da primeira secao\b/,
    /\bantes de iniciar a primeira secao\b/,
    /\bantes da primeira secao\b/,
    /\bprimeiro bloco\b/,
  ])
  const mentionsPageStart = includesAny(normalized, [
    /\btopo da pagina\b/,
    /\binicio da pagina\b/,
    /\bcomeco da pagina\b/,
    /\bantes do conteudo principal\b/,
    /\bantes do conteudo\b/,
  ])

  if (quickReply && /\b(nos dois|ambos)\b/.test(quickReply)) {
    return "wrapper_and_first_section" satisfies ConfirmedSpacingScope
  }

  if (mentionsWrapper && mentionsFirstSection) {
    return "wrapper_and_first_section" satisfies ConfirmedSpacingScope
  }

  if (mentionsWrapper) {
    return "wrapper_only" satisfies ConfirmedSpacingScope
  }

  if (mentionsFirstSection && !mentionsPageStart) {
    return "first_section_only" satisfies ConfirmedSpacingScope
  }

  if (mentionsPageStart || mentionsFirstSection) {
    return "wrapper_and_first_section" satisfies ConfirmedSpacingScope
  }

  return null
}

function buildSeedSpacingPlan(scope: ConfirmedSpacingScope): AiEditPlan {
  const targetIds =
    scope === "wrapper_only"
      ? ["page_wrapper_spacing"]
      : scope === "first_section_only"
        ? ["first_section_spacing"]
        : scope === "section_internal_only"
          ? ["section_internal_spacing"]
          : ["page_wrapper_spacing", "first_section_spacing"]

  return {
    scope: "section",
    mode: "spacing_patch",
    target_ids: targetIds,
    risk_level: targetIds.length > 1 ? "medium" : "low",
    requires_strict_confirmation: true,
    operations: targetIds.map((targetId) => ({
      type: "set_style" as const,
      target_id: targetId,
      path: "padding-top",
      value: 0,
      breakpoint: "all" as const,
    })),
  }
}

function buildCanonicalSpacingMessage(scope: ConfirmedSpacingScope) {
  if (scope === "wrapper_only") {
    return "remover o espaço no wrapper global da página"
  }

  if (scope === "first_section_only") {
    return "remover o espaço acima da primeira seção"
  }

  if (scope === "section_internal_only") {
    return "remover o espaço dentro da primeira seção"
  }

  return "remover o espaço no início da página"
}

function buildUserFacingCopy(targetIds: string[], title: string) {
  if (targetIds.length === 1 && targetIds[0] === "page_wrapper_spacing") {
    return {
      summary: `Remover o espaço antes do conteúdo da página ${title}.`,
      explanation: "Preparei um ajuste localizado só no topo da página, sem reescrever as seções.",
      assistantMessage: "Entendi. Preparei uma prévia só para tirar esse espaço do topo, sem mexer no resto da página.",
    }
  }

  if (targetIds.length === 1 && targetIds[0] === "first_section_spacing") {
    return {
      summary: `Remover o espaço no topo da primeira seção da página ${title}.`,
      explanation: "Preparei um ajuste localizado só na primeira seção, sem alterar o restante da página.",
      assistantMessage: "Entendi. Preparei uma prévia só para ajustar o início da primeira seção, sem mexer no resto.",
    }
  }

  if (targetIds.length === 1 && targetIds[0] === "section_internal_spacing") {
    return {
      summary: `Remover o espaço dentro da primeira seção da página ${title}.`,
      explanation: "Preparei um ajuste localizado apenas dentro da primeira seção atual.",
      assistantMessage: "Entendi. Preparei uma prévia só para reduzir esse espaço dentro da primeira seção.",
    }
  }

  return {
    summary: `Remover o espaço no topo da página ${title} e no início da primeira seção.`,
    explanation: "Preparei um ajuste localizado só nas fontes reais de espaço detectadas no início da página.",
    assistantMessage: "Entendi. Preparei uma prévia localizada para tirar esse espaço do topo sem reescrever a página.",
  }
}

function buildProposalMetadata(input: {
  editPlan: AiEditPlan
  baseVersion: PatchEngineBaseVersion
  baseVersionSource: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  baseVersionSelectionReason: string
  publishedVersionId?: string | null
  latestDraftId?: string | null
  sourceText: string
  diagnosis: SpacingSourceDiagnosis[]
  patchedInvariants: Record<string, unknown>
  targetResolutions: Array<Record<string, unknown>>
}) {
  return {
    ai_contract_version: "hybrid_v1",
    ai_edit_plan: input.editPlan,
    ai_invariants: {
      plan_source: "confirmed_intent",
      confirmed_intent_materialized: true,
      confirmed_intent_source_text: input.sourceText,
      scoped_patch: true,
      supports_persistible_flow: true,
      ...input.patchedInvariants,
      spacing_diagnosis: input.diagnosis,
      target_resolutions: input.targetResolutions,
      context_source: input.baseVersionSource,
      degraded_draft_bypassed: input.degradedDraftBypassed,
      context_selection_reason: input.baseVersionSelectionReason,
      published_version_id: input.publishedVersionId ?? null,
      latest_draft_id: input.latestDraftId ?? null,
    },
    base_version: {
      id: input.baseVersion.id,
      version_number: input.baseVersion.version_number,
      status: input.baseVersion.status,
    },
  }
}

const KNOWN_SPACING_TARGET_IDS = new Set([
  "page_wrapper_spacing",
  "first_section_spacing",
  "section_internal_spacing",
])

function createFriendlyConfirmedIntentFailure(input: {
  scope: ConfirmedSpacingScope
  sourceText: string
  understandingSummary: string | null
  reason: string
  warnings?: string[]
}): ConfirmedIntentMaterializationResult {
  return {
    status: "failed",
    scope: input.scope,
    sourceText: input.sourceText,
    understandingSummary: input.understandingSummary,
    reason: input.reason,
    assistantMessage:
      "Percebi o que queres mudar, mas esta tentativa segura não conseguiu preparar a prévia. Vou precisar ajustar melhor o alvo.",
    warnings: input.warnings ?? [],
  }
}

export function materializeConfirmedIntentProposal(
  input: ConfirmedIntentProposalInput,
): ConfirmedIntentMaterializationResult {
  const sourceTexts = buildConfirmedIntentSourceTexts({
    confirmationMessage: input.confirmationMessage,
    conversationContext: input.conversationContext,
  })

  const understandingSummary = sourceTexts.understandingSummary || null
  const sourceText = sourceTexts.understandingSummary || sourceTexts.aggregate
  if (!understandingSummary) {
    return {
      status: "not_applicable",
      scope: null,
      sourceText,
      understandingSummary,
      reason: "missing_understanding_summary",
    }
  }

  const scope =
    resolveConfirmedSpacingScope({
      sourceText: sourceTexts.understandingSummary,
      quickReplySelected: input.conversationContext.quick_reply_selected,
    }) ??
    resolveConfirmedSpacingScope({
      sourceText: sourceTexts.aggregate,
      quickReplySelected: input.conversationContext.quick_reply_selected,
    })

  if (!scope) {
    return {
      status: "not_applicable",
      scope: null,
      sourceText,
      understandingSummary,
      reason: "not_known_spacing_intent",
    }
  }

  try {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message: buildCanonicalSpacingMessage(scope),
      editPlan: buildSeedSpacingPlan(scope),
      baseVersion: input.baseVersion,
    })

    const patched = applyPatchPlan({
      slug: input.slug,
      title: input.title,
      path: input.path,
      message: buildCanonicalSpacingMessage(scope),
      editPlan: refined.editPlan,
      baseVersion: input.baseVersion,
    })

    const operationalState = resolvePersistibleProposalOperationalState({
      editPlan: refined.editPlan,
      baseLayoutJson: input.baseVersion.layout_json,
      baseStyleJson: input.baseVersion.style_json,
      proposalLayoutJson: patched.layoutJson,
      proposalStyleJson: patched.styleJson,
      targetResolutions: patched.resolutions,
      previewRenderable: true,
      desktopRenderable: true,
      mobileRenderable: true,
    })

    const onlyKnownSpacingTargets =
      refined.editPlan.target_ids.length > 0 &&
      refined.editPlan.target_ids.every((targetId) => KNOWN_SPACING_TARGET_IDS.has(targetId)) &&
      patched.resolutions.length > 0 &&
      patched.resolutions.every(
        (resolution) =>
          KNOWN_SPACING_TARGET_IDS.has(resolution.requested_target_id) &&
          resolution.requested_target_id === resolution.resolved_target_id,
      )

    const normalizedOperationalState =
      onlyKnownSpacingTargets && operationalState.change_detected
        ? {
            ...operationalState,
            final_status: "proposal_ready" as const,
            preview_available: true,
          }
        : operationalState

    if (!patched.resolutions.length) {
      return createFriendlyConfirmedIntentFailure({
        scope,
        sourceText,
        understandingSummary,
        reason: "no_target_resolutions",
        warnings: [...refined.warnings, ...patched.warnings],
      })
    }

    if (normalizedOperationalState.final_status === "needs_clarification") {
      return createFriendlyConfirmedIntentFailure({
        scope,
        sourceText,
        understandingSummary,
        reason: "needs_clarification_after_patch",
        warnings: [...refined.warnings, ...patched.warnings],
      })
    }

    const copy = buildUserFacingCopy(refined.editPlan.target_ids, input.title)
    const warnings = [...refined.warnings, ...patched.warnings]
    const proposal = {
      slug: input.slug,
      title: input.title,
      layout_json: patched.layoutJson,
      style_json: patched.styleJson,
      metadata: buildProposalMetadata({
        editPlan: refined.editPlan,
        baseVersion: input.baseVersion,
        baseVersionSource: input.baseVersionSource,
        degradedDraftBypassed: input.degradedDraftBypassed,
        baseVersionSelectionReason: input.baseVersionSelectionReason,
        publishedVersionId: input.publishedVersionId,
        latestDraftId: input.latestDraftId,
        sourceText,
        diagnosis: refined.diagnosis,
        patchedInvariants: patched.invariants,
        targetResolutions: patched.resolutions,
      }),
    }

    return {
      status: "success",
      providerUsed: input.providerUsed,
      modelUsed: input.modelUsed,
      summary: copy.summary,
      explanation: copy.explanation,
      assistantMessage: copy.assistantMessage,
      warnings,
      conversationPhase: "ready_for_proposal",
      understandingSummary,
      requiresUserConfirmation: false,
      canGenerateProposal: true,
      editPlan: refined.editPlan,
      proposal,
      operationalState: {
        ...normalizedOperationalState,
        final_status:
          normalizedOperationalState.final_status === "awaiting_intent_confirmation"
            ? ("proposal_ready" satisfies AiPageEditorFinalStatus)
            : normalizedOperationalState.final_status,
      },
      diagnosis: refined.diagnosis,
      sourceText,
      scope,
    }
  } catch (error) {
    return createFriendlyConfirmedIntentFailure({
      scope,
      sourceText,
      understandingSummary,
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}
