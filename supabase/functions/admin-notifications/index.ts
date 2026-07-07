import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { badRequest, notFound } from "../_shared/errors.ts"
import {
  buildManualNotificationEmail,
  corsResponse,
  errorResponse,
  extractRequestAuditContext,
  getRequestId,
  jsonResponse,
  queueEmailDelivery,
  readJsonBody,
  requireAdmin,
  richTextToPlainText,
  sanitizeRichTextHtml,
  writeAuditLog,
} from "../_shared/mod.ts"
import { logError } from "../_shared/logger.ts"

type CampaignAction = "preview" | "send" | "list_campaigns"
type Audience = "single" | "segment" | "all"
type LegacyAudience = "single" | "role" | "all"
type NotificationType = "transactional" | "informational" | "marketing" | "support"
type UserRole = "student" | "affiliate" | "admin"
type UserStatus = "active" | "inactive" | "blocked" | "pending_review"
type PurchaseBasis = "active_grants"

interface AdminNotificationCampaignInput {
  action?: CampaignAction
  audience: Audience | LegacyAudience
  userId?: string
  role?: UserRole
  status?: UserStatus
  productCategoryId?: string | null
  productId?: string | null
  purchaseBasis?: PurchaseBasis
  type: NotificationType
  title: string
  emailSubject?: string | null
  messageHtml?: string
  message?: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  link?: string | null
  sentViaEmail?: boolean
  sentViaInApp?: boolean
}

interface CampaignRecipient {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  status: UserStatus
}

interface CampaignProduct {
  id: string
  title: string
  category_id: string | null
}

interface CampaignCategory {
  id: string
  title: string
}

interface CampaignResolution {
  recipients: CampaignRecipient[]
  product: CampaignProduct | null
  category: CampaignCategory | null
}

interface AuditCampaignSummary {
  audience: Audience
  user_id: string | null
  purchase_basis: PurchaseBasis
  role: UserRole | null
  status: UserStatus | null
  type: NotificationType
  title: string
  email_subject: string | null
  message_excerpt: string | null
  message_html: string | null
  product_id: string | null
  product_title: string | null
  product_category_id: string | null
  product_category_title: string | null
  cta_label: string | null
  cta_url: string | null
  sent_via_email: boolean
  sent_via_in_app: boolean
  can_reuse: boolean
  recipient_count: number
  email_recipient_count: number
  notification_count: number
}

const PREVIEW_SAMPLE_SIZE = 5
const HISTORY_LIMIT = 25

function isNotificationType(value: unknown): value is NotificationType {
  return ["transactional", "informational", "marketing", "support"].includes(String(value ?? ""))
}

function isAudience(value: unknown): value is Audience | LegacyAudience {
  return ["single", "segment", "role", "all"].includes(String(value ?? ""))
}

function isUserRole(value: unknown): value is UserRole {
  return ["student", "affiliate", "admin"].includes(String(value ?? ""))
}

function isUserStatus(value: unknown): value is UserStatus {
  return ["active", "inactive", "blocked", "pending_review"].includes(String(value ?? ""))
}

function normalizePlainValue(value: string | null | undefined) {
  return String(value ?? "").trim()
}

function normalizeAudience(value: Audience | LegacyAudience): Audience {
  return value === "role" ? "segment" : value
}

function ensureCampaignInput(body: unknown): Omit<AdminNotificationCampaignInput, "action"> {
  if (!body || typeof body !== "object") {
    throw badRequest("Payload invalido para campanha")
  }

  const input = body as AdminNotificationCampaignInput

  if (!isAudience(input.audience)) {
    throw badRequest("audience invalido")
  }

  if (!isNotificationType(input.type)) {
    throw badRequest("type invalido")
  }

  if (input.role && !isUserRole(input.role)) {
    throw badRequest("role invalido")
  }

  if (input.status && !isUserStatus(input.status)) {
    throw badRequest("status invalido")
  }

  const audience = normalizeAudience(input.audience)
  const title = normalizePlainValue(input.title)
  const messageHtml = sanitizeRichTextHtml(input.messageHtml ?? input.message ?? "")
  const sentViaEmail = input.sentViaEmail ?? false
  const sentViaInApp = input.sentViaInApp ?? true

  if (audience === "single" && !normalizePlainValue(input.userId)) {
    throw badRequest("userId e obrigatorio para audience=single")
  }

  if (!title) {
    throw badRequest("title e obrigatorio")
  }

  if (!messageHtml || !richTextToPlainText(messageHtml)) {
    throw badRequest("messageHtml e obrigatorio")
  }

  return {
    audience,
    userId: normalizePlainValue(input.userId) || undefined,
    role: input.role ?? undefined,
    status: input.status ?? undefined,
    productCategoryId: normalizePlainValue(input.productCategoryId) || null,
    productId: normalizePlainValue(input.productId) || null,
    purchaseBasis: "active_grants",
    type: input.type,
    title,
    emailSubject: normalizePlainValue(input.emailSubject) || null,
    messageHtml,
    ctaLabel: normalizePlainValue(input.ctaLabel) || null,
    ctaUrl: normalizePlainValue(input.ctaUrl ?? input.link) || null,
    sentViaEmail,
    sentViaInApp,
  }
}

