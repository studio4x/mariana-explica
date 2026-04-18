import type {
  LessonProgressSummary,
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"

export type AssessmentQuestionKind =
  | "single_choice"
  | "essay_ai"
  | "case_study_ai"
  | "drag_drop"
  | "fill_blank"
  | "hotspot"
  | "unknown"

export interface AssessmentQuestionOption {
  id: string
  label: string
  value: string
  isCorrect: boolean
}

export interface AssessmentQuestion {
  id: string
  kind: AssessmentQuestionKind
  title: string
  prompt: string
  options: AssessmentQuestionOption[]
  feedback: string | null
  rubric: string | null
  points: number | null
  required: boolean
}

export type AssessmentDraftAnswerValue = string | string[]

export interface CoursePlayerEntry {
  id: string
  type: "lesson" | "assessment"
  moduleId: string | null
  title: string
  isLocked: boolean
}

export function createLessonProgressMap(progress: LessonProgressSummary[]) {
  return new Map(progress.map((item) => [item.lesson_id, item]))
}

export function getLessonProgressState(
  lessonId: string,
  progressMap: Map<string, LessonProgressSummary>,
): { label: string; tone: "neutral" | "warning" | "success" } {
  const item = progressMap.get(lessonId)
  if (!item) return { label: "Por iniciar", tone: "neutral" }
  if (item.status === "completed") return { label: "Concluida", tone: "success" }
  return { label: `${item.progress_percent}%`, tone: "warning" }
}

export function buildCoursePlayerEntries(
  modules: ProductModuleSummary[],
  lessons: Array<Pick<ProductLessonSummary, "id" | "module_id" | "title"> & { is_locked?: boolean }>,
  assessments: Array<
    Pick<ProductAssessmentSummary, "id" | "module_id" | "assessment_type" | "title"> & { is_locked?: boolean }
  >,
) {
  const entries: CoursePlayerEntry[] = []

  for (const module of modules) {
    const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id)
    const moduleAssessments = assessments.filter(
      (assessment) => assessment.module_id === module.id && assessment.assessment_type === "module",
    )

    for (const lesson of moduleLessons) {
      entries.push({
        id: lesson.id,
        type: "lesson",
        moduleId: module.id,
        title: lesson.title,
        isLocked: lesson.is_locked ?? false,
      })
    }

    for (const assessment of moduleAssessments) {
      entries.push({
        id: assessment.id,
        type: "assessment",
        moduleId: module.id,
        title: assessment.title,
        isLocked: assessment.is_locked ?? false,
      })
    }
  }

  for (const assessment of assessments.filter((item) => item.assessment_type === "final")) {
    entries.push({
      id: assessment.id,
      type: "assessment",
      moduleId: null,
      title: assessment.title,
      isLocked: assessment.is_locked ?? false,
    })
  }

  return entries
}

export function findNextLesson<T extends { id: string; is_locked?: boolean }>(
  lessons: T[],
  progressMap: Map<string, LessonProgressSummary>,
) {
  const unlockedLessons = lessons.filter((lesson) =>
    lesson.is_locked === false || typeof lesson.is_locked === "undefined",
  )

  return (
    unlockedLessons.find((lesson) => progressMap.get(lesson.id)?.status !== "completed") ??
    unlockedLessons[0] ??
    null
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return null
}

function pickBoolean(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value
  }

  return false
}

function normalizeAssessmentQuestionKind(value: unknown): AssessmentQuestionKind {
  if (typeof value !== "string") return "unknown"

  const normalized = value.trim().toLowerCase()
  if (
    [
      "single_choice",
      "multiple_choice",
      "single-choice",
      "multiple-choice",
      "radio",
      "choice",
      "objective",
    ].includes(normalized)
  ) {
    return "single_choice"
  }

  if (["essay_ai", "essay", "discursive", "open_text", "open-text"].includes(normalized)) {
    return "essay_ai"
  }

  if (["case_study_ai", "case_study", "case-study", "study_case"].includes(normalized)) {
    return "case_study_ai"
  }

  if (["drag_drop", "drag-and-drop", "dragdrop"].includes(normalized)) {
    return "drag_drop"
  }

  if (["fill_blank", "fill-in-the-blank", "fill_blank_ai"].includes(normalized)) {
    return "fill_blank"
  }

  if (["hotspot", "image_hotspot", "hotspot_image"].includes(normalized)) {
    return "hotspot"
  }

  return "unknown"
}

