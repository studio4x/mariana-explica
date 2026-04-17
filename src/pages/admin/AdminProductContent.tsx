import { useMemo, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminModuleAssets,
  useAdminProductModules,
  useAdminProducts,
  useCreateAdminModuleAsset,
  useCreateAdminProductModule,
  useDeleteAdminModuleAsset,
  useDeleteAdminProductModule,
  useUpdateAdminModuleAsset,
  useUpdateAdminProductModule,
} from "@/hooks/useAdmin"
import type { ModuleAssetSummary, ProductModuleSummary } from "@/types/app.types"

const moduleTypeLabels: Record<ProductModuleSummary["module_type"], string> = {
  pdf: "PDF",
  video: "Video",
  external_link: "Link externo",
  mixed: "Misto",
}

const accessTypeLabels: Record<ProductModuleSummary["access_type"], string> = {
  public: "Publico",
  registered: "Registado",
  paid_only: "Pago",
}

const assetTypeLabels: Record<ModuleAssetSummary["asset_type"], string> = {
  pdf: "PDF",
  video_file: "Video (ficheiro)",
  video_embed: "Video (embed)",
  external_link: "Link externo",
}

function nextSortOrder(items: Array<{ sort_order: number }>) {
  if (items.length === 0) return 0
  return Math.max(...items.map((item) => Number(item.sort_order) || 0)) + 1
}

