import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  deleteAdminR2Object,
  fetchAdminR2Objects,
  fetchAdminR2UsageOverview,
} from "@/services"

type AdminR2FileType = "all" | "image" | "video" | "audio" | "document" | "archive" | "other"

const FILE_TYPE_OPTIONS: Array<{ value: AdminR2FileType; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "image", label: "Imagens" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audios" },
  { value: "document", label: "Documentos" },
  { value: "archive", label: "Arquivos" },
  { value: "other", label: "Outros" },
]

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : exponent === 1 ? 0 : 1)} ${units[exponent]}`
}

function formatObjectDate(value: string | null) {
  if (!value) return "Sem data"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function getObjectName(storagePath: string) {
  return storagePath.split("/").at(-1) ?? storagePath
}

function getFileTypeLabel(fileType: AdminR2FileType) {
  return FILE_TYPE_OPTIONS.find((option) => option.value === fileType)?.label ?? "Outros"
}

export function AdminStorageR2() {
  const queryClient = useQueryClient()
  const [prefixDraft, setPrefixDraft] = useState("")
  const [searchDraft, setSearchDraft] = useState("")
  const [fileTypeDraft, setFileTypeDraft] = useState<AdminR2FileType>("all")
  const [filters, setFilters] = useState<{
    prefix: string
    search: string
    fileType: AdminR2FileType
  }>({
    prefix: "",
    search: "",
    fileType: "all",
  })
  const [cursor, setCursor] = useState<string | null>(null)

  const overviewQuery = useQuery({
    queryKey: ["admin", "r2", "overview", filters.prefix],
    queryFn: () => fetchAdminR2UsageOverview(filters.prefix || null),
  })

  const objectsQuery = useQuery({
    queryKey: ["admin", "r2", "objects", filters.prefix, filters.search, filters.fileType, cursor],
    queryFn: () =>
      fetchAdminR2Objects({
        prefix: filters.prefix || null,
        search: filters.search || null,
        fileType: filters.fileType,
        cursor,
        limit: 100,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminR2Object,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "r2", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "r2", "objects"] }),
      ])
    },
  })

  const objects = useMemo(() => objectsQuery.data?.objects ?? [], [objectsQuery.data?.objects])
  const hasActiveFilters = Boolean(filters.prefix || filters.search || filters.fileType !== "all")

  function applyFilters() {
    setCursor(null)
    setFilters({
      prefix: prefixDraft.trim(),
      search: searchDraft.trim(),
      fileType: fileTypeDraft,
    })
  }

  function resetFilters() {
    setCursor(null)
    setPrefixDraft("")
    setSearchDraft("")
    setFileTypeDraft("all")
    setFilters({
      prefix: "",
      search: "",
      fileType: "all",
    })
  }

  if (overviewQuery.isLoading && objectsQuery.isLoading) {
    return <LoadingState message="A carregar observabilidade do R2..." />
  }

  if (overviewQuery.isError || objectsQuery.isError) {
    const error = overviewQuery.error ?? objectsQuery.error
    return (
      <ErrorState
        title="Nao foi possivel abrir o painel do R2"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void overviewQuery.refetch()
          void objectsQuery.refetch()
        }}
      />
    )
  }

  const overview = overviewQuery.data

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Storage R2"
          description="Observabilidade operacional do bucket privado da plataforma, com visao geral, listagem e exclusao controlada."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Bucket</p>
            <p className="mt-2 text-lg font-bold text-slate-950">{overview?.bucket ?? "-"}</p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Objetos</p>
            <p className="mt-2 text-lg font-bold text-slate-950">{overview?.object_count ?? 0}</p>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Volume</p>
            <p className="mt-2 text-lg font-bold text-slate-950">{formatBytes(overview?.total_size_bytes ?? 0)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Objetos do bucket</h2>
            <p className="mt-1 text-sm text-slate-600">
              Prefixos lógicos como `course-assets-private/` e `site-pages-public/` vivem dentro do mesmo bucket físico.
            </p>
          </div>
          <StatusBadge label={`${objects.length} itens nesta página`} tone="info" />
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_220px_auto]">
            <input
              value={prefixDraft}
              onChange={(event) => setPrefixDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters()
              }}
              placeholder="Prefixo, ex.: site-pages-public/pages/home/"
              className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters()
              }}
              placeholder="Pesquisar por nome ou caminho"
              className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
            />
            <select
              value={fileTypeDraft}
              onChange={(event) => setFileTypeDraft(event.target.value as AdminR2FileType)}
              className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
            >
              {FILE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={applyFilters}>
                Aplicar
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={resetFilters}>
                Limpar
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {filters.prefix ? <StatusBadge label={`Prefixo: ${filters.prefix}`} tone="neutral" /> : null}
            {filters.search ? <StatusBadge label={`Pesquisa: ${filters.search}`} tone="neutral" /> : null}
            {filters.fileType !== "all" ? <StatusBadge label={`Tipo: ${getFileTypeLabel(filters.fileType)}`} tone="neutral" /> : null}
            {!hasActiveFilters ? <span>Sem filtros ativos.</span> : null}
          </div>
        </div>

        {objectsQuery.isLoading ? (
          <div className="mt-6">
            <LoadingState message="A carregar objectos..." />
          </div>
        ) : objects.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Sem objetos" message="Nao ha objetos para os filtros atuais." />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {objects.map((object) => (
              <div key={object.key} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                      {object.preview_url ? (
                        <a href={object.preview_url} target="_blank" rel="noreferrer" className="block h-full w-full">
                          <img src={object.preview_url} alt={getObjectName(object.storage_path)} className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                          {object.file_type}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{getObjectName(object.storage_path)}</p>
                        <StatusBadge label={getFileTypeLabel(object.file_type)} tone="info" />
                        <StatusBadge label={formatBytes(object.size_bytes)} tone="neutral" />
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">{object.logical_bucket}</p>
                      <p className="mt-1 break-all text-sm text-slate-500">{object.storage_path}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatObjectDate(object.last_modified)}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-3">
                    {object.preview_url ? (
                      <a
                        href={object.preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-white"
                      >
                        Abrir preview
                      </a>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        void deleteMutation.mutateAsync({
                          logicalBucket: object.logical_bucket,
                          storagePath: object.storage_path,
                          storageProvider: "r2",
                        })
                      }
                    >
                      Apagar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={!cursor}
            onClick={() => setCursor(null)}
          >
            Voltar ao inicio
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={!objectsQuery.data?.next_cursor}
            onClick={() => setCursor(objectsQuery.data?.next_cursor ?? null)}
          >
            Proxima pagina
          </Button>
        </div>
      </section>
    </div>
  )
}
