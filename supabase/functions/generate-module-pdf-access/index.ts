import { extractRequestAuditContext, requireActiveUser, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"

const COURSE_STORAGE_BUCKET = "course-assets-private"

interface Input {
  moduleId?: string
}

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
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
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<Input>(req)
    const moduleId = body.moduleId?.trim()

    if (!moduleId) {
      throw badRequest("moduleId e obrigatorio")
    }

    const { data: moduleRow, error: moduleError } = await context.serviceClient
      .from("product_modules")
      .select(
        "id,product_id,title,module_pdf_storage_path,module_pdf_file_name,status,access_type,is_preview,starts_at,ends_at,release_days_after_enrollment",
      )
      .eq("id", moduleId)
      .maybeSingle()

    if (moduleError) throw moduleError
    if (!moduleRow) throw forbidden("Modulo indisponivel")

    const { data: canAccessRow, error: canAccessError } = await context.serviceClient
      .rpc("can_access_product_module", {
        target_module_id: moduleId,
        target_user: context.user.id,
      })

    if (canAccessError) throw canAccessError
    if (!canAccessRow) throw forbidden("Voce nao possui acesso a este PDF")

    if (!moduleRow.module_pdf_storage_path || !moduleRow.module_pdf_file_name) {
      throw forbidden("Este modulo nao possui PDF base configurado")
    }

    const { data: productRow, error: productError } = await context.serviceClient
      .from("products")
      .select("id,title")
      .eq("id", moduleRow.product_id)
      .maybeSingle()

    if (productError) throw productError
    if (!productRow) throw forbidden("Curso indisponivel")

    const licenseToken = context.user.id.slice(0, 8)
    const downloadName = sanitizeSegment(
      `${productRow.title}-${moduleRow.title}-${licenseToken}-${moduleRow.module_pdf_file_name}`,
    ) || moduleRow.module_pdf_file_name

    const signed = await context.serviceClient.storage
      .from(COURSE_STORAGE_BUCKET)
      .createSignedUrl(moduleRow.module_pdf_storage_path, 300, {
        download: downloadName,
      })

    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error ?? forbidden("Nao foi possivel gerar acesso temporario")
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "student.module_pdf_access_requested",
      entityType: "product_module",
      entityId: moduleId,
      metadata: {
        module_id: moduleId,
        product_id: moduleRow.product_id,
        storage_path: moduleRow.module_pdf_storage_path,
        file_name: moduleRow.module_pdf_file_name,
        licensed_file_name: downloadName,
      },
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      mode: "signed_url",
      url: signed.data.signedUrl,
      expires_in_seconds: 300,
      file_name: downloadName,
    })
  } catch (error) {
    logError("Module PDF access failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
