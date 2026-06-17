import { describe, expect, it } from "vitest"
import type { AiEditPlan } from "./contract.ts"
import { applyPatchPlan, diagnoseFooterAdjacentSpacing, refineSpacingEditPlanForKnownWrappers } from "./patch-engine.ts"

function createBaseVersion() {
  return {
    id: "version-1",
    page_id: "page-1",
    version_number: 7,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "hero-section",
            type: "container",
            columns: 1,
            gap: 24,
            rowGap: 24,
            alignItems: "stretch",
            justifyItems: "stretch",
            columnContentAlignX: "left",
            columnContentAlignY: "top",
            columnContentGap: 12,
            children: [
              [
                {
                  id: "hero-heading",
                  type: "heading",
                  level: 1,
                  content: "Transforme o seu estudo",
                  align: "left",
                  color: "#112233",
                  layout: {
                    gridColumns: 12,
                    align: "left",
                    paddingTop: 0,
                    paddingRight: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    backgroundColor: "transparent",
                    backgroundImageUrl: "",
                    backgroundImageSize: "cover",
                    borderRadius: 0,
                    contentAlignX: "left",
                    contentAlignY: "top",
                    contentGap: 0,
                    minHeight: 0,
                  },
                },
                {
                  id: "hero-copy",
                  type: "rich_text",
                  content:
                    '<p data-me-builder="hero-copy">Aprenda de forma clara e prática.</p><p><a href="/sobre">Conheça a Mariana</a></p>',
                  layout: {
                    gridColumns: 12,
                    align: "left",
                    paddingTop: 0,
                    paddingRight: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    backgroundColor: "transparent",
                    backgroundImageUrl: "",
                    backgroundImageSize: "cover",
                    borderRadius: 0,
                    contentAlignX: "left",
                    contentAlignY: "top",
                    contentGap: 0,
                    minHeight: 0,
                  },
                },
                {
                  id: "hero-cta",
                  type: "button",
                  label: "Quero começar",
                  href: "/checkout",
                  align: "left",
                  textAlign: "center",
                  borderWidth: 0,
                  borderColor: "#112233",
                  borderRadius: 999,
                  backgroundColor: "#112233",
                  textColor: "#ffffff",
                  paddingY: 14,
                  paddingX: 24,
                  fontSize: 16,
                  widthPercent: 0,
                  fullWidth: false,
                  openInNewTab: false,
                  layout: {
                    gridColumns: 12,
                    align: "left",
                    paddingTop: 0,
                    paddingRight: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    backgroundColor: "transparent",
                    backgroundImageUrl: "",
                    backgroundImageSize: "cover",
                    borderRadius: 0,
                    contentAlignX: "left",
                    contentAlignY: "top",
                    contentGap: 0,
                    minHeight: 0,
                  },
                },
              ],
            ],
            columnLayouts: [
              {
                gridColumns: 12,
                align: "left",
                paddingTop: 0,
                paddingRight: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                backgroundColor: "transparent",
                backgroundImageUrl: "",
                backgroundImageSize: "cover",
                borderRadius: 0,
                contentAlignX: "left",
                contentAlignY: "top",
                contentGap: 0,
                minHeight: 0,
              },
            ],
            backgroundColor: "#f8fafc",
            borderColor: "#d8e6eb",
            borderWidth: 1,
            borderRadius: 18,
            paddingY: 20,
            paddingX: 20,
            layout: {
              gridColumns: 12,
              align: "center",
              paddingTop: 48,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 8,
              marginLeft: 0,
              marginRight: 0,
              backgroundColor: "transparent",
              backgroundImageUrl: "",
              backgroundImageSize: "cover",
              borderRadius: 0,
              contentAlignX: "stretch",
              contentAlignY: "top",
              contentGap: 0,
              minHeight: 0,
            },
          },
          {
            id: "cards-grid",
            type: "columns",
            columns: 3,
            gap: 32,
            rowGap: 32,
            alignItems: "stretch",
            justifyItems: "stretch",
            itemContentAlignX: "left",
            itemContentAlignY: "top",
            itemPaddingY: 16,
            itemPaddingX: 16,
            items: [
              "<p>Card 1</p>",
              "<p>Card 2</p>",
              "<p>Card 3</p>",
            ],
            layout: {
              gridColumns: 12,
              align: "center",
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 8,
              marginLeft: 0,
              marginRight: 0,
              backgroundColor: "transparent",
              backgroundImageUrl: "",
              backgroundImageSize: "cover",
              borderRadius: 0,
              contentAlignX: "stretch",
              contentAlignY: "top",
              contentGap: 0,
              minHeight: 0,
            },
          },
          {
            id: "support-section",
            type: "rich_text",
            content: '<p>Fale com a nossa equipa.</p><p><a href="/suporte">Abrir suporte</a></p>',
            layout: {
              gridColumns: 12,
              align: "center",
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 8,
              marginLeft: 0,
              marginRight: 0,
              backgroundColor: "transparent",
              backgroundImageUrl: "",
              backgroundImageSize: "cover",
              borderRadius: 0,
              contentAlignX: "stretch",
              contentAlignY: "top",
              contentGap: 0,
              minHeight: 0,
            },
          },
        ],
      },
    },
    style_json: {},
    metadata: {},
  }
}

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
              gridColumns: 12,
              align: "center",
              paddingTop: 0,
              paddingRight: 16,
              paddingBottom: 0,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              backgroundColor: "transparent",
              backgroundImageUrl: "",
              backgroundImageSize: "cover",
              borderRadius: 0,
              contentAlignX: "stretch",
              contentAlignY: "top",
              contentGap: 0,
              minHeight: 0,
            },
          },
          {
            id: "about-followup",
            type: "rich_text",
            content: "<p>Segunda seção preservada.</p>",
            layout: {
              gridColumns: 12,
              align: "center",
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              backgroundColor: "transparent",
              backgroundImageUrl: "",
              backgroundImageSize: "cover",
              borderRadius: 0,
              contentAlignX: "stretch",
              contentAlignY: "top",
              contentGap: 0,
              minHeight: 0,
            },
          },
        ],
      },
    },
    style_json: {},
    metadata: {},
  }
}

