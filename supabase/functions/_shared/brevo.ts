import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { internalError } from "./errors.ts"

const BREVO_API_BASE = "https://api.brevo.com/v3"

export interface BrevoSettings {
  enabled: boolean
  sender_name: string | null
  sender_email: string | null
  reply_to: string | null
  lead_list_id: number | null
  consent_group_id: number | null
  attribute_mapping: Record<string, string>
  last_account: Record<string, unknown> | null
  last_connection_check_at: string | null
  last_connection_error: string | null
  updated_at: string | null
}

export interface BrevoContactSyncInput {
  userId?: string | null
  email: string
  fullName?: string | null
  nif?: string | null
  product?: string | null
  productId?: string | null
  orderId?: string | null
  paymentEnvironment?: string | null
  source?: string
  consentAt?: string
  consentEvidence?: Record<string, unknown>
}

export interface BrevoContactSyncRow extends BrevoContactSyncInput {
  id: string
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw internalError(`${name} não configurada`)
  return value
}

function configuredEnv(name: string) {
  return Boolean(Deno.env.get(name)?.trim())
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
  const material = new TextEncoder().encode(requiredEnv("BREVO_TOKEN_ENCRYPTION_KEY"))
  const digest = await crypto.subtle.digest("SHA-256", material)
  return await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"])
}

export async function encryptBrevoApiKey(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(value),
  )
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`
}

export async function decryptBrevoApiKey(value: string) {
  const [version, ivValue, ciphertextValue] = value.split(".")
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new Error("Credencial Brevo cifrada inválida")
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivValue) },
      await encryptionKey(),
      base64ToBytes(ciphertextValue),
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new Error("Não foi possível decifrar a credencial Brevo")
  }
}

export async function getBrevoApiKey(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_brevo_credentials")
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { api_key_ciphertext?: string } | null
  if (row?.api_key_ciphertext) return await decryptBrevoApiKey(row.api_key_ciphertext)
  return requiredEnv("BREVO_API_KEY")
}

export async function getBrevoCredentialStatus(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_brevo_credentials")
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { configured_at?: string } | null
  return {
    configured: Boolean(row) || configuredEnv("BREVO_API_KEY"),
    source: row ? "database" : configuredEnv("BREVO_API_KEY") ? "environment" : "none",
    encryption_key_configured: configuredEnv("BREVO_TOKEN_ENCRYPTION_KEY"),
    configured_at: row?.configured_at ?? null,
  } as const
}

export async function fetchBrevoSettings(client: SupabaseClient): Promise<BrevoSettings> {
  const { data, error } = await client
    .from("brevo_integration_settings")
    .select("enabled,sender_name,sender_email,reply_to,lead_list_id,consent_group_id,attribute_mapping,last_account,last_connection_check_at,last_connection_error,updated_at")
    .eq("singleton_key", true)
    .maybeSingle()
  if (error) throw error
  return {
    enabled: Boolean(data?.enabled),
    sender_name: data?.sender_name ?? null,
    sender_email: data?.sender_email ?? null,
    reply_to: data?.reply_to ?? null,
    lead_list_id: data?.lead_list_id ? Number(data.lead_list_id) : null,
    consent_group_id: data?.consent_group_id ? Number(data.consent_group_id) : null,
    attribute_mapping: (data?.attribute_mapping ?? {}) as Record<string, string>,
    last_account: (data?.last_account ?? null) as Record<string, unknown> | null,
    last_connection_check_at: data?.last_connection_check_at ?? null,
    last_connection_error: data?.last_connection_error ?? null,
    updated_at: data?.updated_at ?? null,
  }
}

export async function saveBrevoSettings(client: SupabaseClient, input: {
  enabled?: boolean
  senderName?: string | null
  senderEmail?: string | null
  replyTo?: string | null
  leadListId?: number | null
  consentGroupId?: number | null
  attributeMapping?: Record<string, string>
  actorUserId: string
}) {
  const { error } = await client.from("brevo_integration_settings").upsert({
    singleton_key: true,
    enabled: input.enabled ?? false,
    sender_name: input.senderName?.trim() || null,
    sender_email: input.senderEmail?.trim().toLowerCase() || null,
    reply_to: input.replyTo?.trim().toLowerCase() || null,
    lead_list_id: input.leadListId ?? null,
    consent_group_id: input.consentGroupId ?? null,
    attribute_mapping: input.attributeMapping ?? {},
    configured_by: input.actorUserId,
  }, { onConflict: "singleton_key" })
  if (error) throw error
  return await fetchBrevoSettings(client)
}

async function brevoRequest<T>(client: SupabaseClient, path: string, init: RequestInit = {}) {
  const apiKey = await getBrevoApiKey(client)
  const response = await fetch(`${BREVO_API_BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body
      ? String((body as { message?: unknown }).message ?? `Brevo retornou ${response.status}`)
      : `Brevo retornou ${response.status}`
    throw new Error(message.slice(0, 500))
  }
  return body as T
}

