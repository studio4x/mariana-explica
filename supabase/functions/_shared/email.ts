import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { getAppBaseUrl } from "./supabase.ts"

export type PlatformTemplateKey =
  | "purchase_confirmed"
  | "free_product_claimed"
  | "support_ticket_created"
  | "support_ticket_replied"
  | "manual_notification"
  | "public_form_submission_admin"
  | "public_form_reply"

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

export interface PlatformEmailTemplateContent {
  subject: string
  eyebrow: string
  title: string
  greeting: string
  intro: string
  bullets: string[]
  ctaLabel: string
  ctaUrl: string
  footer: string
}

interface PlatformEmailTemplateDefinition {
  key: PlatformTemplateKey
  label: string
  description: string
  category: string
  availableVariables: string[]
  defaultContent: PlatformEmailTemplateContent
  sampleData: Record<string, string>
}

export interface PlatformEmailTemplateSummary {
  key: PlatformTemplateKey
  label: string
  description: string
  category: string
  availableVariables: string[]
  sampleData: Record<string, string>
  content: PlatformEmailTemplateContent
  isCustomized: boolean
}

export interface PlatformEmailTemplatesConfig {
  config_key: string
  description: string | null
  is_public: boolean
  updated_at: string | null
  templates: PlatformEmailTemplateSummary[]
}

