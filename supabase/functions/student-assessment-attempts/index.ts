import { conflict, badRequest, forbidden, notFound } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/auth.ts"

type AttemptStatus = "in_progress" | "submitted" | "passed" | "failed" | "pending_review"

interface AssessmentRow {
  id: string
  product_id: string
  module_id: string | null
  assessment_type: "module" | "final"
  title: string
  description: string | null
  passing_score: number
  max_attempts: number | null
  is_active: boolean
  builder_payload: Record<string, unknown>
}

interface AttemptRow {
  id: string
  user_id: string
  assessment_id: string
  product_id: string
  module_id: string | null
  attempt_number: number
  status: AttemptStatus
  answers_payload: Record<string, unknown>
  result_payload: Record<string, unknown>
  auto_score_percent: number | null
  final_score_percent: number | null
  requires_manual_review: boolean
  passed: boolean | null
  started_at: string
  last_saved_at: string
  submitted_at: string | null
  evaluated_at: string | null
  created_at: string
  updated_at: string
}

type AttemptInput =
  | { action: "get_state"; assessmentId: string }
  | { action: "save_draft"; attemptId: string; answersPayload?: Record<string, unknown> }
  | { action: "submit"; attemptId: string; answersPayload?: Record<string, unknown> }

type QuestionKind =
  | "single_choice"
  | "essay_ai"
  | "case_study_ai"
  | "drag_drop"
  | "fill_blank"
  | "hotspot"
  | "unknown"

interface QuestionOption {
  id: string
  value: string
  label: string
  isCorrect: boolean
}

interface QuestionShape {
  id: string
  kind: QuestionKind
  prompt: string
  options: QuestionOption[]
  points: number | null
}

function requireText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest(`${label} e obrigatorio`)
  }

  return value.trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
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

function normalizeQuestionKind(value: unknown): QuestionKind {
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

function normalizeOptions(question: Record<string, unknown>) {
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
      const label = pickString(record.label, record.text, record.title, record.content, value)

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
      } satisfies QuestionOption
    })
    .filter((option): option is QuestionOption => option !== null)
}

function mapQuestion(record: Record<string, unknown>, index: number): QuestionShape {
  return {
    id: pickString(record.id, record.question_id, record.key, `question-${index + 1}`),
    kind: normalizeQuestionKind(record.type ?? record.kind ?? record.question_type ?? record.model),
    prompt: pickString(
      record.prompt,
      record.question,
      record.statement,
      record.text,
      record.title,
      `Questao ${index + 1}`,
    ),
    options: normalizeOptions(record),
    points: pickNumber(record.points, record.score, record.value),
  }
}

function normalizeQuestions(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return [] as QuestionShape[]

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
        return record ? mapQuestion(record, index) : null
      })
      .filter((question): question is QuestionShape => question !== null)
  }

  const prompt = pickString(payload.prompt, payload.question, payload.title, payload.description)
  if (!prompt) return [] as QuestionShape[]

  return [
    mapQuestion(
      {
        id: payload.id ?? "question-1",
        prompt,
        type: payload.type ?? payload.kind,
        options: payload.options ?? payload.alternatives,
        points: payload.points,
      },
      0,
    ),
  ]
}

function normalizeAnswersPayload(value: unknown) {
  const payload = asRecord(value)
  if (!payload) return {} as Record<string, string | string[]>

  const normalizedEntries = Object.entries(payload).flatMap(([key, rawValue]) => {
    if (typeof rawValue === "string") {
      return [[key, rawValue]] as Array<[string, string | string[]]>
    }

    if (Array.isArray(rawValue)) {
      const values = rawValue.filter((item): item is string => typeof item === "string")
      return [[key, values]] as Array<[string, string | string[]]>
    }

    return []
  })

  return Object.fromEntries(normalizedEntries)
}

function sameAnswerSet(selected: string[], correct: string[]) {
  if (selected.length !== correct.length) return false

  const selectedSorted = [...selected].sort()
  const correctSorted = [...correct].sort()
  return selectedSorted.every((value, index) => value === correctSorted[index])
}

