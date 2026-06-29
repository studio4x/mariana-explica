import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { clearBrowserRuntimeCaches } from "@/lib/runtime-recovery"
import {
  CACHE_CONTROL_EVENT,
  broadcastCacheControlFeedback,
  clearCacheControlFeedback,
  getCacheControlStorageKey,
  readCacheControlPayload,
} from "./site-cache-control"

function clearManagedSessionStorage() {
  if (typeof sessionStorage === "undefined") {
    return
  }

  const keys = Object.keys(sessionStorage)
  keys.forEach((key) => {
    if (key.startsWith("mariana-explica:")) {
      sessionStorage.removeItem(key)
    }
  })
}

export function SiteCacheControlManager() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handlePayload = async (rawValue: string | null | undefined) => {
      const payload = readCacheControlPayload(rawValue)
      if (!payload) {
        return
      }

      try {
        if (payload.action === "server") {
          await Promise.all([
            queryClient.invalidateQueries({ predicate: () => true }),
            queryClient.refetchQueries({ type: "active" }),
          ])
          broadcastCacheControlFeedback({
            tone: "success",
            message: "Cache servidor atualizado com sucesso.",
          })
          return
        }

        if (payload.action === "full") {
          queryClient.clear()
          clearManagedSessionStorage()
        }

        broadcastCacheControlFeedback(
          {
            tone: "success",
            message:
              payload.action === "browser"
                ? "Cache do navegador limpo com sucesso. O login foi preservado."
                : "Cache completo limpo com sucesso. A aplicação será recarregada.",
          },
          { persist: true },
        )
        await clearBrowserRuntimeCaches()
        window.location.reload()
      } catch (error) {
        clearCacheControlFeedback()
        broadcastCacheControlFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "Não foi possível limpar o cache.",
        })
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getCacheControlStorageKey()) {
        return
      }

      void handlePayload(event.newValue)
    }

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>
      void handlePayload(typeof customEvent.detail === "string" ? customEvent.detail : JSON.stringify(customEvent.detail))
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(CACHE_CONTROL_EVENT, handleCustomEvent)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(CACHE_CONTROL_EVENT, handleCustomEvent)
    }
  }, [queryClient])

  return null
}
