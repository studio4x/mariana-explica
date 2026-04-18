import { PageHeader, StatusBadge } from "@/components/common"
import { EmptyState } from "@/components/feedback"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"

export function CourseAssessmentsPanel() {
  const { assessments, modules } = useAdminCourseBuilderContext()
  const finalAssessments = assessments.filter((assessment) => assessment.assessment_type === "final")
  const moduleAssessments = assessments.filter((assessment) => assessment.assessment_type === "module")

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avaliacoes totais</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{assessments.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Quizzes de modulo</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{moduleAssessments.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Finais</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{finalAssessments.length}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Resumo de avaliacoes"
          description="Visao organizada entre quizzes por modulo e prova final do curso."
        />

        {assessments.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Sem avaliacoes mapeadas"
              message="Quando os quizzes forem criados no backend, o resumo aparece aqui."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {assessments.map((assessment) => {
              const module = assessment.module_id
                ? modules.find((item) => item.id === assessment.module_id) ?? null
                : null

              return (
                <div key={assessment.id} className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{assessment.title}</p>
                    <StatusBadge
                      label={assessment.assessment_type === "final" ? "Final" : "Modulo"}
                      tone={assessment.assessment_type === "final" ? "success" : "warning"}
                    />
                    {assessment.is_required ? <StatusBadge label="Obrigatoria" tone="info" /> : null}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {assessment.description ?? "Avaliacao sem descricao curta."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {module ? <StatusBadge label={module.title} tone="neutral" /> : null}
                    <StatusBadge label={`Minimo ${assessment.passing_score}%`} tone="info" />
                    <StatusBadge label={assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"} tone="neutral" />
                    <StatusBadge label={`${assessment.estimated_minutes} min`} tone="warning" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
