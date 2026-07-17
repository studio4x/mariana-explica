import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  buildCourseChatMessageCreatedEmail,
  buildSupportTicketRepliedEmail,
  extractRequestAuditContext,
  queueEmailDelivery,
  requireActiveUser,
  writeAuditLog,
} from "../_shared/mod.ts"
import { recordSupportWhatsappIntent } from "../_shared/whatsapp.ts"

interface SupportReplyInput {
  ticketId: string
  message?: string
  status?: "open" | "in_progress" | "answered" | "closed"
  priority?: "low" | "normal" | "medium" | "high" | "urgent"
  attachment?: {
    bucket: string
    path: string
    storage_provider?: "supabase" | "r2" | null
    file_name: string
    mime_type?: string | null
    file_size_bytes?: number | null
  } | null
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
    const body = await readJsonBody<SupportReplyInput>(req)
    const replyMessage = body.message?.trim() ?? ""

    if (!body.ticketId || (!replyMessage && !body.attachment?.path)) {
      throw badRequest("ticketId e message ou attachment sao obrigatorios")
    }

    if (
      body.attachment &&
      (body.attachment.bucket !== "support-attachments" ||
        !body.attachment.path.startsWith(`support/${context.user.id}/`))
    ) {
      throw badRequest("Anexo invalido para este usuario")
    }

    const { data: ticket, error: ticketError } = await context.serviceClient
      .from("support_tickets")
      .select("id,user_id,subject,status,priority,category,product_id")
      .eq("id", body.ticketId)
      .maybeSingle()

    if (ticketError) throw ticketError
    if (!ticket) throw notFound("Ticket nao encontrado")

    if (!context.profile.is_admin && ticket.category === "course_chat" && ticket.product_id) {
      const { data: product, error: productError } = await context.serviceClient
        .from("products")
        .select("course_chat_enabled")
        .eq("id", ticket.product_id)
        .maybeSingle()

      if (productError) throw productError
      if (!product?.course_chat_enabled) {
        throw forbidden("O chat de duvidas nao esta ativado neste material")
      }
    }

    const isOwner = ticket.user_id === context.user.id
    if (!context.profile.is_admin && !isOwner) {
      throw forbidden("Voce nao pode responder este ticket")
    }

    if (!context.profile.is_admin && ticket.status === "closed") {
      throw forbidden("Ticket encerrado nao pode receber nova resposta do usuario")
    }

    const { data: message, error: messageError } = await context.serviceClient
      .from("support_ticket_messages")
      .insert({
        ticket_id: body.ticketId,
        sender_user_id: context.user.id,
        sender_role: context.profile.role === "admin" ? "admin" : "student",
        message: replyMessage,
        attachment_bucket: body.attachment?.bucket ?? null,
        attachment_path: body.attachment?.path ?? null,
        attachment_storage_provider: body.attachment?.storage_provider === "r2" ? "r2" : "supabase",
        attachment_name: body.attachment?.file_name ?? null,
        attachment_mime_type: body.attachment?.mime_type ?? null,
        attachment_size_bytes: body.attachment?.file_size_bytes ?? null,
      })
      .select("*")
      .single()

    if (messageError) throw messageError

    const ticketUpdates: Record<string, unknown> = {}
    if (context.profile.is_admin) {
      if (body.status) ticketUpdates.status = body.status
      if (body.priority) ticketUpdates.priority = body.priority
      ticketUpdates.assigned_admin_id = context.user.id
    } else {
      ticketUpdates.status = "open"
    }

    if (Object.keys(ticketUpdates).length > 0) {
      const { error } = await context.serviceClient
        .from("support_tickets")
        .update(ticketUpdates)
        .eq("id", body.ticketId)

      if (error) throw error
    }

    const preview = (replyMessage || body.attachment?.file_name || "Anexo").slice(0, 180)

