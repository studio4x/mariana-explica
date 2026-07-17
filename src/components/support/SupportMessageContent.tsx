import { BookOpen, ChevronDown, Hash } from "lucide-react"

interface CourseContextMessage {
  productTitle: string
  productId: string
  currentContentTitle?: string
  currentContentType?: string
  studentMessage: string
}

interface SupportMessageContentProps {
  message: string
  isMine: boolean
  messageLabel?: string
}

function getValue(lines: string[], prefix: string) {
  return lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? ""
}

export function parseCourseContextMessage(message: string): CourseContextMessage | null {
  const header = "[Contexto do curso/material]"
  const messageMarker = "\n\nMensagem do aluno:\n"
  if (!message.startsWith(header)) return null

  const markerIndex = message.indexOf(messageMarker)
  if (markerIndex < 0) return null

  const metadata = message.slice(header.length, markerIndex).trim().split("\n")
  const studentMessage = message.slice(markerIndex + messageMarker.length).trim()
  const productTitle = getValue(metadata, "Curso/material:")
  const productId = getValue(metadata, "ID do curso/material:")
  if (!productTitle || !productId) return null

  const contentLine = metadata.find((line) => line.startsWith("Conte") && line.includes(": "))
  const typeLine = metadata.find((line) => line.startsWith("Tipo") && line.includes(": "))

  return {
    productTitle,
    productId,
    currentContentTitle: contentLine?.slice(contentLine.indexOf(": ") + 2).trim(),
    currentContentType: typeLine?.slice(typeLine.indexOf(": ") + 2).trim(),
    studentMessage,
  }
}

export function SupportMessageContent({ message, isMine, messageLabel }: SupportMessageContentProps) {
  const context = parseCourseContextMessage(message)
  if (!context) return <p className="whitespace-pre-wrap text-sm leading-6">{message}</p>

  const surfaceClass = isMine
    ? "border-white/10 bg-white/[0.07] text-white"
    : "border-sky-100 bg-sky-50/70 text-slate-800"
  const mutedClass = isMine ? "text-slate-300" : "text-slate-500"
  const detailClass = isMine
    ? "border-white/10 text-slate-300 marker:text-slate-400"
    : "border-slate-200 text-slate-500 marker:text-slate-400"

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border p-3 ${surfaceClass}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isMine ? "bg-sky-400/20 text-sky-200" : "bg-white text-sky-700 shadow-sm"}`}>
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${isMine ? "text-sky-200" : "text-sky-700"}`}>Contexto da conversa</p>
            <p className="mt-1 text-sm font-black leading-5">Sobre este material</p>
          </div>
        </div>
        <div className={`mt-3 border-t pt-3 ${isMine ? "border-white/10" : "border-sky-100"}`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.12em] ${mutedClass}`}>Curso/material</p>
          <p className="mt-1 text-sm font-bold leading-5">{context.productTitle}</p>
          {context.currentContentTitle ? (
            <p className={`mt-2 text-xs leading-5 ${mutedClass}`}>
              <span className="font-bold">A ver agora:</span> {context.currentContentTitle}
            </p>
          ) : null}
          {context.currentContentType ? <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{context.currentContentType}</p> : null}
        </div>
        <details className={`mt-3 border-t pt-2 text-xs ${detailClass}`}>
          <summary className="group flex cursor-pointer list-none items-center gap-1 font-bold [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Ver referência técnica
          </summary>
          <p className="mt-2 flex items-start gap-1.5 break-all font-mono text-[10px] leading-4">
            <Hash className="mt-0.5 h-3 w-3 shrink-0" />
            {context.productId}
          </p>
        </details>
      </div>
      <div className={`border-t pt-3 ${isMine ? "border-white/10" : "border-slate-200"}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${mutedClass}`}>{messageLabel ?? (isMine ? "A tua mensagem" : "Mensagem")}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{context.studentMessage}</p>
      </div>
    </div>
  )
}