export function AdminProductContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(id)

  const product = useMemo(() => {
    const list = productsQuery.data ?? []
    return list.find((entry) => entry.id === id) ?? null
  }, [productsQuery.data, id])

  const modules = modulesQuery.data ?? []
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const selectedModuleIdSafe = selectedModuleId ?? modules[0]?.id ?? null
  const selectedModule = modules.find((module) => module.id === selectedModuleIdSafe) ?? null

  const assetsQuery = useAdminModuleAssets(selectedModuleIdSafe ?? undefined)
  const assets = assetsQuery.data ?? []

  const createModule = useCreateAdminProductModule()
  const updateModule = useUpdateAdminProductModule()
  const deleteModule = useDeleteAdminProductModule()
  const createAsset = useCreateAdminModuleAsset()
  const updateAsset = useUpdateAdminModuleAsset()
  const deleteAsset = useDeleteAdminModuleAsset()

  const [moduleDraft, setModuleDraft] = useState({
    title: "",
    description: "",
    module_type: "pdf" as ProductModuleSummary["module_type"],
    access_type: "paid_only" as ProductModuleSummary["access_type"],
    is_preview: false,
    status: "published" as ProductModuleSummary["status"],
  })
  const [moduleSubmitError, setModuleSubmitError] = useState<string | null>(null)

  const [assetDraft, setAssetDraft] = useState({
    title: "",
    asset_type: "pdf" as ModuleAssetSummary["asset_type"],
    source: "storage" as "storage" | "external",
    storage_bucket: "",
    storage_path: "",
    external_url: "",
    allow_download: false,
    allow_stream: true,
    watermark_enabled: false,
    status: "active" as ModuleAssetSummary["status"],
  })
  const [assetSubmitError, setAssetSubmitError] = useState<string | null>(null)

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModule, setEditingModule] = useState<Partial<ProductModuleSummary>>({})

  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<
    Partial<ModuleAssetSummary> & { source?: "storage" | "external" }
  >({})

  const isLoading = productsQuery.isLoading || modulesQuery.isLoading || assetsQuery.isLoading
  const isError = productsQuery.isError || modulesQuery.isError || assetsQuery.isError
  const error = productsQuery.error ?? modulesQuery.error ?? assetsQuery.error ?? null

  const handleCreateModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setModuleSubmitError(null)

    if (!id) {
      setModuleSubmitError("Produto invalido.")
      return
    }

    const title = moduleDraft.title.trim()
    if (!title) {
      setModuleSubmitError("Titulo do modulo e obrigatorio.")
      return
    }

    try {
      await createModule.mutateAsync({
        productId: id,
        title,
        description: moduleDraft.description.trim() ? moduleDraft.description.trim() : null,
        module_type: moduleDraft.module_type,
        access_type: moduleDraft.access_type,
        is_preview: moduleDraft.is_preview,
        status: moduleDraft.status,
        sort_order: nextSortOrder(modules),
      })
      setModuleDraft({
        title: "",
        description: "",
        module_type: "pdf",
        access_type: "paid_only",
        is_preview: false,
        status: "published",
      })
    } catch (err) {
      setModuleSubmitError(err instanceof Error ? err.message : "Nao foi possivel criar o modulo.")
    }
  }

  const startEditModule = (module: ProductModuleSummary) => {
    setEditingModuleId(module.id)
    setEditingModule({
      title: module.title,
      description: module.description,
      module_type: module.module_type,
      access_type: module.access_type,
      is_preview: module.is_preview,
      status: module.status,
      sort_order: module.sort_order,
    })
  }

  const handleSaveModule = async () => {
    if (!editingModuleId) return
    setModuleSubmitError(null)
    try {
      await updateModule.mutateAsync({
        moduleId: editingModuleId,
        title: editingModule.title?.trim() ?? undefined,
        description:
          editingModule.description !== undefined
            ? editingModule.description?.trim()
              ? editingModule.description.trim()
              : null
            : undefined,
        module_type: editingModule.module_type,
        access_type: editingModule.access_type,
        is_preview: editingModule.is_preview,
        status: editingModule.status,
        sort_order: editingModule.sort_order,
      })
      setEditingModuleId(null)
      setEditingModule({})
    } catch (err) {
      setModuleSubmitError(err instanceof Error ? err.message : "Nao foi possivel guardar o modulo.")
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    const confirmed = window.confirm(
      "Queres remover este modulo? Isto remove tambem os materiais ligados a ele.",
    )
    if (!confirmed) return

    setModuleSubmitError(null)
    try {
      await deleteModule.mutateAsync(moduleId)
      if (selectedModuleIdSafe === moduleId) {
        setSelectedModuleId(null)
      }
    } catch (err) {
      setModuleSubmitError(err instanceof Error ? err.message : "Nao foi possivel remover o modulo.")
    }
  }

  const handleCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAssetSubmitError(null)

    if (!selectedModuleIdSafe) {
      setAssetSubmitError("Seleciona um modulo primeiro.")
      return
    }

    const title = assetDraft.title.trim()
    if (!title) {
      setAssetSubmitError("Titulo do material e obrigatorio.")
      return
    }

    const payload =
      assetDraft.source === "external"
        ? { external_url: assetDraft.external_url.trim() }
        : {
            storage_bucket: assetDraft.storage_bucket.trim(),
            storage_path: assetDraft.storage_path.trim(),
          }

    try {
      await createAsset.mutateAsync({
        moduleId: selectedModuleIdSafe,
        asset_type: assetDraft.asset_type,
        title,
        sort_order_asset: nextSortOrder(assets),
        ...payload,
        allow_download: assetDraft.allow_download,
        allow_stream: assetDraft.allow_stream,
        watermark_enabled: assetDraft.watermark_enabled,
        asset_status: assetDraft.status,
      })
      setAssetDraft({
        title: "",
        asset_type: "pdf",
        source: "storage",
        storage_bucket: "",
        storage_path: "",
        external_url: "",
        allow_download: false,
        allow_stream: true,
        watermark_enabled: false,
        status: "active",
      })
    } catch (err) {
      setAssetSubmitError(err instanceof Error ? err.message : "Nao foi possivel criar o material.")
    }
  }

  const startEditAsset = (asset: ModuleAssetSummary) => {
    setEditingAssetId(asset.id)
    setEditingAsset({
      title: asset.title,
      asset_type: asset.asset_type,
      sort_order: asset.sort_order,
      source: asset.external_url ? "external" : "storage",
      external_url: asset.external_url ?? "",
      storage_bucket: asset.storage_bucket ?? "",
      storage_path: asset.storage_path ?? "",
      allow_download: asset.allow_download,
      allow_stream: asset.allow_stream,
      watermark_enabled: asset.watermark_enabled,
      status: asset.status,
    })
  }

  const handleSaveAsset = async () => {
    if (!editingAssetId) return
    setAssetSubmitError(null)

    const source = editingAsset.source ?? (editingAsset.external_url ? "external" : "storage")
    const payload =
      source === "external"
        ? { external_url: String(editingAsset.external_url ?? "").trim() }
        : {
            storage_bucket: String(editingAsset.storage_bucket ?? "").trim(),
            storage_path: String(editingAsset.storage_path ?? "").trim(),
          }

    try {
      await updateAsset.mutateAsync({
        assetId: editingAssetId,
        title: editingAsset.title?.trim() ?? undefined,
        asset_type: editingAsset.asset_type,
        sort_order_asset: editingAsset.sort_order,
        ...payload,
        allow_download: editingAsset.allow_download,
        allow_stream: editingAsset.allow_stream,
        watermark_enabled: editingAsset.watermark_enabled,
        asset_status: editingAsset.status,
      })
      setEditingAssetId(null)
      setEditingAsset({})
    } catch (err) {
      setAssetSubmitError(err instanceof Error ? err.message : "Nao foi possivel guardar o material.")
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    const confirmed = window.confirm("Queres remover este material?")
    if (!confirmed) return

    setAssetSubmitError(null)
    try {
      await deleteAsset.mutateAsync(assetId)
    } catch (err) {
      setAssetSubmitError(err instanceof Error ? err.message : "Nao foi possivel remover o material.")
    }
  }

  if (isLoading) {
    return <LoadingState message="A carregar conteudo do produto..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o conteudo"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void productsQuery.refetch()
          void modulesQuery.refetch()
          void assetsQuery.refetch()
        }}
      />
    )
  }

  if (!id || !product) {
    return (
      <EmptyState title="Produto nao encontrado" message="Volta a lista de produtos para escolher um item valido." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Conteudo: ${product.title}`}
        description="Organiza modulos e materiais. O acesso do aluno continua a ser controlado por grants e RLS."
        backTo="/admin/produtos"
        actions={
          <Button variant="outline" className="rounded-full" onClick={() => navigate(`/produto/${product.slug}`)}>
            Ver pagina publica
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Modulos</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Cria e ordena os blocos do produto. Define preview e tipo de acesso por modulo.
              </p>
            </div>
            <StatusBadge label={`${modules.length} modulos`} tone="neutral" />
          </div>

          <form onSubmit={handleCreateModule} className="mt-5 rounded-2xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Novo modulo</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={moduleDraft.title}
                onChange={(event) => setModuleDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Titulo"
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
              <select
                value={moduleDraft.module_type}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    module_type: event.target.value as ProductModuleSummary["module_type"],
                  }))
                }
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                {Object.entries(moduleTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={moduleDraft.access_type}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    access_type: event.target.value as ProductModuleSummary["access_type"],
                  }))
                }
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                {Object.entries(accessTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={moduleDraft.status}
                onChange={(event) =>
                  setModuleDraft((prev) => ({
                    ...prev,
                    status: event.target.value as ProductModuleSummary["status"],
                  }))
                }
                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              >
                <option value="published">Publicado</option>
                <option value="draft">Rascunho</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
            <textarea
              value={moduleDraft.description}
              onChange={(event) => setModuleDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Descricao (opcional)"
              rows={3}
              className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={moduleDraft.is_preview}
                onChange={(event) => setModuleDraft((prev) => ({ ...prev, is_preview: event.target.checked }))}
              />
              Marcar como preview
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" className="rounded-full" disabled={createModule.isPending}>
                {createModule.isPending ? "A criar..." : "Criar modulo"}
              </Button>
              {moduleSubmitError ? <p className="text-sm text-rose-700">{moduleSubmitError}</p> : null}
            </div>
          </form>

          {modules.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Sem modulos" message="Cria o primeiro modulo para comecares a ligar materiais." />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {modules.map((module) => {
                const isSelected = module.id === selectedModuleIdSafe
                const isEditing = module.id === editingModuleId

                return (
                  <div
                    key={module.id}
                    className={`w-full rounded-2xl border p-4 transition ${
                      isSelected ? "border-slate-900 bg-slate-900 text-white" : "bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedModuleId(module.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{module.title}</p>
                          <p
                            className={`mt-1 text-xs uppercase tracking-[0.18em] ${
                              isSelected ? "text-white/65" : "text-slate-500"
                            }`}
                          >
                            {moduleTypeLabels[module.module_type]} • {accessTypeLabels[module.access_type]}
                          </p>
                        </div>
                        <StatusBadge
                          label={module.status}
                          tone={
                            module.status === "published"
                              ? "success"
                              : module.status === "archived"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </div>
                      <p className={`mt-2 text-sm leading-6 ${isSelected ? "text-white/80" : "text-slate-600"}`}>
                        {module.description ?? "Sem descricao."}
                      </p>
                    </button>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant={isSelected ? "secondary" : "outline"}
                        className="rounded-full"
                        onClick={() => startEditModule(module)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant={isSelected ? "secondary" : "outline"}
                        className="rounded-full"
                        onClick={() => void handleDeleteModule(module.id)}
                        disabled={deleteModule.isPending}
                      >
                        Remover
                      </Button>
                      {module.is_preview ? <StatusBadge label="preview" tone="info" /> : null}
                      <StatusBadge label={`ordem ${module.sort_order}`} tone="neutral" />
                    </div>

                    {isEditing ? (
                      <div
                        className={`mt-4 rounded-2xl border p-4 ${
                          isSelected ? "border-white/20 bg-white/10" : "bg-white"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                            isSelected ? "text-white/70" : "text-slate-600"
                          }`}
                        >
                          Editar modulo
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input
                            value={String(editingModule.title ?? "")}
                            onChange={(event) =>
                              setEditingModule((prev) => ({ ...prev, title: event.target.value }))
                            }
                            placeholder="Titulo"
                            className={`h-11 rounded-xl border px-4 text-sm outline-none ${
                              isSelected
                                ? "border-white/25 bg-white/10 text-white placeholder:text-white/60 focus:border-white/40"
                                : "bg-white focus:border-slate-400"
                            }`}
                          />
                          <input
                            value={String(editingModule.sort_order ?? module.sort_order)}
                            onChange={(event) =>
                              setEditingModule((prev) => ({ ...prev, sort_order: Number(event.target.value) }))
                            }
                            placeholder="Ordem"
                            className={`h-11 rounded-xl border px-4 text-sm outline-none ${
                              isSelected
                                ? "border-white/25 bg-white/10 text-white placeholder:text-white/60 focus:border-white/40"
                                : "bg-white focus:border-slate-400"
                            }`}
                          />
                          <select
                            value={String(editingModule.module_type ?? module.module_type)}
                            onChange={(event) =>
                              setEditingModule((prev) => ({
                                ...prev,
                                module_type: event.target.value as ProductModuleSummary["module_type"],
                              }))
                            }
                            className={`h-11 rounded-xl border px-4 text-sm outline-none ${
                              isSelected
                                ? "border-white/25 bg-white/10 text-white focus:border-white/40"
                                : "bg-white focus:border-slate-400"
                            }`}
                          >
                            {Object.entries(moduleTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={String(editingModule.access_type ?? module.access_type)}
                            onChange={(event) =>
                              setEditingModule((prev) => ({
                                ...prev,
                                access_type: event.target.value as ProductModuleSummary["access_type"],
                              }))
                            }
                            className={`h-11 rounded-xl border px-4 text-sm outline-none ${
                              isSelected
                                ? "border-white/25 bg-white/10 text-white focus:border-white/40"
                                : "bg-white focus:border-slate-400"
                            }`}
                          >
                            {Object.entries(accessTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={String(editingModule.description ?? "")}
                          onChange={(event) =>
                            setEditingModule((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Descricao"
                          rows={3}
                          className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                            isSelected
                              ? "border-white/25 bg-white/10 text-white placeholder:text-white/60 focus:border-white/40"
                              : "bg-white focus:border-slate-400"
                          }`}
                        />
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <select
                            value={String(editingModule.status ?? module.status)}
                            onChange={(event) =>
                              setEditingModule((prev) => ({
                                ...prev,
                                status: event.target.value as ProductModuleSummary["status"],
                              }))
                            }
                            className={`h-11 rounded-xl border px-4 text-sm outline-none ${
                              isSelected
                                ? "border-white/25 bg-white/10 text-white focus:border-white/40"
                                : "bg-white focus:border-slate-400"
                            }`}
                          >
                            <option value="published">Publicado</option>
                            <option value="draft">Rascunho</option>
                            <option value="archived">Arquivado</option>
                          </select>
                          <label
                            className={`flex items-center gap-2 text-sm ${
                              isSelected ? "text-white/85" : "text-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(editingModule.is_preview)}
                              onChange={(event) =>
                                setEditingModule((prev) => ({ ...prev, is_preview: event.target.checked }))
                              }
                            />
                            Preview
                          </label>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            className="rounded-full"
                            onClick={() => void handleSaveModule()}
                            disabled={updateModule.isPending}
                          >
                            {updateModule.isPending ? "A guardar..." : "Guardar"}
                          </Button>
                          <Button
                            variant="outline"
                            className={`rounded-full ${
                              isSelected ? "border-white/25 bg-white/10 text-white hover:bg-white/15" : ""
                            }`}
                            onClick={() => {
                              setEditingModuleId(null)
                              setEditingModule({})
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          {selectedModule ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-950">Materiais</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Modulo selecionado: <span className="font-medium text-slate-900">{selectedModule.title}</span>
                  </p>
                </div>
                <StatusBadge label={`${assets.length} itens`} tone="neutral" />
              </div>

              <form onSubmit={handleCreateAsset} className="mt-5 rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Novo material</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    value={assetDraft.title}
                    onChange={(event) => setAssetDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Titulo"
                    className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  />
                  <select
                    value={assetDraft.asset_type}
                    onChange={(event) =>
                      setAssetDraft((prev) => ({
                        ...prev,
                        asset_type: event.target.value as ModuleAssetSummary["asset_type"],
                      }))
                    }
                    className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  >
                    {Object.entries(assetTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assetDraft.source}
                    onChange={(event) =>
                      setAssetDraft((prev) => ({ ...prev, source: event.target.value as "storage" | "external" }))
                    }
                    className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="storage">Storage</option>
                    <option value="external">URL externa</option>
                  </select>
                  <select
                    value={assetDraft.status}
                    onChange={(event) =>
                      setAssetDraft((prev) => ({
                        ...prev,
                        status: event.target.value as ModuleAssetSummary["status"],
                      }))
                    }
                    className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                {assetDraft.source === "external" ? (
                  <input
                    value={assetDraft.external_url}
                    onChange={(event) => setAssetDraft((prev) => ({ ...prev, external_url: event.target.value }))}
                    placeholder="https://..."
                    className="mt-3 h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  />
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      value={assetDraft.storage_bucket}
                      onChange={(event) => setAssetDraft((prev) => ({ ...prev, storage_bucket: event.target.value }))}
                      placeholder="Bucket (ex: private-assets)"
                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                    />
                    <input
                      value={assetDraft.storage_path}
                      onChange={(event) => setAssetDraft((prev) => ({ ...prev, storage_path: event.target.value }))}
                      placeholder="Path (ex: products/{product}/modules/{module}/assets/{asset}.pdf)"
                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                )}

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={assetDraft.allow_download}
                      onChange={(event) => setAssetDraft((prev) => ({ ...prev, allow_download: event.target.checked }))}
                    />
                    Permitir download
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={assetDraft.allow_stream}
                      onChange={(event) => setAssetDraft((prev) => ({ ...prev, allow_stream: event.target.checked }))}
                    />
                    Permitir abrir
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={assetDraft.watermark_enabled}
                      onChange={(event) => setAssetDraft((prev) => ({ ...prev, watermark_enabled: event.target.checked }))}
                    />
                    Watermark
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button type="submit" className="rounded-full" disabled={createAsset.isPending}>
                    {createAsset.isPending ? "A criar..." : "Criar material"}
                  </Button>
                  {assetSubmitError ? <p className="text-sm text-rose-700">{assetSubmitError}</p> : null}
                </div>
              </form>

              {assets.length === 0 ? (
                <div className="mt-6">
                  <EmptyState title="Sem materiais" message="Liga PDFs, videos ou links a este modulo." />
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {assets.map((asset) => {
                    const isEditing = asset.id === editingAssetId
                    const currentSource = editingAsset.source ?? (editingAsset.external_url ? "external" : "storage")

                    return (
                      <div key={asset.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">{asset.title}</p>
                              <StatusBadge label={assetTypeLabels[asset.asset_type]} tone="info" />
                              <StatusBadge label={`ordem ${asset.sort_order}`} tone="neutral" />
                              <StatusBadge label={asset.status} tone={asset.status === "active" ? "success" : "warning"} />
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {asset.external_url
                                ? `URL: ${asset.external_url}`
                                : `Storage: ${asset.storage_bucket ?? "-"} / ${asset.storage_path ?? "-"}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-full" onClick={() => startEditAsset(asset)}>
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="rounded-full"
                              onClick={() => void handleDeleteAsset(asset.id)}
                              disabled={deleteAsset.isPending}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                              Editar material
                            </p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <input
                                value={String(editingAsset.title ?? "")}
                                onChange={(event) => setEditingAsset((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Titulo"
                                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                              />
                              <input
                                value={String(editingAsset.sort_order ?? asset.sort_order)}
                                onChange={(event) =>
                                  setEditingAsset((prev) => ({ ...prev, sort_order: Number(event.target.value) }))
                                }
                                placeholder="Ordem"
                                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                              />
                              <select
                                value={String(editingAsset.asset_type ?? asset.asset_type)}
                                onChange={(event) =>
                                  setEditingAsset((prev) => ({
                                    ...prev,
                                    asset_type: event.target.value as ModuleAssetSummary["asset_type"],
                                  }))
                                }
                                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                              >
                                {Object.entries(assetTypeLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={String(editingAsset.status ?? asset.status)}
                                onChange={(event) =>
                                  setEditingAsset((prev) => ({
                                    ...prev,
                                    status: event.target.value as ModuleAssetSummary["status"],
                                  }))
                                }
                                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                              >
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                              </select>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <select
                                value={String(currentSource)}
                                onChange={(event) =>
                                  setEditingAsset((prev) => ({
                                    ...prev,
                                    source: event.target.value as "storage" | "external",
                                  }))
                                }
                                className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                              >
                                <option value="storage">Storage</option>
                                <option value="external">URL externa</option>
                              </select>
                              <div />
                            </div>

                            {currentSource === "external" ? (
                              <input
                                value={String(editingAsset.external_url ?? "")}
                                onChange={(event) =>
                                  setEditingAsset((prev) => ({ ...prev, external_url: event.target.value }))
                                }
                                placeholder="https://..."
                                className="mt-3 h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                              />
                            ) : (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <input
                                  value={String(editingAsset.storage_bucket ?? "")}
                                  onChange={(event) =>
                                    setEditingAsset((prev) => ({ ...prev, storage_bucket: event.target.value }))
                                  }
                                  placeholder="Bucket"
                                  className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                />
                                <input
                                  value={String(editingAsset.storage_path ?? "")}
                                  onChange={(event) =>
                                    setEditingAsset((prev) => ({ ...prev, storage_path: event.target.value }))
                                  }
                                  placeholder="Path"
                                  className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                                />
                              </div>
                            )}

                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editingAsset.allow_download)}
                                  onChange={(event) =>
                                    setEditingAsset((prev) => ({ ...prev, allow_download: event.target.checked }))
                                  }
                                />
                                Download
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editingAsset.allow_stream)}
                                  onChange={(event) =>
                                    setEditingAsset((prev) => ({ ...prev, allow_stream: event.target.checked }))
                                  }
                                />
                                Abrir
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editingAsset.watermark_enabled)}
                                  onChange={(event) =>
                                    setEditingAsset((prev) => ({ ...prev, watermark_enabled: event.target.checked }))
                                  }
                                />
                                Watermark
                              </label>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button className="rounded-full" onClick={() => void handleSaveAsset()} disabled={updateAsset.isPending}>
                                {updateAsset.isPending ? "A guardar..." : "Guardar"}
                              </Button>
                              <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => {
                                  setEditingAssetId(null)
                                  setEditingAsset({})
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="Seleciona um modulo"
              message="Escolhe um modulo na coluna da esquerda para ver e editar os materiais."
            />
          )}
        </section>
      </div>
    </div>
  )
}
