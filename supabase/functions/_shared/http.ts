import { badRequest, HttpError } from "./errors.ts"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
}

export function corsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        success: false,
        request_id: requestId,
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
      error.status,
    )
  }

  const message = error instanceof Error ? error.message : "Erro inesperado"
  return jsonResponse(
    {
      success: false,
      request_id: requestId,
      code: "INTERNAL_ERROR",
      message,
    },
    500,
  )
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  const text = await req.text()
  if (!text) {
    throw badRequest("Corpo da requisição vazio")
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw badRequest("Corpo JSON inválido")
  }
}

export function getBearerToken(req: Request) {
  const header = req.headers.get("authorization")
  if (!header) {
    return null
  }

  const [type, token] = header.split(" ")
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null
  }

  return token.trim()
}

export async function getAccessToken(req: Request) {
  const headerToken = getBearerToken(req)
  if (headerToken) {
    return headerToken
  }

  try {
    const body = (await req.clone().json()) as { access_token?: unknown } | null
    if (body && typeof body.access_token === "string" && body.access_token.trim()) {
      return body.access_token.trim()
    }
  } catch {
    return null
  }

  return null
}

export function getRequestId(req: Request) {
  return req.headers.get("x-request-id") || crypto.randomUUID()
}

