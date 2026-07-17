import {
  corsResponse,
  errorResponse,
  extractRequestAuditContext,
  getRequestId,
  jsonResponse,
  previewPlatformEmailTemplate,
  readJsonBody,
  requireAdmin,
  resetPlatformEmailTemplate,
  savePlatformEmailTemplate,
  fetchPlatformEmailTemplatesConfig,
  writeAuditLog,
  type PlatformEmailTemplateContent,
  type PlatformTemplateKey,
} from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { logError } from "../_shared/logger.ts"

type AdminEmailTemplatesInput =
  | {
      action: "list"
    }
  | {
      action: "preview"
      templateKey: PlatformTemplateKey
      content?: PlatformEmailTemplateContent
    }
  | {
      action: "update"
      templateKey: PlatformTemplateKey
      content: PlatformEmailTemplateContent
    }
  | {
      action: "reset"
      templateKey: PlatformTemplateKey
    }

function isTemplateKey(value: unknown): value is PlatformTemplateKey {
  return [
    "purchase_confirmed",
    "free_product_claimed",
    "support_ticket_created",
    "support_ticket_replied",
    "course_chat_message_created",
    "manual_notification",
    "public_form_submission_admin",
    "public_form_reply",
  ].includes(String(value ?? ""))
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
    const body = await readJsonBody<AdminEmailTemplatesInput>(req)
    const action = body.action ?? "list"

    if (action === "list") {
      const config = await fetchPlatformEmailTemplatesConfig(context.serviceClient)

      return jsonResponse({
        success: true,
        request_id: requestId,
        config,
      })
    }

    if (!("templateKey" in body) || !isTemplateKey(body.templateKey)) {
      throw badRequest("templateKey invalido")
    }

    if (action === "preview") {
      const preview = await previewPlatformEmailTemplate(context.serviceClient, body.templateKey, body.content)

      return jsonResponse({
        success: true,
        request_id: requestId,
        preview,
      })
    }

    if (action === "update") {
      if (!body.content || typeof body.content !== "object") {
        throw badRequest("content e obrigatorio")
      }

      const result = await savePlatformEmailTemplate(context.serviceClient, body.templateKey, body.content)

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.email_template_updated",
        entityType: "site_config",
        entityId: result.config.config_key,
        metadata: {
          template_key: body.templateKey,
          category: result.template.category,
        },
        ...extractRequestAuditContext(req),
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        config: result.config,
        template: result.template,
      })
    }

    const result = await resetPlatformEmailTemplate(context.serviceClient, body.templateKey)

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.email_template_reset",
      entityType: "site_config",
      entityId: result.config.config_key,
      metadata: {
        template_key: body.templateKey,
        category: result.template.category,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      config: result.config,
      template: result.template,
    })
  } catch (error) {
    logError("Admin email templates failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
