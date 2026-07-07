import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { getAppBaseUrl } from "./supabase.ts"

type PlatformTemplateKey =
  | "purchase_confirmed"
  | "free_product_claimed"
  | "support_ticket_created"
  | "support_ticket_replied"
  | "manual_notification"

interface EmailContent {
  subject: string
  html: string
  text: string
}

interface EmailQueueInput {
  userId?: string | null
  notificationId?: string | null
  emailTo: string
  templateKey: PlatformTemplateKey
  subject: string
  html: string
  text: string
  metadata?: Record<string, unknown>
}

interface EmailOperationalConfig {
  providerName: string
  senderName: string | null
  senderAddress: string | null
  replyTo: string | null
}

export interface EmailEnvironmentStatus {
  providerName: string | null
  transport: "smtp" | "resend" | "postmark" | "sendgrid" | null
  senderNamePresent: boolean
  senderAddressPresent: boolean
  replyToPresent: boolean
  smtpHostPresent: boolean
  smtpPortPresent: boolean
  smtpUserPresent: boolean
  smtpPasswordPresent: boolean
  ready: boolean
  missing: string[]
}

interface EmailProviderRuntimeConfig extends EmailOperationalConfig {
  providerKey: "resend" | "postmark" | "sendgrid" | "smtp"
  apiKey: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPassword: string | null
  smtpSecure: boolean | null
  smtpEhloDomain: string | null
}

interface SendTransactionalEmailInput {
  emailTo: string
  subject: string
  html: string | null
  text: string | null
  metadata?: Record<string, unknown>
}

interface SendTransactionalEmailResult {
  provider: string
  providerMessageId: string
}

const ADMIN_PENDING_INFO_KEY = "admin_pending_information"

