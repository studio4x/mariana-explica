import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { extractRequestAuditContext, requireActiveUser, writeAuditLog } from "../_shared/mod.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const SUPPORT_BUCKET = "support-attachments"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

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

async function ensureSupportBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()
  if (bucketsError) throw bucketsError

  const options = {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  }

  if ((buckets ?? []).some((bucket) => bucket.name === SUPPORT_BUCKET)) {
    const { error } = await serviceClient.storage.updateBucket(SUPPORT_BUCKET, options)
    if (error) {
      logError("Support bucket update failed", { error: String(error) })
    }
    return
  }

  const { error } = await serviceClient.storage.createBucket(SUPPORT_BUCKET, options)
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
    const ticketId = String(formData.get("ticketId") ?? "").trim() || null
    const file = formData.get("file")

    if (!(file instanceof File)) {
      throw badRequest("file e obrigatorio")
    }
    if (file.size <= 0) {
      throw badRequest("O ficheiro enviado esta vazio")
    }
    if (file.size > MAX_FILE_SIZE) {
      throw badRequest("O anexo deve ter no maximo 10 MB")
    }

    const contentType = file.type || "application/octet-stream"
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw badRequest("Formato de anexo invalido")
    }

    if (ticketId) {
      const { data: ticket, error } = await context.serviceClient
        .from("support_tickets")
        .select("id,user_id")
        .eq("id", ticketId)
        .maybeSingle()

      if (error) throw error
      if (!ticket) throw notFound("Ticket nao encontrado")
      if (!context.profile.is_admin && ticket.user_id !== context.user.id) {
        throw forbidden("Sem permissao para anexar neste ticket")
      }
    }

    await ensureSupportBucket(context.serviceClient)

    const extension = getFileExtension(file.name)
    const fileNameBase = sanitizeSegment(file.name.replace(/\.[^.]+$/, "")) || "anexo"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const objectPath = `support/${context.user.id}/${ticketId ?? "draft"}/${timestamp}-${crypto.randomUUID()}-${fileNameBase}${extension ? `.${extension}` : ""}`

    const { error: uploadError } = await context.serviceClient.storage
      .from(SUPPORT_BUCKET)
      .upload(objectPath, await file.arrayBuffer(), {
        upsert: false,
        contentType,
      })

    if (uploadError) {
      throw uploadError
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "support.attachment_uploaded",
      entityType: ticketId ? "support_ticket" : "support_attachment",
      entityId: ticketId ?? context.user.id,
      metadata: {
        bucket: SUPPORT_BUCKET,
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
      upload: {
        bucket: SUPPORT_BUCKET,
        path: objectPath,
        file_name: file.name,
        mime_type: contentType,
        file_size_bytes: file.size,
      },
    })
  } catch (error) {
    logError("Support attachment upload failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
