import { useState } from "react"
import { useParams } from "react-router-dom"
import { EmptyState } from "@/components/feedback"
import { OperationFeedbackModal, PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useCreateAdminProductAssessment } from "@/hooks/useAdmin"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"
import { AssessmentBuilderWorkspace } from "./AssessmentBuilderWorkspace"

export function CourseFinalAssessmentDetailPanel() {
  const { courseId } = useParams<{ courseId: string }>()
  const { assessments, modules } = useAdminCourseBuilderContext()
  const createAssessment = useCreateAdminProductAssessment()
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const finalAssessment = assessments.find((item) => item.assessment_type === "final") ?? null

  if (!courseId) {
    return <EmptyState title="Material inválido" message="Abra um material válido para editar a avaliação final." />
  }

  const handleCreateFinalAssessment = async () => {
    setFeedback(null)

    try {
      await createAssessment.mutateAsync({
        productId: courseId,
        moduleId: null,
        assessmentType: "final",
        title: "Avaliação final",
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 20,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Não foi possível criar a avaliação final.",
      })
      return
    }

    setFeedback({ tone: "success", message: "Avaliação final criada com sucesso." })
  }

  if (!finalAssessment) {
    return (
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Avaliação Final"
          description="A rota profunda da prova final deve abrir o builder real. Crie a avaliação e continue no mesmo workspace."
        />

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <p className="text-sm leading-7 text-slate-600">
            Ainda não existe avaliação final para este material. O fluxo oficial do builder pede uma prova final Única,
            editavel nesta rota dedicada.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              className="rounded-full"
              disabled={createAssessment.isPending}
              onClick={() => void handleCreateFinalAssessment()}
            >
              {createAssessment.isPending ? "A criar avaliação final..." : "Criar avaliação final"}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={finalAssessment.title}
          description="Workspace profundo da avaliação final do material, separado do hub agregador de quizzes."
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge label="Final" tone="success" />
          <StatusBadge label={`Mínimo ${finalAssessment.passing_score}%`} tone="neutral" />
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

      <OperationFeedbackModal
        open={Boolean(feedback)}
        tone={feedback?.tone ?? "success"}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />
    </div>
  )
}
