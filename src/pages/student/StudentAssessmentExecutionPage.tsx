import { Link, useOutletContext, useParams } from "react-router-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
import {
  useAccessibleAssessment,
  useAssessmentAttemptState,
  useSaveAssessmentAttemptDraft,
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
  const assessmentSummary = context.assessments.find((item) => item.id === assessmentId) ?? null
  const [answers, setAnswers] = useState<Record<string, AssessmentDraftAnswerValue>>({})
  const [previewRequested, setPreviewRequested] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const assessmentQuery = useAccessibleAssessment(
    assessmentSummary && !assessmentSummary.is_locked ? assessmentSummary.id : undefined,
  )
  const attemptStateQuery = useAssessmentAttemptState(assessmentQuery.data?.id)
  const saveDraft = useSaveAssessmentAttemptDraft()
  const submitAttempt = useSubmitAssessmentAttempt()
  const hydratedAttemptIdRef = useRef<string | null>(null)
  const lastSavedSignatureRef = useRef<string>("{}")

  if (!assessmentSummary) {
    return (
      <EmptyState
        title="Avaliacao nao encontrada"
        message="A avaliacao pedida nao esta disponivel nesta trilha."
      />
    )
  }

  if (assessmentSummary.is_locked) {
    return (
      <EmptyState
        title="Avaliacao bloqueada"
        message={assessmentSummary.lock_reason ?? "Conclui os requisitos anteriores para libertar esta avaliacao."}
      />
    )
  }

  if (assessmentQuery.isLoading) {
    return <LoadingState message="A preparar a avaliacao..." />
  }

  if (assessmentQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel abrir esta avaliacao"
        message={
          assessmentQuery.error instanceof Error
            ? assessmentQuery.error.message
            : "Tenta novamente dentro de instantes."
        }
        onRetry={() => void assessmentQuery.refetch()}
      />
    )
  }

  const assessment = assessmentQuery.data

  if (!assessment) {
    return (
      <EmptyState
        title="Conteudo indisponivel"
        message="O backend nao libertou o payload completo desta avaliacao para a tua sessao."
      />
    )
  }

  const module = assessment.module_id
    ? context.modules.find((item) => item.id === assessment.module_id) ?? null
    : null
  const entries = buildCoursePlayerEntries(context.modules, context.lessons, context.assessments)
  const unlockedEntries = entries.filter((entry) => !entry.isLocked)
  const currentIndex = unlockedEntries.findIndex((entry) => entry.type === "assessment" && entry.id === assessment.id)
  const previousEntry = currentIndex > 0 ? unlockedEntries[currentIndex - 1] : null
  const nextEntry = currentIndex >= 0 ? unlockedEntries[currentIndex + 1] ?? null : null
  const questions = useMemo(
    () => normalizeAssessmentQuestions(assessment.builder_payload),
    [assessment.builder_payload],
  )
  const draftResult = useMemo(
    () => calculateAssessmentDraftResult(questions, answers),
    [answers, questions],
  )
  const officialState = attemptStateQuery.data ?? null
  const officialAttempt = officialState?.attempt ?? null
  const attemptLocked = officialAttempt ? officialAttempt.status !== "in_progress" : true
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
          setAutosaveStatus("error")
        })
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [answers, answersSignature, officialAttempt, saveDraft])

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

    try {
      await submitAttempt.mutateAsync({
        attemptId: officialAttempt.id,
        answersPayload: answers,
      })
      setPreviewRequested(true)
      await attemptStateQuery.refetch()
    } catch {
      // The mutation already surfaces the backend error via its status and we show a generic message below.
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {assessment.assessment_type === "final" ? "Avaliacao final" : module?.title ?? "Quiz de modulo"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950">{assessment.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">
              {assessment.description ?? "Avaliacao ligada ao curso, com score validado no backend."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={assessment.assessment_type === "final" ? "Final" : "Modulo"} tone={assessment.assessment_type === "final" ? "success" : "warning"} />
            <StatusBadge label={`Minimo ${assessment.passing_score}%`} tone="info" />
            <StatusBadge label={assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"} tone="neutral" />
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-700" />
            <p className="font-semibold text-slate-950">Execucao da avaliacao</p>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Esta tela consome o `builder_payload` para renderizar as perguntas no player e usa tentativa oficial no backend para preservar tentativas, score e validacao segura.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            O resultado local abaixo funciona apenas como apoio visual do player. A tentativa oficial continua a ser persistida, validada e decidida pelo backend.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Tentativa oficial</h2>
            <p className="mt-1 text-sm text-slate-600">
              O backend controla inicio, persistencia, limite de tentativas e resultado oficial desta avaliacao.
            </p>
          </div>
          {officialState ? (
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={
                  officialAttempt
                    ? `Tentativa ${officialAttempt.attempt_number}`
                    : "Sem tentativa oficial"
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
            <LoadingState message="A preparar a tentativa oficial..." />
          </div>
        ) : attemptStateQuery.isError ? (
          <div className="mt-6">
            <ErrorState
              title="Nao foi possivel abrir a tentativa"
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
                <p className="text-sm text-slate-500">Estado oficial</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {officialAttempt.status === "in_progress"
                    ? "Em andamento"
                    : officialAttempt.status === "passed"
                      ? "Aprovada"
                      : officialAttempt.status === "failed"
                        ? "Reprovada"
                        : officialAttempt.status === "pending_review"
                          ? "Em revisao"
                          : "Submetida"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Score oficial</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {officialAttempt.final_score_percent !== null
                    ? `${officialAttempt.final_score_percent}%`
                    : officialAttempt.auto_score_percent !== null
                      ? `${officialAttempt.auto_score_percent}% auto`
                      : "--"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Guardado</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {autosaveStatus === "saving"
                    ? "A guardar"
                    : autosaveStatus === "error"
                      ? "Falhou"
                      : "Sincronizado"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Submissao</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {officialAttempt.submitted_at ? "Enviada" : "Pendente"}
                </p>
              </div>
            </div>

            {submitAttempt.isError ? (
              <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitAttempt.error instanceof Error
                  ? submitAttempt.error.message
                  : "Nao foi possivel submeter a tentativa oficial."}
              </div>
            ) : null}

            {officialAttempt.status === "in_progress" ? (
              <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">
                O rascunho desta tentativa esta a ser persistido automaticamente no backend enquanto respondes.
              </div>
            ) : null}

            {officialAttempt.status === "pending_review" ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
                Esta tentativa entrou em revisao oficial porque existem respostas discursivas ou blocos que nao podem ser corrigidos apenas por gabarito automatico.
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
                  <p className="text-sm text-slate-500">Autoavaliaveis</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {String(officialSummary.auto_gradable_questions ?? "--")}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border bg-white p-4">
                  <p className="text-sm text-slate-500">Em revisao</p>
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
                  onClick={() => void handleSubmitOfficialAttempt()}
                  disabled={submitAttempt.isPending}
                >
                  {submitAttempt.isPending ? "A submeter..." : "Submeter tentativa oficial"}
                </Button>
              ) : null}
              {!officialState?.can_start_new_attempt && officialAttempt.status !== "in_progress" ? (
                <StatusBadge label="Limite de tentativas atingido" tone="warning" />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="Tentativa indisponivel"
              message="Nao foi possivel abrir uma tentativa oficial para esta avaliacao."
            />
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Perguntas da avaliacao</h2>
            <p className="mt-1 text-sm text-slate-600">
              O player mostra a estrutura configurada pelo builder e recolhe respostas localmente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`${questions.length} pergunta(s)`} tone="info" />
            {draftResult.autoGradableCount > 0 ? (
              <StatusBadge label={`${draftResult.autoGradableCount} autoavaliaveis`} tone="warning" />
            ) : null}
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Sem estrutura de perguntas"
              message="O builder desta avaliacao ainda nao publicou um payload de questoes reconhecivel pelo player."
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
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">{question.prompt}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={questionTypeLabels[question.kind]} tone="neutral" />
                      {question.points !== null ? <StatusBadge label={`${question.points} pt`} tone="info" /> : null}
                      {question.required ? <StatusBadge label="Obrigatoria" tone="warning" /> : null}
                    </div>
                  </div>

                  {question.title && question.title !== question.prompt ? (
                    <p className="mt-3 text-sm text-slate-600">{question.title}</p>
                  ) : null}

                  {question.options.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {question.options.map((option) => {
                        const checked = Array.isArray(currentAnswer)
                          ? currentAnswer.includes(option.value)
                          : currentAnswer === option.value

                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              checked
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            }`}
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
                            <span>{option.label}</span>
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
                      <p className="mt-1 leading-7">{question.rubric}</p>
                    </div>
                  ) : null}

                  {previewRequested && question.feedback ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">Feedback do gabarito</p>
                      <p className="mt-1 leading-7">{question.feedback}</p>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {questions.length > 0 ? (
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Resultado local do rascunho</h2>
              <p className="mt-1 text-sm text-slate-600">
                Esta leitura ajuda no fluxo do player, mas a nota oficial continua reservada ao backend.
              </p>
            </div>
            <Button type="button" className="rounded-full" onClick={() => setPreviewRequested(true)}>
              Corrigir rascunho
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
              <p className="text-sm text-slate-500">Autoavaliaveis</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{draftResult.autoGradableCount}</p>
            </div>
            <div className="rounded-[1.5rem] border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Revisao manual</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{draftResult.manualReviewCount}</p>
            </div>
            <div className="rounded-[1.5rem] border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Score local</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {previewRequested && draftResult.scorePercent !== null ? `${draftResult.scorePercent}%` : "--"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            Questoes discursivas, estudos de caso e outros formatos sem gabarito direto ficam marcados para revisao manual e nao entram no score local.
          </p>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Navegacao do player</h2>
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
                  Proximo
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
