import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

export class FreeDownloadServiceError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = "FreeDownloadServiceError"
    this.status = status
  }
}

function getFreeDownloadFunctionUrl(name: string) {
  if (!import.meta.env.DEV) {
    return `/api/public/${name}`
  }

  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`
}

async function callFreeDownloadFunction<T>(name: string, body: Record<string, string>) {
  let response: Response
  try {
    response = await fetch(getFreeDownloadFunctionUrl(name), {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new FreeDownloadServiceError(
      "Não foi possível ligar ao serviço de download. Tenta novamente dentro de instantes.",
      null,
    )
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || !data || typeof data !== "object") {
    throw new FreeDownloadServiceError(
      typeof data?.message === "string"
        ? data.message
        : "Não foi possível concluir o pedido. Tenta novamente dentro de instantes.",
      response.status,
    )
  }
  return data as T
}

export function requestFreeDownload(input: { productId: string; name: string; email: string }) {
  return callFreeDownloadFunction<{ success: true; message: string }>("request-free-download", input)
}

export function redeemFreeDownload(token: string) {
  return callFreeDownloadFunction<{ success: true; url: string; file_name: string }>("redeem-free-download", { token })
}
