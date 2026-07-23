import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { internalError } from "./errors.ts"
import type { MoloniEnvironment } from "./fiscal.ts"
import { logError, logInfo } from "./logger.ts"

const MOLONI_API_BASE = "https://api.moloni.pt/v1"
const MOLONI_AUTHORIZE_URL = "https://www.moloni.pt/ac/root/oauth/"
const DEFAULT_TIMEOUT_MS = 15_000
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000

export class MoloniError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly httpStatus: number | null = null,
  ) {
    super(message)
    this.name = "MoloniError"
  }
}

interface MoloniTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

interface EncryptedCredentials {
  environment: MoloniEnvironment
  access_token_ciphertext: string
  refresh_token_ciphertext: string
  encryption_version: number
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw internalError(`${name} não configurada`)
  return value
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function encryptionKey() {
  const material = new TextEncoder().encode(requiredEnv("MOLONI_TOKEN_ENCRYPTION_KEY"))
  const digest = await crypto.subtle.digest("SHA-256", material)
  return await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"])
}

export async function encryptMoloniToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(value),
  )
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`
}

export async function decryptMoloniToken(value: string) {
  const [version, ivValue, ciphertextValue] = value.split(".")
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new MoloniError("Credencial Moloni cifrada inválida.", "TOKEN_DECRYPT_FAILED", false)
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivValue) },
      await encryptionKey(),
      base64ToBytes(ciphertextValue),
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new MoloniError("Não foi possível decifrar a credencial Moloni.", "TOKEN_DECRYPT_FAILED", false)
  }
}

export function buildMoloniAuthorizationUrl(state: string) {
  const url = new URL(MOLONI_AUTHORIZE_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", requiredEnv("MOLONI_CLIENT_ID"))
  url.searchParams.set("redirect_uri", requiredEnv("MOLONI_REDIRECT_URI"))
  url.searchParams.set("state", state)
  return url.toString()
}

async function requestTokens(params: Record<string, string>) {
  const url = new URL(`${MOLONI_API_BASE}/grant/`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
      throw classifyMoloniFailure(response.status, payload, "oauth/grant")
    }
    return {
      access_token: String(payload.access_token),
      refresh_token: String(payload.refresh_token),
      expires_in: Math.max(60, Number(payload.expires_in ?? 3600)),
    } satisfies MoloniTokens
  } catch (error) {
    if (error instanceof MoloniError) throw error
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MoloniError("A autenticação Moloni excedeu o tempo limite.", "TIMEOUT", true)
    }
    throw new MoloniError("Falha de ligação à autenticação Moloni.", "NETWORK_ERROR", true)
  } finally {
    clearTimeout(timeout)
  }
}

export function exchangeMoloniAuthorizationCode(code: string) {
  return requestTokens({
    grant_type: "authorization_code",
    client_id: requiredEnv("MOLONI_CLIENT_ID"),
    redirect_uri: requiredEnv("MOLONI_REDIRECT_URI"),
    client_secret: requiredEnv("MOLONI_CLIENT_SECRET"),
    code,
  })
}

function refreshMoloniTokens(refreshToken: string) {
  return requestTokens({
    grant_type: "refresh_token",
    client_id: requiredEnv("MOLONI_CLIENT_ID"),
    client_secret: requiredEnv("MOLONI_CLIENT_SECRET"),
    refresh_token: refreshToken,
  })
}

export async function storeMoloniTokens(
  client: SupabaseClient,
  environment: MoloniEnvironment,
  tokens: MoloniTokens,
  connectedBy?: string | null,
) {
  const [accessCiphertext, refreshCiphertext] = await Promise.all([
    encryptMoloniToken(tokens.access_token),
    encryptMoloniToken(tokens.refresh_token),
  ])
  const { error: credentialError } = await client.rpc("store_moloni_credentials", {
    p_environment: environment,
    p_access_token_ciphertext: accessCiphertext,
    p_refresh_token_ciphertext: refreshCiphertext,
    p_encryption_version: 1,
  })
  if (credentialError) throw credentialError

  const now = Date.now()
  const connectionUpdate = {
    environment,
    status: "connected",
    token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    last_error_code: null,
    last_error_message: null,
    disconnected_at: null,
    ...(connectedBy
      ? {
          connected_by: connectedBy,
          connected_at: new Date(now).toISOString(),
        }
      : {}),
  }
  const { error: connectionError } = await client
    .from("moloni_connections")
    .upsert(connectionUpdate, { onConflict: "environment" })
  if (connectionError) throw connectionError
}

async function loadCredentials(client: SupabaseClient, environment: MoloniEnvironment) {
  const { data, error } = await client.rpc("get_moloni_credentials", {
    p_environment: environment,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as EncryptedCredentials | null
  if (!row) {
    throw new MoloniError("Ligação Moloni não configurada.", "MOLONI_DISCONNECTED", false)
  }
  return row
}

async function getValidAccessToken(client: SupabaseClient, environment: MoloniEnvironment) {
  const { data: connection, error } = await client
    .from("moloni_connections")
    .select("status,token_expires_at")
    .eq("environment", environment)
    .maybeSingle()
  if (error) throw error
  if (!connection || connection.status === "disconnected" || connection.status === "reconnect_required") {
    throw new MoloniError("Ligação Moloni requer autenticação.", "MOLONI_DISCONNECTED", false)
  }

  const credentials = await loadCredentials(client, environment)
  const expiresAt = new Date(connection.token_expires_at ?? 0).getTime()
  if (expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return await decryptMoloniToken(credentials.access_token_ciphertext)
  }

  const workerId = crypto.randomUUID()
  const { data: claimed, error: claimError } = await client.rpc("claim_moloni_token_refresh", {
    p_environment: environment,
    p_worker_id: workerId,
  })
  if (claimError) throw claimError

  if (!claimed) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const { data: refreshed } = await client
        .from("moloni_connections")
        .select("status,token_expires_at")
        .eq("environment", environment)
        .maybeSingle()
      if (
        refreshed?.status === "connected" &&
        new Date(refreshed.token_expires_at ?? 0).getTime() > Date.now() + TOKEN_REFRESH_MARGIN_MS
      ) {
        const freshCredentials = await loadCredentials(client, environment)
        return await decryptMoloniToken(freshCredentials.access_token_ciphertext)
      }
    }
    throw new MoloniError("Renovação Moloni já está em curso.", "TOKEN_REFRESH_BUSY", true)
  }

  try {
    const refreshToken = await decryptMoloniToken(credentials.refresh_token_ciphertext)
    const tokens = await refreshMoloniTokens(refreshToken)
    await storeMoloniTokens(client, environment, tokens)
    return tokens.access_token
  } catch (refreshError) {
    await client
      .from("moloni_connections")
      .update({
        status: "reconnect_required",
        last_error_code: "TOKEN_REFRESH_FAILED",
        last_error_message: "A ligação Moloni precisa ser autenticada novamente.",
      })
      .eq("environment", environment)
    throw refreshError
  } finally {
    await client.rpc("release_moloni_token_refresh", {
      p_environment: environment,
      p_worker_id: workerId,
    })
  }
}

export function classifyMoloniFailure(
  status: number,
  payload: unknown,
  endpoint: string,
) {
  const retryable = status === 408 || status === 429 || status >= 500
  const code = status === 429
    ? "RATE_LIMITED"
    : status >= 500
      ? "MOLONI_UNAVAILABLE"
      : status === 401
        ? "TOKEN_EXPIRED"
        : "MOLONI_REJECTED"
  const humanMessage = typeof payload === "object" && payload !== null
    ? String(
      (payload as Record<string, unknown>).error_description ??
        (payload as Record<string, unknown>).message ??
        "",
    ).slice(0, 300)
    : ""
  return new MoloniError(
    humanMessage || `A API Moloni rejeitou a operação ${endpoint}.`,
    code,
    retryable,
    status || null,
  )
}

export class MoloniClient {
  constructor(
    private readonly client: SupabaseClient,
    readonly environment: MoloniEnvironment,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const startedAt = Date.now()
    const token = await getValidAccessToken(this.client, this.environment)
    const url = new URL(`${MOLONI_API_BASE}/${endpoint.replace(/^\/+|\/+$/g, "")}/`)
    url.searchParams.set("access_token", token)
    url.searchParams.set("json", "true")
    url.searchParams.set("human_errors", "true")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || (payload && typeof payload === "object" && "valid" in payload && payload.valid === 0)) {
        throw classifyMoloniFailure(response.status, payload, endpoint)
      }
      await this.client
        .from("moloni_connections")
        .update({ last_success_at: new Date().toISOString(), last_error_code: null, last_error_message: null })
        .eq("environment", this.environment)
      logInfo("Moloni API call completed", {
        endpoint,
        environment: this.environment,
        duration_ms: Date.now() - startedAt,
        http_status: response.status,
      })
      return payload as T
    } catch (error) {
      if (error instanceof MoloniError) {
        logError("Moloni API call failed", {
          endpoint,
          environment: this.environment,
          duration_ms: Date.now() - startedAt,
          http_status: error.httpStatus,
          error_code: error.code,
        })
        throw error
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        logError("Moloni API call timed out", {
          endpoint,
          environment: this.environment,
          duration_ms: Date.now() - startedAt,
          error_code: "TIMEOUT",
        })
        throw new MoloniError("A chamada Moloni excedeu o tempo limite.", "TIMEOUT", true)
      }
      logError("Moloni API network failure", {
        endpoint,
        environment: this.environment,
        duration_ms: Date.now() - startedAt,
        error_code: "NETWORK_ERROR",
      })
      throw new MoloniError("Falha de ligação à API Moloni.", "NETWORK_ERROR", true)
    } finally {
      clearTimeout(timeout)
    }
  }

  getCompanies() {
    return this.post<Array<{ company_id: number; name?: string }>>("companies/getAll", {})
  }

  getCustomerByVat(companyId: number, vat: string) {
    return this.post<Array<Record<string, unknown>>>("customers/getByVat", {
      company_id: companyId,
      vat,
      qty: 2,
      offset: 0,
    })
  }

  getCustomerByEmail(companyId: number, email: string) {
    return this.post<Array<Record<string, unknown>>>("customers/getByEmail", {
      company_id: companyId,
      email,
      qty: 2,
      offset: 0,
    })
  }

  getNextCustomerNumber(companyId: number) {
    return this.post<{ number: string }>("customers/getNextNumber", { company_id: companyId })
  }

  createCustomer(payload: Record<string, unknown>) {
    return this.post<{ valid: number; customer_id: number }>("customers/insert", payload)
  }

  updateCustomer(payload: Record<string, unknown> & { company_id: number; customer_id: number }) {
    return this.post<{ valid: number }>("customers/update", payload)
  }

  getProduct(companyId: number, productId: number) {
    return this.post<Record<string, unknown>>("products/getOne", {
      company_id: companyId,
      product_id: productId,
      with_invisible: 1,
    })
  }

  getProducts(companyId: number) {
    return this.post<Array<Record<string, unknown>>>("products/getAll", {
      company_id: companyId,
      qty: 50,
      offset: 0,
      with_invisible: 1,
    })
  }

  getDocumentSets(companyId: number) {
    return this.post<Array<Record<string, unknown>>>("documentSets/getAll", {
      company_id: companyId,
    })
  }

  getTaxes(companyId: number) {
    return this.post<Array<Record<string, unknown>>>("taxes/getAll", {
      company_id: companyId,
      with_invisible: 1,
    })
  }

  getPaymentMethods(companyId: number) {
    return this.post<Array<Record<string, unknown>>>("paymentMethods/getAll", {
      company_id: companyId,
    })
  }

  getDocument(
    kind: "invoice" | "invoice_receipt",
    companyId: number,
    search: { document_id?: number; your_reference?: string },
  ) {
    const resource = kind === "invoice_receipt" ? "invoiceReceipts" : "invoices"
    return this.post<Record<string, unknown>>(`${resource}/getOne`, {
      company_id: companyId,
      ...search,
    })
  }

  createDocument(kind: "invoice" | "invoice_receipt", payload: Record<string, unknown>) {
    const resource = kind === "invoice_receipt" ? "invoiceReceipts" : "invoices"
    return this.post<{ valid: number; document_id: number }>(`${resource}/insert`, payload)
  }

  getCreditNote(companyId: number, search: { document_id?: number; your_reference?: string }) {
    return this.post<Record<string, unknown>>("creditNotes/getOne", {
      company_id: companyId,
      ...search,
    })
  }

  createCreditNote(payload: Record<string, unknown>) {
    return this.post<{ valid: number; document_id: number }>("creditNotes/insert", payload)
  }

  createPaymentReturn(payload: Record<string, unknown>) {
    return this.post<{ valid: number; document_id: number }>("paymentReturns/insert", payload)
  }

  getPdfLink(companyId: number, documentId: number) {
    return this.post<{ url: string }>("documents/getPDFLink", {
      company_id: companyId,
      document_id: documentId,
      signed: 1,
    })
  }
}
