import { Link, useOutletContext, useParams } from "react-router-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { OperationFeedbackModal, RichTextContent, StatusBadge } from "@/components/common"
import { useAuth } from "@/contexts/AuthContext"
import {
  useAccessibleAssessment,
  useAssessmentAttemptState,
  useSaveAssessmentAttemptDraft,
  useStartAssessmentAttempt,
  useSubmitAssessmentAttempt,
} from "@/hooks/useDashboard"
import {
  buildCoursePlayerEntries,
  calculateAssessmentDraftResult,
  normalizeAssessmentQuestions,
  type AssessmentDraftAnswerValue,
} from "@/lib/course-helpers"
import {
  studentCourseAssessmentPath,
  studentCourseLessonPath,
} from "@/lib/routes"
import type { StudentCoursePlayerContext } from "./StudentCoursePlayerLayout"
import type { AssessmentAttemptSummary } from "@/types/app.types"

const questionTypeLabels = {
  single_choice: "Multipla escolha",
  essay_ai: "Discursiva com IA",
  case_study_ai: "Estudo de caso",
  drag_drop: "Arrastar e soltar",
  fill_blank: "Preencher lacunas",
  hotspot: "Hotspot",
  unknown: "Pergunta estruturada",
} as const

function normalizeAttemptAnswers(value: Record<string, unknown> | undefined) {
  if (!value) return {} as Record<string, AssessmentDraftAnswerValue>

  const entries: Array<[string, AssessmentDraftAnswerValue]> = []

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") {
      entries.push([key, raw])
      continue
    }

    if (Array.isArray(raw)) {
      const values = raw.filter((item): item is string => typeof item === "string")
      entries.push([key, values])
    }
  }

  return Object.fromEntries(entries)
}

function getAttemptSummary(value: Record<string, unknown> | undefined) {
  if (!value || typeof value.summary !== "object" || !value.summary) return null
  return value.summary as Record<string, unknown>
}

export function StudentAssessmentExecutionPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const context = useOutletContext<StudentCoursePlayerContext>()
  const { isAdmin } = useAuth()
  const assessmentSummary = context.assessments.find((item) => item.id === assessmentId) ?? null
  const [answers, setAnswers] = useState<Record<string, AssessmentDraftAnswerValue>>({})
  const [previewRequested, setPreviewRequested] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitConfirmationOpen, setIsSubmitConfirmationOpen] = useState(false)
  const [submittedAttemptFeedback, setSubmittedAttemptFeedback] = useState<AssessmentAttemptSummary | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const assessmentQuery = useAccessibleAssessment(
    assessmentSummary && !assessmentSummary.is_locked ? assessmentSummary.id : undefined,
  )
  // Administrators use this route to preview course content. A preview must not
  // create or read a student attempt, which is intentionally protected by the
  // assessment access rules in the Edge Function.
  const attemptStateQuery = useAssessmentAttemptState(
    isAdmin ? undefined : assessmentQuery.data?.id,
  )
  const saveDraft = useSaveAssessmentAttemptDraft()
  const startAttempt = useStartAssessmentAttempt()
  const submitAttempt = useSubmitAssessmentAttempt()
  const hydratedAttemptIdRef = useRef<string | null>(null)
  const lastSavedSignatureRef = useRef<string>("{}")
  const isSubmittingRef = useRef(false)

  const assessment = assessmentQuery.data ?? null
  const module = assessment?.module_id
    ? context.modules.find((item) => item.id === assessment.module_id) ?? null
    : null
  const entries = buildCoursePlayerEntries(context.modules, context.lessons, context.assessments)
  const unlockedEntries = entries.filter((entry) => !entry.isLocked)
  const currentIndex = unlockedEntries.findIndex(
    (entry) => entry.type === "assessment" && entry.id === (assessment?.id ?? assessmentId),
  )
  const previousEntry = currentIndex > 0 ? unlockedEntries[currentIndex - 1] : null
  const nextEntry = currentIndex >= 0 ? unlockedEntries[currentIndex + 1] ?? null : null
  const questions = useMemo(
    () => normalizeAssessmentQuestions(assessment?.builder_payload ?? null),
    [assessment?.builder_payload],
  )
  const draftResult = useMemo(
    () => calculateAssessmentDraftResult(questions, answers),
    [answers, questions],
  )
  const officialState = attemptStateQuery.data ?? null
  const officialAttempt = officialState?.attempt ?? null
  const attemptLocked = isAdmin ? false : officialAttempt ? officialAttempt.status !== "in_progress" : true
  const shouldShowAnswerFeedback = !isAdmin && officialAttempt?.status !== "in_progress"
  const officialSummary = getAttemptSummary(officialAttempt?.result_payload)

  useEffect(() => {
    if (!officialAttempt) return
    if (hydratedAttemptIdRef.current === officialAttempt.id) return

    const normalizedAnswers = normalizeAttemptAnswers(officialAttempt.answers_payload)
    setAnswers(normalizedAnswers)
    lastSavedSignatureRef.current = JSON.stringify(normalizedAnswers)
    hydratedAttemptIdRef.current = officialAttempt.id
    setPreviewRequested(Boolean(officialAttempt.submitted_at))
    setAutosaveStatus(officialAttempt.status === "in_progress" ? "saved" : "idle")
  }, [officialAttempt])

  const answersSignature = useMemo(() => JSON.stringify(answers), [answers])

  useEffect(() => {
    if (!officialAttempt || officialAttempt.status !== "in_progress") return
    if (isSubmitting) return
    if (hydratedAttemptIdRef.current !== officialAttempt.id) return
    if (answersSignature === lastSavedSignatureRef.current) return

    const timeout = window.setTimeout(() => {
      setAutosaveStatus("saving")
      void saveDraft
        .mutateAsync({
          attemptId: officialAttempt.id,
          answersPayload: answers,
        })
        .then(() => {
          lastSavedSignatureRef.current = answersSignature
          setAutosaveStatus("saved")
        })
        .catch(() => {
          if (!isSubmittingRef.current) {
            setAutosaveStatus("error")
          }
        })
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [answers, answersSignature, isSubmitting, officialAttempt, saveDraft])

  if (!assessmentSummary) {
    return (
      <EmptyState
        title="Avaliação não encontrada"
        message="A avaliação pedida não esta disponível nesta trilha."
      />
    )
  }

  if (assessmentSummary.is_locked) {
    return (
      <EmptyState
        title="Avaliação bloqueada"
        message={assessmentSummary.lock_reason ?? "Conclui os requisitos anteriores para libertar esta avaliação."}
      />
    )
  }

  if (assessmentQuery.isLoading) {
    return <LoadingState message="A preparar a avaliação..." />
  }

  if (assessmentQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível abrir esta avaliação"
        message={
          assessmentQuery.error instanceof Error
            ? assessmentQuery.error.message
            : "Tenta novamente dentro de instantes."
        }
        onRetry={() => void assessmentQuery.refetch()}
      />
    )
  }

  if (!assessment) {
    return (
      <EmptyState
        title="Conteúdo indisponivel"
        message="Não foi possível carregar o conteúdo completo desta avaliação. Tenta novamente dentro de instantes."
      />
    )
  }

  const updateSingleAnswer = (questionId: string, value: string) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }))
  }

  const updateMultiAnswer = (questionId: string, value: string, checked: boolean) => {
    setAnswers((current) => {
      const currentValues = Array.isArray(current[questionId]) ? current[questionId] : []
      const nextValues = checked
        ? [...currentValues, value]
        : currentValues.filter((item) => item !== value)

      return {
        ...current,
        [questionId]: nextValues,
      }
    })
  }

  const handleSubmitOfficialAttempt = async () => {
    if (!officialAttempt) return

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setSubmissionError(null)
    try {
      const response = await submitAttempt.mutateAsync({
        attemptId: officialAttempt.id,
        answersPayload: answers,
      })
      setPreviewRequested(true)
      await attemptStateQuery.refetch()
      setIsSubmitConfirmationOpen(false)
      setSubmittedAttemptFeedback(response.attempt)
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Não foi possível submeter a avaliação. Tenta novamente.",
      )
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleStartOfficialAttempt = async () => {
    if (!assessment) return

    await startAttempt.mutateAsync(assessment.id)
    await attemptStateQuery.refetch()
    isSubmittingRef.current = false
    setIsSubmitting(false)
  }

  const submittedScore =
    submittedAttemptFeedback?.final_score_percent ?? submittedAttemptFeedback?.auto_score_percent ?? null
  const submittedResultTitle =
    submittedAttemptFeedback?.status === "submitted"
      ? "Quiz concluído"
      : submittedAttemptFeedback?.status === "passed"
      ? "Avaliação aprovada"
      : submittedAttemptFeedback?.status === "failed"
        ? "Avaliação concluída"
        : "Avaliação em revisão"
  const submittedResultMessage =
    submittedAttemptFeedback?.status === "submitted"
      ? "A tua submissão foi registada. Consulta a tua percentagem e o gabarito abaixo."
      : submittedAttemptFeedback?.status === "passed"
      ? "Parabéns! A tua submissão foi registada com sucesso."
      : submittedAttemptFeedback?.status === "failed"
        ? "A tua submissão foi registada. Podes consultar o resultado abaixo e tentar novamente, se estiver disponível."
        : "A tua submissão foi registada e será revista antes de o resultado final ficar disponível."

  return (
    <div className="flex flex-col gap-6">
      <section className="order-1 rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {assessment.assessment_type === "final" ? "Avaliação final" : module?.title ?? "Quiz de módulo"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950">{assessment.title}</h1>
            <RichTextContent
              value={assessment.description}
              fallback="Avaliação disponível neste material."
              className="mt-3 max-w-3xl text-sm leading-8 text-slate-600"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={assessment.assessment_type === "final" ? "Final" : "Módulo"} tone={assessment.assessment_type === "final" ? "success" : "warning"} />
            <StatusBadge label={`Mínimo ${assessment.passing_score}%`} tone="info" />
            <StatusBadge label={assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"} tone="neutral" />
          </div>
        </div>

      </section>

      {!isAdmin ? (
        <section className="order-3 rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">A tua avaliação</h2>
            <p className="mt-1 text-sm text-slate-600">
              Responde às perguntas e submete a avaliação quando terminares.
            </p>
          </div>
          {officialState ? (
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={
                  officialAttempt
                    ? `Tentativa ${officialAttempt.attempt_number}`
                    : "Avaliação em preparação"
                }
                tone="neutral"
              />
              <StatusBadge
                label={
                  officialState.remaining_attempts === null
                    ? "Tentativas livres"
                    : `${officialState.remaining_attempts} restantes`
                }
                tone="info"
              />
            </div>
          ) : null}
        </div>

        {attemptStateQuery.isLoading ? (
          <div className="mt-6">
            <LoadingState message="A preparar a avaliação..." />
          </div>
        ) : attemptStateQuery.isError ? (
          <div className="mt-6">
            <ErrorState
              title="Não foi possível preparar a avaliação"
              message={
                attemptStateQuery.error instanceof Error
                  ? attemptStateQuery.error.message
                  : "Tenta novamente dentro de instantes."
              }
              onRetry={() => void attemptStateQuery.refetch()}
            />
          </div>
        ) : officialAttempt ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Estado da avaliação</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {officialAttempt.status === "submitted"
                    ? "Concluída"
                    : officialAttempt.status === "in_progress"
                    ? "Em andamento"
                    : officialAttempt.status === "passed"
                      ? "Aprovada"
                      : officialAttempt.status === "failed"
                        ? "Reprovada"
                        : officialAttempt.status === "pending_review"
                          ? "Em revisão"
                          : "Submetida"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Resultado</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {officialAttempt.final_score_percent !== null
                    ? `${officialAttempt.final_score_percent}%`
                    : officialAttempt.auto_score_percent !== null
                      ? `${officialAttempt.auto_score_percent}%`
                      : "--"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Respostas</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {autosaveStatus === "saving"
                    ? "A guardar"
                    : autosaveStatus === "error"
                      ? "Falhou"
                      : "Guardadas"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Entrega</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {officialAttempt.submitted_at ? "Enviada" : "Pendente"}
                </p>
              </div>
            </div>

            {submitAttempt.isError ? (
              <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitAttempt.error instanceof Error
                  ? submitAttempt.error.message
                  : "Não foi possível submeter a avaliação."}
              </div>
            ) : null}

            {officialAttempt.status === "in_progress" ? (
              <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">
                As tuas respostas são guardadas automaticamente enquanto respondes.
              </div>
            ) : null}

            {officialAttempt.status === "pending_review" ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
                Esta avaliação será revista antes de o resultado ficar disponível.
              </div>
            ) : null}

            {officialSummary ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.5rem] border bg-white p-4">
                  <p className="text-sm text-slate-500">Respondidas</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {String(officialSummary.answered_questions ?? "--")}/{String(officialSummary.total_questions ?? "--")}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border bg-white p-4">
                  <p className="text-sm text-slate-500">Correção automática</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {String(officialSummary.auto_gradable_questions ?? "--")}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border bg-white p-4">
                  <p className="text-sm text-slate-500">Em revisão</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {String(officialSummary.manual_review_questions ?? "--")}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border bg-white p-4">
                  <p className="text-sm text-slate-500">Corretas</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {String(officialSummary.correct_questions ?? "--")}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {officialAttempt.status === "in_progress" ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => setIsSubmitConfirmationOpen(true)}
                  disabled={submitAttempt.isPending}
                >
                  {submitAttempt.isPending ? "A submeter..." : "Submeter avaliação"}
                </Button>
              ) : null}
              {!officialState?.can_start_new_attempt && officialAttempt.status !== "in_progress" ? (
                <StatusBadge label="Limite de tentativas atingido" tone="warning" />
              ) : null}
              {officialAttempt.status !== "in_progress" && officialState?.can_start_new_attempt ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void handleStartOfficialAttempt()}
                  disabled={startAttempt.isPending}
                >
                  {startAttempt.isPending ? "A preparar..." : "Iniciar nova tentativa"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="Avaliação indisponível"
              message="Não foi possível preparar esta avaliação. Tenta novamente dentro de instantes."
            />
          </div>
        )}
        </section>
      ) : null}

      <section className="order-2 rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Perguntas da avaliação</h2>
            <p className="mt-1 text-sm text-slate-600">
              Responde às perguntas abaixo e, quando terminares, submete a avaliação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`${questions.length} pergunta(s)`} tone="info" />
            {draftResult.autoGradableCount > 0 ? (
            <StatusBadge label={`${draftResult.autoGradableCount} com correção automática`} tone="warning" />
            ) : null}
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Sem estrutura de perguntas"
              message="Esta avaliação ainda não tem perguntas disponíveis."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {questions.map((question, index) => {
              const currentAnswer = answers[question.id]
              const correctOptions = question.options.filter((option) => option.isCorrect)
              const allowsMultiple = correctOptions.length > 1

              return (
                <article key={question.id} className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Questao {index + 1}</p>
                      <RichTextContent value={question.prompt} className="mt-2 text-lg font-semibold text-slate-950" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={questionTypeLabels[question.kind]} tone="neutral" />
                      {question.points !== null ? <StatusBadge label={`${question.points} pt`} tone="info" /> : null}
                      {question.required ? <StatusBadge label="Obrigatória" tone="warning" /> : null}
                    </div>
                  </div>

                  {question.title && question.title !== question.prompt ? (
                    <RichTextContent value={question.title} className="mt-3 text-sm text-slate-600" />
                  ) : null}

                  {question.options.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {question.options.map((option) => {
                        const checked = Array.isArray(currentAnswer)
                          ? currentAnswer.includes(option.value)
                          : currentAnswer === option.value
                        const isIncorrectSelection = checked && !option.isCorrect
                        const optionClassName = shouldShowAnswerFeedback
                          ? option.isCorrect
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                            : isIncorrectSelection
                              ? "border-rose-500 bg-rose-50 text-rose-950"
                              : "border-slate-200 bg-white text-slate-700"
                          : checked
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"

                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${optionClassName}`}
                          >
                            <input
                              type={allowsMultiple ? "checkbox" : "radio"}
                              name={question.id}
                              value={option.value}
                              checked={checked}
                              disabled={attemptLocked}
                              onChange={(event) =>
                                allowsMultiple
                                  ? updateMultiAnswer(question.id, option.value, event.target.checked)
                                  : updateSingleAnswer(question.id, option.value)
                              }
                              className="mt-1"
                            />
                            <span className="flex-1">{option.label}</span>
                            {shouldShowAnswerFeedback && option.isCorrect ? (
                              <span className="font-semibold text-emerald-700">Resposta correta</span>
                            ) : null}
                            {shouldShowAnswerFeedback && isIncorrectSelection ? (
                              <span className="font-semibold text-rose-700">Resposta incorreta</span>
                            ) : null}
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={Array.isArray(currentAnswer) ? currentAnswer.join("\n") : String(currentAnswer ?? "")}
                      disabled={attemptLocked}
                      onChange={(event) => updateSingleAnswer(question.id, event.target.value)}
                      rows={question.kind === "case_study_ai" ? 8 : 5}
                      placeholder="Escreve a tua resposta aqui"
                      className="mt-4 w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  )}

                  {question.rubric ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Rubrica</p>
                      <RichTextContent value={question.rubric} className="mt-1 leading-7" />
                    </div>
                  ) : null}

                  {previewRequested && question.feedback ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Feedback</p>
                      <RichTextContent value={question.feedback} className="mt-1 leading-7" />
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {questions.length > 0 ? (
        <section className="order-4 rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Resumo das respostas</h2>
              <p className="mt-1 text-sm text-slate-600">
                Consulta uma estimativa com base nas respostas que selecionaste.
              </p>
            </div>
            <Button type="button" className="rounded-full" onClick={() => setPreviewRequested(true)}>
              Ver estimativa
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-[1.5rem] border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Respondidas</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {draftResult.answeredCount}/{draftResult.totalQuestions}
              </p>
            </div>
            <div className="rounded-[1.5rem] border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Correção automática</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{draftResult.autoGradableCount}</p>
            </div>
            <div className="rounded-[1.5rem] border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Revisão manual</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{draftResult.manualReviewCount}</p>
            </div>
            <div className="rounded-[1.5rem] border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Resultado estimado</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {previewRequested && draftResult.scorePercent !== null ? `${draftResult.scorePercent}%` : "--"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            Perguntas de resposta aberta podem precisar de revisão antes de o resultado ficar disponível.
          </p>
        </section>
      ) : null}

      <section className="order-5 rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Navegação pelo material</h2>
            <p className="mt-1 text-sm text-slate-600">Segue para o item anterior ou continua para a proxima etapa.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {previousEntry ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link
                  to={
                    previousEntry.type === "lesson"
                      ? studentCourseLessonPath(context.courseId, previousEntry.id)
                      : studentCourseAssessmentPath(context.courseId, previousEntry.id)
                  }
                >
                  Anterior
                </Link>
              </Button>
            ) : null}
            {nextEntry ? (
              <Button asChild className="rounded-full">
                <Link
                  to={
                    nextEntry.type === "lesson"
                      ? studentCourseLessonPath(context.courseId, nextEntry.id)
                      : studentCourseAssessmentPath(context.courseId, nextEntry.id)
                  }
                >
                  Próximo
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <OperationFeedbackModal
        open={isSubmitConfirmationOpen}
        tone="info"
        title="Submeter avaliação?"
        message="Depois de submeteres, não poderás alterar as respostas desta tentativa."
        confirmLabel="Submeter avaliação"
        isConfirming={submitAttempt.isPending}
        onClose={() => {
          setIsSubmitConfirmationOpen(false)
          setSubmissionError(null)
        }}
        onConfirm={() => void handleSubmitOfficialAttempt()}
      >
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Respondeste a <strong>{draftResult.answeredCount}</strong> de <strong>{draftResult.totalQuestions}</strong> pergunta(s).
        </div>
        {submissionError ? <p className="mt-3 text-sm font-medium text-rose-700">{submissionError}</p> : null}
      </OperationFeedbackModal>

      <OperationFeedbackModal
        open={Boolean(submittedAttemptFeedback)}
        tone={
          submittedAttemptFeedback?.status === "failed"
            ? "error"
            : submittedAttemptFeedback?.status === "pending_review"
              ? "info"
              : "success"
        }
        title={submittedResultTitle}
        message={submittedResultMessage}
        confirmLabel="Ver avaliação"
        onClose={() => setSubmittedAttemptFeedback(null)}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {submittedScore === null ? "Em revisão" : `${submittedScore}%`}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
            <p className="mt-1 text-sm font-bold text-slate-950">
              {submittedAttemptFeedback?.status === "submitted"
                ? "Concluída"
                : submittedAttemptFeedback?.status === "passed"
                ? "Aprovada"
                : submittedAttemptFeedback?.status === "failed"
                  ? "Não aprovada"
                  : "Em revisão"}
            </p>
          </div>
        </div>
      </OperationFeedbackModal>
    </div>
  )
}
