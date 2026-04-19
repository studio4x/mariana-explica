import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.matchMedia?.("(display-mode: fullscreen)")?.matches ||
      (window.navigator as NavigatorWithStandalone).standalone === true
    const isDashboard = window.location.pathname.startsWith("/aluno")
    const dismissedUntil = Number(window.localStorage.getItem("mariana-explica:pwa-install-dismissed-until") ?? "0")

    setIsDismissed(isStandalone || !isDashboard || dismissedUntil > Date.now())
  }, [])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (!isDismissed) {
        setPromptEvent(event as BeforeInstallPromptEvent)
      }
    }

    const onInstalled = () => {
      setPromptEvent(null)
      setIsDismissed(true)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [isDismissed])

  function dismissPrompt() {
    const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000
    window.localStorage.setItem("mariana-explica:pwa-install-dismissed-until", String(dismissedUntil))
    setPromptEvent(null)
    setIsDismissed(true)
  }

  if (!promptEvent || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <button
        type="button"
        onClick={dismissPrompt}
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="Fechar sugestao de instalacao"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">App de estudo</p>
      <h2 className="mt-2 text-base font-semibold text-slate-950">Instalar Mariana Explica</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Adiciona o app ao telemovel para regressar mais depressa ao dashboard e aos teus cursos.
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() =>
            void promptEvent.prompt().finally(() => {
              void promptEvent.userChoice.finally(() => {
                setPromptEvent(null)
                setIsDismissed(true)
              })
            })
          }
          className="flex-1"
        >
          <Download className="mr-2 h-4 w-4" />
          Instalar app
        </Button>
        <Button type="button" variant="outline" onClick={dismissPrompt}>
          Agora nao
        </Button>
      </div>
    </div>
  )
}
