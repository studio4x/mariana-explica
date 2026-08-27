import { ROUTES } from "@/lib/constants"

interface AuthCallbackUrlOptions {
  origin?: string
  baseUrl?: string
}

export function buildAuthCallbackUrl(nextPath: string, options: AuthCallbackUrlOptions = {}) {
  const normalizedBase = (options.baseUrl ?? import.meta.env.VITE_BASE_URL ?? "/").replace(/\/$/, "")
  const callbackPath = `${normalizedBase}${ROUTES.AUTH_CALLBACK}`.replace(/\/{2,}/g, "/")
  const callbackUrl = new URL(callbackPath, options.origin ?? window.location.origin)
  callbackUrl.searchParams.set("next", nextPath)
  return callbackUrl.toString()
}
