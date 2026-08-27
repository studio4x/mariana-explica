import { sanitizeRichTextHtml } from "./rich-text.ts"

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export interface EmailLayoutInput {
  headerLogoUrl?: string | null
  appBaseUrl?: string | null
  eyebrow: string
  title: string
  greeting?: string | null
  intro: string
  introHtml?: string | null
  introText?: string | null
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

function styleEmailRichText(html: string) {
  return sanitizeRichTextHtml(html)
    .replace(/<a\b([^>]*)>/gi, '<a$1 style="color:#204b8f;text-decoration:underline;">')
    .replace(/<p>/gi, '<p style="Margin:0 0 18px;font-size:17px;line-height:1.8;color:#43546a;">')
    .replace(/<blockquote>/gi, '<blockquote style="Margin:0 0 18px;padding:0 0 0 16px;border-left:4px solid #d9e8f0;color:#5b6d84;">')
    .replace(/<h1>/gi, '<h1 style="Margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.2;color:#242742;">')
    .replace(/<h2>/gi, '<h2 style="Margin:0 0 18px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#242742;">')
    .replace(/<h3>/gi, '<h3 style="Margin:0 0 16px;font-family:Georgia,serif;font-size:22px;line-height:1.3;color:#242742;">')
    .replace(/<h4>/gi, '<h4 style="Margin:0 0 14px;font-family:Arial,sans-serif;font-size:18px;line-height:1.4;color:#242742;">')
    .replace(/<ul>/gi, '<ul style="Margin:0 0 18px;padding-left:22px;color:#43546a;">')
    .replace(/<ol>/gi, '<ol style="Margin:0 0 18px;padding-left:22px;color:#43546a;">')
    .replace(/<li>/gi, '<li style="Margin:0 0 12px;font-size:17px;line-height:1.8;color:#43546a;">')
}

function normalizeUrl(url?: string | null, appBaseUrl?: string | null) {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) return url

  const baseUrl = (appBaseUrl?.trim() || "https://www.mariana-explica.pt").replace(/\/$/, "")
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`
}

export function renderPlatformEmailLayout(input: EmailLayoutInput): EmailContent {
  const ctaUrl = normalizeUrl(input.ctaUrl, input.appBaseUrl)
  const ctaVmlWidth = input.ctaLabel
    ? Math.min(420, Math.max(180, input.ctaLabel.trim().length * 9 + 64))
    : 180
  const headerLogo = input.headerLogoUrl?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td bgcolor="#ffffff" style="padding:14px 18px;background-color:#ffffff;"><img src="${escapeHtml(input.headerLogoUrl)}" alt="Mariana Explica" width="280" style="display:block;width:280px;max-width:280px;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>
      </table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td bgcolor="#ffffff" style="padding:12px 22px;background-color:#ffffff;color:#5b6d84;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;font-family:Arial,sans-serif;">Mariana Explica</td></tr>
      </table>`
  const greeting = input.greeting
    ? `<p style="Margin:0 0 18px;font-size:17px;line-height:1.8;color:#43546a;">${escapeHtml(input.greeting)}</p>`
    : ""
  const introHtml = input.introHtml?.trim()
    ? styleEmailRichText(input.introHtml)
    : `<p style="Margin:0 0 18px;font-size:17px;line-height:1.8;color:#43546a;white-space:pre-line;">${escapeHtml(input.intro)}</p>`
  const bullets = input.bullets?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 18px;border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td style="padding:20px 22px;border:1px solid #d9e8f0;background-color:#f7fbfd;">${input.bullets.map((bullet) => `<p style="Margin:0 0 12px;font-size:16px;line-height:1.8;color:#43546a;">- ${escapeHtml(bullet)}</p>`).join("")}</td></tr></table>`
    : ""
  const cta = ctaUrl && input.ctaLabel
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td align="left">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(ctaUrl)}" style="height:52px;v-text-anchor:middle;width:${ctaVmlWidth}px;" arcsize="12%" stroked="f" fillcolor="#242742"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;">${escapeHtml(input.ctaLabel)}</center></v:roundrect><![endif]-->
          <!--[if !mso]><!--><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background-color:#242742;border:1px solid #242742;border-radius:8px;padding:16px 30px;color:#ffffff;font-size:16px;font-weight:700;line-height:20px;text-decoration:none;font-family:Arial,sans-serif;">${escapeHtml(input.ctaLabel)}</a><!--<![endif]-->
        </td></tr>
      </table>`
    : ""
  const footer = input.footer ?? "Se precisares, responde a este email ou entra em contacto pelo painel da plataforma."

  const html = `<!doctype html>
<html lang="pt">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
  <body style="margin:0;padding:0;background-color:#dff2f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#dff2f8" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#dff2f8;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr><td align="left">${headerLogo}</td></tr>
          <tr><td style="padding-top:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#ffffff;">
              <tr><td style="padding:40px 32px;font-family:Arial,sans-serif;color:#24324a;">
                <p style="Margin:0 0 16px;color:#5b6d84;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;font-family:Arial,sans-serif;">${escapeHtml(input.eyebrow)}</p>
                <h1 style="Margin:0 0 20px;font-family:Georgia,serif;font-size:44px;line-height:1.08;color:#242742;">${escapeHtml(input.title)}</h1>
                ${greeting}${introHtml}${bullets}${cta}
                <p style="Margin:18px 0 0;font-size:15px;line-height:1.8;color:#6b7c8f;white-space:pre-line;font-family:Arial,sans-serif;">${escapeHtml(footer)}</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const textParts = [
    "Mariana Explica",
    input.eyebrow.toUpperCase(),
    input.title,
    input.greeting ?? "",
    input.introText ?? input.intro,
    ...(input.bullets ?? []).map((bullet) => `- ${bullet}`),
    ctaUrl && input.ctaLabel ? `${input.ctaLabel}: ${ctaUrl}` : "",
    footer,
  ].filter(Boolean)

  return { subject: input.title, html, text: textParts.join("\n\n") }
}