interface EmailLayoutInput {
  eyebrow: string
  title: string
  greeting?: string | null
  intro: string
  bullets?: string[]
  ctaLabel?: string | null
  ctaUrl?: string | null
  footer?: string | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function normalizeUrl(url?: string | null) {
  if (!url) {
    return null
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  const baseUrl = getAppBaseUrl().replace(/\/$/, "")
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`
}

function normalizeProviderName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
}

function readEnvText(...keys: string[]) {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function readEnvNumber(...keys: string[]) {
  for (const key of keys) {
    const rawValue = Deno.env.get(key)?.trim()
    if (!rawValue) {
      continue
    }

    const parsed = Number(rawValue)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function readEnvBoolean(...keys: string[]) {
  for (const key of keys) {
    const rawValue = Deno.env.get(key)?.trim().toLowerCase()
    if (!rawValue) {
      continue
    }

    if (["1", "true", "yes", "on"].includes(rawValue)) {
      return true
    }

    if (["0", "false", "no", "off"].includes(rawValue)) {
      return false
    }
  }

  return null
}

function encodeUtf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }

  return btoa(binary)
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? value
}

function encodeMimeHeaderValue(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value
  }

  return `=?UTF-8?B?${encodeUtf8Base64(value)}?=`
}

function normalizeEmailAddress(value: string) {
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(/<([^>]+)>/)
  const email = (match?.[1] ?? trimmed).trim()

  if (!email || !email.includes("@")) {
    throw new Error(`Endereco de email invalido: ${value}`)
  }

  return email
}

function extractDomainFromEmail(value: string) {
  const email = normalizeEmailAddress(value)
  const domain = email.split("@")[1]?.trim()
  return domain || null
}

function normalizeEmailOperationalConfig(value: unknown): EmailOperationalConfig {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
  const normalizeText = (key: string) => String(input[key] ?? "").trim() || null

  return {
    providerName: normalizeProviderName(input.email_provider_name as string | undefined),
    senderName: normalizeText("email_sender_name"),
    senderAddress: normalizeText("email_sender_address"),
    replyTo: normalizeText("email_reply_to"),
  }
}

function readEmailRuntimeConfigFromEnvironment(): EmailOperationalConfig {
  const providerName = normalizeProviderName(
    readEnvText("EMAIL_PROVIDER", "EMAIL_PROVIDER_NAME") ||
      (readEnvText("EMAIL_SMTP_HOST", "SMTP_HOST") ? "smtp" : null) ||
      (readEnvText("RESEND_API_KEY") ? "resend" : null) ||
      (readEnvText("POSTMARK_SERVER_TOKEN") ? "postmark" : null) ||
      (readEnvText("SENDGRID_API_KEY") ? "sendgrid" : null) ||
      "",
  )

  return {
    providerName,
    senderName: readEnvText("EMAIL_FROM_NAME"),
    senderAddress: readEnvText("EMAIL_FROM_EMAIL", "EMAIL_FROM_ADDRESS"),
    replyTo: readEnvText("EMAIL_REPLY_TO"),
  }
}

export function getEmailEnvironmentStatus(): EmailEnvironmentStatus {
  const runtimeConfig = readEmailRuntimeConfigFromEnvironment()
  const smtpHost = readEnvText("EMAIL_SMTP_HOST", "SMTP_HOST")
  const smtpPort = readEnvText("EMAIL_SMTP_PORT", "SMTP_PORT")
  const smtpUser = readEnvText("EMAIL_SMTP_USER", "SMTP_USER", "EMAIL_SMTP_USERNAME", "SMTP_USERNAME")
  const smtpPassword = readEnvText("EMAIL_SMTP_PASSWORD", "SMTP_PASSWORD")
  const transport = runtimeConfig.providerName.includes("smtp")
    ? "smtp"
    : runtimeConfig.providerName.includes("postmark")
      ? "postmark"
      : runtimeConfig.providerName.includes("sendgrid")
        ? "sendgrid"
        : runtimeConfig.providerName.includes("resend")
          ? "resend"
          : null

  const missing = new Set<string>()

  if (!runtimeConfig.providerName) {
    missing.add("EMAIL_PROVIDER / EMAIL_PROVIDER_NAME")
    if (!smtpHost) {
      missing.add("EMAIL_SMTP_HOST / SMTP_HOST")
    }
    if (!smtpPort) {
      missing.add("EMAIL_SMTP_PORT / SMTP_PORT")
    }
    if (!smtpUser) {
      missing.add("EMAIL_SMTP_USER / SMTP_USER")
    }
    if (!smtpPassword) {
      missing.add("EMAIL_SMTP_PASSWORD / SMTP_PASSWORD")
    }
  }

  if (!runtimeConfig.senderAddress) {
    missing.add("EMAIL_FROM_EMAIL / EMAIL_FROM_ADDRESS")
  }

  return {
    providerName: runtimeConfig.providerName || null,
    transport,
    senderNamePresent: Boolean(runtimeConfig.senderName),
    senderAddressPresent: Boolean(runtimeConfig.senderAddress),
    replyToPresent: Boolean(runtimeConfig.replyTo),
    smtpHostPresent: Boolean(smtpHost),
    smtpPortPresent: Boolean(smtpPort),
    smtpUserPresent: Boolean(smtpUser),
    smtpPasswordPresent: Boolean(smtpPassword),
    ready: Boolean(
      (transport === "smtp" || !runtimeConfig.providerName) &&
        smtpHost &&
        smtpPort &&
        smtpUser &&
        smtpPassword &&
        runtimeConfig.senderAddress,
    ),
    missing: Array.from(missing),
  }
}

function resolveProviderRuntimeConfig(config: EmailOperationalConfig): EmailProviderRuntimeConfig {
  const configuredProvider = normalizeProviderName(
    readEnvText("EMAIL_PROVIDER", "EMAIL_PROVIDER_NAME") ||
      config.providerName ||
      (readEnvText("EMAIL_SMTP_HOST", "SMTP_HOST") ? "smtp" : null) ||
      (readEnvText("RESEND_API_KEY") ? "resend" : null) ||
      (readEnvText("POSTMARK_SERVER_TOKEN") ? "postmark" : null) ||
      (readEnvText("SENDGRID_API_KEY") ? "sendgrid" : null) ||
      "",
  )

  const senderAddress = readEnvText("EMAIL_FROM_EMAIL", "EMAIL_FROM_ADDRESS") || config.senderAddress
  const senderName = readEnvText("EMAIL_FROM_NAME") || config.senderName
  const replyTo = readEnvText("EMAIL_REPLY_TO") || config.replyTo

  if (!configuredProvider) {
    throw new Error("EMAIL_PROVIDER nao configurado para envio transacional")
  }

  const providerKey = configuredProvider.includes("smtp")
    ? "smtp"
    : configuredProvider.includes("postmark")
    ? "postmark"
    : configuredProvider.includes("sendgrid")
      ? "sendgrid"
      : configuredProvider.includes("resend")
        ? "resend"
        : null

  if (!providerKey) {
    throw new Error(`Provedor de email nao suportado: ${configuredProvider}`)
  }

  if (!senderAddress) {
    throw new Error("EMAIL_FROM_EMAIL nao configurado para envio transacional")
  }

  if (providerKey === "smtp") {
    const smtpHost = readEnvText("EMAIL_SMTP_HOST", "SMTP_HOST")
    const smtpPort = readEnvNumber("EMAIL_SMTP_PORT", "SMTP_PORT") ?? 465
    const smtpUser = readEnvText("EMAIL_SMTP_USER", "SMTP_USER", "EMAIL_SMTP_USERNAME", "SMTP_USERNAME")
    const smtpPassword = readEnvText("EMAIL_SMTP_PASSWORD", "SMTP_PASSWORD")
    const smtpSecure = readEnvBoolean("EMAIL_SMTP_SECURE", "SMTP_SECURE") ?? smtpPort === 465
    const smtpEhloDomain =
      readEnvText("EMAIL_SMTP_EHLO_DOMAIN", "SMTP_EHLO_DOMAIN") ||
      extractDomainFromEmail(senderAddress) ||
      "localhost"

    if (!smtpHost) {
      throw new Error("EMAIL_SMTP_HOST nao configurado para envio SMTP")
    }

    if (!smtpUser) {
      throw new Error("EMAIL_SMTP_USER nao configurado para envio SMTP")
    }

    if (!smtpPassword) {
      throw new Error("EMAIL_SMTP_PASSWORD nao configurado para envio SMTP")
    }

    return {
      providerKey: "smtp",
      providerName: configuredProvider,
      apiKey: "",
      senderName,
      senderAddress: normalizeEmailAddress(senderAddress),
      replyTo: replyTo ? normalizeEmailAddress(replyTo) : null,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpSecure,
      smtpEhloDomain,
    }
  }

  const apiKey =
    providerKey === "resend"
      ? readEnvText("EMAIL_PROVIDER_API_KEY", "RESEND_API_KEY")
      : providerKey === "postmark"
        ? readEnvText("EMAIL_PROVIDER_API_KEY", "POSTMARK_SERVER_TOKEN")
        : readEnvText("EMAIL_PROVIDER_API_KEY", "SENDGRID_API_KEY")

  if (!apiKey) {
    throw new Error(`${providerKey.toUpperCase()} API key nao configurada`)
  }

  return {
    providerKey,
    providerName: configuredProvider,
    senderName,
    senderAddress: normalizeEmailAddress(senderAddress),
    replyTo: replyTo ? normalizeEmailAddress(replyTo) : null,
    apiKey,
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    smtpPassword: null,
    smtpSecure: null,
    smtpEhloDomain: null,
  }
}

function formatSenderAddress(config: EmailProviderRuntimeConfig) {
  return config.senderName
    ? `${encodeMimeHeaderValue(config.senderName)} <${config.senderAddress}>`
    : config.senderAddress
}

function formatMessageIdDomain(config: EmailProviderRuntimeConfig) {
  return config.smtpEhloDomain || extractDomainFromEmail(config.senderAddress) || "mariana-explica.pt"
}

function buildSmtpMessage(config: EmailProviderRuntimeConfig, input: SendTransactionalEmailInput) {
  const boundary = `boundary-${crypto.randomUUID()}`
  const fromHeader = formatSenderAddress(config)
  const toHeader = input.emailTo.trim().toLowerCase()
  const subjectHeader = encodeMimeHeaderValue(input.subject)
  const messageId = `<${crypto.randomUUID()}@${formatMessageIdDomain(config)}>`
  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
  ]

  if (config.replyTo) {
    headers.push(`Reply-To: ${config.replyTo}`)
  }

  const hasHtml = Boolean(input.html?.trim())
  const hasText = Boolean(input.text?.trim())

  if (hasHtml && hasText) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)

    const textPart = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(encodeUtf8Base64(input.text ?? "")),
    ].join("\r\n")
    const htmlPart = [
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(encodeUtf8Base64(input.html ?? "")),
    ].join("\r\n")

    return [
      ...headers,
      "",
      textPart,
      htmlPart,
      `--${boundary}--`,
      "",
    ].join("\r\n")
  }

  if (hasHtml) {
    headers.push("Content-Type: text/html; charset=UTF-8")
    headers.push("Content-Transfer-Encoding: base64")
    return [
      ...headers,
      "",
      wrapBase64(encodeUtf8Base64(input.html ?? "")),
      "",
    ].join("\r\n")
  }

  headers.push("Content-Type: text/plain; charset=UTF-8")
  headers.push("Content-Transfer-Encoding: base64")
  return [
    ...headers,
    "",
    wrapBase64(encodeUtf8Base64(input.text ?? "")),
    "",
  ].join("\r\n")
}

async function readSmtpResponse(conn: Deno.Conn) {
  const decoder = new TextDecoder()
  let buffer = ""
  const lines: string[] = []
  let responseCode: number | null = null

  while (true) {
    const newlineIndex = buffer.indexOf("\n")

    if (newlineIndex === -1) {
      const chunk = new Uint8Array(4096)
      const bytesRead = await conn.read(chunk)
      if (bytesRead === null) {
        throw new Error("Conexao SMTP encerrada inesperadamente")
      }

      buffer += decoder.decode(chunk.subarray(0, bytesRead), { stream: true })
      continue
    }

    const line = buffer.slice(0, newlineIndex).replace(/\r$/, "")
    buffer = buffer.slice(newlineIndex + 1)
    lines.push(line)

    const match = line.match(/^(\d{3})([ -])(.*)$/)
    if (!match) {
      continue
    }

    const code = Number(match[1])
    if (responseCode === null) {
      responseCode = code
    }

    if (match[2] === " " && code === responseCode) {
      return {
        code,
        lines,
        message: lines
          .map((entry) => entry.replace(/^(\d{3})([ -])/, "").trim())
          .join("\n")
          .trim(),
      }
    }
  }
}

async function sendSmtpCommand(
  conn: Deno.Conn,
  command: string,
  expectedCodes: number[],
) {
  const encoder = new TextEncoder()
  await conn.write(encoder.encode(`${command}\r\n`))
  const response = await readSmtpResponse(conn)

  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP ${command.split(" ")[0]} retornou ${response.code}: ${response.message || "resposta invalida"}`)
  }

