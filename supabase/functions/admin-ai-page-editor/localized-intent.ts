import type { AiEditPlan } from "./contract.ts"
import type { AiConversationContext } from "./conversation.ts"
import {
  isExplicitHeaderTextEditRequest,
  isExplicitFooterTextEditRequest,
  isFooterAdjacentSpacingRequest,
  isHeaderAdjacentSpacingRequest,
  isVisualSpacingIntent,
  wantsOnlyFirstSectionSpacing,
  wantsOnlyPageWrapperSpacing,
  wantsOnlySectionInternalSpacing,
} from "./spacing-intent.ts"

export type LocalizedIntentKind =
  | "spacing"
  | "divider"
  | "border"
  | "typography"
  | "color"
  | "background"
  | "button_style"
  | "shadow"
  | "alignment"
  | "sizing"
  | "decorative_element"
  | "unknown"

export type LocalizedIntentAction = "remove" | "set" | "increase" | "decrease" | "hide" | "replace"
export type LocalizedIntentConfidence = "low" | "medium" | "high"

export interface LocalizedIntent {
  isLocalized: boolean
  kind: LocalizedIntentKind
  action: LocalizedIntentAction
  targetText?: string
  targetHint?: string
  sectionHint?: string
  visualReference?: "attachment" | "selected_area" | "message" | "current_page"
  negativeConstraints: string[]
  confidence: LocalizedIntentConfidence
  reason: string
}

export interface LocalizedIntentSourceTexts {
  understandingSummary: string
  aggregate: string
}

function hasTargetCaptureAttachment(
  attachments?: Array<{ role?: string | null }> | null,
) {
  return (attachments ?? []).some((attachment) => normalizeLocalizedIntentText(attachment.role) === "target_capture")
}

function resolveVisualReference(hasAttachment: boolean, hasTargetCapture: boolean) {
  if (hasTargetCapture) return "selected_area" as const
  if (hasAttachment) return "attachment" as const
  return "message" as const
}

export function normalizeLocalizedIntentText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function buildLocalizedIntentSourceTexts(input: {
  confirmationMessage: string
  conversationContext: AiConversationContext
}) {
  const understandingSummary = String(input.conversationContext.understanding_summary ?? "").trim()
  const recentUserMessages = input.conversationContext.recent_messages
    .filter((entry) => entry.role === "user")
    .map((entry) => String(entry.text ?? "").trim())
    .filter(Boolean)
    .filter((text) => normalizeLocalizedIntentText(text) !== normalizeLocalizedIntentText(input.confirmationMessage))

  return {
    understandingSummary,
    aggregate: uniqueStrings([understandingSummary, ...recentUserMessages]).join(" | "),
  } satisfies LocalizedIntentSourceTexts
}

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

