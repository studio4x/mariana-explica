import { useMemo } from "react"
import { useParams } from "react-router-dom"
import { EmptyState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"
import { AssessmentBuilderWorkspace } from "./AssessmentBuilderWorkspace"

export function CourseModuleAssessmentDetailPanel() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>()
  const { assessments, modules } = useAdminCourseBuilderContext()
  const assessment = useMemo(
    () => assessments.find((item) => item.id === assessmentId) ?? null,
    [assessmentId, assessments],
  )

  if (!assessment || !courseId) {
    return <EmptyState title="Avaliacao nao encontrada" message="Esta avaliacao nao esta ligada ao curso atual." />
  }

  const module = assessment.module_id
    ? modules.find((item) => item.id === assessment.module_id) ?? null
    : null

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={assessment.title}
          description="Rota profunda do builder para editar quiz de modulo com o mesmo backend do painel geral."
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge
            label={assessment.assessment_type === "final" ? "Final" : "Modulo"}
            tone={assessment.assessment_type === "final" ? "success" : "warning"}
          />
          {module ? <StatusBadge label={module.title} tone="info" /> : null}
          <StatusBadge label={`Minimo ${assessment.passing_score}%`} tone="neutral" />
          <StatusBadge
            label={assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"}
            tone="warning"
          />
        </div>
      </section>

      <AssessmentBuilderWorkspace productId={courseId} assessment={assessment} modules={modules} />
    </div>
  )
}
