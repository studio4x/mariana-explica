import { describe, expect, it } from "vitest"
import { requirePersistiblePageEditorProposal } from "./proposal-guards.ts"
import { materializeConfirmedIntentProposal } from "./confirmed-intent.ts"

function createAboutSpacingBaseVersion() {
  return {
    id: "version-about-1",
    page_id: "page-about-1",
    version_number: 12,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "about-hero-inline",
            type: "rich_text",
            content: `
              <section class="me-about-page">
                <div class="me-about-shell">
                  <div class="me-about-section-head">
                    <h2>Sobre a Mariana</h2>
                  </div>
                  <p>Conteúdo da primeira seção.</p>
                </div>
              </section>
            `,
            layout: {
              paddingTop: 0,
              marginTop: 0,
            },
          },
          {
            id: "about-followup",
            type: "rich_text",
            content: "<p>Segunda seção preservada.</p>",
            layout: {
              paddingTop: 16,
              marginTop: 0,
            },
          },
        ],
      },
    },
    style_json: {},
    metadata: {},
  }
}

function createAboutInternalSpacingBaseVersion() {
  const baseVersion = createAboutSpacingBaseVersion()
  const blocks = ((((baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks)))
  blocks[0] = {
    ...blocks[0],
    layout: {
      paddingTop: 24,
      marginTop: 0,
    },
  }
  return baseVersion
}

function createConversationContext(understandingSummary: string, quickReplySelected?: string | null) {
  return {
    phase: "awaiting_intent_confirmation" as const,
    understanding_summary: understandingSummary,
    clarification_questions_count: 1,
    quick_reply_selected: quickReplySelected ?? null,
    confirmation_token: "intent_test",
    recent_messages: [
      {
        role: "user" as const,
        text: "Quero tirar o espaço em branco no topo da página Sobre. O que fica antes de iniciar a primeira seção da página",
      },
      {
        role: "assistant" as const,
        text: "Entendi! Queres remover aquele espaço vazio que aparece logo no topo da página Sobre, antes do conteúdo principal começar. É isso mesmo?",
      },
    ],
  }
}

function materialize(understandingSummary: string, options?: {
  quickReplySelected?: string | null
  baseVersion?: ReturnType<typeof createAboutSpacingBaseVersion>
}) {
  return materializeConfirmedIntentProposal({
    providerUsed: "openai",
    modelUsed: "gpt-4.1-mini",
    confirmationMessage: "Sim, é isso mesmo.",
    slug: "sobre",
    title: "Sobre",
    path: "/sobre",
    conversationContext: createConversationContext(understandingSummary, options?.quickReplySelected),
    baseVersion: options?.baseVersion ?? createAboutSpacingBaseVersion(),
    baseVersionSource: "published_version",
    degradedDraftBypassed: false,
    baseVersionSelectionReason: "published_version_safe_context",
    publishedVersionId: "version-about-1",
    latestDraftId: null,
  })
}

describe("materializeConfirmedIntentProposal", () => {
  it("prioritizes the page wrapper when the confirmed intent says before the first section", () => {
    const result = materialize(
      "remover o espaço em branco no topo da página Sobre, antes da primeira seção",
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.mode).toBe("spacing_patch")
    expect(result.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(result.canGenerateProposal).toBe(true)
    expect(result.operationalState.preview_available).toBe(true)
    expect(result.operationalState.final_status).toBe("proposal_ready")
    expect(result.assistantMessage).not.toMatch(/\bpadding\b|\bwrapper\b|\blayout\b|\bpatch\b|\bproposal\b/i)

    expect(() =>
      requirePersistiblePageEditorProposal({
        summary: result.summary,
        explanation: result.explanation,
        warnings: result.warnings,
        edit_plan: result.editPlan,
        proposal: result.proposal,
      }, "confirmed_intent_spacing"),
    ).not.toThrow()

    expect(String(result.proposal.style_json.css ?? "")).toContain(".me-managed-page-root")
    expect(String(result.proposal.style_json.css ?? "")).not.toContain("section.me-about-page")
  })

  it("targets only the global wrapper when the confirmed intent is explicit", () => {
    const result = materialize("remover só o espaço no wrapper global da página Sobre")

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(String(result.proposal.style_json.css ?? "")).toContain(".me-managed-page-root")
    expect(String(result.proposal.style_json.css ?? "")).not.toContain("section.me-about-page")
  })

  it("targets only the first section when the confirmed intent points there", () => {
    const result = materialize("remover só o espaço no topo da primeira seção da página Sobre")

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.target_ids).toEqual(["first_section_spacing"])
    expect(String(result.proposal.style_json.css ?? "")).toContain("section.me-about-page")
    expect(String(result.proposal.style_json.css ?? "")).not.toContain(".me-managed-page-root {\n  padding-top: 0px !important;")
  })

  it("can target wrapper and first section together from the confirmed summary", () => {
    const result = materialize(
      "remover o espaço no topo da página Sobre e também no topo da primeira seção",
      { quickReplySelected: "Nos dois" },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.target_ids).toEqual(["page_wrapper_spacing", "first_section_spacing"])
    expect(result.warnings.join(" ")).toContain("wrapper da página e dentro da primeira seção")
  })

  it("maps 'dentro da primeira seção' to section internal spacing", () => {
    const result = materialize(
      "remover o espaço dentro da primeira seção da página Sobre",
      {
        baseVersion: createAboutInternalSpacingBaseVersion(),
      },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.target_ids).toEqual(["section_internal_spacing"])
    expect(result.editPlan.mode).toBe("spacing_patch")
    expect(result.proposal.metadata.ai_invariants?.confirmed_intent_materialized).toBe(true)
  })

  it("does not touch section internal spacing when the request says to keep it", () => {
    const result = materialize(
      "remover o espaço em branco antes da primeira seção da página Sobre e manter o padding interno da seção",
      {
        baseVersion: createAboutInternalSpacingBaseVersion(),
      },
    )

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(result.editPlan.target_ids).not.toContain("section_internal_spacing")
    expect(String(result.proposal.style_json.css ?? "")).toContain(".me-managed-page-root")
  })

  it("returns a friendly failure instead of falling back to a broad proposal when the safe patch cannot be built", () => {
    const result = materialize("remover o espaço no topo da página Sobre", {
      baseVersion: {
        ...createAboutSpacingBaseVersion(),
        layout_json: { projectData: { blocks: [] } },
      },
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failure")
    expect(result.scope).toBe("wrapper_only")
    expect(result.assistantMessage).toMatch(/tentativa segura/i)
  })
})
