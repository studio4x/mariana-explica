import { useMemo } from "react"
import { useParams } from "react-router-dom"
import { EmptyState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { normalizeAssessmentQuestions } from "@/lib/course-helpers"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"

const questionTypeLabels = {
  single_choice: "Multipla escolha",
  essay_ai: "Discursiva com IA",
  case_study_ai: "Estudo de caso",
  drag_drop: "Arrastar e soltar",
  fill_blank: "Preencher lacunas",
  hotspot: "Hotspot",
  unknown: "Pergunta estruturada",
} as const

export function CourseModuleAssessmentDetailPanel() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const { assessments, modules } = useAdminCourseBuilderContext()
  const assessment = useMemo(
    () => assessments.find((item) => item.id === assessmentId) ?? null,
    [assessmentId, assessments],
  )

  if (!assessment) {
    return <EmptyState title="Avaliacao nao encontrada" message="Esta avaliacao nao esta ligada ao curso atual." />
  }

  const module = assessment.module_id
    ? modules.find((item) => item.id === assessment.module_id) ?? null
    : null
  const questions = normalizeAssessmentQuestions(assessment.builder_payload)
  const payload = JSON.stringify(assessment.builder_payload ?? {}, null, 2)

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={assessment.title}
          description="Painel dedicado para a avaliacao ligada ao modulo, com foco em metadados e payload do builder."
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge label={assessment.assessment_type === "final" ? "Final" : "Modulo"} tone={assessment.assessment_type === "final" ? "success" : "warning"} />
          {module ? <StatusBadge label={module.title} tone="info" /> : null}
          <StatusBadge label={`Minimo ${assessment.passing_score}%`} tone="neutral" />
          <StatusBadge label={assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"} tone="warning" />
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-600">
          {assessment.description ?? "Avaliacao sem descricao curta."}
        </p>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Estrutura interpretada</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Leitura operacional do `builder_payload` para revisar quantidade de perguntas, tipos e gabaritos antes do player do aluno.
            </p>
          </div>
          <StatusBadge label={`${questions.length} pergunta(s)`} tone="info" />
        </div>

        {questions.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Sem perguntas reconhecidas"
              message="O payload bruto continua disponivel abaixo para diagnostico ou importacao manual."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {questions.map((question, index) => (
              <article key={question.id} className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Questao {index + 1}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">{question.prompt}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={questionTypeLabels[question.kind]} tone="neutral" />
                    {question.points !== null ? <StatusBadge label={`${question.points} pt`} tone="warning" /> : null}
                    {question.required ? <StatusBadge label="Obrigatoria" tone="info" /> : null}
                  </div>
                </div>

                {question.rubric ? (
                  <p className="mt-3 text-sm leading-7 text-slate-600">Rubrica: {question.rubric}</p>
                ) : null}

                {question.options.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {question.options.map((option) => (
                      <div key={option.id} className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{option.label}</span>
                          {option.isCorrect ? <StatusBadge label="Gabarito" tone="success" /> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Questao sem alternativas diretas. A correcao depende de rubrica, IA ou validacao manual.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <h2 className="font-display text-2xl font-bold text-slate-950">Payload atual do builder</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Este painel deixa a rota profunda do builder dedicada a avaliacao, sem depender do workspace legado de modulo.
        </p>
        <pre className="mt-5 overflow-auto rounded-[1.5rem] bg-slate-950 p-5 text-xs leading-6 text-slate-100">
          <code>{payload}</code>
        </pre>
      </section>
    </div>
  )
}
