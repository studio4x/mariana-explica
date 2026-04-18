import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { ArrowLeft, BookOpen, ClipboardCheck, PanelLeftClose, PlayCircle } from "lucide-react"
import { useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
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
  DashboardProductSummary,
  LessonProgressSummary,
  ModuleAssetSummary,
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"

export interface StudentCoursePlayerContext {
  courseId: string
  product: DashboardProductSummary
  modules: ProductModuleSummary[]
  lessons: ProductLessonSummary[]
  assets: ModuleAssetSummary[]
  assessments: ProductAssessmentSummary[]
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
    return <LoadingState message="A abrir o player do curso..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel abrir o player"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data?.product) {
    return (
      <EmptyState
        title="Curso indisponivel"
        message="Este curso nao esta acessivel na tua conta neste momento."
      />
    )
  }

  const progressMap = createLessonProgressMap(data.progress)
  const completedLessons = data.progress.filter((item) => item.status === "completed").length
  const progressPercent =
    data.lessons.length > 0 ? Math.round((completedLessons / data.lessons.length) * 100) : 0
  const nextLesson = findNextLesson(data.lessons, progressMap)
  const entries = buildCoursePlayerEntries(data.modules, data.lessons, data.assessments)

  if (!lessonId && !assessmentId && nextLesson) {
    return <Navigate to={studentCourseLessonPath(data.product.id, nextLesson.id)} replace />
  }

  if (!lessonId && !assessmentId && entries[0]?.type === "assessment") {
    return <Navigate to={studentCourseAssessmentPath(data.product.id, entries[0].id)} replace />
  }

  const context: StudentCoursePlayerContext = {
    courseId: data.product.id,
    product: data.product,
    modules: data.modules,
    lessons: data.lessons,
    assets: data.assets,
    assessments: data.assessments,
    progress: data.progress,
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] overflow-hidden rounded-[2rem] border bg-slate-950 text-white shadow-sm">
      <aside
        className={`${sidebarOpen ? "w-[320px]" : "w-[92px]"} hidden shrink-0 border-r border-white/10 bg-slate-950/95 transition-all duration-200 lg:block`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSidebarOpen((value) => !value)}
                className="rounded-full text-white hover:bg-white/10 hover:text-white"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              {sidebarOpen ? (
                <Button asChild variant="ghost" className="rounded-full text-white hover:bg-white/10 hover:text-white">
                  <Link to={studentCoursePath(data.product.id)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao curso
                  </Link>
                </Button>
              ) : null}
            </div>

            {sidebarOpen ? (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.2em] text-white/55">Player LMS</p>
                <h1 className="mt-2 text-xl font-semibold">{data.product.title}</h1>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/55">
                    <span>Progresso geral</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${progressPercent}%` }} />
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
                <div key={module.id} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-3">
                  {sidebarOpen ? (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Modulo {index + 1}</p>
                      <p className="mt-2 font-medium">{module.title}</p>
                    </>
                  ) : (
                    <div className="flex justify-center">
                      <BookOpen className="h-4 w-4 text-white/75" />
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {moduleLessons.map((lesson) => {
                      const state = getLessonProgressState(lesson.id, progressMap)
                      return (
                        <NavLink
                          key={lesson.id}
                          to={studentCourseLessonPath(data.product.id, lesson.id)}
                          className={() =>
                            `block rounded-2xl border px-3 py-3 transition ${
                              location.pathname.includes(`/aulas/${lesson.id}`)
                                ? "border-cyan-300 bg-cyan-300/15"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`
                          }
                        >
                          {sidebarOpen ? (
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{lesson.title}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                                  {lesson.lesson_type}
                                </p>
                              </div>
                              <StatusBadge label={state.label} tone={state.tone} />
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <PlayCircle className="h-4 w-4 text-white/75" />
                            </div>
                          )}
                        </NavLink>
                      )
                    })}

                    {moduleAssessments.map((assessment) => (
                      <NavLink
                        key={assessment.id}
                        to={studentCourseAssessmentPath(data.product.id, assessment.id)}
                        className={() =>
                          `block rounded-2xl border px-3 py-3 transition ${
                            location.pathname.includes(`/avaliacoes/${assessment.id}`)
                              ? "border-amber-300 bg-amber-300/15"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`
                        }
                      >
                        {sidebarOpen ? (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{assessment.title}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                                Quiz do modulo
                              </p>
                            </div>
                            <ClipboardCheck className="h-4 w-4 text-amber-200" />
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <ClipboardCheck className="h-4 w-4 text-amber-200" />
                          </div>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            })}

            {data.assessments.filter((assessment) => assessment.assessment_type === "final").map((assessment) => (
              <NavLink
                key={assessment.id}
                to={studentCourseAssessmentPath(data.product.id, assessment.id)}
                className={() =>
                  `block rounded-[1.5rem] border px-4 py-4 transition ${
                    location.pathname.includes(`/avaliacoes/${assessment.id}`)
                      ? "border-emerald-300 bg-emerald-300/15"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`
                }
              >
                {sidebarOpen ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{assessment.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">Avaliacao final</p>
                    </div>
                    <StatusBadge label="Final" tone="success" />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <ClipboardCheck className="h-4 w-4 text-emerald-200" />
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#eef5fb_100%)] text-slate-950">
        <header className="border-b bg-white/80 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Curso em andamento</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-slate-950">{data.product.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={`${progressPercent}% concluido`} tone="warning" />
              <StatusBadge label={`${data.modules.length} modulos`} tone="info" />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  )
}
