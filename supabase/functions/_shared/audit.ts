import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import type { AuthContext } from "./auth.ts"

interface AuditLogInput {
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeAuditEntityId(entityId?: string | null) {
  const trimmed = typeof entityId === "string" ? entityId.trim() : ""
  return UUID_PATTERN.test(trimmed) ? trimmed : null
}

export async function writeAuditLog(
  client: SupabaseClient,
  context: Pick<AuthContext, "user" | "profile"> | null,
  input: AuditLogInput,
) {
  const { error } = await client.from("audit_logs").insert({
    actor_user_id: context?.user.id ?? null,
    actor_role: context?.profile.role ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: normalizeAuditEntityId(input.entityId),
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  })

  if (error) {
    throw error
  }
}

export function extractRequestAuditContext(req: Request) {
  return {
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    userAgent: req.headers.get("user-agent"),
  }
}
