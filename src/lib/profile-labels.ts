const roleLabels: Record<string, string> = {
  student: "Aluno",
  affiliate: "Afiliado",
  admin: "Administrador",
}

const statusLabels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
  pending_review: "Pendente de análise",
}

export function formatProfileRole(role: string) {
  return roleLabels[role] ?? role
}

export function formatProfileStatus(status: string) {
  return statusLabels[status] ?? status
}
