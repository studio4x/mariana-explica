import { describe, expect, it } from "vitest"
import { buildAiCodeEditorPlan } from "./planner.ts"

describe("buildAiCodeEditorPlan", () => {
  it("maps catalog card requests to likely public frontend files", () => {
    const plan = buildAiCodeEditorPlan({
      prompt: "altere o layout dos cards da página de materiais",
      timestampToken: "20260622113000",
    })

    expect(plan.scopeClassification).toBe("frontend_public_experience")
    expect(plan.riskLevel).toBe("low")
    expect(plan.branchName).toContain("ai-editor")
    expect(plan.filesPlanned).toContain("src/pages/public/ProductsCatalogExperience.tsx")
    expect(plan.filesPlanned).toContain("src/components/product/ProductCard.tsx")
    expect(plan.fileChanges[0]?.diff_preview).toContain("@@ planned change @@")
  })

  it("marks support flow changes as sensitive and escalates risk", () => {
    const plan = buildAiCodeEditorPlan({
      prompt: "altere a lógica do formulário de suporte",
      timestampToken: "20260622113000",
    })

    expect(plan.scopeClassification).toBe("frontend_and_backend_form")
    expect(plan.riskLevel).toBe("medium")
    expect(plan.filesPlanned).toContain("supabase/functions/create-support-ticket/index.ts")
  })

  it("keeps simple support copy changes scoped to the public page file", () => {
    const plan = buildAiCodeEditorPlan({
      prompt: "altere o texto do titulo da pagina de suporte",
      timestampToken: "20260622113000",
    })

    expect(plan.filesPlanned).toEqual(["src/pages/public/Support.tsx"])
  })

  it("requires explicit publish confirmation for sensitive auth changes", () => {
    const plan = buildAiCodeEditorPlan({
      prompt: "mude a autenticação da área do aluno e revise a sessão",
      timestampToken: "20260622113000",
    })

    expect(plan.sensitiveChange).toBe(true)
    expect(plan.sensitiveReasons).toContain("authentication")
    expect(plan.sensitiveReasons).toContain("student_area")
    expect(plan.riskLevel).toBe("high")
    expect(plan.requiresExplicitPublishConfirmation).toBe(true)
  })
  it("routes rollback smoke prompts to an inoffensive docs file", () => {
    const plan = buildAiCodeEditorPlan({
      prompt: "valide o rollback por PR usando um arquivo inofensivo de docs",
      timestampToken: "20260622113000",
    })

    expect(plan.filesPlanned).toEqual(["docs/AI_CODE_EDITOR_ROLLBACK_SMOKE.md"])
    expect(plan.riskLevel).toBe("low")
  })
})
