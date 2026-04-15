export class HttpError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function badRequest(message = "Requisição inválida", details?: unknown) {
  return new HttpError(400, "BAD_REQUEST", message, details)
}

export function unauthorized(message = "Não autenticado", details?: unknown) {
  return new HttpError(401, "UNAUTHORIZED", message, details)
}

export function forbidden(message = "Sem permissão", details?: unknown) {
  return new HttpError(403, "FORBIDDEN", message, details)
}

export function notFound(message = "Não encontrado", details?: unknown) {
  return new HttpError(404, "NOT_FOUND", message, details)
}

export function conflict(message = "Conflito", details?: unknown) {
  return new HttpError(409, "CONFLICT", message, details)
}

export function unprocessable(message = "Regra de negócio inválida", details?: unknown) {
  return new HttpError(422, "UNPROCESSABLE_ENTITY", message, details)
}

export function internalError(message = "Erro interno", details?: unknown) {
  return new HttpError(500, "INTERNAL_ERROR", message, details)
}