export async function getBrevoAccount(client: SupabaseClient) {
  return await brevoRequest<Record<string, unknown>>(client, "/account", { method: "GET" })
}

export async function getBrevoLists(client: SupabaseClient) {
  return await brevoRequest<{ lists?: Array<Record<string, unknown>>; count?: number }>(client, "/contacts/lists?limit=500&offset=0", { method: "GET" })
}

export async function getBrevoAttributes(client: SupabaseClient) {
  return await brevoRequest<{ attributes?: Array<Record<string, unknown>>; categories?: Array<Record<string, unknown>> }>(client, "/contacts/attributes", { method: "GET" })
}

export async function getBrevoConsentGroups(client: SupabaseClient) {
  return await brevoRequest<{ consentGroups?: Array<Record<string, unknown>> }>(client, "/contacts/consent-groups?limit=500&offset=0", { method: "GET" })
}

export async function sendBrevoTransactionalEmail(client: SupabaseClient, input: {
  emailTo: string
  subject: string
  html?: string | null
  text?: string | null
  metadata?: Record<string, unknown>
}) {
  const settings = await fetchBrevoSettings(client)
  if (!settings.enabled) throw new Error("Integração Brevo desativada")
  if (!settings.sender_email) throw new Error("Remetente Brevo não configurado")
  const deliveryId = String(input.metadata?.delivery_id ?? crypto.randomUUID())
  const tags = Object.entries(input.metadata ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 16)
    .map(([key, value]) => `${key}=${String(value).slice(0, 120)}`)
  const data = await brevoRequest<{ messageId?: string }>(client, "/smtp/email", {
    method: "POST",
    headers: { "Idempotency-Key": deliveryId },
    body: JSON.stringify({
      sender: { name: settings.sender_name ?? undefined, email: settings.sender_email },
      replyTo: settings.reply_to ? { email: settings.reply_to } : undefined,
      to: [{ email: input.emailTo.trim().toLowerCase() }],
      subject: input.subject.trim(),
      htmlContent: input.html?.trim() || undefined,
      textContent: input.text?.trim() || undefined,
      tags: ["mariana-explica", ...tags].slice(0, 20),
      headers: { "X-Mailin-custom": `mariana_delivery_id=${deliveryId}` },
    }),
  })
  if (!data?.messageId) throw new Error("Brevo não devolveu messageId")
  return { provider: "brevo", providerMessageId: data.messageId }
}

function contactAttributes(settings: BrevoSettings, input: BrevoContactSyncInput) {
  const fullName = input.fullName?.trim() || ""
  const parts = fullName.split(/\s+/).filter(Boolean)
  const values: Record<string, unknown> = {
    [settings.attribute_mapping.first_name || "FIRSTNAME"]: parts[0] || "",
    [settings.attribute_mapping.last_name || "LASTNAME"]: parts.slice(1).join(" ") || "",
    [settings.attribute_mapping.full_name || "FULLNAME"]: fullName,
    [settings.attribute_mapping.nif || "NIF"]: input.nif?.trim() || "",
    [settings.attribute_mapping.user_id || "MARIANA_USER_ID"]: input.userId || "",
    [settings.attribute_mapping.lead_source || "LEAD_SOURCE"]: input.source || "checkout",
    [settings.attribute_mapping.opt_in || "OPT_IN"]: true,
    [settings.attribute_mapping.opt_in_at || "OPT_IN_AT"]: input.consentAt || new Date().toISOString(),
    [settings.attribute_mapping.product || "PRODUCT"]: input.product || "",
    [settings.attribute_mapping.order_id || "ORDER_ID"]: input.orderId || "",
    [settings.attribute_mapping.payment_environment || "PAYMENT_ENVIRONMENT"]: input.paymentEnvironment || "",
  }
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value !== null))
}

