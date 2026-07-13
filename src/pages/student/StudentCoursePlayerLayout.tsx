import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { ArrowLeft, BookOpen, Check, ClipboardCheck, PanelLeftClose, PlayCircle, Search } from "lucide-react"
import { useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { SiteAiCodeEditorLauncher, StatusBadge } from "@/components/common"
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
import { getLessonTypeLabel } from "@/lib/product-presentation"
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

interface SidebarModule {
  module: CourseModuleNavigationSummary
  index: number
  lessons: CourseLessonNavigationSummary[]
  assessments: CourseAssessmentNavigationSummary[]
}

interface CourseSidebarProps {
  product: DashboardProductSummary
  progressMap: Map<string, LessonProgressSummary>
  visibleModules: SidebarModule[]
  finalAssessments: CourseAssessmentNavigationSummary[]
  locationPath: string
  progressPercent: number
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onClose: () => void
}

function CourseSidebar({
  product,
  progressMap,
  visibleModules,
  finalAssessments,
  locationPath,
  progressPercent,
  searchQuery,
  onSearchQueryChange,
  onClose,
}: CourseSidebarProps) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="min-h-16 border-b border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 rounded-xl p-0 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            aria-label="Recolher navegação do material"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
          <Button asChild variant="ghost" className="h-9 rounded-xl px-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950">
            <Link to={studentCoursePath(product.id)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao material
            </Link>
          </Button>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Player LMS</p>
        <h1 className="mt-2 line-clamp-2 font-display text-xl font-black text-slate-950">{product.title}</h1>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            <span>Progresso geral</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <label className="mt-4 block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Buscar no conteúdo</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Módulo, aula ou quiz"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500"
            />
          </span>
        </label>
      </div>

      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {visibleModules.map(({ module, index, lessons, assessments }) => (
          <section key={module.id} className="min-w-0 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
            <p className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Módulo {index + 1}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
              <p className="font-bold text-slate-950">{module.title}</p>
              {module.is_locked ? <StatusBadge label="Bloqueado" tone="warning" /> : null}
            </div>
            {module.is_locked && module.lock_reason ? (
              <p className="mt-2 px-1 text-xs leading-6 text-slate-500">{module.lock_reason}</p>
            ) : null}

            <div className="mt-3 space-y-1">
              {lessons.map((lesson) => {
                const state = getLessonProgressState(lesson.id, progressMap)
                const isCurrent = locationPath.includes(`/aulas/${lesson.id}`)
                const isCompleted = state.label.toLocaleLowerCase().includes("concl")
                const content = (
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isCompleted
                          ? "border-blue-600 bg-blue-600 text-white"
                          : isCurrent
                            ? "border-2 border-blue-500"
                            : "border-slate-300 bg-white"
                      }`}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : isCurrent ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-bold ${isCurrent ? "text-blue-700" : "text-slate-700"}`}>{lesson.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        <PlayCircle className="h-3 w-3" />
                        {getLessonTypeLabel(lesson.lesson_type)} · {lesson.estimated_minutes} min
                      </p>
                      {lesson.is_locked && lesson.lock_reason ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">{lesson.lock_reason}</p>
                      ) : null}
                    </div>
                    <StatusBadge label={lesson.is_locked ? "Bloqueada" : state.label} tone={lesson.is_locked ? "warning" : state.tone} />
                  </div>
                )

                return lesson.is_locked ? (
                  <div key={lesson.id} className="block min-w-0 cursor-not-allowed rounded-xl border border-slate-200 bg-white px-3 py-3 opacity-70 grayscale">
                    {content}
                  </div>
                ) : (
                  <NavLink
                    key={lesson.id}
                    to={studentCourseLessonPath(product.id, lesson.id)}
                    className={`group block min-w-0 rounded-xl border px-3 py-3 transition ${
                      isCurrent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-100"
                    }`}
                  >
                    {content}
                  </NavLink>
                )
              })}

              {assessments.map((assessment) => {
                const isCurrent = locationPath.includes(`/avaliacoes/${assessment.id}`)
                const content = (
                  <div className="flex min-w-0 items-start gap-3">
                    <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-950">{assessment.title}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Quiz do módulo</p>
                      {assessment.is_locked && assessment.lock_reason ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">{assessment.lock_reason}</p>
                      ) : null}
                    </div>
                    <StatusBadge
                      label={assessment.is_locked ? "Bloqueado" : assessment.progress_state === "passed" ? "Aprovado" : "Disponível"}
                      tone={assessment.is_locked ? "warning" : assessment.progress_state === "passed" ? "success" : "info"}
                    />
                  </div>
                )

                return assessment.is_locked ? (
                  <div key={assessment.id} className="block min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 opacity-70 grayscale">
                    {content}
                  </div>
                ) : (
                  <NavLink
                    key={assessment.id}
                    to={studentCourseAssessmentPath(product.id, assessment.id)}
                    className={`block min-w-0 rounded-xl border px-3 py-3 transition ${
                      isCurrent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-100"
                    }`}
                  >
                    {content}
                  </NavLink>
                )
              })}
            </div>
          </section>
        ))}

        {finalAssessments.map((assessment) => {
          const isCurrent = locationPath.includes(`/avaliacoes/${assessment.id}`)
          const content = (
            <div className="flex min-w-0 items-start gap-3">
              <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-950">{assessment.title}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Avaliação final</p>
                {assessment.is_locked && assessment.lock_reason ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">{assessment.lock_reason}</p>
                ) : null}
              </div>
              <StatusBadge label={assessment.is_locked ? "Bloqueada" : "Final"} tone={assessment.is_locked ? "warning" : "success"} />
            </div>
          )

          return assessment.is_locked ? (
            <div key={assessment.id} className="block min-w-0 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 opacity-70 grayscale">
              {content}
            </div>
          ) : (
            <NavLink
              key={assessment.id}
              to={studentCourseAssessmentPath(product.id, assessment.id)}
              className={`block min-w-0 rounded-[1.5rem] border px-4 py-4 transition ${
                isCurrent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              {content}
            </NavLink>
          )
        })}

        {visibleModules.length === 0 && finalAssessments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <Search className="mx-auto h-5 w-5 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Nenhum conteúdo encontrado.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function StudentCoursePlayerLayout() {
  const { courseId, lessonId, assessmentId } = useParams<{
    courseId: string
    lessonId?: string
    assessmentId?: string
  }>()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { data, isLoading, isError, error, refetch } = useDashboardProductContent(courseId)

  if (isLoading) return <LoadingState message="A abrir o player do material..." />

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
    return <EmptyState title="Material indisponível" message="Este material não está acessível na tua conta neste momento." />
  }

  const product = data.product
  const progressMap = createLessonProgressMap(data.progress)
  const completedLessons = data.progress.filter((item) => item.status === "completed").length
  const progressPercent = data.lessons.length > 0 ? Math.round((completedLessons / data.lessons.length) * 100) : 0
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
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleModules: SidebarModule[] = data.modules
        .map((module, index) => ({
          module,
          index,
          lessons: data.lessons.filter(
            (lesson) =>
              lesson.module_id === module.id &&
              (!normalizedSearchQuery ||
                `${lesson.title} ${getLessonTypeLabel(lesson.lesson_type)}`.toLocaleLowerCase().includes(normalizedSearchQuery)),
          ),
          assessments: data.assessments.filter(
            (assessment) =>
              assessment.module_id === module.id &&
              assessment.assessment_type === "module" &&
              (!normalizedSearchQuery || assessment.title.toLocaleLowerCase().includes(normalizedSearchQuery)),
          ),
        }))
        .filter(({ module, lessons, assessments }) =>
          !normalizedSearchQuery ||
          module.title.toLocaleLowerCase().includes(normalizedSearchQuery) ||
          lessons.length > 0 ||
          assessments.length > 0,
        )
  const finalAssessments = data.assessments.filter(
    (assessment) =>
      assessment.assessment_type === "final" &&
      (!normalizedSearchQuery || assessment.title.toLocaleLowerCase().includes(normalizedSearchQuery)),
  )

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Fechar navegação do material"
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`${sidebarOpen ? "flex lg:w-80" : "hidden lg:flex lg:w-0 lg:overflow-hidden"} fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] min-w-0 shrink-0 overflow-x-hidden border-r border-slate-200 bg-white text-slate-950 shadow-xl transition-all duration-200 lg:static lg:z-auto lg:shadow-none`}
      >
        <CourseSidebar
          product={product}
          progressMap={progressMap}
          visibleModules={visibleModules}
          finalAssessments={finalAssessments}
          locationPath={location.pathname}
          progressPercent={progressPercent}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#eef5fb_100%)]">
        <header className="min-h-16 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSidebarOpen((value) => !value)}
                className="h-10 w-10 rounded-2xl p-0"
                aria-label={sidebarOpen ? "Recolher navegação do material" : "Abrir navegação do material"}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-slate-700 sm:flex">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Material em andamento</p>
                  <h2 className="mt-1 truncate font-display text-xl font-black text-slate-950 md:text-2xl">{product.title}</h2>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={`${progressPercent}% concluído`} tone="warning" />
              <StatusBadge label={`${data.modules.length} módulos`} tone="info" />
              <Button asChild variant="outline" className="h-8 rounded-full px-3 text-xs font-black">
                <Link to={studentCoursePath(product.id)}>Sair do player</Link>
              </Button>
            </div>
          </div>
          <label className="mt-3 block max-w-sm lg:hidden">
            <span className="sr-only">Buscar no conteúdo</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar módulo, aula ou quiz"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
              />
            </span>
          </label>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 xl:p-8">
          <div className="mx-auto max-w-[1500px]">
            <Outlet context={context} />
          </div>
        </main>
      </div>
      <SiteAiCodeEditorLauncher />
    </div>
  )
}
