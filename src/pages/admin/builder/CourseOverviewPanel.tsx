import { Link } from "react-router-dom"
import { EmptyState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import { adminCourseModulePath } from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"

export function CourseOverviewPanel() {
  const { courseId, product, modules, assessments } = useAdminCourseBuilderContext()

  return (
    <div className="space-y-6">
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
          <EmptyState
            title="Sem modulos ainda"
            message="Usa o workspace legado do modulo para comecar a estruturar aulas, materiais e agenda."
          />
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
