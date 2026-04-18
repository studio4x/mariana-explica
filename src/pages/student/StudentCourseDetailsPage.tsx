import { Link, useParams } from "react-router-dom"
import { BookOpenCheck, Clock3, PlayCircle } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useDashboardProductContent } from "@/hooks/useDashboard"
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

export function StudentCourseDetailsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { data, isLoading, isError, error, refetch } = useDashboardProductContent(courseId)

  if (isLoading) {
    return <LoadingState message="A carregar detalhes do curso..." />
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
        title="Curso indisponivel"
        message="Este curso nao esta liberado na tua conta neste momento."
      />
    )
  }

  const progressMap = createLessonProgressMap(data.progress)
  const nextLesson = findNextLesson(data.lessons, progressMap)
  const completedLessons = data.progress.filter((item) => item.status === "completed").length
  const progressPercent =
    data.lessons.length > 0 ? Math.round((completedLessons / data.lessons.length) * 100) : 0
  const playerEntries = buildCoursePlayerEntries(data.modules, data.lessons, data.assessments)
  const firstUnlockedEntry = playerEntries.find((entry) => !entry.isLocked) ?? null
  const lockedLessonsCount = data.lessons.filter((lesson) => lesson.is_locked).length
  const lockedAssessmentsCount = data.assessments.filter((assessment) => assessment.is_locked).length
  const assessmentsByModule = new Map(
    data.modules.map((module) => [
      module.id,
      data.assessments.filter(
        (assessment) => assessment.module_id === module.id && assessment.assessment_type === "module",
      ),
    ]),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.product.title}
        description={data.product.short_description ?? data.product.description ?? "Curso pronto para continuares o estudo."}
        backTo="/aluno/cursos"
      />

      <section className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,#1e293b_0%,#0f4c81_52%,#0f172a_100%)] p-6 text-white shadow-sm md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/65">Curso liberado</p>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-5xl">{data.product.title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-white/80 md:text-base">
              {data.product.description ?? "Segue a trilha do curso, retoma do ponto onde paraste e entra no player para estudar com foco."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge label={`${data.modules.length} modulos`} tone="info" />
              <StatusBadge label={`${data.lessons.length} aulas`} tone="warning" />
              <StatusBadge label={`${data.assessments.length} avaliacoes`} tone="success" />
              {data.product.has_linear_progression ? <StatusBadge label="Trilha sequencial" tone="warning" /> : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-white text-slate-950 hover:bg-white/90">
                <Link
                  to={
                    nextLesson
                      ? studentCourseLessonPath(data.product.id, nextLesson.id)
                      : firstUnlockedEntry?.type === "assessment"
                        ? studentCourseAssessmentPath(data.product.id, firstUnlockedEntry.id)
                        : studentCoursePlayerPath(data.product.id)
                  }
                >
                  {progressPercent > 0 ? "Continuar no player" : "Iniciar curso"}
                  <PlayCircle className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/25 bg-white/10 text-white hover:bg-white/15">
                <Link to={studentCoursePlayerPath(data.product.id)}>Abrir estrutura completa</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.5rem] bg-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Progresso geral</p>
              <p className="mt-3 text-3xl font-bold">{progressPercent}%</p>
              <p className="mt-2 text-sm text-white/80">
                {completedLessons} de {data.lessons.length} aulas concluidas
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Carga horaria</p>
              <p className="mt-3 text-3xl font-bold">{data.product.workload_minutes || 0} min</p>
              <p className="mt-2 text-sm text-white/80">Estimativa total para percorrer a trilha.</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Player LMS</p>
              <p className="mt-3 text-3xl font-bold">{playerEntries.length}</p>
              <p className="mt-2 text-sm text-white/80">Itens navegaveis entre aulas e avaliacoes.</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-5 md:col-span-2 xl:col-span-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Bloqueios atuais</p>
              <p className="mt-3 text-3xl font-bold">{lockedLessonsCount + lockedAssessmentsCount}</p>
              <p className="mt-2 text-sm text-white/80">Itens ainda dependentes da tua progressao.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-5 w-5 text-slate-900" />
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Grade curricular</h2>
              <p className="mt-1 text-sm text-slate-600">
                Modulos, aulas e checkpoints do curso organizados como trilha de estudo.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {data.modules.map((module, moduleIndex) => {
              const moduleLessons = data.lessons.filter((lesson) => lesson.module_id === module.id)
              const moduleAssessments = assessmentsByModule.get(module.id) ?? []

              return (
                <div key={module.id} className="rounded-[1.5rem] border bg-slate-50/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Modulo {moduleIndex + 1}</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">{module.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {module.description ?? "Sem descricao adicional para este modulo."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={getModuleTypeLabel(module.module_type)} tone="info" />
                      {module.is_required ? <StatusBadge label="Obrigatorio" tone="success" /> : null}
                      {module.module_pdf_file_name ? <StatusBadge label="PDF base" tone="warning" /> : null}
                      {module.is_locked ? <StatusBadge label="Bloqueado" tone="warning" /> : null}
                    </div>
                  </div>
                  {module.is_locked && module.lock_reason ? (
                    <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
                      {module.lock_reason}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {moduleLessons.map((lesson) => {
                      const lessonState = getLessonProgressState(lesson.id, progressMap)
                      return (
                        <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-950">{lesson.title}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {lesson.description ?? "Aula pronta para estudo dentro do player."}
                            </p>
                            {lesson.is_locked && lesson.lock_reason ? (
                              <p className="mt-2 text-sm text-amber-700">{lesson.lock_reason}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge label={`${lesson.estimated_minutes} min`} tone="neutral" />
                            <StatusBadge
                              label={lesson.is_locked ? "Bloqueada" : lessonState.label}
                              tone={lesson.is_locked ? "warning" : lessonState.tone}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {moduleAssessments.map((assessment) => (
                      <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-950">{assessment.title}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {assessment.description ?? "Avaliacao ligada a este modulo."}
                          </p>
                          {assessment.is_locked && assessment.lock_reason ? (
                            <p className="mt-2 text-sm text-amber-700">{assessment.lock_reason}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            label={assessment.is_locked ? "Quiz bloqueado" : "Quiz do modulo"}
                            tone="warning"
                          />
                          <StatusBadge
                            label={
                              assessment.progress_state === "passed"
                                ? "Aprovado"
                                : assessment.progress_state === "pending_review"
                                  ? "Em revisao"
                                  : assessment.progress_state === "failed"
                                    ? "Reprovado"
                                    : assessment.is_locked
                                      ? "Bloqueado"
                                      : `Minimo ${assessment.passing_score}%`
                            }
                            tone={
                              assessment.progress_state === "passed"
                                ? "success"
                                : assessment.progress_state === "failed"
                                  ? "danger"
                                  : assessment.progress_state === "pending_review" || assessment.is_locked
                                    ? "warning"
                                    : "info"
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-slate-900" />
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950">Proximo passo</h2>
                <p className="mt-1 text-sm text-slate-600">
                  O player abre diretamente no ponto mais util para continuares.
                </p>
              </div>
            </div>

            {nextLesson ? (
              <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Aula sugerida</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{nextLesson.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {nextLesson.description ?? "Abre esta aula para continuar a tua progressao."}
                </p>
                <Button asChild className="mt-5 rounded-full">
                  <Link to={studentCourseLessonPath(data.product.id, nextLesson.id)}>Entrar no player</Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                title="Sem proximo passo desbloqueado"
                message="Conclui os itens anteriores para libertar a proxima aula ou avaliacao desta trilha."
              />
            )}
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-slate-950">Regras do curso</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl border bg-slate-50/80 p-4">
                A autorizacao continua dependente do teu grant ativo e das regras de agenda por modulo e aula.
              </div>
              <div className="rounded-2xl border bg-slate-50/80 p-4">
                {data.product.has_linear_progression
                  ? "Este curso usa progressao linear, por isso aulas e quizzes futuros ficam visiveis, mas bloqueados ate concluirem os requisitos anteriores."
                  : "Este curso permite navegacao mais livre, sempre respeitando acesso e disponibilidade do conteudo."}
              </div>
              <div className="rounded-2xl border bg-slate-50/80 p-4">
                PDFs e materiais protegidos continuam a sair por URL assinada, nunca por link publico direto.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
