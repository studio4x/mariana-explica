import { Link } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useMyProducts } from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import { formatDate } from "@/utils/date"

export function DashboardProducts() {
  const { data, isLoading, isError, error, refetch } = useMyProducts()

  if (isLoading) {
    return <LoadingState message="Carregando os seus produtos..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os produtos"
        message={error instanceof Error ? error.message : "Tente novamente em instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const products = data ?? []

  if (products.length === 0) {
    return (
      <EmptyState
        title="Ainda sem produtos liberados"
        message="Quando uma compra for confirmada ou um produto gratuito for ativado, ele aparece aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus produtos"
        description="Todos os conteúdos liberados para a sua conta."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{product.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {product.short_description ?? product.description ?? "Conteúdo pronto para consumo."}
                </p>
              </div>
              <StatusBadge
                label={product.product_type === "free" ? "Gratuito" : "Pago"}
                tone={product.product_type === "free" ? "info" : "success"}
              />
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <p>Liberado em {formatDate(product.granted_at)}</p>
              <p>Slug interno: {product.slug}</p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button asChild className="flex-1">
                <Link to={`${ROUTES.DASHBOARD_PRODUCT}/${product.id}`}>Abrir produto</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to={ROUTES.DASHBOARD_DOWNLOADS}>Downloads</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
