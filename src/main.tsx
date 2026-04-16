import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider } from "@/contexts/AuthContext"
import App from "./App"
import "./styles/globals.css"

const APP_RUNTIME_VERSION = "2026-04-16.2"

async function clearStalePwaState() {
  if (!("serviceWorker" in navigator) && typeof caches === "undefined") {
    return
  }

  const previousVersion = window.localStorage.getItem("mariana-explica:runtime-version")
  if (previousVersion === APP_RUNTIME_VERSION) {
    return
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // Best-effort cleanup. If this fails, the app still needs to load.
  }

  try {
    if (typeof caches !== "undefined") {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    }
  } catch {
    // Best-effort cleanup.
  }

  window.localStorage.setItem("mariana-explica:runtime-version", APP_RUNTIME_VERSION)
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[PWA] Falha ao registrar service worker:", error)
    })
  })
}

void clearStalePwaState()
