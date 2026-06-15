import { unprocessable } from "../_shared/errors.ts"
import type { AiEditPlan } from "./contract.ts"

export interface PersistiblePageEditorProposal {
  summary: string
  explanation: string
  warnings: string[]
  edit_plan: AiEditPlan
  proposal: {
    slug: string
    title: string
    layout_json: Record<string, unknown>
    style_json: Record<string, unknown>
    metadata: Record<string, unknown>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeWarningList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
}

function throwIncompleteProposal(stage: string, reason: string) {
  throw unprocessable(
    "A proposta final da IA ficou incompleta antes da resposta. Revise o pedido e tente novamente.",
    {
      stage,
      reason,
    },
  )
}

function requireNonEmptyString(value: unknown, stage: string, reason: string) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    throwIncompleteProposal(stage, reason)
  }
  return normalized
}

function requireJsonRecord(value: unknown, stage: string, reason: string) {
  if (!isRecord(value)) {
    throwIncompleteProposal(stage, reason)
  }
  return value
}

export function requirePersistiblePageEditorProposal(
  value: unknown,
  stage: string,
  options?: {
    allowMissingEditPlan?: boolean
  },
): PersistiblePageEditorProposal {
  if (!isRecord(value)) {
    throwIncompleteProposal(stage, "missing_root")
  }

  const proposal = requireJsonRecord(value.proposal, stage, "missing_proposal")
  const metadata = isRecord(proposal.metadata) ? proposal.metadata : {}
  const editPlan =
    value.edit_plan === undefined && options?.allowMissingEditPlan
      ? ({
          scope: "section",
          mode: "spacing_patch",
          target_ids: [],
          risk_level: "medium",
          requires_strict_confirmation: true,
          operations: [],
        } satisfies AiEditPlan)
      : requireJsonRecord(value.edit_plan, stage, "missing_edit_plan") as AiEditPlan

  return {
    summary: requireNonEmptyString(value.summary, stage, "missing_summary"),
    explanation: requireNonEmptyString(value.explanation, stage, "missing_explanation"),
    warnings: normalizeWarningList(value.warnings),
    edit_plan: editPlan,
    proposal: {
      slug: requireNonEmptyString(proposal.slug, stage, "missing_slug"),
      title: requireNonEmptyString(proposal.title, stage, "missing_title"),
      layout_json: requireJsonRecord(proposal.layout_json, stage, "missing_layout_json"),
      style_json: requireJsonRecord(proposal.style_json, stage, "missing_style_json"),
      metadata,
    },
  }
}

export function extractPersistibleProposalInvariants(
  proposal: Pick<PersistiblePageEditorProposal, "proposal">,
) {
  const invariants = proposal.proposal.metadata.ai_invariants
  return isRecord(invariants) ? invariants : {}
}
