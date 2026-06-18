import { describe, expect, it } from "vitest"
import { resolveTextAnchor } from "./text-anchor-resolution.ts"

describe("resolveTextAnchor", () => {
  it("finds a unique exact text anchor", () => {
    const result = resolveTextAnchor({
      anchorText: "Notas importantes antes de enviares o teu formulario:",
      candidates: [
        {
          targetId: "intro-copy",
          text: "Explicacao introdutoria",
          source: "layout_json",
        },
        {
          targetId: "important-notes",
          text: "Notas importantes antes de enviares o teu formulario:",
          source: "layout_json",
        },
      ],
    })

    expect(result.found).toBe(true)
    expect(result.exactMatch).toBe(true)
    expect(result.selectedCandidate?.targetId).toBe("important-notes")
  })

  it("matches normalized quoted text against heading context", () => {
    const result = resolveTextAnchor({
      anchorText: "De estudante para estudante: porque este projeto?",
      candidates: [
        {
          targetId: "about-story",
          text: "De estudante para estudante: porque este projeto? Texto preservado.",
          contextBefore: "De estudante para estudante: porque este projeto?",
          source: "layout_json",
        },
      ],
    })

    expect(result.found).toBe(true)
    expect(result.normalizedMatch).toBe(true)
    expect(result.selectedCandidate?.targetId).toBe("about-story")
  })

  it("returns not found when the quoted text is absent", () => {
    const result = resolveTextAnchor({
      anchorText: "Texto inexistente",
      candidates: [
        {
          targetId: "about-story",
          text: "Texto preservado.",
          source: "layout_json",
        },
      ],
    })

    expect(result.found).toBe(false)
    expect(result.rejectionReasons).toContain("text_anchor_not_found")
  })

  it("flags multiple exact matches as ambiguous", () => {
    const result = resolveTextAnchor({
      anchorText: "Notas importantes",
      candidates: [
        {
          targetId: "notes-a",
          text: "Notas importantes",
          source: "layout_json",
        },
        {
          targetId: "notes-b",
          text: "Notas importantes",
          source: "layout_json",
        },
      ],
    })

    expect(result.found).toBe(false)
    expect(result.candidateCount).toBe(2)
    expect(result.rejectionReasons).toContain("text_anchor_multiple_exact_matches")
  })
})
