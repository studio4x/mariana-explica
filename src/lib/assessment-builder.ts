import { normalizeAssessmentQuestions, type AssessmentQuestion, type AssessmentQuestionKind } from "@/lib/course-helpers"
import type { ProductAssessmentSummary } from "@/types/app.types"

export interface AssessmentBuilderOptionDraft {
  id: string
  label: string
  value: string
  isCorrect: boolean
}

export interface AssessmentBuilderQuestionDraft {
  id: string
  kind: AssessmentQuestionKind
  title: string
  prompt: string
  options: AssessmentBuilderOptionDraft[]
  feedback: string
  rubric: string
  points: string
  required: boolean
}

export interface AssessmentBuilderDraft {
  title: string
  description: string
  assessmentType: ProductAssessmentSummary["assessment_type"]
  moduleId: string | null
  isRequired: boolean
  passingScore: string
  maxAttempts: string
  estimatedMinutes: string
  isActive: boolean
  questions: AssessmentBuilderQuestionDraft[]
}

export const assessmentQuestionTypeOptions: Array<{ value: AssessmentQuestionKind; label: string }> = [
  { value: "single_choice", label: "Multipla escolha" },
  { value: "essay_ai", label: "Discursiva com IA" },
  { value: "case_study_ai", label: "Estudo de caso" },
  { value: "drag_drop", label: "Arrastar e soltar" },
  { value: "fill_blank", label: "Preencher lacunas" },
  { value: "hotspot", label: "Hotspot de imagem" },
]

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function questionToDraft(question: AssessmentQuestion, index: number): AssessmentBuilderQuestionDraft {
  return {
    id: question.id || randomId(`question-${index + 1}`),
    kind: question.kind === "unknown" ? "single_choice" : question.kind,
    title: question.title,
    prompt: question.prompt,
    options:
      question.options.length > 0
        ? question.options.map((option, optionIndex) => ({
            id: option.id || randomId(`option-${optionIndex + 1}`),
            label: option.label,
            value: option.value,
            isCorrect: option.isCorrect,
          }))
        : [
            {
              id: randomId("option-1"),
              label: "Opcao 1",
              value: "opcao-1",
              isCorrect: true,
            },
            {
              id: randomId("option-2"),
              label: "Opcao 2",
              value: "opcao-2",
              isCorrect: false,
            },
          ],
    feedback: question.feedback ?? "",
    rubric: question.rubric ?? "",
    points: question.points === null ? "" : String(question.points),
    required: question.required,
  }
}

export function createEmptyQuestionDraft(kind: AssessmentQuestionKind = "single_choice"): AssessmentBuilderQuestionDraft {
  const withOptions = kind === "single_choice"
  return {
    id: randomId("question"),
    kind,
    title: "",
    prompt: "",
    options: withOptions
      ? [
          { id: randomId("option"), label: "Opcao 1", value: "opcao-1", isCorrect: true },
          { id: randomId("option"), label: "Opcao 2", value: "opcao-2", isCorrect: false },
        ]
      : [],
    feedback: "",
    rubric: "",
    points: "",
    required: true,
  }
}

export function createAssessmentDraft(assessment?: ProductAssessmentSummary | null): AssessmentBuilderDraft {
  if (!assessment) {
    return {
      title: "",
      description: "",
      assessmentType: "module",
      moduleId: null,
      isRequired: true,
      passingScore: "70",
      maxAttempts: "",
      estimatedMinutes: "15",
      isActive: true,
      questions: [createEmptyQuestionDraft()],
    }
  }

  const questions = normalizeAssessmentQuestions(assessment.builder_payload).map(questionToDraft)

  return {
    title: assessment.title,
    description: assessment.description ?? "",
    assessmentType: assessment.assessment_type,
    moduleId: assessment.module_id,
    isRequired: assessment.is_required,
    passingScore: String(assessment.passing_score),
    maxAttempts: assessment.max_attempts === null ? "" : String(assessment.max_attempts),
    estimatedMinutes: String(assessment.estimated_minutes),
    isActive: assessment.is_active,
    questions: questions.length > 0 ? questions : [createEmptyQuestionDraft()],
  }
}

export function buildAssessmentPayload(questions: AssessmentBuilderQuestionDraft[]) {
  return {
    version: 1,
    questions: questions.map((question, index) => ({
      id: question.id || `question-${index + 1}`,
      type: question.kind,
      title: question.title.trim() || null,
      prompt: question.prompt.trim() || `Questao ${index + 1}`,
      options: question.options
        .map((option, optionIndex) => ({
          id: option.id || `option-${optionIndex + 1}`,
          value: option.value.trim() || `opcao-${optionIndex + 1}`,
          label: option.label.trim() || `Opcao ${optionIndex + 1}`,
          isCorrect: Boolean(option.isCorrect),
        }))
        .filter((option) => option.label.length > 0 || option.value.length > 0),
      feedback: question.feedback.trim() || null,
      rubric: question.rubric.trim() || null,
      points: question.points.trim() ? Number(question.points) : null,
      required: question.required,
    })),
  }
}
