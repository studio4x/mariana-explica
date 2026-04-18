import { Link, useOutletContext, useParams } from "react-router-dom"
import { FileText, PlayCircle, StickyNote } from "lucide-react"
import { useEffect, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
import {
  useAccessibleLesson,
  useLessonNote,
  useModuleAssets,
  useRequestAssetAccess,
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
  const [noteText, setNoteText] = useState("")

  useEffect(() => {
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

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{module.title}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950">{lesson.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">
              {lesson.description ?? "Aula pronta para leitura, video e continuidade do estudo."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={lesson.lesson_type === "hybrid" ? "Hibrida" : lesson.lesson_type === "video" ? "Video" : "Texto"} tone="info" />
            <StatusBadge label={`${lesson.estimated_minutes} min`} tone="warning" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {lesson.youtube_url ? (
            <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <PlayCircle className="h-4 w-4" />
                <p className="font-medium">Video principal</p>
              </div>
              <p className="mt-3 break-all text-sm leading-7 text-slate-600">{lesson.youtube_url}</p>
            </div>
          ) : null}

          {lesson.text_content ? (
            <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4" />
                <p className="font-medium">Conteudo textual</p>
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                {lesson.text_content}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" className="rounded-full" onClick={() => void handleProgress("in_progress")} disabled={progressMutation.isPending}>
            Marcar em progresso
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleProgress("completed")} disabled={progressMutation.isPending}>
            Concluir aula
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
            {assets.length === 0 ? (
              <EmptyState
                title="Sem materiais adicionais"
                message="Quando houver PDFs, links ou videos de apoio, eles aparecem aqui."
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
            <p className="mt-1 text-sm text-slate-600">Avanca pela trilha respeitando a estrutura do curso.</p>
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
