import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { BookOpen, Clock3, FileText, ShieldCheck, Video } from "lucide-react"
import { EmptyState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
import { buildAssessmentPayload, createEmptyQuestionDraft } from "@/lib/assessment-builder"
import {
  adminCourseFinalAssessmentPath,
  adminCourseModuleAssessmentPath,
  adminCourseModulePath,
} from "@/lib/routes"
import {
  useCreateAdminProductAssessment,
  useCreateAdminProductModule,
} from "@/hooks/useAdmin"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"

function formatDuration(totalMinutes: number) {
  if (totalMinutes <= 0) return "0 min"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function CourseOverviewPanel() {
  const { courseId, product, modules, assessments, lessonsByModule, totalLessons } = useAdminCourseBuilderContext()
  const navigate = useNavigate()
  const createModule = useCreateAdminProductModule()
  const createAssessment = useCreateAdminProductAssessment()
  const [builderError, setBuilderError] = useState<string | null>(null)
  const totalEstimatedMinutes =
    Object.values(lessonsByModule)
      .flat()
      .reduce((sum, lesson) => sum + (lesson.estimated_minutes || 0), 0) || product.workload_minutes || 0

  const handleOpenCourseBuilder = async () => {
    setBuilderError(null)

    if (modules.length > 0) {
      navigate(adminCourseModulePath(courseId, modules[0].id))
      return
    }

    try {
      const firstModule = await createModule.mutateAsync({
        productId: courseId,
        title: "Modulo 1",
        description: null,
        module_type: "mixed",
        access_type: "paid_only",
        position: 1,
        sort_order: 1,
        is_preview: false,
        is_required: true,
        status: "draft",
      })

      navigate(adminCourseModulePath(courseId, firstModule.id))
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel abrir o construtor do material.")
    }
  }

  const finalAssessment = assessments.find((assessment) => assessment.assessment_type === "final") ?? null

  const handleCreateModuleAssessment = async (moduleId: string, moduleTitle: string) => {
    setBuilderError(null)

    try {
      const createdAssessment = await createAssessment.mutateAsync({
        productId: courseId,
        moduleId,
        assessmentType: "module",
        title: `Quiz: ${moduleTitle}`,
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 15,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })

      navigate(adminCourseModuleAssessmentPath(courseId, moduleId, createdAssessment.id))
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel criar o quiz do modulo.")
    }
  }

  const handleOpenFinalAssessment = async () => {
    setBuilderError(null)

    if (finalAssessment) {
      navigate(adminCourseFinalAssessmentPath(courseId))
      return
    }

    try {
      await createAssessment.mutateAsync({
        productId: courseId,
        moduleId: null,
        assessmentType: "final",
        title: "Avaliacao final",
        description: null,
        isRequired: true,
        passingScore: 70,
        maxAttempts: null,
        estimatedMinutes: 20,
        isActive: true,
        builderPayload: buildAssessmentPayload([createEmptyQuestionDraft()]),
      })

      navigate(adminCourseFinalAssessmentPath(courseId))
    } catch (error) {
      setBuilderError(
        error instanceof Error ? error.message : "Nao foi possivel preparar a avaliacao final.",
      )
    }
  }

  return (
    <div className="w-full space-y-8 pb-12">
      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Visao Geral do Material</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          Este e o centro de controlo do material. Usa o painel lateral para navegar, editar e construir a estrutura pedagogica.
        </p>
        {builderError ? <p className="mt-4 text-sm text-rose-700">{builderError}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <span className="text-3xl font-black text-slate-900">{modules.length}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Modulos</span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Video className="h-6 w-6" />
          </div>
          <span className="text-3xl font-black text-slate-900">{totalLessons}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Aulas</span>
        </div>
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Clock3 className="h-6 w-6" />
          </div>
          <span className="text-3xl font-black text-slate-900">{formatDuration(totalEstimatedMinutes)}</span>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Estimativa</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Avaliacao Final</h3>
            <p className="mt-1 text-sm text-slate-500">
              Prova final do material em rota dedicada, separada dos quizzes por modulo.
            </p>
          </div>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => void handleOpenFinalAssessment()}>
            {finalAssessment ? "Abrir avaliacao final" : "Criar avaliacao final"}
          </Button>
        </div>

        <div className="p-6">
          {finalAssessment ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate text-sm font-semibold text-emerald-900">
                  {finalAssessment.title}
                </span>
              </div>
              <Button asChild variant="ghost" className="rounded-xl text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800">
                <Link to={adminCourseFinalAssessmentPath(courseId)}>Editar avaliacao final</Link>
              </Button>
            </div>
          ) : (
            <EmptyState
              title="Sem avaliacao final"
              message="Crie a prova final do material para cumprir o fluxo profundo previsto no builder."
            />
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Mapa do Material</h3>
            <p className="mt-1 text-sm text-slate-500">A hierarquia atual de aprendizagem.</p>
          </div>
          <Button
            type="button"
            className="rounded-xl bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] px-5 text-white shadow-[0_16px_28px_rgba(18,89,111,0.22)]"
            onClick={() => void handleOpenCourseBuilder()}
            disabled={createModule.isPending}
          >
            {createModule.isPending
              ? "A criar modulo..."
              : modules.length > 0
                ? "Abrir Construtor"
                : "Adicionar Modulo"}
          </Button>
        </div>

        {modules.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Sem modulos ainda"
              message="Cria o primeiro modulo para iniciar o construtor e montar a estrutura do material."
            />
            <div className="flex justify-center">
              <Button type="button" className="rounded-full" onClick={() => void handleOpenCourseBuilder()} disabled={createModule.isPending}>
                {createModule.isPending ? "A criar modulo..." : "Criar primeiro modulo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {modules.map((module, index) => {
              const moduleLessons = lessonsByModule[module.id] ?? []
              const moduleAssessments = assessments.filter((assessment) => assessment.module_id === module.id)

              return (
                <div key={module.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Modulo {index + 1}
                        </span>
                        {module.is_required ? <StatusBadge label="Obrigatorio" tone="info" /> : null}
                      </div>
                      <h3 className="mt-2 text-2xl font-bold text-slate-950">{module.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {module.status === "published" ? <StatusBadge label="Publicado" tone="success" /> : null}
                      {module.module_pdf_file_name ? <StatusBadge label="PDF base" tone="warning" /> : null}
                      <Button asChild variant="outline" className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50">
                        <Link to={adminCourseModulePath(courseId, module.id)}>Editar Modulo</Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 border-l-2 border-slate-100 pl-4">
                    {moduleLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate text-sm font-medium text-slate-800">{lesson.title}</span>
                        </div>
                        <Button asChild variant="ghost" className="rounded-xl text-blue-700 hover:bg-blue-50 hover:text-blue-800">
                          <Link to={`${adminCourseModulePath(courseId, module.id)}/aulas/${lesson.id}`}>Editar</Link>
                        </Button>
                      </div>
                    ))}

                    {moduleAssessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
                          <span className="truncate text-sm font-medium text-amber-800">Quiz: {assessment.title}</span>
                        </div>
                        <Button asChild variant="ghost" className="rounded-xl text-amber-700 hover:bg-amber-100 hover:text-amber-800">
                          <Link to={`${adminCourseModulePath(courseId, module.id)}/avaliacoes/${assessment.id}`}>Editar Quiz</Link>
                        </Button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4 text-sm font-medium">
                      <Link to={adminCourseModulePath(courseId, module.id)} className="text-blue-600 transition hover:text-blue-700">
                        + Adicionar Aula
                      </Link>
                      <button
                        type="button"
                        className="text-amber-600 transition hover:text-amber-700"
                        onClick={() => void handleCreateModuleAssessment(module.id, module.title)}
                      >
                        + Adicionar Quiz
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
