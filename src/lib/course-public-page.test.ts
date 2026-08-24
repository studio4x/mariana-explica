import { describe, expect, it } from "vitest"
import { mergeCoursePublicPageContent, type CoursePublicPageView } from "./course-public-page"

function createPublicPageView(overrides: Partial<CoursePublicPageView> = {}): CoursePublicPageView {
  return {
    eyebrow: "Material",
    headline: "Novo titulo publico",
    intro: "Introducao",
    aboutTitle: "Sobre",
    aboutParagraphs: ["Descricao"],
    learnTitle: "Aprendizagens",
    learnItems: [{ title: "Topico", description: "Explicacao" }],
    curriculumMode: "custom",
    curriculumTitle: "Conteudo",
    curriculumItems: [{ label: "Modulo 1", title: "Base", lessons: "2 aulas", description: "Resumo" }],
    curriculumSections: [],
    instructorName: "Mariana Teixeira",
    instructorRole: "Mariana Explica",
    instructorInitials: "ME",
    priceNote: "Acesso imediato",
    ctaLabel: "Quero este material",
    sidebarFeatures: ["PDF incluido"],
    previewTitle: "Inclui",
    previewText: "Conteudo completo",
    ...overrides,
  }
}

describe("mergeCoursePublicPageContent", () => {
  it("preserves catalog card settings when the public page is saved", () => {
    const result = mergeCoursePublicPageContent(
      {
        headline: "Titulo anterior",
        catalogCardMode: "custom",
        catalogCardSummary: "Resumo configurado no material",
        catalogCardItems: [
          { title: "Beneficio", description: "Descricao do card", tone: "outline" },
        ],
      },
      createPublicPageView(),
    )

    expect(result.headline).toBe("Novo titulo publico")
    expect(result.catalogCardMode).toBe("custom")
    expect(result.catalogCardSummary).toBe("Resumo configurado no material")
    expect(result.catalogCardItems).toEqual([
      { title: "Beneficio", description: "Descricao do card", tone: "outline" },
    ])
  })
})
