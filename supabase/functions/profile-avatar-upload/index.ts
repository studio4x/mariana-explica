import { badRequest } from "../_shared/errors.ts"
import { buildStoragePublicUrl } from "../_shared/storage-provider.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { extractRequestAuditContext, requireActiveUser, writeAuditLog } from "../_shared/mod.ts"

interface Body {
  bucket?: string | null
  path?: string | null
  storage_provider?: "supabase" | "r2" | null
  public_url?: string | null
  file_name?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
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

    const context = await requireActiveUser(req)
    const body = await readJsonBody<Body>(req)
    const bucket = String(body.bucket ?? "").trim()
    const path = String(body.path ?? "").trim()

    if (!bucket || !path) {
      throw badRequest("bucket e path sao obrigatorios")
    }

    if (bucket !== "profile-avatars-public" || !path.startsWith(`profiles/${context.user.id}/`)) {
      throw badRequest("Avatar invalido para este utilizador")
    }

    const publicUrl = String(body.public_url ?? "").trim() || buildStoragePublicUrl("profile_avatar", path)
    const storageProvider = body.storage_provider === "r2" ? "r2" : "supabase"

    const { data: profile, error: profileError } = await context.serviceClient
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        avatar_storage_bucket: bucket,
        avatar_storage_path: path,
        avatar_storage_provider: storageProvider,
      })
      .eq("id", context.user.id)
      .select("id,full_name,email,phone,nif,avatar_url,avatar_storage_bucket,avatar_storage_path,avatar_storage_provider,notifications_enabled,marketing_consent,content_updates_consent,role,status")
      .single()

    if (profileError) throw profileError

    await writeAuditLog(context.serviceClient, context, {
      action: "profile.avatar_uploaded",
      entityType: "profile",
      entityId: context.user.id,
      metadata: {
        bucket,
        path,
        storage_provider: storageProvider,
        file_name: body.file_name ?? null,
        mime_type: body.mime_type ?? null,
        file_size_bytes: body.file_size_bytes ?? null,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      avatar: {
        bucket,
        path,
        storage_provider: storageProvider,
        public_url: publicUrl,
        file_name: String(body.file_name ?? "").trim() || null,
        mime_type: String(body.mime_type ?? "").trim() || null,
        file_size_bytes:
          typeof body.file_size_bytes === "number" && Number.isFinite(body.file_size_bytes)
            ? body.file_size_bytes
            : null,
        uploaded_at: new Date().toISOString(),
      },
      profile,
    })
  } catch (error) {
    logError("Profile avatar upload failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
