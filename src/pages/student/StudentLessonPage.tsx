import { Link, useOutletContext, useParams } from "react-router-dom"
import { CheckCircle2, FileText, Loader2, StickyNote } from "lucide-react"
import { useEffect, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  LessonAdditionalResources,
  LessonContentBlocksRenderer,
  LessonPrimaryMedia,
  RichTextContent,
  StatusBadge,
} from "@/components/common"
import {
  useAccessibleLesson,
  useLessonFileAccess,
  useLessonNote,
  useModuleAssets,
  useRequestAssetAccess,
  useRequestModulePdfAccess,
  useSaveLessonNote,
  useUpsertLessonProgress,
} from "@/hooks/useDashboard"
import { buildCoursePlayerEntries } from "@/lib/course-helpers"
import { getLessonTypeLabel } from "@/lib/product-presentation"
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
  const lessonFileAccess = useLessonFileAccess(
    lessonQuery.data?.lesson_type === "file" && lessonQuery.data.lesson_file_storage_path
      ? lessonQuery.data.id
      : undefined,
  )
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
        title="Aula não encontrada"
        message="A aula pedida não esta disponível nesta trilha."
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
    return <LoadingState message="A preparar o conteúdo da aula..." />
  }

  if (lessonQuery.isError || assetsQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível abrir esta aula"
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
  const lessonVideoSource = lesson?.youtube_url?.trim() ?? ""
  const resolvedPrimaryVideoSource = lessonVideoSource || null

  if (!lesson) {
    return (
      <EmptyState
        title="Conteúdo indisponivel"
        message="O backend não libertou o conteúdo completo desta aula para a tua sessão."
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
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{module.title}</p>
            <h1 className="mt-2 font-display text-3xl font-black leading-tight text-slate-950 md:text-5xl">{lesson.title}</h1>
            <RichTextContent
              value={lesson.description}
              fallback="Aula pronta para leitura, vídeo e continuidade do estudo."
              className="mt-4 max-w-4xl text-base leading-8 text-slate-600"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusBadge
              label={getLessonTypeLabel(lesson.lesson_type)}
              tone="info"
            />
            <StatusBadge label={`${lesson.estimated_minutes} min`} tone="warning" />
          </div>
        </div>

        <div className="mt-7 space-y-4">
          <LessonPrimaryMedia source={resolvedPrimaryVideoSource} />
          {lesson.lesson_type === "file" && lesson.lesson_file_storage_path ? (
            <div className="rounded-[1.5rem] border border-slate-300 bg-slate-50/80 p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-slate-900">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <p className="font-semibold">Material da Aula</p>
                </div>
                {lesson.lesson_file_name ? <p className="text-sm text-slate-500">{lesson.lesson_file_name}</p> : null}
              </div>
              {lessonFileAccess.isLoading ? (
                <div className="mt-4 flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                  A preparar o leitor de PDF...
                </div>
              ) : lessonFileAccess.isError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p>{lessonFileAccess.error instanceof Error ? lessonFileAccess.error.message : "Não foi possível abrir o PDF."}</p>
                  <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => void lessonFileAccess.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : lessonFileAccess.data?.url ? (
                <>
                  <div className="mt-4 flex justify-end">
                    <a
                      href={lessonFileAccess.data.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-sky-700 hover:text-sky-900"
                    >
                      Abrir PDF em nova aba
                    </a>
                  </div>
                <iframe
                  src={lessonFileAccess.data.url}
                  title={lesson.lesson_file_name ?? lesson.title}
                  className="mt-4 h-[min(760px,75vh)] w-full rounded-2xl border border-slate-200 bg-white"
                />
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  O PDF principal ainda não está disponível.
                </div>
              )}
            </div>
          ) : null}
          {lesson.text_content ? (
            <div className="rounded-[1.5rem] border border-slate-300 bg-slate-50/80 p-6">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4" />
                <p className="font-semibold">Conteúdo textual</p>
              </div>
              <LessonContentBlocksRenderer value={lesson.text_content} className="mt-3" />
            </div>
          ) : lesson.lesson_type === "file" && !lesson.lesson_file_storage_path ? (
            <div className="rounded-[1.5rem] border border-slate-300 bg-slate-50/80 p-6">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4" />
                <p className="font-semibold">Conteúdo principal em ficheiro</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Abre os materiais protegidos abaixo para consumir esta aula.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex flex-wrap items-end gap-3">
          <div className="mr-auto min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              <span>Progresso da aula</span>
              <span>{displayedProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#1398B7] transition-all duration-300" style={{ width: `${displayedProgress}%` }} />
            </div>
          </div>
          <Button type="button" className="h-11 rounded-full bg-[#242742] px-5 font-bold hover:bg-[#1b1d38]" onClick={() => void handleProgress("in_progress")} disabled={progressMutation.isPending || isLessonCompleted}>
            {progressMutation.isPending && progressMutation.variables?.status === "in_progress" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {displayedStatus === "in_progress" ? "Em progresso" : "Marcar em progresso"}
          </Button>
          <Button type="button" variant={isLessonCompleted ? "default" : "outline"} className="h-11 rounded-full px-5 font-bold" onClick={() => void handleProgress("completed")} disabled={progressMutation.isPending || isLessonCompleted}>
            {progressMutation.isPending && progressMutation.variables?.status === "completed" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isLessonCompleted ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {isLessonCompleted ? "Aula concluída" : "Concluir aula"}
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-slate-900" />
            <h2 className="font-display text-2xl font-black text-slate-950">Anotações da aula</h2>
          </div>
          <textarea
            rows={10}
            value={currentNote}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Regista aqui os pontos importantes desta aula."
            className="mt-4 min-h-56 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
          />
          <Button type="button" className="mt-4 rounded-full bg-[#242742] font-bold hover:bg-[#1b1d38]" onClick={() => void handleSaveNote()} disabled={saveLessonNote.isPending}>
            {saveLessonNote.isPending ? "A guardar..." : "Guardar anotações"}
          </Button>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <h2 className="font-display text-2xl font-black text-slate-950">Materiais da aula</h2>
          <div className="mt-4 space-y-3">
            {module.module_pdf_file_name ? (
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{module.module_pdf_file_name}</p>
                      <StatusBadge label="PDF base do módulo" tone="warning" />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Material protegido ligado ao módulo atual.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => void handleModulePdfOpen()}
                    disabled={modulePdfAccess.isPending}
                  >
                    {modulePdfAccess.isPending ? "A preparar..." : "Abrir PDF"}
                  </Button>
                </div>
              </div>
            ) : null}
            {!module.module_pdf_file_name ? (
              <EmptyState
                title="Sem material base"
                message="Quando houver um PDF base configurado para o módulo, ele aparece aqui."
              />
            ) : null}
          </div>
        </section>
      </div>

      <LessonAdditionalResources
        assets={assets}
        isOpening={assetAccess.isPending}
        onOpen={(assetId) => void handleAssetOpen(assetId)}
      />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:px-7 md:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            className="h-11 rounded-xl bg-emerald-600 px-6 font-bold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
            onClick={() => void handleProgress("completed")}
            disabled={progressMutation.isPending || isLessonCompleted}
          >
            {progressMutation.isPending && progressMutation.variables?.status === "completed" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {isLessonCompleted ? "Aula concluída" : "Marcar como Concluída"}
          </Button>

          <div className="flex w-full gap-3 sm:w-auto">
            {previousEntry ? (
              <Button asChild variant="outline" className="h-11 flex-1 rounded-xl border-slate-200 px-5 font-medium text-slate-600 sm:flex-none">
                <Link
                  to={
                    previousEntry.type === "lesson"
                      ? studentCourseLessonPath(context.courseId, previousEntry.id)
                      : studentCourseAssessmentPath(context.courseId, previousEntry.id)
                  }
                >
                  <span aria-hidden="true" className="mr-2">‹</span>
                  Anterior
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled className="h-11 flex-1 rounded-xl px-5 sm:flex-none">
                <span aria-hidden="true" className="mr-2">‹</span>
                Anterior
              </Button>
            )}

            {nextEntry ? (
              <Button asChild className="h-11 flex-1 rounded-xl bg-[#080b24] px-5 font-bold text-white hover:bg-[#15193b] sm:flex-none">
                <Link
                  to={
                    nextEntry.type === "lesson"
                      ? studentCourseLessonPath(context.courseId, nextEntry.id)
                      : studentCourseAssessmentPath(context.courseId, nextEntry.id)
                  }
                >
                  Próxima Aula
                  <span aria-hidden="true" className="ml-2 text-lg leading-none">›</span>
                </Link>
              </Button>
            ) : (
              <Button type="button" disabled className="h-11 flex-1 rounded-xl bg-[#080b24] px-5 font-bold text-white sm:flex-none">
                Próxima Aula
                <span aria-hidden="true" className="ml-2 text-lg leading-none">›</span>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
