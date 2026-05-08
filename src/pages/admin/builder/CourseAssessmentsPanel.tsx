import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { OperationFeedbackModal, PageHeader, StatusBadge } from "@/components/common"
import { EmptyState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  useCreateAdminProductAssessment,
  useDeleteAdminProductAssessment,
  useUpdateAdminProductAssessment,
} from "@/hooks/useAdmin"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import { adminCourseFinalAssessmentPath, adminCourseModuleAssessmentPath } from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"
import { AssessmentBuilderWorkspace } from "./AssessmentBuilderWorkspace"
import {
  exportAssessmentToJson,
  makeAssessmentExportFileName,
  normalizeAssessmentImport,
  parseJsonInput,
} from "@/lib/course-json-import-export"

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
  const navigate = useNavigate()
  const createAssessment = useCreateAdminProductAssessment()
  const updateAssessment = useUpdateAdminProductAssessment()
  const deleteAssessment = useDeleteAdminProductAssessment()
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [pendingRoute, setPendingRoute] = useState<string | null>(null)
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

  const closeFeedback = () => {
    const nextRoute = pendingRoute
    setFeedback(null)
    setPendingRoute(null)
    if (nextRoute) {
      navigate(nextRoute)
    }
  }

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
    setFeedback(null)
    setPendingRoute(null)

    try {
      if (createDraft.assessmentType === "final" && finalAssessments[0]) {
        setSelectedAssessmentId(finalAssessments[0].id)
        navigate(adminCourseFinalAssessmentPath(courseId))
        return
      }

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

      if (created.assessment_type === "final") {
        setPendingRoute(adminCourseFinalAssessmentPath(courseId))
      } else if (created.module_id) {
        setPendingRoute(adminCourseModuleAssessmentPath(courseId, created.module_id, created.id))
      }
      setFeedback({
        tone: "success",
        message: "Avaliacao criada com sucesso.",
      })
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Nao foi possivel criar a avaliacao.",
      })
    }
  }

  const handleImportAssessment = async () => {
    setFeedback(null)
    setPendingRoute(null)

    try {
      const parsed = parseJsonInput(importJson)
      const normalized = normalizeAssessmentImport(parsed)
      const builderPayload = normalized.builder_payload

      if (importMode === "update") {
        if (!selectedAssessment) {
          throw new Error("Selecione uma avaliacao para importar sobre ela.")
        }

        await updateAssessment.mutateAsync({
          assessmentId: selectedAssessment.id,
          productId: courseId,
          moduleId:
            normalized.assessment.assessment_type === "final"
              ? null
              : normalized.assessment.module_id ?? selectedAssessment.module_id,
          assessmentType: normalized.assessment.assessment_type ?? selectedAssessment.assessment_type,
          title: normalized.assessment.title || selectedAssessment.title,
          description: normalized.assessment.description ?? selectedAssessment.description,
          isRequired: selectedAssessment.is_required,
          passingScore: normalized.assessment.passing_score ?? selectedAssessment.passing_score,
          maxAttempts: normalized.assessment.max_attempts ?? selectedAssessment.max_attempts,
          estimatedMinutes:
            normalized.assessment.estimated_minutes ?? selectedAssessment.estimated_minutes,
          isActive: selectedAssessment.is_active,
          builderPayload,
        })
        setFeedback({ tone: "success", message: "Avaliacao atualizada com sucesso." })
      } else {
        const created = await createAssessment.mutateAsync({
          productId: courseId,
          moduleId:
            normalized.assessment.assessment_type === "final"
              ? null
              : normalized.assessment.module_id ?? null,
          assessmentType: normalized.assessment.assessment_type ?? "module",
          title: normalized.assessment.title || "Avaliacao importada",
          description: normalized.assessment.description ?? null,
          isRequired: true,
          passingScore: normalized.assessment.passing_score ?? 70,
          maxAttempts: normalized.assessment.max_attempts ?? null,
          estimatedMinutes: normalized.assessment.estimated_minutes ?? 15,
          isActive: true,
          builderPayload,
        })
        setSelectedAssessmentId(created.id)

        if (created.assessment_type === "final") {
          setPendingRoute(adminCourseFinalAssessmentPath(courseId))
        } else if (created.module_id) {
          setPendingRoute(adminCourseModuleAssessmentPath(courseId, created.module_id, created.id))
        }
        setFeedback({ tone: "success", message: "Avaliacao importada com sucesso." })
      }

      setImportJson("")
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Nao foi possivel importar o JSON.",
      })
    }
  }

  const handleDeleteAssessment = async (assessmentId: string, assessmentTitle: string) => {
    if (!window.confirm(`Excluir a avaliacao "${assessmentTitle}"?`)) return

    try {
      setFeedback(null)
      setPendingRoute(null)
      await deleteAssessment.mutateAsync(assessmentId)
      setFeedback({ tone: "success", message: "Avaliacao excluida com sucesso." })
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Nao foi possivel excluir a avaliacao.",
      })
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
                Aceita JSON do contrato de avaliacao (spec) e tambem o formato legado com `assessment` + `builder_payload`.
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
                        makeAssessmentExportFileName(product.slug, selectedAssessment.title),
                        exportAssessmentToJson(selectedAssessment),
                      )
                    }
                  >
                    Exportar avaliacao selecionada
                  </Button>
                ) : null}
              </div>
            </div>

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
                        ) : (
                          <Button asChild variant={isSelected ? "secondary" : "outline"} className="rounded-full">
                            <Link to={adminCourseFinalAssessmentPath(courseId)}>Abrir rota</Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant={isSelected ? "secondary" : "outline"}
                          className="rounded-full text-rose-700"
                          disabled={deleteAssessment.isPending}
                          onClick={() => void handleDeleteAssessment(assessment.id, assessment.title)}
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

      <OperationFeedbackModal
        open={Boolean(feedback)}
        tone={feedback?.tone ?? "success"}
        message={feedback?.message ?? ""}
        onClose={closeFeedback}
      />
    </div>
  )
}
