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
