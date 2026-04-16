import { useState } from "react"
import { useParams } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useDashboardProductContent, useRequestAssetAccess } from "@/hooks/useDashboard"
import type { ModuleAssetSummary } from "@/types/app.types"
import {
  getAssetActionLabel,
  getAssetTypeLabel,
  getModuleTypeLabel,
  getProductNarrative,
} from "@/lib/product-presentation"

function getModuleLabel(accessType: string, isPreview: boolean) {
  if (isPreview || accessType === "public") return "Preview"
  if (accessType === "registered") return "Disponivel"
  return "Incluido"
}

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
  const selectedAssets = (data?.assets ?? []).filter((asset) => asset.module_id === selectedModuleIdSafe)
  const previewModules = modules.filter((module) => module.is_preview).length

  const handleOpenAsset = async (asset: ModuleAssetSummary) => {
    const result = await assetAccess.mutateAsync(asset.id)
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  if (isLoading) {
    return <LoadingState message="A carregar conteudo do produto..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar este produto"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data?.product) {
    return (
      <EmptyState
        title="Produto indisponivel"
        message="Este item nao esta acessivel na tua conta neste momento."
      />
    )
  }

  const narrative = getProductNarrative(data.product)

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.product.title}
        description={data.product.short_description ?? data.product.description ?? "Conteudo do produto."}
        backTo="/dashboard/produtos"
      />

      <section className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-6 text-white shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/65">{narrative.familyLabel}</p>
            <h2 className="mt-3 font-display text-3xl font-bold">{data.product.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82">{narrative.accessLabel}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge label="Grant ativo" tone="success" />
              <StatusBadge label={`${previewModules} previews`} tone="info" />
              <StatusBadge label={modules.length > 0 ? "Conteudo organizado" : "Sem modulos"} tone="neutral" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Modulos</p>
              <p className="mt-3 text-2xl font-bold">{modules.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Materiais</p>
              <p className="mt-3 text-2xl font-bold">{data.assets?.length ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/65">Foco</p>
              <p className="mt-3 text-sm leading-6 text-white/82">Continuar com clareza, sem perder o contexto.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-950">Modulos</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Escolhe um modulo para abrir os materiais associados e continuar o estudo.
                  </p>
                </div>
                <StatusBadge label={`${modules.length} modulos`} tone="neutral" />
              </div>

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
                  <div>
                    <p className="font-semibold">{module.title}</p>
                    <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${selectedModuleIdSafe === module.id ? "text-white/65" : "text-slate-500"}`}>
                      {getModuleTypeLabel(module.module_type)}
                    </p>
                  </div>
                  <StatusBadge
                    label={getModuleLabel(module.access_type, module.is_preview)}
                    tone={getModuleTone(module.access_type, module.is_preview)}
                  />
                </div>
                <p className={`mt-2 text-sm leading-6 ${selectedModuleIdSafe === module.id ? "text-white/80" : "text-slate-600"}`}>
                  {module.description ?? "Conteudo organizado para ser visto passo a passo."}
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
                  <h2 className="font-display text-2xl font-bold text-slate-950">{selectedModule.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {selectedModule.description ?? "Abre um dos materiais abaixo para continuares."}
                  </p>
                </div>
                <StatusBadge label={getModuleTypeLabel(selectedModule.module_type)} tone="neutral" />
              </div>

              {selectedAssets.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Sem materiais neste modulo"
                    message="Quando houver conteudo associado, ele aparece aqui."
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {selectedAssets.map((asset) => (
                    <div key={asset.id} className="rounded-2xl border bg-slate-50/70 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">{asset.title}</p>
                            <StatusBadge label={getAssetTypeLabel(asset.asset_type)} tone="info" />
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {asset.allow_download
                              ? "Material disponivel para abrir e descarregar quando permitido."
                              : "Material disponivel para consulta dentro do teu acesso."}
                          </p>
                        </div>
                        <Button onClick={() => void handleOpenAsset(asset)} disabled={assetAccess.isPending} className="rounded-full">
                          {assetAccess.isPending ? "A abrir..." : getAssetActionLabel(asset)}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="Sem modulos disponiveis"
              message="Os modulos publicados deste produto vao aparecer aqui."
            />
          )}
        </section>
      </div>
    </div>
  )
}
