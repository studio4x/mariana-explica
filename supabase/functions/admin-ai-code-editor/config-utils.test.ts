import { describe, expect, it } from "vitest"
import { ensureValidConfigPatch, mergeConfigValue } from "./config-utils.ts"
import type { AiCodeEditorConfigValue } from "./task-state.ts"

function createCurrentConfig(): AiCodeEditorConfigValue {
  return {
    enabled: true,
    make_default: true,
    legacy_editor_fallback_enabled: false,
    worker_mode: "github_worker",
    github_repository: "studio4x/mariana-explica",
    vercel_project_name: "mariana-explica",
    primary_provider: "openai",
    secondary_provider: "gemini",
    primary_model: "gpt-4.1-mini",
    secondary_model: "gemini-2.0-flash",
    auto_run_tests: true,
    auto_run_build: true,
    request_preview_deploy: true,
    require_explicit_publish_confirmation: true,
    generation_mode: "ai_enabled",
    provider_statuses: {
      openai: {
        configured: true,
        model: "gpt-4.1-mini",
        status: "ready",
        last_error: null,
        last_error_at: null,
      },
      gemini: {
        configured: false,
        model: "gemini-2.0-flash",
        status: "not_configured",
        last_error: null,
        last_error_at: null,
      },
    },
    github_configured: true,
    vercel_configured: true,
  }
}

describe("admin-ai-code-editor config utils", () => {
  it("merges partial patches without discarding current values", () => {
    const merged = mergeConfigValue(createCurrentConfig(), {
      enabled: false,
      make_default: false,
    })

    expect(merged.enabled).toBe(false)
    expect(merged.make_default).toBe(false)
    expect(merged.legacy_editor_fallback_enabled).toBe(false)
    expect(merged.github_repository).toBe("studio4x/mariana-explica")
    expect(merged.provider_statuses.openai.status).toBe("ready")
    expect(merged.vercel_configured).toBe(true)
  })

  it("rejects invalid config payload shapes", () => {
    expect(() => ensureValidConfigPatch(null)).toThrow("configValue invalido")
    expect(() => ensureValidConfigPatch(["bad"])).toThrow("configValue invalido")
  })

  it("accepts plain object config payloads", () => {
    expect(() => ensureValidConfigPatch({ enabled: true })).not.toThrow()
  })
})
