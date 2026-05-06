import { getProductNarrative } from "@/lib/product-presentation"
import { richTextToPlainText } from "@/lib/rich-text"
import type { ProductModuleSummary, ProductLessonSummary } from "@/types/app.types"
import type {
  CoursePublicPageContent,
  CoursePublicPageCurriculumItem,
  CoursePublicPageFeature,
  ProductSummary,
} from "@/types/product.types"

export interface CoursePublicPageView {
  eyebrow: string
  headline: string
  intro: string
  aboutTitle: string
  aboutParagraphs: string[]
  learnTitle: string
  learnItems: CoursePublicPageFeature[]
  curriculumTitle: string
  curriculumItems: CoursePublicPageCurriculumItem[]
  instructorName: string
  instructorRole: string
  instructorInitials: string
  priceNote: string
  ctaLabel: string
  sidebarFeatures: string[]
  previewTitle: string
  previewText: string
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function chooseText(value: unknown, fallback: string) {
  return cleanText(value) || fallback
}

function normalizeTextList(value: unknown, fallback: string[], minItems = 1) {
  const items = Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean)
    : []

  return items.length >= minItems ? items : fallback
}

function normalizeFeatures(value: unknown, fallback: CoursePublicPageFeature[]) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
          return {
            title: cleanText(entry.title),
            description: cleanText(entry.description),
          }
        })
        .filter((item) => item.title || item.description)
    : []

  return items.length ? items : fallback
}

function normalizeCurriculumItems(value: unknown, fallback: CoursePublicPageCurriculumItem[]) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
          return {
            label: cleanText(entry.label),
            title: cleanText(entry.title),
            lessons: cleanText(entry.lessons),
            description: cleanText(entry.description),
          }
        })
        .filter((item) => item.label || item.title || item.lessons || item.description)
    : []

  return items.length ? items : fallback
}

function buildModuleCurriculum(
  modules: ProductModuleSummary[] = [],
  lessonsByModule: Record<string, ProductLessonSummary[]> = {},
) {
  return modules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.position - b.position)
    .map((module, index) => {
      const lessonCount = lessonsByModule[module.id]?.length ?? 0
      return {
        label: `Modulo ${index + 1}`,
        title: module.title,
        lessons: lessonCount > 0 ? `${lessonCount} aulas` : "Aulas organizadas",
        description:
          richTextToPlainText(module.description) ||
          "Conteudo estruturado para avancar com clareza dentro da trilha do material.",
      }
    })
}

export function buildCoursePublicPageView(
  product: ProductSummary,
  modules: ProductModuleSummary[] = [],
  lessonsByModule: Record<string, ProductLessonSummary[]> = {},
): CoursePublicPageView {
  const narrative = getProductNarrative(product)
  const content = product.public_page_content ?? {}
  const description =
    richTextToPlainText(product.description) ||
    richTextToPlainText(product.short_description) ||
    narrative.benefit
  const intro = richTextToPlainText(product.short_description) || narrative.cardSummary
  const curriculumFromModules = buildModuleCurriculum(modules, lessonsByModule)

  const defaultLearnItems = narrative.receiveItems.map((item) => ({
    title: item.split(".")[0] || "Aprender com clareza",
    description: item,
  }))

  return {
    eyebrow: chooseText(content.eyebrow, narrative.familyLabel.toUpperCase()),
    headline: chooseText(content.headline, product.title),
    intro: chooseText(content.intro, intro),
    aboutTitle: chooseText(content.aboutTitle, "Sobre o material"),
    aboutParagraphs: normalizeTextList(content.aboutParagraphs, [description, narrative.valueLine], 1),
    learnTitle: chooseText(content.learnTitle, "O que vais aprender"),
    learnItems: normalizeFeatures(content.learnItems, defaultLearnItems),
    curriculumTitle: chooseText(content.curriculumTitle, "Conteudo do material"),
    curriculumItems: normalizeCurriculumItems(
      content.curriculumItems,
      curriculumFromModules.length
        ? curriculumFromModules
        : [
            {
              label: "Modulo 1",
              title: "Fundamentos do material",
              lessons: "Aulas organizadas",
              description: "Base inicial para compreender o conteudo com mais seguranca.",
            },
            {
              label: "Modulo 2",
              title: "Aplicacao pratica",
              lessons: "Exercicios e exemplos",
              description: "Pontes entre teoria, exemplos e estudo orientado.",
            },
            {
              label: "Modulo 3",
              title: "Revisao estrategica",
              lessons: "Blocos de fixacao",
              description: "Retoma dos pontos principais para consolidar a aprendizagem.",
            },
          ],
    ),
    instructorName: chooseText(content.instructorName, "Mariana Teixeira"),
    instructorRole: chooseText(content.instructorRole, "Mariana Explica"),
    instructorInitials: chooseText(content.instructorInitials, "ME"),
    priceNote: chooseText(content.priceNote, narrative.sidebarNote),
    ctaLabel: chooseText(content.ctaLabel, narrative.ctaLabel),
    sidebarFeatures: normalizeTextList(content.sidebarFeatures, narrative.receiveItems, 1),
    previewTitle: chooseText(content.previewTitle, "O que esta incluido"),
    previewText: chooseText(content.previewText, narrative.valueLine),
  }
}

export function sanitizeCoursePublicPageContent(
  content: CoursePublicPageView,
): CoursePublicPageContent {
  return {
    eyebrow: cleanText(content.eyebrow),
    headline: cleanText(content.headline),
    intro: cleanText(content.intro),
    aboutTitle: cleanText(content.aboutTitle),
    aboutParagraphs: content.aboutParagraphs.map(cleanText).filter(Boolean),
    learnTitle: cleanText(content.learnTitle),
    learnItems: content.learnItems
      .map((item) => ({
        title: cleanText(item.title),
        description: cleanText(item.description),
      }))
      .filter((item) => item.title || item.description),
    curriculumTitle: cleanText(content.curriculumTitle),
    curriculumItems: content.curriculumItems
      .map((item) => ({
        label: cleanText(item.label),
        title: cleanText(item.title),
        lessons: cleanText(item.lessons),
        description: cleanText(item.description),
      }))
      .filter((item) => item.label || item.title || item.lessons || item.description),
    instructorName: cleanText(content.instructorName),
    instructorRole: cleanText(content.instructorRole),
    instructorInitials: cleanText(content.instructorInitials),
    priceNote: cleanText(content.priceNote),
    ctaLabel: cleanText(content.ctaLabel),
    sidebarFeatures: content.sidebarFeatures.map(cleanText).filter(Boolean),
    previewTitle: cleanText(content.previewTitle),
    previewText: cleanText(content.previewText),
  }
}
