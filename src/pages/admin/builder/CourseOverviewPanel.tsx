import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import { adminCourseModulePath } from "@/lib/routes"
import { useCreateAdminProductModule } from "@/hooks/useAdmin"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"

export function CourseOverviewPanel() {
  const { courseId, product, modules, assessments } = useAdminCourseBuilderContext()
  const navigate = useNavigate()
  const createModule = useCreateAdminProductModule()
  const [builderError, setBuilderError] = useState<string | null>(null)

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
      setBuilderError(error instanceof Error ? error.message : "Nao foi possivel abrir o construtor do curso.")
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Construtor do curso"
          description="Entra diretamente no workspace onde editas modulos, aulas, materiais e quizzes do curso."
          actions={
            <Button type="button" className="rounded-full" onClick={() => void handleOpenCourseBuilder()} disabled={createModule.isPending}>
              {createModule.isPending
                ? "A preparar construtor..."
                : modules.length > 0
                  ? "Abrir construtor"
                  : "Criar primeiro modulo e abrir construtor"}
            </Button>
          }
        />
        {builderError ? <p className="mt-4 text-sm text-rose-700">{builderError}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Modulos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{modules.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avaliacoes</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{assessments.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Carga horaria</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{product.workload_minutes || 0} min</p>
        </div>
        <div className="rounded-[1.75rem] border bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Publicacao</p>
          <p className="mt-3 text-3xl font-bold">{product.status === "published" ? "OK" : "Pendente"}</p>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {product.is_public ? "Visivel no catalogo" : "Oculto do catalogo publico"}
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Mapa curricular"
          description="Resumo da estrutura do curso com atalhos para o workspace de cada modulo."
        />

        {modules.length === 0 ? (
          <div className="mt-6 space-y-4">
            <EmptyState
              title="Sem modulos ainda"
              message="Cria o primeiro modulo para entrar no construtor e comecar a estruturar aulas, materiais e agenda."
            />
            <div className="flex justify-center">
              <Button type="button" className="rounded-full" onClick={() => void handleOpenCourseBuilder()} disabled={createModule.isPending}>
                {createModule.isPending ? "A criar modulo..." : "Criar primeiro modulo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {modules.map((module, index) => (
              <div key={module.id} className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Modulo {index + 1}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">{module.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {module.description ?? "Sem descricao adicional para este modulo."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {module.is_required ? <StatusBadge label="Obrigatorio" tone="success" /> : null}
                    {module.module_pdf_file_name ? <StatusBadge label="PDF base" tone="warning" /> : null}
                    <StatusBadge label={module.status === "published" ? "Publicado" : module.status === "draft" ? "Rascunho" : "Arquivado"} tone={module.status === "published" ? "success" : module.status === "draft" ? "warning" : "danger"} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button asChild className="rounded-full">
                    <Link to={adminCourseModulePath(courseId, module.id)}>Abrir workspace do modulo</Link>
                  </Button>
                  <p className="text-sm text-slate-500">Posicao {module.position}. Estrutura pronta para aulas, materiais e quizzes.</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