    if (context.profile.is_admin) {
      const { data: userProfile, error: userProfileError } = await context.serviceClient
        .from("profiles")
        .select("id,full_name,email")
        .eq("id", ticket.user_id)
        .maybeSingle()

      if (userProfileError) throw userProfileError

      const { data: notification, error: notificationError } = await context.serviceClient.from("notifications").insert({
        user_id: ticket.user_id,
        type: "support",
        title: body.status === "closed" ? "O teu ticket foi encerrado" : "O suporte respondeu ao teu ticket",
        message: preview,
        link: `/aluno/suporte/${ticket.id}`,
        status: "unread",
        sent_via_email: Boolean(userProfile?.email),
        sent_via_in_app: true,
      }).select("id").single()

      if (notificationError) throw notificationError

      if (userProfile?.email) {
        const email = await buildSupportTicketRepliedEmail(context.serviceClient, {
          fullName: userProfile.full_name,
          subject: ticket.subject,
          messagePreview: preview,
          supportUrl: `/aluno/suporte/${ticket.id}`,
        })

        await queueEmailDelivery(context.serviceClient, {
          userId: ticket.user_id,
          notificationId: notification.id,
          emailTo: userProfile.email,
          templateKey: "support_ticket_replied",
          subject: email.subject,
          html: email.html,
          text: email.text,
          metadata: {
            ticket_id: ticket.id,
            message_id: message.id,
          },
        })
      }

      await recordSupportWhatsappIntent(context.serviceClient, {
        event: body.status === "closed" ? "ticket_closed" : "new_message",
        ticketId: ticket.id,
        actorUserId: context.user.id,
        target: "student",
        targetUserId: ticket.user_id,
        messagePreview: preview,
      })
    } else {
      if (ticket.category === "course_chat" && context.profile.email) {
        let productTitle = "material"
        if (ticket.product_id) {
          const { data: product, error: productError } = await context.serviceClient
            .from("products")
            .select("title")
            .eq("id", ticket.product_id)
            .maybeSingle()

          if (productError) throw productError
          productTitle = product?.title ?? productTitle
        }

        const email = await buildCourseChatMessageCreatedEmail(context.serviceClient, {
          fullName: context.profile.full_name,
          productTitle,
          messagePreview: preview,
          chatUrl: `/aluno/suporte/${ticket.id}`,
        })

        await queueEmailDelivery(context.serviceClient, {
          userId: context.user.id,
          emailTo: context.profile.email,
          templateKey: "course_chat_message_created",
          subject: email.subject,
          html: email.html,
          text: email.text,
          metadata: {
            ticket_id: ticket.id,
            message_id: message.id,
            category: ticket.category,
          },
        })
      }

      const { data: adminRecipients, error: adminRecipientsError } = await context.serviceClient
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_admin", true)
        .eq("status", "active")

      if (adminRecipientsError) {
        throw adminRecipientsError
      }

      if ((adminRecipients ?? []).length > 0) {
        const { error: adminNotificationError } = await context.serviceClient.from("notifications").insert(
          (adminRecipients ?? []).map((admin) => ({
            user_id: admin.id,
            type: "support",
            title: "Nova resposta em ticket",
            message: `${context.profile.full_name || context.profile.email || "Aluno"} respondeu: ${preview}`.slice(0, 180),
            link: `/admin/suporte/${ticket.id}`,
            status: "unread",
            sent_via_email: false,
            sent_via_in_app: true,
          })),
        )

        if (adminNotificationError) {
          throw adminNotificationError
        }
      }

      await recordSupportWhatsappIntent(context.serviceClient, {
        event: "new_message",
        ticketId: ticket.id,
        actorUserId: context.user.id,
        target: "admin",
        messagePreview: preview,
      })
    }

    await writeAuditLog(context.serviceClient, context, {
      action: "support.ticket_reply",
      entityType: "support_ticket",
      entityId: body.ticketId,
      metadata: {
        message_id: message.id,
        is_admin_reply: context.profile.is_admin,
        status: body.status ?? null,
        priority: body.priority ?? null,
        has_attachment: Boolean(body.attachment?.path),
      },
      ...extractRequestAuditContext(req),
    })

    return jsonResponse({ success: true, request_id: requestId, message })
  } catch (error) {
    logError("Support ticket reply failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
