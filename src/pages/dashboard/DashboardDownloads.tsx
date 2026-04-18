import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useMyProducts } from "@/hooks/useDashboard"
import { useDownloads, useRequestAssetAccess } from "@/hooks/useDashboard"

export function DashboardDownloads() {
  const { data, isLoading, isError, error, refetch } = useDownloads()
  const productsQuery = useMyProducts()
  const assetAccess = useRequestAssetAccess()

  if (isLoading) {
    return <LoadingState message="A carregar downloads..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os downloads"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const items = data ?? []
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Downloads"
          description="Materiais protegidos aparecem aqui quando existe grant ativo e o download está permitido."
        />
        <EmptyState
          title="Ainda sem downloads disponiveis"
          message="Sem grant ativo ou sem materiais descarregáveis, esta área fica vazia por segurança."
        />
      </div>
    )
  }

  const products = productsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"
        description="Todos os ficheiros disponiveis na tua conta, num unico lugar para ser facil encontrar."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Materiais descarregáveis</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{items.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cursos ativos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Acesso protegido</p>
          <p className="mt-3 text-xl font-bold">Sem grant nao ha descarregamento</p>
          <p className="mt-2 text-sm leading-6 text-white/82">
            Esta pagina só mostra o que o backend autorizou para a tua conta.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {items.map(({ asset, module, product }) => (
          <div key={asset.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950">{asset.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {product?.title} · {module?.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={asset.allow_download ? "Descarregavel" : "Consulta"} tone={asset.allow_download ? "success" : "info"} />
                  {asset.watermark_enabled ? <StatusBadge label="Marca d'agua" tone="neutral" /> : null}
                  {asset.allow_stream ? <StatusBadge label="Streaming" tone="neutral" /> : null}
                </div>
              </div>
              <Button
                className="rounded-full"
                onClick={() =>
                  void assetAccess
                    .mutateAsync(asset.id)
                    .then((result) => window.open(result.url, "_blank", "noopener,noreferrer"))
                }
              >
                {assetAccess.isPending ? "A preparar..." : "Descarregar"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
