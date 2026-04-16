export function mapAuthErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase()

  if (normalized === "email not confirmed") {
    return "O teu email ainda nao foi confirmado. Abre o email de validacao e clica no botao para ativar a conta."
  }

  if (normalized.includes("invalid login credentials")) {
    return "Email ou palavra-passe incorretos."
  }

  if (normalized.includes("user already registered")) {
    return "Este email ja esta registado. Tenta entrar ou recuperar o acesso."
  }

  if (normalized.includes("signup is disabled")) {
    return "O registo esta temporariamente indisponivel."
  }

  if (normalized.includes("password should be at least")) {
    return "A palavra-passe precisa de ter pelo menos 6 caracteres."
  }

  if (normalized.includes("unable to validate email address")) {
    return "O email informado nao e valido."
  }

  if (normalized.includes("same password")) {
    return "Escolhe uma palavra-passe diferente da atual."
  }

  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "O link usado ja nao e valido. Pede um novo email e tenta novamente."
  }

  return message
}
