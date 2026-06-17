import { describe, expect, it } from "vitest"
import { resolveImageConversationTurn } from "./image-intent.ts"

function createConversationContext(overrides: Record<string, unknown> = {}) {
  return {
    phase: null,
    understanding_summary: null,
    clarification_questions_count: 0,
    quick_reply_selected: null,
    confirmation_token: null,
    recent_messages: [],
    pending_image_insert: null,
    ...overrides,
  }
}

describe("image intent flow", () => {
  it("asks only for the image when a target capture already defines the location", () => {
    const result = resolveImageConversationTurn({
      slug: "sobre",
      path: "/sobre",
      message: "quero inserir uma imagem nesse local",
      attachments: [
        {
          id: "capture-1",
          name: "recorte-sobre.jpg",
          mime_type: "image/jpeg",
          role: "target_capture",
        },
      ],
      conversationContext: createConversationContext(),
    })

    expect(result.status).toBe("waiting_for_image_asset")
    if (result.status !== "waiting_for_image_asset") throw new Error("expected waiting_for_image_asset")
    expect(result.assistantMessage).toMatch(/envia agora a imagem/i)
    expect(result.assistantMessage).not.toMatch(/onde/i)
    expect(result.pendingImageInsert.status).toBe("waiting_for_image_asset")
  })

  it("associates the uploaded image with the previous capture and asks for confirmation", () => {
    const result = resolveImageConversationTurn({
      slug: "sobre",
      path: "/sobre",
      message: "segue a imagem",
      attachments: [
        {
          id: "image-1",
          name: "hero.webp",
          mime_type: "image/webp",
          role: "insert_image_asset",
        },
      ],
      conversationContext: createConversationContext({
        pending_image_insert: {
          target_source: "capture",
          target_page: "/sobre",
          target_slug: "sobre",
          target_hint: "selected_area",
          capture_attachment_id: "capture-1",
          capture_attachment_name: "recorte-sobre.jpg",
          status: "waiting_for_image_asset",
        },
      }),
    })

    expect(result.status).toBe("awaiting_confirmation")
    if (result.status !== "awaiting_confirmation") throw new Error("expected awaiting_confirmation")
    expect(result.pendingImageInsert.image_asset_attachment_id).toBe("image-1")
    expect(result.assistantMessage).toMatch(/posso preparar a previa/i)
  })

  it("asks for the location when an image arrives without a prior capture", () => {
    const result = resolveImageConversationTurn({
      slug: "sobre",
      path: "/sobre",
      message: "insira essa imagem",
      attachments: [
        {
          id: "image-1",
          name: "hero.webp",
          mime_type: "image/webp",
          role: "insert_image_asset",
        },
      ],
      conversationContext: createConversationContext(),
    })

    expect(result.status).toBe("needs_target_capture")
    if (result.status !== "needs_target_capture") throw new Error("expected needs_target_capture")
    expect(result.assistantMessage).toMatch(/usa Capturar area/i)
  })

  it("accepts an https image link as the asset for the selected area", () => {
    const result = resolveImageConversationTurn({
      slug: "sobre",
      path: "/sobre",
      message: "https://cdn.exemplo.pt/imagem-final.webp",
      attachments: [],
      conversationContext: createConversationContext({
        pending_image_insert: {
          target_source: "capture",
          target_page: "/sobre",
          target_slug: "sobre",
          target_hint: "selected_area",
          capture_attachment_id: "capture-1",
          capture_attachment_name: "recorte-sobre.jpg",
          status: "waiting_for_image_asset",
        },
      }),
    })

    expect(result.status).toBe("awaiting_confirmation")
    if (result.status !== "awaiting_confirmation") throw new Error("expected awaiting_confirmation")
    expect(result.pendingImageInsert.image_asset_url).toBe("https://cdn.exemplo.pt/imagem-final.webp")
  })

  it("blocks non-image files when the flow is waiting for the final image asset", () => {
    const result = resolveImageConversationTurn({
      slug: "sobre",
      path: "/sobre",
      message: "segue o ficheiro",
      attachments: [
        {
          id: "file-1",
          name: "manual.pdf",
          mime_type: "application/pdf",
          role: "insert_image_asset",
        },
      ],
      conversationContext: createConversationContext({
        pending_image_insert: {
          target_source: "capture",
          target_page: "/sobre",
          target_slug: "sobre",
          target_hint: "selected_area",
          capture_attachment_id: "capture-1",
          capture_attachment_name: "recorte-sobre.jpg",
          status: "waiting_for_image_asset",
        },
      }),
    })

    expect(result.status).toBe("invalid_image_asset")
    if (result.status !== "invalid_image_asset") throw new Error("expected invalid_image_asset")
    expect(result.assistantMessage).toMatch(/png, jpg, webp/i)
  })
})
