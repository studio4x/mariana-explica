import { Link } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useMyProducts } from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import { formatDate } from "@/utils/date"
import { getDashboardProductNote } from "@/lib/product-presentation"

export function DashboardProducts() {
  const { data, isLoading, isError, error, refetch } = useMyProducts()

  if (isLoading) {
    return <LoadingState message="A carregar os teus produtos..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os produtos"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const products = data ?? []
  const freeProducts = products.filter((product) => product.product_type === "free").length

  if (products.length === 0) {
    return (
      <EmptyState
        title="Ainda sem produtos ativos"
        message="Quando ativares um produto, ele vai aparecer aqui com acesso organizado."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus produtos"
        description="Todos os conteudos disponiveis na tua conta, organizados para ser facil retomar o estudo."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Produtos ativos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tudo o que tens pronto para abrir agora.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Materiais gratuitos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{freeProducts}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Produtos de entrada para consulta e rotina de estudo.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Continuidade</p>
          <p className="mt-3 text-3xl font-bold">Tudo num so lugar</p>
          <p className="mt-2 text-sm leading-6 text-white/82">
            Abre o produto certo, consulta os materiais e retoma sem depender de ficheiros soltos.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Produto disponivel</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">{product.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{getDashboardProductNote(product)}</p>
              </div>
              <StatusBadge
                label={product.product_type === "free" ? "Gratuito" : "Ativo"}
                tone={product.product_type === "free" ? "info" : "success"}
              />
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-700">
              <p>Disponivel desde {formatDate(product.granted_at)}</p>
              <p className="mt-2">Organizado para continuares sem perder o contexto do estudo.</p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button asChild className="flex-1 rounded-full">
                <Link to={`${ROUTES.DASHBOARD_PRODUCT}/${product.id}`}>Continuar</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 rounded-full">
                <Link to={ROUTES.DASHBOARD_DOWNLOADS}>Downloads</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
