import type { AiEditPlan } from "./contract.ts"
import type { AiConversationContext } from "./conversation.ts"
import type { AiPageEditorFinalStatus, PersistibleProposalOperationalState } from "./operational-state.ts"
import { resolvePersistibleProposalOperationalState } from "./operational-state.ts"

interface PatchEngineBaseVersionLike {
  id: string
  page_id: string
  version_number: number
  status: string
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
}

interface ImagePatchAttachment {
  id: string
  name: string
  mime_type: string
  data_url: string
  role?: "target_capture" | "insert_image_asset" | "reference_image" | "unknown" | null
}

interface PersistedImageAsset {
  publicUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

interface ImageTargetResolution {
  requested_target_id: string
  resolved_target_id: string
  candidate_path: string
  confidence: number
  section_index: number
  block_type: string
  selector: string
  signals: {
    id_structural: number
    internal_path: number
    data_attributes: number
    nearest_heading: number
    anchor_text: number
    visual_order: number
    textual_similarity: number
    capture_attachment: number
  }
}

type ImagePatchResult =
  | {
      status: "not_applicable"
      reason: "missing_pending_image_insert"
    }
  | {
      status: "failed"
      assistantMessage: string
      understandingSummary: string | null
      warnings: string[]
      reason: string
    }
  | {
      status: "success"
      providerUsed: "gemini" | "openai"
      modelUsed: string
      summary: string
      explanation: string
      assistantMessage: string
      warnings: string[]
      conversationPhase: "ready_for_proposal"
      understandingSummary: string | null
      requiresUserConfirmation: false
      canGenerateProposal: true
      editPlan: AiEditPlan
      proposal: {
        slug: string
        title: string
        layout_json: Record<string, unknown>
        style_json: Record<string, unknown>
        metadata: Record<string, unknown>
      }
      operationalState: PersistibleProposalOperationalState
      resolution: ImageTargetResolution
      asset: PersistedImageAsset
    }

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function extractBlocksFromLayoutJson(layoutJson: Record<string, unknown>) {
  const record = layoutJson && typeof layoutJson === "object" ? layoutJson : {}
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  if (Array.isArray(projectData?.blocks)) {
    return projectData.blocks
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => cloneJson(item as Record<string, unknown>))
  }

  if (Array.isArray(record.blocks)) {
    return record.blocks
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => cloneJson(item as Record<string, unknown>))
  }

  return []
}

function withBlocksAppliedToLayoutJson(layoutJson: Record<string, unknown>, blocks: Record<string, unknown>[]) {
  const record = cloneJson(layoutJson)
  const nextBlocks = cloneJson(blocks)
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? ({ ...(record.projectData as Record<string, unknown>) } satisfies Record<string, unknown>)
      : {}

  projectData.blocks = nextBlocks
  record.projectData = projectData
  record.blocks = nextBlocks
  return record
}

function findNearestHeadingText(blocks: Record<string, unknown>[], sectionIndex: number) {
  for (let index = sectionIndex; index >= 0; index -= 1) {
    const block = blocks[index]
    const content = normalizeText(block?.content)
    const headingMatch = content.match(/([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][^.?!]{4,90})/)
    if (headingMatch?.[1]) return headingMatch[1]
  }
  return null
}

function buildGeneratedAlt(blocks: Record<string, unknown>[], sectionIndex: number) {
  const heading = findNearestHeadingText(blocks, sectionIndex)
  if (heading) {
    return `Imagem ilustrativa da secao ${heading}`
  }
  return "Imagem ilustrativa da secao selecionada"
}