  return response
}

function buildSmtpDataPayload(message: string) {
  return message
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n")
}

async function authenticateSmtp(conn: Deno.Conn, config: EmailProviderRuntimeConfig) {
  const username = encodeUtf8Base64(config.smtpUser ?? "")
  const password = encodeUtf8Base64(config.smtpPassword ?? "")

  try {
    await sendSmtpCommand(conn, `AUTH PLAIN ${encodeUtf8Base64(`\u0000${config.smtpUser}\u0000${config.smtpPassword}`)}`, [235])
    return
  } catch (plainError) {
    const firstError = plainError instanceof Error ? plainError : new Error(String(plainError))

    try {
      await sendSmtpCommand(conn, "AUTH LOGIN", [334])
      await sendSmtpCommand(conn, username, [334])
      await sendSmtpCommand(conn, password, [235])
      return
    } catch (loginError) {
      const secondError = loginError instanceof Error ? loginError : new Error(String(loginError))
      throw new Error(`Autenticacao SMTP falhou: ${firstError.message}; ${secondError.message}`)
    }
  }
}

async function sendWithSmtp(
  config: EmailProviderRuntimeConfig,
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const host = config.smtpHost
  const port = config.smtpPort ?? 465
  if (!host || !config.smtpUser || !config.smtpPassword) {
    throw new Error("Configuracao SMTP incompleta")
  }

  const conn = await Deno.connectTls({
    hostname: host,
    port,
  })

  try {
    const banner = await readSmtpResponse(conn)
    if (banner.code !== 220) {
      throw new Error(`SMTP nao aceitou a conexao: ${banner.message || banner.code}`)
    }

    await sendSmtpCommand(conn, `EHLO ${config.smtpEhloDomain ?? "localhost"}`, [250])
    await authenticateSmtp(conn, config)
    await sendSmtpCommand(conn, `MAIL FROM:<${config.senderAddress}>`, [250, 251])
    await sendSmtpCommand(conn, `RCPT TO:<${input.emailTo.trim().toLowerCase()}>`, [250, 251, 252])
    await sendSmtpCommand(conn, "DATA", [354])

    const payload = buildSmtpMessage(config, input)
    const data = `${buildSmtpDataPayload(payload)}\r\n.\r\n`
    await conn.write(new TextEncoder().encode(data))

    const response = await readSmtpResponse(conn)
    if (!response.code || ![250, 251].includes(response.code)) {
      throw new Error(`SMTP DATA retornou ${response.code}: ${response.message || "resposta invalida"}`)
    }

    return {
      provider: "smtp",
      providerMessageId: payload.match(/^Message-ID:\s*(<[^>]+>)/mi)?.[1] ?? crypto.randomUUID(),
    }
  } finally {
    try {
      await sendSmtpCommand(conn, "QUIT", [221])
    } catch {
      // ignore quit failures
    }

    conn.close()
  }
}

