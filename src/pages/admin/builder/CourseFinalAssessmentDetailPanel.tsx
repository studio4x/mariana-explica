import { useState } from "react"
import { useParams } from "react-router-dom"
import { EmptyState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useCreateAdminProductAssessment } from "@/hooks/useAdmin"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"
import { AssessmentBuilderWorkspace } from "./AssessmentBuilderWorkspace"

export function CourseFinalAssessmentDetailPanel() {
  const { courseId } = useParams<{ courseId: string }>()
  const { assessments, modules } = useAdminCourseBuilderContext()
  const createAssessment = useCreateAdminProductAssessment()
  const [error, setError] = useState<string | null>(null)
  const finalAssessment = assessments.find((item) => item.assessment_type === "final") ?? null

  if (!courseId) {
    return <EmptyState title="Material invalido" message="Abra um material valido para editar a avaliacao final." />
  }

  const handleCreateFinalAssessment = async () => {
    setError(null)

    try {
      await createAssessment.mutateAsync({
        productId: courseId,
        moduleId: null,
        assessmentType: "final",
        title: "Avaliacao final",
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 20,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Nao foi possivel criar a avaliacao final.",
      )
    }
  }

  if (!finalAssessment) {
    return (
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Avaliacao Final"
          description="A rota profunda da prova final deve abrir o builder real. Crie a avaliacao e continue no mesmo workspace."
        />

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <p className="text-sm leading-7 text-slate-600">
            Ainda nao existe avaliacao final para este material. O fluxo oficial do builder pede uma prova final unica,
            editavel nesta rota dedicada.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              className="rounded-full"
              disabled={createAssessment.isPending}
              onClick={() => void handleCreateFinalAssessment()}
            >
              {createAssessment.isPending ? "A criar avaliacao final..." : "Criar avaliacao final"}
            </Button>
          </div>
          {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={finalAssessment.title}
          description="Workspace profundo da avaliacao final do material, separado do hub agregador de quizzes."
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge label="Final" tone="success" />
          <StatusBadge label={`Minimo ${finalAssessment.passing_score}%`} tone="neutral" />
          <StatusBadge
            label={
              finalAssessment.max_attempts
                ? `${finalAssessment.max_attempts} tentativa(s)`
                : "Sem limite"
            }
            tone="warning"
          />
          <StatusBadge
            label={finalAssessment.is_active ? "Ativa" : "Inativa"}
            tone={finalAssessment.is_active ? "success" : "neutral"}
          />
        </div>
      </section>

      <AssessmentBuilderWorkspace
        productId={courseId}
        assessment={finalAssessment}
        modules={modules}
      />
    </div>
  )
}