export interface PlatformEmailTemplatePreview {
  templateKey: PlatformTemplateKey
  subject: string
  html: string
  text: string
  sampleData: Record<string, string>
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
const PLATFORM_EMAIL_TEMPLATES_KEY = "platform_email_templates"
const PLATFORM_EMAIL_TEMPLATES_DESCRIPTION =
  "Conteudo editavel dos emails transacionais da plataforma, excluindo emails geridos pelo Supabase Auth."

const PLATFORM_EMAIL_TEMPLATE_DEFINITIONS: PlatformEmailTemplateDefinition[] = [
  {
    key: "purchase_confirmed",
    label: "Compra confirmada",
    description: "Enviado quando um pagamento e confirmado e o acesso ao material fica disponivel.",
    category: "Comercial",
    availableVariables: ["greeting_name", "material_label", "product_title", "dashboard_url"],
    defaultContent: {
      subject: "Pagamento confirmado | Mariana Explica",
      eyebrow: "Compra confirmada",
      title: "O teu acesso ja esta pronto!",
      greeting: "Ola{{greeting_name}}.",
      intro:
        'O teu pagamento foi confirmado com sucesso e o {{material_label}} "{{product_title}}" ja esta disponivel na tua area do aluno.',
      bullets: [
        "Os teus materiais ficam disponiveis no mesmo sitio, dentro da tua area do aluno.",
        "Se o acesso demorar a aparecer, basta atualizares a pagina.",
      ],
      ctaLabel: "Abrir area do aluno",
      ctaUrl: "{{dashboard_url}}",
      footer: "Se precisares, responde a este email ou fala connosco pela area de suporte.",
    },
    sampleData: {
      greeting_name: ", Mariana",
      material_label: "material",
      product_title: "Pack Exame Nacional de Filosofia",
      dashboard_url: "/aluno/dashboard",
    },
  },
  {
    key: "free_product_claimed",
    label: "Acesso gratuito",
    description: "Enviado quando um material gratuito e associado ao perfil do aluno.",
    category: "Comercial",
    availableVariables: ["greeting_name", "material_label", "product_title", "dashboard_url"],
    defaultContent: {
      subject: "O teu material gratuito ja esta disponivel | Mariana Explica",
      eyebrow: "Acesso gratuito",
      title: "O teu material gratuito ja esta disponivel!",
      greeting: "Ola{{greeting_name}}.",
      intro:
        'O teu acesso a "{{product_title}}" ja esta ativo e podes comecar a estudar atraves da tua area do aluno.',
      bullets: [
        "O {{material_label}} ficou ligado ao teu perfil com sucesso.",
        "Se houver downloads permitidos, eles aparecem dentro do material.",
      ],
      ctaLabel: "Aceder ao material",
      ctaUrl: "{{dashboard_url}}",
      footer: "Guarda este email se quiseres ter uma referencia rapida para o teu acesso.",
    },
    sampleData: {
      greeting_name: ", Mariana",
      material_label: "material gratuito",
      product_title: "Guia de estudo gratis",
      dashboard_url: "/aluno/cursos",
    },
  },
  {
    key: "support_ticket_created",
    label: "Ticket criado",
    description: "Enviado ao aluno quando um novo ticket de suporte e registado.",
    category: "Suporte",
    availableVariables: ["greeting_name", "ticket_subject", "support_url"],
    defaultContent: {
      subject: "Pedido de suporte recebido | Mariana Explica",
      eyebrow: "Suporte recebido",
      title: "Recebemos o teu pedido de suporte",
      greeting: "Ola{{greeting_name}}.",
      intro:
        'O teu pedido "{{ticket_subject}}" foi registado com sucesso. Vamos acompanhar a partir da area de suporte.',
      bullets: [
        "Podes consultar o historico completo dentro da plataforma.",
        "Quando houver resposta, vais receber notificacao no painel.",
      ],
      ctaLabel: "Abrir suporte",
      ctaUrl: "{{support_url}}",
      footer: "Mantem este email como referencia do teu pedido, se te der jeito.",
    },
    sampleData: {
      greeting_name: ", Mariana",
      ticket_subject: "Nao consigo abrir o material",
      support_url: "/aluno/suporte/ticket-exemplo",
    },
  },
  {
    key: "support_ticket_replied",
    label: "Resposta no ticket",
    description: "Enviado ao aluno quando a equipa responde ou encerra um ticket de suporte.",
    category: "Suporte",
    availableVariables: ["greeting_name", "ticket_subject", "message_preview", "support_url"],
    defaultContent: {
      subject: "Nova resposta de suporte | Mariana Explica",
      eyebrow: "Atualizacao de suporte",
      title: "Ja tens uma nova resposta no suporte",
      greeting: "Ola{{greeting_name}}.",
      intro: 'O pedido "{{ticket_subject}}" recebeu uma nova resposta da equipa Mariana Explica.',
      bullets: ["{{message_preview}}"],
      ctaLabel: "Ver conversa no suporte",
      ctaUrl: "{{support_url}}",
      footer: "Se ainda precisares de ajuda, responde diretamente no ticket para manter o historico organizado.",
    },
    sampleData: {
      greeting_name: ", Mariana",
      ticket_subject: "Nao consigo abrir o material",
      message_preview: "Ja validamos o teu acesso e deixamos um passo a passo no ticket.",
      support_url: "/aluno/suporte/ticket-exemplo",
    },
  },
  {
    key: "manual_notification",
    label: "Notificacao manual",
    description: "Usado em comunicacoes manuais enviadas pelo admin para usuarios da plataforma.",
    category: "Comunicacao",
    availableVariables: ["greeting_name", "notification_title", "notification_message", "cta_label", "cta_url"],
    defaultContent: {
      subject: "{{notification_title}} | Mariana Explica",
      eyebrow: "Comunicacao Mariana Explica",
      title: "{{notification_title}}",
      greeting: "Ola{{greeting_name}}.",
      intro: "{{notification_message}}",
      bullets: [],
      ctaLabel: "{{cta_label}}",
      ctaUrl: "{{cta_url}}",
      footer: "Se precisares, responde a este email ou entra em contacto pelo painel da plataforma.",
    },
    sampleData: {
      greeting_name: ", Mariana",
      notification_title: "Nova data de sessao em direto",
      notification_message: "Abrimos uma nova sessao de apoio para o teu grupo. Entra na plataforma para ver os detalhes.",
      cta_label: "Abrir plataforma",
      cta_url: "/aluno/notificacoes",
    },
  },
  {
    key: "public_form_submission_admin",
    label: "Alerta de formulario publico",
    description: "Enviado ao endereco operacional quando um formulario publico chega pelo site.",
    category: "Formularios",
    availableVariables: ["source_page", "form_type", "full_name", "email", "message_subject", "message_body", "cta_url"],
    defaultContent: {
      subject: "Novo formulario publico recebido | Mariana Explica",
      eyebrow: "Comunicacao Mariana Explica",
      title: "Novo formulario publico recebido",
      greeting: "Ola,",
      intro: "Chegou um novo formulario publico e o registo ja esta disponivel no painel admin.",
      bullets: [
        "Origem: {{source_page}}",
        "Tipo: {{form_type}}",
        "Nome: {{full_name}}",
        "Email: {{email}}",
        "Assunto: {{message_subject}}",
        "Mensagem: {{message_body}}",
      ],
      ctaLabel: "Abrir plataforma",
      ctaUrl: "{{cta_url}}",
      footer: "Este email e apenas operacional e serve para acelerar o acompanhamento do formulario.",
    },
    sampleData: {
      source_page: "/explicacoes",
      form_type: "explicacoes",
      full_name: "Mariana Silva",
      email: "mariana@example.com",
      message_subject: "Preciso de apoio para o exame",
      message_body: "Gostava de saber qual e o material mais indicado para a minha situacao.",
      cta_url: "/admin/formularios",
    },
  },
  {
    key: "public_form_reply",
    label: "Resposta a formulario",
    description: "Enviado quando o admin responde a um formulario recebido pelo site.",
    category: "Formularios",
    availableVariables: ["greeting_name", "original_subject", "reply_message", "cta_label", "cta_url"],
    defaultContent: {
      subject: "Resposta ao teu formulario | Mariana Explica",
      eyebrow: "Resposta da equipa Mariana Explica",
      title: "Respondemos ao teu formulario",
      greeting: "Ola{{greeting_name}}.",
      intro: 'Recebemos o teu contacto "{{original_subject}}" e enviamos a nossa resposta abaixo.',
      bullets: ["{{reply_message}}"],
      ctaLabel: "{{cta_label}}",
      ctaUrl: "{{cta_url}}",
      footer: "Se precisares de contexto adicional, responde ao email ou volta a submeter o formulario com mais detalhe.",
    },
    sampleData: {
      greeting_name: ", Mariana",
      original_subject: "Preciso de apoio para o exame",
      reply_message: "Recomendamos comecares pelo material base e, se quiseres, podemos ajudar-te a escolher o proximo passo.",
      cta_label: "Abrir explicacoes",
      cta_url: "/explicacoes",
    },
  },
]

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

function getPlatformEmailTemplateDefinition(templateKey: PlatformTemplateKey) {
  const definition = PLATFORM_EMAIL_TEMPLATE_DEFINITIONS.find((item) => item.key === templateKey)
  if (!definition) {
    throw new Error(`Template de email nao suportado: ${templateKey}`)
  }

  return definition
}

function normalizePlatformTemplateText(value: unknown, fallback: string) {
  if (value === null || value === undefined) {
    return fallback
  }

  return String(value)
}

function normalizePlatformTemplateBullets(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  return value.map((item) => String(item ?? "")).slice(0, 12)
}

function normalizePlatformEmailTemplateContent(
  value: unknown,
  fallback: PlatformEmailTemplateContent,
): PlatformEmailTemplateContent {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}