async function sendWithResend(
  config: EmailProviderRuntimeConfig,
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatSenderAddress(config),
      to: [input.emailTo],
      subject: input.subject,
      html: input.html ?? undefined,
      text: input.text ?? undefined,
      reply_to: config.replyTo ?? undefined,
      tags: Object.entries(input.metadata ?? {})
        .filter(([, value]) => value !== null && value !== undefined)
        .slice(0, 10)
        .map(([name, value]) => ({ name, value: String(value) })),
    }),
  })

  const data = await response.json().catch(() => null) as { id?: string; message?: string } | null
  if (!response.ok || !data?.id) {
    throw new Error(data?.message?.trim() || `Resend retornou ${response.status}`)
  }

  return {
    provider: "resend",
    providerMessageId: data.id,
  }
}

async function sendWithPostmark(
  config: EmailProviderRuntimeConfig,
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: formatSenderAddress(config),
      To: input.emailTo,
      Subject: input.subject,
      HtmlBody: input.html ?? undefined,
      TextBody: input.text ?? undefined,
      ReplyTo: config.replyTo ?? undefined,
      Metadata: Object.fromEntries(
        Object.entries(input.metadata ?? {})
          .filter(([, value]) => value !== null && value !== undefined)
          .slice(0, 16)
          .map(([key, value]) => [key, String(value)]),
      ),
    }),
  })

  const data = await response.json().catch(() => null) as {
    MessageID?: string
    Message?: string
    ErrorCode?: number
  } | null

  if (!response.ok || !data || data.ErrorCode) {
    throw new Error(data?.Message?.trim() || `Postmark retornou ${response.status}`)
  }

  return {
    provider: "postmark",
    providerMessageId: data.MessageID ?? crypto.randomUUID(),
  }
}

