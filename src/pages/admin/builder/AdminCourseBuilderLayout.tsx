import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
  BookOpen,
  ClipboardCheck,
  Cog,
  ExternalLink,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
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
import type {
  ProductAssessmentSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

export interface AdminCourseBuilderContext {
  courseId: string
  product: ProductSummary
  modules: ProductModuleSummary[]
  assessments: ProductAssessmentSummary[]
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

  if (productsQuery.isLoading || modulesQuery.isLoading || assessmentsQuery.isLoading) {
    return <LoadingState message="A carregar o builder do curso..." />
  }

  const error = productsQuery.error ?? modulesQuery.error ?? assessmentsQuery.error
  if (productsQuery.isError || modulesQuery.isError || assessmentsQuery.isError) {
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

  const modules = modulesQuery.data ?? []
  const assessments = assessmentsQuery.data ?? []
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
  }

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <div className="relative flex min-h-[calc(100vh-9.5rem)] flex-col overflow-hidden border-y border-slate-200 bg-white lg:rounded-none">
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
              isSidebarOpen ? "w-[288px]" : "w-[86px]"
            }`}
          >
            <div className="border-b border-slate-100 px-4 py-4">
              <div className={`flex items-center ${isSidebarOpen ? "justify-between gap-3" : "justify-center"}`}>
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
              {isSidebarOpen ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge label={`${modules.length} modulos`} tone="info" />
                  <StatusBadge label={`${assessments.length} avaliacoes`} tone="warning" />
                </div>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav className="grid gap-1">
                {builderNav.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.to(courseId)}
                    end={item.key === "overview"}
                    title={item.label}
                    className={({ isActive }) =>
                      `flex items-center rounded-2xl text-sm font-medium transition ${
                        isSidebarOpen ? "gap-3 px-4 py-3" : "justify-center px-0 py-3"
                      } ${
                        isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {isSidebarOpen ? item.label : null}
                  </NavLink>
                ))}
              </nav>

              <div className={`mt-5 rounded-[1.5rem] bg-slate-50 ${isSidebarOpen ? "p-4" : "p-3"}`}>
                <div className={`flex items-center ${isSidebarOpen ? "gap-2" : "justify-center"}`}>
                  <BookOpen className="h-4 w-4 text-slate-900" />
                  {isSidebarOpen ? <p className="text-sm font-semibold text-slate-950">Arvore do curso</p> : null}
                </div>

                <div className="mt-4 space-y-2">
                  {modules.length === 0 ? (
                    isSidebarOpen ? (
                      <p className="text-sm leading-6 text-slate-600">
                        Sem modulos ainda. Cria a estrutura pedagogica para comecar o builder.
                      </p>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Vazio
                      </div>
                    )
                  ) : (
                    modules.map((module, index) => (
                      <NavLink
                        key={module.id}
                        to={adminCourseModulePath(courseId, module.id)}
                        title={module.title}
                        className={({ isActive }) =>
                          `block rounded-2xl border text-sm transition ${
                            isSidebarOpen ? "px-3 py-3" : "px-2 py-3 text-center"
                          } ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`
                        }
                      >
                        {isSidebarOpen ? (
                          <>
                            <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">
                              Modulo {index + 1}
                            </p>
                            <p className="mt-1 font-medium">{module.title}</p>
                          </>
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </NavLink>
                    ))
                  )}
                </div>
              </div>

              {builderError && isSidebarOpen ? (
                <p className="mt-4 text-sm text-rose-700">{builderError}</p>
              ) : null}
            </div>

            <div className="border-t border-slate-100 px-3 py-3">
              <div className="grid gap-2">
                <Button asChild variant="outline" className={`rounded-2xl ${isSidebarOpen ? "" : "px-0"}`}>
                  <Link to={adminCourseAssessmentsPath(courseId)}>
                    <ClipboardCheck className="h-4 w-4 shrink-0" />
                    {isSidebarOpen ? <span className="ml-2">Avaliacoes</span> : null}
                  </Link>
                </Button>
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
