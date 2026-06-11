import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { ArrowLeft, BookOpen, ClipboardCheck, PanelLeftClose, PlayCircle } from "lucide-react"
import { useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { SiteAiPageEditorLauncher, StatusBadge } from "@/components/common"
import { useDashboardProductContent } from "@/hooks/useDashboard"
import {
  buildCoursePlayerEntries,
  createLessonProgressMap,
  findNextLesson,
  getLessonProgressState,
} from "@/lib/course-helpers"
import {
  studentCourseAssessmentPath,
  studentCourseLessonPath,
  studentCoursePath,
} from "@/lib/routes"
import type {
  CourseAssessmentNavigationSummary,
  CourseLessonNavigationSummary,
  CourseModuleNavigationSummary,
  DashboardProductSummary,
  LessonProgressSummary,
} from "@/types/app.types"

export interface StudentCoursePlayerContext {
  courseId: string
  product: DashboardProductSummary
  modules: CourseModuleNavigationSummary[]
  lessons: CourseLessonNavigationSummary[]
  assessments: CourseAssessmentNavigationSummary[]
  progress: LessonProgressSummary[]
}

export function StudentCoursePlayerLayout() {
  const { courseId, lessonId, assessmentId } = useParams<{
    courseId: string
    lessonId?: string
    assessmentId?: string
  }>()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { data, isLoading, isError, error, refetch } = useDashboardProductContent(courseId)

  if (isLoading) {
    return <LoadingState message="A abrir o player do material..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível abrir o player"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data?.product) {
    return (
      <EmptyState
        title="Material indisponivel"
        message="Este material não esta acessivel na tua conta neste momento."
      />
    )
  }

  const product = data.product

  const progressMap = createLessonProgressMap(data.progress)
  const completedLessons = data.progress.filter((item) => item.status === "completed").length
  const progressPercent =
    data.lessons.length > 0 ? Math.round((completedLessons / data.lessons.length) * 100) : 0
  const nextLesson = findNextLesson(data.lessons, progressMap)
  const entries = buildCoursePlayerEntries(data.modules, data.lessons, data.assessments)
  const firstUnlockedEntry = entries.find((entry) => !entry.isLocked) ?? null

  if (!lessonId && !assessmentId && nextLesson) {
    return <Navigate to={studentCourseLessonPath(product.id, nextLesson.id)} replace />
  }

  if (!lessonId && !assessmentId && firstUnlockedEntry?.type === "assessment") {
    return <Navigate to={studentCourseAssessmentPath(product.id, firstUnlockedEntry.id)} replace />
  }

  const context: StudentCoursePlayerContext = {
    courseId: product.id,
    product,
    modules: data.modules,
    lessons: data.lessons,
    assessments: data.assessments,
    progress: data.progress,
  }

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-slate-50 text-white">
      <aside
        className={`${sidebarOpen ? "w-80" : "w-0 overflow-hidden"} hidden shrink-0 border-r border-slate-200 bg-white text-slate-950 transition-all duration-200 lg:block`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSidebarOpen((value) => !value)}
                className="rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              {sidebarOpen ? (
                <Button asChild variant="ghost" className="rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-950">
                  <Link to={studentCoursePath(product.id)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao material
                  </Link>
                </Button>
              ) : null}
            </div>

            {sidebarOpen ? (
              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Player LMS</p>
                <h1 className="mt-2 line-clamp-2 text-xl font-black text-slate-950">{product.title}</h1>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    <span>Progresso geral</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#1398B7]" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {data.modules.map((module, index) => {
              const moduleLessons = data.lessons.filter((lesson) => lesson.module_id === module.id)
              const moduleAssessments = data.assessments.filter(
                (assessment) => assessment.module_id === module.id && assessment.assessment_type === "module",
              )

              return (
                <div key={module.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
                  {sidebarOpen ? (
                    <>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Módulo {index + 1}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">{module.title}</p>
                        {module.is_locked ? <StatusBadge label="Bloqueado" tone="warning" /> : null}
                      </div>
                      {module.is_locked && module.lock_reason ? (
                        <p className="mt-2 text-xs leading-6 text-slate-500">{module.lock_reason}</p>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex justify-center">
                      <BookOpen className="h-4 w-4 text-slate-500" />
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {moduleLessons.map((lesson) => {
                      const state = getLessonProgressState(lesson.id, progressMap)
                      const itemClass = `block rounded-2xl border px-3 py-3 transition ${
                        lesson.is_locked
                          ? "cursor-not-allowed border-slate-200 bg-white opacity-70 grayscale"
                          : location.pathname.includes(`/aulas/${lesson.id}`)
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                      }`

                      const content = sidebarOpen ? (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-950">{lesson.title}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                              {lesson.lesson_type}
                            </p>
                            {lesson.is_locked && lesson.lock_reason ? (
                              <p className="mt-2 text-xs leading-5 text-slate-500">{lesson.lock_reason}</p>
                            ) : null}
                          </div>
                          <StatusBadge label={lesson.is_locked ? "Bloqueada" : state.label} tone={lesson.is_locked ? "warning" : state.tone} />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <PlayCircle className="h-4 w-4 text-slate-500" />
                        </div>
                      )

                      return lesson.is_locked ? (
                        <div key={lesson.id} className={itemClass}>
                          {content}
                        </div>
                      ) : (
                        <NavLink
                          key={lesson.id}
                          to={studentCourseLessonPath(product.id, lesson.id)}
                          className={() => itemClass}
                        >
                          {content}
                        </NavLink>
                      )
                    })}

                    {moduleAssessments.map((assessment) => (
                      assessment.is_locked ? (
                        <div key={assessment.id} className="block rounded-2xl border border-slate-200 bg-white px-3 py-3 opacity-70 grayscale">
                          {sidebarOpen ? (
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-950">{assessment.title}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                  Quiz do módulo
                                </p>
                                {assessment.lock_reason ? (
                                  <p className="mt-2 text-xs leading-5 text-slate-500">{assessment.lock_reason}</p>
                                ) : null}
                              </div>
                              <StatusBadge label="Bloqueado" tone="warning" />
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <ClipboardCheck className="h-4 w-4 text-amber-500" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <NavLink
                          key={assessment.id}
                          to={studentCourseAssessmentPath(product.id, assessment.id)}
                          className={() =>
                            `block rounded-2xl border px-3 py-3 transition ${
                              location.pathname.includes(`/avalia??es/${assessment.id}`)
                                ? "border-amber-200 bg-amber-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`
                          }
                        >
                          {sidebarOpen ? (
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-950">{assessment.title}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                  Quiz do módulo
                                </p>
                              </div>
                              <StatusBadge
                                label={
                                  assessment.progress_state === "passed"
                                    ? "Aprovado"
                                    : assessment.progress_state === "pending_review"
                                      ? "Em revisão"
                                      : assessment.progress_state === "failed"
                                        ? "Reprovado"
                                        : "Disponível"
                                }
                                tone={
                                  assessment.progress_state === "passed"
                                    ? "success"
                                    : assessment.progress_state === "failed"
                                      ? "danger"
                                      : assessment.progress_state === "pending_review"
                                        ? "warning"
                                        : "info"
                                }
                              />
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <ClipboardCheck className="h-4 w-4 text-amber-500" />
                            </div>
                          )}
                        </NavLink>
                      )
                    ))}
                  </div>
                </div>
              )
            })}

            {data.assessments.filter((assessment) => assessment.assessment_type === "final").map((assessment) => (
              assessment.is_locked ? (
                <div key={assessment.id} className="block rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 opacity-70 grayscale">
                  {sidebarOpen ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{assessment.title}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Avaliação final</p>
                        {assessment.lock_reason ? (
                          <p className="mt-2 text-xs leading-5 text-slate-500">{assessment.lock_reason}</p>
                        ) : null}
                      </div>
                      <StatusBadge label="Bloqueada" tone="warning" />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={assessment.id}
                  to={studentCourseAssessmentPath(product.id, assessment.id)}
                  className={() =>
                    `block rounded-[1.5rem] border px-4 py-4 transition ${
                      location.pathname.includes(`/avalia??es/${assessment.id}`)
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`
                  }
                >
                  {sidebarOpen ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{assessment.title}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Avaliação final</p>
                      </div>
                      <StatusBadge
                        label={
                          assessment.progress_state === "passed"
                            ? "Aprovada"
                            : assessment.progress_state === "pending_review"
                              ? "Em revisão"
                              : assessment.progress_state === "failed"
                                ? "Reprovada"
                                : "Final"
                        }
                        tone={
                          assessment.progress_state === "passed"
                            ? "success"
                            : assessment.progress_state === "failed"
                              ? "danger"
                              : assessment.progress_state === "pending_review"
                                ? "warning"
                                : "success"
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                </NavLink>
              )
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#eef5fb_100%)] text-slate-950">
        <header className="min-h-16 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSidebarOpen((value) => !value)}
                className="hidden h-10 w-10 rounded-2xl p-0 lg:inline-flex"
                aria-label={sidebarOpen ? "Recolher navegação do material" : "Abrir navegação do material"}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Material em andamento</p>
                <h2 className="mt-1 truncate font-display text-xl font-black text-slate-950 md:text-2xl">{product.title}</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={`${progressPercent}% concluido`} tone="warning" />
              <StatusBadge label={`${data.modules.length} módulos`} tone="info" />
              {product.has_linear_progression ? (
                <StatusBadge label="Progressao linear ativa" tone="warning" />
              ) : null}
              <Button asChild variant="outline" className="h-8 rounded-full px-3 text-xs font-black">
                <Link to={studentCoursePath(product.id)}>Sair do player</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={context} />
        </main>
      </div>
      <SiteAiPageEditorLauncher />
    </div>
  )
}
