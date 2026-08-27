import { degrees, PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1"
import { extractRequestAuditContext, isAdminProfile, requireActiveUser, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { createSignedReadUrl, downloadStorageObject, uploadStorageObject } from "../_shared/storage-provider.ts"

const COURSE_STORAGE_BUCKET = "course-assets-private"
const MODULE_PDF_WATERMARK_KEY = "module_pdf_watermark"
const DEFAULT_SITE_NAME = "Mariana Explica"

interface Input {
  moduleId?: string
  lessonId?: string
  disposition?: "inline" | "attachment"
}

interface WatermarkConfigValue {
  site_name: string
  logo_bucket: string | null
  logo_path: string | null
  logo_storage_provider: "supabase" | "r2" | null
}

function sanitizeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function normalizeWatermarkConfig(value: unknown): WatermarkConfigValue {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
  const siteName = String(input.site_name ?? DEFAULT_SITE_NAME).trim() || DEFAULT_SITE_NAME
  const logoBucket = String(input.logo_bucket ?? "").trim() || null
  const logoPath = String(input.logo_path ?? "").trim() || null
  const logoStorageProvider = String(input.logo_storage_provider ?? "").trim() === "r2" ? "r2" : logoPath ? "supabase" : null

  return {
    site_name: siteName,
    logo_bucket: logoPath ? (logoBucket ?? COURSE_STORAGE_BUCKET) : null,
    logo_path: logoPath,
    logo_storage_provider: logoStorageProvider,
  }
}

function getImageFormat(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png" as const
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg" as const
  }

  return null
}

async function readStorageObject(
  serviceClient: ReturnType<typeof createServiceClient>,
  bucket: string,
  path: string,
  provider: "supabase" | "r2" | null = "supabase",
) {
  return await downloadStorageObject({
    serviceClient,
    logicalBucket: bucket,
    storagePath: path,
    provider: provider ?? "supabase",
  }).catch((error) => {
    throw error ?? forbidden("Nao foi possivel ler o ficheiro protegido")
  })
}

async function getWatermarkConfig(
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select("config_value")
    .eq("config_key", MODULE_PDF_WATERMARK_KEY)
    .maybeSingle()

  if (error) throw error
  return normalizeWatermarkConfig(data?.config_value ?? null)
}

async function buildWatermarkedPdf(params: {
  sourceBytes: Uint8Array
  siteName: string
  licenseText: string
  logoBytes: Uint8Array | null
}) {
  const document = await PDFDocument.load(params.sourceBytes)
  const watermarkFont = await document.embedFont(StandardFonts.HelveticaBold)
  const footerFont = await document.embedFont(StandardFonts.Helvetica)

  let embeddedLogo:
    | Awaited<ReturnType<PDFDocument["embedPng"]>>
    | Awaited<ReturnType<PDFDocument["embedJpg"]>>
    | null = null

  if (params.logoBytes) {
    const format = getImageFormat(params.logoBytes)
    if (format === "png") {
      embeddedLogo = await document.embedPng(params.logoBytes)
    } else if (format === "jpg") {
      embeddedLogo = await document.embedJpg(params.logoBytes)
    }
  }

  for (const page of document.getPages()) {
    const { width, height } = page.getSize()
    const watermarkSize = Math.max(36, Math.min(width, height) / 8)
    const watermarkText = params.siteName.toUpperCase()
    const textWidth = watermarkFont.widthOfTextAtSize(watermarkText, watermarkSize)

    page.drawText(watermarkText, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: watermarkSize,
      font: watermarkFont,
      color: rgb(0.55, 0.61, 0.68),
      opacity: 0.14,
      rotate: degrees(-32),
    })

    page.drawText(params.licenseText, {
      x: 32,
      y: 20,
      size: 9,
      font: footerFont,
      color: rgb(0.2, 0.23, 0.29),
      opacity: 0.75,
    })

    if (embeddedLogo) {
      const scale = Math.min(1, 88 / embeddedLogo.width)
      const logoWidth = embeddedLogo.width * scale
      const logoHeight = embeddedLogo.height * scale
      page.drawImage(embeddedLogo, {
        x: width - logoWidth - 24,
        y: height - logoHeight - 24,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.22,
      })
    }
  }

  return await document.save()
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
    const lessonId = body.lessonId?.trim()
    const disposition = body.disposition === "inline" ? "inline" : "attachment"
    const isAdminPreview = isAdminProfile(context.profile)

    if (Boolean(moduleId) === Boolean(lessonId)) {
      throw badRequest("moduleId ou lessonId e obrigatorio")
    }

    let lessonRow: {
      id: string
      module_id: string
      title: string
      status: "draft" | "published" | "archived"
      lesson_file_storage_path: string | null
      lesson_file_storage_provider: "supabase" | "r2" | null
      lesson_file_name: string | null
    } | null = null

    if (lessonId) {
      const { data, error } = await context.serviceClient
        .from("product_lessons")
        .select("id,module_id,title,status,lesson_file_storage_path,lesson_file_storage_provider,lesson_file_name")
        .eq("id", lessonId)
        .maybeSingle()

      if (error) throw error
      if (!data) throw forbidden("Aula indisponivel")
      lessonRow = data
    }

    const targetModuleId = lessonRow?.module_id ?? moduleId
    if (!targetModuleId) {
      throw badRequest("Modulo da aula e obrigatorio")
    }

    const { data: moduleRow, error: moduleError } = await context.serviceClient
      .from("product_modules")
      .select(
        "id,product_id,title,module_pdf_storage_path,module_pdf_storage_provider,module_pdf_file_name,status,access_type,is_preview,starts_at,ends_at,release_days_after_enrollment",
      )
      .eq("id", targetModuleId)
      .maybeSingle()

    if (moduleError) throw moduleError
    if (!moduleRow) throw forbidden("Modulo indisponivel")

    if (!isAdminPreview) {
      const { data: canAccessRow, error: canAccessError } = await context.serviceClient
        .rpc(
          lessonId ? "can_access_product_lesson" : "can_access_product_module",
          lessonId
            ? { target_lesson_id: lessonId, target_user: context.user.id }
            : { target_module_id: targetModuleId, target_user: context.user.id },
        )

      if (canAccessError) throw canAccessError
      if (!canAccessRow) throw forbidden("Voce nao possui acesso a este PDF")
    }

    const sourceStoragePath = lessonId ? lessonRow?.lesson_file_storage_path ?? null : moduleRow.module_pdf_storage_path
    const sourceFileName = lessonId ? lessonRow?.lesson_file_name ?? null : moduleRow.module_pdf_file_name
    const sourceStorageProvider = lessonId
      ? lessonRow?.lesson_file_storage_provider ?? null
      : moduleRow.module_pdf_storage_provider

    if (!sourceStoragePath || !sourceFileName) {
      throw forbidden(lessonId ? "Esta aula nao possui PDF base configurado" : "Este modulo nao possui PDF base configurado")
    }

    const { data: productRow, error: productError } = await context.serviceClient
      .from("products")
      .select("id,title")
      .eq("id", moduleRow.product_id)
      .maybeSingle()

    if (productError) throw productError
    if (!productRow) throw forbidden("Material indisponivel")

    const watermarkConfig = await getWatermarkConfig(context.serviceClient)
    const sourcePdfBytes = await readStorageObject(
      context.serviceClient,
      COURSE_STORAGE_BUCKET,
      sourceStoragePath,
      sourceStorageProvider ?? "supabase",
    )

    let logoBytes: Uint8Array | null = null
    if (watermarkConfig.logo_bucket && watermarkConfig.logo_path) {
      try {
        logoBytes = await readStorageObject(
          context.serviceClient,
          watermarkConfig.logo_bucket,
          watermarkConfig.logo_path,
          watermarkConfig.logo_storage_provider ?? "supabase",
        )
      } catch (error) {
        logError("Module PDF watermark logo load failed", {
          request_id: requestId,
          error: String(error),
          logo_bucket: watermarkConfig.logo_bucket,
          logo_path: watermarkConfig.logo_path,
        })
      }
    }

    const licenseToken = context.user.id.slice(0, 8)
    const licenseLabel = context.profile.full_name?.trim() || context.profile.email?.trim() || `aluno-${licenseToken}`
    const licenseText = `Licenciado para ${licenseLabel} | ${watermarkConfig.site_name}`
    const watermarkedPdfBytes = await buildWatermarkedPdf({
      sourceBytes: sourcePdfBytes,
      siteName: watermarkConfig.site_name,
      licenseText,
      logoBytes,
    })

    const downloadName = sanitizeSegment(
      `${productRow.title}-${lessonId ? "aula" : "modulo"}-${lessonRow?.title ?? moduleRow.title}-${licenseToken}-${sourceFileName}`,
    ) || sourceFileName
    const derivedRoot = lessonId ? "lesson-pdfs" : "module-pdfs"
    const derivedPath = `derived-watermarks/${derivedRoot}/${context.user.id}/${targetModuleId}/${lessonId ?? targetModuleId}/${sanitizeSegment(downloadName) || "material"}.pdf`

    await uploadStorageObject({
      serviceClient: context.serviceClient,
      logicalBucket: COURSE_STORAGE_BUCKET,
      storagePath: derivedPath,
      provider: "r2",
      body: watermarkedPdfBytes,
      contentType: "application/pdf",
    })

    const signedUrl = await createSignedReadUrl({
      serviceClient: context.serviceClient,
      logicalBucket: COURSE_STORAGE_BUCKET,
      storagePath: derivedPath,
      provider: "r2",
      expiresInSeconds: 300,
      downloadFileName: disposition === "attachment" ? downloadName : undefined,
    })

    await writeAuditLog(context.serviceClient, context, {
      action: lessonId ? "student.lesson_pdf_access_requested" : "student.module_pdf_access_requested",
      entityType: lessonId ? "product_lesson" : "product_module",
      entityId: lessonId ?? targetModuleId,
      metadata: {
        module_id: targetModuleId,
        lesson_id: lessonId ?? null,
        product_id: moduleRow.product_id,
        storage_path: sourceStoragePath,
        derived_storage_path: derivedPath,
        file_name: sourceFileName,
        licensed_file_name: downloadName,
        disposition,
        watermark_site_name: watermarkConfig.site_name,
        watermark_logo_path: watermarkConfig.logo_path,
        storage_provider: sourceStorageProvider ?? "supabase",
      },
      ...auditMeta,
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      mode: "signed_url",
      url: signedUrl,
      expires_in_seconds: 300,
      file_name: downloadName,
      disposition,
    })
  } catch (error) {
    logError("Module PDF access failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})
