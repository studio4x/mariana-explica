import { useEffect, useState } from "react"
import { Bot, ExternalLink, X } from "lucide-react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useAdminAiCodeEditorConfig } from "@/hooks/useAdmin"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"

export function SiteAiCodeEditorLauncher() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { pathname } = useLocation()
  const configQuery = useAdminAiCodeEditorConfig(isAdmin && !authLoading)
  const [open, setOpen] = useState(false)

  const enabled = configQuery.data?.config_value.enabled === true
  const canRender = Boolean(isAdmin && !authLoading && enabled && !pathname.startsWith("/admin"))

  useEffect(() => {
    if (!canRender) {
      setOpen(false)
    }
  }, [canRender])

  if (!canRender) return null

  const iframeSrc = ROUTES.ADMIN_AI_CODE_EDITOR_CHAT

  return (
    <div data-ai-code-editor-root className="fixed bottom-5 right-5 z-[80] pointer-events-none">
      {open ? (
        <div className="pointer-events-auto w-[min(96vw,920px)] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-200">Chat irrestrito</p>
              <p className="mt-1 text-sm leading-6 text-slate-200">
                Mesmo chat do admin, carregado no frontend para manter o mesmo acesso e o mesmo backend.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="h-10 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                <a href={iframeSrc} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir inteiro
                </a>
              </Button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
                aria-label="Fechar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-slate-100">
            <iframe
              title="Editor IA irrestrito"
              src={iframeSrc}
              className="h-[min(76vh,820px)] w-full border-0 bg-white"
            />
          </div>
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
