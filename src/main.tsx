/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider } from "@/contexts/AuthContext"
import { BUILD_VERSION } from "@/lib/build"
import { clearBrowserRuntimeCaches } from "@/lib/runtime-recovery"
import App from "./App"
import "./styles/globals.css"

const APP_RUNTIME_VERSION = BUILD_VERSION

async function clearStalePwaState() {
  if (!("serviceWorker" in navigator) && typeof caches === "undefined") {
    return
  }

  const previousVersion = window.localStorage.getItem("mariana-explica:runtime-version")
  if (previousVersion === APP_RUNTIME_VERSION) {
    return
  }

  await clearBrowserRuntimeCaches()

  window.localStorage.setItem("mariana-explica:runtime-version", APP_RUNTIME_VERSION)
}

async function bootstrapApp() {
  await clearStalePwaState()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  )

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(APP_RUNTIME_VERSION)}`
      void navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
        console.warn("[PWA] Falha ao registrar service worker:", error)
      })
    })
  }
}

void bootstrapApp()
