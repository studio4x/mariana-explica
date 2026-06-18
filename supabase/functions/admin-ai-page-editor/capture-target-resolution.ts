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

  if (!capture) {
    return {
      found: false,
      confidence: 0,
      resolutionSource: "not_found",
      candidateCount: input.candidates.length,
      evidence: baseEvidence,
      rejectionReasons: ["capture_missing"],
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
      const textSignals = buildTextSignals({
        appCandidate,
        captureCandidate,
        textAnchor: comparableTextAnchor,
      })

      if (!resolutionSource && !textSignals.exactTextMatch && !textSignals.normalizedTextMatch) {
        continue
      }

      return {
        found: true,
        confidence:
          resolutionSource === "managed_node_id"
            ? 0.99
            : resolutionSource === "block_id"
              ? 0.97
              : resolutionSource === "dom_primary_candidate"
                ? 0.93
                : textSignals.exactTextMatch
                  ? 0.9
                  : textSignals.normalizedTextMatch
                    ? 0.84
                    : 0.8,
        resolutionSource:
          resolutionSource ??
          (textSignals.exactTextMatch ? "capture_text_exact" : textSignals.normalizedTextMatch ? "capture_text_normalized" : "combined_evidence"),
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
