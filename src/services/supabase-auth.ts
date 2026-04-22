import { supabase } from "@/integrations/supabase"

export interface FunctionAuthContext {
  accessToken: string
  headers: {
    Authorization: string
  }
}

let refreshSessionPromise: Promise<FunctionAuthContext | null> | null = null

function getJwtExpiryMs(token: string) {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown }
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

function isTokenExpiringSoon(token: string, thresholdMs = 60_000) {
  const expiresAt = getJwtExpiryMs(token)
  if (!expiresAt) return false
  return expiresAt - Date.now() <= thresholdMs
}

export async function getFreshFunctionAuthContext(): Promise<FunctionAuthContext | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const currentToken = sessionData.session?.access_token

  if (currentToken && !isTokenExpiringSoon(currentToken)) {
    return {
      accessToken: currentToken,
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    }
  }

  if (!refreshSessionPromise) {
    refreshSessionPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        const refreshedToken = !error ? data.session?.access_token ?? null : null
        const accessToken = refreshedToken ?? currentToken ?? null

        if (!accessToken) {
          return null
        }

        return {
          accessToken,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      } catch {
        if (!currentToken) {
          return null
        }

        return {
          accessToken: currentToken,
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      } finally {
        refreshSessionPromise = null
      }
    })()
  }

  return refreshSessionPromise
}

export async function getFunctionAuthHeaders() {
  const context = await getFreshFunctionAuthContext()
  return context?.headers
}
