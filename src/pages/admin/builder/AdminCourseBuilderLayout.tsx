import { useQueries } from "@tanstack/react-query"
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
  BookOpen,
  ClipboardCheck,
  Cog,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { StatusBadge } from "@/components/common"
import {
  useCreateAdminProductModule,
  useAdminProductAssessments,
  useAdminProductModules,
  useAdminProducts,
} from "@/hooks/useAdmin"
import {
  adminCourseAssessmentsPath,
  adminCourseBuilderPath,
  adminCourseModulePath,
  adminCourseReleasesPath,
  adminCourseSettingsPath,
  publicCoursePath,
} from "@/lib/routes"
import { BUILD_VERSION } from "@/lib/build"
import { fetchAdminProductLessons } from "@/services"
import type {
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

export interface AdminCourseBuilderContext {
  courseId: string
  product: ProductSummary
  modules: ProductModuleSummary[]
  assessments: ProductAssessmentSummary[]
  lessonsByModule: Record<string, ProductLessonSummary[]>
  totalLessons: number
}

const builderNav = [
  { key: "overview", label: "Visao geral", icon: Layers3, to: (courseId: string) => adminCourseBuilderPath(courseId) },
  { key: "settings", label: "Configuracoes", icon: Cog, to: (courseId: string) => adminCourseSettingsPath(courseId) },
  { key: "releases", label: "Liberacoes", icon: UsersRound, to: (courseId: string) => adminCourseReleasesPath(courseId) },
  { key: "assessments", label: "Avaliacoes", icon: ClipboardCheck, to: (courseId: string) => adminCourseAssessmentsPath(courseId) },
]

export function useAdminCourseBuilderContext() {
  return useOutletContext<AdminCourseBuilderContext>()
}

export function AdminCourseBuilderLayout() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(courseId)
  const assessmentsQuery = useAdminProductAssessments(courseId)
  const createModule = useCreateAdminProductModule()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [builderError, setBuilderError] = useState<string | null>(null)

  const product = useMemo(() => {
    const products = productsQuery.data ?? []
    return products.find((item) => item.id === courseId) ?? null
  }, [courseId, productsQuery.data])

  const modules = modulesQuery.data ?? []
  const lessonQueries = useQueries({
    queries: modules.map((module) => ({
      queryKey: ["admin", "modules", module.id, "lessons"],
      queryFn: () => fetchAdminProductLessons(module.id),
      staleTime: 60_000,
      enabled: Boolean(module.id),
    })),
  })

  if (
    productsQuery.isLoading ||
    modulesQuery.isLoading ||
    assessmentsQuery.isLoading ||
    lessonQueries.some((query) => query.isLoading)
  ) {
    return <LoadingState message="A carregar o builder do curso..." />
  }

  const lessonError = lessonQueries.find((query) => query.isError)?.error
  const error = productsQuery.error ?? modulesQuery.error ?? assessmentsQuery.error ?? lessonError
  if (
    productsQuery.isError ||
    modulesQuery.isError ||
    assessmentsQuery.isError ||
    lessonQueries.some((query) => query.isError)
  ) {
    return (
      <ErrorState
        title="Nao foi possivel abrir o builder"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void productsQuery.refetch()
          void modulesQuery.refetch()
          void assessmentsQuery.refetch()
        }}
      />
    )
  }

  if (!courseId || !product) {
    return (
      <EmptyState
        title="Curso nao encontrado"
        message="Este curso nao esta disponivel no catalogo administrativo."
      />
    )
  }

  const assessments = assessmentsQuery.data ?? []
  const lessonsByModule = modules.reduce<Record<string, ProductLessonSummary[]>>((accumulator, module, index) => {
    accumulator[module.id] = (lessonQueries[index]?.data as ProductLessonSummary[] | undefined) ?? []
    return accumulator
  }, {})
  const totalLessons = Object.values(lessonsByModule).reduce(
    (count, lessons) => count + lessons.length,
    0,
  )

  const handleCreateModule = async () => {
    if (!courseId) return

    setBuilderError(null)
    try {
      const position = modules.length + 1
      const createdModule = await createModule.mutateAsync({
        productId: courseId,
        title: `Modulo ${position}`,
        description: null,
        module_type: "mixed",
        access_type: "paid_only",
        position,
        sort_order: position,
        is_preview: false,
        is_required: true,
        status: "draft",
      })

      navigate(adminCourseModulePath(courseId, createdModule.id))
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel criar o modulo.")
    }
  }
  const context: AdminCourseBuilderContext = {
    courseId,
    product,
    modules,
    assessments,
    lessonsByModule,
    totalLessons,
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-white">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="rounded-full">
              <Link to="/admin/cursos">Voltar</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsSidebarOpen((value) => !value)}
            >
              {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold text-slate-950">{product.title}</p>
                <StatusBadge
                  label={
                    product.status === "published"
                      ? "Publicado"
                      : product.status === "draft"
                        ? "Rascunho"
                        : "Arquivado"
                  }
                  tone={
                    product.status === "published"
                      ? "success"
                      : product.status === "draft"
                        ? "warning"
                        : "danger"
                  }
                />
              </div>
              <p className="hidden text-xs uppercase tracking-[0.2em] text-slate-500 md:block">
                Builder do curso
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden rounded-full sm:inline-flex">
              <Link to={adminCourseSettingsPath(courseId)}>Configuracoes</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to={publicCoursePath(product.slug)} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Visualizar
              </Link>
            </Button>
          </div>
        </header>

        <div className="border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {builderNav.map((item) => (
              <NavLink
                key={item.key}
                to={item.to(courseId)}
                end={item.key === "overview"}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside
            className={`hidden shrink-0 border-r border-slate-200 bg-white transition-all duration-300 lg:flex lg:flex-col ${
              isSidebarOpen ? "w-[252px]" : "w-[86px]"
            }`}
          >
            <div className="border-b border-slate-100 px-3 py-4">
              <div className={`flex items-start ${isSidebarOpen ? "justify-between gap-3" : "justify-center"}`}>
                {isSidebarOpen ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Builder LMS
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Workspace de estrutura, conteudo e liberacao.
                    </p>
                  </div>
                ) : (
                  <BookOpen className="h-5 w-5 text-slate-600" />
                )}
                <Button
                  type="button"
                  size="icon"
                  className="rounded-2xl"
                  onClick={() => void handleCreateModule()}
                  disabled={createModule.isPending}
                  title="Criar modulo"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav className="grid gap-3">
                <NavLink
                  to={adminCourseBuilderPath(courseId)}
                  end
                  title="Visao Geral do Curso"
                  className={({ isActive }) =>
                    `flex items-center rounded-lg border text-sm font-semibold transition ${
                      isSidebarOpen ? "gap-2.5 px-3 py-4" : "justify-center px-0 py-3"
                    } ${
                      isActive
                        ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`
                  }
                >
                  <div className="rounded-md bg-blue-100 p-1.5 text-blue-700">
                    <BookOpen className="h-4 w-4 shrink-0" />
                  </div>
                  {isSidebarOpen ? "Visao Geral do Curso" : null}
                </NavLink>
              </nav>

              <div className={`mt-5 ${isSidebarOpen ? "" : "px-0"}`}>
                <div className="space-y-2">
                  {modules.length === 0 ? (
                    isSidebarOpen ? (
                      <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                        Sem modulos ainda. Cria a estrutura pedagogica para comecar o builder.
                      </p>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Vazio
                      </div>
                    )
                  ) : (
                    modules.map((module, index) => {
                      const moduleLessons = lessonsByModule[module.id] ?? []
                      const moduleAssessments = assessments.filter((assessment) => assessment.module_id === module.id)

                      return (
                        <div key={module.id} className="group pt-1">
                          <NavLink
                            to={adminCourseModulePath(courseId, module.id)}
                            title={module.title}
                            className={({ isActive }) =>
                              `flex items-center rounded-lg transition ${
                                isSidebarOpen ? "gap-2 px-2 py-2.5" : "justify-center px-2 py-3"
                              } ${
                                isActive
                                  ? "bg-slate-50 text-slate-950"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`
                            }
                          >
                            {isSidebarOpen ? (
                              <>
                                <List className="h-4 w-4 shrink-0 text-slate-300" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="w-5 text-center text-[10px] font-extrabold uppercase text-slate-400">
                                      M{index + 1}
                                    </span>
                                    <span className="truncate text-sm font-bold">{module.title}</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-bold">M{index + 1}</span>
                            )}
                          </NavLink>

                          {isSidebarOpen ? (
                            <div className="ml-9 mt-1 space-y-1 border-l-2 border-slate-100 pl-3">
                              {moduleLessons.map((lesson) => (
                                <NavLink
                                  key={lesson.id}
                                  to={`${adminCourseModulePath(courseId, module.id)}/aulas/${lesson.id}`}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2 rounded-md px-1 py-1.5 text-[13px] font-medium transition ${
                                      isActive
                                        ? "bg-slate-100 text-slate-950"
                                        : "text-slate-700 hover:bg-slate-50"
                                    }`
                                  }
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{lesson.title}</span>
                                </NavLink>
                              ))}

                              {moduleAssessments.map((assessment) => (
                                <NavLink
                                  key={assessment.id}
                                  to={`${adminCourseModulePath(courseId, module.id)}/avaliacoes/${assessment.id}`}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2 rounded-md px-1 py-1.5 text-[13px] font-medium transition ${
                                      isActive
                                        ? "bg-amber-50 text-amber-700"
                                        : "text-amber-700/90 hover:bg-amber-50/50"
                                    }`
                                  }
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                  <span className="truncate">Quiz: {assessment.title}</span>
                                </NavLink>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="pt-5">
                <button
                  type="button"
                  onClick={() => void handleCreateModule()}
                  disabled={createModule.isPending}
                  className={`flex w-full items-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 text-sm font-black text-blue-700 transition hover:bg-blue-100 ${
                    isSidebarOpen ? "gap-2 px-3 py-3" : "justify-center px-2 py-3"
                  }`}
                >
                  <div className="rounded-md bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] p-1 text-white">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  {isSidebarOpen ? (createModule.isPending ? "A criar modulo..." : "Novo Modulo") : null}
                </button>
              </div>

              {builderError && isSidebarOpen ? (
                <p className="mt-4 text-sm text-rose-700">{builderError}</p>
              ) : null}
            </div>

            <div className="border-t border-slate-100 px-3 py-3">
              <div className="grid gap-2">
                <NavLink
                  to={adminCourseSettingsPath(courseId)}
                  className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                    isSidebarOpen ? "gap-2.5" : "justify-center"
                  }`}
                >
                  <Cog className="h-4 w-4 shrink-0 text-slate-400" />
                  {isSidebarOpen ? "Configuracoes do Curso" : null}
                </NavLink>
                <NavLink
                  to={adminCourseReleasesPath(courseId)}
                  className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                    isSidebarOpen ? "gap-2.5" : "justify-center"
                  }`}
                >
                  <UsersRound className="h-4 w-4 shrink-0 text-slate-400" />
                  {isSidebarOpen ? "Atribuir a Alunos e Grupos" : null}
                </NavLink>
                <NavLink
                  to={adminCourseAssessmentsPath(courseId)}
                  className={`flex items-center rounded-xl border border-slate-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 ${
                    isSidebarOpen ? "gap-2.5" : "justify-center"
                  }`}
                >
                  <ClipboardCheck className="h-4 w-4 shrink-0 text-slate-400" />
                  {isSidebarOpen ? "Gerenciar Avaliacoes" : null}
                </NavLink>
                <button
                  type="button"
                  className={`flex items-center rounded-xl px-3 py-3 text-sm text-slate-600 transition hover:bg-slate-50 ${
                    isSidebarOpen ? "gap-2.5" : "justify-center"
                  }`}
                >
                  <Download className="h-4 w-4 shrink-0 text-slate-400" />
                  {isSidebarOpen ? "Exportar Conteudo" : null}
                </button>
                <button
                  type="button"
                  className={`flex items-center rounded-xl border border-blue-200 bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] px-3 py-3 text-sm font-black text-white transition hover:opacity-95 ${
                    isSidebarOpen ? "gap-2.5" : "justify-center"
                  }`}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  {isSidebarOpen ? "Importar Conteudo (IA)" : null}
                </button>
              </div>
            </div>
          </aside>

          <main className="relative min-w-0 flex-1 overflow-y-auto bg-slate-50/60">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1680px] p-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                <Outlet context={context} />
              </div>
            </div>
          </main>
        </div>

        <div className="pointer-events-none absolute bottom-4 right-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Build {BUILD_VERSION}
        </div>
      </div>
    </div>
  )
}
