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

interface EmailProviderRuntimeConfig extends EmailOperationalConfig {
  providerKey: "resend" | "postmark" | "sendgrid"
  apiKey: string
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

function resolveProviderRuntimeConfig(config: EmailOperationalConfig): EmailProviderRuntimeConfig {
  const configuredProvider = normalizeProviderName(
    Deno.env.get("EMAIL_PROVIDER") ||
      Deno.env.get("EMAIL_PROVIDER_NAME") ||
      config.providerName ||
      Deno.env.get("RESEND_API_KEY") && "resend" ||
      Deno.env.get("POSTMARK_SERVER_TOKEN") && "postmark" ||
      Deno.env.get("SENDGRID_API_KEY") && "sendgrid" ||
      "",
  )

  const senderAddress =
    Deno.env.get("EMAIL_FROM_EMAIL")?.trim() ||
    Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ||
    config.senderAddress
  const senderName = Deno.env.get("EMAIL_FROM_NAME")?.trim() || config.senderName
  const replyTo = Deno.env.get("EMAIL_REPLY_TO")?.trim() || config.replyTo

  if (!configuredProvider) {
    throw new Error("EMAIL_PROVIDER nao configurado para envio transacional")
  }

  const providerKey = configuredProvider.includes("postmark")
    ? "postmark"
    : configuredProvider.includes("sendgrid")
      ? "sendgrid"
      : configuredProvider.includes("resend")
        ? "resend"
        : null

  if (!providerKey) {
    throw new Error(`Provedor de email nao suportado: ${configuredProvider}`)
  }

  const apiKey =
    providerKey === "resend"
      ? Deno.env.get("EMAIL_PROVIDER_API_KEY")?.trim() || Deno.env.get("RESEND_API_KEY")?.trim()
      : providerKey === "postmark"
        ? Deno.env.get("EMAIL_PROVIDER_API_KEY")?.trim() || Deno.env.get("POSTMARK_SERVER_TOKEN")?.trim()
        : Deno.env.get("EMAIL_PROVIDER_API_KEY")?.trim() || Deno.env.get("SENDGRID_API_KEY")?.trim()

  if (!apiKey) {
    throw new Error(`${providerKey.toUpperCase()} API key nao configurada`)
  }

  if (!senderAddress) {
    throw new Error("EMAIL_FROM_EMAIL nao configurado para envio transacional")
  }

  return {
    providerKey,
    providerName: configuredProvider,
    apiKey,
    senderName,
    senderAddress,
    replyTo,
  }
}

function formatSenderAddress(config: EmailProviderRuntimeConfig) {
  return config.senderName ? `${config.senderName} <${config.senderAddress}>` : config.senderAddress
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
                  <p style="margin:0;color:#24324a;font-size:16px;line-height:1.8;">${escapeHtml(input.intro)}</p>
                  ${bullets}
                  ${cta}
                  <p style="margin:28px 0 0;color:#5b6d84;font-size:13px;line-height:1.7;">${escapeHtml(footer)}</p>
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
  dashboardUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Compra confirmada",
    title: "Pagamento confirmado e acesso liberado",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `O teu pagamento foi confirmado com sucesso e o produto "${input.productTitle}" ja esta disponivel na tua area do aluno.`,
    bullets: [
      "O acesso foi validado no backend e o grant ja esta ativo.",
      "Os teus materiais protegidos ficam disponiveis no dashboard.",
    ],
    ctaLabel: "Abrir dashboard",
    ctaUrl: input.dashboardUrl ?? "/dashboard",
  })

  return {
    ...content,
    subject: "Pagamento confirmado | Mariana Explica",
  }
}

export function buildFreeProductClaimedEmail(input: {
  fullName?: string | null
  productTitle: string
  dashboardUrl?: string | null
}) {
  const content = renderEmailLayout({
    eyebrow: "Acesso gratuito",
    title: "Produto gratuito ativado com sucesso",
    greeting: input.fullName ? `Ola, ${input.fullName}.` : "Ola,",
    intro: `O produto "${input.productTitle}" foi ativado na tua conta e ja pode ser consultado no dashboard.`,
    bullets: [
      "O acesso ficou ligado ao teu perfil.",
      "Se houver downloads permitidos, eles aparecem dentro do produto.",
    ],
    ctaLabel: "Ver produto no dashboard",
    ctaUrl: input.dashboardUrl ?? "/dashboard/produtos",
  })

  return {
    ...content,
    subject: "Produto gratuito ativado | Mariana Explica",
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
    ctaUrl: input.supportUrl ?? "/dashboard/suporte",
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
    ctaUrl: input.supportUrl ?? "/dashboard/suporte",
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

export async function fetchEmailOperationalConfig(client: SupabaseClient) {
  const { data, error } = await client
    .from("site_config")
    .select("config_value")
    .eq("config_key", ADMIN_PENDING_INFO_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeEmailOperationalConfig(data?.config_value ?? null)
}

export async function sendTransactionalEmail(
  config: EmailOperationalConfig,
  input: SendTransactionalEmailInput,
) {
  const runtimeConfig = resolveProviderRuntimeConfig(config)
  const normalizedInput = {
    ...input,
    emailTo: input.emailTo.trim().toLowerCase(),
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
