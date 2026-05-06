import { Link, useOutletContext, useParams } from "react-router-dom"
import { CheckCircle2, FileText, Loader2, StickyNote } from "lucide-react"
import { useEffect, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { LessonContentBlocksRenderer, LessonPrimaryMedia, RichTextContent, StatusBadge } from "@/components/common"
import {
  useAccessibleLesson,
  useLessonNote,
  useModuleAssets,
  useRequestAssetAccess,
  useRequestModulePdfAccess,
  useSaveLessonNote,
  useUpsertLessonProgress,
} from "@/hooks/useDashboard"
import { buildCoursePlayerEntries } from "@/lib/course-helpers"
import { getAssetActionLabel, getAssetTypeLabel } from "@/lib/product-presentation"
import {
  studentCourseAssessmentPath,
  studentCourseLessonPath,
} from "@/lib/routes"
import type { StudentCoursePlayerContext } from "./StudentCoursePlayerLayout"

export function StudentLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const context = useOutletContext<StudentCoursePlayerContext>()
  const lessonSummary = context.lessons.find((item) => item.id === lessonId) ?? null
  const module = lessonSummary ? context.modules.find((item) => item.id === lessonSummary.module_id) ?? null : null
  const lessonQuery = useAccessibleLesson(lessonSummary && !lessonSummary.is_locked ? lessonSummary.id : undefined)
  const assetsQuery = useModuleAssets(module && !module.is_locked ? module.id : undefined)
  const noteQuery = useLessonNote(lessonSummary?.id)
  const saveLessonNote = useSaveLessonNote()
  const progressMutation = useUpsertLessonProgress()
  const assetAccess = useRequestAssetAccess()
  const modulePdfAccess = useRequestModulePdfAccess()
  const [noteText, setNoteText] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the fetched note into the editable draft when the lesson changes.
    setNoteText(noteQuery.data?.note_text ?? "")
  }, [lessonSummary?.id, noteQuery.data?.note_text])

  if (!lessonSummary || !module) {
    return (
      <EmptyState
        title="Aula nao encontrada"
        message="A aula pedida nao esta disponivel nesta trilha."
      />
    )
  }

  if (lessonSummary.is_locked || module.is_locked) {
    return (
      <EmptyState
        title="Aula bloqueada"
        message={lessonSummary.lock_reason ?? module.lock_reason ?? "Conclui os requisitos anteriores para libertar esta aula."}
      />
    )
  }

  if (lessonQuery.isLoading || assetsQuery.isLoading) {
    return <LoadingState message="A preparar o conteudo da aula..." />
  }

  if (lessonQuery.isError || assetsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel abrir esta aula"
        message={
          lessonQuery.error instanceof Error
            ? lessonQuery.error.message
            : assetsQuery.error instanceof Error
              ? assetsQuery.error.message
              : "Tenta novamente dentro de instantes."
        }
        onRetry={() => {
          void lessonQuery.refetch()
          void assetsQuery.refetch()
        }}
      />
    )
  }

  const lesson = lessonQuery.data
  const assets = assetsQuery.data ?? []

  if (!lesson) {
    return (
      <EmptyState
        title="Conteudo indisponivel"
        message="O backend nao libertou o conteudo completo desta aula para a tua sessao."
      />
    )
  }

  const entries = buildCoursePlayerEntries(context.modules, context.lessons, context.assessments)
  const unlockedEntries = entries.filter((entry) => !entry.isLocked)
  const currentIndex = unlockedEntries.findIndex((entry) => entry.type === "lesson" && entry.id === lesson.id)
  const previousEntry = currentIndex > 0 ? unlockedEntries[currentIndex - 1] : null
  const nextEntry = currentIndex >= 0 ? unlockedEntries[currentIndex + 1] ?? null : null
  const currentNote = noteText
  const currentProgress = context.progress.find((item) => item.lesson_id === lesson.id)
  const displayedProgress = currentProgress?.progress_percent ?? lessonSummary.progress_percent ?? 0
  const displayedStatus = currentProgress?.status ?? lessonSummary.progress_state ?? "not_started"
  const isLessonCompleted = displayedStatus === "completed"

  const handleSaveNote = async () => {
    await saveLessonNote.mutateAsync({ lessonId: lesson.id, noteText: currentNote })
  }

  const handleProgress = async (status: "in_progress" | "completed") => {
    await progressMutation.mutateAsync({
      lessonId: lesson.id,
      productId: context.product.id,
      moduleId: module.id,
      status,
      progressPercent: status === "completed" ? 100 : 45,
    })
  }

  const handleAssetOpen = async (assetId: string) => {
    const result = await assetAccess.mutateAsync(assetId)
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  const handleModulePdfOpen = async () => {
    const result = await modulePdfAccess.mutateAsync(module.id)
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{module.title}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950">{lesson.title}</h1>
            <RichTextContent
              value={lesson.description}
              fallback="Aula pronta para leitura, video e continuidade do estudo."
              className="mt-3 max-w-3xl text-sm leading-8 text-slate-600"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={
                lesson.lesson_type === "hybrid"
                  ? "Hibrida"
                  : lesson.lesson_type === "video"
                    ? "Video"
                    : lesson.lesson_type === "file"
                      ? "Ficheiro"
                      : "Texto"
              }
              tone="info"
            />
            <StatusBadge label={`${lesson.estimated_minutes} min`} tone="warning" />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <LessonPrimaryMedia source={lesson.youtube_url} />
          {lesson.text_content ? (
            <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4" />
                <p className="font-medium">Conteudo textual</p>
              </div>
              <LessonContentBlocksRenderer value={lesson.text_content} className="mt-3" />
            </div>
          ) : lesson.lesson_type === "file" ? (
            <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4" />
                <p className="font-medium">Conteudo principal em ficheiro</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Abra os materiais protegidos abaixo para consumir esta aula.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="mr-auto min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              <span>Progresso da aula</span>
              <span>{displayedProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#1398B7] transition-all duration-300" style={{ width: `${displayedProgress}%` }} />
            </div>
          </div>
          <Button type="button" className="rounded-full" onClick={() => void handleProgress("in_progress")} disabled={progressMutation.isPending || isLessonCompleted}>
            {progressMutation.isPending && progressMutation.variables?.status === "in_progress" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {displayedStatus === "in_progress" ? "Em progresso" : "Marcar em progresso"}
          </Button>
          <Button type="button" variant={isLessonCompleted ? "default" : "outline"} className="rounded-full" onClick={() => void handleProgress("completed")} disabled={progressMutation.isPending || isLessonCompleted}>
            {progressMutation.isPending && progressMutation.variables?.status === "completed" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isLessonCompleted ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {isLessonCompleted ? "Aula concluida" : "Concluir aula"}
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-slate-900" />
            <h2 className="font-display text-2xl font-bold text-slate-950">Anotacoes da aula</h2>
          </div>
          <textarea
            rows={10}
            value={currentNote}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Regista aqui os pontos importantes desta aula."
            className="mt-4 w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
          />
          <Button type="button" className="mt-4 rounded-full" onClick={() => void handleSaveNote()} disabled={saveLessonNote.isPending}>
            {saveLessonNote.isPending ? "A guardar..." : "Guardar anotacoes"}
          </Button>
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-slate-950">Materiais da aula</h2>
          <div className="mt-4 space-y-3">
            {module.module_pdf_file_name ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{module.module_pdf_file_name}</p>
                      <StatusBadge label="PDF base do modulo" tone="warning" />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Acesso licenciado por aluno com URL temporaria e auditavel.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => void handleModulePdfOpen()}
                    disabled={modulePdfAccess.isPending}
                  >
                    {modulePdfAccess.isPending ? "A preparar..." : "Abrir PDF base"}
                  </Button>
                </div>
              </div>
            ) : null}
            {assets.length === 0 ? (
              <EmptyState
                title="Sem materiais adicionais"
                message={
                  module.module_pdf_file_name
                    ? "O PDF base do modulo ja esta disponivel acima."
                    : "Quando houver PDFs, links ou videos de apoio, eles aparecem aqui."
                }
              />
            ) : (
              assets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{asset.title}</p>
                        <StatusBadge label={getAssetTypeLabel(asset.asset_type)} tone="info" />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Material protegido ligado ao modulo atual.</p>
                    </div>
                    <Button type="button" className="rounded-full" onClick={() => void handleAssetOpen(asset.id)} disabled={assetAccess.isPending}>
                      {assetAccess.isPending ? "A abrir..." : getAssetActionLabel(asset)}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Navegacao do player</h2>
            <p className="mt-1 text-sm text-slate-600">Avanca pela trilha respeitando a estrutura do material.</p>
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
