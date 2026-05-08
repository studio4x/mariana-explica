import { getProductNarrative } from "@/lib/product-presentation"
import { isRichTextEmpty, richTextToPlainText, sanitizeRichTextHtml } from "@/lib/rich-text"
import type { ProductAssessmentSummary, ProductModuleSummary, ProductLessonSummary } from "@/types/app.types"
import type {
  CoursePublicPageContent,
  CoursePublicPageCurriculumMode,
  CoursePublicPageCurriculumItem,
  CoursePublicPageFeature,
  ProductSummary,
} from "@/types/product.types"

export interface CoursePublicPageCurriculumEntry {
  kind: "lesson" | "assessment"
  label: string
  title: string
  description: string
}

export interface CoursePublicPageCurriculumSection {
  label: string
  title: string
  description: string
  countLabel: string
  items: CoursePublicPageCurriculumEntry[]
}

export interface CoursePublicPageView {
  eyebrow: string
  headline: string
  intro: string
  aboutTitle: string
  aboutParagraphs: string[]
  learnTitle: string
  learnItems: CoursePublicPageFeature[]
  curriculumMode: CoursePublicPageCurriculumMode
  curriculumTitle: string
  curriculumItems: CoursePublicPageCurriculumItem[]
  curriculumSections: CoursePublicPageCurriculumSection[]
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

function cleanRichText(value: unknown) {
  if (typeof value !== "string") return ""
  const html = sanitizeRichTextHtml(value)
  return isRichTextEmpty(html) ? "" : html
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

function formatItemCount(count: number) {
  return count === 1 ? "1 item" : `${count} itens`
}

function buildModuleCurriculum(
  modules: ProductModuleSummary[] = [],
  lessonsByModule: Record<string, ProductLessonSummary[]> = {},
  assessments: ProductAssessmentSummary[] = [],
) {
  return modules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.position - b.position)
    .map((module, index) => {
      const lessonCount = lessonsByModule[module.id]?.length ?? 0
      const assessmentCount = assessments.filter(
        (assessment) => assessment.module_id === module.id && assessment.assessment_type === "module",
      ).length
      const itemCount = lessonCount + assessmentCount
      return {
        label: `Modulo ${index + 1}`,
        title: module.title,
        lessons: itemCount > 0 ? formatItemCount(itemCount) : "Conteudo organizado",
        description:
          richTextToPlainText(module.description) ||
          "Conteudo estruturado para avancar com clareza dentro da trilha do material.",
      }
    })
}

export function buildCourseCurriculumOutline(
  modules: ProductModuleSummary[] = [],
  lessonsByModule: Record<string, ProductLessonSummary[]> = {},
  assessments: ProductAssessmentSummary[] = [],
) {
  const sections = modules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.position - b.position)
    .map((module, index) => {
      const lessons = [...(lessonsByModule[module.id] ?? [])].sort((a, b) => a.position - b.position)
      const moduleAssessments = assessments
        .filter((assessment) => assessment.module_id === module.id && assessment.assessment_type === "module")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      const items = [
        ...lessons.map((lesson) => ({
          kind: "lesson" as const,
          label: "Aula",
          title: lesson.title,
          description:
            richTextToPlainText(lesson.description) || "Aula cadastrada no construtor do curso.",
        })),
        ...moduleAssessments.map((assessment) => ({
          kind: "assessment" as const,
          label: "Quiz",
          title: assessment.title,
          description:
            richTextToPlainText(assessment.description) || "Avaliacao disponivel no modulo.",
        })),
      ]

      return {
        label: `Modulo ${index + 1}`,
        title: module.title,
        description:
          richTextToPlainText(module.description) ||
          "Conteudo estruturado para avancar com clareza dentro da trilha do material.",
        countLabel: formatItemCount(items.length),
        items,
      } satisfies CoursePublicPageCurriculumSection
    })

  const finalAssessments = assessments
    .filter((assessment) => assessment.assessment_type === "final")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  if (finalAssessments.length > 0) {
    sections.push({
      label: "Avaliacao final",
      title: finalAssessments[0]?.title || "Avaliacao final",
      description:
        richTextToPlainText(finalAssessments[0]?.description) || "Avaliacao conclusiva do curso.",
      countLabel: formatItemCount(finalAssessments.length),
      items: finalAssessments.map((assessment) => ({
        kind: "assessment" as const,
        label: "Avaliacao",
        title: assessment.title,
        description: richTextToPlainText(assessment.description) || "Avaliacao final do curso.",
      })),
    })
  }

  return sections
}

export function buildCoursePublicPageView(
  product: ProductSummary,
  modules: ProductModuleSummary[] = [],
  lessonsByModule: Record<string, ProductLessonSummary[]> = {},
  assessments: ProductAssessmentSummary[] = [],
): CoursePublicPageView {
  const narrative = getProductNarrative(product)
  const content = product.public_page_content ?? {}
  const description =
    richTextToPlainText(product.description) ||
    richTextToPlainText(product.short_description) ||
    narrative.benefit
  const intro = richTextToPlainText(product.short_description) || narrative.cardSummary
  const curriculumFromModules = buildModuleCurriculum(modules, lessonsByModule, assessments)
  const curriculumSections = buildCourseCurriculumOutline(modules, lessonsByModule, assessments)

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
    curriculumMode: content.curriculumMode === "real" ? "real" : "custom",
    curriculumTitle: chooseText(content.curriculumTitle, "Conteudo do curso"),
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
    curriculumSections,
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
    intro: cleanRichText(content.intro),
    aboutTitle: cleanText(content.aboutTitle),
    aboutParagraphs: content.aboutParagraphs.map(cleanRichText).filter(Boolean),
    learnTitle: cleanText(content.learnTitle),
    learnItems: content.learnItems
      .map((item) => ({
        title: cleanText(item.title),
        description: cleanRichText(item.description),
      }))
      .filter((item) => item.title || item.description),
    curriculumTitle: cleanText(content.curriculumTitle),
    curriculumMode: content.curriculumMode === "real" ? "real" : "custom",
    curriculumItems: content.curriculumItems
      .map((item) => ({
        label: cleanText(item.label),
        title: cleanText(item.title),
        lessons: cleanText(item.lessons),
        description: cleanRichText(item.description),
      }))
      .filter((item) => item.label || item.title || item.lessons || item.description),
    instructorName: cleanText(content.instructorName),
    instructorRole: cleanText(content.instructorRole),
    instructorInitials: cleanText(content.instructorInitials),
    priceNote: cleanText(content.priceNote),
    ctaLabel: cleanText(content.ctaLabel),
    sidebarFeatures: content.sidebarFeatures.map(cleanText).filter(Boolean),
    previewTitle: cleanText(content.previewTitle),
    previewText: cleanRichText(content.previewText),
  }
}
