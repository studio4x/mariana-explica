import { useState } from "react"
import { Download, FileCheck2, FileUp, Loader2 } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { MediaLibraryModal, StatusBadge } from "@/components/common"
import {
  useAdminFreeProductDownloadFile,
  useAdminFreeProductDownloadTest,
  useSaveAdminFreeProductDownloadFile,
  useUploadAdminFreeProductDownloadFile,
} from "@/hooks/useAdmin"
import type { AdminR2ListedObject } from "@/services/admin.service"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"

const PRIVATE_LIBRARY_PREFIX = "course-assets-private/"
const FREE_DOWNLOAD_ACCEPT = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "image/png",
  "image/jpeg",
].join(",")

const LIBRARY_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
}

function getLibraryObjectName(object: AdminR2ListedObject) {
  return object.storage_path.split("/").filter(Boolean).pop() || object.key
}

function getLibraryObjectMimeType(object: AdminR2ListedObject) {
  const extension = getLibraryObjectName(object).split(".").pop()?.toLowerCase() ?? ""
  return LIBRARY_MIME_BY_EXTENSION[extension] ?? null
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Tamanho não informado"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function FreeProductDownloadPanel() {
  const { product } = useAdminCourseBuilderContext()
  const fileQuery = useAdminFreeProductDownloadFile(product.id)
  const uploadFile = useUploadAdminFreeProductDownloadFile()
  const saveFile = useSaveAdminFreeProductDownloadFile()
  const testDownload = useAdminFreeProductDownloadTest()
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  const isSaving = uploadFile.isPending || saveFile.isPending

  const handleSelectFile = async (file: File | null | undefined) => {
    if (!file || isSaving) return

    setFeedback(null)
    try {
      const uploaded = await uploadFile.mutateAsync({
        productId: product.id,
        file,
        replacePath: fileQuery.data?.storage_path ?? null,
      })
      await saveFile.mutateAsync({
        productId: product.id,
        storageProvider: uploaded.storage_provider ?? "r2",
        storageBucket: uploaded.bucket,
        storagePath: uploaded.path,
        fileName: uploaded.file_name,
        mimeType: uploaded.mime_type,
        fileSizeBytes: uploaded.file_size_bytes,
      })
      setFeedback({
        tone: "success",
        message: "Ficheiro principal atualizado. Os links de download anteriores foram revogados por segurança.",
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar o ficheiro.",
      })
      throw error
    }
  }

  const handleLibrarySelect = async (object: AdminR2ListedObject) => {
    const mimeType = getLibraryObjectMimeType(object)
    if (object.logical_bucket !== "course-assets-private" || !mimeType) {
      throw new Error("Seleciona um PDF, vídeo ou imagem da biblioteca privada.")
    }

    setFeedback(null)
    try {
      await saveFile.mutateAsync({
        productId: product.id,
        storageProvider: "r2",
        storageBucket: object.logical_bucket,
        storagePath: object.storage_path,
        fileName: getLibraryObjectName(object),
        mimeType,
        fileSizeBytes: object.size_bytes,
      })
      setFeedback({
        tone: "success",
        message: "Ficheiro da biblioteca associado ao material. Os links anteriores foram revogados por segurança.",
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível usar este ficheiro da biblioteca.",
      })
      throw error
    }
  }

  const handleTestDownload = async () => {
    setFeedback(null)
    try {
      const response = await testDownload.mutateAsync(product.id)
      window.open(response.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível gerar o download de teste.",
      })
    }
  }

  if (fileQuery.isLoading) return <LoadingState message="A carregar o ficheiro do material..." />
  if (fileQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o ficheiro"
        message={fileQuery.error instanceof Error ? fileQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void fileQuery.refetch()}
      />
    )
  }

  const file = fileQuery.data

  return (
    <div className="w-full space-y-8 pb-12">
      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Ficheiro para download</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          Este material gratuito é entregue por e-mail. Configure aqui o único ficheiro privado que será disponibilizado por link seguro.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Ficheiro principal</h3>
            <p className="mt-1 text-sm text-slate-500">PDF, vídeo ou imagem em armazenamento privado.</p>
          </div>
          <Button
            type="button"
            className="rounded-xl bg-[linear-gradient(180deg,#1788a8_0%,#12596f_100%)] text-white"
            onClick={() => setIsMediaLibraryOpen(true)}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            {isSaving ? "A guardar..." : file ? "Substituir ou escolher" : "Enviar ou usar biblioteca"}
          </Button>
        </div>

        <div className="p-6">
          {file ? (
            <div className="flex flex-col gap-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-slate-900">{file.file_name}</p>
                    <StatusBadge label="Ativo" tone="success" />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {file.mime_type || "Tipo não informado"} · {formatFileSize(file.file_size_bytes)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                onClick={() => void handleTestDownload()}
                disabled={testDownload.isPending}
              >
                {testDownload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Testar download
              </Button>
            </div>
          ) : (
            <EmptyState
              title="Nenhum ficheiro configurado"
              message="Envie o ficheiro principal antes de publicar este material gratuito."
            />
          )}

          {feedback ? (
            <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              {feedback.message}
            </p>
          ) : null}
        </div>
      </section>

      <MediaLibraryModal
        open={isMediaLibraryOpen}
        title="Configurar ficheiro principal"
        uploadTabLabel="Fazer novo upload"
        libraryTabLabel="Usar biblioteca"
        accept={FREE_DOWNLOAD_ACCEPT}
        fileType="all"
        prefix={PRIVATE_LIBRARY_PREFIX}
        onClose={() => setIsMediaLibraryOpen(false)}
        onUpload={handleSelectFile}
        onSelect={handleLibrarySelect}
      />
    </div>
  )
}