async function sendWithSendgrid(
  config: EmailProviderRuntimeConfig,
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const content = []
  if (input.text?.trim()) {
    content.push({ type: "text/plain", value: input.text })
  }
  if (input.html?.trim()) {
    content.push({ type: "text/html", value: input.html })
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: input.emailTo }],
          custom_args: Object.fromEntries(
            Object.entries(input.metadata ?? {})
              .filter(([, value]) => value !== null && value !== undefined)
              .slice(0, 16)
              .map(([key, value]) => [key, String(value)]),
          ),
        },
      ],
      from: {
        email: config.senderAddress,
        name: config.senderName ?? undefined,
      },
      reply_to: config.replyTo ? { email: config.replyTo } : undefined,
      subject: input.subject,
      content,
    }),
  })

  const errorText = await response.text().catch(() => "")
  if (!response.ok) {
    throw new Error(errorText.trim() || `SendGrid retornou ${response.status}`)
  }

  return {
    provider: "sendgrid",
    providerMessageId: response.headers.get("x-message-id")?.trim() || crypto.randomUUID(),
  }
}

function renderEmailLayout(input: EmailLayoutInput): EmailContent {
  const ctaUrl = normalizeUrl(input.ctaUrl)
  const greeting = input.greeting
    ? `<p style="margin:0 0 16px;color:#24324a;font-size:16px;line-height:1.7;">${escapeHtml(input.greeting)}</p>`
    : ""
  const bullets = input.bullets?.length
    ? `<div style="margin:24px 0;padding:18px 20px;border:1px solid #d9e8f0;border-radius:20px;background:#f7fbfd;">
        ${input.bullets
          .map(
            (bullet) =>
              `<p style="margin:0 0 10px;color:#24324a;font-size:15px;line-height:1.7;">- ${escapeHtml(bullet)}</p>`,
          )
          .join("")}
      </div>`
    : ""
  const cta =
    ctaUrl && input.ctaLabel
      ? `<div style="margin:28px 0 12px;">
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;border-radius:999px;background:#242742;color:#ffffff;text-decoration:none;padding:14px 26px;font-weight:700;font-size:15px;">
          ${escapeHtml(input.ctaLabel)}
        </a>
      </div>`
      : ""
  const footer =
    input.footer ??
    "Se precisares, responde a este email ou entra em contacto pelo painel da plataforma."

  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#dff2f8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#18202f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#dff2f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;border-collapse:separate;border-spacing:0;">
            <tr>
              <td style="padding:0 0 16px 0;text-align:left;">
                <div style="display:inline-block;border-radius:999px;background:#ffffff;padding:10px 16px;border:1px solid #d6e8f1;color:#5b6d84;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">
                  Mariana Explica
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #d6e8f1;border-radius:28px;padding:32px 28px;box-shadow:0 18px 45px rgba(36,39,66,0.08);">
                <p style="margin:0 0 12px;color:#5b6d84;font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
                <h1 style="margin:0;color:#242742;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;">${escapeHtml(input.title)}</h1>
                <div style="margin:24px 0 0;">
                  ${greeting}
                  <p style="margin:0;color:#24324a;font-size:16px;line-height:1.8;white-space:pre-line;">${escapeHtml(input.intro)}</p>
                  ${bullets}
                  ${cta}
                  <p style="margin:28px 0 0;color:#5b6d84;font-size:13px;line-height:1.7;white-space:pre-line;">${escapeHtml(footer)}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 10px 0;text-align:center;color:#5b6d84;font-size:12px;line-height:1.7;">
                Mariana Explica | Materiais claros para exames nacionais, compra simples e area do aluno organizada.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const textParts = [
    "Mariana Explica",
    input.eyebrow.toUpperCase(),
    input.title,
    input.greeting ?? "",
    input.intro,
    ...(input.bullets ?? []).map((bullet) => `- ${bullet}`),
    ctaUrl && input.ctaLabel ? `${input.ctaLabel}: ${ctaUrl}` : "",
    footer,
  ].filter(Boolean)

  return {
    subject: input.title,
    html,
    text: textParts.join("\n\n"),
  }
}

