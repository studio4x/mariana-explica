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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : exponent === 1 ? 0 : 1)} ${units[exponent]}`
}

export function AdminStorageR2() {
  const queryClient = useQueryClient()
  const [prefix, setPrefix] = useState("")
  const [cursor, setCursor] = useState<string | null>(null)

  const overviewQuery = useQuery({
    queryKey: ["admin", "r2", "overview", prefix],
    queryFn: () => fetchAdminR2UsageOverview(prefix || null),
  })

  const objectsQuery = useQuery({
    queryKey: ["admin", "r2", "objects", prefix, cursor],
    queryFn: () => fetchAdminR2Objects({ prefix: prefix || null, cursor, limit: 100 }),
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

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            placeholder="Filtrar por prefixo, ex.: course-assets-private/modules/"
            className="h-11 min-w-[280px] flex-1 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              setCursor(null)
              void overviewQuery.refetch()
              void objectsQuery.refetch()
            }}
          >
            Aplicar filtro
          </Button>
        </div>

        {objectsQuery.isLoading ? (
          <div className="mt-6">
            <LoadingState message="A carregar objectos..." />
          </div>
        ) : objects.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Sem objetos" message="Nao ha objetos para o filtro atual." />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {objects.map((object) => (
              <div key={object.key} className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{object.logical_bucket}</p>
                      <StatusBadge label={formatBytes(object.size_bytes)} tone="neutral" />
                    </div>
                    <p className="mt-2 break-all text-sm text-slate-600">{object.storage_path}</p>
                    <p className="mt-1 text-xs text-slate-500">{object.last_modified ?? "Sem data"}</p>
                  </div>
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
