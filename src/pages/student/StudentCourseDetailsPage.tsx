import { Link, useParams } from "react-router-dom"
import {
  ArrowRight,
  Check,
  Clock3,
  FileText,
  LibraryBig,
  LockKeyhole,
  ScrollText,
} from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { RichTextContent } from "@/components/common"
import { Button } from "@/components/ui"
import { useDashboardProductContent, useRequestModulePdfAccess } from "@/hooks/useDashboard"
import {
  buildCoursePlayerEntries,
  createLessonProgressMap,
  findNextLesson,
  getLessonProgressState,
} from "@/lib/course-helpers"
import { getModuleTypeLabel } from "@/lib/product-presentation"
import {
  studentCourseLessonPath,
  studentCourseAssessmentPath,
  studentCoursePlayerPath,
} from "@/lib/routes"
import { richTextToPlainText } from "@/lib/rich-text"

function ProgressRing({ value }: { value: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-600 transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black text-slate-900">{value}%</span>
      </div>
    </div>
  )
}

function formatMinutes(minutes: number | null | undefined) {
  const safeMinutes = Math.max(0, Number(minutes ?? 0))
  if (safeMinutes <= 0) return "Tempo flexivel"
  return `${safeMinutes} Minutos`
}

export function StudentCourseDetailsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { data, isLoading, isError, error, refetch } = useDashboardProductContent(courseId)
  const modulePdfAccess = useRequestModulePdfAccess()

  if (isLoading) {
    return <LoadingState message="A carregar detalhes do material..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar este material"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data?.product) {
    return (
      <EmptyState
        title="Material indisponivel"
        message="Este material não esta liberado na tua conta neste momento."
      />
    )
  }

  const product = data.product
  const progressMap = createLessonProgressMap(data.progress)
  const nextLesson = findNextLesson(data.lessons, progressMap)
  const completedLessons = data.progress.filter((item) => item.status === "completed").length
  const progressPercent =
    data.lessons.length > 0 ? Math.round((completedLessons / data.lessons.length) * 100) : 0
  const playerEntries = buildCoursePlayerEntries(data.modules, data.lessons, data.assessments)
  const firstUnlockedEntry = playerEntries.find((entry) => !entry.isLocked) ?? null
  const startPath = nextLesson
    ? studentCourseLessonPath(product.id, nextLesson.id)
    : firstUnlockedEntry?.type === "assessment"
      ? studentCourseAssessmentPath(product.id, firstUnlockedEntry.id)
      : studentCoursePlayerPath(product.id)
  const description =
    richTextToPlainText(product.description) ||
    richTextToPlainText(product.short_description) ||
    "Material pronto para continuares o estudo com clareza."

  return (
    <section className="rounded-[34px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
      <div className="space-y-12 pb-10 animate-in fade-in duration-700">
        <section className="relative flex min-h-[400px] flex-col justify-end overflow-hidden rounded-[48px] bg-slate-900 p-8 shadow-2xl md:p-16">
          {product.cover_image_url ? (
            <img
              src={product.cover_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_48%,#242742_100%)]" />
          )}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
          <div className="relative z-20 max-w-4xl space-y-6">
            <div className="space-y-4">
            <Link to="/aluno/cursos" className="inline-flex text-xs font-black uppercase tracking-[0.22em] text-white/55 transition hover:text-white">
              Voltar aos materiais
            </Link>
              <h1 className="font-display text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                  <Clock3 className="h-5 w-5 text-blue-400" />
                  {formatMinutes(product.workload_minutes)}
                </span>
                <span className="flex items-center gap-2 text-sm font-bold text-slate-300">
                  <LibraryBig className="h-5 w-5 text-blue-400" />
                  {data.modules.length} Módulo{data.modules.length === 1 ? "" : "s"}
                </span>
                <div className="hidden h-6 w-px bg-white/10 md:block" />
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="text-sm font-black text-white">
                    {progressPercent}% <span className="ml-1 text-[10px] uppercase text-white/40">Concluido</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button asChild className="h-16 rounded-2xl bg-white px-10 text-lg font-black text-slate-900 shadow-xl hover:bg-slate-100">
                <Link to={startPath}>
                  {progressPercent > 0 ? "Continuar aprendizado" : "Iniciar aprendizado"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm animate-in slide-in-from-top-4 duration-700">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
              <ProgressRing value={progressPercent} />
              <div className="min-w-0 space-y-1">
                <h5 className="text-[10px] font-black uppercase leading-none tracking-[0.2em] text-slate-400">
                  Resumo da jornada
                </h5>
                <p className="text-sm font-bold text-slate-900">O teu progresso atual neste material</p>
                <div className="flex h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="flex w-fit min-w-fit flex-col items-start justify-center gap-1 self-start rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 lg:shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aulas</span>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black leading-none text-slate-900">{completedLessons}</span>
                <span className="text-2xl font-black leading-none text-slate-300">/</span>
                <span className="text-3xl font-black leading-none text-slate-900">{data.lessons.length}</span>
              </div>
              <div className="inline-flex w-fit items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">
                Concluídas
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-8 rounded-[40px] border border-slate-100 bg-white p-10 shadow-sm animate-in slide-in-from-bottom-4 duration-700 md:p-14">
          <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-black uppercase leading-none tracking-[0.2em] text-slate-400">Sobre este material</h3>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <RichTextContent
            value={product.description}
            fallback={description}
            className="text-lg font-medium leading-relaxed text-slate-600"
          />
        </section>

        <div className="space-y-12">
          <div className="space-y-8">
            {data.modules.map((module, moduleIndex) => {
              const moduleLessons = data.lessons.filter((lesson) => lesson.module_id === module.id)
              const moduleAssessments = data.assessments.filter(
                (assessment) => assessment.module_id === module.id && assessment.assessment_type === "module",
              )
              const moduleCompletedLessons = moduleLessons.filter((lesson) => progressMap.get(lesson.id)?.status === "completed").length
              const moduleProgressPercent = moduleLessons.length > 0
                ? Math.round((moduleCompletedLessons / moduleLessons.length) * 100)
                : 0
              const moduleStatus = module.is_locked
                ? "Bloqueado"
                : moduleProgressPercent >= 100
                  ? "Concluido"
                  : moduleProgressPercent > 0
                    ? "Em andamento"
                    : "Por iniciar"

              return (
                <div key={module.id} className="group">
                  <div className="flex items-start gap-6">
                    <div className="hidden flex-col items-center gap-2 pt-2 md:flex">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 font-black text-white shadow-lg shadow-blue-100 transition-all">
                        {moduleIndex + 1}
                      </div>
                      <div className="min-h-[100px] w-0.5 flex-1 bg-slate-100 group-last:hidden" />
                    </div>

                    <div className="flex-1 space-y-6">
                      <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm transition-all group-hover:shadow-md">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              {getModuleTypeLabel(module.module_type)}
                            </p>
                            <h4 className="text-xl font-black text-slate-900 transition-colors group-hover:text-blue-600">
                              {module.title}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
                              {moduleStatus}
                            </span>
                            {module.module_pdf_file_name && !module.is_locked ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex h-8 items-center gap-1.5 rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                                disabled={modulePdfAccess.isPending}
                                onClick={() =>
                                  void modulePdfAccess
                                    .mutateAsync(module.id)
                                    .then((result) => window.open(result.url, "_blank", "noopener,noreferrer"))
                                }
                              >
                                <FileText className="h-3.5 w-3.5 text-rose-500" />
                                {modulePdfAccess.isPending ? "A preparar" : "Baixar PDF"}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <RichTextContent
                          value={module.description}
                          fallback="Módulo organizado para avancares com clareza dentro da trilha do material."
                          className="mb-8 text-sm font-medium leading-relaxed text-slate-500"
                        />

                        {module.is_locked && module.lock_reason ? (
                          <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50/50 p-5 text-sm font-bold text-amber-700">
                            {module.lock_reason}
                          </div>
                        ) : null}

                        <div className="space-y-4">
                          {moduleLessons.map((lesson) => {
                            const lessonState = getLessonProgressState(lesson.id, progressMap)
                            const isCompleted = lessonState.label.toLowerCase().includes("concl")

                            return (
                              <div key={lesson.id} className="group/item flex items-center gap-2">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-inner transition-all ${
                                    isCompleted
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-300 group-hover/item:text-blue-500"
                                  }`}
                                >
                                  {lesson.is_locked ? <LockKeyhole className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </span>
                                {lesson.is_locked ? (
                                  <div className="flex flex-1 items-center justify-between rounded-2xl border border-transparent bg-slate-50/50 p-4 opacity-75">
                                    <div>
                                      <p className="text-sm font-bold text-slate-700">{lesson.title}</p>
                                      <span className="text-[9px] font-black uppercase tracking-tight text-amber-500">
                                        {lesson.lock_reason || "Bloqueada"}
                                      </span>
                                    </div>
                                    <LockKeyhole className="h-4 w-4 text-slate-300" />
                                  </div>
                                ) : (
                                  <Link
                                    to={studentCourseLessonPath(product.id, lesson.id)}
                                    className="flex flex-1 items-center justify-between rounded-2xl border border-transparent bg-slate-50/50 p-4 transition-all hover:border-blue-100 hover:bg-blue-50/50"
                                  >
                                    <div>
                                      <p className="text-sm font-bold text-slate-700">{lesson.title}</p>
                                      <span className="text-[9px] font-black uppercase tracking-tight text-blue-400">
                                        {lesson.is_required ? "Obrigatória" : "Complementar"} · {lesson.estimated_minutes} min
                                      </span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover/item:translate-x-1" />
                                  </Link>
                                )}
                              </div>
                            )
                          })}

                          {moduleAssessments.map((assessment) => (
                            <div
                              key={assessment.id}
                              className={`mt-6 rounded-[24px] border border-dashed p-6 transition-all ${
                                assessment.is_locked ? "border-amber-200 bg-amber-50/40" : "border-blue-200 bg-blue-50/40"
                              }`}
                            >
                              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                      assessment.is_locked ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                    }`}>
                                      <ScrollText className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-tight text-slate-800">
                                      Quiz: {assessment.title}
                                    </span>
                                  </div>
                                  <p className={`text-xs font-bold ${assessment.is_locked ? "text-amber-600" : "text-blue-600"}`}>
                                    {assessment.is_locked
                                      ? assessment.lock_reason || "Conclua os requisitos para liberar o quiz"
                                      : `Pontuacao minima: ${assessment.passing_score}%`}
                                  </p>
                                </div>
                                {assessment.is_locked ? (
                                  <Button type="button" size="sm" disabled className="h-11 rounded-xl px-6 text-[0.8rem] font-black">
                                    Quiz bloqueado
                                  </Button>
                                ) : (
                                  <Button asChild size="sm" className="h-11 rounded-xl bg-blue-600 px-6 text-[0.8rem] font-black">
                                    <Link to={studentCourseAssessmentPath(product.id, assessment.id)}>
                                      Abrir quiz
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
