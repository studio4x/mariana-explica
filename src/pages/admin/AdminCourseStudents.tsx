import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { useAdminProducts } from "@/hooks/useAdmin"
import { ROUTES } from "@/lib/constants"
import { CourseReleasesManager } from "@/pages/admin/builder/CourseReleasesPanel"

export function AdminCourseStudents() {
  const { courseId } = useParams<{ courseId: string }>()
  const productsQuery = useAdminProducts()

  if (!courseId) {
    return <EmptyState title="Curso invalido" message="Abra um curso valido para gerenciar alunos." />
  }

  if (productsQuery.isLoading) {
    return <LoadingState message="A carregar curso..." />
  }

  if (productsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o curso"
        message={productsQuery.error instanceof Error ? productsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void productsQuery.refetch()}
      />
    )
  }

  const product = (productsQuery.data ?? []).find((item) => item.id === courseId)

  if (!product) {
    return <EmptyState title="Curso nao encontrado" message="Este curso nao esta disponivel no admin." />
  }

  return (
    <CourseReleasesManager
      courseId={courseId}
      title={`Alunos de ${product.title}`}
      description="Gerencie acessos manuais e liberacoes do curso sem abrir o construtor pedagogico."
      actions={
        <Button asChild variant="outline" className="rounded-full">
          <Link to={ROUTES.ADMIN_COURSES}>Voltar aos cursos</Link>
        </Button>
      }
    />
  )
}
