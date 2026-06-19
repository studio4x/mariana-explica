import {
  normalizeConversationContext,
  type AiEditorDomCandidate,
  type AiEditorTargetCapture,
} from "./conversation.ts"

export interface CaptureResolutionAttachmentInput {
  id?: string
  role?: "target_capture" | "insert_image_asset" | "reference_image" | "unknown" | null
  metadata?: Record<string, unknown> | null
}

export interface CaptureResolutionCandidateInput {
  targetId: string
  selector?: string
  managedNodeId?: string | null
  blockId?: string | null
  tagName?: string
  text?: string
  normalizedText?: string
}

export interface CaptureTargetResolution {
  found: boolean
  confidence: number
  resolutionSource:
    | "managed_node_id"
    | "block_id"
    | "dom_primary_candidate"
    | "capture_text_exact"
    | "capture_text_normalized"
    | "baseline_text_exact"
    | "baseline_text_normalized"
    | "combined_evidence"
    | "not_found"
  selectedTarget?: {
    targetId: string
    selector?: string
    managedNodeId?: string
    blockId?: string
    tagName?: string
    text?: string
    normalizedText?: string
    source?: string
  }
  candidateCount: number
  evidence: {
    captureProvided: boolean
    primaryCandidateProvided: boolean
    textAnchorProvided: boolean
    exactTextMatch: boolean
    normalizedTextMatch: boolean
    candidateIntersectsCapture: boolean
    candidateMatchesManagedContent: boolean
  }
  rejectionReasons: string[]
  capture?: AiEditorTargetCapture | null
}

function selectedTargetMatchesCandidate(
  selectedTarget: NonNullable<CaptureTargetResolution["selectedTarget"]>,
  appCandidate: CaptureResolutionCandidateInput,
) {
  const selectedTargetId = normalizeString(selectedTarget.targetId)
  const selectedSelector = normalizeString(selectedTarget.selector)
  const selectedManagedNodeId = normalizeString(selectedTarget.managedNodeId)
  const selectedBlockId = normalizeString(selectedTarget.blockId)
  const candidateTargetId = normalizeString(appCandidate.targetId)
  const candidateSelector = normalizeString(appCandidate.selector)
  const candidateManagedNodeId = normalizeString(appCandidate.managedNodeId)
  const candidateBlockId = normalizeString(appCandidate.blockId)

  return (
    (selectedTargetId && selectedTargetId === candidateTargetId) ||
    (selectedSelector && candidateSelector && selectedSelector === candidateSelector) ||
    (selectedManagedNodeId &&
      (selectedManagedNodeId === candidateManagedNodeId ||
        selectedManagedNodeId === `block:${candidateTargetId}` ||
        selectedManagedNodeId === `content:${candidateTargetId}`)) ||
    (selectedBlockId && (selectedBlockId === candidateBlockId || selectedBlockId === candidateTargetId))
  )
}

function normalizePreResolvedTarget(
  value: CaptureTargetResolution | null | undefined,
  candidates: CaptureResolutionCandidateInput[],
  capture: AiEditorTargetCapture | null,
) {
  if (!value?.found || !value.selectedTarget) return null
  const matchingCandidate = candidates.find((candidate) => selectedTargetMatchesCandidate(value.selectedTarget!, candidate))
  if (!matchingCandidate) {
    return {
      found: false,
      confidence: Math.round(Number(value.confidence ?? 0) * 1000) / 1000,
      resolutionSource: "not_found",
      candidateCount: candidates.length,
      evidence: {
        captureProvided: Boolean(capture),
        primaryCandidateProvided: Boolean(capture?.primaryCandidate),
        textAnchorProvided: value.evidence.textAnchorProvided === true,
        exactTextMatch: value.evidence.exactTextMatch === true,
        normalizedTextMatch: value.evidence.normalizedTextMatch === true,
        candidateIntersectsCapture: value.evidence.candidateIntersectsCapture === true,
        candidateMatchesManagedContent: false,
      },
      rejectionReasons: ["pre_resolved_target_not_found_in_current_base"],
      capture,
    } satisfies CaptureTargetResolution
  }

  return {
    ...value,
    candidateCount: candidates.length,
    selectedTarget: {
      targetId: matchingCandidate.targetId,
      selector: normalizeString(matchingCandidate.selector) || undefined,
      managedNodeId: normalizeString(matchingCandidate.managedNodeId) || undefined,
      blockId: normalizeString(matchingCandidate.blockId) || undefined,
      tagName: normalizeString(matchingCandidate.tagName) || undefined,
      text: normalizeString(matchingCandidate.text) || undefined,
      normalizedText: normalizeString(matchingCandidate.normalizedText) || undefined,
      source: value.selectedTarget.source,
    },
    evidence: {
      captureProvided: Boolean(capture) || value.evidence.captureProvided === true,
      primaryCandidateProvided: Boolean(capture?.primaryCandidate) || value.evidence.primaryCandidateProvided === true,
      textAnchorProvided: value.evidence.textAnchorProvided === true,
      exactTextMatch: value.evidence.exactTextMatch === true,
      normalizedTextMatch: value.evidence.normalizedTextMatch === true,
      candidateIntersectsCapture: value.evidence.candidateIntersectsCapture === true,
      candidateMatchesManagedContent: true,
    },
    rejectionReasons: [],
    capture: capture ?? value.capture ?? null,
  } satisfies CaptureTargetResolution
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function normalizeComparableText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function getTargetCaptureFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object") return null
  const targetCapture = Object.prototype.hasOwnProperty.call(metadata, "target_capture")
    ? (metadata.target_capture ?? null)
    : null
  if (!targetCapture || typeof targetCapture !== "object" || Array.isArray(targetCapture)) {
    return null
  }

  return normalizeConversationContext({
    pending_target_clarification: {
      requestedAt: new Date(0).toISOString(),
      intent: "other",
      awaiting: "capture",
      capturedTarget: targetCapture,
    },
  }).pending_target_clarification?.capturedTarget ?? null
}

