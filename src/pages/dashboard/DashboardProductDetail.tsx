import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { FileText, PlayCircle, StickyNote } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useDashboardProductContent,
  useLessonNote,
  useRequestAssetAccess,
  useSaveLessonNote,
  useUpsertLessonProgress,
} from "@/hooks/useDashboard"
import type { ModuleAssetSummary, ProductLessonSummary } from "@/types/app.types"
import {
  getAssetActionLabel,
  getAssetTypeLabel,
  getModuleTypeLabel,
  getProductNarrative,
} from "@/lib/product-presentation"

const EMPTY_PROGRESS: Array<{ lesson_id: string; status: string; progress_percent: number }> = []

function getProgressTone(progressPercent: number): "neutral" | "warning" | "success" {
  if (progressPercent >= 100) return "success"
  if (progressPercent > 0) return "warning"
  return "neutral"
}

function getLessonStatus(
  lessonId: string,
  progressMap: Map<string, { status: string; progress_percent: number }>,
): { label: string; tone: "neutral" | "warning" | "success" } {
  const item = progressMap.get(lessonId)
  if (!item) return { label: "Por iniciar", tone: "neutral" }
  if (item.status === "completed") return { label: "Concluida", tone: "success" }
  return { label: `${item.progress_percent}%`, tone: "warning" }
}

