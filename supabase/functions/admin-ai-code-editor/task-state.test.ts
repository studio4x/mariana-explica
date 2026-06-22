import { describe, expect, it } from "vitest"
import { buildInitialTaskState, transitionTaskRecord } from "./task-state.ts"

describe("buildInitialTaskState", () => {
  it("keeps preview, build and tests honest in simulated mode", () => {
    const state = buildInitialTaskState({
      config: {
        enabled: true,
        make_default: false,
        legacy_editor_fallback_enabled: true,
        worker_mode: "simulated",
        github_repository: "studio4x/mariana-explica",
        vercel_project_name: "mariana-explica",
        auto_run_tests: true,
        auto_run_build: true,
        request_preview_deploy: true,
        require_explicit_publish_confirmation: true,
      },
      plan: {
        normalizedPrompt: "altere o layout dos cards",
        title: "altere o layout dos cards",
        summary: "Preparar branch, diff e revisao",
        scopeClassification: "frontend_public_experience",
        riskLevel: "low",
        workerMode: "simulated",
        sensitiveChange: false,
        sensitiveReasons: [],
        branchName: "ai-editor/cards-20260622120000",
        commitMessage: "feat(ai-editor): cards",
        filesAnalyzed: ["src/components/product/ProductCard.tsx"],
        filesPlanned: ["src/components/product/ProductCard.tsx"],
        fileChanges: [],
        steps: [],
        resultSummary: "Plano gerado em modo simulado.",
        requiresExplicitPublishConfirmation: true,
      },
    })

    expect(state.previewStatus).toBe("not_requested")
    expect(state.testStatus).toBe("not_requested")
    expect(state.buildStatus).toBe("not_requested")
    expect(state.status).toBe("ready_for_review")
  })
})

describe("transitionTaskRecord", () => {
  const baseTask = {
    id: "task-1",
    status: "ready_for_review" as const,
    preview_status: "not_requested" as const,
    test_status: "not_requested" as const,
    build_status: "not_requested" as const,
    sensitive_change: true,
    requires_explicit_publish_confirmation: true,
    worker_mode: "simulated" as const,
    approved_at: null,
    published_at: null,
    rolled_back_at: null,
    metadata: {},
  }

  it("requires an explicit publish gate on approval for sensitive changes", () => {
    const next = transitionTaskRecord({
      task: baseTask,
      action: "approve",
      actedAt: "2026-06-22T12:00:00.000Z",
    })

    expect(next.status).toBe("approved")
    expect(next.approved_at).toBe("2026-06-22T12:00:00.000Z")
    expect(next.metadata.publish_gate).toBe("explicit_admin_confirmation_required")
  })

  it("allows hiding a reviewed task behind adjustment before publication", () => {
    const next = transitionTaskRecord({
      task: {
        ...baseTask,
        status: "approved",
        approved_at: "2026-06-22T12:00:00.000Z",
      },
      action: "request_adjustment",
      notes: "Ajustar o diff antes de publicar",
      actedAt: "2026-06-22T13:00:00.000Z",
    })

    expect(next.status).toBe("needs_adjustment")
    expect(next.metadata.latest_action_notes).toBe("Ajustar o diff antes de publicar")
  })
})
