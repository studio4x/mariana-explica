import { describe, expect, it } from "vitest"
import {
  isPageStartSpacingRequest,
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
})