export async function syncBrevoContact(client: SupabaseClient, input: BrevoContactSyncInput) {
  const settings = await fetchBrevoSettings(client)
  if (!settings.enabled) throw new Error("Integração Brevo desativada")
  if (!settings.lead_list_id) throw new Error("Lista de leads Brevo não configurada")
  const email = input.email.trim().toLowerCase()
  const attributes = contactAttributes(settings, input)
  const created = await brevoRequest<{ id?: number }>(client, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      ext_id: input.userId || undefined,
      attributes,
      listIds: [settings.lead_list_id],
      emailBlacklisted: false,
      updateEnabled: true,
    }),
  })

  // Consent Groups are account-dependent. Import is the documented operation
  // that accepts consentGroupIds; it is deliberately best-effort after the
  // idempotent contact upsert so a disabled account feature does not lose sync.
  if (settings.consent_group_id) {
    await brevoRequest(client, "/contacts/import", {
      method: "POST",
      body: JSON.stringify({
        jsonBody: [{ email, attributes }],
        listIds: [settings.lead_list_id],
        consentGroupIds: [settings.consent_group_id],
        updateExistingContacts: true,
        emailBlacklist: false,
      }),
    })
  }

  return { contactId: created?.id ?? null, attributes, listId: settings.lead_list_id, consentGroupId: settings.consent_group_id }
}

export async function getBrevoContact(client: SupabaseClient, identifier: string) {
  return await brevoRequest<Record<string, unknown>>(client, `/contacts/${encodeURIComponent(identifier)}`, { method: "GET" })
}

export async function getBrevoEmailEvents(client: SupabaseClient, input: {
  days?: number
  limit?: number
  offset?: number
  email?: string
  messageId?: string
  event?: string
}) {
  const params = new URLSearchParams({
    days: String(Math.min(90, Math.max(1, input.days ?? 30))),
    limit: String(Math.min(5000, Math.max(1, input.limit ?? 250))),
    offset: String(Math.max(0, input.offset ?? 0)),
    sort: "desc",
  })
  if (input.email) params.set("email", input.email)
  if (input.messageId) params.set("messageId", input.messageId)
  if (input.event) params.set("event", input.event)
  return await brevoRequest<{ events?: Array<Record<string, unknown>> }>(client, `/smtp/statistics/events?${params.toString()}`, { method: "GET" })
}

export async function queueBrevoContactSync(client: SupabaseClient, input: BrevoContactSyncInput) {
  const email = input.email.trim().toLowerCase()
  if (!email) return null
  const settings = await fetchBrevoSettings(client)
  const consentAt = input.consentAt ?? new Date().toISOString()
  const attributes = contactAttributes(settings, { ...input, consentAt })
  const { data, error } = await client.from("brevo_contact_syncs").upsert({
    user_id: input.userId ?? null,
    email,
    list_id: settings.lead_list_id,
    consent_group_id: settings.consent_group_id,
    consent_granted: true,
    consent_at: consentAt,
    consent_source: input.source ?? "checkout",
    consent_evidence: input.consentEvidence ?? {},
    source_product_id: input.productId ?? null,
    source_order_id: input.orderId ?? null,
    attributes,
    status: "queued",
    next_attempt_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "user_id,email" }).select("id").single()
  if (error) throw error
  return data as { id: string }
}

export function safeBrevoError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/xkeysib-[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 500)
}
