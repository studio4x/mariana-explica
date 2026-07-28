import { badRequest, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  encryptBrevoApiKey,
  fetchBrevoSettings,
  getBrevoAccount,
  getBrevoAttributes,
  getBrevoConsentGroups,
  getBrevoCredentialStatus,
  getBrevoEmailEvents,
  getBrevoLists,
  requireAdmin,
  safeBrevoError,
  saveBrevoSettings,
  sendBrevoTransactionalEmail,
  syncBrevoContact,
  writeAuditLog,
} from "../_shared/mod.ts"

type Action = "overview" | "save_credentials" | "save_settings" | "check_connection" | "catalog" | "send_test" | "history" | "contacts" | "retry_contact" | "retry_failed_contacts" | "sync_contact"
interface Input { action: Action; apiKey?: string; enabled?: boolean; senderName?: string; senderEmail?: string; replyTo?: string; leadListId?: number | null; consentGroupId?: number | null; attributeMapping?: Record<string, string>; emailTo?: string; contactSyncId?: string; query?: string; status?: string; offset?: number; limit?: number; days?: number; event?: string; syncRemote?: boolean }

function validEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("E-mail inválido")
  return email
}

async function syncEvents(serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"], days: number) {
  const remote = await getBrevoEmailEvents(serviceClient, { days, limit: 500 })
  for (const event of remote.events ?? []) {
    const messageId = String(event.messageId ?? event["message-id"] ?? "").trim() || null
    const email = String(event.email ?? "").trim().toLowerCase() || null
    const eventName = String(event.event ?? "unknown").toLowerCase()
    const eventAt = String(event.date ?? "").trim() || null
    const eventKey = [messageId ?? email ?? "unknown", eventName, eventAt ?? "unknown"].join(":")
    await serviceClient.from("brevo_email_events").upsert({
      event_key: eventKey,
      message_id: messageId,
      email,
      subject: event.subject ? String(event.subject) : null,
      event: eventName,
      reason: event.reason ? String(event.reason).slice(0, 500) : null,
      event_at: eventAt,
      source: "api_reconciliation",
      payload: event,
    }, { onConflict: "event_key" })

    if (messageId) {
      const localStatus = eventName === "delivered" ? "delivered" : ["hard_bounce", "soft_bounce", "blocked", "invalid", "bounced"].includes(eventName) ? "bounced" : ["error", "failed"].includes(eventName) ? "failed" : eventName === "sent" ? "sent" : null
      await serviceClient.from("email_deliveries").update({
        ...(localStatus ? { status: localStatus } : {}),
        last_event_at: eventAt,
        last_event: eventName,
        error_message: event.reason ? String(event.reason).slice(0, 500) : undefined,
      }).eq("provider_message_id", messageId)
    }
  }
  return remote.events ?? []
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")
    const context = await requireAdmin(req)
    const body = await readJsonBody<Input>(req)
    const action = body.action ?? "overview"

    if (action === "overview") {
      const [credentials, settings, contacts, events] = await Promise.all([
        getBrevoCredentialStatus(context.serviceClient),
        fetchBrevoSettings(context.serviceClient),
        context.serviceClient.from("brevo_contact_syncs").select("id,email,status,brevo_contact_id,list_id,consent_group_id,consent_at,consent_source,source_product_id,source_order_id,last_synced_at,last_error,created_at,updated_at", { count: "exact" }).order("created_at", { ascending: false }).limit(10),
        context.serviceClient.from("brevo_email_events").select("id,event,message_id,email,subject,reason,event_at,created_at", { count: "exact" }).order("event_at", { ascending: false }).limit(10),
      ])
      if (contacts.error) throw contacts.error
      if (events.error) throw events.error
      return jsonResponse({ success: true, request_id: requestId, credentials, settings, contacts: contacts.data ?? [], events: events.data ?? [] })
    }

    if (action === "save_credentials") {
      const apiKey = body.apiKey?.trim() ?? ""
      if (apiKey.length < 20 || apiKey.length > 300) throw badRequest("API key Brevo inválida")
      const ciphertext = await encryptBrevoApiKey(apiKey)
      const { error } = await context.serviceClient.rpc("store_brevo_credentials", { p_api_key_ciphertext: ciphertext, p_actor_user_id: context.user.id })
      if (error) throw error
      await writeAuditLog(context.serviceClient, context, { action: "admin.brevo_credentials_replaced", entityType: "brevo_credentials", metadata: { replaced: true } })
      return jsonResponse({ success: true, request_id: requestId, credentials: await getBrevoCredentialStatus(context.serviceClient) })
    }

    if (action === "save_settings") {
      const settings = await saveBrevoSettings(context.serviceClient, {
        enabled: body.enabled === true,
        senderName: body.senderName,
        senderEmail: body.senderEmail,
        replyTo: body.replyTo,
        leadListId: body.leadListId ?? null,
        consentGroupId: body.consentGroupId ?? null,
        attributeMapping: body.attributeMapping,
        actorUserId: context.user.id,
      })
      await writeAuditLog(context.serviceClient, context, { action: "admin.brevo_settings_updated", entityType: "brevo_integration_settings", metadata: { enabled: settings.enabled, lead_list_id: settings.lead_list_id, consent_group_id: settings.consent_group_id, sender_email_configured: Boolean(settings.sender_email) } })
      return jsonResponse({ success: true, request_id: requestId, settings })
    }

    if (action === "check_connection") {
      try {
        const account = await getBrevoAccount(context.serviceClient)
        const safeAccount = { email: account.email ?? null, companyName: account.companyName ?? null, plan: account.plan ?? null, credits: account.credits ?? null }
        await context.serviceClient.from("brevo_integration_settings").update({ last_account: safeAccount, last_connection_check_at: new Date().toISOString(), last_connection_error: null }).eq("singleton_key", true)
        await writeAuditLog(context.serviceClient, context, { action: "admin.brevo_connection_checked", entityType: "brevo_account", metadata: { success: true } })
        return jsonResponse({ success: true, request_id: requestId, account: safeAccount })
      } catch (error) {
        const message = safeBrevoError(error)
        await context.serviceClient.from("brevo_integration_settings").update({ last_connection_check_at: new Date().toISOString(), last_connection_error: message }).eq("singleton_key", true)
        return jsonResponse({ success: false, request_id: requestId, message }, 502)
      }
    }

    if (action === "catalog") {
      const [lists, attributes] = await Promise.all([getBrevoLists(context.serviceClient), getBrevoAttributes(context.serviceClient)])
      let consentGroups: Record<string, unknown>[] = []
      let consentGroupsEnabled = false
      try {
        consentGroups = (await getBrevoConsentGroups(context.serviceClient)).consentGroups ?? []
        consentGroupsEnabled = true
      } catch {
        // Consent Groups are optional and account-dependent. A failure here
        // must never hide the regular lists and attributes from the admin.
        consentGroups = []
        consentGroupsEnabled = false
      }
      return jsonResponse({ success: true, request_id: requestId, lists: lists.lists ?? [], attributes: attributes.attributes ?? [], consentGroups, consentGroupsEnabled })
    }

    if (action === "send_test") {
      const emailTo = validEmail(body.emailTo)
      const now = new Date().toISOString()
      const { data: delivery, error } = await context.serviceClient.from("email_deliveries").insert({ email_to: emailTo, template_key: "admin_test_email", status: "queued", subject: "Teste Brevo | Mariana Explica", html_content: `<p>Teste operacional enviado pela API HTTP da Brevo.</p><p>${now}</p>`, text_content: `Teste operacional enviado pela API HTTP da Brevo.\n${now}`, origin: "admin_brevo", metadata: { source: "admin-brevo", requested_by: context.user.id } }).select("id,email_to,template_key,status,subject,created_at").single()
      if (error) throw error
      try {
        const result = await sendBrevoTransactionalEmail(context.serviceClient, { emailTo, subject: "Teste Brevo | Mariana Explica", html: `<p>Teste operacional enviado pela API HTTP da Brevo.</p><p>${now}</p>`, text: `Teste operacional enviado pela API HTTP da Brevo.\n${now}`, metadata: { delivery_id: delivery.id, template_key: "admin_test_email", source: "admin_brevo" } })
        const { data: updated } = await context.serviceClient.from("email_deliveries").update({ status: "sent", provider: result.provider, provider_message_id: result.providerMessageId, sent_at: now }).eq("id", delivery.id).select("id,email_to,template_key,status,provider,provider_message_id,subject,created_at").single()
        await writeAuditLog(context.serviceClient, context, { action: "admin.brevo_test_email_sent", entityType: "email_delivery", entityId: delivery.id, metadata: { email_to: emailTo, provider_message_id: result.providerMessageId } })
        return jsonResponse({ success: true, request_id: requestId, delivery: updated ?? delivery })
      } catch (error) {
        await context.serviceClient.from("email_deliveries").update({ status: "failed", error_message: safeBrevoError(error) }).eq("id", delivery.id)
        throw error
      }
    }

    if (action === "history") {
      if (body.syncRemote !== false) await syncEvents(context.serviceClient, body.days ?? 30)
      let query = context.serviceClient.from("email_deliveries").select("id,user_id,notification_id,email_to,template_key,provider,provider_message_id,status,error_message,sent_at,created_at,subject,last_event_at,last_event,origin", { count: "exact" }).order("created_at", { ascending: false })
      if (body.query?.trim()) query = query.or(`email_to.ilike.%${body.query.trim()}%,subject.ilike.%${body.query.trim()}%`)
      if (body.status && body.status !== "all") query = query.eq("status", body.status)
      const limit = Math.min(100, Math.max(1, body.limit ?? 50)); const offset = Math.max(0, body.offset ?? 0)
      const result = await query.range(offset, offset + limit - 1)
      if (result.error) throw result.error
      const ids = (result.data ?? []).map((row) => row.provider_message_id).filter(Boolean)
      const events = ids.length ? await context.serviceClient.from("brevo_email_events").select("id,message_id,email,subject,event,reason,event_at,created_at").in("message_id", ids).order("event_at", { ascending: false }) : { data: [], error: null }
      if (events.error) throw events.error
      return jsonResponse({ success: true, request_id: requestId, rows: result.data ?? [], events: events.data ?? [], count: result.count ?? 0 })
    }

    if (action === "contacts") {
      let query = context.serviceClient.from("brevo_contact_syncs").select("id,user_id,email,brevo_contact_id,list_id,consent_group_id,consent_granted,consent_at,consent_source,source_product_id,source_order_id,status,last_synced_at,last_error,remote_snapshot,created_at,updated_at", { count: "exact" }).order("created_at", { ascending: false })
      if (body.query?.trim()) query = query.ilike("email", `%${body.query.trim()}%`)
      if (body.status && body.status !== "all") query = query.eq("status", body.status)
      const limit = Math.min(100, Math.max(1, body.limit ?? 50)); const offset = Math.max(0, body.offset ?? 0)
      const result = await query.range(offset, offset + limit - 1)
      if (result.error) throw result.error
      return jsonResponse({ success: true, request_id: requestId, rows: result.data ?? [], count: result.count ?? 0 })
    }

    if (action === "retry_failed_contacts") {
      const { error } = await context.serviceClient.from("brevo_contact_syncs").update({ status: "queued", next_attempt_at: new Date().toISOString(), last_error: null }).eq("status", "failed")
      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId })
    }

    if (action === "retry_contact") {
      if (!body.contactSyncId) throw badRequest("contactSyncId obrigatório")
      const { error } = await context.serviceClient.from("brevo_contact_syncs").update({ status: "queued", next_attempt_at: new Date().toISOString(), last_error: null }).eq("id", body.contactSyncId)
      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId })
    }

    if (action === "sync_contact") {
      if (!body.contactSyncId) throw badRequest("contactSyncId obrigatório")
      const { data: row, error } = await context.serviceClient.from("brevo_contact_syncs").select("id,user_id,email,source_product_id,source_order_id,consent_at,consent_source,consent_evidence").eq("id", body.contactSyncId).maybeSingle()
      if (error) throw error
      if (!row) throw notFound("Sincronização não encontrada")
      const { data: profile } = row.user_id ? await context.serviceClient.from("profiles").select("full_name,email,nif").eq("id", row.user_id).maybeSingle() : { data: null }
      const { data: product } = row.source_product_id ? await context.serviceClient.from("products").select("title").eq("id", row.source_product_id).maybeSingle() : { data: null }
      const result = await syncBrevoContact(context.serviceClient, { userId: row.user_id, email: row.email, fullName: profile?.full_name, nif: profile?.nif, product: product?.title, productId: row.source_product_id, orderId: row.source_order_id, source: row.consent_source, consentAt: row.consent_at, consentEvidence: row.consent_evidence })
      await context.serviceClient.from("brevo_contact_syncs").update({ status: "synced", brevo_contact_id: result.contactId, remote_snapshot: result, last_synced_at: new Date().toISOString(), last_error: null }).eq("id", row.id)
      return jsonResponse({ success: true, request_id: requestId, result })
    }

    throw badRequest("Ação Brevo inválida")
  } catch (error) {
    logError("Admin Brevo action failed", { request_id: requestId, error: safeBrevoError(error) })
    return errorResponse(error, requestId)
  }
})
