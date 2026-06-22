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
          auto_run_tests: true,
          auto_run_build: true,
          request_preview_deploy: true,
          require_explicit_publish_confirmation: true,
        },
      }),
    ).toEqual({
      showNewEditor: true,
      showLegacyAiEditor: false,
      newEditorIsDefault: true,
    })
  })
})
