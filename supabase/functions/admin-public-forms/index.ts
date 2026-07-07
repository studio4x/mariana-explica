import { badRequest, notFound } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  buildPublicFormReplyEmail,
  extractRequestAuditContext,
  queueEmailDelivery,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

interface AdminPublicFormsInput {
  action?: "reply"
  submissionId?: string
  subject?: string
  message?: string
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
}

function normalizeMessage(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength)
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
    const body = await readJsonBody<AdminPublicFormsInput>(req)
    const action = body.action ?? "reply"

    if (action !== "reply") {
      throw badRequest("Acao administrativa invalida")
    }

    const submissionId = normalizeText(body.submissionId, 80)
    const customSubject = normalizeText(body.subject, 180)
    const replyMessage = normalizeMessage(body.message, 5000)

    if (!submissionId) {
      throw badRequest("submissionId e obrigatorio")
    }

    if (customSubject && customSubject.length < 2) {
      throw badRequest("Assunto invalido")
    }

    if (replyMessage.length < 2) {
      throw badRequest("Mensagem de resposta invalida")
    }

    const { data: submission, error: submissionError } = await context.serviceClient
      .from("public_form_submissions")
      .select("id,full_name,email,subject,form_type,source_page")
      .eq("id", submissionId)
      .maybeSingle()

    if (submissionError) {
      throw submissionError
    }

    if (!submission) {
      throw notFound("Formulario nao encontrado")
    }

    const delivery = await buildPublicFormReplyEmail(context.serviceClient, {
      fullName: submission.full_name,
      originalSubject: submission.subject,
      message: replyMessage,
      ctaUrl: "/explicacoes",
    })

    const subject =
      customSubject ||
      normalizeText(`Resposta ao seu formulario: ${submission.subject}`, 180) ||
      "Resposta ao seu formulario | Mariana Explica"

    await queueEmailDelivery(context.serviceClient, {
      userId: null,
      notificationId: null,
      emailTo: submission.email,
      templateKey: "public_form_reply",
      subject,
      html: delivery.html,
      text: delivery.text,
      metadata: {
        source: "admin_public_form_reply",
        submission_id: submission.id,
        form_type: submission.form_type,
        source_page: submission.source_page,
      },
    })

    await writeAuditLog(context.serviceClient, context, {
      action: "admin.public_form_reply_sent",
      entityType: "public_form_submission",
      entityId: submission.id,
      metadata: {
        email_to: submission.email,
        subject,
        reply_length: replyMessage.length,
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      submission_id: submission.id,
      email_to: submission.email,
      queued: true,
    })
  } catch (error) {
    logError("Admin public forms action failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