export function getLatestTargetCapture(
  attachments: CaptureResolutionAttachmentInput[],
  fallbackCapture?: AiEditorTargetCapture | null,
) {
  for (let index = attachments.length - 1; index >= 0; index -= 1) {
    const attachment = attachments[index]
    if (normalizeString(attachment.role).toLowerCase() !== "target_capture") continue
    const capture = getTargetCaptureFromMetadata(attachment.metadata)
    if (capture) return capture
  }
  return fallbackCapture ?? null
}

function candidateMatchesStableIds(
  appCandidate: CaptureResolutionCandidateInput,
  captureCandidate: AiEditorDomCandidate,
) {
  const targetId = normalizeString(appCandidate.targetId)
  const selector = normalizeString(appCandidate.selector)
  const managedNodeId = normalizeString(appCandidate.managedNodeId)
  const blockId = normalizeString(appCandidate.blockId)

  if (captureCandidate.managedNodeId) {
    const normalizedCaptureManagedNodeId = normalizeString(captureCandidate.managedNodeId)
    if (
      normalizedCaptureManagedNodeId &&
      (normalizedCaptureManagedNodeId === managedNodeId ||
        normalizedCaptureManagedNodeId === `block:${targetId}` ||
        normalizedCaptureManagedNodeId === `content:${targetId}`)
    ) {
      return "managed_node_id" as const
    }
  }

  if (captureCandidate.blockId) {
    const normalizedCaptureBlockId = normalizeString(captureCandidate.blockId)
    if (normalizedCaptureBlockId && (normalizedCaptureBlockId === blockId || normalizedCaptureBlockId === targetId)) {
      return "block_id" as const
    }
  }

  if (captureCandidate.safeSelector) {
    const normalizedCaptureSelector = normalizeString(captureCandidate.safeSelector)
    if (normalizedCaptureSelector && selector && normalizedCaptureSelector === selector) {
      return "dom_primary_candidate" as const
    }
  }

  return null
}

function buildTextSignals(input: {
  appCandidate: CaptureResolutionCandidateInput
  captureCandidate: AiEditorDomCandidate
  textAnchor: string | null
}) {
  const comparableAnchor = normalizeComparableText(input.textAnchor)
  const captureText = normalizeComparableText(input.captureCandidate.textContent ?? input.captureCandidate.normalizedText ?? "")
  const appText = normalizeComparableText(input.appCandidate.normalizedText ?? input.appCandidate.text ?? "")

  const exactTextMatch = Boolean(
    comparableAnchor &&
      (normalizeComparableText(input.captureCandidate.textContent) === comparableAnchor ||
        normalizeComparableText(input.appCandidate.text) === comparableAnchor),
  )
  const normalizedTextMatch = Boolean(comparableAnchor && (captureText.includes(comparableAnchor) || appText.includes(comparableAnchor)))
  return {
    exactTextMatch,
    normalizedTextMatch,
  }
}

