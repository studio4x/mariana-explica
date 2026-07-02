import { describe, expect, it } from "vitest"
import {
  getVisualEditorInteractiveStyle,
  getVisualEditorStyleSummary,
  getVisualEditorTextStyle,
  normalizeVisualEditorStyleDocument,
  setVisualEditorStyleValue,
} from "./styles"

describe("visual editor typography styles", () => {
  const fieldDefinitions = [
    { key: "hero.title", label: "Titulo principal", kind: "text" as const, styleGroup: "heading" as const },
    { key: "hero.primaryCta", label: "Botao principal", kind: "link" as const, styleGroup: "interactive" as const },
  ]

  it("normalizes and preserves text decoration for text fields", () => {
    const normalized = normalizeVisualEditorStyleDocument(
      {
        fields: {
          "hero.title": {
            fontFamily: '"Lora", Georgia, serif',
            fontSize: 52,
            fontWeight: "700",
            lineHeight: "1.15",
            letterSpacing: "0.04rem",
            textDecoration: "underline",
          },
        },
      },
      fieldDefinitions,
    )

    expect(normalized.fields["hero.title"]).toMatchObject({
      fontFamily: '"Lora", Georgia, serif',
      fontSize: "52px",
      fontWeight: "700",
      lineHeight: "1.15",
      letterSpacing: "0.04rem",
      textDecoration: "underline",
    })
  })

  it("normalizes and preserves text decoration for interactive fields", () => {
    const normalized = normalizeVisualEditorStyleDocument(
      {
        fields: {
          "hero.primaryCta": {
            textDecoration: "line-through",
          },
        },
      },
      fieldDefinitions,
    )

    expect(getVisualEditorInteractiveStyle(normalized.fields["hero.primaryCta"])).toMatchObject({
      textDecoration: "line-through",
    })
  })

  it("exposes text decoration in the style helpers and summaries", () => {
    const styled = setVisualEditorStyleValue(
      { fields: {} },
      "hero.title",
      fieldDefinitions[0],
      {
        textDecoration: "overline",
        fontWeight: "800",
      },
    )

    expect(getVisualEditorTextStyle(styled.fields["hero.title"], true).style).toMatchObject({
      textDecoration: "overline",
      fontWeight: "800",
    })
    expect(getVisualEditorStyleSummary(styled.fields["hero.title"])).toMatch(/decora/i)
  })
})
