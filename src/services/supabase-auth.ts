import { supabase } from "@/integrations/supabase"

export async function getFunctionAuthHeaders() {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) {
    return undefined
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  }
}
