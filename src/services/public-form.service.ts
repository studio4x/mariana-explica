import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

export interface SubmitPublicFormInput {
  formType?: string
  sourcePage?: string
  fullName: string
  email: string
  subject: string
  message: string
  metadata?: Record<string, unknown>
}

interface SubmitPublicFormResponse {
  success: boolean
  submission_id: string
}

const RETRYABLE_NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
]

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof TypeError)) return false

  const message = error.message.toLowerCase()
  return RETRYABLE_NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

export async function submitPublicForm(input: SubmitPublicFormInput) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/public-form-submit`
  let response: Response | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formType: input.formType ?? "explicacoes",
          sourcePage: input.sourcePage ?? "/explicacoes",
          fullName: input.fullName,
          email: input.email,
          subject: input.subject,
          message: input.message,
          metadata: input.metadata ?? {},
        }),
      })
      break
    } catch (error) {
      if (attempt === 0 && isRetryableNetworkError(error)) {
        await delay(700)
        continue
      }

      throw error
    }
  }

  if (!response) {
    throw new Error("Nao foi possivel contactar o servidor. Tenta novamente dentro de instantes.")
  }

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  if (!data || typeof data !== "object") {
    throw new Error("Resposta invalida ao enviar formulario")
  }

  return data as SubmitPublicFormResponse
}