function createPlan(plan: Partial<AiEditPlan>): AiEditPlan {
  return {
    scope: plan.scope ?? "section",
    mode: plan.mode ?? "spacing_patch",
    target_ids: plan.target_ids ?? ["hero-section"],
    risk_level: plan.risk_level ?? "medium",
    requires_strict_confirmation: plan.requires_strict_confirmation ?? true,
    operations: plan.operations ?? [],
  }
}

describe("applyPatchPlan", () => {
  it("removes padding-top from the first section using scoped target resolution", () => {
    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "remover padding-top da primeira seção",
      editPlan: createPlan({
        target_ids: ["home-section"],
        operations: [
          {
            type: "set_style",
            target_id: "home-section",
            path: "layout.paddingTop",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    const blocks = (((result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks))
    expect(((blocks[0].layout as Record<string, unknown>).paddingTop)).toBe(0)
    expect(blocks[1].id).toBe("cards-grid")
    expect(result.resolutions[0]?.section_index).toBe(0)
  })

  it("reduces the gap between cards without touching other sections", () => {
    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "reduzir gap entre cards",
      editPlan: createPlan({
        target_ids: ["cards-grid"],
        operations: [
          {
            type: "set_style",
            target_id: "cards-grid",
            path: "gap",
            value: 16,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    const blocks = (((result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks))
    expect(blocks[1].gap).toBe(16)
    expect(blocks[0].id).toBe("hero-section")
    expect(blocks[2].id).toBe("support-section")
  })

  it("emits responsive CSS when the patch is mobile-only", () => {
    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "no mobile, reduzir o padding-top da seção hero",
      editPlan: createPlan({
        target_ids: ["hero-section"],
        operations: [
          {
            type: "set_responsive_rule",
            target_id: "hero-section",
            path: "layout.paddingTop",
            value: "8px",
            breakpoint: "mobile",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    expect((result.styleJson.css as string)).toContain("@media (max-width: 767px)")
    expect((result.styleJson.css as string)).toContain("padding-top: 8px !important;")
    const blocks = (((result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks))
    expect(((blocks[0].layout as Record<string, unknown>).paddingTop)).toBe(48)
  })

  it("replaces only the target section and preserves the rest of the page", () => {
    const replacement = {
      id: "cards-grid",
      type: "rich_text",
      content: '<p>Nova seção de prova social.</p>',
      layout: {
        gridColumns: 12,
        align: "center",
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        marginTop: 0,
        marginBottom: 8,
        marginLeft: 0,
        marginRight: 0,
        backgroundColor: "transparent",
        backgroundImageUrl: "",
        backgroundImageSize: "cover",
        borderRadius: 0,
        contentAlignX: "stretch",
        contentAlignY: "top",
        contentGap: 0,
        minHeight: 0,
      },
    }

    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "substituir a seção de cards mantendo o resto",
      editPlan: createPlan({
        mode: "section_replace",
        risk_level: "high",
        operations: [
          {
            type: "replace_section",
            target_id: "cards-grid",
            value: replacement,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    const blocks = (((result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks))
    expect(blocks).toHaveLength(3)
    expect(blocks[1].type).toBe("rich_text")
    expect(blocks[0].id).toBe("hero-section")
    expect(blocks[2].id).toBe("support-section")
  })

  it("rejects attempts to remove or patch global header/footer through the page patch engine", () => {
    expect(() =>
      applyPatchPlan({
        slug: "home",
        title: "Home",
        path: "/",
        message: "remover o header",
        editPlan: createPlan({
          scope: "header",
          mode: "section_replace",
          risk_level: "high",
          target_ids: ["global-header"],
          operations: [
            {
              type: "replace_section",
              target_id: "global-header",
              value: null,
              breakpoint: "all",
            },
          ],
        }),
        baseVersion: createBaseVersion(),
      }),
    ).toThrow(/header\/footer globais/i)
  })

  it("rejects truncated proposal templates before applying a scoped patch", () => {
    expect(() =>
      applyPatchPlan({
        slug: "home",
        title: "Home",
        path: "/",
        message: "substituir a seção hero",
        editPlan: createPlan({
          mode: "section_replace",
          risk_level: "high",
          operations: [
            {
              type: "replace_section",
              target_id: "hero-section",
              value: { instruction: "usar template" },
              breakpoint: "all",
            },
          ],
        }),
        baseVersion: createBaseVersion(),
        proposalLayoutJson: {
          projectData: {
            blocks: [
              {
                id: "hero-section",
                type: "rich_text",
                content: "<p>Hero truncado.</p>",
                layout: {
                  gridColumns: 12,
                  align: "center",
                  paddingTop: 16,
                  paddingRight: 16,
                  paddingBottom: 16,
                  paddingLeft: 16,
                  marginTop: 0,
                  marginBottom: 8,
                  marginLeft: 0,
                  marginRight: 0,
                  backgroundColor: "transparent",
                  backgroundImageUrl: "",
                  backgroundImageSize: "cover",
                  borderRadius: 0,
                  contentAlignX: "stretch",
                  contentAlignY: "top",
                  contentGap: 0,
                  minHeight: 0,
                },
              },
            ],
          },
        },
      }),
    ).toThrow(/truncada/i)
  })

  it("preserves critical CTAs and main links outside the target section", () => {
    const replacement = {
      id: "cards-grid",
      type: "rich_text",
      content: '<p>Cartões substituídos.</p><p><a href="/sobre">Saiba mais</a></p>',
      layout: {
        gridColumns: 12,
        align: "center",
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        marginTop: 0,
        marginBottom: 8,
        marginLeft: 0,
        marginRight: 0,
        backgroundColor: "transparent",
        backgroundImageUrl: "",
        backgroundImageSize: "cover",
        borderRadius: 0,
        contentAlignX: "stretch",
        contentAlignY: "top",
        contentGap: 0,
        minHeight: 0,
      },
    }

    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "substituir a seção de cards mantendo CTA e links principais",
      editPlan: createPlan({
        mode: "section_replace",
        risk_level: "high",
        operations: [
          {
            type: "replace_section",
            target_id: "cards-grid",
            value: replacement,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    const blocks = (((result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks))
    const heroChildren = (((blocks[0].children as unknown[])?.[0] ?? []) as Array<Record<string, unknown>>)
    const heroCta = heroChildren.find((block) => block.id === "hero-cta")
    expect(heroCta?.href).toBe("/checkout")
    expect((blocks[2].content as string)).toContain("/suporte")
  })

  it("detects page-wrapper and first-section spacing on the real Sobre HTML and avoids broad rewrites", () => {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message: "remover o espaço no início da página",
      editPlan: createPlan({
        mode: "section_replace",
        target_ids: ["sobre-section"],
        operations: [
          {
            type: "replace_section",
            target_id: "sobre-section",
            value: { instruction: "reescrever a seção" },
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect(refined.editPlan.mode).toBe("spacing_patch")
    expect(refined.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(refined.warnings).toEqual([])

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remover o espaço no início da página",
      editPlan: refined.editPlan,
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect((result.styleJson.css as string)).toContain(".me-managed-page-root")
    expect((result.styleJson.css as string)).toContain("padding-top: 0px !important;")
    expect((result.styleJson.css as string)).not.toContain("section.me-about-page")
    const blocks = (((result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks))
    expect(((blocks[0].layout as Record<string, unknown>).paddingTop)).toBe(0)
    expect(blocks[1].id).toBe("about-followup")
  })

  it("patches the wrapper .me-managed-page-root when that is the explicit spacing target", () => {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message: "remover o espaço no wrapper global da página",
      editPlan: createPlan({
        target_ids: ["page_wrapper_spacing"],
        operations: [
          {
            type: "set_style",
            target_id: "page_wrapper_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createAboutSpacingBaseVersion(),
    })

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remover o espaço no wrapper global da página",
      editPlan: refined.editPlan,
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect((result.styleJson.css as string)).toContain(".me-managed-page-root")
    expect((result.styleJson.css as string)).not.toContain("section.me-about-page")
  })

  it("keeps the wrapper-first strategy for the exact production prompt before falling back to the first section", () => {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message:
        "Existe espaco visivel no inicio da pagina Sobre. Verifica o wrapper global da pagina e a primeira secao real. Remove primeiro o padding-top do wrapper global. Se ainda restar espaco visivel, remove tambem o padding-top da primeira secao. Aplica apenas patch seguro e localizado, sem reescrever a pagina inteira.",
      editPlan: createPlan({
        mode: "section_replace",
        target_ids: ["sobre-section"],
        operations: [
          {
            type: "replace_section",
            target_id: "sobre-section",
            value: { instruction: "reescrever a secao" },
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect(refined.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(refined.editPlan.operations.map((operation) => operation.target_id)).toEqual([
      "page_wrapper_spacing",
    ])
    expect(refined.diagnosis.map((entry) => entry.source)).toContain("page_wrapper_spacing")
  })

  it("prioritizes page_wrapper_spacing for requests before the first section", () => {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message: "remover o espaço em branco no topo da página, antes da primeira seção",
      editPlan: createPlan({
        target_ids: ["page_wrapper_spacing", "first_section_spacing"],
        operations: [
          {
            type: "set_style",
            target_id: "page_wrapper_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
          {
            type: "set_style",
            target_id: "first_section_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect(refined.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(refined.editPlan.target_ids).not.toContain("first_section_spacing")
  })

  it("patches the first section .me-about-page when the user points to the first section", () => {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message: "remover o espaçamento no topo da primeira seção .me-about-page",
      editPlan: createPlan({
        target_ids: ["first_section_spacing"],
        operations: [
          {
            type: "set_style",
            target_id: "first_section_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createAboutSpacingBaseVersion(),
    })

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remover o espaçamento no topo da primeira seção .me-about-page",
      editPlan: refined.editPlan,
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect((result.styleJson.css as string)).toContain("section.me-about-page")
    expect((result.styleJson.css as string)).not.toContain(".me-managed-page-root {\n  padding-top: 0 !important;")
  })

  it("keeps the section internal spacing untouched when the request says to keep it", () => {
    const baseVersion = createAboutSpacingBaseVersion()
    const blocks = ((baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks)
    blocks[0] = {
      ...blocks[0],
      layout: {
        paddingTop: 24,
        marginTop: 0,
      },
    }

    const refined = refineSpacingEditPlanForKnownWrappers({
      message: "remover o espaço antes da primeira seção e manter o padding interno da seção",
      editPlan: createPlan({
        target_ids: ["page_wrapper_spacing", "section_internal_spacing"],
        operations: [
          {
            type: "set_style",
            target_id: "page_wrapper_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
          {
            type: "set_style",
            target_id: "section_internal_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion,
    })

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remover o espaço antes da primeira seção e manter o padding interno da seção",
      editPlan: refined.editPlan,
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(refined.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(refined.editPlan.target_ids).not.toContain("section_internal_spacing")
    expect((nextBlocks[0].layout as { paddingTop?: number }).paddingTop).toBe(24)
  })

  it("detects a wrapper-only diagnosis when the prompt limits the change to the global wrapper", () => {
    const refined = refineSpacingEditPlanForKnownWrappers({
      message:
        "Existe espaco visivel no inicio da pagina Sobre. Verifica o wrapper global da pagina. Remove apenas o padding-top do wrapper global.",
      editPlan: createPlan({
        target_ids: ["page_wrapper_spacing"],
        operations: [
          {
            type: "set_style",
            target_id: "page_wrapper_spacing",
            path: "padding-top",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createAboutSpacingBaseVersion(),
    })

    expect(refined.editPlan.target_ids).toEqual(["page_wrapper_spacing"])
    expect(refined.diagnosis.map((entry) => entry.source)).toContain("page_wrapper_spacing")
  })

  it("rejects ambiguous or low-confidence targets with a clear reason", () => {
    expect(() =>
      applyPatchPlan({
        slug: "home",
        title: "Home",
        path: "/",
        message: "ajustar a seção certa, mas sem indicar qual",
        editPlan: createPlan({
          target_ids: ["secao-indefinida"],
          operations: [
            {
              type: "set_style",
              target_id: "secao-indefinida",
              path: "layout.paddingTop",
              value: 4,
              breakpoint: "all",
            },
          ],
        }),
        baseVersion: createBaseVersion(),
      }),
    ).toThrow(/não encontrei um alvo seguro/i)
  })

  it("removes a localized divider below a referenced heading without changing sections or links", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[1] = {
      id: "about-story",
      type: "rich_text",
      content:
        '<section><h2>De estudante para estudante: porque este projeto?</h2><hr class="story-divider" /><p>Texto preservado.</p><a href="/suporte">Suporte</a></section>',
      layout: {
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
      },
    }

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message:
        'remova essa linha que esta inserido abaixo do titulo "De estudante para estudante: porque este projeto?"',
      editPlan: createPlan({
        mode: "style_patch",
        target_ids: ["localized_divider_below_heading"],
        risk_level: "low",
        operations: [
          {
            type: "remove_style",
            target_id: "localized_divider_below_heading",
            path: "localized-divider",
            value: {
              target_text: "De estudante para estudante: porque este projeto?",
              relation: "below",
            },
            breakpoint: "all",
          },
        ],
      }),
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(nextBlocks).toHaveLength(3)
    expect(String(nextBlocks[1].content)).toContain("De estudante para estudante: porque este projeto?")
    expect(String(nextBlocks[1].content)).toContain("/suporte")
    expect(String(result.styleJson.css ?? "")).toContain('[class*="divider"]')
    expect(String(result.styleJson.css ?? "")).toContain("display: none !important;")
    expect(result.resolutions[0]?.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it("removes only the button border while preserving the CTA text and link", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    const heroChildren = (blocks[0].children as Array<Array<Record<string, unknown>>>)[0]
    const button = heroChildren.find((block) => block.id === "hero-cta")
    if (button) {
      button.borderWidth = 2
      button.borderColor = "#112233"
    }

    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "remova a borda do botao principal da secao inicial",
      editPlan: createPlan({
        scope: "block",
        mode: "style_patch",
        target_ids: ["localized_button_primary"],
        risk_level: "low",
        operations: [
          {
            type: "remove_style",
            target_id: "localized_button_primary",
            path: "border",
            value: "0px solid transparent",
            breakpoint: "all",
          },
        ],
      }),
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    const nextHeroChildren = (nextBlocks[0].children as Array<Array<Record<string, unknown>>>)[0]
    const nextButton = nextHeroChildren.find((block) => block.id === "hero-cta")
    expect(nextButton?.label).toBe("Quero começar")
    expect(nextButton?.href).toBe("/checkout")
    expect(nextButton?.borderWidth).toBe(0)
    expect(nextButton?.borderColor).toBe("transparent")
  })

  it("changes only the main button color and preserves its action", () => {
    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "troque a cor do botao principal para azul",
      editPlan: createPlan({
        scope: "block",
        mode: "style_patch",
        target_ids: ["localized_button_primary"],
        risk_level: "low",
        operations: [
          {
            type: "set_style",
            target_id: "localized_button_primary",
            path: "background",
            value: "#2563eb",
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    const blocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    const heroChildren = (blocks[0].children as Array<Array<Record<string, unknown>>>)[0]
    const button = heroChildren.find((block) => block.id === "hero-cta")
    expect(button?.backgroundColor).toBe("#2563eb")
    expect(button?.href).toBe("/checkout")
  })

  it("removes a card shadow via localized CSS when a selected area points to the card", () => {
    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "remova a sombra desse card na area selecionada",
      editPlan: createPlan({
        scope: "block",
        mode: "style_patch",
        target_ids: ["localized_card"],
        risk_level: "low",
        operations: [
          {
            type: "remove_style",
            target_id: "localized_card",
            path: "box-shadow",
            value: "none",
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
      attachments: [{ name: "card-selecionado.png", mime_type: "image/png" }],
    })

    expect(String(result.styleJson.css ?? "")).toContain("box-shadow: none !important;")
    expect(result.resolutions[0]?.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it("centers a localized title without changing its text", () => {
    const result = applyPatchPlan({
      slug: "home",
      title: "Home",
      path: "/",
      message: "centralize esse titulo",
      editPlan: createPlan({
        scope: "text",
        mode: "style_patch",
        target_ids: ["localized_heading"],
        risk_level: "low",
        operations: [
          {
            type: "set_style",
            target_id: "localized_heading",
            path: "text-align",
            value: "center",
            breakpoint: "all",
          },
        ],
      }),
      baseVersion: createBaseVersion(),
    })

    const blocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    const heroChildren = (blocks[0].children as Array<Array<Record<string, unknown>>>)[0]
    const heading = heroChildren.find((block) => block.id === "hero-heading")
    expect(heading?.content).toBe("Transforme o seu estudo")
    expect(heading?.align).toBe("center")
  })

  it("removes footer-adjacent spacing from the last managed section without touching links", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[2] = {
      ...blocks[2],
      layout: {
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 56,
        paddingLeft: 16,
        marginTop: 0,
        marginBottom: 32,
      },
    }

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remova o espaco entre a ultima secao e o rodape",
      editPlan: createPlan({
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["footer_adjacent_spacing"],
        risk_level: "low",
        operations: [
          {
            type: "set_style",
            target_id: "footer_adjacent_spacing",
            path: "padding-bottom",
            value: 0,
            breakpoint: "all",
          },
          {
            type: "set_style",
            target_id: "footer_adjacent_spacing",
            path: "margin-bottom",
            value: 0,
            breakpoint: "all",
          },
        ],
      }),
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(nextBlocks).toHaveLength(3)
    expect(String(nextBlocks[2].content)).toContain("/suporte")
    expect((nextBlocks[2].layout as { paddingBottom?: number; marginBottom?: number }).paddingBottom).toBe(0)
    expect((nextBlocks[2].layout as { paddingBottom?: number; marginBottom?: number }).marginBottom).toBe(0)
    expect(result.resolutions.every((resolution) => resolution.resolved_target_id === "footer_adjacent_spacing")).toBe(true)
    expect(result.resolutions.every((resolution) => resolution.confidence >= 0.8)).toBe(true)
  })

  it("uses a quoted last-section heading from the current HTML as a high-confidence anchor", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[2] = {
      ...blocks[2],
      content: '<section><h2>Como e estudar comigo?</h2><p>Fale com a nossa equipa.</p><p><a href="/suporte">Abrir suporte</a></p></section>',
      layout: {
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 72,
        paddingLeft: 16,
        marginTop: 0,
        marginBottom: 0,
      },
    }

    const diagnosis = diagnoseFooterAdjacentSpacing({
      slug: "sobre",
      path: "/sobre",
      message: 'a ultima secao da pagina sobre e "Como e estudar comigo?"',
      baseVersion,
      currentHtml: '<main><section><h2>Como e estudar comigo?</h2></section></main>',
    })

    expect(diagnosis.html_anchor_text).toBe("Como e estudar comigo?")
    expect(diagnosis.html_contains_anchor).toBe(true)
    expect(diagnosis.candidates[0]?.heading).toContain("Como e estudar comigo?")
    expect(diagnosis.candidates[0]?.confidence).toBeGreaterThanOrEqual(0.8)
    expect(diagnosis.recommended_operations[0]?.path).toBe("padding-bottom")

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: 'remover o espaco entre a secao "Como e estudar comigo?" e o rodape',
      editPlan: createPlan({
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["footer_adjacent_spacing"],
        risk_level: "low",
        operations: diagnosis.recommended_operations,
      }),
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect((nextBlocks[2].layout as { paddingBottom?: number }).paddingBottom).toBe(0)
    expect(String(nextBlocks[2].content)).toContain("Como e estudar comigo?")
    expect(String(nextBlocks[2].content)).toContain("/suporte")
  })

  it("patches safe footer margin-top CSS as footer-adjacent spacing without entering footer text scope", () => {
    const baseVersion = createBaseVersion()
    baseVersion.style_json = {
      css: ".me-site-footer {\n  margin-top: 48px;\n}",
    }

    const diagnosis = diagnoseFooterAdjacentSpacing({
      slug: "sobre",
      path: "/sobre",
      message: "remova o espaco entre a ultima secao e o rodape",
      baseVersion,
    })

    expect(diagnosis.recommended_operations[0]?.path).toBe("footer-margin-top")

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remova o espaco entre a ultima secao e o rodape",
      editPlan: createPlan({
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["footer_adjacent_spacing"],
        risk_level: "low",
        operations: diagnosis.recommended_operations,
      }),
      baseVersion,
    })

    expect(String(result.styleJson.css)).toContain("margin-top: 0px !important;")
    expect(result.resolutions[0]?.resolved_target_id).toBe("footer_adjacent_spacing")
    expect(result.resolutions[0]?.block_type).not.toBe("footer")
  })

  it("reduces wrapper gap near the footer without changing other sections", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[2] = {
      ...blocks[2],
      gap: 44,
      rowGap: 44,
      layout: {
        ...(blocks[2].layout as Record<string, unknown>),
        paddingBottom: 0,
        marginBottom: 0,
      },
    }

    const diagnosis = diagnoseFooterAdjacentSpacing({
      slug: "sobre",
      path: "/sobre",
      message: "remova a faixa branca entre a ultima secao e o rodape",
      baseVersion,
    })

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remova a faixa branca entre a ultima secao e o rodape",
      editPlan: createPlan({
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["footer_adjacent_spacing"],
        risk_level: "low",
        operations: diagnosis.recommended_operations,
      }),
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(nextBlocks[0].id).toBe("hero-section")
    expect(nextBlocks[1].id).toBe("cards-grid")
    expect(nextBlocks[2].gap).toBe(0)
    expect(nextBlocks[2].rowGap).toBe(0)
  })

  it("collapses an isolated empty spacer block before the footer", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks.push({
      id: "footer-space-spacer",
      type: "spacer",
      content: "",
      layout: {
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        marginTop: 0,
        marginBottom: 0,
        minHeight: 64,
      },
      height: 64,
    })

    const diagnosis = diagnoseFooterAdjacentSpacing({
      slug: "sobre",
      path: "/sobre",
      message: "remova o espaco vazio entre a ultima secao e o rodape",
      baseVersion,
    })

    expect(diagnosis.candidates[0]?.reasons).toContain("spacer vazio detectado antes do rodape")

    const result = applyPatchPlan({
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      message: "remova o espaco vazio entre a ultima secao e o rodape",
      editPlan: createPlan({
        scope: "section",
        mode: "spacing_patch",
        target_ids: ["footer_adjacent_spacing"],
        risk_level: "low",
        operations: diagnosis.recommended_operations,
      }),
      baseVersion,
    })

    const nextBlocks = (result.layoutJson.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(nextBlocks).toHaveLength(4)
    expect(nextBlocks[2].id).toBe("support-section")
    expect((nextBlocks[3].layout as { minHeight?: number }).minHeight).toBe(0)
    expect(String(nextBlocks[2].content)).toContain("/suporte")
  })

  it("returns a useful low-confidence diagnosis instead of patching an unclear footer-adjacent request", () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    for (const block of blocks) {
      block.layout = {
        ...(block.layout as Record<string, unknown>),
        paddingBottom: 0,
        marginBottom: 0,
      }
      block.gap = 0
      block.rowGap = 0
    }

    const diagnosis = diagnoseFooterAdjacentSpacing({
      slug: "sobre",
      path: "/sobre",
      message: "analise o html e veja se existe algum elemento criando esse espaco",
      baseVersion,
    })

    expect(diagnosis.candidate_count).toBeGreaterThan(0)
    expect(diagnosis.candidate_rejections).toContain("confidence abaixo do limiar seguro")
    expect(diagnosis.candidate_rejections).toContain("sem espacamento explicito detectado neste candidato")
    expect(diagnosis.confidence_scores[0]).toBeLessThan(0.8)
  })
})