export function buildPurchaseConfirmedEmail(input: {
  fullName?: string | null
  productTitle: string
  productType?: "paid" | "free" | "hybrid" | "external_service" | null
  dashboardUrl?: string | null
}) {
  const isExternalService = input.productType === "external_service"
  const materialLabel = isExternalService ? "apoio" : "material"
  const content = renderEmailLayout({
    eyebrow: "Compra confirmada",
    title: "O teu acesso já está pronto!",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `O teu pagamento foi confirmado com sucesso e o ${materialLabel} "${input.productTitle}" ja esta disponivel na tua area do aluno.`,
    bullets: [
      "Os teus materiais ficam disponiveis no mesmo sitio, dentro da tua area do aluno.",
      "Se o acesso demorar a aparecer, basta atualizares a pagina.",
    ],
    ctaLabel: "Abrir area do aluno",
    ctaUrl: input.dashboardUrl ?? "/aluno/dashboard",
  })

  return {
    ...content,
    subject: "Pagamento confirmado | Mariana Explica",
  }
}

export function buildFreeProductClaimedEmail(input: {
  fullName?: string | null
  productTitle: string
  productType?: "paid" | "free" | "hybrid" | "external_service" | null
  dashboardUrl?: string | null
}) {
  const isExternalService = input.productType === "external_service"
  const materialLabel = isExternalService ? "apoio gratuito" : "material gratuito"
  const content = renderEmailLayout({
    eyebrow: "Acesso gratuito",
    title: "O teu material gratuito ja esta disponivel!",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `O teu acesso a "${input.productTitle}" ja esta ativo e podes comecar a estudar atraves da tua area do aluno.`,
    bullets: [
      `O ${materialLabel} ficou ligado ao teu perfil com sucesso.`,
      "Se houver downloads permitidos, eles aparecem dentro do material.",
    ],
    ctaLabel: "Aceder ao material",
    ctaUrl: input.dashboardUrl ?? "/aluno/cursos",
  })

  return {
    ...content,
    subject: "O teu material gratuito ja esta disponivel | Mariana Explica",
  }
}

