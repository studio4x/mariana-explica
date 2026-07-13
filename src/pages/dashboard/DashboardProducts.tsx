import { Link } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useMyProducts } from "@/hooks/useDashboard"
import { getEnrolledCourseAction, getStudentProductAccessLabel } from "@/lib/course-cta"
import { ROUTES } from "@/lib/constants"
import { getDashboardProductNote } from "@/lib/product-presentation"
import { richTextToPlainText } from "@/lib/rich-text"
import type { DashboardProductSummary } from "@/types/app.types"
import { formatDate } from "@/utils/date"

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getStudentProductDescription(product: DashboardProductSummary) {
  const haystack = normalize(
    `${product.title} ${product.slug} ${richTextToPlainText(product.short_description)} ${richTextToPlainText(product.description)}`,
  )

  if (haystack.includes("filosof")) {
    return "Sebenta completa com todos os temas lecionados"
  }

  if (haystack.includes("gramatic")) {
    return "Apoio focado nas regras gramaticais para testes e exames"
  }

  if (haystack.includes("liter") || haystack.includes("organiz")) {
    return "Resumo completo das obras obrigatórias"
  }

  return getDashboardProductNote(product)
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${value}%` }} />
    </div>
  )
}

function DashboardProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded-full bg-slate-200/90" />
        <div className="h-11 w-[min(100%,24rem)] rounded-2xl bg-slate-200/90" />
        <div className="h-4 w-[min(100%,36rem)] rounded-full bg-slate-200/80" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-36 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="mt-4 h-9 w-12 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-5/6 rounded-full bg-slate-200/80" />
        </div>
        <div className="h-36 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-4 w-40 rounded-full bg-slate-200" />
          <div className="mt-4 h-9 w-16 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-2 rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-3/4 rounded-full bg-slate-200/80" />
        </div>
        <div className="h-36 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-1">
          <div className="h-4 w-28 rounded-full bg-slate-200" />
          <div className="mt-4 h-9 w-14 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 rounded-full bg-slate-200/80" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-36 rounded-full bg-slate-200" />
                <div className="mt-3 h-9 w-4/5 rounded-2xl bg-slate-200/90" />
                <div className="mt-3 h-4 w-full rounded-full bg-slate-200/80" />
                <div className="mt-2 h-4 w-2/3 rounded-full bg-slate-200/60" />
              </div>
              <div className="h-7 w-20 rounded-full bg-slate-200" />
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50/80 p-4">
              <div className="h-4 w-44 rounded-full bg-slate-200" />
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="h-7 w-20 rounded-full bg-slate-200" />
                <div className="h-7 w-24 rounded-full bg-slate-200" />
                <div className="h-7 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded-full bg-slate-200" />
                  <div className="h-3 w-8 rounded-full bg-slate-200" />
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200" />
                <div className="mt-3 h-3 w-40 rounded-full bg-slate-200/80" />
              </div>
            </div>

            <div className="mt-6 h-11 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardProducts() {
  const { data, isLoading, isError, error, refetch } = useMyProducts()

  if (isLoading) {
    return <DashboardProductsSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os materiais"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const products = data ?? []

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Os teus materiais"
          description="Todos os teus conteúdos e materiais de estudo organizados num só lugar"
        />
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <EmptyState
            title="Ainda sem materiais ativos"
            message="Quando ativares um material, ele vai aparecer aqui com acesso organizado."
          />
          <div className="mt-2 flex justify-center">
            <Button asChild className="rounded-full">
              <Link to={ROUTES.COURSES}>Ver materiais disponíveis</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const totalLessons = products.reduce((sum, product) => sum + product.lesson_count, 0)
  const completedLessons = products.reduce((sum, product) => sum + product.completed_lessons, 0)
  const inProgressCourses = products.filter((product) => product.progress_percent > 0 && product.progress_percent < 100)
  const completedCourses = products.filter((product) => product.progress_percent >= 100)
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const nextCourse = inProgressCourses[0] ?? products[0] ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Os teus materiais"
        description="Todos os teus conteúdos e materiais de estudo organizados num só lugar"
        actions={
          <Button type="button" variant="outline" className="rounded-full bg-white" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Materiais ativos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Os materiais que tens disponíveis para começar a estudar agora.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Progresso geral</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{progressPercent}%</p>
            </div>
            <StatusBadge label={completedCourses.length > 0 ? "Há materiais concluídos" : "Em andamento"} tone="warning" />
          </div>
          <ProgressBar value={progressPercent} />
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {completedLessons} de {totalLessons} aulas concluídas nos materiais que tens ativos.
          </p>
        </div>

        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm md:col-span-2 xl:col-span-1">
          <p className="text-sm font-medium text-slate-500">A continuar agora</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{inProgressCourses.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {nextCourse ? `O próximo material aberto é ${nextCourse.title}.` : "Quando começares a estudar, este bloco ajuda-te a retomar."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const courseAction = getEnrolledCourseAction(product)

          return (
            <div key={product.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Material disponível</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">{product.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{getStudentProductDescription(product)}</p>
                </div>
                <StatusBadge
                  label={product.product_type === "free" ? "Gratuito" : "Ativo"}
                  tone={product.product_type === "free" ? "info" : "success"}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-700">
                <p>Disponível desde {formatDate(product.granted_at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={`${product.module_count} módulos`} tone="info" />
                  <StatusBadge label={`${product.lesson_count} aulas`} tone="warning" />
                  <StatusBadge label={`${product.asset_count} materiais`} tone="neutral" />
                  {product.preview_count > 0 ? <StatusBadge label={`${product.preview_count} previews`} tone="warning" /> : null}
                  {product.download_count > 0 ? <StatusBadge label={`${product.download_count} downloads`} tone="success" /> : null}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500">
                    <span>Progresso</span>
                    <span>{product.progress_percent}%</span>
                  </div>
                  <ProgressBar value={product.progress_percent} />
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {product.completed_lessons} de {product.lesson_count} aulas concluídas
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button asChild className="flex-1 rounded-full">
                  <Link to={courseAction?.to ?? `${ROUTES.DASHBOARD_PRODUCT}/${product.id}`}>
                    {getStudentProductAccessLabel(product.product_type)}
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
