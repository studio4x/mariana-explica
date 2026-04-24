import type {
  ModuleAssetSummary,
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

export interface ExportedCourseModule extends ProductModuleSummary {
  lessons: ProductLessonSummary[]
  assets: ModuleAssetSummary[]
}

export interface ExportedCoursePackage {
  modules: ExportedCourseModule[]
  assessments: ProductAssessmentSummary[]
}

interface NormalizedCourseJson {
  title: string
  slug: string
  coverImageUrl: string
  status: ProductSummary["status"]
  launchDate: string
  priceCents: number
  currency: string
  isPublic: boolean
  description: string
  workloadMinutes: number
  sortOrder: number
  productType: ProductSummary["product_type"]
  importedStructure: ExportedCoursePackage | null
}

interface JsonLessonRecord {
  title?: unknown
  description?: unknown
  lesson_type?: unknown
  youtube_url?: unknown
  text_content?: unknown
  estimated_minutes?: unknown
}

interface JsonAssessmentOptionRecord {
  option_text?: unknown
  label?: unknown
  text?: unknown
  value?: unknown
  is_correct?: unknown
  isCorrect?: unknown
}

interface JsonAssessmentQuestionRecord {
  question_text?: unknown
  prompt?: unknown
  title?: unknown
  question_type?: unknown
  type?: unknown
  points?: unknown
  is_required?: unknown
  required?: unknown
  essay_expected_answer?: unknown
  options?: unknown
  interaction?: unknown
  grading?: unknown
}

interface JsonAssessmentCaseStudyRecord {
  title?: unknown
  case_text?: unknown
  questions?: unknown
}

interface JsonAssessmentRecord {
  title?: unknown
  description?: unknown
  assessment_type?: unknown
  passing_score?: unknown
  max_attempts?: unknown
  estimated_minutes?: unknown
  questions?: unknown
  case_studies?: unknown
  builder_payload?: unknown
}

interface JsonModuleRecord {
  title?: unknown
  description?: unknown
  lessons?: unknown
  assessments?: unknown
}

type UnknownRecord = Record<string, unknown>

const QUIZ_TYPE_SETTINGS_DEFAULT = {
  single_choice: true,
  essay_ai: true,
  drag_drop_labeling: true,
  fill_in_the_blanks: true,
  image_hotspot: true,
  coloring: true,
  case_study: true,
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as UnknownRecord
}

function asArray<TValue = unknown>(value: unknown): TValue[] {
  return Array.isArray(value) ? (value as TValue[]) : []
}

function asText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value.trim()
}

function asNullableText(value: unknown) {
  const text = asText(value, "")
  return text || null
}

function asBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  return fallback
}

function asInt(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.trunc(parsed)
  }
  return fallback
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function sanitizeFileName(value: string, fallback: string) {
  const normalized = slugify(value)
  return normalized || fallback
}

function extractFencedJson(input: string) {
  const text = input.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence?.[1]) return fence[1].trim()
  return text
}

function escapeControlCharsInsideStrings(input: string) {
  let output = ""
  let inString = false
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const code = input.charCodeAt(index)

    if (!inString) {
      output += char
      if (char === '"') inString = true
      continue
    }

    if (escaped) {
      output += char
      escaped = false
      continue
    }

    if (char === "\\") {
      output += char
      escaped = true
      continue
    }

    if (char === '"') {
      output += char
      inString = false
      continue
    }

    if (code < 0x20) {
      switch (char) {
        case "\n":
          output += "\\n"
          break
        case "\r":
          output += "\\r"
          break
        case "\t":
          output += "\\t"
          break
        case "\b":
          output += "\\b"
          break
        case "\f":
          output += "\\f"
          break
        default:
          output += `\\u${code.toString(16).padStart(4, "0")}`
          break
      }
      continue
    }

    output += char
  }

  return output
}

