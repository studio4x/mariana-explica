import { describe, expect, it } from "vitest"
import { buildLocalizedEditPlan, classifyLocalizedIntent } from "./localized-intent.ts"

describe("localized visual intent classification", () => {
  it("classifies external spacing between the header and first section as page wrapper spacing", () => {
    const intent = classifyLocalizedIntent({
      sourceText: "remova o espaco em branco que tem no inicio da pagina, entre o cabecalho e a primeira secao",
    })
    const plan = buildLocalizedEditPlan({ intent, sourceText: "entre o cabecalho e a primeira secao" })

    expect(intent.isLocalized).toBe(true)
    expect(intent.kind).toBe("spacing")
    expect(intent.targetHint).toBe("page_wrapper_spacing")
    expect(plan?.target_ids).toEqual(["page_wrapper_spacing"])
  })

  it("classifies a divider below a quoted heading as a localized divider removal", () => {
    const intent = classifyLocalizedIntent({
      sourceText:
        'remova essa linha que esta inserido abaixo do titulo "De estudante para estudante: porque este projeto?"',
    })
    const plan = buildLocalizedEditPlan({ intent, sourceText: intent.targetText ?? "" })

    expect(intent.isLocalized).toBe(true)
    expect(intent.kind).toBe("divider")
    expect(intent.confidence).toBe("high")
    expect(intent.targetText).toBe("De estudante para estudante: porque este projeto?")
    expect(plan?.mode).toBe("style_patch")
    expect(plan?.operations[0]?.target_id).toBe("localized_divider_below_heading")
  })

  it("keeps explicit header text edits out of visual patch routing", () => {
    const intent = classifyLocalizedIntent({
      sourceText: "quero mudar o texto do cabecalho",
    })

    expect(intent.isLocalized).toBe(false)
    expect(intent.reason).toBe("explicit_header_text_edit")
  })

  it("classifies footer-adjacent spacing as localized visual spacing, not footer text", () => {
    const intent = classifyLocalizedIntent({
      sourceText: "remova o espaco entre a ultima secao e o rodape",
    })
    const clarificationIntent = classifyLocalizedIntent({
      sourceText: "remova esse espaco em branco | Esta entre a ultima secao da pagina e o rodape",
    })
    const footerTextIntent = classifyLocalizedIntent({
      sourceText: "quero mudar o texto do rodape",
    })

    expect(intent.isLocalized).toBe(true)
    expect(intent.kind).toBe("spacing")
    expect(intent.targetHint).toBe("footer_adjacent_spacing")
    expect(buildLocalizedEditPlan({ intent, sourceText: "rodape" })?.target_ids).toEqual(["footer_adjacent_spacing"])
    expect(clarificationIntent.targetHint).toBe("footer_adjacent_spacing")
    expect(footerTextIntent.isLocalized).toBe(false)
    expect(footerTextIntent.reason).toBe("explicit_footer_text_edit")
  })

  it("uses footer capture names as a strong visual hint for vague spacing requests", () => {
    const intent = classifyLocalizedIntent({
      sourceText: "remova esse espaco em branco",
      attachments: [{ name: "captura-rodape-espaco.png", mime_type: "image/png" }],
    })

    expect(intent.targetHint).toBe("footer_adjacent_spacing")
    expect(intent.visualReference).toBe("attachment")
  })

  it("classifies button border and color changes as localized button style", () => {
    const borderIntent = classifyLocalizedIntent({
      sourceText: "remova a borda do botao principal da secao inicial",
    })
    const colorIntent = classifyLocalizedIntent({
      sourceText: "troque a cor do botao principal para azul",
    })

    expect(borderIntent.kind).toBe("button_style")
    expect(borderIntent.reason).toBe("button_border_remove")
    expect(colorIntent.kind).toBe("button_style")
    expect(buildLocalizedEditPlan({ intent: colorIntent, sourceText: "azul" })?.operations[0]?.value).toBe("#2563eb")
  })

  it("asks for more context on ambiguous visual references and low confidence line removal", () => {
    const ambiguous = classifyLocalizedIntent({ sourceText: "tira isso daqui" })
    const lowConfidenceLine = classifyLocalizedIntent({ sourceText: "remove a linha" })

    expect(ambiguous.isLocalized).toBe(true)
    expect(ambiguous.confidence).toBe("low")
    expect(buildLocalizedEditPlan({ intent: ambiguous, sourceText: "tira isso daqui" })).toBeNull()
    expect(lowConfidenceLine.kind).toBe("divider")
    expect(lowConfidenceLine.confidence).toBe("low")
  })
})
