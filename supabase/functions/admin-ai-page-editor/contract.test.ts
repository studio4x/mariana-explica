import { describe, expect, it } from "vitest"
import { normalizeAiEditPlan } from "./contract.ts"

describe("normalizeAiEditPlan", () => {
  it("classifies spacing requests at section scope with strict confirmation", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: null,
      message: "remover padding-top da primeira seção e reduzir o gap entre cards do hero",
      slug: "home",
      path: "/",
      legacyContractFallback: true,
    })

    expect(result.planSource).toBe("legacy_compat")
    expect(result.editPlan.scope).toBe("section")
    expect(result.editPlan.mode).toBe("spacing_patch")
    expect(result.editPlan.risk_level).toBe("medium")
    expect(result.editPlan.requires_strict_confirmation).toBe(true)
    expect(result.editPlan.operations[0]?.type).toBe("set_style")
  })

  it("normalizes explicit raw plans and keeps section_layout_patch as the canonical mode", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: {
        scope: "section",
        mode: "layout_patch",
        target_ids: ["hero-primary"],
        risk_level: "high",
        requires_strict_confirmation: true,
        operations: [
          {
            type: "change_columns",
            target_id: "hero-primary",
            value: { columns: 2 },
            breakpoint: "desktop",
          },
        ],
      },
      message: "mudar layout interno da seção hero para duas colunas",
      slug: "home",
      path: "/",
    })

    expect(result.planSource).toBe("model")
    expect(result.editPlan.scope).toBe("section")
    expect(result.editPlan.mode).toBe("section_layout_patch")
    expect(result.editPlan.target_ids).toEqual(["hero-primary"])
    expect(result.editPlan.operations).toEqual([
      {
        type: "change_columns",
        target_id: "hero-primary",
        value: { columns: 2 },
        breakpoint: "desktop",
      },
    ])
  })

  it("builds update_text operations for legacy text-only prompts", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: undefined,
      message: 'alterar o texto "Olá mundo" para "Olá Mariana"',
      slug: "sobre",
      path: "/sobre",
      legacyContractFallback: true,
    })

    expect(result.editPlan.scope).toBe("text")
    expect(result.editPlan.mode).toBe("text_patch")
    expect(result.editPlan.operations[0]?.type).toBe("update_text")
    expect(result.editPlan.operations[0]?.path).toBe("content")
    expect(result.editPlan.operations[0]?.value).toEqual({
      from: "Olá mundo",
      to: "Olá Mariana",
    })
  })

  it("defaults header requests to high risk and global target ids", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: null,
      message: "atualizar o header com uma chamada mais curta",
      slug: "home",
      path: "/",
      legacyContractFallback: true,
    })

    expect(result.editPlan.scope).toBe("header")
    expect(result.editPlan.mode).toBe("text_patch")
    expect(result.editPlan.risk_level).toBe("high")
    expect(result.editPlan.target_ids).toEqual(["global-header"])
    expect(result.editPlan.requires_strict_confirmation).toBe(true)
  })

  it("routes spacing between the header and the first section to page wrapper spacing", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: null,
      message: "remover a faixa branca entre o menu e a primeira secao",
      slug: "sobre",
      path: "/sobre",
      legacyContractFallback: true,
    })

    expect(result.editPlan.scope).toBe("page")
    expect(result.editPlan.mode).toBe("spacing_patch")
    expect(result.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(result.editPlan.operations[0]?.target_id).toBe("page_wrapper_spacing")
  })

  it("keeps explicit header copy edits on the textual header path", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: null,
      message: "quero mudar o texto do cabecalho",
      slug: "home",
      path: "/",
      legacyContractFallback: true,
    })

    expect(result.editPlan.scope).toBe("header")
    expect(result.editPlan.mode).toBe("text_patch")
    expect(result.editPlan.target_ids).toEqual(["global-header"])
    expect(result.editPlan.operations[0]?.type).toBe("update_text")
  })

  it("routes localized visual line removal as style patch instead of text patch", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: null,
      message:
        'remova essa linha que esta inserido abaixo do titulo "De estudante para estudante: porque este projeto?"',
      slug: "sobre",
      path: "/sobre",
      legacyContractFallback: true,
    })

    expect(result.editPlan.scope).not.toBe("header")
    expect(result.editPlan.mode).toBe("style_patch")
    expect(result.editPlan.operations[0]?.type).toBe("remove_style")
  })

  it("fills missing operation target ids and breakpoint defaults", () => {
    const result = normalizeAiEditPlan({
      rawEditPlan: {
        scope: "block",
        mode: "style_patch",
        target_ids: ["card-1"],
        risk_level: "low",
        requires_strict_confirmation: false,
        operations: [
          {
            type: "set_style",
            path: "layout.backgroundColor",
            value: "#ffffff",
          },
        ],
      },
      message: "mudar a cor do card principal para branco",
      slug: "home",
      path: "/",
    })

    expect(result.editPlan.operations).toEqual([
      {
        type: "set_style",
        target_id: "card-1",
        path: "layout.backgroundColor",
        value: "#ffffff",
        breakpoint: "all",
      },
    ])
  })
})
