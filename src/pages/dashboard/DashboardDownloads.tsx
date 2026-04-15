import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui"
import { useDownloads, useRequestAssetAccess } from "@/hooks/useDashboard"

export function DashboardDownloads() {
  const { data, isLoading, isError, error, refetch } = useDownloads()
  const assetAccess = useRequestAssetAccess()

  if (isLoading) {
    return <LoadingState message="Carregando downloads..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os downloads"
        message={error instanceof Error ? error.message : "Tente novamente em instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const items = data ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum download disponível"
        message="Apenas arquivos com download permitido aparecem nesta central."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"
        description="Arquivos disponíveis para a sua conta."
      />

      <div className="space-y-4">
        {items.map(({ asset, module, product }) => (
          <div key={asset.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{asset.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {product?.title} · {module?.title}
                </p>
              </div>
              <Button onClick={() => void assetAccess.mutateAsync(asset.id).then((result) => window.open(result.url, "_blank", "noopener,noreferrer"))}>
                {assetAccess.isPending ? "Gerando acesso..." : "Baixar arquivo"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
