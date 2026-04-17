import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
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

interface ListUsersInput {
  action: "list"
}

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

type AdminUsersInput = ListUsersInput | CreateUserInput | UpdateUserInput | DeleteUserInput

const allowedRoles = new Set<UserRole>(["student", "affiliate", "admin"])
const allowedStatuses = new Set<UserStatus>(["active", "inactive", "blocked", "pending_review"])

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  role: UserRole
  is_admin: boolean
  status: UserStatus
  phone: string | null
  last_login_at: string | null
  created_at: string
  notifications_enabled: boolean
  marketing_consent: boolean
}

interface AuthUserRow {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  user_metadata?: {
    full_name?: string | null
  } | null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function buildAdminUserSummary(profile: ProfileRow, authUser?: AuthUserRow | null) {
  return {
    id: profile.id,
    full_name: profile.full_name ?? authUser?.user_metadata?.full_name ?? "Utilizador",
    email: profile.email ?? authUser?.email ?? "",
    role: profile.role,
    is_admin: profile.is_admin,
    status: profile.status,
    phone: profile.phone,
    last_login_at: profile.last_login_at,
    created_at: profile.created_at,
    notifications_enabled: profile.notifications_enabled,
    marketing_consent: profile.marketing_consent,
    email_verified: Boolean(authUser?.email_confirmed_at),
    email_verified_at: authUser?.email_confirmed_at ?? null,
  }
}

function isAuthUserNotFoundError(error: unknown) {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes("user not found")
}

async function fetchAuthUsersMap(serviceClient: SupabaseClient) {
  const authUsers = new Map<string, AuthUserRow>()
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw error
    }

    const users = data?.users ?? []
    for (const user of users) {
      authUsers.set(user.id, {
        id: user.id,
        email: user.email ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
        user_metadata: {
          full_name:
            typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
        },
      })
    }

    if (users.length < perPage) {
      break
    }

    page += 1
  }

  return authUsers
}

async function fetchProfileById(serviceClient: SupabaseClient, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select(
      "id,full_name,email,role,is_admin,status,phone,last_login_at,created_at,notifications_enabled,marketing_consent",
    )
    .eq("id", userId)
    .single()

  if (error) {
    throw error
  }

  return data as ProfileRow
}

