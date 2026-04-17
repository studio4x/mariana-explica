import { badRequest, unauthorized } from "./errors.ts"

export type StripeEnvironment = "test" | "live"

export interface StripeCheckoutLineItem {
  price_data: {
    currency: string
    product_data: {
      name: string
      description?: string
    }
    unit_amount: number
  }
  quantity: number
}

export interface StripeCheckoutSessionParams {
  success_url: string
  cancel_url: string
  line_items: StripeCheckoutLineItem[]
  mode?: "payment"
  metadata?: Record<string, string>
  client_reference_id?: string
  customer_email?: string
}

export function getStripeEnvironment(): StripeEnvironment {
  const explicit = Deno.env.get("STRIPE_MODE")?.trim().toLowerCase()
  if (explicit === "test" || explicit === "live") {
    return explicit
  }

  const legacySecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim()
  if (legacySecret?.startsWith("sk_live_")) {
    return "live"
  }
  if (legacySecret?.startsWith("sk_test_")) {
    return "test"
  }

  return "test"
}

function getStripeSecret(mode?: StripeEnvironment) {
  const resolvedMode = mode ?? getStripeEnvironment()

  const secret =
    resolvedMode === "live"
      ? (Deno.env.get("STRIPE_SECRET_KEY_LIVE") ?? Deno.env.get("STRIPE_SECRET_KEY"))
      : (Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? Deno.env.get("STRIPE_SECRET_KEY"))

  if (!secret) {
    throw unauthorized("STRIPE_SECRET_KEY não configurada")
  }

  if (!secret.startsWith("sk_")) {
    throw unauthorized("STRIPE_SECRET_KEY inválida")
  }

  if (resolvedMode === "live" && !secret.startsWith("sk_live_")) {
    throw unauthorized("STRIPE_SECRET_KEY_LIVE não configurada")
  }

  if (resolvedMode === "test" && !secret.startsWith("sk_test_")) {
    throw unauthorized("STRIPE_SECRET_KEY_TEST não configurada")
  }

  return secret
}

export function parseStripeSignature(header: string | null) {
  if (!header) {
    throw badRequest("Assinatura do Stripe ausente")
  }

  const parts = header.split(",").reduce<Record<string, string>>((acc, segment) => {
    const [key, value] = segment.split("=", 2)
    if (key && value) {
      acc[key.trim()] = value.trim()
    }
    return acc
  }, {})

  const timestamp = parts.t
  const signature = parts.v1

  if (!timestamp || !signature) {
    throw badRequest("Assinatura do Stripe inválida")
  }

  return { timestamp, signature }
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

export async function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const candidates = [
    Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET"),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  if (candidates.length === 0) {
    throw unauthorized("STRIPE_WEBHOOK_SECRET não configurada")
  }

  const { timestamp, signature } = parseStripeSignature(signatureHeader)
  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) {
    throw badRequest("Timestamp da assinatura do Stripe invalido")
  }

  const toleranceInSeconds = 300
  const nowInSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowInSeconds - timestampSeconds) > toleranceInSeconds) {
    throw unauthorized("Assinatura do Stripe fora da janela de seguranca")
  }

  for (const secret of candidates) {
    const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
    if (constantTimeEquals(expected, signature)) {
      return
    }
  }

  throw unauthorized("Assinatura do Stripe inválida")
}

export async function createStripeCheckoutSession(
  params: StripeCheckoutSessionParams,
  options?: { mode?: StripeEnvironment },
) {
  const secret = getStripeSecret(options?.mode)
  const form = new URLSearchParams()

  form.set("mode", params.mode ?? "payment")
  form.set("success_url", params.success_url)
  form.set("cancel_url", params.cancel_url)
  form.set("payment_method_types[0]", "card")

  params.line_items.forEach((lineItem, index) => {
    form.set(`line_items[${index}][quantity]`, String(lineItem.quantity))
    form.set(
      `line_items[${index}][price_data][currency]`,
      lineItem.price_data.currency.toLowerCase(),
    )
    form.set(
      `line_items[${index}][price_data][product_data][name]`,
      lineItem.price_data.product_data.name,
    )
    if (lineItem.price_data.product_data.description) {
      form.set(
        `line_items[${index}][price_data][product_data][description]`,
        lineItem.price_data.product_data.description,
      )
    }
    form.set(
      `line_items[${index}][price_data][unit_amount]`,
      String(lineItem.price_data.unit_amount),
    )
  })

  if (params.metadata) {
    for (const [key, value] of Object.entries(params.metadata)) {
      form.set(`metadata[${key}]`, value)
    }
  }

  if (params.client_reference_id) {
    form.set("client_reference_id", params.client_reference_id)
  }

  if (params.customer_email) {
    form.set("customer_email", params.customer_email)
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Falha ao criar sessão Stripe")
  }

  return payload as {
    id: string
    url: string | null
    payment_intent: string | null
  }
}

export async function getStripeCheckoutSession(
  sessionId: string,
  options?: { mode?: StripeEnvironment },
) {
  const secret = getStripeSecret(options?.mode)
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Falha ao consultar sessão Stripe")
  }

  return payload as {
    id: string
    livemode: boolean
    payment_intent: string | null
    payment_status: "paid" | "unpaid" | "no_payment_required"
    status: "open" | "complete" | "expired"
    amount_total: number | null
    currency: string | null
    metadata?: Record<string, string | undefined>
    client_reference_id?: string | null
  }
}

