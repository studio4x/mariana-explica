export interface AuthEmailMessage {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export function buildAuthVerificationUrl(
  supabaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo?: string,
) {
  if (!supabaseUrl.trim()) {
    throw new Error("SUPABASE_URL não configurado")
  }

  const url = new URL("/auth/v1/verify", supabaseUrl)
  url.searchParams.set("token", tokenHash)
  url.searchParams.set("type", type)
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo)
  return url.toString()
}

export function buildAuthEmailMessage(type: string, name: string, link: string): AuthEmailMessage {
  const labels: Record<string, [string, string]> = {
    signup: ["Confirma a tua conta | Mariana Explica", "Confirma o teu cadastro na Mariana Explica."],
    recovery: ["Recuperação de senha | Mariana Explica", "Recebemos um pedido para redefinir a tua senha."],
    invite: ["Convite para a Mariana Explica", "Foste convidado para aceder à Mariana Explica."],
    magiclink: ["O teu acesso | Mariana Explica", "Usa este link para entrar na Mariana Explica."],
    email_change: ["Confirmação de alteração de e-mail | Mariana Explica", "Confirma esta alteração segura de e-mail."],
    reauthentication: ["Confirma a tua identidade | Mariana Explica", "Usa este link para confirmar a tua identidade."],
  }
  const [subject, intro] = labels[type] ?? ["Ação de segurança | Mariana Explica", "Segue o link para concluir a ação solicitada."]
  const greeting = name ? `Olá, ${name}.` : "Olá."

  return {
    subject,
    html: `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(link)}">Continuar</a></p><p>Se não reconheces este pedido, ignora este e-mail.</p>`,
    text: `${greeting}\n\n${intro}\n\n${link}\n\nSe não reconheces este pedido, ignora este e-mail.`,
  }
}
