import { useMemo, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui"
import { OperationFeedbackModal, RichTextEditor, StatusBadge } from "@/components/common"
import { createAssessmentDraft, createEmptyQuestionDraft, buildAssessmentPayload, assessmentQuestionTypeOptions, type AssessmentBuilderDraft } from "@/lib/assessment-builder"
import { useUpdateAdminProductAssessment } from "@/hooks/useAdmin"
import type { ProductAssessmentSummary, ProductModuleSummary } from "@/types/app.types"

interface AssessmentBuilderWorkspaceProps {
  productId: string
  assessment: ProductAssessmentSummary
  modules: ProductModuleSummary[]
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function AssessmentBuilderWorkspace({
  productId,
  assessment,
  modules,
}: AssessmentBuilderWorkspaceProps) {
  const updateAssessment = useUpdateAdminProductAssessment()
  const [draft, setDraft] = useState<AssessmentBuilderDraft>(() => createAssessmentDraft(assessment))
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const selectedModule = useMemo(
    () => (draft.moduleId ? modules.find((item) => item.id === draft.moduleId) ?? null : null),
    [draft.moduleId, modules],
  )

  const handleQuestionKindChange = (questionId: string, nextKind: AssessmentBuilderDraft["questions"][number]["kind"]) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id !== questionId
          ? question
          : {
              ...question,
              kind: nextKind,
              options: nextKind === "single_choice" ? (question.options.length > 0 ? question.options : createEmptyQuestionDraft("single_choice").options) : [],
            },
      ),
    }))
  }

  const handleQuestionField = (
    questionId: string,
    field: keyof AssessmentBuilderDraft["questions"][number],
    value: string | boolean,
  ) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? { ...question, [field]: value } : question,
      ),
    }))
  }

  const handleOptionField = (
    questionId: string,
    optionId: string,
    field: "label" | "value" | "isCorrect",
    value: string | boolean,
  ) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) return question
        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, [field]: value } : option,
          ),
        }
      }),
    }))
  }

  const addOption = (questionId: string) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id !== questionId
          ? question
          : {
              ...question,
              options: [
                ...question.options,
                {
                  id: crypto.randomUUID(),
                  label: `Opção ${question.options.length + 1}`,
                  value: `opção-${question.options.length + 1}`,
                  isCorrect: false,
                },
              ],
            },
      ),
    }))
  }

  const removeOption = (questionId: string, optionId: string) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id !== questionId
          ? question
          : {
              ...question,
              options: question.options.filter((option) => option.id !== optionId),
            },
      ),
    }))
  }

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    setDraft((prev) => {
      const index = prev.questions.findIndex((question) => question.id === questionId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.questions.length) {
        return prev
      }

      const questions = [...prev.questions]
      const [moved] = questions.splice(index, 1)
      questions.splice(nextIndex, 0, moved)
      return { ...prev, questions }
    })
  }

  const handleSubmit = async () => {
    setFeedback(null)

    if (draft.assessmentType === "module" && !draft.moduleId) {
      setFeedback({ tone: "error", message: "Selecione um módulo antes de guardar o quiz." })
      return
    }

    try {
      await updateAssessment.mutateAsync({
        assessmentId: assessment.id,
        productId,
        moduleId: draft.assessmentType === "module" ? draft.moduleId : null,
        assessmentType: draft.assessmentType,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        isRequired: draft.isRequired,
        passingScore: parseInteger(draft.passingScore, 70),
        maxAttempts: draft.maxAttempts.trim() ? parseInteger(draft.maxAttempts, 1) : null,
        estimatedMinutes: parseInteger(draft.estimatedMinutes, 15),
        isActive: draft.isActive,
        builderPayload: buildAssessmentPayload(draft.questions),
      })
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message: submitError instanceof Error ? submitError.message : "Não foi possível guardar a avaliação.",
      })
      return
    }

    setFeedback({ tone: "success", message: "Avaliação guardada com sucesso." })
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">{assessment.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Editor operacional da avaliação com persistencia via backend administrativo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={draft.assessmentType === "final" ? "Final" : "Módulo"} tone={draft.assessmentType === "final" ? "success" : "warning"} />
            {selectedModule ? <StatusBadge label={selectedModule.title} tone="info" /> : null}
            <StatusBadge label={draft.isActive ? "Ativa" : "Inativa"} tone={draft.isActive ? "success" : "neutral"} />
            <StatusBadge label={`${draft.questions.length} pergunta(s)`} tone="warning" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Título da avaliação</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Título da avaliação"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Tipo de avaliação</span>
            <select
              value={draft.assessmentType}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  assessmentType: event.target.value as ProductAssessmentSummary["assessment_type"],
                  moduleId: event.target.value === "final" ? null : prev.moduleId,
                }))
              }
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="module">Quiz de módulo</option>
              <option value="final">Avaliação final</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Módulo vinculado</span>
            <select
              value={draft.moduleId ?? ""}
              disabled={draft.assessmentType === "final"}
              onChange={(event) => setDraft((prev) => ({ ...prev, moduleId: event.target.value || null }))}
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Selecione um módulo</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Minutos estimados</span>
            <input
              value={draft.estimatedMinutes}
              onChange={(event) => setDraft((prev) => ({ ...prev, estimatedMinutes: event.target.value }))}
              placeholder="Minutos estimados"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Nota minima (%)</span>
            <input
              value={draft.passingScore}
              onChange={(event) => setDraft((prev) => ({ ...prev, passingScore: event.target.value }))}
              placeholder="Nota minima"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-800">Tentativas maximas</span>
            <input
              value={draft.maxAttempts}
              onChange={(event) => setDraft((prev) => ({ ...prev, maxAttempts: event.target.value }))}
              placeholder="Tentativas maximas"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-800">Descrição / Área de texto</span>
            <RichTextEditor
              value={draft.description}
              onChange={(value) => setDraft((prev) => ({ ...prev, description: value }))}
              placeholder="Descrição curta da avaliação"
              minHeightPx={170}
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.isRequired}
              onChange={(event) => setDraft((prev) => ({ ...prev, isRequired: event.target.checked }))}
            />
            Avaliação obrigatória
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Avaliação ativa
          </label>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Perguntas</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Ordenacao, gabarito e estrutura do quiz ficam centralizados aqui.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                questions: [...prev.questions, createEmptyQuestionDraft()],
              }))
            }
          >
            Nova pergunta
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {draft.questions.map((question, index) => (
            <article key={question.id} className="rounded-[1.5rem] border bg-slate-50/80 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Questao {index + 1}</p>
                  <p className="mt-2 text-sm text-slate-600">Configure tipo, enunciado, pontuacao e gabarito.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-full" disabled={index === 0} onClick={() => moveQuestion(question.id, -1)}>
                    Subir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={index === draft.questions.length - 1}
                    onClick={() => moveQuestion(question.id, 1)}
                  >
                    Descer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full text-rose-700"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        questions:
                          prev.questions.length === 1
                            ? [createEmptyQuestionDraft()]
                            : prev.questions.filter((item) => item.id !== question.id),
                      }))
                    }
                  >
                    Excluir
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <select
                  value={question.kind}
                  onChange={(event) => handleQuestionKindChange(question.id, event.target.value as AssessmentBuilderDraft["questions"][number]["kind"])}
                  className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                >
                  {assessmentQuestionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={question.points}
                  onChange={(event) => handleQuestionField(question.id, "points", event.target.value)}
                  placeholder="Pontos"
                  className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
                <input
                  value={question.title}
                  onChange={(event) => handleQuestionField(question.id, "title", event.target.value)}
                  placeholder="Título curto"
                  className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
                <label className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) => handleQuestionField(question.id, "required", event.target.checked)}
                  />
                  Pergunta obrigatória
                </label>
                <div className="md:col-span-2">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Enunciado / Área de texto</p>
                  <RichTextEditor
                    value={question.prompt}
                    onChange={(value) => handleQuestionField(question.id, "prompt", value)}
                    placeholder="Enunciado da pergunta"
                    minHeightPx={180}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">Feedback / Área de texto</p>
                  <RichTextEditor
                    value={question.feedback}
                    onChange={(value) => handleQuestionField(question.id, "feedback", value)}
                    placeholder="Feedback ou explicação"
                    minHeightPx={150}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-800">Rubrica / Área de texto</p>
                  <RichTextEditor
                    value={question.rubric}
                    onChange={(value) => handleQuestionField(question.id, "rubric", value)}
                    placeholder="Rubrica ou criterio de correcao"
                    minHeightPx={150}
                  />
                </div>
              </div>

              {question.kind === "single_choice" ? (
                <div className="mt-5 rounded-[1.25rem] border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">Alternativas</h3>
                      <p className="mt-1 text-sm text-slate-600">Marque o gabarito correto no próprio item.</p>
                    </div>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => addOption(question.id)}>
                      Nova alternativa
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {question.options.map((option) => (
                      <div key={option.id} className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto_auto]">
                        <input
                          value={option.label}
                          onChange={(event) => handleOptionField(question.id, option.id, "label", event.target.value)}
                          placeholder="Texto da alternativa"
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          value={option.value}
                          onChange={(event) => handleOptionField(question.id, option.id, "value", event.target.value)}
                          placeholder="Valor interno"
                          className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                        />
                        <label className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={option.isCorrect}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              handleOptionField(question.id, option.id, "isCorrect", event.target.checked)
                            }
                          />
                          Gabarito
                        </label>
                        <Button type="button" variant="outline" className="rounded-full text-rose-700" onClick={() => removeOption(question.id, option.id)}>
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button" className="rounded-full" disabled={updateAssessment.isPending} onClick={handleSubmit}>
            {updateAssessment.isPending ? "A guardar..." : "Guardar avaliação"}
          </Button>
        </div>
      </section>

      <div className="fixed bottom-6 right-6 z-30">
        <Button
          type="button"
          className="rounded-full bg-[#1398B7] px-6 py-6 font-black shadow-[0_20px_40px_rgba(19,152,183,0.28)] hover:bg-[#0A3640]"
          disabled={updateAssessment.isPending}
          onClick={handleSubmit}
        >
          {updateAssessment.isPending ? "A guardar..." : "Salvar configurações"}
        </Button>
      </div>

      <OperationFeedbackModal
        open={Boolean(feedback)}
        tone={feedback?.tone ?? "success"}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />
    </div>
  )
}
