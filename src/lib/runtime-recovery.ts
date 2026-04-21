const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  "dynamically imported module",
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "loading chunk",
  "chunkloaderror",
]

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase()
  }

  return String(error).toLowerCase()
}

export function isDynamicImportError(error: unknown) {
  const message = getErrorText(error)
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

export async function clearBrowserRuntimeCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // Best-effort cleanup. The reload fallback can still recover without it.
  }

  try {
    if (typeof caches !== "undefined") {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    }
  } catch {
    // Best-effort cleanup.
  }
}

export async function reloadAfterRuntimeCleanup() {
  await clearBrowserRuntimeCaches()
  window.location.reload()
}
