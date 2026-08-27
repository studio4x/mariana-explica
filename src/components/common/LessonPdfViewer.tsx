import { ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react"
import { useLessonFileAccess } from "@/hooks/useDashboard"
import { Button } from "@/components/ui"

interface LessonPdfViewerProps {
  lessonId: string
  lessonType: "video" | "text" | "hybrid" | "file"
  storagePath: string | null
  fileName: string | null
}

function pdfViewerUrl(url: string) {
  return `${url.split("#", 1)[0]}#toolbar=1&navpanes=0&view=FitH`
}

export function LessonPdfViewer({
  lessonId,
  lessonType,
  storagePath,
  fileName,
}: LessonPdfViewerProps) {
  const shouldEmbedPdf = lessonType === "file" && Boolean(storagePath)
  const accessQuery = useLessonFileAccess(shouldEmbedPdf ? lessonId : undefined)

  if (!shouldEmbedPdf) return null

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">Visualizador do PDF</p>
            <p className="mt-1 truncate text-sm text-slate-600">
              {fileName ?? "Ficheiro principal da aula"}
            </p>
          </div>
        </div>

        {accessQuery.data?.url ? (
          <Button asChild type="button" variant="outline" className="h-10 shrink-0 rounded-full px-4 font-bold">
            <a href={accessQuery.data.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Abrir em nova janela
            </a>
          </Button>
        ) : null}
      </div>

      {accessQuery.isLoading ? (
        <div className="flex h-[68vh] min-h-[30rem] items-center justify-center bg-slate-100 px-6 text-center text-sm font-semibold text-slate-600 md:h-[78vh] md:min-h-[44rem]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-600" aria-hidden="true" />
          A preparar o visualizador protegido...
        </div>
      ) : accessQuery.isError ? (
        <div className="flex h-72 flex-col items-center justify-center bg-rose-50 px-6 text-center">
          <p className="font-semibold text-rose-900">Não foi possível abrir o PDF nesta aula.</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-rose-700">
            {accessQuery.error instanceof Error
              ? accessQuery.error.message
              : "Tenta novamente dentro de instantes."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 rounded-full border-rose-200 bg-white font-bold text-rose-800 hover:bg-rose-100"
            onClick={() => void accessQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : accessQuery.data?.url ? (
        <iframe
          src={pdfViewerUrl(accessQuery.data.url)}
          title={`Visualizador do PDF — ${fileName ?? "ficheiro principal da aula"}`}
          className="block h-[68vh] min-h-[30rem] w-full bg-slate-100 md:h-[78vh] md:min-h-[44rem]"
          referrerPolicy="no-referrer"
        />
      ) : null}
    </section>
  )
}