function buildAttemptResponse(
  assessment: AssessmentRow,
  attempt: AttemptRow | null,
  attemptsUsed: number,
  canStartNewAttempt: boolean,
) {
  return {
    success: true,
    assessment: {
      id: assessment.id,
      title: assessment.title,
      assessment_type: assessment.assessment_type,
      passing_score: assessment.passing_score,
      max_attempts: assessment.max_attempts,
    },
    attempt,
    attempts_used: attemptsUsed,
    remaining_attempts:
      assessment.max_attempts === null ? null : Math.max(assessment.max_attempts - attemptsUsed, 0),
    can_start_new_attempt: canStartNewAttempt,
  }
}

async function fetchAssessmentOrThrow(
  serviceClient: Awaited<ReturnType<typeof requireActiveUser>>["serviceClient"],
  userId: string,
  assessmentId: string,
) {
  const { data: canAccess, error: accessError } = await serviceClient.rpc("can_access_product_assessment", {
    target_assessment_id: assessmentId,
    target_user: userId,
  })

  if (accessError) {
    throw accessError
  }

  if (!canAccess) {
    throw forbidden("Voce nao possui acesso a esta avaliacao")
  }

  const { data, error } = await serviceClient
    .from("product_assessments")
    .select("id,product_id,module_id,assessment_type,title,description,passing_score,max_attempts,is_active,builder_payload")
    .eq("id", assessmentId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Avaliacao nao encontrada")
  }

  return data as AssessmentRow
}

async function fetchAttemptOrThrow(
  serviceClient: Awaited<ReturnType<typeof requireActiveUser>>["serviceClient"],
  userId: string,
  attemptId: string,
) {
  const { data, error } = await serviceClient
    .from("assessment_attempts")
    .select("id,user_id,assessment_id,product_id,module_id,attempt_number,status,answers_payload,result_payload,auto_score_percent,final_score_percent,requires_manual_review,passed,started_at,last_saved_at,submitted_at,evaluated_at,created_at,updated_at")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Tentativa nao encontrada")
  }

  return data as AttemptRow
}

