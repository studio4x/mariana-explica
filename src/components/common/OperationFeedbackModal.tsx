import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui"

export type OperationFeedbackTone = "success" | "error" | "info"

interface OperationFeedbackModalProps {
  open: boolean
  tone: OperationFeedbackTone
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  children?: ReactNode
  isConfirming?: boolean
  onClose: () => void
  onConfirm?: () => void
}

export function OperationFeedbackModal({
  open,
  tone,
  title,
  message,
  confirmLabel = "Continuar",
  cancelLabel = "Cancelar",
  children,
  isConfirming = false,
  onClose,
  onConfirm,
}: OperationFeedbackModalProps) {
  if (!open) return null

  const isSuccess = tone === "success"
  const isError = tone === "error"
  const resolvedTitle = title ?? (isSuccess ? "Alterações guardadas" : "Não foi possível guardar")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_32px_80px_rgba(15,23,42,0.26)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={[
                "inline-flex h-12 w-12 items-center justify-center rounded-2xl",
                isSuccess
                  ? "bg-emerald-100 text-emerald-700"
                  : isError
                    ? "bg-rose-100 text-rose-700"
                    : "bg-sky-100 text-sky-700",
              ].join(" ")}
            >
              {isSuccess ? <CheckCircle2 className="h-6 w-6" /> : isError ? <AlertCircle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold text-[#15323b]">{resolvedTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5F7077]">{message}</p>
              {children ? <div className="mt-3">{children}</div> : null}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#5F7077] transition hover:bg-[#F2F7F9] hover:text-[#15323b]"
            onClick={onClose}
            disabled={isConfirming}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {onConfirm ? (
            <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose} disabled={isConfirming}>
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            className={[
              "rounded-2xl font-black",
              isError ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1398B7] hover:bg-[#0A3640]",
            ].join(" ")}
            onClick={onConfirm ?? onClose}
            disabled={isConfirming}
          >
            {isConfirming ? "A submeter..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