function getFirstName(fullName: string | null) {
  return normalizePlainValue(fullName).split(/\s+/)[0] ?? ""
}

function buildTemplateVariables(recipient: CampaignRecipient, product: CampaignProduct | null, category: CampaignCategory | null) {
  const fullName = normalizePlainValue(recipient.full_name)
  const firstName = getFirstName(recipient.full_name)

  return {
    greeting_name: firstName ? `, ${firstName}` : "",
    full_name: fullName,
    first_name: firstName,
    dashboard_url: "/aluno/dashboard",
    notifications_url: "/aluno/notificacoes",
    product_title: product?.title ?? "",
    category_title: category?.title ?? "",
  }
}

function replaceCampaignTags(value: string | null | undefined, variables: Record<string, string>) {
  return String(value ?? "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_match, key: string) => variables[key] ?? "")
}

function buildMessageExcerpt(messageText: string) {
  const trimmed = normalizePlainValue(messageText)
  if (trimmed.length <= 180) {
    return trimmed || null
  }

  return `${trimmed.slice(0, 177).trimEnd()}...`
}

function sortRecipients(items: CampaignRecipient[]) {
  return [...items].sort((left, right) => {
    const leftName = normalizePlainValue(left.full_name || left.email || left.id).toLowerCase()
    const rightName = normalizePlainValue(right.full_name || right.email || right.id).toLowerCase()
    return leftName.localeCompare(rightName)
  })
}

async function fetchSingleProduct(client: SupabaseClient, productId: string) {
  const { data, error } = await client
    .from("products")
    .select("id,title,category_id")
    .eq("id", productId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Material selecionado nao foi encontrado")
  }

  return data as CampaignProduct
}

async function fetchSingleCategory(client: SupabaseClient, categoryId: string) {
  const { data, error } = await client
    .from("product_categories")
    .select("id,title")
    .eq("id", categoryId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Categoria selecionada nao foi encontrada")
  }

  return data as CampaignCategory
}

async function fetchProductIdsForCategory(client: SupabaseClient, categoryId: string) {
  const { data, error } = await client
    .from("products")
    .select("id")
    .eq("category_id", categoryId)

  if (error) {
    throw error
  }

  return (data ?? []).map((item) => String(item.id))
}

async function resolveRecipients(
  client: SupabaseClient,
  input: Omit<AdminNotificationCampaignInput, "action">,
): Promise<CampaignResolution> {
  const product = input.productId ? await fetchSingleProduct(client, input.productId) : null
  const category = input.productCategoryId ? await fetchSingleCategory(client, input.productCategoryId) : null

  if (product && category && product.category_id !== category.id) {
    throw badRequest("O material selecionado nao pertence a categoria escolhida")
  }

  let query = client.from("profiles").select("id,full_name,email,role,status")

  if (input.audience === "single") {
    query = query.eq("id", input.userId ?? "")
  } else if (input.audience === "all") {
    query = query.eq("status", "active")
  } else {
    if (input.role) {
      query = query.eq("role", input.role)
    }
    if (input.status) {
      query = query.eq("status", input.status)
    }
  }

  const { data: profileRows, error: profilesError } = await query
  if (profilesError) {
    throw profilesError
  }

  const profiles = (profileRows ?? []) as CampaignRecipient[]

  if (profiles.length === 0) {
    throw notFound("Nenhum destinatario encontrado para os filtros escolhidos")
  }

  let recipients = profiles

  if (input.audience === "segment" && (input.productId || input.productCategoryId)) {
    const productIds = input.productId
      ? [input.productId]
      : input.productCategoryId
      ? await fetchProductIdsForCategory(client, input.productCategoryId)
      : []

    if (productIds.length === 0) {
      throw notFound("Nenhum material encontrado para os filtros de compra escolhidos")
    }

    const nowIso = new Date().toISOString()
    const { data: grantRows, error: grantsError } = await client
      .from("access_grants")
      .select("user_id")
      .eq("status", "active")
      .in("product_id", productIds)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

    if (grantsError) {
      throw grantsError
    }

    const grantedUserIds = new Set((grantRows ?? []).map((grant) => String(grant.user_id)))
    recipients = profiles.filter((profile) => grantedUserIds.has(profile.id))
  }

  if (recipients.length === 0) {
    throw notFound("Nenhum destinatario encontrado para os filtros escolhidos")
  }

  return {
    recipients: sortRecipients(recipients),
    product,
    category,
  }
}

async function listCampaigns(client: SupabaseClient) {
  const { data, error } = await client
    .from("audit_logs")
    .select("id,actor_user_id,created_at,metadata")
    .eq("action", "admin.notifications_created")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) {
    throw error
  }

  const rows = data ?? []
  const actorIds = Array.from(
    new Set(rows.map((row) => String(row.actor_user_id ?? "")).filter(Boolean)),
  )

  const actorMap = new Map<string, { full_name: string | null; email: string | null }>()

  if (actorIds.length > 0) {
    const { data: actors, error: actorsError } = await client
      .from("profiles")
      .select("id,full_name,email")
      .in("id", actorIds)

    if (actorsError) {
      throw actorsError
    }

    for (const actor of actors ?? []) {
      actorMap.set(String(actor.id), {
        full_name: typeof actor.full_name === "string" ? actor.full_name : null,
        email: typeof actor.email === "string" ? actor.email : null,
      })
    }
  }

  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Partial<AuditCampaignSummary>
    const actor = row.actor_user_id ? actorMap.get(String(row.actor_user_id)) : null

    return {
      id: String(row.id),
      actor_user_id: row.actor_user_id ? String(row.actor_user_id) : null,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
      created_at: String(row.created_at),
      audience: metadata.audience ?? "all",
      user_id: metadata.user_id ?? null,
      purchase_basis: metadata.purchase_basis ?? "active_grants",
      role: metadata.role ?? null,
      status: metadata.status ?? null,
      type: metadata.type ?? "informational",
      title: metadata.title ?? "Campanha sem titulo",
      email_subject: metadata.email_subject ?? null,
      message_excerpt: metadata.message_excerpt ?? null,
      message_html: metadata.message_html ?? null,
      product_id: metadata.product_id ?? null,
      product_title: metadata.product_title ?? null,
      product_category_id: metadata.product_category_id ?? null,
      product_category_title: metadata.product_category_title ?? null,
      cta_label: metadata.cta_label ?? null,
      cta_url: metadata.cta_url ?? null,
      sent_via_email: Boolean(metadata.sent_via_email),
      sent_via_in_app: Boolean(metadata.sent_via_in_app),
      can_reuse: Boolean(metadata.can_reuse ?? metadata.message_html),
      recipient_count: Number(metadata.recipient_count ?? 0),
      email_recipient_count: Number(metadata.email_recipient_count ?? 0),
      notification_count: Number(metadata.notification_count ?? 0),
    }
  })
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<Record<string, unknown>>(req)
    const action = body.action === "preview" || body.action === "send" || body.action === "list_campaigns"
      ? body.action
      : "send"
    const auditMeta = extractRequestAuditContext(req)

    if (action === "list_campaigns") {
      const campaigns = await listCampaigns(context.serviceClient)

      return jsonResponse({
        success: true,
        request_id: requestId,
        campaigns,
      })
    }

    const input = ensureCampaignInput(body)

    if (action === "preview") {
      const resolution = await resolveRecipients(context.serviceClient, input)

      return jsonResponse({
        success: true,
        request_id: requestId,
        preview: {
          totalRecipients: resolution.recipients.length,
          sampleRecipients: resolution.recipients.slice(0, PREVIEW_SAMPLE_SIZE).map((recipient) => ({
            id: recipient.id,
            full_name: recipient.full_name,
            email: recipient.email,
          })),
        },
      })
    }

    if (!input.sentViaEmail && !input.sentViaInApp) {
      throw badRequest("Ativa pelo menos um canal de entrega")
    }

    const resolution = await resolveRecipients(context.serviceClient, input)
    const baseMessageHtml = sanitizeRichTextHtml(input.messageHtml ?? "")

    const renderedRecipients = resolution.recipients.map((recipient) => {
      const variables = buildTemplateVariables(recipient, resolution.product, resolution.category)
      const renderedTitle = normalizePlainValue(replaceCampaignTags(input.title, variables))
      const renderedEmailSubject = normalizePlainValue(replaceCampaignTags(input.emailSubject ?? input.title, variables))
      const renderedMessageHtml = sanitizeRichTextHtml(replaceCampaignTags(baseMessageHtml, variables))
      const renderedMessageText = richTextToPlainText(renderedMessageHtml)
      const renderedCtaLabel = normalizePlainValue(replaceCampaignTags(input.ctaLabel, variables)) || null
      const renderedCtaUrl = normalizePlainValue(replaceCampaignTags(input.ctaUrl, variables)) || null

      return {
        recipient,
        title: renderedTitle,
        emailSubject: renderedEmailSubject || renderedTitle,
        messageHtml: renderedMessageHtml,
        messageText: renderedMessageText,
        ctaLabel: renderedCtaLabel,
        ctaUrl: renderedCtaUrl,
      }
    })

    if (input.sentViaEmail && renderedRecipients.every((item) => !normalizePlainValue(item.recipient.email))) {
      throw notFound("Nenhum destinatario com email disponivel para esta campanha")
    }

    let notificationMap = new Map<string, string>()
    let notificationCount = 0

    if (input.sentViaInApp) {
      const notificationPayload = renderedRecipients.map((item) => ({
        user_id: item.recipient.id,
        type: input.type,
        title: item.title,
        message: item.messageText,
        link: item.ctaUrl,
        status: "unread",
        sent_via_email: input.sentViaEmail,
        sent_via_in_app: true,
      }))

      const { data: notifications, error: insertError } = await context.serviceClient
        .from("notifications")
        .insert(notificationPayload)
        .select("id,user_id")

      if (insertError) {
        throw insertError
      }

      notificationCount = notifications?.length ?? 0
      notificationMap = new Map((notifications ?? []).map((notification) => [String(notification.user_id), String(notification.id)]))
    }

    let emailRecipientCount = 0

    if (input.sentViaEmail) {
      for (const item of renderedRecipients) {
        if (!normalizePlainValue(item.recipient.email)) {
          continue
        }

        const email = await buildManualNotificationEmail(context.serviceClient, {
          fullName: item.recipient.full_name,
          title: item.title,
          emailSubject: item.emailSubject,
          messageHtml: item.messageHtml,
          messageText: item.messageText,
          ctaLabel: item.ctaLabel,
          ctaUrl: item.ctaUrl,
        })

        await queueEmailDelivery(context.serviceClient, {
          userId: item.recipient.id,
          notificationId: notificationMap.get(item.recipient.id) ?? null,
          emailTo: item.recipient.email ?? "",
          templateKey: "manual_notification",
          subject: email.subject,
          html: email.html,
          text: email.text,
          metadata: {
            audience: input.audience,
            purchase_basis: input.purchaseBasis,
            type: input.type,
            product_id: input.productId,
            product_category_id: input.productCategoryId,
          },
        })

        emailRecipientCount += 1
      }
    }

    const auditSummary: AuditCampaignSummary = {
      audience: input.audience,
      user_id: input.audience === "single" ? input.userId ?? null : null,
      purchase_basis: input.purchaseBasis ?? "active_grants",
      role: input.role ?? null,
      status: input.status ?? null,
      type: input.type,
      title: input.title,
      email_subject: input.emailSubject ?? null,
      message_excerpt: buildMessageExcerpt(richTextToPlainText(baseMessageHtml)),
      message_html: baseMessageHtml || null,
      product_id: resolution.product?.id ?? null,
      product_title: resolution.product?.title ?? null,
      product_category_id: resolution.category?.id ?? null,
      product_category_title: resolution.category?.title ?? null,
      cta_label: input.ctaLabel ?? null,
      cta_url: input.ctaUrl ?? null,
      sent_via_email: input.sentViaEmail,
      sent_via_in_app: input.sentViaInApp,
      can_reuse: true,
      recipient_count: renderedRecipients.length,
      email_recipient_count: emailRecipientCount,
      notification_count: notificationCount,
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.notifications_created",
      entityType: "notification_campaign",
      entityId: null,
      metadata: auditSummary,
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      inserted_count: renderedRecipients.length,
      email_recipient_count: emailRecipientCount,
      notification_count: notificationCount,
    })
  } catch (error) {
    logError("Admin notifications action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