export function parseJsonInput(raw: string): unknown {
  const extracted = extractFencedJson(raw).replace(/^\uFEFF/, "")
  const escapedControls = escapeControlCharsInsideStrings(extracted)
  const candidates = [
    escapedControls,
    escapedControls.replace(/\\"/g, '"').replace(/\\'/g, "'"),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("JSON invalido.")
}

function normalizeAssessmentOptions(input: unknown) {
  const options = asArray<JsonAssessmentOptionRecord>(input)

  return options.map((option, index) => {
    const optionRecord = asRecord(option) ?? {}
    const label =
      asText(optionRecord.option_text) ||
      asText(optionRecord.label) ||
      asText(optionRecord.text) ||
      `Opcao ${index + 1}`
    const value = asText(optionRecord.value) || slugify(label) || `opcao-${index + 1}`
    return {
      id: `option-${index + 1}`,
      label,
      value,
      isCorrect: asBool(optionRecord.is_correct, asBool(optionRecord.isCorrect, false)),
    }
  })
}

function normalizeQuestionType(raw: unknown, insideCaseStudy: boolean) {
  const value = asText(raw).toLowerCase()
  if (insideCaseStudy) {
    if (value === "case_study_ai") return "case_study_ai"
    if (value === "case_study_single_choice") return "case_study_single_choice"
    return "case_study_single_choice"
  }

  if (
    value === "essay_ai" ||
    value === "drag_drop_labeling" ||
    value === "fill_in_the_blanks" ||
    value === "image_hotspot" ||
    value === "coloring"
  ) {
    return value
  }

  return "single_choice"
}

function normalizeQuestions(input: unknown, insideCaseStudy: boolean) {
  const questions = asArray<JsonAssessmentQuestionRecord>(input)
  return questions.map((question, index) => {
    const record = asRecord(question) ?? {}
    const type = normalizeQuestionType(record.question_type ?? record.type, insideCaseStudy)
    const prompt =
      asText(record.question_text) ||
      asText(record.prompt) ||
      asText(record.title) ||
      `Questao ${index + 1}`

    return {
      id: `question-${index + 1}`,
      type,
      question_type: type,
      prompt,
      question_text: prompt,
      title: asNullableText(record.title),
      points: asInt(record.points, type === "essay_ai" ? 0 : 1),
      required: asBool(record.is_required, asBool(record.required, true)),
      is_required: asBool(record.is_required, asBool(record.required, true)),
      essay_expected_answer: asNullableText(record.essay_expected_answer),
      options:
        type === "single_choice" || type === "case_study_single_choice"
          ? normalizeAssessmentOptions(record.options)
          : [],
      interaction: asRecord(record.interaction) ?? null,
      grading: asRecord(record.grading) ?? null,
    }
  })
}

function normalizeCaseStudies(input: unknown) {
  const caseStudies = asArray<JsonAssessmentCaseStudyRecord>(input)
  return caseStudies.map((caseStudy, index) => {
    const record = asRecord(caseStudy) ?? {}
    return {
      id: `case-${index + 1}`,
      title: asText(record.title) || `Caso ${index + 1}`,
      case_text: asText(record.case_text),
      questions: normalizeQuestions(record.questions, true),
    }
  })
}

function normalizeAssessmentBuilderPayload(record: JsonAssessmentRecord) {
  const builderPayload = asRecord(record.builder_payload)
  if (builderPayload) {
    return builderPayload
  }

  const questions = normalizeQuestions(record.questions, false)
  const caseStudies = normalizeCaseStudies(record.case_studies)

  return {
    version: 1,
    questions,
    case_studies: caseStudies,
  } satisfies Record<string, unknown>
}

function normalizeAssessmentFromJson(
  record: JsonAssessmentRecord,
  productId: string,
  moduleId: string | null,
  assessmentType: ProductAssessmentSummary["assessment_type"],
  index: number,
): ProductAssessmentSummary {
  const parsed = asRecord(record) ?? {}
  const effectiveTypeRaw =
    asText(parsed.assessment_type).toLowerCase() || assessmentType
  const effectiveType: ProductAssessmentSummary["assessment_type"] =
    effectiveTypeRaw === "final" ? "final" : "module"
  const now = new Date().toISOString()

  return {
    id: `imported-assessment-${index + 1}-${crypto.randomUUID()}`,
    product_id: productId,
    module_id: effectiveType === "final" ? null : moduleId,
    assessment_type: effectiveType,
    title:
      asText(parsed.title) ||
      (effectiveType === "final" ? "Avaliacao final" : `Quiz do modulo ${index + 1}`),
    description: asNullableText(parsed.description),
    is_required: true,
    passing_score: asInt(parsed.passing_score, 70),
    max_attempts:
      parsed.max_attempts === null || parsed.max_attempts === undefined
        ? null
        : asInt(parsed.max_attempts, 3),
    estimated_minutes: asInt(parsed.estimated_minutes, 10),
    is_active: true,
    builder_payload: normalizeAssessmentBuilderPayload(parsed as JsonAssessmentRecord),
    created_by: null,
    created_at: now,
    updated_at: now,
  }
}

function normalizeLessonsFromJson(input: unknown, moduleId: string) {
  const lessons = asArray<JsonLessonRecord>(input)

  return lessons.map((lesson, index) => {
    const record = asRecord(lesson) ?? {}
    const lessonTypeRaw = asText(record.lesson_type).toLowerCase()
    const lessonType: ProductLessonSummary["lesson_type"] =
      lessonTypeRaw === "text" || lessonTypeRaw === "hybrid" || lessonTypeRaw === "file"
        ? lessonTypeRaw
        : "video"

    return {
      id: `imported-lesson-${index + 1}-${crypto.randomUUID()}`,
      module_id: moduleId,
      title: asText(record.title) || `Aula ${index + 1}`,
      description: asNullableText(record.description),
      position: index + 1,
      is_required: true,
      lesson_type: lessonType,
      youtube_url: asNullableText(record.youtube_url),
      text_content: asNullableText(record.text_content),
      estimated_minutes: asInt(record.estimated_minutes, 10),
      starts_at: null,
      ends_at: null,
      status: "draft",
    } satisfies ProductLessonSummary
  })
}

function normalizeModuleFromJson(
  input: JsonModuleRecord,
  productId: string,
  position: number,
): { module: ExportedCourseModule; assessments: ProductAssessmentSummary[] } {
  const record = asRecord(input) ?? {}
  const moduleId = `imported-module-${position}-${crypto.randomUUID()}`
  const lessons = normalizeLessonsFromJson(record.lessons, moduleId)
  const moduleAssessments = asArray<JsonAssessmentRecord>(record.assessments).map((assessment, index) =>
    normalizeAssessmentFromJson(assessment, productId, moduleId, "module", index),
  )

  const module: ExportedCourseModule = {
    id: moduleId,
    product_id: productId,
    title: asText(record.title) || `Modulo ${position}`,
    description: asNullableText(record.description),
    module_type: "mixed",
    access_type: "paid_only",
    sort_order: position,
    position,
    is_preview: false,
    is_required: true,
    starts_at: null,
    ends_at: null,
    release_days_after_enrollment: null,
    module_pdf_storage_path: null,
    module_pdf_file_name: null,
    module_pdf_uploaded_at: null,
    status: "draft",
    lessons,
    assets: [],
  }

  return { module, assessments: moduleAssessments }
}

function isLegacyCoursePayload(value: UnknownRecord) {
  return Array.isArray(value.modules) || Array.isArray(value.assessments)
}

export function normalizeCourseImport(raw: unknown): NormalizedCourseJson {
  const payload = asRecord(raw) ?? {}

  if (isLegacyCoursePayload(payload)) {
    const course = asRecord(payload.course) ?? asRecord(payload.product) ?? payload
    const modules = asArray<ExportedCourseModule>(payload.modules)
    const assessments = asArray<ProductAssessmentSummary>(payload.assessments)
    return {
      title: asText(course.title),
      slug: asText(course.slug),
      coverImageUrl: asText(course.cover_image_url ?? course.coverImageUrl),
      status:
        asText(course.status) === "published" || asText(course.status) === "archived"
          ? (asText(course.status) as ProductSummary["status"])
          : "draft",
      launchDate: asText(course.launch_date ?? course.launchDate),
      priceCents: asInt(course.price_cents ?? course.priceCents, 0),
      currency: asText(course.currency, "EUR") || "EUR",
      isPublic: asBool(course.is_public ?? course.isPublic, true),
      description: asText(course.description ?? course.short_description),
      workloadMinutes: asInt(course.workload_minutes ?? course.workloadMinutes, 0),
      sortOrder: asInt(course.sort_order ?? course.sortOrder, 0),
      productType:
        asText(course.product_type) === "free" ||
        asText(course.product_type) === "hybrid" ||
        asText(course.product_type) === "external_service"
          ? (asText(course.product_type) as ProductSummary["product_type"])
          : asInt(course.price_cents ?? course.priceCents, 0) > 0
            ? "paid"
            : "free",
      importedStructure: modules.length > 0 || assessments.length > 0 ? { modules, assessments } : null,
    }
  }

  const normalizedModules = asArray<JsonModuleRecord>(payload.modules).map((module, index) =>
    normalizeModuleFromJson(module, "imported-product", index + 1),
  )
  const modules = normalizedModules.map((item) => item.module)
  const moduleAssessments = normalizedModules.flatMap((item) => item.assessments)
  const topLevelAssessments = asArray<JsonAssessmentRecord>(payload.assessments).map((assessment, index) =>
    normalizeAssessmentFromJson(assessment, "imported-product", null, "final", index),
  )
  const finalAssessmentCandidate = asRecord(payload.final_assessment)
  const finalAssessments = finalAssessmentCandidate
    ? [normalizeAssessmentFromJson(finalAssessmentCandidate, "imported-product", null, "final", 0)]
    : []

  return {
    title: asText(payload.title),
    slug: asText(payload.slug),
    coverImageUrl: asText(payload.thumbnail_url),
    status:
      asText(payload.status) === "published" || asText(payload.status) === "archived"
        ? (asText(payload.status) as ProductSummary["status"])
        : "draft",
    launchDate: "",
    priceCents: 0,
    currency: "EUR",
    isPublic: true,
    description: asText(payload.description),
    workloadMinutes: asInt(payload.workload_minutes, 0),
    sortOrder: 0,
    productType: "paid",
    importedStructure:
      modules.length > 0 || moduleAssessments.length > 0 || topLevelAssessments.length > 0 || finalAssessments.length > 0
        ? {
            modules,
            assessments: [...moduleAssessments, ...topLevelAssessments, ...finalAssessments],
          }
        : null,
  }
}

function mapBuilderOptionsToJson(options: unknown) {
  return asArray<UnknownRecord>(options).map((option) => ({
    option_text: asText(option.label ?? option.option_text ?? option.text) || "Opcao",
    is_correct: asBool(option.isCorrect ?? option.is_correct, false),
  }))
}

function mapBuilderQuestionsToJson(questions: unknown) {
  return asArray<UnknownRecord>(questions).map((question) => ({
    question_text:
      asText(question.question_text ?? question.prompt ?? question.title) || "Questao sem texto",
    question_type: asText(question.question_type ?? question.type) || "single_choice",
    points: asInt(question.points, 1),
    is_required: asBool(question.is_required ?? question.required, true),
    essay_expected_answer: asText(question.essay_expected_answer),
    options: mapBuilderOptionsToJson(question.options),
    interaction: asRecord(question.interaction) ?? undefined,
    grading: asRecord(question.grading) ?? undefined,
  }))
}

function mapAssessmentToJson(assessment: ProductAssessmentSummary) {
  const payload = asRecord(assessment.builder_payload) ?? {}
  const questions = mapBuilderQuestionsToJson(payload.questions)
  const caseStudies = asArray<UnknownRecord>(payload.case_studies).map((caseStudy) => ({
    title: asText(caseStudy.title),
    case_text: asText(caseStudy.case_text),
    questions: mapBuilderQuestionsToJson(caseStudy.questions),
  }))

  return {
    title: assessment.title,
    description: assessment.description ?? "",
    assessment_type: assessment.assessment_type,
    passing_score: assessment.passing_score,
    max_attempts: assessment.max_attempts,
    estimated_minutes: assessment.estimated_minutes,
    questions,
    case_studies: caseStudies,
    builder_payload: assessment.builder_payload,
  }
}

export function exportModuleToJson(
  module: ProductModuleSummary,
  lessons: ProductLessonSummary[],
  assessments: ProductAssessmentSummary[],
) {
  return {
    title: module.title,
    description: module.description ?? "",
    lessons: lessons
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((lesson) => ({
        title: lesson.title,
        description: lesson.description ?? "",
        lesson_type: lesson.lesson_type,
        youtube_url: lesson.youtube_url ?? "",
        text_content: lesson.text_content ?? "",
        estimated_minutes: lesson.estimated_minutes,
      })),
    assessments: assessments.map(mapAssessmentToJson),
  }
}

export function exportAssessmentToJson(assessment: ProductAssessmentSummary) {
  return mapAssessmentToJson(assessment)
}

export function exportCourseToJson(
  course: ProductSummary,
  modules: ExportedCourseModule[],
  assessments: ProductAssessmentSummary[],
) {
  const moduleAssessmentsByModuleId = new Map<string, ProductAssessmentSummary[]>()
  for (const assessment of assessments.filter((item) => item.assessment_type === "module" && item.module_id)) {
    const moduleId = assessment.module_id as string
    const current = moduleAssessmentsByModuleId.get(moduleId) ?? []
    current.push(assessment)
    moduleAssessmentsByModuleId.set(moduleId, current)
  }

  const finalAssessment = assessments.find((assessment) => assessment.assessment_type === "final") ?? null

  return {
    title: course.title,
    description: course.description ?? "",
    workload_minutes: course.workload_minutes,
    thumbnail_url: course.cover_image_url ?? "",
    status: course.status,
    quiz_type_settings:
      (asRecord(course.quiz_type_settings) as Record<string, boolean> | null) ?? QUIZ_TYPE_SETTINGS_DEFAULT,
    modules: modules
      .slice()
      .sort((left, right) => left.position - right.position || left.sort_order - right.sort_order)
      .map((module) =>
        exportModuleToJson(
          module,
          module.lessons ?? [],
          moduleAssessmentsByModuleId.get(module.id) ?? [],
        ),
      ),
    ...(finalAssessment ? { final_assessment: mapAssessmentToJson(finalAssessment) } : {}),
  }
}

export function normalizeModuleImport(raw: unknown): JsonModuleRecord {
  const payload = asRecord(raw) ?? {}
  if (Array.isArray(payload.modules)) {
    const firstModule = asArray<JsonModuleRecord>(payload.modules)[0]
    if (!firstModule) {
      throw new Error("O JSON do curso nao possui modulos para importar.")
    }
    return firstModule
  }

  if (!asText(payload.title)) {
    throw new Error("JSON de modulo invalido: campo `title` obrigatorio.")
  }

  return payload as JsonModuleRecord
}

export function normalizeAssessmentImport(raw: unknown): {
  assessment: {
    title: string
    description: string | null
    assessment_type: "module" | "final"
    module_id: string | null
    passing_score: number
    max_attempts: number | null
    estimated_minutes: number
  }
  builder_payload: Record<string, unknown>
} {
  const payload = asRecord(raw) ?? {}
  const assessmentRecord = asRecord(payload.assessment) ?? payload
  const assessmentTypeRaw = asText(
    assessmentRecord.assessment_type ?? assessmentRecord.type,
  ).toLowerCase()
  const assessmentType = assessmentTypeRaw === "final" ? "final" : "module"

  const assessmentJson = normalizeAssessmentFromJson(
    assessmentRecord as JsonAssessmentRecord,
    "imported-product",
    null,
    assessmentType,
    0,
  )

  return {
    assessment: {
      title: assessmentJson.title,
      description: assessmentJson.description,
      assessment_type: assessmentJson.assessment_type,
      module_id: assessmentJson.module_id,
      passing_score: assessmentJson.passing_score,
      max_attempts: assessmentJson.max_attempts,
      estimated_minutes: assessmentJson.estimated_minutes,
    },
    builder_payload: assessmentJson.builder_payload,
  }
}

export function normalizeModuleImportForReplace(
  raw: unknown,
  moduleId: string,
  productId: string,
) {
  const moduleJson = normalizeModuleImport(raw)
  const moduleRecord = asRecord(moduleJson) ?? {}
  const normalized = normalizeModuleFromJson(moduleRecord, productId, 1)
  const assessments = normalized.assessments.map(
    (assessment) => ({
      ...assessment,
      module_id: moduleId,
      product_id: productId,
    }),
  )

  return {
    module: normalized.module,
    lessons: normalized.module.lessons,
    assessments,
  }
}

export function makeCourseExportFileName(course: Pick<ProductSummary, "slug" | "title">) {
  return `${sanitizeFileName(course.slug || course.title, "curso")}.json`
}

export function makeAssessmentExportFileName(courseSlug: string, assessmentTitle: string) {
  return `${sanitizeFileName(courseSlug, "curso")}-${sanitizeFileName(assessmentTitle, "avaliacao")}.json`
}
