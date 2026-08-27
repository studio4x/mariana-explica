import { Link, useOutletContext, useParams } from "react-router-dom"
import { CheckCircle2, Download, FileText, Loader2, Pencil, Save, StickyNote, Trash2, X } from "lucide-react"
import { useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  LessonAdditionalResources,
  LessonContentBlocksRenderer,
  LessonPdfViewer,
  LessonPrimaryMedia,
  RichTextContent,
  StatusBadge,
} from "@/components/common"
import {
  useAccessibleLesson,
  useLessonAdditionalResources,
  useLessonNotes,
  useDeleteLessonNote,
  useRequestLessonFileAccess,
  useRequestAssetAccess,
  useSaveLessonNote,
  useUpdateLessonNote,
  useUpsertLessonProgress,
} from "@/hooks/useDashboard"
import { buildCoursePlayerEntries } from "@/lib/course-helpers"
import { getLessonTypeLabel } from "@/lib/product-presentation"
import { formatDateTime } from "@/utils/date"
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
  const assetsQuery = useLessonAdditionalResources(
    module && !module.is_locked ? module.id : undefined,
    lessonSummary && !lessonSummary.is_locked ? lessonSummary.id : undefined,
  )
  const notesQuery = useLessonNotes(
    lessonSummary && !lessonSummary.is_locked && module && !module.is_locked ? lessonSummary.id : undefined,
  )
  const saveLessonNote = useSaveLessonNote()
  const updateLessonNote = useUpdateLessonNote()
  const deleteLessonNote = useDeleteLessonNote()
  const progressMutation = useUpsertLessonProgress()
  const assetAccess = useRequestAssetAccess()
  const lessonPdfAccess = useRequestLessonFileAccess()
  const [noteText, setNoteText] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [noteFeedback, setNoteFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

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

  if (lessonQuery.isLoading || assetsQuery.isLoading || notesQuery.isLoading) {
    return <LoadingState message="A preparar o conteúdo da aula..." />
  }

  if (lessonQuery.isError || assetsQuery.isError || notesQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível abrir esta aula"
        message={
          lessonQuery.error instanceof Error
            ? lessonQuery.error.message
            : assetsQuery.error instanceof Error
              ? assetsQuery.error.message
              : notesQuery.error instanceof Error
                ? notesQuery.error.message
              : "Tenta novamente dentro de instantes."
        }
        onRetry={() => {
          void lessonQuery.refetch()
          void assetsQuery.refetch()
          void notesQuery.refetch()
        }}
      />
    )
  }

  const lesson = lessonQuery.data
  const assets = assetsQuery.data ?? []
  const notes = notesQuery.data ?? []
  const lessonVideoSource = lesson?.youtube_url?.trim() ?? ""
  const resolvedPrimaryVideoSource = lessonVideoSource || null

  if (!lesson) {
    return (
      <EmptyState
        title="Conteúdo indisponivel"
        message="Não foi possível carregar o conteúdo completo desta aula. Tenta novamente dentro de instantes."
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
    const trimmedNote = currentNote.trim()
    if (!trimmedNote) {
      setNoteFeedback({ tone: "error", message: "Escreve uma anotação antes de guardar." })
      return
    }

    try {
      await saveLessonNote.mutateAsync({ lessonId: lesson.id, noteText: trimmedNote })
      setNoteText("")
      setNoteFeedback({ tone: "success", message: "Anotação guardada com sucesso." })
    } catch (saveError) {
      setNoteFeedback({
        tone: "error",
        message: saveError instanceof Error ? saveError.message : "Não foi possível guardar a anotação.",
      })
    }
  }

  const handleStartNoteEdit = (noteId: string, text: string) => {
    setEditingNoteId(noteId)
    setEditingNoteText(text)
    setNoteFeedback(null)
  }

  const handleSaveNoteEdit = async () => {
    if (!editingNoteId) return
    const trimmedNote = editingNoteText.trim()
    if (!trimmedNote) {
      setNoteFeedback({ tone: "error", message: "A anotação não pode ficar vazia." })
      return
    }

    try {
      await updateLessonNote.mutateAsync({ noteId: editingNoteId, noteText: trimmedNote })
      setEditingNoteId(null)
      setEditingNoteText("")
      setNoteFeedback({ tone: "success", message: "Anotação atualizada com sucesso." })
    } catch (updateError) {
      setNoteFeedback({
        tone: "error",
        message: updateError instanceof Error ? updateError.message : "Não foi possível atualizar a anotação.",
      })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Excluir esta anotação? Esta ação não pode ser desfeita.")) return

    try {
      await deleteLessonNote.mutateAsync({ noteId, lessonId: lesson.id })
      if (editingNoteId === noteId) {
        setEditingNoteId(null)
        setEditingNoteText("")
      }
      setNoteFeedback({ tone: "success", message: "Anotação excluída com sucesso." })
    } catch (deleteError) {
      setNoteFeedback({
        tone: "error",
        message: deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a anotação.",
      })
    }
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

  const handleLessonPdfDownload = async () => {
    const result = await lessonPdfAccess.mutateAsync(lesson.id)
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
          {lesson.text_content ? (
            <div className="rounded-[1.5rem] border border-slate-300 bg-slate-50/80 p-6">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4" />
                <p className="font-semibold">Conteúdo textual</p>
              </div>
              <LessonContentBlocksRenderer value={lesson.text_content} className="mt-3" />
            </div>
          ) : null}
          <LessonPdfViewer
            lessonId={lesson.id}
            lessonType={lesson.lesson_type}
            storagePath={lesson.lesson_file_storage_path}
            fileName={lesson.lesson_file_name}
          />
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
          {lesson.lesson_file_storage_path ? (
            <Button
              type="button"
              className="h-11 rounded-full bg-sky-600 px-5 font-black text-white shadow-lg shadow-sky-200 ring-2 ring-sky-100 hover:bg-sky-700"
              onClick={() => void handleLessonPdfDownload()}
              disabled={lessonPdfAccess.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {lessonPdfAccess.isPending ? "A preparar PDF..." : "Baixar PDF da aula"}
            </Button>
          ) : null}
        </div>
      </section>

      <div>
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-slate-900" />
            <h2 className="font-display text-2xl font-black text-slate-950">Anotações da aula</h2>
          </div>
          {noteFeedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${noteFeedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"}`}
              role="status"
            >
              {noteFeedback.message}
            </div>
          ) : null}
          {notes.length > 0 ? (
            <div className="mt-5 space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {editingNoteId === note.id ? (
                        <>
                          <textarea
                            rows={5}
                            value={editingNoteText}
                            onChange={(event) => setEditingNoteText(event.target.value)}
                            className="w-full rounded-2xl border border-sky-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                            autoFocus
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className="rounded-full bg-[#242742] font-bold hover:bg-[#1b1d38]"
                              onClick={() => void handleSaveNoteEdit()}
                              disabled={updateLessonNote.isPending}
                            >
                              <Save className="mr-2 h-4 w-4" />
                              {updateLessonNote.isPending ? "A guardar..." : "Salvar nota"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => {
                                setEditingNoteId(null)
                                setEditingNoteText("")
                              }}
                              disabled={updateLessonNote.isPending}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancelar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{note.note_text}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-full px-3 text-xs"
                              onClick={() => handleStartNoteEdit(note.id, note.note_text)}
                              disabled={deleteLessonNote.isPending || updateLessonNote.isPending}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-full border-rose-200 px-3 text-xs text-rose-700 hover:bg-rose-50"
                              onClick={() => void handleDeleteNote(note.id)}
                              disabled={deleteLessonNote.isPending || updateLessonNote.isPending}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-[11px] leading-5 text-slate-500">
                      <p>
                        <span className="block font-bold uppercase tracking-[0.12em] text-slate-400">Guardada em</span>
                        {formatDateTime(note.created_at)}
                      </p>
                      {note.updated_at !== note.created_at ? (
                        <p className="mt-2">
                          <span className="block font-bold uppercase tracking-[0.12em] text-slate-400">Última edição</span>
                          {formatDateTime(note.updated_at)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Ainda não existem anotações guardadas nesta aula.
            </p>
          )}
          <p className="mt-6 text-sm font-semibold text-slate-700">Nova anotação</p>
          <textarea
            rows={10}
            value={currentNote}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Regista aqui os pontos importantes desta aula."
            className="mt-4 min-h-56 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
          />
          <Button type="button" className="mt-4 rounded-full bg-[#242742] font-bold hover:bg-[#1b1d38]" onClick={() => void handleSaveNote()} disabled={saveLessonNote.isPending}>
            {saveLessonNote.isPending ? "A guardar..." : "Guardar anotação"}
          </Button>
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
