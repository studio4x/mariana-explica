import type { AiConversationContext, AiConversationPendingImageInsert } from "./conversation.ts"

export type AiEditorAttachmentRole =
  | "target_capture"
  | "insert_image_asset"
  | "reference_image"
  | "unknown"

export interface ImageIntentAttachment {
  id: string
  name: string
  mime_type: string
  role?: AiEditorAttachmentRole | null
}

export type ImageConversationTurnResult =
  | { status: "not_applicable" }
  | {
      status: "waiting_for_image_asset"
      pendingImageInsert: AiConversationPendingImageInsert
      assistantMessage: string
      understandingSummary: string
      quickReplies: string[]
      warnings: string[]
    }
  | {
      status: "awaiting_confirmation"
      pendingImageInsert: AiConversationPendingImageInsert
      assistantMessage: string
      understandingSummary: string
      quickReplies: string[]
      warnings: string[]
    }
  | {
      status: "needs_target_capture"
      assistantMessage: string
      understandingSummary: string | null
      quickReplies: string[]
      warnings: string[]
    }
  | {
      status: "invalid_image_asset"
      pendingImageInsert: AiConversationPendingImageInsert | null
      assistantMessage: string
      understandingSummary: string | null
      quickReplies: string[]
      warnings: string[]
    }

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function isImageMimeType(value: string) {
  return /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i.test(value)
}

function isInsertImageRequest(message: string) {
  const normalized = normalizeText(message)
  return (
    /\b(inserir|insira|insere|colocar|coloca|adicionar|adiciona|substituir|substitua|trocar|troque)\b/.test(normalized) &&
    /\b(imagem|foto|banner|ilustracao|figura)\b/.test(normalized)
  )
}

function referencesSelectedArea(message: string) {
  const normalized = normalizeText(message)
  return /\b(nesse local|aqui|nessa area|na area selecionada|no local selecionado|nesse espaco|nessa secao)\b/.test(
    normalized,
  )
}