function extractQuotedTargetText(sourceText: string) {
  const normalized = String(sourceText ?? "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  const doubleQuoted = normalized.match(/"([^"]{3,240})"/)
  if (doubleQuoted?.[1]) return doubleQuoted[1].trim()
  const singleQuoted = normalized.match(/'([^']{3,240})'/)
  if (singleQuoted?.[1]) return singleQuoted[1].trim()
  return undefined
}

function resolveAction(normalized: string): LocalizedIntentAction {
  if (/\b(remov|tir|apaga|elimina|ocult|escond)\w*/.test(normalized)) return "remove"
  if (/\b(aument|maior|amplia)\w*/.test(normalized)) return "increase"
  if (/\b(diminu|reduz|menor|encurt)\w*/.test(normalized)) return "decrease"
  if (/\b(troca|muda|altera|coloca|deixa|define)\w*/.test(normalized)) return "set"
  return "set"
}

function confidenceFromSignals(score: number): LocalizedIntentConfidence {
  if (score >= 3) return "high"
  if (score >= 2) return "medium"
  return "low"
}

function resolveSpacingTarget(sourceText: string) {
  if (isFooterAdjacentSpacingRequest(sourceText)) return "footer_adjacent_spacing"
  if (wantsOnlyPageWrapperSpacing(sourceText) || isHeaderAdjacentSpacingRequest(sourceText)) return "page_wrapper_spacing"
  if (wantsOnlySectionInternalSpacing(sourceText)) return "section_internal_spacing"
  if (wantsOnlyFirstSectionSpacing(sourceText)) return "first_section_spacing"
  return "page_wrapper_spacing"
}

export function classifyLocalizedIntent(input: {
  sourceText: string
  attachments?: Array<{ name?: string | null; mime_type?: string | null; role?: string | null }> | null
}): LocalizedIntent {
  const sourceText = String(input.sourceText ?? "").trim()
  const normalized = normalizeLocalizedIntentText(sourceText)
  const targetText = extractQuotedTargetText(sourceText)
  const hasAttachment = (input.attachments ?? []).length > 0
  const hasTargetCapture = hasTargetCaptureAttachment(input.attachments)
  const attachmentTerms = (input.attachments ?? []).map((attachment) => String(attachment.name ?? "")).join(" ")
  const sourceWithAttachmentHints = [sourceText, attachmentTerms].filter(Boolean).join(" ")
  const action = resolveAction(normalized)

  if (!normalized) {
    return {
      isLocalized: false,
      kind: "unknown",
      action,
      negativeConstraints: [],
      confidence: "low",
      reason: "empty_source_text",
    }
  }

  if (isExplicitHeaderTextEditRequest(sourceText)) {
    return {
      isLocalized: false,
      kind: "unknown",
      action,
      targetHint: "global_header_text",
      negativeConstraints: [],
      confidence: "low",
      reason: "explicit_header_text_edit",
    }
  }

  if (isExplicitFooterTextEditRequest(sourceText)) {
    return {
      isLocalized: false,
      kind: "unknown",
      action,
      targetHint: "global_footer_text",
      negativeConstraints: [],
      confidence: "low",
      reason: "explicit_footer_text_edit",
    }
  }

  if (/^(tir|remove|remova|apaga|apague)\w*\s+(isso|isto|aquilo)(\s+daqui)?[.!? ]*$/.test(normalized)) {
    return {
      isLocalized: true,
      kind: "unknown",
      action: "remove",
      targetHint: "ambiguous_visual_reference",
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["do_not_patch_without_clear_target"],
      confidence: "low",
      reason: "ambiguous_deictic_request",
    }
  }

  if (isVisualSpacingIntent(sourceText) || isFooterAdjacentSpacingRequest(sourceWithAttachmentHints)) {
    return {
      isLocalized: true,
      kind: "spacing",
      action,
      targetHint: resolveSpacingTarget(sourceWithAttachmentHints),
      sectionHint: wantsOnlyFirstSectionSpacing(sourceText) || wantsOnlySectionInternalSpacing(sourceText)
        ? "first_section"
        : undefined,
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["preserve_sections", "preserve_links", "preserve_section_internal_spacing_when_requested"],
      confidence: "high",
      reason: "visual_spacing_signal",
    }
  }

  const mentionsDivider = includesAny(normalized, [
    /\blinha\b/,
    /\bdivisor(?:ia)?\b/,
    /\bseparador\b/,
    /\bseparator\b/,
    /\bdivider\b/,
    /\bhr\b/,
    /\bregua\b/,
  ])
  const mentionsBorder = /\b(borda|border|border-bottom|border-top)\b/.test(normalized)
  const mentionsBelowAbove = /\b(abaixo|debaixo|por baixo|acima|em cima|sobre)\b/.test(normalized)
  const mentionsHeading = /\b(titulo|heading|headline|h1|h2|h3)\b/.test(normalized)
  const mentionsButton = /\b(botao|botao principal|cta|button)\b/.test(normalized)

  if ((mentionsDivider || mentionsBorder) && !mentionsButton && action === "remove" && (targetText || mentionsBelowAbove || mentionsHeading || hasAttachment)) {
    const confidenceScore = (targetText ? 2 : 0) + (mentionsBelowAbove ? 1 : 0) + (mentionsHeading ? 1 : 0) + (hasAttachment ? 1 : 0)
    return {
      isLocalized: true,
      kind: mentionsDivider ? "divider" : "border",
      action: "remove",
      targetText,
      targetHint: mentionsHeading ? "localized_divider_below_heading" : "localized_divider",
      sectionHint: mentionsBelowAbove ? "near_referenced_text" : undefined,
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["preserve_heading_text", "preserve_sections", "preserve_links"],
      confidence: confidenceFromSignals(confidenceScore),
      reason: "localized_divider_or_border_signal",
    }
  }

  if ((mentionsDivider || mentionsBorder) && !mentionsButton && action === "remove") {
    return {
      isLocalized: true,
      kind: mentionsDivider ? "divider" : "border",
      action: "remove",
      targetHint: "localized_divider",
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["do_not_mass_apply", "preserve_sections"],
      confidence: hasAttachment ? "medium" : "low",
      reason: "localized_divider_low_confidence",
    }
  }

  if (mentionsButton) {
    if (mentionsBorder && action === "remove") {
      return {
        isLocalized: true,
        kind: "button_style",
        action: "remove",
        targetHint: "localized_button_primary",
        sectionHint: /\b(inicial|primeira|hero)\b/.test(normalized) ? "first_section" : undefined,
        visualReference: "message",
        negativeConstraints: ["preserve_button_text", "preserve_button_link", "preserve_sections"],
        confidence: "high",
        reason: "button_border_remove",
      }
    }

    if (/\b(cor|azul|blue|fundo|background)\b/.test(normalized)) {
      return {
        isLocalized: true,
        kind: "button_style",
        action: "set",
        targetHint: "localized_button_primary",
        sectionHint: /\b(inicial|primeira|hero)\b/.test(normalized) ? "first_section" : undefined,
        visualReference: "message",
        negativeConstraints: ["preserve_button_text", "preserve_button_link", "preserve_sections"],
        confidence: "high",
        reason: "button_color_set",
      }
    }
  }

  if (/\b(sombra|shadow|box-shadow)\b/.test(normalized) && action === "remove") {
    return {
      isLocalized: true,
      kind: "shadow",
      action: "remove",
      targetHint: /\b(card|cartao)\b/.test(normalized) ? "localized_card" : "localized_visual_element",
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["preserve_structure", "preserve_links", "preserve_sections"],
      confidence: hasAttachment || /\b(card|cartao)\b/.test(normalized) ? "high" : "medium",
      reason: "shadow_remove",
    }
  }

  const mentionsTitleLike = /\b(titulo|subtitulo|heading|headline|h1|h2|h3|h4|h5|h6|card-title|section-title|card-heading|section-heading|label)\b/.test(normalized)
  const mentionsTextLike = mentionsTitleLike || /\b(texto|frase|copy)\b/.test(normalized)
  const mentionsColorChange = /\b(cor|contraste|branco|white|preto|black|azul|blue|verde|green|cinza|gray|claro|clarear|mais claro|escuro)\b/.test(normalized)

  if (mentionsColorChange && (mentionsTextLike || targetText || hasAttachment)) {
    const targetHint = mentionsTitleLike || /\b(card|cartao|secao|seccao)\b/.test(normalized)
      ? "localized_heading"
      : "localized_text"
    const confidenceScore = (mentionsTitleLike ? 2 : 0) + (targetText ? 1 : 0) + (hasTargetCapture ? 1 : hasAttachment ? 1 : 0)

    return {
      isLocalized: true,
      kind: "color",
      action: "set",
      targetText,
      targetHint,
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["preserve_text", "preserve_sections", "preserve_links", "do_not_mass_apply"],
      confidence: confidenceFromSignals(confidenceScore),
      reason: "text_color_set",
    }
  }

  if (/\b(centraliz|alinhar|alinhamento|esquerda|direita|center|left|right)\w*/.test(normalized)) {
    const isTitle = /\b(titulo|heading|headline|h1|h2|h3)\b/.test(normalized)
    return {
      isLocalized: true,
      kind: "alignment",
      action: "set",
      targetText,
      targetHint: isTitle ? "localized_heading" : "localized_visual_element",
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["preserve_text", "preserve_sections"],
      confidence: isTitle || targetText || hasAttachment ? "high" : "medium",
      reason: "alignment_set",
    }
  }

  if (/\b(tamanho|fonte|font|peso|negrito|line-height|entrelinha|cor do texto)\b/.test(normalized)) {
    return {
      isLocalized: true,
      kind: "typography",
      action,
      targetText,
      targetHint: /\b(titulo|subtitulo|heading|headline|card-title|section-title)\b/.test(normalized)
        ? "localized_heading"
        : "localized_text",
      visualReference: resolveVisualReference(hasAttachment, hasTargetCapture),
      negativeConstraints: ["preserve_text", "preserve_sections", "preserve_links"],
      confidence: targetText || hasAttachment ? "high" : "medium",
      reason: "typography_visual_set",
    }
  }

  return {
    isLocalized: false,
    kind: "unknown",
    action,
    negativeConstraints: [],
    confidence: "low",
    reason: "not_a_simple_localized_visual_intent",
  }
}

function resolveButtonColorValue(sourceText: string) {
  const normalized = normalizeLocalizedIntentText(sourceText)
  if (/\bazul|blue\b/.test(normalized)) return "#2563eb"
  if (/\bverde|green\b/.test(normalized)) return "#16a34a"
  if (/\bpreto|black\b/.test(normalized)) return "#111827"
  if (/\bbranco|white\b/.test(normalized)) return "#ffffff"
  const hex = String(sourceText ?? "").match(/#[0-9a-fA-F]{3,8}\b/)
  return hex?.[0] ?? "#2563eb"
}

function resolveAlignmentValue(sourceText: string) {
  const normalized = normalizeLocalizedIntentText(sourceText)
  if (/\bdireita|right\b/.test(normalized)) return "right"
  if (/\besquerda|left\b/.test(normalized)) return "left"
  return "center"
}

function resolveColorValue(sourceText: string) {
  const normalized = normalizeLocalizedIntentText(sourceText)
  const hex = String(sourceText ?? "").match(/#[0-9a-fA-F]{3,8}\b/)
  if (hex?.[0]) return hex[0]
  if (/\bbranco|white\b/.test(normalized)) return "#ffffff"
  if (/\bpreto|black\b/.test(normalized)) return "#111827"
  if (/\bazul|blue\b/.test(normalized)) return "#2563eb"
  if (/\bverde|green\b/.test(normalized)) return "#16a34a"
  if (/\bcinza|gray|grey\b/.test(normalized)) return "#e5e7eb"
  if (/\b(claro|clarear|mais claro|contraste)\b/.test(normalized)) return "#ffffff"
  return "#ffffff"
}

export function buildLocalizedEditPlan(input: {
  intent: LocalizedIntent
  sourceText: string
}): AiEditPlan | null {
  const { intent, sourceText } = input
  if (!intent.isLocalized || intent.confidence === "low") return null

  if (intent.kind === "spacing") {
    const targetId = intent.targetHint ?? "page_wrapper_spacing"
    return {
      scope: targetId === "page_wrapper_spacing" ? "page" : "section",
      mode: "spacing_patch",
      target_ids: [targetId],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "set_style",
          target_id: targetId,
          path: targetId === "footer_adjacent_spacing" ? "padding-bottom" : "padding-top",
          value: 0,
          breakpoint: "all",
        },
        ...(targetId === "footer_adjacent_spacing"
          ? [
              {
                type: "set_style" as const,
                target_id: targetId,
                path: "margin-bottom",
                value: 0,
                breakpoint: "all" as const,
              },
            ]
          : []),
      ],
    }
  }

  if (intent.kind === "divider" || intent.kind === "decorative_element") {
    return {
      scope: "section",
      mode: "style_patch",
      target_ids: ["localized_divider_below_heading"],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "remove_style",
          target_id: "localized_divider_below_heading",
          path: "localized-divider",
          value: {
            target_text: intent.targetText ?? null,
            relation: /\bacima|em cima|sobre\b/.test(normalizeLocalizedIntentText(sourceText)) ? "above" : "below",
          },
          breakpoint: "all",
        },
      ],
    }
  }

  if (intent.kind === "button_style" && intent.reason === "button_border_remove") {
    return {
      scope: "block",
      mode: "style_patch",
      target_ids: ["localized_button_primary"],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "remove_style",
          target_id: "localized_button_primary",
          path: "border",
          value: "0px solid transparent",
          breakpoint: "all",
        },
      ],
    }
  }

  if (intent.kind === "button_style") {
    return {
      scope: "block",
      mode: "style_patch",
      target_ids: ["localized_button_primary"],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "set_style",
          target_id: "localized_button_primary",
          path: "background",
          value: resolveButtonColorValue(sourceText),
          breakpoint: "all",
        },
      ],
    }
  }

  if (intent.kind === "shadow") {
    return {
      scope: "block",
      mode: "style_patch",
      target_ids: [intent.targetHint ?? "localized_visual_element"],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "remove_style",
          target_id: intent.targetHint ?? "localized_visual_element",
          path: "box-shadow",
          value: "none",
          breakpoint: "all",
        },
      ],
    }
  }

  if (intent.kind === "color") {
    return {
      scope: "text",
      mode: "style_patch",
      target_ids: [intent.targetHint ?? "localized_text"],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "set_style",
          target_id: intent.targetHint ?? "localized_text",
          path: "color",
          value: resolveColorValue(sourceText),
          breakpoint: "all",
        },
      ],
    }
  }

  if (intent.kind === "alignment") {
    return {
      scope: "text",
      mode: "style_patch",
      target_ids: [intent.targetHint ?? "localized_text"],
      risk_level: "low",
      requires_strict_confirmation: true,
      operations: [
        {
          type: "set_style",
          target_id: intent.targetHint ?? "localized_text",
          path: "text-align",
          value: resolveAlignmentValue(sourceText),
          breakpoint: "all",
        },
      ],
    }
  }

  return null
}
