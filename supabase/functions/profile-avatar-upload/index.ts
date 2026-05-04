import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { extractRequestAuditContext, requireActiveUser, writeAuditLog } from "../_shared/mod.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const AVATAR_BUCKET = "profile-avatars-public"
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/avif"]

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".")
  if (parts.length < 2) return ""
  return sanitizeSegment(parts.at(-1) ?? "")
}

async function ensureAvatarBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()
  if (bucketsError) throw bucketsError

  const options = {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  }

  if ((buckets ?? []).some((bucket) => bucket.name === AVATAR_BUCKET)) {
    const { error } = await serviceClient.storage.updateBucket(AVATAR_BUCKET, options)
    if (error) {
      logError("Profile avatar bucket update failed", { error: String(error) })
    }
    return
  }

  const { error } = await serviceClient.storage.createBucket(AVATAR_BUCKET, options)
  if (error && !String(error.message).toLowerCase().includes("already exists")) {
    throw error
  }
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
    const formData = await req.formData()
    const replacePath = String(formData.get("replacePath") ?? "").trim() || null
    const file = formData.get("file")

    if (!(file instanceof File)) {
      throw badRequest("file e obrigatorio")
    }
    if (file.size <= 0) {
      throw badRequest("O ficheiro enviado esta vazio")
    }
    if (file.size > MAX_FILE_SIZE) {
      throw badRequest("O avatar deve ter no maximo 5 MB")
    }

    const contentType = file.type || "application/octet-stream"
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw badRequest("Formato de avatar invalido. Use PNG, JPG, WEBP, GIF ou AVIF.")
    }

    await ensureAvatarBucket(context.serviceClient)

    const extension = getFileExtension(file.name)
    const fileNameBase = sanitizeSegment(file.name.replace(/\.[^.]+$/, "")) || "avatar"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const objectPath = `profiles/${context.user.id}/${timestamp}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`

    const { error: uploadError } = await context.serviceClient.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, await file.arrayBuffer(), {
        upsert: false,
        contentType,
      })

    if (uploadError) throw uploadError

    if (replacePath && replacePath !== objectPath && replacePath.startsWith(`profiles/${context.user.id}/`)) {
      const { error: removeError } = await context.serviceClient.storage.from(AVATAR_BUCKET).remove([replacePath])
      if (removeError) {
        logError("Profile avatar replace cleanup failed", {
          request_id: requestId,
          replace_path: replacePath,
          error: String(removeError),
        })
      }
    }

    const publicUrl = context.serviceClient.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath).data.publicUrl

    const { data: profile, error: profileError } = await context.serviceClient
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", context.user.id)
      .select("id,full_name,email,phone,nif,avatar_url,notifications_enabled,marketing_consent,content_updates_consent,role,status")
      .single()

    if (profileError) throw profileError

    await writeAuditLog(context.serviceClient, context, {
      action: "profile.avatar_uploaded",
      entityType: "profile",
      entityId: context.user.id,
      metadata: {
        bucket: AVATAR_BUCKET,
        path: objectPath,
        file_name: file.name,
        mime_type: contentType,
        file_size_bytes: file.size,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      avatar: {
        bucket: AVATAR_BUCKET,
        path: objectPath,
        public_url: publicUrl,
        file_name: file.name,
        mime_type: contentType,
        file_size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      },
      profile,
    })
  } catch (error) {
    logError("Profile avatar upload failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
