import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader, StatusBadge } from "@/components/common"
import { EmptyState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  useCreateAdminProductAssessment,
  useDeleteAdminProductAssessment,
  useUpdateAdminProductAssessment,
} from "@/hooks/useAdmin"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import { adminCourseModuleAssessmentPath } from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"
import { AssessmentBuilderWorkspace } from "./AssessmentBuilderWorkspace"

function downloadAssessmentJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function CourseAssessmentsPanel() {
  const { courseId, product, assessments, modules } = useAdminCourseBuilderContext()
  const createAssessment = useCreateAdminProductAssessment()
  const updateAssessment = useUpdateAdminProductAssessment()
  const deleteAssessment = useDeleteAdminProductAssessment()
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState<{
    title: string
    assessmentType: "module" | "final"
    moduleId: string
  }>({
    title: "",
    assessmentType: "module",
    moduleId: "",
  })
  const [importJson, setImportJson] = useState("")
  const [importMode, setImportMode] = useState<"create" | "update">("create")

  const finalAssessments = assessments.filter((assessment) => assessment.assessment_type === "final")
  const moduleAssessments = assessments.filter((assessment) => assessment.assessment_type === "module")
  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId],
  )

  useEffect(() => {
    if (!selectedAssessmentId && assessments[0]) {
      setSelectedAssessmentId(assessments[0].id)
      return
    }

    if (selectedAssessmentId && !assessments.some((assessment) => assessment.id === selectedAssessmentId)) {
      setSelectedAssessmentId(assessments[0]?.id ?? null)
    }
  }, [assessments, selectedAssessmentId])

  const handleCreateAssessment = async () => {
    setError(null)

    try {
      const created = await createAssessment.mutateAsync({
        productId: courseId,
        moduleId: createDraft.assessmentType === "module" ? createDraft.moduleId || null : null,
        assessmentType: createDraft.assessmentType,
        title:
          createDraft.title.trim() ||
          (createDraft.assessmentType === "final" ? "Avaliacao final" : "Novo quiz de modulo"),
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 15,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })

      setCreateDraft({ title: "", assessmentType: "module", moduleId: "" })
      setSelectedAssessmentId(created.id)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel criar a avaliacao.")
    }
  }

  const handleImportAssessment = async () => {
    setError(null)

    try {
      const parsed = JSON.parse(importJson) as {
        assessment?: {
          title?: string
          description?: string | null
          assessment_type?: "module" | "final"
          module_id?: string | null
          is_required?: boolean
          passing_score?: number
          max_attempts?: number | null
          estimated_minutes?: number
          is_active?: boolean
        }
        builder_payload?: Record<string, unknown>
        questions?: unknown[]
      }

      const builderPayload =
        parsed.builder_payload ??
        (Array.isArray(parsed.questions) ? { version: 1, questions: parsed.questions } : parsed)

      if (importMode === "update") {
        if (!selectedAssessment) {
          throw new Error("Selecione uma avaliacao para importar sobre ela.")
        }

        await updateAssessment.mutateAsync({
          assessmentId: selectedAssessment.id,
          productId: courseId,
          moduleId: parsed.assessment?.module_id ?? selectedAssessment.module_id,
          assessmentType: parsed.assessment?.assessment_type ?? selectedAssessment.assessment_type,
          title: parsed.assessment?.title ?? selectedAssessment.title,
          description: parsed.assessment?.description ?? selectedAssessment.description,
          isRequired: parsed.assessment?.is_required ?? selectedAssessment.is_required,
          passingScore: parsed.assessment?.passing_score ?? selectedAssessment.passing_score,
          maxAttempts: parsed.assessment?.max_attempts ?? selectedAssessment.max_attempts,
          estimatedMinutes: parsed.assessment?.estimated_minutes ?? selectedAssessment.estimated_minutes,
          isActive: parsed.assessment?.is_active ?? selectedAssessment.is_active,
          builderPayload,
        })
      } else {
        const created = await createAssessment.mutateAsync({
          productId: courseId,
          moduleId: parsed.assessment?.assessment_type === "final" ? null : parsed.assessment?.module_id ?? null,
          assessmentType: parsed.assessment?.assessment_type ?? "module",
          title: parsed.assessment?.title ?? "Avaliacao importada",
          description: parsed.assessment?.description ?? null,
          isRequired: parsed.assessment?.is_required ?? true,
          passingScore: parsed.assessment?.passing_score ?? 70,
          maxAttempts: parsed.assessment?.max_attempts ?? null,
          estimatedMinutes: parsed.assessment?.estimated_minutes ?? 15,
          isActive: parsed.assessment?.is_active ?? true,
          builderPayload,
        })
        setSelectedAssessmentId(created.id)
      }

      setImportJson("")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel importar o JSON.")
    }
  }

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
          <p className="text-sm font-medium text-slate-500">Avaliacao final</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{finalAssessments.length}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Operacao de avaliacoes"
          description="Criacao, importacao, exportacao e manutencao do builder de quizzes e prova final."
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border bg-slate-50/80 p-4">
              <h3 className="font-semibold text-slate-950">Nova avaliacao</h3>
              <div className="mt-4 space-y-3">
                <input
                  value={createDraft.title}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Titulo da avaliacao"
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
                <select
                  value={createDraft.assessmentType}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      assessmentType: event.target.value as "module" | "final",
                      moduleId: event.target.value === "final" ? "" : prev.moduleId,
                    }))
                  }
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                >
                  <option value="module">Quiz de modulo</option>
                  <option value="final">Avaliacao final</option>
                </select>
                <select
                  value={createDraft.moduleId}
                  disabled={createDraft.assessmentType === "final"}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, moduleId: event.target.value }))}
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Selecione um modulo</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
                <Button type="button" className="w-full rounded-full" disabled={createAssessment.isPending} onClick={handleCreateAssessment}>
                  {createAssessment.isPending ? "A criar..." : "Criar avaliacao"}
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border bg-slate-50/80 p-4">
              <h3 className="font-semibold text-slate-950">Importar ou exportar JSON</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                O JSON pode conter `assessment` e `builder_payload`, ou apenas um payload com `questions`.
              </p>
              <div className="mt-4 space-y-3">
                <select
                  value={importMode}
                  onChange={(event) => setImportMode(event.target.value as "create" | "update")}
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                >
                  <option value="create">Criar nova avaliacao a partir do JSON</option>
                  <option value="update">Atualizar avaliacao selecionada</option>
                </select>
                <textarea
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                  rows={10}
                  placeholder="Cole aqui o JSON da avaliacao"
                  className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
                <Button type="button" variant="outline" className="w-full rounded-full" onClick={handleImportAssessment}>
                  Importar JSON
                </Button>
                {selectedAssessment ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() =>
                      downloadAssessmentJson(
                        `${product.slug}-${selectedAssessment.title.toLowerCase().replace(/\s+/g, "-")}.json`,
                        {
                          assessment: {
                            title: selectedAssessment.title,
                            description: selectedAssessment.description,
                            assessment_type: selectedAssessment.assessment_type,
                            module_id: selectedAssessment.module_id,
                            is_required: selectedAssessment.is_required,
                            passing_score: selectedAssessment.passing_score,
                            max_attempts: selectedAssessment.max_attempts,
                            estimated_minutes: selectedAssessment.estimated_minutes,
                            is_active: selectedAssessment.is_active,
                          },
                          builder_payload: selectedAssessment.builder_payload,
                        },
                      )
                    }
                  >
                    Exportar avaliacao selecionada
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </aside>

          <div className="space-y-4">
            {assessments.length === 0 ? (
              <EmptyState
                title="Sem avaliacoes mapeadas"
                message="Crie a avaliacao final ou os quizzes de modulo para iniciar o builder."
              />
            ) : (
              assessments.map((assessment) => {
                const module = assessment.module_id
                  ? modules.find((item) => item.id === assessment.module_id) ?? null
                  : null
                const isSelected = assessment.id === selectedAssessmentId

                return (
                  <article
                    key={assessment.id}
                    className={`rounded-[1.5rem] border p-5 transition ${
                      isSelected ? "border-slate-900 bg-slate-900 text-white" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{assessment.title}</p>
                          <StatusBadge
                            label={assessment.assessment_type === "final" ? "Final" : "Modulo"}
                            tone={assessment.assessment_type === "final" ? "success" : "warning"}
                          />
                          {assessment.is_required ? <StatusBadge label="Obrigatoria" tone="info" /> : null}
                        </div>
                        <p className={`mt-2 text-sm leading-7 ${isSelected ? "text-white/80" : "text-slate-600"}`}>
                          {assessment.description ?? "Avaliacao sem descricao curta."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {module ? <StatusBadge label={module.title} tone="neutral" /> : null}
                          <StatusBadge label={`Minimo ${assessment.passing_score}%`} tone="info" />
                          <StatusBadge label={assessment.max_attempts ? `${assessment.max_attempts} tentativa(s)` : "Sem limite"} tone="neutral" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant={isSelected ? "secondary" : "outline"} className="rounded-full" onClick={() => setSelectedAssessmentId(assessment.id)}>
                          Editar aqui
                        </Button>
                        {assessment.module_id ? (
                          <Button asChild variant={isSelected ? "secondary" : "outline"} className="rounded-full">
                            <Link to={adminCourseModuleAssessmentPath(courseId, assessment.module_id, assessment.id)}>
                              Abrir rota
                            </Link>
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant={isSelected ? "secondary" : "outline"}
                          className="rounded-full text-rose-700"
                          disabled={deleteAssessment.isPending}
                          onClick={async () => {
                            if (!window.confirm(`Excluir a avaliacao "${assessment.title}"?`)) return
                            try {
                              setError(null)
                              await deleteAssessment.mutateAsync(assessment.id)
                            } catch (submitError) {
                              setError(submitError instanceof Error ? submitError.message : "Nao foi possivel excluir a avaliacao.")
                            }
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>

      {selectedAssessment ? (
        <AssessmentBuilderWorkspace productId={courseId} assessment={selectedAssessment} modules={modules} />
      ) : null}
    </div>
  )
}
