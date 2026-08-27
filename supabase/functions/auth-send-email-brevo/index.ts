import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"
import { fetchBrevoSettings, sendBrevoTransactionalEmail, safeBrevoError, createServiceClient } from "../_shared/mod.ts"
import { logError } from "../_shared/logger.ts"

interface HookPayload {
  user?: { id?: string; email?: string; new_email?: string; user_metadata?: { full_name?: string } }
  email_data?: {
    token?: string
    token_hash?: string
    redirect_to?: string
    email_action_type?: string
    site_url?: string
    token_new?: string
    token_hash_new?: string
    old_email?: string
  }
}

function secret() {
  return (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,whsec_/, "")
}

function verificationUrl(siteUrl: string, token: string, tokenHash: string, type: string, redirectTo?: string) {
  const url = new URL("/auth/v1/verify", siteUrl)
  url.searchParams.set("token", token)
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", type)
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo)
  return url.toString()
}

function messageFor(type: string, name: string, link: string, token: string) {
  const labels: Record<string, [string, string]> = {
    signup: ["Confirma a tua conta | Mariana Explica", "Confirma o teu cadastro na Mariana Explica."],
    recovery: ["Recuperação de senha | Mariana Explica", "Recebemos um pedido para redefinir a tua senha."],
    invite: ["Convite para a Mariana Explica", "Foste convidado para aceder à Mariana Explica."],
    magiclink: ["O teu acesso | Mariana Explica", "Usa este link para entrar na Mariana Explica."],
    email_change: ["Confirmação de alteração de e-mail | Mariana Explica", "Confirma esta alteração segura de e-mail."],
    reauthentication: ["Confirma a tua identidade | Mariana Explica", "Usa este código para confirmar a tua identidade."],
  }
  const [subject, intro] = labels[type] ?? ["Ação de segurança | Mariana Explica", "Segue o link para concluir a ação solicitada."]
  const greeting = name ? `Olá, ${name}.` : "Olá."
  return {
    subject,
    html: `<p>${greeting}</p><p>${intro}</p><p><a href="${link}">Continuar</a></p><p>Se o botão não funcionar, usa este código: <strong>${token}</strong></p><p>Se não reconheces este pedido, ignora este e-mail.</p>`,
    text: `${greeting}\n\n${intro}\n\n${link}\n\nCódigo: ${token}\n\nSe não reconheces este pedido, ignora este e-mail.`,
  }
}

async function sendOne(client: ReturnType<typeof createServiceClient>, settings: Awaited<ReturnType<typeof fetchBrevoSettings>>, input: { to: string; type: string; token: string; tokenHash: string; siteUrl: string; redirectTo?: string; name: string; userId?: string }) {
  const link = verificationUrl(input.siteUrl, input.token, input.tokenHash, input.type, input.redirectTo)
  const message = messageFor(input.type, input.name, link, input.token)
  let deliveryUserId: string | null = null
  if (input.userId) {
    // During signup, Auth invokes the HTTP hook before its transaction (and the
    // profile trigger) is committed. Referencing that pending profile would
    // violate email_deliveries_user_id_fkey and abort the account creation.
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id")
      .eq("id", input.userId)
      .maybeSingle()
    if (profileError) throw profileError
    deliveryUserId = profile?.id ?? null
  }
  const { data: delivery, error } = await client.from("email_deliveries").insert({
    user_id: deliveryUserId,
    email_to: input.to.trim().toLowerCase(),
    template_key: `auth_${input.type}`,
    status: "queued",
    subject: message.subject,
    html_content: message.html,
    text_content: message.text,
    provider: "brevo",
    origin: "supabase_auth_hook",
    metadata: { source: "supabase-auth-hook", action_type: input.type },
  }).select("id").single()
  if (error) throw error
  try {
    const result = await sendBrevoTransactionalEmail(client, { emailTo: input.to, subject: message.subject, html: message.html, text: message.text, metadata: { delivery_id: delivery.id, template_key: `auth_${input.type}`, source: "supabase_auth_hook" } })
    await client.from("email_deliveries").update({ status: "sent", provider_message_id: result.providerMessageId, sent_at: new Date().toISOString() }).eq("id", delivery.id)
  } catch (error) {
    await client.from("email_deliveries").update({ status: "failed", error_message: safeBrevoError(error) }).eq("id", delivery.id)
    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("not allowed", { status: 400 })
  const hookSecret = secret()
  if (!hookSecret) return new Response(JSON.stringify({ error: { message: "SEND_EMAIL_HOOK_SECRET não configurado" } }), { status: 500 })
  try {
    const payloadText = await req.text()
    const payload = new Webhook(hookSecret).verify(payloadText, Object.fromEntries(req.headers)) as HookPayload
    const user = payload.user ?? {}
    const data = payload.email_data ?? {}
    const type = data.email_action_type ?? "signup"
    const siteUrl = data.site_url ?? "https://mariana-explica.pt"
    const redirectTo = data.redirect_to
    const name = user.user_metadata?.full_name?.trim() ?? ""
    const client = createServiceClient()
    await fetchBrevoSettings(client)

    const common = { type, siteUrl, redirectTo, name, userId: user.id }
    if (type === "email_change" && user.email && user.new_email && data.token && data.token_hash_new && data.token_new && data.token_hash) {
      // Supabase intentionally names these pairs backwards for compatibility:
      // current address = token + token_hash_new; new address = token_new + token_hash.
      await sendOne(client, await fetchBrevoSettings(client), { ...common, to: user.email, token: data.token, tokenHash: data.token_hash_new })
      await sendOne(client, await fetchBrevoSettings(client), { ...common, to: user.new_email, token: data.token_new, tokenHash: data.token_hash })
    } else {
      const to = type === "email_change" ? user.new_email ?? user.email : user.email
      const token = data.token || data.token_new
      const tokenHash = data.token_hash || data.token_hash_new
      if (!to || !token || !tokenHash) throw new Error("Payload do Auth Hook sem destinatário ou par token/hash")
      await sendOne(client, await fetchBrevoSettings(client), { ...common, to, token, tokenHash })
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (error) {
    logError("Supabase Auth Brevo hook failed", { error: safeBrevoError(error) })
    return new Response(JSON.stringify({ error: { message: "Falha ao enviar e-mail de autenticação" } }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