export function buildSupportTicketCreatedEmail(input: {
  fullName?: string | null
  subject: string
  supportUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Suporte recebido",
    title: "Recebemos o teu pedido de suporte",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `O teu pedido "${input.subject}" foi registado com sucesso. Vamos acompanhar a partir da area de suporte.`,
    bullets: [
      "Podes consultar o historico completo dentro da plataforma.",
      "Quando houver resposta, vais receber notificacao no painel.",
    ],
    ctaLabel: "Abrir suporte",
    ctaUrl: input.supportUrl ?? "/aluno/suporte",
  })

  return {
    ...content,
    subject: "Pedido de suporte recebido | Mariana Explica",
  }
}

export function buildSupportTicketRepliedEmail(input: {
  fullName?: string | null
  subject: string
  messagePreview: string
  supportUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Atualizacao de suporte",
    title: "Ja tens uma nova resposta no suporte",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `O pedido "${input.subject}" recebeu uma nova resposta da equipa Mariana Explica.`,
    bullets: [input.messagePreview],
    ctaLabel: "Ver conversa no suporte",
    ctaUrl: input.supportUrl ?? "/aluno/suporte",
  })

  return {
    ...content,
    subject: "Nova resposta de suporte | Mariana Explica",
  }
}

export function buildManualNotificationEmail(input: {
  fullName?: string | null
  title: string
  message: string
  ctaUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Comunicacao Mariana Explica",
    title: input.title,
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: input.message,
    ctaLabel: input.ctaUrl ? "Abrir plataforma" : null,
    ctaUrl: input.ctaUrl ?? null,
  })

  return {
    ...content,
    subject: `${input.title} | Mariana Explica`,
  }
}