function extractAssessmentQuestionOptions(question: Record<string, unknown>) {
  const optionCandidates = [
    question.options,
    question.alternatives,
    question.choices,
    question.answers,
    question.items,
  ]

  return optionCandidates
    .flatMap((candidate) => asArray(candidate))
    .map((option, index) => {
      const record = asRecord(option)
      if (!record) return null

      const value = pickString(record.id, record.value, record.key, `option-${index + 1}`)
      const label = pickString(
        record.label,
        record.text,
        record.title,
        record.content,
        value,
      )

      return {
        id: value || `option-${index + 1}`,
        value: value || `option-${index + 1}`,
        label: label || `Opcao ${index + 1}`,
        isCorrect: pickBoolean(
          record.is_correct,
          record.isCorrect,
          record.correct,
          record.answer,
        ),
      } satisfies AssessmentQuestionOption
    })
    .filter((option): option is AssessmentQuestionOption => option !== null)
}

function mapAssessmentQuestion(question: Record<string, unknown>, index: number): AssessmentQuestion {
  const options = extractAssessmentQuestionOptions(question)
  const title = pickString(question.title, question.label)
  const prompt = pickString(
    question.prompt,
    question.question,
    question.statement,
    question.text,
    title,
    `Questao ${index + 1}`,
  )

  return {
    id: pickString(question.id, question.question_id, question.key, `question-${index + 1}`),
    kind: normalizeAssessmentQuestionKind(
      question.type ?? question.kind ?? question.question_type ?? question.model,
    ),
    title,
    prompt,
    options,
    feedback: pickString(question.feedback, question.explanation, question.solution) || null,
    rubric: pickString(question.rubric, question.scoring_guide, question.criteria) || null,
    points: pickNumber(question.points, question.score, question.value),
    required: pickBoolean(question.required, question.is_required),
  }
}

export function normalizeAssessmentQuestions(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return [] as AssessmentQuestion[]

  const candidates = [
    payload.questions,
    payload.items,
    payload.blocks,
    payload.steps,
    asRecord(payload.content)?.questions,
    asRecord(payload.structure)?.questions,
  ]

  const questions = candidates.flatMap((candidate) => asArray(candidate))
  if (questions.length > 0) {
    return questions
      .map((question, index) => {
        const record = asRecord(question)
        return record ? mapAssessmentQuestion(record, index) : null
      })
      .filter((question): question is AssessmentQuestion => question !== null)
  }

  const prompt = pickString(payload.prompt, payload.question, payload.title, payload.description)
  if (!prompt) return [] as AssessmentQuestion[]

  return [
    mapAssessmentQuestion(
      {
        id: payload.id ?? "question-1",
        prompt,
        type: payload.type ?? payload.kind,
        options: payload.options ?? payload.alternatives,
        feedback: payload.feedback,
        rubric: payload.rubric,
        points: payload.points,
        required: payload.required,
      },
      0,
    ),
  ]
}

function sameAnswerSet(selected: string[], correct: string[]) {
  if (selected.length !== correct.length) return false

  const selectedSorted = [...selected].sort()
  const correctSorted = [...correct].sort()
  return selectedSorted.every((value, index) => value === correctSorted[index])
}

export function calculateAssessmentDraftResult(
  questions: AssessmentQuestion[],
  answers: Record<string, AssessmentDraftAnswerValue>,
) {
  const totalQuestions = questions.length
  const answeredCount = questions.filter((question) => {
    const answer = answers[question.id]
    return Array.isArray(answer) ? answer.length > 0 : typeof answer === "string" && answer.trim().length > 0
  }).length

  const autoGradableQuestions = questions.filter((question) => question.options.length > 0)
  const correctCount = autoGradableQuestions.reduce((sum, question) => {
    const answer = answers[question.id]
    const correctValues = question.options.filter((option) => option.isCorrect).map((option) => option.value)
    if (correctValues.length === 0) return sum

    if (Array.isArray(answer)) {
      return sameAnswerSet(answer, correctValues) ? sum + 1 : sum
    }

    return answer === correctValues[0] ? sum + 1 : sum
  }, 0)

  const scorePercent =
    autoGradableQuestions.length > 0
      ? Math.round((correctCount / autoGradableQuestions.length) * 100)
      : null

  return {
    totalQuestions,
    answeredCount,
    autoGradableCount: autoGradableQuestions.length,
    manualReviewCount: totalQuestions - autoGradableQuestions.length,
    correctCount,
    scorePercent,
  }
}
