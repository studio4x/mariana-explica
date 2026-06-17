import { describe, expect, it } from "vitest"
import {
  isExplicitFooterTextEditRequest,
  isExplicitHeaderTextEditRequest,
  isFooterAdjacentSpacingRequest,
  isHeaderAdjacentSpacingRequest,
  isPageStartSpacingRequest,
  isVisualSpacingIntent,
  protectsSectionInternalSpacing,
  wantsOnlyFirstSectionSpacing,
  wantsOnlyPageWrapperSpacing,
  wantsOnlySectionInternalSpacing,
} from "./spacing-intent.ts"

describe("spacing intent helpers", () => {
  it("prioritizes the page wrapper when the request says before the first section", () => {
    const message = "remover o espaco em branco no topo da pagina, antes da primeira secao"

    expect(isPageStartSpacingRequest(message)).toBe(true)
    expect(wantsOnlyPageWrapperSpacing(message)).toBe(true)
    expect(wantsOnlyFirstSectionSpacing(message)).toBe(false)
    expect(wantsOnlySectionInternalSpacing(message)).toBe(false)
  })

  it("treats header-to-first-section spacing as wrapper spacing instead of header text", () => {
    const message = "remover a faixa branca entre o menu e a primeira secao"

    expect(isVisualSpacingIntent(message)).toBe(true)
    expect(isHeaderAdjacentSpacingRequest(message)).toBe(true)
    expect(wantsOnlyPageWrapperSpacing(message)).toBe(true)
    expect(isExplicitHeaderTextEditRequest(message)).toBe(false)
  })

  it("treats inside the first section as internal spacing", () => {
    const message = "remover o espaco dentro da primeira secao"

    expect(isPageStartSpacingRequest(message)).toBe(true)
    expect(wantsOnlySectionInternalSpacing(message)).toBe(true)
    expect(wantsOnlyPageWrapperSpacing(message)).toBe(false)
    expect(wantsOnlyFirstSectionSpacing(message)).toBe(false)
  })

  it("protects the section internal spacing when the request says to keep it", () => {
    const message = "remover o espaco antes da primeira secao e manter o padding interno da secao"

    expect(protectsSectionInternalSpacing(message)).toBe(true)
    expect(wantsOnlyPageWrapperSpacing(message)).toBe(true)
    expect(wantsOnlySectionInternalSpacing(message)).toBe(false)
  })

  it("keeps explicit header copy changes in the textual path", () => {
    const message = "quero mudar o texto do cabecalho"

    expect(isExplicitHeaderTextEditRequest(message)).toBe(true)
    expect(isHeaderAdjacentSpacingRequest(message)).toBe(false)
    expect(wantsOnlyPageWrapperSpacing(message)).toBe(false)
  })

  it("separates footer-adjacent visual spacing from footer text edits", () => {
    const visualMessage = "remova o espaco entre a ultima secao e o rodape"
    const textMessage = "quero mudar o texto do rodape"

    expect(isFooterAdjacentSpacingRequest(visualMessage)).toBe(true)
    expect(isExplicitFooterTextEditRequest(visualMessage)).toBe(false)
    expect(isExplicitFooterTextEditRequest(textMessage)).toBe(true)
    expect(isFooterAdjacentSpacingRequest(textMessage)).toBe(false)
  })
})