function updateRichTextPlaceholderImage(content: string, src: string, alt: string) {
  const normalized = String(content ?? "")
  const placeholderPattern =
    /<img\b([^>]*?)\bsrc=(["'])(?:data:image\/[^"']+|#|)\2([^>]*?)\balt=(["'])Nova imagem\4([^>]*?)\/?>/i
  if (placeholderPattern.test(normalized)) {
    return normalized.replace(
      placeholderPattern,
      `<img$1src="${src}"$3alt="${alt}"$5 />`,
    )
  }

  const genericPlaceholderPattern = /<img\b([^>]*?)\balt=(["'])Nova imagem\2([^>]*?)\/?>/i
  if (genericPlaceholderPattern.test(normalized)) {
    return normalized.replace(
      genericPlaceholderPattern,
      `<img$1alt="${alt}" src="${src}"$3 />`,
    )
  }

  return null
}

function blockContainsPlaceholderImage(block: Record<string, unknown>) {
  const blockType = String(block.type ?? "").toLowerCase()
  if (blockType === "image") {
    const src = normalizeText(block.src).toLowerCase()
    const alt = normalizeText(block.alt).toLowerCase()
    return !src || alt === "nova imagem" || src.startsWith("data:image/")
  }
  if (blockType === "rich_text") {
    const content = String(block.content ?? "")
    return /<img\b/i.test(content) && /Nova imagem/i.test(content)
  }
  return false
}

function resolveImageTargetCandidate(blocks: Record<string, unknown>[], currentHtml: string) {
  const htmlContainsPlaceholder = /Nova imagem/i.test(currentHtml)
  let best:
    | {
        block: Record<string, unknown>
        sectionIndex: number
        confidence: number
        targetId: string
        blockType: string
        candidatePath: string
        selector: string
      }
    | null = null

  blocks.forEach((block, index) => {
    const blockType = String(block.type ?? "").toLowerCase()
    let confidence = 0

    if (blockContainsPlaceholderImage(block)) {
      confidence = blockType === "image" ? 0.9 : 0.94
    } else if (blockType === "image") {
      confidence = 0.58
    }

    if (confidence > 0 && htmlContainsPlaceholder) {
      confidence += 0.03
    }

    if (!best || confidence > best.confidence) {
      best = {
        block,
        sectionIndex: index,
        confidence: Math.min(0.99, confidence),
        targetId: String(block.id ?? `block-${index + 1}`),
        blockType,
        candidatePath: `projectData.blocks.${index}`,
        selector: `.me-managed-page-root > .me-managed-block:nth-of-type(${index + 1})`,
      }
    }
  })

  return best
}

function buildImageEditPlan(targetId: string): AiEditPlan {
  return {
    scope: "block",
    mode: "image_patch",
    target_ids: [targetId],
    risk_level: "low",
    requires_strict_confirmation: false,
    operations: [
      {
        type: "set_asset",
        target_id: targetId,
        path: "image.src",
        breakpoint: "all",
      },
    ],
  }
}

export async function materializeImageInsertProposal(input: {
  providerUsed: "gemini" | "openai"
  modelUsed: string
  slug: string
  title: string
  path: string
  conversationContext: AiConversationContext
  confirmationMessage: string
  baseVersion: PatchEngineBaseVersionLike
  baseVersionSource: "latest_draft" | "published_version" | "none"
  degradedDraftBypassed: boolean
  baseVersionSelectionReason: string
  publishedVersionId?: string | null
  latestDraftId?: string | null
  currentHtml?: string | null
  attachments: ImagePatchAttachment[]
  persistImageAsset: (source:
    | { kind: "attachment"; attachment: ImagePatchAttachment }
    | { kind: "url"; imageUrl: string }) => Promise<PersistedImageAsset>
}): Promise<ImagePatchResult> {
  const pending = input.conversationContext.pending_image_insert
  if (!pending || pending.status !== "awaiting_confirmation") {
    return {
      status: "not_applicable",
      reason: "missing_pending_image_insert",
    }
  }

  const imageAttachment =
    input.attachments.find((attachment) => attachment.id === pending.image_asset_attachment_id) ??
    input.attachments.find((attachment) => attachment.role === "insert_image_asset") ??
    null

  if (!imageAttachment && !pending.image_asset_url) {
    return {
      status: "failed",
      assistantMessage: "Ainda nao recebi a imagem final. Envia a imagem ou um link HTTPS antes de preparar a previa.",
      understandingSummary: input.conversationContext.understanding_summary,
      warnings: ["missing_image_asset"],
      reason: "missing_image_asset",
    }
  }

  const blocks = extractBlocksFromLayoutJson(input.baseVersion.layout_json)
  const candidate = resolveImageTargetCandidate(blocks, String(input.currentHtml ?? ""))
  if (!candidate || candidate.confidence < 0.8) {
    return {
      status: "failed",
      assistantMessage:
        "Recebi a imagem, mas nao consegui identificar com seguranca o bloco onde ela deve entrar. Seleciona novamente uma area incluindo o espaco da imagem e um pouco do texto ao lado.",
      understandingSummary: input.conversationContext.understanding_summary,
      warnings: ["low_confidence_image_target"],
      reason: "low_confidence_image_target",
    }
  }

  const persistedAsset = imageAttachment
    ? await input.persistImageAsset({ kind: "attachment", attachment: imageAttachment })
    : await input.persistImageAsset({ kind: "url", imageUrl: String(pending.image_asset_url) })

  const nextBlocks = cloneJson(blocks)
  const nextBlock = cloneJson(candidate.block)
  const nextAlt = buildGeneratedAlt(blocks, candidate.sectionIndex)

  if (candidate.blockType === "image") {
    nextBlock.src = persistedAsset.publicUrl
    nextBlock.alt = nextAlt
  } else if (candidate.blockType === "rich_text") {
    const updatedContent = updateRichTextPlaceholderImage(String(nextBlock.content ?? ""), persistedAsset.publicUrl, nextAlt)
    if (!updatedContent) {
      return {
        status: "failed",
        assistantMessage:
          "Recebi a imagem, mas nao consegui substituir com seguranca o placeholder esperado. Seleciona novamente uma area maior para eu localizar o bloco correto.",
        understandingSummary: input.conversationContext.understanding_summary,
        warnings: ["placeholder_not_found"],
        reason: "placeholder_not_found",
      }
    }
    nextBlock.content = updatedContent
  } else {
    return {
      status: "failed",
      assistantMessage:
        "Recebi a imagem, mas o alvo selecionado nao correspondeu a um bloco de imagem seguro para atualizacao.",
      understandingSummary: input.conversationContext.understanding_summary,
      warnings: ["unsupported_image_target"],
      reason: "unsupported_image_target",
    }
  }

  nextBlocks[candidate.sectionIndex] = nextBlock
  const nextLayoutJson = withBlocksAppliedToLayoutJson(input.baseVersion.layout_json, nextBlocks)
  const editPlan = buildImageEditPlan(candidate.targetId)
  const resolution: ImageTargetResolution = {
    requested_target_id: pending.capture_attachment_id,
    resolved_target_id: candidate.targetId,
    candidate_path: candidate.candidatePath,
    confidence: candidate.confidence,
    section_index: candidate.sectionIndex,
    block_type: candidate.blockType,
    selector: candidate.selector,
    signals: {
      id_structural: 0.82,
      internal_path: 0.78,
      data_attributes: 0,
      nearest_heading: 0.54,
      anchor_text: blockContainsPlaceholderImage(candidate.block) ? 0.92 : 0.3,
      visual_order: 0.42,
      textual_similarity: 0.28,
      capture_attachment: 1,
    },
  }
  const operationalState = resolvePersistibleProposalOperationalState({
    editPlan,
    baseLayoutJson: input.baseVersion.layout_json,
    baseStyleJson: input.baseVersion.style_json,
    proposalLayoutJson: nextLayoutJson,
    proposalStyleJson: input.baseVersion.style_json,
    targetResolutions: [resolution],
    previewRenderable: true,
    desktopRenderable: true,
    mobileRenderable: true,
  })

  if (!operationalState.change_detected) {
    return {
      status: "failed",
      assistantMessage:
        "Recebi a imagem, mas esta tentativa nao gerou um diff real na pagina. Seleciona novamente a area da imagem para eu tentar com mais contexto.",
      understandingSummary: input.conversationContext.understanding_summary,
      warnings: ["no_visible_change"],
      reason: "no_visible_change",
    }
  }

  const metadata = {
    ai_contract_version: "hybrid_v1",
    ai_edit_plan: editPlan,
    ai_invariants: {
      plan_source: "image_insert_patch",
      branch_selected: "image_insert_patch",
      supports_persistible_flow: true,
      scoped_patch: true,
      preview_renderable: true,
      desktop_renderable: true,
      mobile_renderable: true,
      target_resolutions: [resolution],
      image_insert_patch: true,
      image_asset_public_url: persistedAsset.publicUrl,
      image_asset_file_name: persistedAsset.fileName,
      image_target_hint: pending.target_hint,
      image_target_source: pending.target_source,
      context_source: input.baseVersionSource,
      degraded_draft_bypassed: input.degradedDraftBypassed,
      context_selection_reason: input.baseVersionSelectionReason,
      published_version_id: input.publishedVersionId ?? null,
      latest_draft_id: input.latestDraftId ?? null,
    },
    base_version: {
      id: input.baseVersion.id,
      version_number: input.baseVersion.version_number,
      status: input.baseVersion.status,
    },
  }

  return {
    status: "success",
    providerUsed: input.providerUsed,
    modelUsed: input.modelUsed,
    summary: `Inserir a imagem enviada na area selecionada da pagina ${input.title}.`,
    explanation:
      "Preparei um patch de imagem localizado substituindo apenas o placeholder identificado como alvo forte, preservando textos, links e a estrutura da secao.",
    assistantMessage:
      "Perfeito. Preparei a insercao da imagem na area selecionada, mantendo o restante da secao igual.",
    warnings: [],
    conversationPhase: "ready_for_proposal",
    understandingSummary: input.conversationContext.understanding_summary,
    requiresUserConfirmation: false,
    canGenerateProposal: true,
    editPlan,
    proposal: {
      slug: input.slug,
      title: input.title,
      layout_json: nextLayoutJson,
      style_json: cloneJson(input.baseVersion.style_json),
      metadata,
    },
    operationalState: {
      ...operationalState,
      final_status:
        operationalState.final_status === "awaiting_intent_confirmation"
          ? ("proposal_ready" satisfies AiPageEditorFinalStatus)
          : operationalState.final_status,
    },
    resolution,
    asset: persistedAsset,
  }
}
