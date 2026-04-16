import { supabase } from "@/integrations/supabase"

export interface FunctionAuthContext {
  accessToken: string
  headers: {
    Authorization: string
  }
}

export async function getFreshFunctionAuthContext(): Promise<FunctionAuthContext | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const currentToken = sessionData.session?.access_token

  let accessToken = currentToken ?? null

  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session?.access_token) {
      accessToken = data.session.access_token
    }
  } catch {
    // Best-effort refresh. If it fails, we still fall back to the current token.
  }

  if (!accessToken) {
    return null
  }

  return {
    accessToken,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
}

export async function getFunctionAuthHeaders() {
  const context = await getFreshFunctionAuthContext()
  return context?.headers
}
