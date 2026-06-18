import { describe, expect, it } from "vitest"
import { getLatestTargetCapture, resolveCaptureTarget } from "./capture-target-resolution.ts"

function createTargetCaptureAttachment() {
  return {
    id: "capture-1",
    role: "target_capture" as const,
    metadata: {
      target_capture: {
        id: "capture-1",
        role: "target_capture",
        pathname: "/sobre",
        capturedAt: "2026-06-18T18:00:00.000Z",
        viewport: {
          width: 1280,
          height: 720,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 1,
        },
        selectionRect: {
          x: 48,
          y: 120,
          width: 360,
          height: 180,
          pageX: 48,
          pageY: 120,
        },
        domCandidates: [
          {
            candidateId: "about-story-capture",
            tagName: "section",
            safeSelector: "[data-managed-node-id='content:about-story']",
            managedNodeId: "content:about-story",
            blockId: "about-story",
            classNames: ["me-managed-richtext"],
            textContent: "De estudante para estudante: porque este projeto?",
            normalizedText: "de estudante para estudante: porque este projeto?",
            rect: {
              x: 48,
              y: 120,
              width: 360,
              height: 180,
              top: 120,
              left: 48,
              right: 408,
              bottom: 300,
            },
            intersectsSelection: true,
            intersectionRatio: 1,
            isTextBearing: true,
            isHeading: false,
            isButton: false,
            isImage: false,
            isEditableManagedContent: true,
            confidence: 0.97,
            source: "rect_intersection",
          },
        ],
        primaryCandidate: {
          candidateId: "about-story-capture",
          tagName: "section",
          safeSelector: "[data-managed-node-id='content:about-story']",
          managedNodeId: "content:about-story",
          blockId: "about-story",
          classNames: ["me-managed-richtext"],
          textContent: "De estudante para estudante: porque este projeto?",
          normalizedText: "de estudante para estudante: porque este projeto?",
          rect: {
            x: 48,
            y: 120,
            width: 360,
            height: 180,
            top: 120,
            left: 48,
            right: 408,
            bottom: 300,
          },
          intersectsSelection: true,
          intersectionRatio: 1,
          isTextBearing: true,
          isHeading: false,
          isButton: false,
          isImage: false,
          isEditableManagedContent: true,
          confidence: 0.97,
          source: "rect_intersection",
        },
        textFragments: ["De estudante para estudante: porque este projeto?"],
        captureDiagnostics: {
          elementCount: 1,
          textCandidateCount: 1,
          primaryCandidateConfidence: 0.97,
          source: "live_dom_selection",
        },
      },
    },
  }
}

describe("capture target resolution", () => {
  it("reads the latest structured target capture from attachment metadata", () => {
    const capture = getLatestTargetCapture([createTargetCaptureAttachment()])

    expect(capture?.id).toBe("capture-1")
    expect(capture?.primaryCandidate?.blockId).toBe("about-story")
  })

  it("matches a managed candidate by stable ids from the capture metadata", () => {
    const resolution = resolveCaptureTarget({
      attachments: [createTargetCaptureAttachment()],
      textAnchor: "De estudante para estudante: porque este projeto?",
      candidates: [
        {
          targetId: "localized_heading",
          selector: "[data-managed-node-id='content:about-story']",
          managedNodeId: "block:about-story",
          blockId: "about-story",
          tagName: "rich_text",
          text: "De estudante para estudante: porque este projeto?",
          normalizedText: "de estudante para estudante: porque este projeto?",
        },
      ],
    })

    expect(resolution.found).toBe(true)
    expect(resolution.resolutionSource).toBe("block_id")
    expect(resolution.selectedTarget?.blockId).toBe("about-story")
    expect(resolution.evidence.candidateMatchesManagedContent).toBe(true)
  })

  it("returns an explicit rejection when the capture points to unmanaged content", () => {
    const resolution = resolveCaptureTarget({
      attachments: [
        {
          id: "capture-external",
          role: "target_capture",
          metadata: {
            target_capture: {
              id: "capture-external",
              role: "target_capture",
              pathname: "/sobre",
              capturedAt: "2026-06-18T18:00:00.000Z",
              viewport: {
                width: 1280,
                height: 720,
                scrollX: 0,
                scrollY: 0,
                devicePixelRatio: 1,
              },
              selectionRect: {
                x: 24,
                y: 24,
                width: 160,
                height: 120,
                pageX: 24,
                pageY: 24,
              },
              domCandidates: [
                {
                  candidateId: "floating-widget",
                  tagName: "div",
                  classNames: ["floating-widget"],
                  rect: {
                    x: 24,
                    y: 24,
                    width: 160,
                    height: 120,
                    top: 24,
                    left: 24,
                    right: 184,
                    bottom: 144,
                  },
                  intersectsSelection: true,
                  intersectionRatio: 1,
                  isTextBearing: false,
                  isHeading: false,
                  isButton: false,
                  isImage: false,
                  isEditableManagedContent: false,
                  confidence: 0.8,
                  source: "elementsFromPoint",
                },
              ],
              primaryCandidate: {
                candidateId: "floating-widget",
                tagName: "div",
                classNames: ["floating-widget"],
                rect: {
                  x: 24,
                  y: 24,
                  width: 160,
                  height: 120,
                  top: 24,
                  left: 24,
                  right: 184,
                  bottom: 144,
                },
                intersectsSelection: true,
                intersectionRatio: 1,
                isTextBearing: false,
                isHeading: false,
                isButton: false,
                isImage: false,
                isEditableManagedContent: false,
                confidence: 0.8,
                source: "elementsFromPoint",
              },
              textFragments: [],
              captureDiagnostics: {
                elementCount: 1,
                textCandidateCount: 0,
                primaryCandidateConfidence: 0.8,
                source: "live_dom_selection",
              },
            },
          },
        },
      ],
      candidates: [
        {
          targetId: "localized_heading",
          selector: "[data-managed-node-id='content:about-story']",
          managedNodeId: "block:about-story",
          blockId: "about-story",
          tagName: "rich_text",
          text: "De estudante para estudante: porque este projeto?",
        },
      ],
    })

    expect(resolution.found).toBe(false)
    expect(resolution.rejectionReasons).toContain("capture_target_external_or_dynamic")
  })
})
