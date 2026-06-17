import type { AiEditPlan } from "./contract.ts"
import type { AiConversationContext } from "./conversation.ts"
import type { AiPageEditorFinalStatus, PersistibleProposalOperationalState } from "./operational-state.ts"
import { resolvePersistibleProposalOperationalState } from "./operational-state.ts"
import {
  applyPatchPlan,
  diagnoseFooterAdjacentSpacing,
  refineSpacingEditPlanForKnownWrappers,
  type FooterAdjacentSpacingDiagnosis,
  type PatchEngineAttachmentContext,
  type PatchEngineBaseVersion,
} from "./patch-engine.ts"
import {
  buildLocalizedEditPlan,
  buildLocalizedIntentSourceTexts,
  classifyLocalizedIntent,
  type LocalizedIntent,
} from "./localized-intent.ts"

const LOCALIZED_CONFIDENCE_THRESHOLD = 0.8

export interface LocalizedVisualPatchProposalResult {
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
  sourceText: string
  intent: LocalizedIntent
}

interface LocalizedVisualPatchProposalInput {
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
  currentHtml?: string | null
  attachments?: PatchEngineAttachmentContext[]
}

export type LocalizedVisualPatchMaterializationResult =
  | {
      status: "not_applicable"
      sourceText: string
      understandingSummary: string | null
      intent: LocalizedIntent
      reason: "missing_understanding_summary" | "not_localized_visual_intent"
    }
  | {
      status: "failed"
      sourceText: string
      understandingSummary: string | null
      intent: LocalizedIntent
      reason: string
      assistantMessage: string
      warnings: string[]
      diagnosis?: FooterAdjacentSpacingDiagnosis | null
    }
  | ({
      status: "success"
    } & LocalizedVisualPatchProposalResult)

