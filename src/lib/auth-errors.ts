export function isEmailNotConfirmedError(message: string) {
  return message.trim().toLowerCase().includes("email not confirmed")
}

export function mapAuthErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase()

  if (isEmailNotConfirmedError(message)) {
    return "O teu email ainda não foi confirmado. Abre o email de validação e clica no botão para ativar a conta."
  }

  if (normalized.includes("invalid login credentials")) {
    return "Email ou palavra-passe incorretos."
  }

  if (normalized.includes("user already registered")) {
    return "Este email já esta registado. Tenta entrar ou recuperar o acesso."
  }

  if (normalized.includes("signup is disabled")) {
    return "O registo esta temporariamente indisponivel."
  }

  if (normalized.includes("email rate limit exceeded") || normalized.includes("over_email_send_rate_limit")) {
    return "Foram pedidos vários emails num curto intervalo. Aguarda alguns minutos e tenta novamente."
  }

  if (normalized.includes("password should be at least")) {
    return "A palavra-passe precisa de ter pelo menos 6 caracteres."
  }

  if (normalized.includes("unable to validate email address")) {
    return "O email informado não e válido."
  }

  if (normalized.includes("same password")) {
    return "Escolhe uma palavra-passe diferente da atual."
  }

  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "O link usado já não e válido. Pede um novo email e tenta novamente."
  }

  return message
}