  return {
    subject: normalizePlatformTemplateText(input.subject, fallback.subject),
    eyebrow: normalizePlatformTemplateText(input.eyebrow, fallback.eyebrow),
    title: normalizePlatformTemplateText(input.title, fallback.title),
    greeting: normalizePlatformTemplateText(input.greeting, fallback.greeting),
    intro: normalizePlatformTemplateText(input.intro, fallback.intro),
    bullets: normalizePlatformTemplateBullets(input.bullets, fallback.bullets),
    ctaLabel: normalizePlatformTemplateText(input.ctaLabel, fallback.ctaLabel),
    ctaUrl: normalizePlatformTemplateText(input.ctaUrl, fallback.ctaUrl),
    footer: normalizePlatformTemplateText(input.footer, fallback.footer),
  }
}

function normalizePlatformEmailTemplateOverrides(value: unknown) {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
  const templatesValue =
    input.templates && typeof input.templates === "object" && !Array.isArray(input.templates)
      ? input.templates as Record<string, unknown>
      : {}

  const overrides: Partial<Record<PlatformTemplateKey, PlatformEmailTemplateContent>> = {}

  for (const definition of PLATFORM_EMAIL_TEMPLATE_DEFINITIONS) {
    const candidate = templatesValue[definition.key]
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue
    }

    overrides[definition.key] = normalizePlatformEmailTemplateContent(candidate, definition.defaultContent)
  }

  return overrides
}

async function readPlatformEmailTemplatesRow(client: SupabaseClient) {
  const { data, error } = await client
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", PLATFORM_EMAIL_TEMPLATES_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

function applyTemplateVariables(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token) => variables[token] ?? "")
}

function renderPlatformTemplateContent(
  content: PlatformEmailTemplateContent,
  variables: Record<string, string>,
): PlatformEmailTemplateContent {
  return {
    subject: applyTemplateVariables(content.subject, variables).trim(),
    eyebrow: applyTemplateVariables(content.eyebrow, variables).trim(),
    title: applyTemplateVariables(content.title, variables).trim(),
    greeting: applyTemplateVariables(content.greeting, variables).trim(),
    intro: applyTemplateVariables(content.intro, variables).trim(),
    bullets: content.bullets.map((bullet) => applyTemplateVariables(bullet, variables).trim()).filter(Boolean),
    ctaLabel: applyTemplateVariables(content.ctaLabel, variables).trim(),
    ctaUrl: applyTemplateVariables(content.ctaUrl, variables).trim(),
    footer: applyTemplateVariables(content.footer, variables).trim(),
  }
}

