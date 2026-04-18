import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router-dom"
import { BookOpen, ClipboardCheck, Cog, Layers3, UsersRound } from "lucide-react"
import { useMemo } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import {
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
  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(courseId)
  const assessmentsQuery = useAdminProductAssessments(courseId)

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
  const context: AdminCourseBuilderContext = {
    courseId,
    product,
    modules,
    assessments,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Builder do curso: ${product.title}`}
        description="Ambiente de autoria com rotas dedicadas para visao geral, configuracoes, liberacoes, avaliacoes e estrutura pedagogica."
        backTo="/admin/cursos"
      />

      <section className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#0f172a_0%,#1d4d8b_55%,#0f172a_100%)] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/60">Curso central</p>
            <h2 className="mt-2 font-display text-3xl font-bold">{product.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">
              O mesmo objeto de curso alimenta catalogo publico, checkout, liberacao, builder e player do aluno.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={product.status === "published" ? "Publicado" : product.status === "draft" ? "Rascunho" : "Arquivado"} tone={product.status === "published" ? "success" : product.status === "draft" ? "warning" : "danger"} />
            <StatusBadge label={`${modules.length} modulos`} tone="info" />
            <StatusBadge label={`${assessments.length} avaliacoes`} tone="warning" />
            <Button asChild variant="secondary" className="rounded-full bg-white text-slate-950 hover:bg-white/90">
              <Link to={publicCoursePath(product.slug)} target="_blank" rel="noreferrer">
                Abrir venda publica
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border bg-white p-4 shadow-sm">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Builder LMS
          </p>

          <nav className="grid gap-1">
            {builderNav.map((item) => (
              <NavLink
                key={item.key}
                to={item.to(courseId)}
                end={item.key === "overview"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-900" />
              <p className="text-sm font-semibold text-slate-950">Arvore do curso</p>
            </div>
            <div className="mt-4 space-y-2">
              {modules.length === 0 ? (
                <p className="text-sm leading-6 text-slate-600">
                  Sem modulos ainda. Cria a estrutura pedagogica para comecar o builder.
                </p>
              ) : (
                modules.map((module, index) => (
                  <NavLink
                    key={module.id}
                    to={adminCourseModulePath(courseId, module.id)}
                    className={({ isActive }) =>
                      `block rounded-2xl border px-3 py-3 text-sm transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`
                    }
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">Modulo {index + 1}</p>
                    <p className="mt-1 font-medium">{module.title}</p>
                  </NavLink>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  )
}
