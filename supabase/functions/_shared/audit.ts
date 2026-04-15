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
    entity_id: input.entityId ?? null,
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