function buildEmailContentFromPlatformTemplate(
  content: PlatformEmailTemplateContent,
  variables: Record<string, string>,
): EmailContent {
  const rendered = renderPlatformTemplateContent(content, variables)
  const email = renderEmailLayout({
    eyebrow: rendered.eyebrow,
    title: rendered.title,
    greeting: rendered.greeting,
    intro: rendered.intro,
    bullets: rendered.bullets,
    ctaLabel: rendered.ctaLabel || null,
    ctaUrl: rendered.ctaUrl || null,
    footer: rendered.footer || null,
  })

  return {
    subject: rendered.subject || email.subject,
    html: email.html,
    text: email.text,
  }
}

function buildPlatformEmailTemplateSummary(
  definition: PlatformEmailTemplateDefinition,
  overrides: Partial<Record<PlatformTemplateKey, PlatformEmailTemplateContent>>,
): PlatformEmailTemplateSummary {
  const override = overrides[definition.key]

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    category: definition.category,
    availableVariables: definition.availableVariables,
    sampleData: definition.sampleData,
    content: override ? normalizePlatformEmailTemplateContent(override, definition.defaultContent) : definition.defaultContent,
    isCustomized: Boolean(override),
  }
}

function buildPlatformEmailTemplatesPayload(
  overrides: Partial<Record<PlatformTemplateKey, PlatformEmailTemplateContent>>,
) {
  return {
    version: 1,
    templates: overrides,
  }
}

export async function fetchPlatformEmailTemplatesConfig(
  client: SupabaseClient,
): Promise<PlatformEmailTemplatesConfig> {
  const row = await readPlatformEmailTemplatesRow(client)
  const overrides = normalizePlatformEmailTemplateOverrides(row?.config_value ?? null)

  return {
    config_key: row?.config_key ?? PLATFORM_EMAIL_TEMPLATES_KEY,
    description: row?.description ?? PLATFORM_EMAIL_TEMPLATES_DESCRIPTION,
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
    templates: PLATFORM_EMAIL_TEMPLATE_DEFINITIONS.map((definition) =>
      buildPlatformEmailTemplateSummary(definition, overrides)
    ),
  }
}