export function DashboardProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const { data, isLoading, isError, error, refetch } = useDashboardProductContent(id)
  const assetAccess = useRequestAssetAccess()
  const saveLessonNote = useSaveLessonNote()
  const upsertLessonProgress = useUpsertLessonProgress()

  const modules = data?.modules ?? []
  const lessons = data?.lessons ?? []
  const progress = data?.progress ?? EMPTY_PROGRESS
  const selectedModuleIdSafe = selectedModuleId ?? modules[0]?.id ?? null
  const selectedModule = modules.find((module) => module.id === selectedModuleIdSafe) ?? null
  const selectedModuleLessons = lessons.filter((lesson) => lesson.module_id === selectedModuleIdSafe)
  const selectedLessonIdSafe = selectedLessonId ?? selectedModuleLessons[0]?.id ?? null
  const selectedLesson =
    selectedModuleLessons.find((lesson) => lesson.id === selectedLessonIdSafe) ??
    selectedModuleLessons[0] ??
    null
  const selectedAssets = (data?.assets ?? []).filter((asset) => asset.module_id === selectedModuleIdSafe)
  const selectedAssessments = (data?.assessments ?? []).filter(
    (assessment) => assessment.module_id === selectedModuleIdSafe || assessment.assessment_type === "final",
  )
  const noteQuery = useLessonNote(selectedLesson?.id)
  const [noteState, setNoteState] = useState<{ lessonId: string | null; text: string }>({
    lessonId: null,
    text: "",
  })

  const progressMap = useMemo(
    () => new Map(progress.map((item) => [item.lesson_id, item])),
    [progress],
  )

  const completedLessons = progress.filter((item) => item.status === "completed").length
  const progressPercent = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0
  const narrative = data?.product ? getProductNarrative(data.product) : null

  const handleOpenAsset = async (asset: ModuleAssetSummary) => {
    const result = await assetAccess.mutateAsync(asset.id)
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  const handleSaveNote = async () => {
    if (!selectedLesson) return
    const currentNote = noteState.lessonId === selectedLesson.id ? noteState.text : noteQuery.data?.note_text ?? ""
    await saveLessonNote.mutateAsync({ lessonId: selectedLesson.id, noteText: currentNote })
  }

  const handleLessonProgress = async (lesson: ProductLessonSummary, status: "in_progress" | "completed") => {
    if (!id) return
    await upsertLessonProgress.mutateAsync({
      lessonId: lesson.id,
      productId: id,
      moduleId: lesson.module_id,
      status,
      progressPercent: status === "completed" ? 100 : 40,
    })
  }

  if (isLoading) {
    return <LoadingState message="A carregar conteudo do curso..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar este curso"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data?.product) {
    return (
      <EmptyState
        title="Produto indisponivel"
        message="Este item nao esta acessivel na tua conta neste momento."
      />
    )
  }

  const currentLessonId = selectedLessonIdSafe
  const noteDraft = noteState.lessonId === currentLessonId ? noteState.text : noteQuery.data?.note_text ?? ""

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.product.title}
        description={data.product.short_description ?? data.product.description ?? "Conteudo do produto."}
        backTo="/dashboard/produtos"
      />

      <section className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-6 text-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/65">{narrative?.familyLabel ?? "Curso"}</p>
            <h2 className="mt-3 font-display text-3xl font-bold">{data.product.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82">
              {narrative?.accessLabel ?? "Acesso organizado para continuares o estudo."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge label="Grant ativo" tone="success" />
              <StatusBadge label={`${modules.length} modulos`} tone="info" />
              <StatusBadge label={`${lessons.length} aulas`} tone="neutral" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Progresso</p>
              <p className="mt-3 text-2xl font-bold">{progressPercent}%</p>
              <p className="mt-2 text-sm text-white/80">{completedLessons} de {lessons.length} aulas concluidas</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Carga estimada</p>
              <p className="mt-3 text-2xl font-bold">{data.product.workload_minutes} min</p>
              <p className="mt-2 text-sm text-white/80">Continua daqui sem perder contexto.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Trilha do curso</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">Escolhe um modulo e abre a aula que queres continuar.</p>
            </div>
            <StatusBadge label={`${progressPercent}%`} tone={getProgressTone(progressPercent)} />
          </div>

          <div className="mt-5 space-y-4">
            {modules.map((module) => (
              <div key={module.id} className={`rounded-2xl border p-4 ${selectedModuleIdSafe === module.id ? "border-slate-900 bg-slate-900 text-white" : "bg-slate-50"}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModuleId(module.id)
                    setSelectedLessonId(lessons.find((lesson) => lesson.module_id === module.id)?.id ?? null)
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{module.title}</p>
                      <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${selectedModuleIdSafe === module.id ? "text-white/65" : "text-slate-500"}`}>
                        {getModuleTypeLabel(module.module_type)}
                      </p>
                    </div>
                    <StatusBadge label={module.is_preview ? "Preview" : "Incluido"} tone={module.is_preview ? "warning" : "success"} />
                  </div>
                </button>

                <div className="mt-3 space-y-2">
                  {lessons.filter((lesson) => lesson.module_id === module.id).map((lesson) => {
                    const lessonState = getLessonStatus(lesson.id, progressMap)
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => {
                          setSelectedModuleId(module.id)
                          setSelectedLessonId(lesson.id)
                          setNoteState({
                            lessonId: lesson.id,
                            text: lesson.id === noteQuery.data?.lesson_id ? noteQuery.data?.note_text ?? "" : "",
                          })
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${
                          selectedLessonIdSafe === lesson.id
                            ? "bg-white text-slate-950"
                            : selectedModuleIdSafe === module.id
                              ? "bg-white/10 text-white"
                              : "bg-white text-slate-700"
                        }`}
                      >
                        <span>{lesson.title}</span>
                        <StatusBadge label={lessonState.label} tone={lessonState.tone} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {selectedModule && selectedLesson ? (
            <>
              <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{selectedModule.title}</p>
                    <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">{selectedLesson.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {selectedLesson.description ?? "Aula pronta para leitura, visualizacao e continuidade do estudo."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label={selectedLesson.lesson_type === "video" ? "Video" : selectedLesson.lesson_type === "text" ? "Texto" : "Hibrida"} tone="info" />
                    <StatusBadge label={`${selectedLesson.estimated_minutes} min`} tone="warning" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {selectedLesson.youtube_url ? (
                    <div className="rounded-2xl border bg-slate-50/80 p-4">
                      <div className="flex items-center gap-2 text-slate-900">
                        <PlayCircle className="h-4 w-4" />
                        <p className="font-medium">Video principal</p>
                      </div>
                      <p className="mt-3 break-all text-sm leading-6 text-slate-600">{selectedLesson.youtube_url}</p>
                    </div>
                  ) : null}
                  {selectedLesson.text_content ? (
                    <div className="rounded-2xl border bg-slate-50/80 p-4">
                      <div className="flex items-center gap-2 text-slate-900">
                        <FileText className="h-4 w-4" />
                        <p className="font-medium">Conteudo textual</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600 line-clamp-6">{selectedLesson.text_content}</p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button type="button" className="rounded-full" onClick={() => void handleLessonProgress(selectedLesson, "in_progress")} disabled={upsertLessonProgress.isPending}>
                    Marcar em progresso
                  </Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleLessonProgress(selectedLesson, "completed")} disabled={upsertLessonProgress.isPending}>
                    Concluir aula
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-slate-900" />
                    <h3 className="font-display text-xl font-bold text-slate-950">As tuas notas</h3>
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={(event) =>
                      setNoteState({
                        lessonId: currentLessonId,
                        text: event.target.value,
                      })
                    }
                    rows={9}
                    placeholder="Guarda aqui os pontos importantes desta aula."
                    className="mt-4 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  />
                  <Button type="button" className="mt-4 rounded-full" onClick={() => void handleSaveNote()} disabled={saveLessonNote.isPending || noteQuery.isLoading}>
                    {saveLessonNote.isPending ? "A guardar..." : "Guardar notas"}
                  </Button>
                </div>

                <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                  <h3 className="font-display text-xl font-bold text-slate-950">Materiais e avaliacoes</h3>
                  <div className="mt-4 space-y-3">
                    {selectedAssets.map((asset) => (
                      <div key={asset.id} className="rounded-2xl border bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">{asset.title}</p>
                              <StatusBadge label={getAssetTypeLabel(asset.asset_type)} tone="info" />
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Material protegido do modulo atual.</p>
                          </div>
                          <Button type="button" onClick={() => void handleOpenAsset(asset)} disabled={assetAccess.isPending} className="rounded-full">
                            {assetAccess.isPending ? "A abrir..." : getAssetActionLabel(asset)}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {selectedAssets.length === 0 ? <EmptyState title="Sem materiais neste modulo" message="Quando houver ficheiros ou links liberados, eles aparecem aqui." /> : null}
                    {selectedAssessments.map((assessment) => (
                      <div key={assessment.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{assessment.title}</p>
                          <StatusBadge label={assessment.assessment_type === "final" ? "Avaliacao final" : "Quiz do modulo"} tone="warning" />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{assessment.description ?? "Avaliacao disponivel neste curso."}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="Sem aulas disponiveis" message="As aulas publicadas deste curso vao aparecer aqui." />
          )}
        </section>
      </div>
    </div>
  )
}
