import { createPortal } from "react-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { FileText, Image as ImageIcon, Loader2, RefreshCw, Search, UploadCloud, Video, X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchAdminR2Objects, type AdminR2ListedObject } from "@/services/admin.service"
import { cn } from "@/lib/cn"

export type MediaLibraryFileType = "all" | "image" | "video" | "audio" | "document" | "archive" | "other"

interface MediaLibraryModalProps {
  open: boolean
  title?: string
  uploadTabLabel?: string
  libraryTabLabel?: string
  accept?: string
  fileType?: MediaLibraryFileType
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  onSelect: (object: AdminR2ListedObject) => Promise<void>
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

function objectLabel(object: AdminR2ListedObject) {
  return object.storage_path.split("/").filter(Boolean).pop() || object.key
}

function ObjectIcon({ fileType }: { fileType: AdminR2ListedObject["file_type"] }) {
  if (fileType === "image") return <ImageIcon className="h-7 w-7" />
  if (fileType === "video") return <Video className="h-7 w-7" />
  return <FileText className="h-7 w-7" />
}

export function MediaLibraryModal({
  open,
  title = "Biblioteca de mídia",
  uploadTabLabel = "Enviar ficheiro",
  libraryTabLabel = "Biblioteca de mídia",
  accept,
  fileType = "all",
  onClose,
  onUpload,
  onSelect,
}: MediaLibraryModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<"upload" | "library">("upload")
  const [search, setSearch] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [objects, setObjects] = useState<AdminR2ListedObject[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const objectsQuery = useQuery({
    queryKey: ["admin", "r2", "media-library", fileType, search, cursor],
    queryFn: () => fetchAdminR2Objects({ fileType, search: search.trim() || null, cursor, limit: 60 }),
    enabled: open && activeTab === "library",
  })

  useEffect(() => {
    if (!open) return
    setActiveTab("upload")
    setSelectedFile(null)
    setCursor(null)
    setObjects([])
    setActionError(null)
  }, [open, fileType])

  useEffect(() => {
    if (!objectsQuery.data) return
    setObjects((previous) => (cursor ? [...previous, ...objectsQuery.data.objects] : objectsQuery.data.objects))
  }, [cursor, objectsQuery.data])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSubmitting, onClose, open])

  const canSubmitUpload = useMemo(() => Boolean(selectedFile) && !isSubmitting, [isSubmitting, selectedFile])

  if (!open || typeof document === "undefined") return null

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsSubmitting(true)
    setActionError(null)
    try {
      await onUpload(selectedFile)
      onClose()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível enviar o ficheiro.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelect = async (object: AdminR2ListedObject) => {
    setIsSubmitting(true)
    setActionError(null)
    try {
      await onSelect(object)
      onClose()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível selecionar este ficheiro.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && !isSubmitting && onClose()}>
      <section className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="media-library-title">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 md:px-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">Construtor do curso</p>
            <h2 id="media-library-title" className="mt-1 text-xl font-extrabold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Envia um novo ficheiro ou reutiliza uma mídia já guardada no R2.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" aria-label="Fechar biblioteca de mídia">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex border-b border-slate-200 px-5 md:px-7">
          {(["upload", "library"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => { setActiveTab(tab); setActionError(null) }} className={cn("border-b-2 px-1 py-4 text-sm font-bold transition", activeTab === tab ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-900")}>
              {tab === "upload" ? uploadTabLabel : libraryTabLabel}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
          {activeTab === "upload" ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-sky-300 bg-sky-50/60 p-8 text-center">
              <UploadCloud className="h-10 w-10 text-sky-600" />
              <h3 className="mt-4 text-lg font-extrabold text-slate-950">Escolhe um ficheiro do computador</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">O upload será feito diretamente para o storage protegido e guardado no item atual após a conclusão.</p>
              <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-6 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700">Selecionar ficheiro</button>
              {selectedFile ? <p className="mt-4 text-sm font-semibold text-slate-700">{selectedFile.name} · {formatBytes(selectedFile.size)}</p> : null}
              <button type="button" onClick={() => void handleUpload()} disabled={!canSubmitUpload} className="mt-5 rounded-full border border-sky-200 px-5 py-2.5 text-sm font-bold text-sky-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null} Enviar e usar ficheiro
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => { setSearch(event.target.value); setCursor(null); setObjects([]) }} placeholder="Pesquisar por nome ou caminho..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-sky-200 transition focus:ring-2" />
                </label>
                <button type="button" onClick={() => { setCursor(null); setObjects([]); void objectsQuery.refetch() }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" title="Atualizar biblioteca">
                  <RefreshCw className="h-4 w-4" /> Atualizar
                </button>
              </div>
              {objectsQuery.isLoading && objects.length === 0 ? <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> A carregar a biblioteca...</div> : null}
              {objectsQuery.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Não foi possível carregar a biblioteca. {objectsQuery.error instanceof Error ? objectsQuery.error.message : "Tenta novamente."}</div> : null}
              {!objectsQuery.isLoading && !objectsQuery.isError && objects.length === 0 ? <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><FileText className="h-9 w-9 text-slate-400" /><p className="mt-3 font-bold text-slate-700">Nenhum ficheiro encontrado</p><p className="mt-1 text-sm text-slate-500">Experimenta outra pesquisa ou envia um novo ficheiro.</p></div> : null}
              {objects.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{objects.map((object) => <button key={`${object.logical_bucket}:${object.storage_path}`} type="button" disabled={isSubmitting} onClick={() => void handleSelect(object)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md disabled:opacity-60">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100 text-slate-400">{object.file_type === "image" && object.preview_url ? <img src={object.preview_url} alt={objectLabel(object)} className="h-full w-full object-cover" /> : <ObjectIcon fileType={object.file_type} />}</div>
                <div className="space-y-1 p-3"><p className="truncate text-sm font-bold text-slate-800" title={objectLabel(object)}>{objectLabel(object)}</p><p className="text-xs text-slate-500">{object.file_type} · {formatBytes(object.size_bytes)}</p></div>
              </button>)}</div> : null}
              {objectsQuery.data?.has_more ? <button type="button" disabled={objectsQuery.isFetching || isSubmitting} onClick={() => setCursor(objectsQuery.data?.next_cursor ?? null)} className="mx-auto flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{objectsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Carregar mais</button> : null}
            </div>
          )}
          {actionError ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p> : null}
        </div>
      </section>
    </div>
  )

  return createPortal(content, document.body)
}