async function upsertPlatformEmailTemplatesConfig(
  client: SupabaseClient,
  overrides: Partial<Record<PlatformTemplateKey, PlatformEmailTemplateContent>>,
) {
  const siteConfigTable = client.from("site_config") as unknown as {
    upsert: (...args: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: {
            config_key: string
            description: string | null
            is_public: boolean
            updated_at: string | null
          } | null
          error: Error | null
        }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: PLATFORM_EMAIL_TEMPLATES_KEY,
        config_value: buildPlatformEmailTemplatesPayload(overrides),
        description: PLATFORM_EMAIL_TEMPLATES_DESCRIPTION,
        is_public: false,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function savePlatformEmailTemplate(
  client: SupabaseClient,
  templateKey: PlatformTemplateKey,
  content: PlatformEmailTemplateContent,
) {
  const row = await readPlatformEmailTemplatesRow(client)
  const overrides = normalizePlatformEmailTemplateOverrides(row?.config_value ?? null)
  const definition = getPlatformEmailTemplateDefinition(templateKey)
  overrides[templateKey] = normalizePlatformEmailTemplateContent(content, definition.defaultContent)
  await upsertPlatformEmailTemplatesConfig(client, overrides)

  const config = await fetchPlatformEmailTemplatesConfig(client)
  const template = config.templates.find((item) => item.key === templateKey)
  if (!template) {
    throw new Error("Template atualizado nao encontrado")
  }

  return {
    config,
    template,
  }
}

export async function resetPlatformEmailTemplate(client: SupabaseClient, templateKey: PlatformTemplateKey) {
  const row = await readPlatformEmailTemplatesRow(client)
  const overrides = normalizePlatformEmailTemplateOverrides(row?.config_value ?? null)
  delete overrides[templateKey]
  await upsertPlatformEmailTemplatesConfig(client, overrides)

  const config = await fetchPlatformEmailTemplatesConfig(client)
  const template = config.templates.find((item) => item.key === templateKey)
  if (!template) {
    throw new Error("Template reposto nao encontrado")
  }

  return {
    config,
    template,
  }
}

export async function previewPlatformEmailTemplate(
  client: SupabaseClient,
  templateKey: PlatformTemplateKey,
  contentOverride?: PlatformEmailTemplateContent,
): Promise<PlatformEmailTemplatePreview> {
  const definition = getPlatformEmailTemplateDefinition(templateKey)
  const config = await fetchPlatformEmailTemplatesConfig(client)
  const storedTemplate = config.templates.find((item) => item.key === templateKey)
  const mergedContent = contentOverride
    ? normalizePlatformEmailTemplateContent(contentOverride, definition.defaultContent)
    : storedTemplate?.content ?? definition.defaultContent
  const preview = buildEmailContentFromPlatformTemplate(mergedContent, definition.sampleData)

  return {
    templateKey,
    subject: preview.subject,
    html: preview.html,
    text: preview.text,
    sampleData: definition.sampleData,
  }
}

async function buildPlatformManagedEmail(
  client: SupabaseClient,
  templateKey: PlatformTemplateKey,
  variables: Record<string, string>,
) {
  const config = await fetchPlatformEmailTemplatesConfig(client)
  const template = config.templates.find((item) => item.key === templateKey)

  if (!template) {
    throw new Error(`Template de email nao encontrado: ${templateKey}`)
  }

  return buildEmailContentFromPlatformTemplate(template.content, variables)
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

export async function buildPurchaseConfirmedEmail(client: SupabaseClient, input: {
  fullName?: string | null
  productTitle: string
  productType?: "paid" | "free" | "hybrid" | "external_service" | null
  dashboardUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "purchase_confirmed", {
    greeting_name: input.fullName ? `, ${input.fullName}` : "",
    material_label: input.productType === "external_service" ? "apoio" : "material",
    product_title: input.productTitle,
    dashboard_url: input.dashboardUrl ?? "/aluno/dashboard",
  })
}

export async function buildFreeProductClaimedEmail(client: SupabaseClient, input: {
  fullName?: string | null
  productTitle: string
  productType?: "paid" | "free" | "hybrid" | "external_service" | null
  dashboardUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "free_product_claimed", {
    greeting_name: input.fullName ? `, ${input.fullName}` : "",
    material_label: input.productType === "external_service" ? "apoio gratuito" : "material gratuito",
    product_title: input.productTitle,
    dashboard_url: input.dashboardUrl ?? "/aluno/cursos",
  })
}

export async function buildSupportTicketCreatedEmail(client: SupabaseClient, input: {
  fullName?: string | null
  subject: string
  supportUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "support_ticket_created", {
    greeting_name: input.fullName ? `, ${input.fullName}` : "",
    ticket_subject: input.subject,
    support_url: input.supportUrl ?? "/aluno/suporte",
  })
}

export async function buildSupportTicketRepliedEmail(client: SupabaseClient, input: {
  fullName?: string | null
  subject: string
  messagePreview: string
  supportUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "support_ticket_replied", {
    greeting_name: input.fullName ? `, ${input.fullName}` : "",
    ticket_subject: input.subject,
    message_preview: input.messagePreview,
    support_url: input.supportUrl ?? "/aluno/suporte",
  })
}

export async function buildManualNotificationEmail(client: SupabaseClient, input: {
  fullName?: string | null
  title: string
  message: string
  ctaUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "manual_notification", {
    greeting_name: input.fullName ? `, ${input.fullName}` : "",
    notification_title: input.title,
    notification_message: input.message,
    cta_label: input.ctaUrl ? "Abrir plataforma" : "",
    cta_url: input.ctaUrl ?? "",
  })
}

export async function buildPublicFormSubmissionAdminEmail(client: SupabaseClient, input: {
  sourcePage: string
  formType: string
  fullName: string
  email: string
  subject: string
  message: string
  ctaUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "public_form_submission_admin", {
    source_page: input.sourcePage,
    form_type: input.formType,
    full_name: input.fullName,
    email: input.email,
    message_subject: input.subject,
    message_body: input.message.slice(0, 900),
    cta_url: input.ctaUrl ?? "/admin/formularios",
  })
}

export async function buildPublicFormReplyEmail(client: SupabaseClient, input: {
  fullName?: string | null
  originalSubject: string
  message: string
  ctaUrl?: string | null
}) {
  return await buildPlatformManagedEmail(client, "public_form_reply", {
    greeting_name: input.fullName ? `, ${input.fullName}` : "",
    original_subject: input.originalSubject,
    reply_message: input.message,
    cta_label: input.ctaUrl ? "Abrir explicacoes" : "",
    cta_url: input.ctaUrl ?? "",
  })
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
