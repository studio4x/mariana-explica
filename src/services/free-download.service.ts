import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

async function callFreeDownloadFunction<T>(name: string, body: Record<string, string>) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data || typeof data !== "object") {
    throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível concluir o pedido. Tenta novamente dentro de instantes.")
  }
  return data as T
}

export function requestFreeDownload(input: { productId: string; name: string; email: string }) {
  return callFreeDownloadFunction<{ success: true; message: string }>("request-free-download", input)
}

export function redeemFreeDownload(token: string) {
  return callFreeDownloadFunction<{ success: true; url: string; file_name: string }>("redeem-free-download", { token })
}
