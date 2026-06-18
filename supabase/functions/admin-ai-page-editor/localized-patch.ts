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
import { getLatestTargetCapture } from "./capture-target-resolution.ts"
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

interface LocalizedPendingTargetClarification {
  requestedAt: string
  intent: "set_text_color" | "set_style" | "replace_image" | "other"
  textAnchor?: string | null
  requestedProperty?: string | null
  requestedValue?: string | null
  awaiting: "capture" | "context_text" | "selection_confirmation"
  capturedTarget?: Record<string, unknown> | null
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

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function getTargetCaptureAttachment(attachments: PatchEngineAttachmentContext[] = []) {
  return attachments.find((attachment) => String(attachment.role ?? "").trim().toLowerCase() === "target_capture") ?? null
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
      pendingTargetClarification?: LocalizedPendingTargetClarification | null
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
  attachments?: PatchEngineAttachmentContext[]
}) {
  const targetCapture = getTargetCaptureAttachment(input.attachments)
  return {
    ai_contract_version: "hybrid_v1",
    ai_edit_plan: input.editPlan,
    ai_invariants: {
      plan_source: "localized_visual_patch",
      branch_selected: "localized_visual_patch",
      localized_visual_patch: true,
      localized_visual_patch_selected: true,
      localized_intent: input.intent,
      localized_intent_kind: input.intent.kind,
      localized_intent_action: input.intent.action,
      localized_intent_source_text: input.sourceText,
      footer_adjacent_spacing_diagnosis: input.diagnosis ?? null,
      scoped_patch: true,
      supports_persistible_flow: true,
      dynamic_slug: normalizeString(input.baseVersion.metadata?.dynamic_slug, input.baseVersion.metadata?.slug ?? ""),
      route_is_public: input.baseVersion.metadata?.route_is_public !== false,
      route_is_allowed: input.baseVersion.metadata?.route_is_allowed !== false,
      bootstrap_attempted: input.baseVersion.metadata?.bootstrap_attempted === true,
      bootstrap_created: input.baseVersion.metadata?.bootstrap_created === true,
      baseline_version_id: input.baseVersion.id,
      baseline_source: normalizeString(input.baseVersion.metadata?.source, input.baseVersionSource),
      baseline_complete: input.baseVersion.metadata?.baseline_complete !== false,
      target_capture_used: Boolean(targetCapture),
      target_capture_id: targetCapture?.id ?? null,
      requested_style_property: input.intent.kind === "color" ? "color" : null,
      requested_style_value: input.intent.kind === "color" ? (input.editPlan.operations[0]?.value ?? null) : null,
      provider_full_proposal_bypassed: true,
      provider_full_proposal_bypassed_for_localized_patch: true,
      draft_saved: false,
      preview_created: false,
      pending_publication_set: false,
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

  if (input.intent.kind === "color") {
    return {
      summary: `Alterar a cor do titulo/texto indicado na pagina ${input.title}.`,
      explanation: "Preparei um ajuste localizado apenas na cor do elemento textual mais provavel dentro da area selecionada, preservando a estrutura da pagina.",
      assistantMessage: "Preparei a alteracao da cor desse titulo/texto, mantendo o restante da pagina igual.",
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

function mapIntentToPendingIntent(intent: LocalizedIntent): LocalizedPendingTargetClarification["intent"] {
  if (intent.kind === "color" || intent.kind === "typography" || intent.kind === "alignment") {
    return "set_text_color"
  }
  if (intent.kind === "button_style" || intent.kind === "shadow" || intent.kind === "divider" || intent.kind === "border") {
    return "set_style"
  }
  return "other"
}

function toPendingRequestedValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return null
}

function buildPendingTargetClarification(input: {
  intent: LocalizedIntent
  attachments?: PatchEngineAttachmentContext[]
  understandingSummary: string | null
  patchedInvariants?: Record<string, unknown> | null
  requestedProperty?: string | null
  requestedValue?: string | null
}) {
  const patchedInvariants =
    input.patchedInvariants && typeof input.patchedInvariants === "object" ? input.patchedInvariants : {}
  const textAnchorRaw =
    typeof patchedInvariants.text_anchor_raw === "string"
      ? patchedInvariants.text_anchor_raw.trim()
      : (input.intent.targetText ?? "").trim()
  const textAnchorFound = patchedInvariants.text_anchor_found === true
  const rejectionReasons = Array.isArray(patchedInvariants.capture_target_rejection_reasons)
    ? patchedInvariants.capture_target_rejection_reasons.map((item) => String(item ?? ""))
    : []
  const capture = getLatestTargetCapture(input.attachments ?? [])
  const awaiting: LocalizedPendingTargetClarification["awaiting"] =
    rejectionReasons.some((reason) => /external|dynamic/.test(reason)) || (textAnchorRaw && !textAnchorFound)
      ? "context_text"
      : "capture"

  return {
    requestedAt: new Date().toISOString(),
    intent: mapIntentToPendingIntent(input.intent),
    textAnchor: textAnchorRaw || input.understandingSummary || null,
    requestedProperty: input.requestedProperty ?? null,
    requestedValue: input.requestedValue ?? null,
    awaiting,
    capturedTarget: capture ? (JSON.parse(JSON.stringify(capture)) as Record<string, unknown>) : null,
  } satisfies LocalizedPendingTargetClarification
}

function createFriendlyLocalizedFailure(input: {
  sourceText: string
  understandingSummary: string | null
  intent: LocalizedIntent
  reason: string
  warnings?: string[]
  diagnosis?: FooterAdjacentSpacingDiagnosis | null
  attachments?: PatchEngineAttachmentContext[]
  patchedInvariants?: Record<string, unknown> | null
  requestedProperty?: string | null
  requestedValue?: string | null
}): LocalizedVisualPatchMaterializationResult {
  const lowConfidence =
    input.intent.confidence === "low" ||
    input.reason === "low_confidence_intent" ||
    input.reason === "low_confidence_target"
  const hasTargetCapture = Boolean(getTargetCaptureAttachment(input.attachments))
  const patchedInvariants =
    input.patchedInvariants && typeof input.patchedInvariants === "object" ? input.patchedInvariants : {}
  const textAnchorRaw =
    typeof patchedInvariants.text_anchor_raw === "string"
      ? patchedInvariants.text_anchor_raw.trim()
      : (input.intent.targetText ?? "").trim()
  const textAnchorProvided = Boolean(textAnchorRaw)
  const textAnchorFound = patchedInvariants.text_anchor_found === true
  const textAnchorCandidateCount = Number(patchedInvariants.text_anchor_candidate_count ?? 0)
  const textAnchorRejectionReasons = Array.isArray(patchedInvariants.text_anchor_rejection_reasons)
    ? patchedInvariants.text_anchor_rejection_reasons.map((item) => String(item ?? ""))
    : []
  const textAnchorAmbiguous =
    textAnchorCandidateCount > 1 ||
    textAnchorRejectionReasons.some((reason) => /multiple/i.test(reason))

  const footerDiagnosis = input.intent.targetHint === "footer_adjacent_spacing"
  const bestCandidate = input.diagnosis?.candidates?.[0] ?? null
  const captureRejectionReasons = Array.isArray(patchedInvariants.capture_target_rejection_reasons)
    ? patchedInvariants.capture_target_rejection_reasons.map((item) => String(item ?? ""))
    : []
  const captureSelectedExternal = captureRejectionReasons.some((reason) => reason === "capture_target_external_or_dynamic")
  const captureSelectedExternalImage = captureRejectionReasons.some((reason) => reason === "capture_target_external_image")
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
      : captureSelectedExternalImage
        ? "A area selecionada parece apontar para uma imagem ou camada visual fora do conteudo gerido da pagina. Seleciona tambem o texto ou bloco do site que deve mudar, ou indica uma frase visivel para eu aplicar o ajuste localmente."
      : captureSelectedExternal
        ? "A area selecionada parece pertencer a um elemento visual externo ou dinamico que nao e a fonte real do conteudo gerido. Seleciona o bloco da pagina onde esse ajuste deve ser aplicado ou indica o texto visivel do elemento."
      : textAnchorProvided && !textAnchorFound && textAnchorAmbiguous
        ? "Encontrei mais de um texto semelhante. Seleciona a area correta ou indica uma frase antes ou depois dele para eu alterar apenas o elemento certo."
      : textAnchorProvided && !textAnchorFound
        ? "Procurei o texto indicado, mas nao o encontrei com seguranca nesta versao da pagina. Seleciona a area onde ele aparece ou copia exatamente o texto visivel, incluindo uma frase proxima."
      : input.intent.kind === "color" && input.intent.targetHint === "localized_heading" && hasTargetCapture
        ? "Entendi o ajuste, mas nao consegui identificar com seguranca qual titulo da area selecionada deve receber essa cor. Seleciona uma area um pouco maior incluindo o card completo ou indica o texto do titulo."
      : lowConfidence
        ? "Entendi o tipo de ajuste, mas nao consegui localizar com seguranca qual elemento devo alterar. Indica se fica acima ou abaixo do titulo, ou seleciona uma area um pouco maior."
        : "Entendi o ajuste, mas nao consegui localizar esse alvo com seguranca para preparar a previa sem risco.",
    warnings: input.warnings ?? [],
    diagnosis: input.diagnosis ?? null,
    pendingTargetClarification: buildPendingTargetClarification({
      intent: input.intent,
      attachments: input.attachments,
      understandingSummary: input.understandingSummary,
      patchedInvariants,
      requestedProperty: input.requestedProperty ?? null,
      requestedValue: input.requestedValue ?? null,
    }),
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
      attachments: input.attachments ?? [],
      requestedProperty: seedPlan?.operations[0]?.path ?? null,
      requestedValue: toPendingRequestedValue(seedPlan?.operations[0]?.value),
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
        attachments: input.attachments ?? [],
        patchedInvariants: patched.invariants,
        requestedProperty: editPlan.operations[0]?.path ?? null,
        requestedValue: toPendingRequestedValue(editPlan.operations[0]?.value),
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
        attachments: input.attachments ?? [],
        patchedInvariants: patched.invariants,
        requestedProperty: editPlan.operations[0]?.path ?? null,
        requestedValue: toPendingRequestedValue(editPlan.operations[0]?.value),
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
        attachments: input.attachments ?? [],
        patchedInvariants: patched.invariants,
        requestedProperty: editPlan.operations[0]?.path ?? null,
        requestedValue: toPendingRequestedValue(editPlan.operations[0]?.value),
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
        attachments: input.attachments,
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
      attachments: input.attachments ?? [],
      requestedProperty: seedPlan.operations[0]?.path ?? null,
      requestedValue: toPendingRequestedValue(seedPlan.operations[0]?.value),
    })
  }
}
