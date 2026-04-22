interface SupportWhatsappIntent {
  event: "new_ticket" | "new_message" | "ticket_closed"
  ticketId: string
  actorUserId: string
  target: "admin" | "student"
  targetUserId?: string | null
  messagePreview?: string | null
}

export async function recordSupportWhatsappIntent(
  serviceClient: any,
  input: SupportWhatsappIntent,
) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select("config_value")
    .eq("config_key", "support_whatsapp_config")
    .maybeSingle()

  if (error) {
    throw error
  }

  const config =
    data?.config_value && typeof data.config_value === "object"
      ? (data.config_value as Record<string, unknown>)
      : {}

  if (config.enabled !== true) {
    return
  }

  const { error: jobError } = await serviceClient.from("job_runs").insert({
    job_name: "support_whatsapp_notification",
    status: "success",
    finished_at: new Date().toISOString(),
    payload: {
      event: input.event,
      ticket_id: input.ticketId,
      actor_user_id: input.actorUserId,
      target: input.target,
      target_user_id: input.targetUserId ?? null,
      message_preview: input.messagePreview ?? null,
      provider: config.provider ?? "whatsapp_cloud_api",
    },
    result: {
      queued: false,
      ready_to_configure: true,
      reason: "WhatsApp Cloud API adapter intentionally not enabled yet. Configure Edge Function secrets and templates to activate sending.",
      required_secrets: [config.phone_number_id_secret ?? "WHATSAPP_PHONE_NUMBER_ID", config.access_token_secret ?? "WHATSAPP_ACCESS_TOKEN"],
    },
  })

  if (jobError) {
    throw jobError
  }
}
