import { describe, expect, it } from "vitest"
import { resolvePendingTargetClarificationFromCapture } from "./pre-resolved-target.ts"

function createBaseVersion() {
  return {
    id: "version-1",
    page_id: "page-1",
    version_number: 12,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "important-notes",
            type: "rich_text",
            content:
              '<section><h2>Notas importantes antes de enviares o teu formulário:</h2><p>Planeamento prévio.</p></section>',
          },
        ],
      },
    },
    style_json: {},
    metadata: {
      source: "allowed_path_bootstrap",
      pathname: "/explicacoes",
    },
  }
}

function createManagedCaptureAttachment() {
  return {
    id: "capture-1",
    role: "target_capture" as const,
    metadata: {
      target_capture: {
        id: "capture-1",
        role: "target_capture",
        pathname: "/explicacoes",
        capturedAt: "2026-06-19T16:00:00.000Z",
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
          width: 420,
          height: 220,
          pageX: 48,
          pageY: 120,
        },
        domCandidates: [
          {
            candidateId: "important-notes-card",
            tagName: "section",
            safeSelector: "[data-managed-node-id='content:important-notes']",
            managedNodeId: "content:important-notes",
            blockId: "important-notes",
            classNames: ["me-managed-richtext"],
            textContent: "Notas importantes antes de enviares o teu formulário: Planeamento prévio.",
            normalizedText: "notas importantes antes de enviares o teu formulario: planeamento previo.",
            rect: {
              x: 48,
              y: 120,
              width: 420,
              height: 220,
              top: 120,
              left: 48,
              right: 468,
              bottom: 340,
            },
            intersectsSelection: true,
            intersectionRatio: 1,
            isTextBearing: true,
            isHeading: false,
            isButton: false,
            isImage: false,
            isEditableManagedContent: true,
            confidence: 0.98,
            source: "rect_intersection",
          },
        ],
        primaryCandidate: {
          candidateId: "important-notes-card",
          tagName: "section",
          safeSelector: "[data-managed-node-id='content:important-notes']",
          managedNodeId: "content:important-notes",
          blockId: "important-notes",
          classNames: ["me-managed-richtext"],
          textContent: "Notas importantes antes de enviares o teu formulário: Planeamento prévio.",
          normalizedText: "notas importantes antes de enviares o teu formulario: planeamento previo.",
          rect: {
            x: 48,
            y: 120,
            width: 420,
            height: 220,
            top: 120,
            left: 48,
            right: 468,
            bottom: 340,
          },
          intersectsSelection: true,
          intersectionRatio: 1,
          isTextBearing: true,
          isHeading: false,
          isButton: false,
          isImage: false,
          isEditableManagedContent: true,
          confidence: 0.98,
          source: "rect_intersection",
        },
        textFragments: ["Notas importantes antes de enviares o teu formulário:"],
        captureDiagnostics: {
          elementCount: 1,
          textCandidateCount: 1,
          primaryCandidateConfidence: 0.98,
          source: "live_dom_selection",
        },
      },
    },
  }
}

function createExternalCaptureAttachment() {
  return {
    id: "capture-external",
    role: "target_capture" as const,
    metadata: {
      target_capture: {
        id: "capture-external",
        role: "target_capture",
        pathname: "/explicacoes",
        capturedAt: "2026-06-19T16:00:00.000Z",
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
          width: 420,
          height: 220,
          pageX: 48,
          pageY: 120,
        },
        domCandidates: [
          {
            candidateId: "unmanaged-card",
            tagName: "section",
            classNames: ["legacy-card"],
            textContent: "Notas importantes antes de enviares o teu formulÃ¡rio:",
            normalizedText: "notas importantes antes de enviares o teu formulario:",
            rect: {
              x: 48,
              y: 120,
              width: 420,
              height: 220,
              top: 120,
              left: 48,
              right: 468,
              bottom: 340,
            },
            intersectsSelection: true,
            intersectionRatio: 1,
            isTextBearing: true,
            isHeading: false,
            isButton: false,
            isImage: false,
            isEditableManagedContent: false,
            confidence: 0.8,
            source: "rect_intersection",
          },
        ],
        primaryCandidate: {
          candidateId: "overlay",
          tagName: "div",
          classNames: ["browser-extension-overlay"],
          textContent: "Notas importantes antes de enviares o teu formulÃ¡rio:",
          normalizedText: "notas importantes antes de enviares o teu formulario:",
          rect: {
            x: 48,
            y: 120,
            width: 420,
            height: 220,
            top: 120,
            left: 48,
            right: 468,
            bottom: 340,
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
        textFragments: ["Notas importantes antes de enviares o teu formulÃ¡rio:"],
        captureDiagnostics: {
          elementCount: 2,
          textCandidateCount: 1,
          primaryCandidateConfidence: 0.8,
          source: "live_dom_selection",
        },
      },
    },
  }
}

describe("resolvePendingTargetClarificationFromCapture", () => {
  it("creates a technical resolved target before asking for final confirmation", () => {
    const attachment = createManagedCaptureAttachment()
    const result = resolvePendingTargetClarificationFromCapture({
      pendingTargetClarification: {
        requestedAt: "2026-06-19T16:00:00.000Z",
        intent: "set_text_color",
        textAnchor: "Notas importantes antes de enviares o teu formulário:",
        requestedProperty: "color",
        requestedValue: "#fff",
        awaiting: "capture",
        capturedTarget: attachment.metadata.target_capture,
      },
      attachments: [attachment],
      latestTargetCapture: attachment.metadata.target_capture,
      baseVersion: createBaseVersion(),
    })

    expect(result.status).toBe("resolved")
    if (result.status !== "resolved") throw new Error("expected resolved")
    expect(result.assistantMessage).toMatch(/alvo tecnico valido/i)
    expect(result.resolvedTarget.found).toBe(true)
    expect(result.resolvedTarget.selectedTarget?.blockId).toBe("important-notes")
    expect(result.resolvedTarget.resolutionSource).toBe("managed_node_id")
  })

  it("returns a diagnostic failure and never claims the target was found when the capture is unmanaged", () => {
    const attachment = createExternalCaptureAttachment()
    const result = resolvePendingTargetClarificationFromCapture({
      pendingTargetClarification: {
        requestedAt: "2026-06-19T16:00:00.000Z",
        intent: "set_text_color",
        textAnchor: "Notas importantes antes de enviares o teu formulário:",
        requestedProperty: "color",
        requestedValue: "#fff",
        awaiting: "capture",
        capturedTarget: attachment.metadata.target_capture,
      },
      attachments: [attachment],
      latestTargetCapture: attachment.metadata.target_capture,
      baseVersion: createBaseVersion(),
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.assistantMessage).not.toMatch(/alvo tecnico valido|ja o localizei/i)
    expect(result.assistantMessage).toMatch(/nao esta associado a nenhum bloco gerido persistivel da rota \/explicacoes/i)
    expect(result.resolvedTarget.found).toBe(false)
    expect(result.resolvedTarget.rejectionReasons).toContain("unmanaged_dom_target")
  })
})
