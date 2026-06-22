import { describe, expect, it } from "vitest"
import { resolveAdminAiCodeEditorTransition } from "./admin-ai-code-editor"

describe("resolveAdminAiCodeEditorTransition", () => {
  it("keeps the legacy editor available by default when config is missing", () => {
    expect(resolveAdminAiCodeEditorTransition()).toEqual({
      showNewEditor: false,
      showLegacyAiEditor: true,
      newEditorIsDefault: false,
    })
  })

  it("allows hiding the legacy AI editor behind the new feature flag", () => {
    expect(
      resolveAdminAiCodeEditorTransition({
        config_value: {
          enabled: true,
          make_default: true,
          legacy_editor_fallback_enabled: false,
          worker_mode: "simulated",
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
              configured: true,
              model: "gemini-2.0-flash",
              status: "ready",
              last_error: null,
              last_error_at: null,
            },
          },
          github_configured: true,
          vercel_configured: true,
        },
      }),
    ).toEqual({
      showNewEditor: true,
      showLegacyAiEditor: false,
      newEditorIsDefault: true,
    })
  })
})