export function resolveCaptureTarget(input: {
  attachments?: CaptureResolutionAttachmentInput[] | null
  candidates: CaptureResolutionCandidateInput[]
  textAnchor?: string | null
  fallbackCapture?: AiEditorTargetCapture | null
  preResolvedTarget?: CaptureTargetResolution | null
}) {
  const capture = getLatestTargetCapture(input.attachments ?? [], input.fallbackCapture)
  const baseEvidence = {
    captureProvided: Boolean(capture),
    primaryCandidateProvided: Boolean(capture?.primaryCandidate),
    textAnchorProvided: Boolean(normalizeString(input.textAnchor)),
    exactTextMatch: false,
    normalizedTextMatch: false,
    candidateIntersectsCapture: false,
    candidateMatchesManagedContent: false,
  }

  const preResolvedTarget = normalizePreResolvedTarget(input.preResolvedTarget, input.candidates, capture)
  if (preResolvedTarget?.found) {
    return preResolvedTarget
  }

  if (!capture) {
    return {
      found: false,
      confidence: 0,
      resolutionSource: "not_found",
      candidateCount: input.candidates.length,
      evidence: baseEvidence,
      rejectionReasons: preResolvedTarget?.rejectionReasons ?? ["capture_missing"],
      capture: null,
    } satisfies CaptureTargetResolution
  }

  const captureCandidates = [
    ...(capture.primaryCandidate ? [capture.primaryCandidate] : []),
    ...capture.domCandidates,
  ]
  const comparableTextAnchor = normalizeString(input.textAnchor)

  for (const captureCandidate of captureCandidates) {
    if (!captureCandidate.intersectsSelection) continue
    const intersectsCapture = captureCandidate.intersectsSelection && captureCandidate.intersectionRatio > 0

    if (!captureCandidate.isEditableManagedContent) {
      continue
    }

    for (const appCandidate of input.candidates) {
      const resolutionSource = candidateMatchesStableIds(appCandidate, captureCandidate)
      if (!resolutionSource) {
        continue
      }

      const textSignals = buildTextSignals({
        appCandidate,
        captureCandidate,
        textAnchor: comparableTextAnchor,
      })

      return {
        found: true,
        confidence:
          resolutionSource === "managed_node_id"
            ? 0.99
            : resolutionSource === "block_id"
              ? 0.97
              : 0.93,
        resolutionSource,
        selectedTarget: {
          targetId: appCandidate.targetId,
          selector: normalizeString(appCandidate.selector) || undefined,
          managedNodeId: normalizeString(appCandidate.managedNodeId) || undefined,
          blockId: normalizeString(appCandidate.blockId) || undefined,
          tagName: normalizeString(appCandidate.tagName) || undefined,
          text: normalizeString(appCandidate.text) || undefined,
          normalizedText: normalizeString(appCandidate.normalizedText) || undefined,
          source: captureCandidate.source,
        },
        candidateCount: input.candidates.length,
        evidence: {
          captureProvided: true,
          primaryCandidateProvided: Boolean(capture.primaryCandidate),
          textAnchorProvided: Boolean(comparableTextAnchor),
          exactTextMatch: textSignals.exactTextMatch,
          normalizedTextMatch: textSignals.normalizedTextMatch,
          candidateIntersectsCapture: intersectsCapture,
          candidateMatchesManagedContent: true,
        },
        rejectionReasons: [],
        capture,
      } satisfies CaptureTargetResolution
    }

    for (const appCandidate of input.candidates) {
      const textSignals = buildTextSignals({
        appCandidate,
        captureCandidate,
        textAnchor: comparableTextAnchor,
      })

      if (!textSignals.exactTextMatch && !textSignals.normalizedTextMatch) {
        continue
      }

      return {
        found: true,
        confidence:
          textSignals.exactTextMatch
            ? 0.9
            : textSignals.normalizedTextMatch
              ? 0.84
              : 0.8,
        resolutionSource: textSignals.exactTextMatch
          ? "capture_text_exact"
          : textSignals.normalizedTextMatch
            ? "capture_text_normalized"
            : "combined_evidence",
        selectedTarget: {
          targetId: appCandidate.targetId,
          selector: normalizeString(appCandidate.selector) || undefined,
          managedNodeId: normalizeString(appCandidate.managedNodeId) || undefined,
          blockId: normalizeString(appCandidate.blockId) || undefined,
          tagName: normalizeString(appCandidate.tagName) || undefined,
          text: normalizeString(appCandidate.text) || undefined,
          normalizedText: normalizeString(appCandidate.normalizedText) || undefined,
          source: captureCandidate.source,
        },
        candidateCount: input.candidates.length,
        evidence: {
          captureProvided: true,
          primaryCandidateProvided: Boolean(capture.primaryCandidate),
          textAnchorProvided: Boolean(comparableTextAnchor),
          exactTextMatch: textSignals.exactTextMatch,
          normalizedTextMatch: textSignals.normalizedTextMatch,
          candidateIntersectsCapture: intersectsCapture,
          candidateMatchesManagedContent: true,
        },
        rejectionReasons: [],
        capture,
      } satisfies CaptureTargetResolution
    }
  }

  const primaryCandidate = capture.primaryCandidate
  if (primaryCandidate && !primaryCandidate.isEditableManagedContent) {
    return {
      found: false,
      confidence: Math.max(0.42, Number(primaryCandidate.confidence ?? 0)),
      resolutionSource: "not_found",
      candidateCount: input.candidates.length,
      evidence: {
        ...baseEvidence,
        candidateIntersectsCapture: primaryCandidate.intersectsSelection,
      },
      rejectionReasons: [primaryCandidate.isImage ? "capture_target_external_image" : "capture_target_external_or_dynamic"],
      capture,
    } satisfies CaptureTargetResolution
  }

  return {
    found: false,
    confidence: 0,
    resolutionSource: "not_found",
    candidateCount: input.candidates.length,
    evidence: {
      ...baseEvidence,
      candidateIntersectsCapture: capture.domCandidates.some((candidate) => candidate.intersectsSelection),
      candidateMatchesManagedContent: capture.domCandidates.some((candidate) => candidate.isEditableManagedContent),
    },
    rejectionReasons: [
      capture.domCandidates.length === 0 ? "capture_without_dom_candidates" : "capture_target_not_found_in_managed_content",
    ],
    capture,
  } satisfies CaptureTargetResolution
}
