import { badRequest, notFound } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

type Audience = "single" | "role" | "all"
type NotificationType = "transactional" | "informational" | "marketing" | "support"
type UserRole = "student" | "affiliate" | "admin"
type UserStatus = "active" | "inactive" | "blocked" | "pending_review"

interface AdminNotificationsInput {
  audience: Audience
  userId?: string
  role?: UserRole
  status?: UserStatus
  type: NotificationType
  title: string
  message: string
  link?: string | null
  sentViaEmail?: boolean
  sentViaInApp?: boolean
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
    const body = await readJsonBody<AdminNotificationsInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (!body.title.trim() || !body.message.trim()) {
      throw badRequest("title e message sao obrigatorios")
    }

    let query = context.serviceClient
      .from("profiles")
      .select("id,role,status")

    if (body.audience === "single") {
      if (!body.userId) {
        throw badRequest("userId e obrigatorio para audience=single")
      }
      query = query.eq("id", body.userId)
    } else {
      query = query.eq("status", body.status ?? "active")
      if (body.audience === "role") {
        if (!body.role) {
          throw badRequest("role e obrigatorio para audience=role")
        }
        query = query.eq("role", body.role)
      }
    }

    const { data: recipients, error: recipientsError } = await query
    if (recipientsError) {
      throw recipientsError
    }

    if (!recipients || recipients.length === 0) {
      throw notFound("Nenhum destinatario encontrado")
    }

    const payload = recipients.map((recipient) => ({
      user_id: recipient.id,
      type: body.type,
      title: body.title.trim(),
      message: body.message.trim(),
      link: body.link?.trim() || null,
      status: "unread",
      sent_via_email: body.sentViaEmail ?? false,
      sent_via_in_app: body.sentViaInApp ?? true,
    }))

    const { error: insertError } = await context.serviceClient
      .from("notifications")
      .insert(payload)

    if (insertError) {
      throw insertError
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.notifications_created",
      entityType: "notification",
      entityId: null,
      metadata: {
        audience: body.audience,
        role: body.role ?? null,
        status: body.status ?? null,
        inserted_count: payload.length,
        type: body.type,
      },
      ...auditMeta,
    })

    return jsonResponse({ success: true, request_id: requestId, inserted_count: payload.length })
  } catch (error) {
    logError("Admin notifications action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
