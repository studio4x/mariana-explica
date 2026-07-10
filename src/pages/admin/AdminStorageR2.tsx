import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  deleteAdminR2Object,
  fetchAdminR2Objects,
  fetchAdminR2UsageOverview,
} from "@/services"

type AdminR2FileType = "all" | "image" | "video" | "audio" | "document" | "archive" | "other"
type AdminR2Tab = "overview" | "files"

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
  return `${value.toFixed(exponent === 0 ? 0 : exponent === 1 ? 0 : 2)} ${units[exponent]}`
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

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(value)
}

function formatGigabytes(value: number) {
  return `${value.toFixed(2)} GB`
}

function formatMillions(value: number) {
  if (value <= 0) return "0 mi"
  return `${(value / 1_000_000).toFixed(value >= 100_000 ? 2 : 3)} mi`
}

function formatCurrencyUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function getObjectName(storagePath: string) {
  return storagePath.split("/").at(-1) ?? storagePath
}

function getFileTypeLabel(fileType: AdminR2FileType) {
  return FILE_TYPE_OPTIONS.find((option) => option.value === fileType)?.label ?? "Outros"
}

function getUpdatedLabel(timestamp: number) {
  if (!timestamp) return "Sem atualizacao ainda"
  return formatObjectDate(new Date(timestamp).toISOString())
}

