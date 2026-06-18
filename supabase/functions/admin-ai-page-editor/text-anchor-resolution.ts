export interface TextAnchorCandidateInput {
  targetId: string
  tagName?: string
  selector?: string
  blockId?: string
  text: string
  contextBefore?: string
  contextAfter?: string
  source: "html" | "layout_json" | "baseline"
}

export interface TextAnchorSelectedCandidate extends TextAnchorCandidateInput {}

export interface TextAnchorResolution {
  found: boolean
  confidence: number
  exactMatch: boolean
  normalizedMatch: boolean
  partialMatch: boolean
  candidateCount: number
  anchorText: string
  normalizedAnchorText: string
  selectedCandidate?: TextAnchorSelectedCandidate
  rejectionReasons: string[]
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function stripBoundaryPunctuation(value: string) {
  return value.replace(/^[\s"'`“”‘’.,:;!?()[\]{}-]+|[\s"'`“”‘’.,:;!?()[\]{}-]+$/g, "").trim()
}

export function normalizeTextAnchorText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[â€œâ€“”]/g, '"')
    .replace(/[â€˜â€™‘’]/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function tokenizeAnchorText(value: string) {
  return normalizeTextAnchorText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function compareTokenOverlap(anchorTokens: string[], candidateTokens: string[]) {
  if (anchorTokens.length === 0 || candidateTokens.length === 0) return 0
  const candidateSet = new Set(candidateTokens)
  let matches = 0
  for (const token of anchorTokens) {
    if (candidateSet.has(token)) matches += 1
  }
  return matches / Math.max(anchorTokens.length, candidateTokens.length)
}

export function resolveTextAnchor(input: {
  anchorText: string
  candidates: TextAnchorCandidateInput[]
}): TextAnchorResolution {
  const anchorText = collapseWhitespace(String(input.anchorText ?? ""))
  const normalizedAnchorText = normalizeTextAnchorText(stripBoundaryPunctuation(anchorText))
  const anchorTokens = tokenizeAnchorText(anchorText)

  if (!anchorText || !normalizedAnchorText) {
    return {
      found: false,
      confidence: 0,
      exactMatch: false,
      normalizedMatch: false,
      partialMatch: false,
      candidateCount: 0,
      anchorText,
      normalizedAnchorText,
      rejectionReasons: ["text_anchor_missing"],
    }
  }

  const scoredCandidates = input.candidates
    .map((candidate) => {
      const comparableTexts = [
        { kind: "text" as const, value: collapseWhitespace(String(candidate.text ?? "")) },
        { kind: "context" as const, value: collapseWhitespace(String(candidate.contextBefore ?? "")) },
        { kind: "context" as const, value: collapseWhitespace(String(candidate.contextAfter ?? "")) },
      ].filter((entry) => entry.value)
      const scoredComparableTexts = comparableTexts.map((entry) => {
        const normalizedValue = normalizeTextAnchorText(stripBoundaryPunctuation(entry.value))
        const exactMatch = entry.value === anchorText
        const normalizedMatch = normalizedValue === normalizedAnchorText
        const containsAnchor =
          normalizedAnchorText.length >= 4 &&
          normalizedValue.length >= normalizedAnchorText.length &&
          normalizedValue.includes(normalizedAnchorText)
        const candidateTokens = tokenizeAnchorText(entry.value)
        const tokenOverlap = compareTokenOverlap(anchorTokens, candidateTokens)
        const allAnchorTokensPresent =
          anchorTokens.length > 0 && anchorTokens.every((token) => candidateTokens.includes(token))
        const partialMatch = !exactMatch && !normalizedMatch && (containsAnchor || (allAnchorTokensPresent && tokenOverlap >= 0.58))

        let score = 0
        if (exactMatch) {
          score = entry.kind === "text" ? 0.99 : 0.93
        } else if (normalizedMatch) {
          score = entry.kind === "text" ? 0.95 : 0.9
        } else if (containsAnchor) {
          const lengthRatio = normalizedAnchorText.length / Math.max(1, normalizedValue.length)
          score = lengthRatio >= 0.5 ? 0.88 : lengthRatio >= 0.25 ? 0.83 : 0.74
          if (entry.kind !== "text") score -= 0.04
        } else if (allAnchorTokensPresent && tokenOverlap >= 0.7) {
          score = entry.kind === "text" ? 0.78 : 0.72
        } else if (allAnchorTokensPresent && tokenOverlap >= 0.58) {
          score = entry.kind === "text" ? 0.68 : 0.62
        } else if (tokenOverlap >= 0.42) {
          score = entry.kind === "text" ? 0.54 : 0.48
        }

        return {
          kind: entry.kind,
          value: entry.value,
          normalizedValue,
          exactMatch,
          normalizedMatch,
          partialMatch,
          score,
        }
      })
      const bestComparable = scoredComparableTexts.sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        if (left.kind !== right.kind) return left.kind === "text" ? -1 : 1
        return left.value.length - right.value.length
      })[0]
      const normalizedCandidateText = bestComparable?.normalizedValue ?? ""
      const specificityPenalty = Math.max(0, normalizedCandidateText.length - normalizedAnchorText.length)

      return {
        candidate,
        exactMatch: bestComparable?.exactMatch ?? false,
        normalizedMatch: bestComparable?.normalizedMatch ?? false,
        partialMatch: bestComparable?.partialMatch ?? false,
        score: bestComparable?.score ?? 0,
        specificityPenalty,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (Number(right.exactMatch) !== Number(left.exactMatch)) return Number(right.exactMatch) - Number(left.exactMatch)
      if (Number(right.normalizedMatch) !== Number(left.normalizedMatch)) {
        return Number(right.normalizedMatch) - Number(left.normalizedMatch)
      }
      return left.specificityPenalty - right.specificityPenalty
    })

  const bestOverallScore = scoredCandidates[0]?.score ?? 0
  const topExactCandidates = scoredCandidates.filter(
    (candidate) => (candidate.exactMatch || candidate.normalizedMatch) && bestOverallScore - candidate.score < 0.05,
  )
  if (topExactCandidates.length > 1) {
    return {
      found: false,
      confidence: Math.round((topExactCandidates[0]?.score ?? 0) * 1000) / 1000,
      exactMatch: false,
      normalizedMatch: false,
      partialMatch: false,
      candidateCount: topExactCandidates.length,
      anchorText,
      normalizedAnchorText,
      rejectionReasons: ["text_anchor_multiple_exact_matches"],
    }
  }

  const best = scoredCandidates[0] ?? null
  const strongCandidates = scoredCandidates.filter((candidate) => candidate.score >= 0.82)
  if (strongCandidates.length > 1 && (strongCandidates[0]?.score ?? 0) - (strongCandidates[1]?.score ?? 0) < 0.05) {
    return {
      found: false,
      confidence: Math.round((strongCandidates[0]?.score ?? 0) * 1000) / 1000,
      exactMatch: false,
      normalizedMatch: false,
      partialMatch: true,
      candidateCount: strongCandidates.length,
      anchorText,
      normalizedAnchorText,
      rejectionReasons: ["text_anchor_multiple_similar_matches"],
    }
  }

  if (!best || best.score < 0.82) {
    return {
      found: false,
      confidence: Math.round((best?.score ?? 0) * 1000) / 1000,
      exactMatch: false,
      normalizedMatch: false,
      partialMatch: Boolean(best?.partialMatch),
      candidateCount: strongCandidates.length,
      anchorText,
      normalizedAnchorText,
      rejectionReasons: best?.partialMatch ? ["text_anchor_match_not_distinctive"] : ["text_anchor_not_found"],
    }
  }

  return {
    found: true,
    confidence: Math.round(best.score * 1000) / 1000,
    exactMatch: best.exactMatch,
    normalizedMatch: best.normalizedMatch,
    partialMatch: best.partialMatch,
    candidateCount: topExactCandidates.length > 0 ? topExactCandidates.length : 1,
    anchorText,
    normalizedAnchorText,
    selectedCandidate: { ...best.candidate },
    rejectionReasons: [],
  }
}