async function countAttempts(
  serviceClient: Awaited<ReturnType<typeof requireActiveUser>>["serviceClient"],
  userId: string,
  assessmentId: string,
) {
  const { count, error } = await serviceClient
    .from("assessment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)

  if (error) {
    throw error
  }

  return count ?? 0
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireActiveUser(req)
    const body = await readJsonBody<AttemptInput>(req)

    if (body.action === "get_state") {
      const assessmentId = requireText(body.assessmentId, "assessmentId")
      const assessment = await fetchAssessmentOrThrow(context.serviceClient, context.user.id, assessmentId)
      const attemptsUsed = await countAttempts(context.serviceClient, context.user.id, assessmentId)

      const { data: openAttempt, error: openAttemptError } = await context.serviceClient
        .from("assessment_attempts")
        .select("id,user_id,assessment_id,product_id,module_id,attempt_number,status,answers_payload,result_payload,auto_score_percent,final_score_percent,requires_manual_review,passed,started_at,last_saved_at,submitted_at,evaluated_at,created_at,updated_at")
        .eq("user_id", context.user.id)
        .eq("assessment_id", assessmentId)
        .eq("status", "in_progress")
        .order("attempt_number", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (openAttemptError) {
        throw openAttemptError
      }

      if (openAttempt) {
        return jsonResponse({
          ...buildAttemptResponse(assessment, openAttempt as AttemptRow, attemptsUsed, true),
          request_id: requestId,
        })
      }

      if (assessment.max_attempts !== null && attemptsUsed >= assessment.max_attempts) {
        const { data: latestAttempt, error: latestAttemptError } = await context.serviceClient
          .from("assessment_attempts")
          .select("id,user_id,assessment_id,product_id,module_id,attempt_number,status,answers_payload,result_payload,auto_score_percent,final_score_percent,requires_manual_review,passed,started_at,last_saved_at,submitted_at,evaluated_at,created_at,updated_at")
          .eq("user_id", context.user.id)
          .eq("assessment_id", assessmentId)
          .order("attempt_number", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestAttemptError) {
          throw latestAttemptError
        }

        return jsonResponse({
          ...buildAttemptResponse(assessment, (latestAttempt as AttemptRow | null) ?? null, attemptsUsed, false),
          request_id: requestId,
        })
      }

      const { data: createdAttempt, error: createAttemptError } = await context.serviceClient
        .from("assessment_attempts")
        .insert({
          user_id: context.user.id,
          assessment_id: assessment.id,
          product_id: assessment.product_id,
          module_id: assessment.module_id,
          attempt_number: attemptsUsed + 1,
          status: "in_progress",
          answers_payload: {},
          result_payload: {},
          started_at: new Date().toISOString(),
          last_saved_at: new Date().toISOString(),
        })
        .select("id,user_id,assessment_id,product_id,module_id,attempt_number,status,answers_payload,result_payload,auto_score_percent,final_score_percent,requires_manual_review,passed,started_at,last_saved_at,submitted_at,evaluated_at,created_at,updated_at")
        .single()

      if (createAttemptError) {
        throw createAttemptError
      }

      logInfo("Assessment attempt created", {
        request_id: requestId,
        user_id: context.user.id,
        assessment_id: assessment.id,
        attempt_id: createdAttempt.id,
      })

      return jsonResponse({
        ...buildAttemptResponse(assessment, createdAttempt as AttemptRow, attemptsUsed + 1, true),
        request_id: requestId,
      })
    }

    if (body.action === "save_draft") {
      const attemptId = requireText(body.attemptId, "attemptId")
      const attempt = await fetchAttemptOrThrow(context.serviceClient, context.user.id, attemptId)
      const assessment = await fetchAssessmentOrThrow(context.serviceClient, context.user.id, attempt.assessment_id)

      if (attempt.status !== "in_progress") {
        throw conflict("A tentativa ja foi submetida e nao aceita novo rascunho")
      }

      const answersPayload = normalizeAnswersPayload(body.answersPayload)

      const { data: updatedAttempt, error: updateError } = await context.serviceClient
        .from("assessment_attempts")
        .update({
          answers_payload: answersPayload,
          last_saved_at: new Date().toISOString(),
        })
        .eq("id", attempt.id)
        .select("id,user_id,assessment_id,product_id,module_id,attempt_number,status,answers_payload,result_payload,auto_score_percent,final_score_percent,requires_manual_review,passed,started_at,last_saved_at,submitted_at,evaluated_at,created_at,updated_at")
        .single()

      if (updateError) {
        throw updateError
      }

      const attemptsUsed = await countAttempts(context.serviceClient, context.user.id, assessment.id)

      return jsonResponse({
        ...buildAttemptResponse(assessment, updatedAttempt as AttemptRow, attemptsUsed, true),
        request_id: requestId,
      })
    }

    if (body.action === "submit") {
      const attemptId = requireText(body.attemptId, "attemptId")
      const attempt = await fetchAttemptOrThrow(context.serviceClient, context.user.id, attemptId)
      const assessment = await fetchAssessmentOrThrow(context.serviceClient, context.user.id, attempt.assessment_id)

      if (attempt.status !== "in_progress") {
        throw conflict("A tentativa ja foi submetida")
      }

      const answersPayload = normalizeAnswersPayload(body.answersPayload ?? attempt.answers_payload)
      const questions = normalizeQuestions(assessment.builder_payload)

      if (questions.length === 0) {
        throw badRequest("A avaliacao nao possui perguntas validas para submissao")
      }

      const questionResults = questions.map((question) => {
        const answer = answersPayload[question.id]
        const answerValues = Array.isArray(answer)
          ? answer.filter((value): value is string => typeof value === "string")
          : typeof answer === "string" && answer.trim()
            ? [answer]
            : []
        const correctValues = question.options.filter((option) => option.isCorrect).map((option) => option.value)
        const isAutoGradable = correctValues.length > 0
        const answered = answerValues.length > 0

        if (!isAutoGradable) {
          return {
            question_id: question.id,
            prompt: question.prompt,
            answered,
            correctness: answered ? "pending_review" : "unanswered",
            points: question.points,
            earned_points: null,
            answer: Array.isArray(answer) ? answerValues : answerValues[0] ?? null,
          }
        }

        const isCorrect =
          correctValues.length > 1
            ? sameAnswerSet(answerValues, correctValues)
            : answerValues[0] === correctValues[0]

        return {
          question_id: question.id,
          prompt: question.prompt,
          answered,
          correctness: isCorrect ? "correct" : answered ? "incorrect" : "unanswered",
          points: question.points,
          earned_points: isCorrect ? question.points : 0,
          answer: Array.isArray(answer) ? answerValues : answerValues[0] ?? null,
        }
      })

      const autoGradableResults = questionResults.filter((result) =>
        ["correct", "incorrect", "unanswered"].includes(result.correctness),
      )
      const manualReviewResults = questionResults.filter((result) => result.correctness === "pending_review")
      const correctCount = questionResults.filter((result) => result.correctness === "correct").length
      const answeredCount = questionResults.filter((result) => result.answered).length
      const autoScorePercent =
        autoGradableResults.length > 0
          ? Math.round((correctCount / autoGradableResults.length) * 100)
          : null
      const requiresManualReview = manualReviewResults.length > 0
      const finalStatus: AttemptStatus =
        requiresManualReview
          ? "pending_review"
          : (autoScorePercent ?? 0) >= assessment.passing_score
            ? "passed"
            : "failed"
      const finalScorePercent = requiresManualReview ? null : autoScorePercent
      const passed = requiresManualReview ? null : (finalScorePercent ?? 0) >= assessment.passing_score
      const submittedAt = new Date().toISOString()

      const { data: submittedAttempt, error: submitError } = await context.serviceClient
        .from("assessment_attempts")
        .update({
          status: finalStatus,
          answers_payload: answersPayload,
          result_payload: {
            summary: {
              total_questions: questions.length,
              answered_questions: answeredCount,
              auto_gradable_questions: autoGradableResults.length,
              manual_review_questions: manualReviewResults.length,
              correct_questions: correctCount,
              auto_score_percent: autoScorePercent,
            },
            questions: questionResults,
          },
          auto_score_percent: autoScorePercent,
          final_score_percent: finalScorePercent,
          requires_manual_review: requiresManualReview,
          passed,
          submitted_at: submittedAt,
          evaluated_at: requiresManualReview ? null : submittedAt,
          last_saved_at: submittedAt,
        })
        .eq("id", attempt.id)
        .select("id,user_id,assessment_id,product_id,module_id,attempt_number,status,answers_payload,result_payload,auto_score_percent,final_score_percent,requires_manual_review,passed,started_at,last_saved_at,submitted_at,evaluated_at,created_at,updated_at")
        .single()

      if (submitError) {
        throw submitError
      }

      const attemptsUsed = await countAttempts(context.serviceClient, context.user.id, assessment.id)
      const canStartNewAttempt =
        finalStatus !== "pending_review" &&
        (assessment.max_attempts === null || attemptsUsed < assessment.max_attempts)

      logInfo("Assessment attempt submitted", {
        request_id: requestId,
        user_id: context.user.id,
        assessment_id: assessment.id,
        attempt_id: submittedAttempt.id,
        status: finalStatus,
        auto_score_percent: autoScorePercent,
      })

      return jsonResponse({
        ...buildAttemptResponse(assessment, submittedAttempt as AttemptRow, attemptsUsed, canStartNewAttempt),
        request_id: requestId,
      })
    }

    throw badRequest("action invalida")
  } catch (error) {
    logError("Student assessment attempts failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
