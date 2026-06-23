import { useEffect, useState, type FormEvent } from "react"
import { Bot, Loader2, Send, X } from "lucide-react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useAdminAiCodeEditorConfig, useCreateAdminAiCodeEditorTask } from "@/hooks/useAdmin"
import { Button } from "@/components/ui"

export function SiteAiCodeEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { pathname } = useLocation()
  const configQuery = useAdminAiCodeEditorConfig(isAdmin && !authLoading)
  const createTaskMutation = useCreateAdminAiCodeEditorTask()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  const enabled = configQuery.data?.config_value.enabled === true
  const canRender = Boolean(isAdmin && !authLoading && enabled && !pathname.startsWith("/admin"))

  useEffect(() => {
    if (!canRender) {
      setOpen(false)
    }
  }, [canRender])

  if (!canRender) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || createTaskMutation.isPending) return

    setFeedback(null)
    try {
      await createTaskMutation.mutateAsync({ prompt: trimmedPrompt })
      setPrompt("")
      setFeedback("Pedido enviado para o editor irrestrito.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel enviar o pedido.")
    }
  }

  return (
    <div data-ai-code-editor-root className="fixed bottom-5 right-5 z-[80] pointer-events-none">
      {open ? (
        <div className="pointer-events-auto w-[min(92vw,460px)] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-200">Chat irrestrito</p>
              <p className="mt-1 text-sm leading-6 text-slate-200">Escreve o pedido e envia para o editor irrestrito.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form className="space-y-4 p-4" onSubmit={(event) => void handleSubmit(event)}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Mensagem</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-2 min-h-[180px] w-full resize-none rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                placeholder='Ex.: altera a cor do texto "Notas importantes..." para branco'
              />
            </label>

            {feedback ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{feedback}</p> : null}

            <Button type="submit" className="h-11 w-full rounded-full" disabled={!prompt.trim() || createTaskMutation.isPending}>
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A enviar...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar pedido
                </>
              )}
            </Button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto inline-flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-slate-950 px-5 text-sm font-bold text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5"
        >
          <Bot className="h-5 w-5" />
          Abrir chat irrestrito
        </button>
      )}
    </div>
  )
}
