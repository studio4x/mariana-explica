import type { EmailLayoutInput } from "../_shared/email-layout.ts"

export interface AuthEmailMessage {
  subject: string
  layout: Omit<EmailLayoutInput, "headerLogoUrl">
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
  const definitions: Record<string, {
    subject: string
    eyebrow: string
    title: string
    intro: string
    ctaLabel: string
    footer: string
  }> = {
    signup: {
      subject: "Confirma a tua conta | Mariana Explica",
      eyebrow: "Verificação da conta",
      title: "Confirma o teu email",
      intro: "A tua conta na Mariana Explica ficou quase pronta. Clica no botão abaixo para validar o email e entrar automaticamente na tua área do aluno.",
      ctaLabel: "Validar conta",
      footer: "Se não foste tu a criar esta conta, podes ignorar este email com segurança.",
    },
    recovery: {
      subject: "Recuperação de senha | Mariana Explica",
      eyebrow: "Recuperação de acesso",
      title: "Define uma nova palavra-passe",
      intro: "Recebemos um pedido para redefinir a palavra-passe da tua conta.",
      ctaLabel: "Redefinir palavra-passe",
      footer: "Se não pediste esta alteração, podes ignorar este email com segurança.",
    },
    invite: {
      subject: "Convite para a Mariana Explica",
      eyebrow: "Convite",
      title: "Foste convidado para a Mariana Explica",
      intro: "Confirma o teu email para aceitares o convite e preparares o teu acesso.",
      ctaLabel: "Aceitar convite",
      footer: "Se não esperavas este convite, podes ignorar este email com segurança.",
    },
    magiclink: {
      subject: "O teu acesso | Mariana Explica",
      eyebrow: "Acesso seguro",
      title: "Entra na Mariana Explica",
      intro: "Usa o botão abaixo para entrares na tua conta com segurança.",
      ctaLabel: "Entrar na minha conta",
      footer: "Se não pediste este acesso, podes ignorar este email com segurança.",
    },
    email_change: {
      subject: "Confirmação de alteração de e-mail | Mariana Explica",
      eyebrow: "Alteração de email",
      title: "Confirma o teu novo email",
      intro: "Confirma esta alteração para manteres os dados de acesso à tua conta atualizados.",
      ctaLabel: "Confirmar alteração",
      footer: "Se não pediste esta alteração, entra em contacto com o suporte.",
    },
    reauthentication: {
      subject: "Confirma a tua identidade | Mariana Explica",
      eyebrow: "Verificação de segurança",
      title: "Confirma a tua identidade",
      intro: "Usa o botão abaixo para confirmares a tua identidade e continuares a operação em segurança.",
      ctaLabel: "Confirmar identidade",
      footer: "Se não reconheces este pedido, podes ignorar este email com segurança.",
    },
  }
  const definition = definitions[type] ?? {
    subject: "Ação de segurança | Mariana Explica",
    eyebrow: "Segurança da conta",
    title: "Confirma esta ação",
    intro: "Usa o botão abaixo para concluíres a ação solicitada em segurança.",
    ctaLabel: "Continuar",
    footer: "Se não reconheces este pedido, podes ignorar este email com segurança.",
  }
  const greeting = name ? `Olá, ${name}.` : "Olá."

  return {
    subject: definition.subject,
    layout: {
      eyebrow: definition.eyebrow,
      title: definition.title,
      greeting,
      intro: definition.intro,
      ctaLabel: definition.ctaLabel,
      ctaUrl: link,
      footer: definition.footer,
    },
  }
}
