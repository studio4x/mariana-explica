import { badRequest, forbidden } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

type UserRole = "student" | "affiliate" | "admin"
type UserStatus = "active" | "inactive" | "blocked" | "pending_review"

interface CreateUserInput {
  action: "create"
  fullName: string
  email: string
  password: string
  role?: UserRole
}

interface UpdateUserInput {
  action: "update"
  userId: string
  fullName?: string
  email?: string
  role?: UserRole
  status?: UserStatus
  notificationsEnabled?: boolean
  marketingConsent?: boolean
}

interface DeleteUserInput {
  action: "delete"
  userId: string
}

type AdminUsersInput = CreateUserInput | UpdateUserInput | DeleteUserInput

const allowedRoles = new Set<UserRole>(["student", "affiliate", "admin"])
const allowedStatuses = new Set<UserStatus>(["active", "inactive", "blocked", "pending_review"])

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("MÃ©todo nÃ£o suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<AdminUsersInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "create") {
      if (!body.fullName.trim()) {
        throw badRequest("Nome completo Ã© obrigatÃ³rio")
      }

      const email = normalizeEmail(body.email)
      const role = body.role ?? "student"
      if (!allowedRoles.has(role)) {
        throw badRequest("Role invÃ¡lida")
      }

      const { data, error } = await context.serviceClient.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.fullName.trim(),
        },
      })

      if (error || !data.user) {
        throw error ?? new Error("NÃ£o foi possÃ­vel criar o usuÃ¡rio")
      }

      const { data: profile, error: profileError } = await context.serviceClient
        .from("profiles")
        .update({
          full_name: body.fullName.trim(),
          email,
          role,
          is_admin: role === "admin",
          status: "active",
        })
        .eq("id", data.user.id)
        .select("id,full_name,email,role,is_admin,status,created_at,last_login_at")
        .single()

      if (profileError) {
        throw profileError
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.user_created",
        entityType: "profile",
        entityId: profile.id,
        metadata: { role: profile.role, email: profile.email },
        ...auditMeta,
      })

      logInfo("Admin created user", { request_id: requestId, actor_user_id: context.user.id, target_user_id: profile.id })
      return jsonResponse({ success: true, request_id: requestId, user: profile })
    }

    if (!body.userId) {
      throw badRequest("userId Ã© obrigatÃ³rio")
    }

    if (body.userId === context.user.id) {
      if (body.action === "delete") {
        throw forbidden("NÃ£o Ã© permitido remover a si prÃ³prio")
      }

      if (
        body.action === "update" &&
        ((body.role && body.role !== "admin") || (body.status && body.status !== "active"))
      ) {
        throw forbidden("NÃ£o Ã© permitido rebaixar ou bloquear a si prÃ³prio")
      }
    }

    if (body.action === "delete") {
      const { data: profile, error } = await context.serviceClient
        .from("profiles")
        .update({ status: "inactive" })
        .eq("id", body.userId)
        .select("id,full_name,email,role,is_admin,status,created_at,last_login_at")
        .single()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.user_soft_deleted",
        entityType: "profile",
        entityId: profile.id,
        metadata: { email: profile.email },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, user: profile })
    }

    if (body.action === "update") {
      if (body.role && !allowedRoles.has(body.role)) {
        throw badRequest("Role invÃ¡lida")
      }

      if (body.status && !allowedStatuses.has(body.status)) {
        throw badRequest("Status invÃ¡lido")
      }

      const updates: Record<string, unknown> = {}
      if (body.fullName !== undefined) updates.full_name = body.fullName.trim()
      if (body.role !== undefined) {
        updates.role = body.role
        updates.is_admin = body.role === "admin"
      }
      if (body.status !== undefined) updates.status = body.status
      if (body.notificationsEnabled !== undefined) updates.notifications_enabled = body.notificationsEnabled
      if (body.marketingConsent !== undefined) updates.marketing_consent = body.marketingConsent

      if (body.email) {
        const email = normalizeEmail(body.email)
        const { error } = await context.serviceClient.auth.admin.updateUserById(body.userId, {
          email,
          email_confirm: true,
        })
        if (error) {
          throw error
        }
        updates.email = email
      }

      if (body.fullName) {
        const { error } = await context.serviceClient.auth.admin.updateUserById(body.userId, {
          user_metadata: { full_name: body.fullName.trim() },
        })
        if (error) {
          throw error
        }
      }

      const { data: profile, error } = await context.serviceClient
        .from("profiles")
        .update(updates)
        .eq("id", body.userId)
        .select("id,full_name,email,role,is_admin,status,created_at,last_login_at,notifications_enabled,marketing_consent")
        .single()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.user_updated",
        entityType: "profile",
        entityId: profile.id,
        metadata: updates,
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, user: profile })
    }

    throw badRequest("AÃ§Ã£o invÃ¡lida")
  } catch (error) {
    logError("Admin users action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