export function AdminStorageR2() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<AdminR2Tab>("overview")
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
  const overview = overviewQuery.data

  const summary = useMemo(() => {
    const objectCount = overview?.object_count ?? 0
    const totalSizeBytes = overview?.total_size_bytes ?? 0
    const totalSizeGb = totalSizeBytes / 1024 ** 3
    const storageStandardBillableGb = Math.max(0, totalSizeGb - 10)
    const classAStandardRequests = objectCount
    const classAStandardBillable = Math.max(0, classAStandardRequests - 1_000_000)
    const storageStandardCost = storageStandardBillableGb * 0.015
    const classAStandardCost = (classAStandardBillable / 1_000_000) * 4.5
    const subtotal = storageStandardCost + classAStandardCost
    const updatedAt = Math.max(overviewQuery.dataUpdatedAt ?? 0, objectsQuery.dataUpdatedAt ?? 0)

    return {
      buckets: overview?.bucket ? 1 : 0,
      objectCount,
      uploadsAccumulated: objectCount,
      totalSizeBytes,
      totalSizeGb,
      storageStandardBillableGb,
      classAStandardRequests,
      classAStandardBillable,
      storageStandardCost,
      classAStandardCost,
      subtotal,
      bucketName: overview?.bucket ?? "-",
      providerDefault: overview?.provider_default?.toUpperCase() ?? "R2",
      updatedLabel: getUpdatedLabel(updatedAt),
    }
  }, [objectsQuery.dataUpdatedAt, overview, overviewQuery.dataUpdatedAt])

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

  async function refreshPanel() {
    await Promise.all([overviewQuery.refetch(), objectsQuery.refetch()])
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
          void refreshPanel()
        }}
      />
    )
  }

  return (
    <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
      <div className="space-y-6 text-[#163138]">
        <header className="flex flex-col gap-4 rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Cloudflare R2</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#15323B]">Storage R2</h1>
            <p className="mt-2 text-sm text-[#5F7077]">
              Acompanhe consumo, navegue entre arquivos e remova objetos do storage.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-2xl border-[#BEE3EA] bg-white px-4 font-black text-[#15323B] hover:bg-[#F2F7F9]"
            onClick={() => void refreshPanel()}
            disabled={overviewQuery.isFetching || objectsQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </header>

        <section className="rounded-[20px] border border-[#D8E6EB] bg-white p-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                activeTab === "overview" ? "bg-[#15323B] text-white" : "text-[#15323B] hover:bg-[#F2F7F9]"
              }`}
              onClick={() => setActiveTab("overview")}
            >
              Visao geral
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                activeTab === "files" ? "bg-[#15323B] text-white" : "text-[#15323B] hover:bg-[#F2F7F9]"
              }`}
              onClick={() => setActiveTab("files")}
            >
              Arquivos
            </button>
          </div>
        </section>

        {activeTab === "overview" ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Buckets</p>
                <p className="mt-2 text-3xl font-black text-[#15323B]">{formatInteger(summary.buckets)}</p>
              </article>
              <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Armazenamento total</p>
                <p className="mt-2 text-3xl font-black text-[#15323B]">{formatBytes(summary.totalSizeBytes)}</p>
              </article>
              <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Objetos</p>
                <p className="mt-2 text-3xl font-black text-[#15323B]">{formatInteger(summary.objectCount)}</p>
              </article>
              <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Uploads acumulados</p>
                <p className="mt-2 text-3xl font-black text-[#15323B]">{formatInteger(summary.uploadsAccumulated)}</p>
              </article>
            </section>

            <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
              <div className="mb-4 flex flex-col gap-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                  Estimativa de custo mensal (Cloudflare R2)
                </p>
                <p className="text-sm text-[#5F7077]">
                  Precos em USD baseados no uso atual com franquia gratuita mensal aplicada quando disponivel.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Subtotal estimado</p>
                  <p className="mt-2 text-2xl font-black text-[#15323B]">{formatCurrencyUsd(summary.subtotal)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5F7077]">Inclui Storage e Class A Standard.</p>
                </article>
                <article className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                    Storage Standard faturavel
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#15323B]">{formatGigabytes(summary.storageStandardBillableGb)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5F7077]">Uso atual: {formatGigabytes(summary.totalSizeGb)}</p>
                </article>
                <article className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                    Class A Standard faturavel
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#15323B]">{formatMillions(summary.classAStandardBillable)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                    Requisicoes atuais: {formatInteger(summary.classAStandardRequests)}
                  </p>
                </article>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Preco</th>
                      <th className="px-3 py-2">Franquia gratis</th>
                      <th className="px-3 py-2">Uso atual</th>
                      <th className="px-3 py-2">Estimativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">Storage Standard</td>
                      <td className="px-3 py-3">$0.015 / GB-mes</td>
                      <td className="px-3 py-3">10 GB-mes</td>
                      <td className="px-3 py-3">{formatGigabytes(summary.totalSizeGb)}</td>
                      <td className="rounded-r-2xl px-3 py-3">{formatCurrencyUsd(summary.storageStandardCost)}</td>
                    </tr>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">Class A Standard</td>
                      <td className="px-3 py-3">$4.50 / milhao</td>
                      <td className="px-3 py-3">1 milhao</td>
                      <td className="px-3 py-3">{formatInteger(summary.classAStandardRequests)}</td>
                      <td className="rounded-r-2xl px-3 py-3">{formatCurrencyUsd(summary.classAStandardCost)}</td>
                    </tr>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">Class B Standard</td>
                      <td className="px-3 py-3">$0.36 / milhao</td>
                      <td className="px-3 py-3">10 milhoes</td>
                      <td className="px-3 py-3">Nao disponivel no endpoint</td>
                      <td className="rounded-r-2xl px-3 py-3">Nao calculado</td>
                    </tr>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">Storage IA</td>
                      <td className="px-3 py-3">$0.01 / GB-mes</td>
                      <td className="px-3 py-3">Sem franquia</td>
                      <td className="px-3 py-3">0.00 GB</td>
                      <td className="rounded-r-2xl px-3 py-3">$0.00</td>
                    </tr>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">Class A IA</td>
                      <td className="px-3 py-3">$9.00 / milhao</td>
                      <td className="px-3 py-3">Sem franquia</td>
                      <td className="px-3 py-3">0</td>
                      <td className="rounded-r-2xl px-3 py-3">$0.00</td>
                    </tr>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">Class B IA / Retrieval IA</td>
                      <td className="px-3 py-3">$0.90 / milhao + $0.01 / GB</td>
                      <td className="px-3 py-3">Sem franquia</td>
                      <td className="px-3 py-3">Nao disponivel no endpoint</td>
                      <td className="rounded-r-2xl px-3 py-3">Nao calculado</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs font-semibold text-[#5F7077]">
                A Cloudflare arredonda para cima por unidade de cobranca. Este painel e uma estimativa de acompanhamento e nao substitui a fatura oficial.
              </p>
            </section>

            <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
              <div className="mb-4 flex flex-col gap-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Detalhamento por bucket</p>
                <p className="text-sm text-[#5F7077]">Ultima atualizacao: {summary.updatedLabel}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                      <th className="px-3 py-2">Bucket</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Objetos</th>
                      <th className="px-3 py-2">Uploads</th>
                      <th className="px-3 py-2">Regiao</th>
                      <th className="px-3 py-2">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">
                        <div>
                          <p className="font-black text-[#15323B]">{summary.bucketName}</p>
                          <p className="text-xs font-semibold text-[#5F7077]">{summary.providerDefault}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">{formatBytes(summary.totalSizeBytes)}</td>
                      <td className="px-3 py-3">{formatInteger(summary.objectCount)}</td>
                      <td className="px-3 py-3">{formatInteger(summary.uploadsAccumulated)}</td>
                      <td className="px-3 py-3">auto</td>
                      <td className="rounded-r-2xl px-3 py-3">{summary.updatedLabel}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Bucket com maior consumo</p>
              <p className="mt-2 text-xl font-black text-[#15323B]">{summary.bucketName}</p>
              <p className="mt-1 text-sm text-[#5F7077]">
                {formatBytes(summary.totalSizeBytes)} em {formatInteger(summary.objectCount)} objetos.
              </p>
            </section>
          </>
        ) : (
          <section className="space-y-5 rounded-[24px] border border-[#D8E6EB] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Arquivos do bucket</p>
                <p className="mt-1 text-sm text-[#5F7077]">
                  Prefixos logicos como `course-assets-private/` e `site-pages-public/` vivem dentro do mesmo bucket fisico.
                </p>
              </div>
              <StatusBadge label={`${objects.length} itens nesta pagina`} tone="info" />
            </div>

            <div className="rounded-[20px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_220px_auto]">
                <input
                  value={prefixDraft}
                  onChange={(event) => setPrefixDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters()
                  }}
                  placeholder="Prefixo, ex.: site-pages-public/pages/home/"
                  className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm text-[#163138] outline-none focus:border-[#1398B7]"
                />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters()
                  }}
                  placeholder="Pesquisar por nome ou caminho"
                  className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm text-[#163138] outline-none focus:border-[#1398B7]"
                />
                <select
                  value={fileTypeDraft}
                  onChange={(event) => setFileTypeDraft(event.target.value as AdminR2FileType)}
                  className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm text-[#163138] outline-none focus:border-[#1398B7]"
                >
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={applyFilters}>
                    Aplicar
                  </Button>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={resetFilters}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#5F7077]">
                {filters.prefix ? <StatusBadge label={`Prefixo: ${filters.prefix}`} tone="neutral" /> : null}
                {filters.search ? <StatusBadge label={`Pesquisa: ${filters.search}`} tone="neutral" /> : null}
                {filters.fileType !== "all" ? <StatusBadge label={`Tipo: ${getFileTypeLabel(filters.fileType)}`} tone="neutral" /> : null}
                {!hasActiveFilters ? <span>Sem filtros ativos.</span> : null}
              </div>
            </div>

            {objectsQuery.isLoading ? (
              <LoadingState message="A carregar objectos..." />
            ) : objects.length === 0 ? (
              <EmptyState title="Sem objetos" message="Nao ha objetos para os filtros atuais." />
            ) : (
              <div className="space-y-3">
                {objects.map((object) => (
                  <div key={object.key} className="rounded-[20px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[#D8E6EB] bg-white">
                          {object.preview_url ? (
                            <a href={object.preview_url} target="_blank" rel="noreferrer" className="block h-full w-full">
                              <img
                                src={object.preview_url}
                                alt={getObjectName(object.storage_path)}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-xs font-black uppercase tracking-[0.22em] text-[#8AA2A9]">
                              {object.file_type}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#15323B]">{getObjectName(object.storage_path)}</p>
                            <StatusBadge label={getFileTypeLabel(object.file_type)} tone="info" />
                            <StatusBadge label={formatBytes(object.size_bytes)} tone="neutral" />
                          </div>
                          <p className="mt-2 text-sm font-medium text-[#163138]">{object.logical_bucket}</p>
                          <p className="mt-1 break-all text-sm text-[#5F7077]">{object.storage_path}</p>
                          <p className="mt-2 text-xs text-[#5F7077]">{formatObjectDate(object.last_modified)}</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-3">
                        {object.preview_url ? (
                          <a
                            href={object.preview_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323B] hover:bg-[#F2F7F9]"
                          >
                            Abrir preview
                          </a>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
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

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                disabled={!cursor}
                onClick={() => setCursor(null)}
              >
                Voltar ao inicio
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                disabled={!objectsQuery.data?.next_cursor}
                onClick={() => setCursor(objectsQuery.data?.next_cursor ?? null)}
              >
                Proxima pagina
              </Button>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