function extractFirstHttpsUrl(message: string) {
  const match = String(message ?? "").match(/https:\/\/[^\s<>"']+/i)
  return match?.[0]?.trim() ?? null
}

function findTargetCaptureAttachment(attachments: ImageIntentAttachment[]) {
  return [...attachments].reverse().find((attachment) => attachment.role === "target_capture") ?? null
}

function findInsertImageAttachment(attachments: ImageIntentAttachment[]) {
  return (
    attachments.find(
      (attachment) =>
        attachment.role === "insert_image_asset" ||
        ((attachment.role === "unknown" || !attachment.role) && isImageMimeType(attachment.mime_type)),
    ) ?? null
  )
}

function hasNonImageInsertAttachment(attachments: ImageIntentAttachment[]) {
  return attachments.some(
    (attachment) =>
      attachment.role === "insert_image_asset" &&
      !isImageMimeType(String(attachment.mime_type ?? "")),
  )
}

function buildWaitingForImageSummary() {
  return "inserir uma imagem na area selecionada, mantendo o restante da secao igual"
}

function buildAwaitingConfirmationSummary() {
  return "inserir esta imagem na area selecionada, mantendo o restante da secao igual"
}

export function resolveImageConversationTurn(input: {
  slug: string
  path: string
  message: string
  attachments: ImageIntentAttachment[]
  conversationContext: AiConversationContext
}): ImageConversationTurnResult {
  const pending = input.conversationContext.pending_image_insert
  const normalizedMessage = normalizeText(input.message)
  const messageUrl = extractFirstHttpsUrl(input.message)
  const captureAttachment = findTargetCaptureAttachment(input.attachments)
  const insertImageAttachment = findInsertImageAttachment(input.attachments)

  if (pending?.status === "waiting_for_image_asset") {
    if (hasNonImageInsertAttachment(input.attachments)) {
      return {
        status: "invalid_image_asset",
        pendingImageInsert: pending,
        assistantMessage: "Recebi o ficheiro, mas para esta acao preciso de uma imagem PNG, JPG, WebP, GIF ou AVIF.",
        understandingSummary: input.conversationContext.understanding_summary,
        quickReplies: ["Vou enviar uma imagem", "Vou enviar um link HTTPS"],
        warnings: ["invalid_insert_image_asset"],
      }
    }

    if (insertImageAttachment || messageUrl) {
      return {
        status: "awaiting_confirmation",
        pendingImageInsert: {
          ...pending,
          image_asset_attachment_id: insertImageAttachment?.id ?? null,
          image_asset_url: messageUrl,
          status: "awaiting_confirmation",
        },
        assistantMessage:
          "Perfeito. Vou inserir esta imagem na area selecionada, mantendo o restante da secao igual. Posso preparar a previa?",
        understandingSummary: buildAwaitingConfirmationSummary(),
        quickReplies: ["Sim, prepara a previa", "Nao, explico melhor"],
        warnings: [],
      }
    }

    if (/\b(vou enviar|envio agora|ja envio)\b/.test(normalizedMessage) && /\b(imagem|link)\b/.test(normalizedMessage)) {
      return {
        status: "waiting_for_image_asset",
        pendingImageInsert: pending,
        assistantMessage:
          "Entendido. O local ja ficou definido pela area selecionada. Envia agora a imagem ou um link HTTPS da imagem que queres usar.",
        understandingSummary: buildWaitingForImageSummary(),
        quickReplies: ["Vou enviar a imagem agora"],
        warnings: [],
      }
    }
  }

  if (!isInsertImageRequest(input.message)) {
    return { status: "not_applicable" }
  }

  if (insertImageAttachment && !isImageMimeType(insertImageAttachment.mime_type)) {
    return {
      status: "invalid_image_asset",
      pendingImageInsert: pending ?? null,
      assistantMessage: "Recebi o ficheiro, mas para esta acao preciso de uma imagem PNG, JPG, WebP, GIF ou AVIF.",
      understandingSummary: input.conversationContext.understanding_summary,
      quickReplies: ["Vou enviar uma imagem", "Vou enviar um link HTTPS"],
      warnings: ["invalid_insert_image_asset"],
    }
  }

  if (captureAttachment && (referencesSelectedArea(input.message) || !insertImageAttachment && !messageUrl)) {
    if (insertImageAttachment || messageUrl) {
      return {
        status: "awaiting_confirmation",
        pendingImageInsert: {
          target_source: "capture",
          target_page: input.path,
          target_slug: input.slug,
          target_hint: "selected_area",
          capture_attachment_id: captureAttachment.id,
          capture_attachment_name: captureAttachment.name,
          image_asset_attachment_id: insertImageAttachment?.id ?? null,
          image_asset_url: messageUrl,
          status: "awaiting_confirmation",
        },
        assistantMessage:
          "Perfeito. Vou inserir esta imagem na area selecionada, mantendo o restante da secao igual. Posso preparar a previa?",
        understandingSummary: buildAwaitingConfirmationSummary(),
        quickReplies: ["Sim, prepara a previa", "Nao, explico melhor"],
        warnings: [],
      }
    }

    return {
      status: "waiting_for_image_asset",
      pendingImageInsert: {
        target_source: "capture",
        target_page: input.path,
        target_slug: input.slug,
        target_hint: "selected_area",
        capture_attachment_id: captureAttachment.id,
        capture_attachment_name: captureAttachment.name,
        status: "waiting_for_image_asset",
      },
      assistantMessage:
        "Entendido. Queres inserir uma imagem na area selecionada. Envia agora a imagem ou um link da imagem que queres usar.",
      understandingSummary: buildWaitingForImageSummary(),
      quickReplies: ["Vou enviar a imagem agora"],
      warnings: [],
    }
  }

  if (insertImageAttachment || messageUrl) {
    return {
      status: "needs_target_capture",
      assistantMessage:
        "Recebi a imagem. Agora indica onde ela deve entrar ou usa Capturar area para selecionar visualmente o local exato.",
      understandingSummary: null,
      quickReplies: ["Vou selecionar a area", "Vou explicar o local"],
      warnings: ["missing_target_capture"],
    }
  }

  return { status: "not_applicable" }
}
