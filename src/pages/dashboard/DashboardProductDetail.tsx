import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useDashboardProductContent, useRequestAssetAccess } from "@/hooks/useDashboard"
import type { ModuleAssetSummary } from "@/types/app.types"

function getModuleTone(accessType: string, isPreview: boolean): "info" | "warning" | "success" {
  if (isPreview || accessType === "public") return "info"
  if (accessType === "registered") return "warning"
  return "success"
}

export function DashboardProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const { data, isLoading, isError, error, refetch } = useDashboardProductContent(id)
  const assetAccess = useRequestAssetAccess()

  const modules = data?.modules ?? []
  const selectedModuleIdSafe = selectedModuleId ?? modules[0]?.id ?? null
  const selectedModule = modules.find((module) => module.id === selectedModuleIdSafe) ?? null
  const selectedAssets = useMemo(
    () => (data?.assets ?? []).filter((asset) => asset.module_id === selectedModuleIdSafe),
    [data?.assets, selectedModuleIdSafe],
  )

  const handleOpenAsset = async (asset: ModuleAssetSummary) => {
    const result = await assetAccess.mutateAsync(asset.id)
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  if (isLoading) {
    return <LoadingState message="Carregando conteúdo do produto..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o produto"
        message={error instanceof Error ? error.message : "Tente novamente em instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data?.product) {
    return (
      <EmptyState
        title="Produto indisponível"
        message="Esse item não está acessível para a sua conta."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.product.title}
        description={data.product.short_description ?? data.product.description ?? "Conteúdo do produto."}
        backTo="/dashboard/produtos"
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Módulos</h2>
          <div className="mt-5 space-y-3">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => setSelectedModuleId(module.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedModuleIdSafe === module.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{module.title}</p>
                  <StatusBadge
                    label={module.is_preview ? "Preview" : module.access_type}
                    tone={getModuleTone(module.access_type, module.is_preview)}
                  />
                </div>
                <p className={`mt-2 text-sm leading-6 ${selectedModuleIdSafe === module.id ? "text-white/80" : "text-slate-600"}`}>
                  {module.description ?? "Módulo pronto para acesso seguro."}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          {selectedModule ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{selectedModule.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedModule.description ?? "Selecione um asset para abrir o conteúdo."}
                  </p>
                </div>
                <StatusBadge
                  label={selectedModule.module_type}
                  tone="neutral"
                />
              </div>

              {selectedAssets.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Sem assets neste módulo"
                    message="Quando houver material associado ao módulo, ele aparece aqui."
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {selectedAssets.map((asset) => (
                    <div key={asset.id} className="rounded-2xl border bg-slate-50/70 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{asset.title}</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Tipo: {asset.asset_type} · Download {asset.allow_download ? "permitido" : "restrito"}
                          </p>
                        </div>
                        <Button onClick={() => void handleOpenAsset(asset)} disabled={assetAccess.isPending}>
                          {assetAccess.isPending ? "Gerando acesso..." : "Abrir conteúdo"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="Sem módulos disponíveis"
              message="Os módulos publicados deste produto aparecem aqui."
            />
          )}
        </section>
      </div>
    </div>
  )
}
