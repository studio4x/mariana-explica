import { describe, expect, it } from "vitest"
import { fiscalDocumentStatusLabel, fiscalErrorLabel } from "./fiscal-status"

describe("fiscal status labels", () => {
  it("translates known fiscal document states", () => {
    expect(fiscalDocumentStatusLabel("issued")).toBe("Emitido")
    expect(fiscalDocumentStatusLabel("blocked_data")).toBe("Dados pendentes")
    expect(fiscalDocumentStatusLabel("failed_retryable")).toBe("Falha temporária")
  })

  it("translates fiscal error codes and humanizes unknown values", () => {
    expect(fiscalErrorLabel("FISCAL_CONFIGURATION_INCOMPLETE")).toBe("Configuração fiscal incompleta")
    expect(fiscalErrorLabel("UNKNOWN_FISCAL_ERROR")).toBe("Unknown Fiscal Error")
    expect(fiscalErrorLabel(null)).toBeNull()
  })
})
