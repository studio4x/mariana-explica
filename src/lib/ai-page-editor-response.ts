import type { AdminAiPageEditorProposal } from "@/types/app.types"

type GenerateProposalResponse = {
  success: true
  provider_used: AdminAiPageEditorProposal["provider_used"]
  summary: string
  explanation: string
  warnings: string[]
  edit_plan: AdminAiPageEditorProposal["edit_plan"]
  proposal: AdminAiPageEditorProposal["proposal"]
}

const INCOMPLETE_PROPOSAL_MESSAGE =
  "O editor com IA recebeu uma resposta incompleta do servidor. Nenhuma alteracao foi aplicada."

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

export function normalizeAdminAiPageEditorError(error: unknown) {
  if (error instanceof Error && /proposal is not defined/i.test(error.message)) {
    return new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return error instanceof Error ? error : new Error("Nao foi possivel gerar a proposta.")
}

export function ensureAdminAiPageEditorProposalResponse(value: unknown): GenerateProposalResponse {
  if (!isRecord(value)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (!hasNonEmptyString(value.provider_used) || !hasNonEmptyString(value.summary) || !hasNonEmptyString(value.explanation)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  if (!Array.isArray(value.warnings) || !isRecord(value.edit_plan) || !isRecord(value.proposal)) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  const proposal = value.proposal
  if (
    !hasNonEmptyString(proposal.slug) ||
    !hasNonEmptyString(proposal.title) ||
    !isRecord(proposal.layout_json) ||
    !isRecord(proposal.style_json) ||
    !isRecord(proposal.metadata)
  ) {
    throw new Error(INCOMPLETE_PROPOSAL_MESSAGE)
  }

  return value as GenerateProposalResponse
}
