import { describe, expect, it } from "vitest"
import {
  buildUnderstandingConfirmationToken,
  isExplicitUnderstandingConfirmation,
  isExplicitUnderstandingRejection,
  matchesUnderstandingConfirmationToken,
  normalizeConversationContext,
  sanitizeConversationReplies,
  sanitizeConversationText,
} from "./conversation"

describe("conversation helpers", () => {
  it("normalizes short context payloads from the launcher", () => {
    const context = normalizeConversationContext({
      phase: "awaiting_intent_confirmation",
      understanding_summary: "tirar o espaco no topo da pagina Sobre",
      clarification_questions_count: 2,
      quick_reply_selected: "Nos dois",
      confirmation_token: "intent_123",
      pending_image_insert: {
        target_source: "capture",
        target_page: "/sobre",
        target_slug: "sobre",
        target_hint: "selected_area",
        capture_attachment_id: "capture-1",
        capture_attachment_name: "recorte-sobre.jpg",
        status: "waiting_for_image_asset",
      },
      pending_target_clarification: {
        requestedAt: "2026-06-18T18:00:00.000Z",
        intent: "set_text_color",
        textAnchor: "De estudante para estudante: porque este projeto?",
        requestedProperty: "color",
        requestedValue: "#ffffff",
        awaiting: "capture",
        resolvedTarget: {
          found: true,
          confidence: 0.97,
          resolutionSource: "block_id",
          selectedTarget: {
            targetId: "about-story",
            blockId: "about-story",
            managedNodeId: "block:about-story",
          },
          candidateCount: 1,
          evidence: {
            captureProvided: true,
            primaryCandidateProvided: true,
            textAnchorProvided: true,
            exactTextMatch: false,
            normalizedTextMatch: true,
            candidateIntersectsCapture: true,
            candidateMatchesManagedContent: true,
          },
          rejectionReasons: [],
          sourceBaseVersion: {
            id: "version-1",
            version_number: 12,
            status: "published",
            source: "published_version",
          },
        },
        capturedTarget: {
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
            x: 24,
            y: 96,
            width: 360,
            height: 180,
            pageX: 24,
            pageY: 96,
          },
          domCandidates: [
            {
              candidateId: "about-story-capture",
              tagName: "section",
              managedNodeId: "content:about-story",
              blockId: "about-story",
              classNames: ["me-managed-richtext"],
              rect: {
                x: 24,
                y: 96,
                width: 360,
                height: 180,
                top: 96,
                left: 24,
                right: 384,
                bottom: 276,
              },
              intersectsSelection: true,
              intersectionRatio: 1,
              isTextBearing: true,
              isHeading: false,
              isButton: false,
              isImage: false,
              isEditableManagedContent: true,
              confidence: 0.95,
              source: "rect_intersection",
            },
          ],
          textFragments: ["De estudante para estudante: porque este projeto?"],
          captureDiagnostics: {
            elementCount: 1,
            textCandidateCount: 1,
            primaryCandidateConfidence: 0.95,
            source: "live_dom_selection",
          },
        },
      },
      recent_messages: [
        { role: "assistant", text: "Percebi assim..." },
        { role: "user", text: "Sim, e isso" },
      ],
    })

    expect(context.phase).toBe("awaiting_intent_confirmation")
    expect(context.clarification_questions_count).toBe(2)
    expect(context.confirmation_token).toBe("intent_123")
    expect(context.pending_image_insert?.capture_attachment_id).toBe("capture-1")
    expect(context.pending_target_clarification?.requestedProperty).toBe("color")
    expect(context.pending_target_clarification?.resolvedTarget?.found).toBe(true)
    expect(context.pending_target_clarification?.resolvedTarget?.selectedTarget?.blockId).toBe("about-story")
    expect(context.pending_target_clarification?.capturedTarget?.primaryCandidate).toBeUndefined()
    expect(context.pending_target_clarification?.capturedTarget?.domCandidates[0]?.blockId).toBe("about-story")
    expect(context.recent_messages).toHaveLength(2)
  })

  it("detects explicit confirmation only in the confirmation phase", () => {
    expect(isExplicitUnderstandingConfirmation("Sim, e isso", "awaiting_intent_confirmation")).toBe(true)
    expect(isExplicitUnderstandingConfirmation("Sim, e aproveita para trocar o titulo", "awaiting_intent_confirmation")).toBe(false)
    expect(isExplicitUnderstandingConfirmation("Sim", "needs_clarification")).toBe(false)
  })

  it("detects a request to explain again", () => {
    expect(isExplicitUnderstandingRejection("Nao, quero explicar melhor", "awaiting_intent_confirmation")).toBe(true)
    expect(isExplicitUnderstandingRejection("quero explicar melhor", "needs_clarification")).toBe(false)
  })

  it("removes forbidden technical words from user-facing copy", () => {
    expect(sanitizeConversationText("Vou mexer no padding e no layout.")).toBe("Vou mexer no espaco e na estrutura.")
    expect(sanitizeConversationReplies(["Mudar o wrapper", "Trocar o padding"])).toEqual([
      "Mudar o bloco",
      "Trocar o espaco",
    ])
  })

  it("builds and validates a confirmation token for the pending understanding summary", () => {
    const token = buildUnderstandingConfirmationToken("tirar o espaco do topo da pagina Sobre")

    expect(token).toMatch(/^intent_/)
    expect(matchesUnderstandingConfirmationToken("tirar o espaco do topo da pagina Sobre", token)).toBe(true)
    expect(matchesUnderstandingConfirmationToken("tirar o espaco da primeira secao", token)).toBe(false)
  })
})