async function fetchProfileMaybe(serviceClient: SupabaseClient, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select(
      "id,full_name,email,role,is_admin,status,phone,last_login_at,created_at,notifications_enabled,marketing_consent",
    )
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as ProfileRow | null
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
    const body = await readJsonBody<AdminUsersInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "list") {
      const { data: profiles, error } = await context.serviceClient
        .from("profiles")
        .select(
          "id,full_name,email,role,is_admin,status,phone,last_login_at,created_at,notifications_enabled,marketing_consent",
        )
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      const authUsers = await fetchAuthUsersMap(context.serviceClient)
      const users = (profiles ?? []).map((profile) =>
        buildAdminUserSummary(profile as ProfileRow, authUsers.get(profile.id)),
      )

      return jsonResponse({ success: true, request_id: requestId, users })
    }

    if (body.action === "create") {
      if (!body.fullName.trim()) {
        throw badRequest("Nome completo e obrigatorio")
      }

      const email = normalizeEmail(body.email)
      const role = body.role ?? "student"
      if (!allowedRoles.has(role)) {
        throw badRequest("Role invalida")
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
        throw error ?? new Error("Nao foi possivel criar o utilizador")
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
        .select(
          "id,full_name,email,role,is_admin,status,phone,last_login_at,created_at,notifications_enabled,marketing_consent",
        )
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

      logInfo("Admin created user", {
        request_id: requestId,
        actor_user_id: context.user.id,
        target_user_id: profile.id,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        user: buildAdminUserSummary(profile as ProfileRow, {
          id: data.user.id,
          email: data.user.email ?? null,
          email_confirmed_at: data.user.email_confirmed_at ?? null,
          user_metadata: {
            full_name:
              typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : null,
          },
        }),
      })
    }

    if (!body.userId) {
      throw badRequest("userId e obrigatorio")
    }

    if (body.userId === context.user.id) {
      if (body.action === "delete") {
        throw forbidden("Nao e permitido remover a si proprio")
      }

      if (
        body.action === "update" &&
        ((body.role && body.role !== "admin") || (body.status && body.status !== "active"))
      ) {
        throw forbidden("Nao e permitido rebaixar ou bloquear a si proprio")
      }
    }

    if (body.action === "delete") {
      const previousProfile = await fetchProfileMaybe(context.serviceClient, body.userId)

      const { error: deleteAuthError } = await context.serviceClient.auth.admin.deleteUser(body.userId)
      const authDeleted = !deleteAuthError || isAuthUserNotFoundError(deleteAuthError)
      if (deleteAuthError && !isAuthUserNotFoundError(deleteAuthError)) {
        throw deleteAuthError
      }

      const nowIso = new Date().toISOString()
      const deletedEmail = `deleted+${body.userId}@deleted.local`

      const { error: revokeError } = await context.serviceClient
        .from("access_grants")
        .update({ status: "revoked", revoked_at: nowIso })
        .eq("user_id", body.userId)
        .eq("status", "active")

      if (revokeError) {
        throw revokeError
      }

      const { data: profile, error } = await context.serviceClient
        .from("profiles")
        .update({
          full_name: "[Excluido]",
          email: deletedEmail,
          role: "student",
          is_admin: false,
          status: "inactive",
          phone: null,
          last_login_at: null,
          notifications_enabled: false,
          marketing_consent: false,
        })
        .eq("id", body.userId)
        .select(
          "id,full_name,email,role,is_admin,status,phone,last_login_at,created_at,notifications_enabled,marketing_consent",
        )
        .maybeSingle()

      if (error) {
        throw error
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.user_hard_deleted",
        entityType: "profile",
        entityId: body.userId,
        metadata: {
          previous_email: previousProfile?.email ?? null,
          previous_status: previousProfile?.status ?? null,
          auth_deleted: authDeleted,
        },
        ...auditMeta,
      })

      logInfo("Admin hard deleted user", {
        request_id: requestId,
        actor_user_id: context.user.id,
        target_user_id: body.userId,
        auth_deleted: authDeleted,
      })

      if (!profile) {
        const fallbackProfile: ProfileRow = {
          id: body.userId,
          full_name: "[Excluido]",
          email: deletedEmail,
          role: "student",
          is_admin: false,
          status: "inactive",
          phone: null,
          last_login_at: null,
          created_at: previousProfile?.created_at ?? nowIso,
          notifications_enabled: false,
          marketing_consent: false,
        }

        return jsonResponse({
          success: true,
          request_id: requestId,
          user: buildAdminUserSummary(fallbackProfile, null),
        })
      }

      return jsonResponse({
        success: true,
        request_id: requestId,
        user: buildAdminUserSummary(profile as ProfileRow, null),
      })
    }

    if (body.action === "update") {
      if (body.role && !allowedRoles.has(body.role)) {
        throw badRequest("Role invalida")
      }

      if (body.status && !allowedStatuses.has(body.status)) {
        throw badRequest("Status invalido")
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

      const { error } = await context.serviceClient.from("profiles").update(updates).eq("id", body.userId)

      if (error) {
        throw error
      }

      const profile = await fetchProfileById(context.serviceClient, body.userId)
      const { data: authUserData, error: authUserError } = await context.serviceClient.auth.admin.getUserById(
        body.userId,
      )
      if (authUserError) {
        throw authUserError
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.user_updated",
        entityType: "profile",
        entityId: profile.id,
        metadata: updates,
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        user: buildAdminUserSummary(profile, authUserData.user as AuthUserRow | null),
      })
    }

    throw badRequest("Acao invalida")
  } catch (error) {
    logError("Admin users action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
