import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

const COURSE_STORAGE_BUCKET = "course-assets-private"

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

async function ensureStorageBucket(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets()
  if (bucketsError) throw bucketsError

  if ((buckets ?? []).some((bucket) => bucket.name === COURSE_STORAGE_BUCKET)) {
    return
  }

  const { error: createBucketError } = await serviceClient.storage.createBucket(COURSE_STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: "50MB",
    allowedMimeTypes: ["application/pdf", "video/mp4", "video/webm", "image/png", "image/jpeg"],
  })

  if (createBucketError && !String(createBucketError.message).toLowerCase().includes("already exists")) {
    throw createBucketError
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

    const context = await requireAdmin(req)
    const auditMeta = extractRequestAuditContext(req)
    const formData = await req.formData()
    const kind = String(formData.get("kind") ?? "").trim()
    const moduleId = String(formData.get("moduleId") ?? "").trim()
    const replacePath = String(formData.get("replacePath") ?? "").trim() || null
    const file = formData.get("file")

    if (!moduleId) throw badRequest("moduleId e obrigatorio")
    if (kind !== "module_pdf" && kind !== "module_asset") {
      throw badRequest("kind invalido")
    }
    if (!(file instanceof File)) {
      throw badRequest("file e obrigatorio")
    }
    if (file.size === 0) {
      throw badRequest("O ficheiro enviado esta vazio")
    }

    const { data: moduleRow, error: moduleError } = await context.serviceClient
      .from("product_modules")
      .select("id,product_id,title")
      .eq("id", moduleId)
      .maybeSingle()

    if (moduleError) throw moduleError
    if (!moduleRow) throw badRequest("Modulo nao encontrado")

    await ensureStorageBucket(context.serviceClient)

    const safeExtension = getFileExtension(file.name)
    const fileNameBase = sanitizeSegment(file.name.replace(/\.[^.]+$/, "")) || "arquivo"
    const timeStamp = new Date().toISOString().replace(/[:.]/g, "-")
    const objectPath =
      kind === "module_pdf"
        ? `products/${moduleRow.product_id}/modules/${moduleId}/module-pdf/${timeStamp}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`
        : `products/${moduleRow.product_id}/modules/${moduleId}/assets/${crypto.randomUUID()}-${fileNameBase}${safeExtension ? `.${safeExtension}` : ""}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await context.serviceClient.storage
      .from(COURSE_STORAGE_BUCKET)
      .upload(objectPath, arrayBuffer, {
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) throw uploadError

    if (replacePath && replacePath !== objectPath) {
      const { error: removeError } = await context.serviceClient.storage
        .from(COURSE_STORAGE_BUCKET)
        .remove([replacePath])

      if (removeError) {
        logError("Admin storage replace cleanup failed", {
          request_id: requestId,
          replace_path: replacePath,
          error: String(removeError),
        })
      }
    }

    await writeAuditLog(context.serviceClient, context, {
      action: kind === "module_pdf" ? "admin.module_pdf_uploaded" : "admin.module_asset_uploaded",
      entityType: kind === "module_pdf" ? "product_module" : "module_asset_upload",
      entityId: moduleId,
      metadata: {
        module_id: moduleId,
        product_id: moduleRow.product_id,
        bucket: COURSE_STORAGE_BUCKET,
        path: objectPath,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
      },
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      upload: {
        bucket: COURSE_STORAGE_BUCKET,
        path: objectPath,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    logError("Admin storage upload failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