function buildProposalMetadata(input: {
  editPlan: AiEditPlan
  intent: LocalizedIntent
  diagnosis?: FooterAdjacentSpacingDiagnosis | null
  baseVersion: PatchEngineBaseVersion
  baseVersionSource: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  baseVersionSelectionReason: string
  publishedVersionId?: string | null
  latestDraftId?: string | null
  sourceText: string
  patchedInvariants: Record<string, unknown>
  targetResolutions: Array<Record<string, unknown>>
}) {
  return {
    ai_contract_version: "hybrid_v1",
    ai_edit_plan: input.editPlan,
    ai_invariants: {
      plan_source: "localized_visual_patch",
      localized_visual_patch: true,
      localized_intent: input.intent,
      localized_intent_source_text: input.sourceText,
      footer_adjacent_spacing_diagnosis: input.diagnosis ?? null,
      scoped_patch: true,
      supports_persistible_flow: true,
      ...input.patchedInvariants,
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

function buildLocalizedCopy(input: {
  intent: LocalizedIntent
  title: string
}) {
  if (input.intent.kind === "spacing" && input.intent.targetHint === "footer_adjacent_spacing") {
    return {
      summary: `Remover o espaco em branco antes do rodape na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado no fim da pagina, aproximando a ultima secao do rodape sem alterar o texto, links ou estrutura do rodape.",
      assistantMessage: "Preparei a remocao do espaco em branco entre a ultima secao e o rodape, mantendo o rodape igual.",
    }
  }

  if (input.intent.kind === "divider") {
    return {
      summary: `Remover a linha decorativa indicada na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado para ocultar apenas a linha/divisor perto do titulo indicado, preservando o restante da pagina.",
      assistantMessage: "Preparei a remocao da linha decorativa abaixo do titulo indicado, mantendo o titulo e o restante da pagina.",
    }
  }

  if (input.intent.kind === "button_style" && input.intent.reason === "button_border_remove") {
    return {
      summary: `Remover a borda do botao indicado na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado apenas na borda visual do botao, sem alterar texto, link ou acao.",
      assistantMessage: "Preparei a remocao da borda do botao, mantendo o texto e o link como estao.",
    }
  }

  if (input.intent.kind === "button_style") {
    return {
      summary: `Alterar a cor do botao indicado na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado apenas na cor visual do botao, sem alterar texto, link ou acao.",
      assistantMessage: "Preparei a alteracao da cor do botao, mantendo o texto e o link como estao.",
    }
  }

  if (input.intent.kind === "shadow") {
    return {
      summary: `Remover a sombra do elemento indicado na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado apenas na sombra visual do elemento indicado.",
      assistantMessage: "Preparei a remocao da sombra desse elemento, sem mexer na estrutura.",
    }
  }

  if (input.intent.kind === "alignment") {
    return {
      summary: `Ajustar o alinhamento indicado na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado apenas no alinhamento visual, preservando o texto.",
      assistantMessage: "Preparei o ajuste de alinhamento, sem mudar o texto.",
    }
  }

  return {
    summary: `Aplicar ajuste visual localizado na pagina ${input.title}.`,
    explanation: "Preparei um ajuste visual localizado e seguro, sem reescrever a pagina.",
    assistantMessage: "Preparei uma previa localizada para esse ajuste visual.",
  }
}

function createFriendlyLocalizedFailure(input: {
  sourceText: string
  understandingSummary: string | null
  intent: LocalizedIntent
  reason: string
  warnings?: string[]
  diagnosis?: FooterAdjacentSpacingDiagnosis | null
}): LocalizedVisualPatchMaterializationResult {
  const lowConfidence =
    input.intent.confidence === "low" ||
    input.reason === "low_confidence_intent" ||
    input.reason === "low_confidence_target"

  const footerDiagnosis = input.intent.targetHint === "footer_adjacent_spacing"
  const bestCandidate = input.diagnosis?.candidates?.[0] ?? null
  const footerMessage =
    "Entendi o ajuste, mas nao encontrei com seguranca qual propriedade cria o espaco entre a ultima secao e o rodape. Analisei a ultima secao, o wrapper da pagina e os blocos proximos ao rodape. " +
    (bestCandidate?.heading
      ? `O melhor candidato foi a secao "${bestCandidate.heading}", mas ainda preciso de uma confirmacao mais especifica ou de uma area maior para aplicar sem risco.`
      : "Seleciona uma area maior pegando o final da secao e o inicio do rodape, ou confirma que posso testar uma previa reduzindo o espacamento da ultima secao.")

  return {
    status: "failed",
    sourceText: input.sourceText,
    understandingSummary: input.understandingSummary,
    intent: input.intent,
    reason: input.reason,
    assistantMessage: footerDiagnosis
      ? footerMessage
      : lowConfidence
      ? "Entendi o tipo de ajuste, mas nao consegui localizar com seguranca qual elemento devo alterar. Indica se fica acima ou abaixo do titulo, ou seleciona uma area um pouco maior."
      : "Entendi o ajuste, mas nao consegui localizar esse alvo com seguranca para preparar a previa sem risco.",
    warnings: input.warnings ?? [],
    diagnosis: input.diagnosis ?? null,
  }
}

function ensureHighConfidenceResolutions(
  resolutions: Array<{ confidence?: number | null }>,
) {
  return (
    resolutions.length > 0 &&
    resolutions.every((resolution) => Number(resolution.confidence ?? 0) >= LOCALIZED_CONFIDENCE_THRESHOLD)
  )
}

export function materializeLocalizedVisualPatchProposal(
  input: LocalizedVisualPatchProposalInput,
): LocalizedVisualPatchMaterializationResult {
  const sourceTexts = buildLocalizedIntentSourceTexts({
    confirmationMessage: input.confirmationMessage,
    conversationContext: input.conversationContext,
  })

  const understandingSummary = sourceTexts.understandingSummary || null
  const sourceText = sourceTexts.understandingSummary || sourceTexts.aggregate
  const intent = classifyLocalizedIntent({
    sourceText: sourceTexts.aggregate || sourceText,
    attachments: input.attachments ?? [],
  })

  if (!understandingSummary) {
    return {
      status: "not_applicable",
      sourceText,
      understandingSummary,
      intent,
      reason: "missing_understanding_summary",
    }
  }

  if (!intent.isLocalized) {
    return {
      status: "not_applicable",
      sourceText,
      understandingSummary,
      intent,
      reason: "not_localized_visual_intent",
    }
  }

  const seedPlan = buildLocalizedEditPlan({
    intent,
    sourceText: sourceTexts.aggregate || sourceText,
  })

  if (!seedPlan || intent.confidence === "low") {
    const diagnosis =
      intent.targetHint === "footer_adjacent_spacing"
        ? diagnoseFooterAdjacentSpacing({
            slug: input.slug,
            path: input.path,
            message: sourceTexts.aggregate || sourceText,
            baseVersion: input.baseVersion,
            currentHtml: input.currentHtml,
            attachments: input.attachments ?? [],
          })
        : null
    return createFriendlyLocalizedFailure({
      sourceText,
      understandingSummary,
      intent,
      reason: "low_confidence_intent",
      diagnosis,
    })
  }

  try {
    const footerDiagnosis =
      intent.targetHint === "footer_adjacent_spacing"
        ? diagnoseFooterAdjacentSpacing({
            slug: input.slug,
            path: input.path,
            message: sourceTexts.aggregate || sourceText,
            baseVersion: input.baseVersion,
            currentHtml: input.currentHtml,
            attachments: input.attachments ?? [],
          })
        : null
    const diagnosticPlan =
      footerDiagnosis && footerDiagnosis.recommended_operations.length > 0
        ? {
            ...seedPlan,
            operations: footerDiagnosis.recommended_operations.map((operation) => ({ ...operation })),
          }
        : seedPlan
    const refined =
      diagnosticPlan.mode === "spacing_patch"
        ? refineSpacingEditPlanForKnownWrappers({
            message: sourceTexts.aggregate || sourceText,
            editPlan: diagnosticPlan,
            baseVersion: input.baseVersion,
          })
        : {
            editPlan: diagnosticPlan,
            warnings: [] as string[],
          }
    const editPlan = {
      ...refined.editPlan,
      requires_strict_confirmation: false,
    }

    const patched = applyPatchPlan({
      slug: input.slug,
      title: input.title,
      path: input.path,
      message: sourceTexts.aggregate || sourceText,
      editPlan,
      baseVersion: input.baseVersion,
      attachments: input.attachments ?? [],
    })

    if (!ensureHighConfidenceResolutions(patched.resolutions)) {
      return createFriendlyLocalizedFailure({
        sourceText,
        understandingSummary,
        intent,
        reason: "low_confidence_target",
        warnings: [...refined.warnings, ...patched.warnings],
        diagnosis: footerDiagnosis,
      })
    }

    const operationalState = resolvePersistibleProposalOperationalState({
      editPlan,
      baseLayoutJson: input.baseVersion.layout_json,
      baseStyleJson: input.baseVersion.style_json,
      proposalLayoutJson: patched.layoutJson,
      proposalStyleJson: patched.styleJson,
      targetResolutions: patched.resolutions,
      previewRenderable: true,
      desktopRenderable: true,
      mobileRenderable: true,
    })

    if (!operationalState.change_detected) {
      return createFriendlyLocalizedFailure({
        sourceText,
        understandingSummary,
        intent,
        reason: "no_visible_change",
        warnings: [...refined.warnings, ...patched.warnings],
        diagnosis: footerDiagnosis,
      })
    }

    if (operationalState.final_status === "needs_clarification") {
      return createFriendlyLocalizedFailure({
        sourceText,
        understandingSummary,
        intent,
        reason: "needs_clarification_after_patch",
        warnings: [...refined.warnings, ...patched.warnings],
        diagnosis: footerDiagnosis,
      })
    }

    const normalizedOperationalState = {
      ...operationalState,
      final_status:
        operationalState.final_status === "awaiting_intent_confirmation"
          ? ("proposal_ready" satisfies AiPageEditorFinalStatus)
          : operationalState.final_status,
      preview_available: true,
    }
    const copy = buildLocalizedCopy({ intent, title: input.title })
    const proposal = {
      slug: input.slug,
      title: input.title,
      layout_json: patched.layoutJson,
      style_json: patched.styleJson,
      metadata: buildProposalMetadata({
        editPlan,
        intent,
        diagnosis: footerDiagnosis,
        baseVersion: input.baseVersion,
        baseVersionSource: input.baseVersionSource,
        degradedDraftBypassed: input.degradedDraftBypassed,
        baseVersionSelectionReason: input.baseVersionSelectionReason,
        publishedVersionId: input.publishedVersionId,
        latestDraftId: input.latestDraftId,
        sourceText,
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
      warnings: [...refined.warnings, ...patched.warnings],
      conversationPhase: "ready_for_proposal",
      understandingSummary,
      requiresUserConfirmation: false,
      canGenerateProposal: true,
      editPlan,
      proposal,
      operationalState: normalizedOperationalState,
      sourceText,
      intent,
    }
  } catch (error) {
    const diagnosis =
      intent.targetHint === "footer_adjacent_spacing"
        ? diagnoseFooterAdjacentSpacing({
            slug: input.slug,
            path: input.path,
            message: sourceTexts.aggregate || sourceText,
            baseVersion: input.baseVersion,
            currentHtml: input.currentHtml,
            attachments: input.attachments ?? [],
          })
        : null
    return createFriendlyLocalizedFailure({
      sourceText,
      understandingSummary,
      intent,
      reason: error instanceof Error ? error.message : String(error),
      diagnosis,
    })
  }
}
