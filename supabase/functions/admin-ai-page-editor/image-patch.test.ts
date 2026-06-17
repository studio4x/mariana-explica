import { describe, expect, it, vi } from "vitest"
import { materializeImageInsertProposal } from "./image-patch.ts"

function createBaseVersion() {
  return {
    id: "version-image-1",
    page_id: "page-image-1",
    version_number: 18,
    status: "published",
    layout_json: {
      projectData: {
        blocks: [
          {
            id: "section-story",
            type: "rich_text",
            content: "<section><h2>Como e estudar comigo?</h2><p>Texto preservado.</p></section>",
            layout: {
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
            },
          },
          {
            id: "section-image",
            type: "rich_text",
            content:
              '<section><img src="data:image/svg+xml;base64,PHN2Zy8+" alt="Nova imagem" /><p><a href="/checkout">Comecar</a></p></section>',
            layout: {
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
            },
          },
          {
            id: "section-support",
            type: "rich_text",
            content: '<section><p>Texto final preservado.</p><a href="/suporte">Suporte</a></section>',
            layout: {
              paddingTop: 16,
              paddingRight: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              marginTop: 0,
              marginBottom: 0,
            },
          },
        ],
      },
    },
    style_json: {},
    metadata: {},
  }
}

function createConversationContext() {
  return {
    phase: "awaiting_intent_confirmation" as const,
    understanding_summary: "inserir esta imagem na area selecionada, mantendo o restante da secao igual",
    clarification_questions_count: 1,
    quick_reply_selected: null,
    confirmation_token: "intent_image",
    recent_messages: [
      { role: "user" as const, text: "quero inserir uma imagem nesse local" },
      { role: "assistant" as const, text: "Entendido. Envia agora a imagem." },
    ],
    pending_image_insert: {
      target_source: "capture" as const,
      target_page: "/sobre",
      target_slug: "sobre",
      target_hint: "selected_area" as const,
      capture_attachment_id: "capture-1",
      capture_attachment_name: "recorte-sobre.jpg",
      image_asset_attachment_id: "image-1",
      status: "awaiting_confirmation" as const,
    },
  }
}

describe("materializeImageInsertProposal", () => {
  it("replaces a strong Nova imagem placeholder and preserves surrounding content", async () => {
    const persistImageAsset = vi.fn(async () => ({
      publicUrl: "https://cdn.exemplo.pt/pages/sobre/hero-final.webp",
      fileName: "hero-final.webp",
      mimeType: "image/webp",
      sizeBytes: 2048,
    }))

    const result = await materializeImageInsertProposal({
      providerUsed: "openai",
      modelUsed: "gpt-4.1-mini",
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      confirmationMessage: "Sim, prepara a previa",
      conversationContext: createConversationContext(),
      baseVersion: createBaseVersion(),
      baseVersionSource: "published_version",
      degradedDraftBypassed: false,
      baseVersionSelectionReason: "published_version_safe_context",
      publishedVersionId: "version-image-1",
      latestDraftId: null,
      currentHtml: '<main><img alt="Nova imagem" /></main>',
      attachments: [
        {
          id: "image-1",
          name: "hero-final.webp",
          mime_type: "image/webp",
          data_url: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoIAAIAAAAcJaQAA3AA/vuUAAA=",
          role: "insert_image_asset",
        },
      ],
      persistImageAsset,
    })

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("expected success")
    expect(result.editPlan.mode).toBe("image_patch")
    expect(result.proposal.metadata.ai_invariants?.branch_selected).toBe("image_insert_patch")
    expect(result.resolution.resolved_target_id).toBe("section-image")
    expect(result.resolution.confidence).toBeGreaterThanOrEqual(0.8)
    const blocks = (result.proposal.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    expect(String(blocks[1].content)).toContain("https://cdn.exemplo.pt/pages/sobre/hero-final.webp")
    expect(String(blocks[1].content)).toContain("Imagem ilustrativa da secao")
    expect(String(blocks[1].content)).toContain("/checkout")
    expect(String(blocks[2].content)).toContain("/suporte")
    expect(blocks).toHaveLength(3)
  })

  it("asks for a larger capture when no safe placeholder candidate is found", async () => {
    const baseVersion = createBaseVersion()
    const blocks = (baseVersion.layout_json.projectData as { blocks: Array<Record<string, unknown>> }).blocks
    blocks[1] = {
      ...blocks[1],
      content: '<section><p>Sem placeholder aqui.</p><a href="/checkout">Comecar</a></section>',
    }

    const result = await materializeImageInsertProposal({
      providerUsed: "openai",
      modelUsed: "gpt-4.1-mini",
      slug: "sobre",
      title: "Sobre",
      path: "/sobre",
      confirmationMessage: "Sim, prepara a previa",
      conversationContext: createConversationContext(),
      baseVersion,
      baseVersionSource: "published_version",
      degradedDraftBypassed: false,
      baseVersionSelectionReason: "published_version_safe_context",
      currentHtml: "<main><p>Sem placeholder</p></main>",
      attachments: [
        {
          id: "image-1",
          name: "hero-final.webp",
          mime_type: "image/webp",
          data_url: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoIAAIAAAAcJaQAA3AA/vuUAAA=",
          role: "insert_image_asset",
        },
      ],
      persistImageAsset: async () => ({
        publicUrl: "https://cdn.exemplo.pt/pages/sobre/hero-final.webp",
        fileName: "hero-final.webp",
        mimeType: "image/webp",
        sizeBytes: 2048,
      }),
    })

    expect(result.status).toBe("failed")
    if (result.status !== "failed") throw new Error("expected failed")
    expect(result.assistantMessage).toMatch(/seleciona novamente uma area/i)
  })
})
