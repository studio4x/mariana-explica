import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useParams } from "react-router-dom"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import {
  useAdminModuleAssets,
  useAdminProductLessons,
  useCreateAdminModuleAsset,
  useDeleteAdminModuleAsset,
  useUploadAdminModuleAssetFile,
  useUpdateAdminModuleAsset,
} from "@/hooks/useAdmin"
import type { ModuleAssetSummary } from "@/types/app.types"

export function CourseLessonMaterialsPanel() {
  const { moduleId, lessonId } = useParams<{ moduleId: string; lessonId: string }>()
  const assetsQuery = useAdminModuleAssets(moduleId)
  const lessonsQuery = useAdminProductLessons(moduleId)
  const createAsset = useCreateAdminModuleAsset()
  const updateAsset = useUpdateAdminModuleAsset()
  const deleteAsset = useDeleteAdminModuleAsset()
  const uploadAssetFile = useUploadAdminModuleAssetFile()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState({
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
    mime_type: "",
    file_size_bytes: null as number | null,
  })
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<Partial<ModuleAssetSummary> & { source?: "storage" | "external" }>(
    {},
  )

  if (!moduleId || !lessonId) {
    return <EmptyState title="Rota invalida" message="Seleciona uma aula valida para gerir os materiais." />
  }

  if (assetsQuery.isLoading || lessonsQuery.isLoading) {
    return <LoadingState message="A carregar materiais da aula..." />
  }

  if (assetsQuery.isError || lessonsQuery.isError) {
    const queryError = assetsQuery.error ?? lessonsQuery.error
    return (
      <ErrorState
        title="Nao foi possivel abrir os materiais"
        message={queryError instanceof Error ? queryError.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void assetsQuery.refetch()
          void lessonsQuery.refetch()
        }}
      />
    )
  }

  const assets = assetsQuery.data ?? []
  const lesson = useMemo(
    () => (lessonsQuery.data ?? []).find((item) => item.id === lessonId) ?? null,
    [lessonId, lessonsQuery.data],
  )

  if (!lesson) {
    return <EmptyState title="Aula nao encontrada" message="A aula pedida nao pertence a este modulo." />
  }

  const nextOrder = assets.length === 0 ? 1 : Math.max(...assets.map((asset) => asset.sort_order)) + 1

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await createAsset.mutateAsync({
        moduleId,
        title: draft.title.trim(),
        asset_type: draft.asset_type,
        sort_order_asset: nextOrder,
        storage_bucket: draft.source === "storage" ? draft.storage_bucket.trim() || null : null,
        storage_path: draft.source === "storage" ? draft.storage_path.trim() || null : null,
        external_url: draft.source === "external" ? draft.external_url.trim() || null : null,
        mime_type: draft.mime_type.trim() || null,
        file_size_bytes: draft.file_size_bytes ?? null,
        allow_download: draft.allow_download,
        allow_stream: draft.allow_stream,
        watermark_enabled: draft.watermark_enabled,
        asset_status: draft.status,
      })

      setDraft({
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
        mime_type: "",
        file_size_bytes: null,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel criar o material.")
    }
  }

  const handleDraftFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    setError(null)
    try {
      const upload = await uploadAssetFile.mutateAsync({ moduleId, file })
      setDraft((prev) => ({
        ...prev,
        storage_bucket: upload.bucket,
        storage_path: upload.path,
        mime_type: upload.mime_type ?? "",
        file_size_bytes: upload.file_size_bytes,
        title: prev.title || upload.file_name.replace(/\.[^.]+$/, ""),
      }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel subir o ficheiro.")
    } finally {
      event.target.value = ""
    }
  }

  const handleEditFileSelection = async (asset: ModuleAssetSummary, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    setError(null)
    try {
      const upload = await uploadAssetFile.mutateAsync({
        moduleId,
        file,
        replacePath: asset.storage_path,
      })
      setEditingAsset((prev) => ({
        ...prev,
        storage_bucket: upload.bucket,
        storage_path: upload.path,
        mime_type: upload.mime_type ?? "",
        file_size_bytes: upload.file_size_bytes,
        title: String(prev.title ?? asset.title) || upload.file_name.replace(/\.[^.]+$/, ""),
      }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel substituir o ficheiro.")
    } finally {
      event.target.value = ""
    }
  }

  const handleSaveAsset = async (assetId: string) => {
    setError(null)

    try {
      await updateAsset.mutateAsync({
        assetId,
        title: editingAsset.title?.trim(),
        asset_type: editingAsset.asset_type,
        sort_order_asset: editingAsset.sort_order,
        storage_bucket: editingAsset.source === "storage" ? editingAsset.storage_bucket ?? null : null,
        storage_path: editingAsset.source === "storage" ? editingAsset.storage_path ?? null : null,
        external_url: editingAsset.source === "external" ? editingAsset.external_url ?? null : null,
        allow_download: editingAsset.allow_download,
        allow_stream: editingAsset.allow_stream,
        watermark_enabled: editingAsset.watermark_enabled,
        asset_status: editingAsset.status,
      })
      setEditingAssetId(null)
      setEditingAsset({})
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel guardar o material.")
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title={`Materiais da aula: ${lesson.title}`}
          description="Gestor dedicado de ficheiros e links do modulo, alinhado ao rodape operacional da aula no player."
        />

        <form onSubmit={handleCreate} className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titulo do material"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <select
            value={draft.asset_type}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, asset_type: event.target.value as ModuleAssetSummary["asset_type"] }))
            }
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="pdf">PDF</option>
            <option value="video_file">Video</option>
            <option value="video_embed">Video embed</option>
            <option value="external_link">Link externo</option>
          </select>
          <select
            value={draft.source}
            onChange={(event) => setDraft((prev) => ({ ...prev, source: event.target.value as "storage" | "external" }))}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="storage">Storage</option>
            <option value="external">URL externa</option>
          </select>
          {draft.source === "storage" ? (
            <>
              <div className="md:col-span-2 rounded-2xl border bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-950">Ficheiro privado</p>
                <p className="mt-1 text-sm text-slate-600">
                  Faz upload para o storage privado do curso. O backend grava bucket e path automaticamente.
                </p>
                <input type="file" onChange={handleDraftFileSelection} className="mt-4 text-sm" />
                {draft.storage_path ? (
                  <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-950">{draft.storage_bucket}</p>
                    <p className="mt-1 break-all text-slate-500">{draft.storage_path}</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <input
              value={draft.external_url}
              onChange={(event) => setDraft((prev) => ({ ...prev, external_url: event.target.value }))}
              placeholder="https://..."
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:col-span-2"
            />
          )}

          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.allow_download}
              onChange={(event) => setDraft((prev) => ({ ...prev, allow_download: event.target.checked }))}
            />
            Download permitido
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.allow_stream}
              onChange={(event) => setDraft((prev) => ({ ...prev, allow_stream: event.target.checked }))}
            />
            Abrir na plataforma
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.watermark_enabled}
              onChange={(event) => setDraft((prev) => ({ ...prev, watermark_enabled: event.target.checked }))}
            />
            Watermark
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" className="rounded-full" disabled={createAsset.isPending}>
              {createAsset.isPending ? "A criar..." : "Criar material"}
            </Button>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          </div>
        </form>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Itens configurados</h2>
            <p className="mt-1 text-sm text-slate-600">Lista de materiais ligados ao modulo da aula.</p>
          </div>
          <StatusBadge label={`${assets.length} materiais`} tone="info" />
        </div>

        <div className="mt-4 space-y-3">
          {assets.length === 0 ? (
            <EmptyState title="Sem materiais" message="Cria o primeiro material do modulo para ligar no player." />
          ) : (
            assets.map((asset) => {
              const isEditing = editingAssetId === asset.id
              const source = editingAsset.source ?? (asset.external_url ? "external" : "storage")

              return (
                <div key={asset.id} className="rounded-2xl border bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{asset.title}</p>
                        <StatusBadge label={asset.asset_type} tone="neutral" />
                        <StatusBadge label={asset.status} tone={asset.status === "active" ? "success" : "warning"} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {asset.external_url
                          ? `URL externa: ${asset.external_url}`
                          : `Storage: ${asset.storage_bucket ?? "-"} / ${asset.storage_path ?? "-"}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          setEditingAssetId(asset.id)
                          setEditingAsset({
                            ...asset,
                            source: asset.external_url ? "external" : "storage",
                          })
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={deleteAsset.isPending}
                        onClick={() => void deleteAsset.mutateAsync(asset.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
                      <input
                        value={String(editingAsset.title ?? "")}
                        onChange={(event) => setEditingAsset((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Titulo"
                        className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <input
                        value={String(editingAsset.sort_order ?? asset.sort_order)}
                        onChange={(event) =>
                          setEditingAsset((prev) => ({ ...prev, sort_order: Number(event.target.value || 0) }))
                        }
                        placeholder="Ordem"
                        className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"
                      />
                      <select
                        value={String(editingAsset.asset_type ?? asset.asset_type)}
                        onChange={(event) =>
                          setEditingAsset((prev) => ({
                            ...prev,
                            asset_type: event.target.value as ModuleAssetSummary["asset_type"],
                          }))
                        }
                        className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="pdf">PDF</option>
                        <option value="video_file">Video</option>
                        <option value="video_embed">Video embed</option>
                        <option value="external_link">Link externo</option>
                      </select>
                      <select
                        value={source}
                        onChange={(event) =>
                          setEditingAsset((prev) => ({ ...prev, source: event.target.value as "storage" | "external" }))
                        }
                        className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="storage">Storage</option>
                        <option value="external">URL externa</option>
                      </select>
                      {source === "storage" ? (
                        <>
                          <div className="md:col-span-2 rounded-2xl border bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-950">Ficheiro privado</p>
                            <input type="file" onChange={(event) => void handleEditFileSelection(asset, event)} className="mt-3 text-sm" />
                            <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                              <p className="font-medium text-slate-950">{String(editingAsset.storage_bucket ?? asset.storage_bucket ?? "-")}</p>
                              <p className="mt-1 break-all text-slate-500">{String(editingAsset.storage_path ?? asset.storage_path ?? "-")}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <input
                          value={String(editingAsset.external_url ?? "")}
                          onChange={(event) => setEditingAsset((prev) => ({ ...prev, external_url: event.target.value }))}
                          placeholder="https://..."
                          className="md:col-span-2 h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400"
                        />
                      )}
                      <div className="md:col-span-2 flex flex-wrap gap-4 text-sm text-slate-700">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editingAsset.allow_download)}
                            onChange={(event) => setEditingAsset((prev) => ({ ...prev, allow_download: event.target.checked }))}
                          />
                          Download
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editingAsset.allow_stream)}
                            onChange={(event) => setEditingAsset((prev) => ({ ...prev, allow_stream: event.target.checked }))}
                          />
                          Abrir
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(editingAsset.watermark_enabled)}
                            onChange={(event) => setEditingAsset((prev) => ({ ...prev, watermark_enabled: event.target.checked }))}
                          />
                          Watermark
                        </label>
                      </div>
                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <Button type="button" className="rounded-full" disabled={updateAsset.isPending} onClick={() => void handleSaveAsset(asset.id)}>
                          {updateAsset.isPending ? "A guardar..." : "Guardar material"}
                        </Button>
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => { setEditingAssetId(null); setEditingAsset({}) }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
