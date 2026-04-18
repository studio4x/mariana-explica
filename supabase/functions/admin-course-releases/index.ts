import { ensureActiveGrant, extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"

interface ReleaseListRow {
  id: string
  user_id: string
  product_id: string
  source_type: "purchase" | "free_claim" | "admin_grant" | "manual_adjustment"
  source_order_id: string | null
  status: "active" | "revoked" | "expired"
  granted_at: string
  revoked_at: string | null
  expires_at: string | null
  notes: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
}

type AdminCourseReleasesInput =
  | { action: "list"; productId: string }
  | {
      action: "create"
      productId: string
      userId: string
      expiresAt?: string | null
      notes?: string | null
    }
  | { action: "revoke"; grantId: string; reason?: string | null }

function requireText(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw badRequest(`${label} é obrigatório`)
  }

  return value.trim()
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()
  return text.length ? text : null
}

function normalizeNullableTimestamp(value: unknown) {
  const text = normalizeNullableText(value)
  if (!text) {
    return null
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest("Data/hora inválida")
  }

  return parsed.toISOString()
}

async function fetchProfilesByIds(ids: string[], serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"]) {
  if (ids.length === 0) {
    return new Map<string, ProfileRow>()
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,full_name,email")
    .in("id", ids)

  if (error) {
    throw error
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Método não suportado")
    }

    const context = await requireAdmin(req)
    const body = await readJsonBody<AdminCourseReleasesInput>(req)
    const auditMeta = extractRequestAuditContext(req)

    if (body.action === "list") {
      const productId = requireText(body.productId, "productId")
      const { data, error } = await context.serviceClient
        .from("access_grants")
        .select("id,user_id,product_id,source_type,source_order_id,status,granted_at,revoked_at,expires_at,notes")
        .eq("product_id", productId)
        .order("granted_at", { ascending: false })

      if (error) {
        throw error
      }

      const rows = (data ?? []) as ReleaseListRow[]
      const profiles = await fetchProfilesByIds(
        [...new Set(rows.map((row) => row.user_id))],
        context.serviceClient,
      )

      return jsonResponse({
        success: true,
        request_id: requestId,
        releases: rows.map((row) => ({
          ...row,
          profile_name: profiles.get(row.user_id)?.full_name ?? null,
          profile_email: profiles.get(row.user_id)?.email ?? null,
        })),
      })
    }

    if (body.action === "create") {
      const productId = requireText(body.productId, "productId")
      const userId = requireText(body.userId, "userId")
      const expiresAt = normalizeNullableTimestamp(body.expiresAt)
      const notes = normalizeNullableText(body.notes)

      const { data: userProfile, error: userError } = await context.serviceClient
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle()

      if (userError) {
        throw userError
      }

      if (!userProfile) {
        throw notFound("Usuário não encontrado")
      }

      const { data: product, error: productError } = await context.serviceClient
        .from("products")
        .select("id,title")
        .eq("id", productId)
        .maybeSingle()

      if (productError) {
        throw productError
      }

      if (!product) {
        throw notFound("Curso não encontrado")
      }

      const ensuredGrant = await ensureActiveGrant(context.serviceClient, {
        userId,
        productId,
        sourceType: "admin_grant",
        notes: notes ?? "Acesso concedido manualmente pelo admin",
      })

      const grantId = ensuredGrant.grant.id
      let grant = ensuredGrant.grant

      if (expiresAt !== null || notes !== null) {
        const { data: updatedGrant, error: updateError } = await context.serviceClient
          .from("access_grants")
          .update({
            expires_at: expiresAt ?? undefined,
            notes: notes ?? undefined,
          })
          .eq("id", grantId)
          .select("id,user_id,product_id,source_type,source_order_id,status,granted_at,revoked_at,expires_at,notes")
          .single()

        if (updateError) {
          throw updateError
        }

        grant = updatedGrant
      }

      await writeAuditLog(context.serviceClient, context, {
        action: ensuredGrant.created ? "admin.course_release_created" : "admin.course_release_updated",
        entityType: "access_grant",
        entityId: grantId,
        metadata: {
          product_id: productId,
          user_id: userId,
          expires_at: expiresAt,
          notes,
          created: ensuredGrant.created,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, release: grant, product })
    }

    if (body.action === "revoke") {
      const grantId = requireText(body.grantId, "grantId")
      const reason = normalizeNullableText(body.reason) ?? "Acesso revogado manualmente pelo admin"

      const { data: currentGrant, error: lookupError } = await context.serviceClient
        .from("access_grants")
        .select("id,user_id,product_id,status,revoked_at")
        .eq("id", grantId)
        .maybeSingle()

      if (lookupError) {
        throw lookupError
      }

      if (!currentGrant) {
        throw notFound("Grant não encontrado")
      }

      const { data: revokedGrant, error: revokeError } = await context.serviceClient
        .from("access_grants")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          notes: reason,
        })
        .eq("id", grantId)
        .select("id,user_id,product_id,source_type,source_order_id,status,granted_at,revoked_at,expires_at,notes")
        .single()

      if (revokeError) {
        throw revokeError
      }

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.course_release_revoked",
        entityType: "access_grant",
        entityId: grantId,
        metadata: {
          user_id: currentGrant.user_id,
          product_id: currentGrant.product_id,
          reason,
        },
        ...auditMeta,
      })

      return jsonResponse({ success: true, request_id: requestId, release: revokedGrant })
    }

    throw badRequest("action inválida")
  } catch (error) {
    logError("Admin course releases action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