export function buildPublicFormSubmissionAdminEmail(input: {
  sourcePage: string
  formType: string
  fullName: string
  email: string
  subject: string
  message: string
  ctaUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Comunicacao Mariana Explica",
    title: "Novo formulario publico recebido",
    greeting: "Ola,",
    intro: "Chegou um novo formulario publico e o registo ja esta disponivel no painel admin.",
    bullets: [
      `Origem: ${input.sourcePage}`,
      `Tipo: ${input.formType}`,
      `Nome: ${input.fullName}`,
      `Email: ${input.email}`,
      `Assunto: ${input.subject}`,
      `Mensagem: ${input.message.slice(0, 900)}`,
    ],
    ctaLabel: "Abrir plataforma",
    ctaUrl: input.ctaUrl ?? "/admin/formularios",
  })

  return {
    ...content,
    subject: "Novo formulario publico recebido | Mariana Explica",
  }
}

export function buildPublicFormReplyEmail(input: {
  fullName?: string | null
  originalSubject: string
  message: string
  ctaUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Resposta da equipa Mariana Explica",
    title: "Respondemos ao teu formulario",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `Recebemos o teu contacto "${input.originalSubject}" e enviamos a nossa resposta abaixo.`,
    bullets: [input.message],
    ctaLabel: input.ctaUrl ? "Abrir plataforma" : null,
    ctaUrl: input.ctaUrl ?? null,
  })

  return {
    ...content,
    subject: `Resposta ao teu formulario | Mariana Explica`,
  }
}

export async function fetchEmailOperationalConfig(client: SupabaseClient) {
  const envConfig = readEmailRuntimeConfigFromEnvironment()

  const { data, error } = await client
    .from("site_config")
    .select("config_value")
    .eq("config_key", ADMIN_PENDING_INFO_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  const storedConfig = normalizeEmailOperationalConfig(data?.config_value ?? null)

  return {
    providerName: envConfig.providerName || storedConfig.providerName,
    senderName: envConfig.senderName || storedConfig.senderName,
    senderAddress: envConfig.senderAddress || storedConfig.senderAddress,
    replyTo: envConfig.replyTo || storedConfig.replyTo,
  }
}

export async function sendTransactionalEmail(
  config: EmailOperationalConfig,
  input: SendTransactionalEmailInput,
) {
  const runtimeConfig = resolveProviderRuntimeConfig(config)
  const normalizedInput = {
    ...input,
    emailTo: normalizeEmailAddress(input.emailTo),
    subject: input.subject.trim(),
    html: input.html?.trim() || null,
    text: input.text?.trim() || null,
  }

  if (!normalizedInput.subject) {
    throw new Error("Email sem assunto para envio transacional")
  }

  if (!normalizedInput.html && !normalizedInput.text) {
    throw new Error("Email sem payload renderizavel para envio transacional")
  }

  if (runtimeConfig.providerKey === "resend") {
    return await sendWithResend(runtimeConfig, normalizedInput)
  }

  if (runtimeConfig.providerKey === "postmark") {
    return await sendWithPostmark(runtimeConfig, normalizedInput)
  }

  if (runtimeConfig.providerKey === "smtp") {
    return await sendWithSmtp(runtimeConfig, normalizedInput)
  }

  return await sendWithSendgrid(runtimeConfig, normalizedInput)
}

export async function queueEmailDelivery(client: SupabaseClient, input: EmailQueueInput) {
  const { error } = await client.from("email_deliveries").insert({
    user_id: input.userId ?? null,
    notification_id: input.notificationId ?? null,
    email_to: input.emailTo.trim().toLowerCase(),
    template_key: input.templateKey,
    provider: "internal-template",
    status: "queued",
    subject: input.subject,
    html_content: input.html,
    text_content: input.text,
    metadata: input.metadata ?? {},
  })

  if (error) {
    throw error
  }
}
