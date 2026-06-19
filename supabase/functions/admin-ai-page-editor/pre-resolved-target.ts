import type {
  AiConversationPendingTargetClarification,
  AiConversationResolvedTarget,
  AiEditorTargetCapture,
} from "./conversation.ts"
import { resolveCaptureTarget, type CaptureResolutionAttachmentInput } from "./capture-target-resolution.ts"
import {
  buildCaptureResolutionCandidatesFromLayoutJson,
  type PatchEngineBaseVersion,
} from "./patch-engine.ts"

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function buildResolvedCaptureAssistantMessage(input: {
  textAnchor: string | null
  requestedValue: string | null
}) {
  const targetText = input.textAnchor ? ` ao texto "${input.textAnchor}"` : ""
  const requestedValue = input.requestedValue ? ` com o valor ${input.requestedValue}` : ""
  return `Entendi. A area capturada trouxe um alvo tecnico valido dentro da pagina gerida. Posso avancar${targetText}${requestedValue}?`
}

function buildCaptureFailureAssistantMessage(input: {
  latestTargetCapture: AiEditorTargetCapture
  resolvedTarget: AiConversationResolvedTarget
}) {
  if (input.resolvedTarget.rejectionReasons.includes("capture_target_external_image")) {
    return "Recebi a captura, mas ela aponta para uma imagem ou camada visual fora do conteudo gerido da pagina. Seleciona o bloco textual do site que deve mudar ou indica uma frase visivel proxima."
  }

  if (input.resolvedTarget.rejectionReasons.includes("capture_target_external_or_dynamic")) {
    return "Recebi a captura, mas o alvo selecionado parece externo, dinamico ou fora do conteudo gerido da pagina. O elemento pode estar num overlay, extensao ou HTML nao persistido."
  }

  if (input.resolvedTarget.rejectionReasons.includes("capture_without_dom_candidates")) {
    return "Recebi a captura, mas ela nao trouxe candidatos DOM suficientes para mapear um bloco gerido persistivel. Tenta uma area um pouco maior incluindo o titulo e o card completo."
  }

  if (input.resolvedTarget.rejectionReasons.includes("pre_resolved_target_not_found_in_current_base")) {
    return "Recebi a captura e tinha um alvo tecnico anterior, mas ele ja nao corresponde a nenhum bloco gerido da base atual. A baseline da pagina pode ter mudado ou estar desatualizada."
  }

  const primaryCandidate = input.latestTargetCapture.primaryCandidate
  const hasStableIds = Boolean(primaryCandidate?.managedNodeId || primaryCandidate?.blockId)
  if (!hasStableIds) {
    return "A captura trouxe candidatos DOM, mas nenhum deles tinha data-managed-node-id ou data-block-id compativel com a versao persistida. O card pode estar fora da pagina gerida ou em HTML dinamico."
  }

  return "Recebi a captura e tentei mapear o card, mas o alvo capturado nao correspondeu com seguranca a nenhum bloco gerido persistivel. O elemento pode estar fora da pagina gerida, em HTML dinamico, ou a baseline pode estar desatualizada."
}

export type PendingTargetClarificationResolutionResult =
  | {
      status: "not_applicable"
    }
  | {
      status: "resolved"
      assistantMessage: string
      resolvedTarget: AiConversationResolvedTarget
      sourceBaseVersion: PatchEngineBaseVersion
    }
  | {
      status: "failed"
      assistantMessage: string
      resolvedTarget: AiConversationResolvedTarget
      sourceBaseVersion: PatchEngineBaseVersion
    }

export function resolvePendingTargetClarificationFromCapture(input: {
  pendingTargetClarification: AiConversationPendingTargetClarification | null
  attachments: CaptureResolutionAttachmentInput[]
  latestTargetCapture: AiEditorTargetCapture | null
  baseVersion: PatchEngineBaseVersion
  requestSnapshotBaseVersion?: PatchEngineBaseVersion | null
}): PendingTargetClarificationResolutionResult {
  if (!input.pendingTargetClarification || !input.latestTargetCapture) {
    return { status: "not_applicable" }
  }

  const sourceBaseVersion = input.requestSnapshotBaseVersion ?? input.baseVersion
  const textAnchor =
    normalizeString(input.pendingTargetClarification.textAnchor) ||
    normalizeString(input.pendingTargetClarification.resolvedTarget?.selectedTarget?.text) ||
    null
  const resolvedTarget = resolveCaptureTarget({
    attachments: input.attachments,
    fallbackCapture: input.latestTargetCapture,
    textAnchor,
    candidates: buildCaptureResolutionCandidatesFromLayoutJson(sourceBaseVersion.layout_json),
    preResolvedTarget: input.pendingTargetClarification.resolvedTarget
      ? {
          found: input.pendingTargetClarification.resolvedTarget.found,
          confidence: input.pendingTargetClarification.resolvedTarget.confidence,
          resolutionSource: input.pendingTargetClarification.resolvedTarget.resolutionSource,
          selectedTarget: input.pendingTargetClarification.resolvedTarget.selectedTarget,
          candidateCount: input.pendingTargetClarification.resolvedTarget.candidateCount,
          evidence: input.pendingTargetClarification.resolvedTarget.evidence,
          rejectionReasons: input.pendingTargetClarification.resolvedTarget.rejectionReasons,
          capture: input.pendingTargetClarification.resolvedTarget.capture ?? input.latestTargetCapture,
        }
      : null,
  })

  const normalizedResolvedTarget: AiConversationResolvedTarget = {
    found: resolvedTarget.found,
    confidence: resolvedTarget.confidence,
    resolutionSource: resolvedTarget.resolutionSource,
    selectedTarget: resolvedTarget.selectedTarget,
    candidateCount: resolvedTarget.candidateCount,
    evidence: resolvedTarget.evidence,
    rejectionReasons: resolvedTarget.rejectionReasons,
    sourceBaseVersion: {
      id: sourceBaseVersion.id,
      version_number: sourceBaseVersion.version_number,
      status: sourceBaseVersion.status,
      source: normalizeString(sourceBaseVersion.metadata?.source) || null,
    },
    capture: resolvedTarget.capture ?? input.latestTargetCapture,
  }

  if (resolvedTarget.found) {
    return {
      status: "resolved",
      assistantMessage: buildResolvedCaptureAssistantMessage({
        textAnchor: textAnchor,
        requestedValue: normalizeString(input.pendingTargetClarification.requestedValue) || null,
      }),
      resolvedTarget: normalizedResolvedTarget,
      sourceBaseVersion,
    }
  }

  return {
    status: "failed",
    assistantMessage: buildCaptureFailureAssistantMessage({
      latestTargetCapture: input.latestTargetCapture,
      resolvedTarget: normalizedResolvedTarget,
    }),
    resolvedTarget: normalizedResolvedTarget,
    sourceBaseVersion,
  }
}
