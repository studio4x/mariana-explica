import { supabase } from "@/integrations/supabase"

export interface FunctionAuthContext {
  accessToken: string
  headers: {
    Authorization: string
  }
}

let refreshSessionPromise: Promise<FunctionAuthContext | null> | null = null
let sessionAccessQueue: Promise<FunctionAuthContext | null> = Promise.resolve(null)

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

function isAuthLockContention(error: unknown) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()
  return fullText.includes("lock") && fullText.includes("stole it")
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function getFreshFunctionAuthContext(): Promise<FunctionAuthContext | null> {
  sessionAccessQueue = sessionAccessQueue
    .catch(() => null)
    .then(async () => {
      let currentToken: string | null = null

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        currentToken = sessionData.session?.access_token ?? null
      } catch (error) {
        if (!isAuthLockContention(error)) throw error
        await wait(80)
        const { data: retriedSessionData } = await supabase.auth.getSession()
        currentToken = retriedSessionData.session?.access_token ?? null
      }

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
          } catch (error) {
            if (isAuthLockContention(error)) {
              await wait(120)
              const { data: fallbackSessionData } = await supabase.auth.getSession()
              const fallbackToken = fallbackSessionData.session?.access_token ?? currentToken ?? null
              if (!fallbackToken) return null
              return {
                accessToken: fallbackToken,
                headers: {
                  Authorization: `Bearer ${fallbackToken}`,
                },
              }
            }

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
    })

  return sessionAccessQueue
}

export async function getFunctionAuthHeaders() {
  const context = await getFreshFunctionAuthContext()
  return context?.headers
}
