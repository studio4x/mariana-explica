import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui"
import { useDownloads, useRequestAssetAccess } from "@/hooks/useDashboard"

export function DashboardDownloads() {
  const { data, isLoading, isError, error, refetch } = useDownloads()
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
      <EmptyState
        title="Ainda sem downloads disponiveis"
        message="Quando houver materiais para descarregar, eles ficam reunidos nesta central."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"
        description="Todos os ficheiros disponiveis na tua conta, num unico lugar para ser facil encontrar."
      />

      <div className="space-y-4">
        {items.map(({ asset, module, product }) => (
          <div key={asset.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950">{asset.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {product?.title} · {module?.title}
                </p>
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
