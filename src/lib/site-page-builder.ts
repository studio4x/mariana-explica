import type { SitePageSlug } from "@/types/app.types"

export type PageBlockType = "heading" | "rich_text" | "image" | "button" | "divider" | "spacer"

interface BasePageBlock {
  id: string
  type: PageBlockType
}

export interface HeadingBlock extends BasePageBlock {
  type: "heading"
  content: string
  level: 1 | 2 | 3 | 4
  align: "left" | "center" | "right"
  color: string
}

export interface RichTextBlock extends BasePageBlock {
  type: "rich_text"
  content: string
}

export interface ImageBlock extends BasePageBlock {
  type: "image"
  src: string
  alt: string
  radius: number
}

export interface ButtonBlock extends BasePageBlock {
  type: "button"
  label: string
  href: string
  align: "left" | "center" | "right"
}

export interface DividerBlock extends BasePageBlock {
  type: "divider"
  color: string
}

export interface SpacerBlock extends BasePageBlock {
  type: "spacer"
  height: number
}

export type PageBlock = HeadingBlock | RichTextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock

export interface SitePageBuilderDocument {
  blocks: PageBlock[]
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function sanitizeRichText(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])javascript:.*?\2/gi, ` $1="#"`)
}

export function createDefaultBlock(type: PageBlockType): PageBlock {
  switch (type) {
    case "heading":
      return {
        id: uid("heading"),
        type: "heading",
        content: "Novo titulo",
        level: 2,
        align: "left",
        color: "#0f122c",
      }
    case "rich_text":
      return {
        id: uid("text"),
        type: "rich_text",
        content: "<p>Escreve aqui o conteudo da pagina.</p>",
      }
    case "image":
      return {
        id: uid("image"),
        type: "image",
        src: "",
        alt: "Imagem",
        radius: 18,
      }
    case "button":
      return {
        id: uid("button"),
        type: "button",
        label: "Call to action",
        href: "/materiais",
        align: "left",
      }
    case "divider":
      return {
        id: uid("divider"),
        type: "divider",
        color: "rgba(36,39,66,0.18)",
      }
    case "spacer":
      return {
        id: uid("spacer"),
        type: "spacer",
        height: 48,
      }
    default:
      return {
        id: uid("text"),
        type: "rich_text",
        content: "<p>Conteudo.</p>",
      }
  }
}

export function getDefaultDocumentForSlug(slug: SitePageSlug): SitePageBuilderDocument {
  if (slug === "home") {
    return {
      blocks: [
        {
          id: uid("h"),
          type: "heading",
          content: "Tens dificuldades a Portugues ou Filosofia?",
          level: 1,
          align: "left",
          color: "#0f122c",
        },
        {
          id: uid("t"),
          type: "rich_text",
          content:
            "<p>Este espaco foi criado para simplificar o teu estudo com clareza, estrategia e linguagem direta.</p>",
        },
        {
          id: uid("b"),
          type: "button",
          label: "Explorar materiais",
          href: "/materiais",
          align: "left",
        },
      ],
    }
  }

  return {
    blocks: [
      {
        id: uid("h"),
        type: "heading",
        content: "Titulo da pagina",
        level: 1,
        align: "left",
        color: "#0f122c",
      },
      {
        id: uid("t"),
        type: "rich_text",
        content: "<p>Comeca aqui a editar o conteudo desta pagina.</p>",
      },
    ],
  }
}

export function normalizeBuilderDocument(raw: unknown, slug: SitePageSlug): SitePageBuilderDocument {
  if (!raw || typeof raw !== "object") return getDefaultDocumentForSlug(slug)
  const record = raw as Record<string, unknown>
  const blocksRaw = Array.isArray(record.blocks) ? record.blocks : []
  const blocks: PageBlock[] = []

  for (const item of blocksRaw) {
    if (!item || typeof item !== "object") continue
    const block = item as Record<string, unknown>
    const type = String(block.type ?? "").trim() as PageBlockType
    if (!type) continue

    if (type === "heading") {
      blocks.push({
        id: String(block.id ?? uid("heading")),
        type,
        content: String(block.content ?? "Titulo"),
        level: ([1, 2, 3, 4].includes(Number(block.level)) ? Number(block.level) : 2) as 1 | 2 | 3 | 4,
        align: (["left", "center", "right"].includes(String(block.align)) ? String(block.align) : "left") as
          | "left"
          | "center"
          | "right",
        color: String(block.color ?? "#0f122c"),
      })
      continue
    }

    if (type === "rich_text") {
      blocks.push({
        id: String(block.id ?? uid("text")),
        type,
        content: String(block.content ?? "<p></p>"),
      })
      continue
    }

    if (type === "image") {
      blocks.push({
        id: String(block.id ?? uid("image")),
        type,
        src: String(block.src ?? ""),
        alt: String(block.alt ?? "Imagem"),
        radius: Math.max(0, Math.min(60, Number(block.radius ?? 18))),
      })
      continue
    }

    if (type === "button") {
      blocks.push({
        id: String(block.id ?? uid("button")),
        type,
        label: String(block.label ?? "Call to action"),
        href: String(block.href ?? "#"),
        align: (["left", "center", "right"].includes(String(block.align)) ? String(block.align) : "left") as
          | "left"
          | "center"
          | "right",
      })
      continue
    }

    if (type === "divider") {
      blocks.push({
        id: String(block.id ?? uid("divider")),
        type,
        color: String(block.color ?? "rgba(36,39,66,0.18)"),
      })
      continue
    }

    if (type === "spacer") {
      blocks.push({
        id: String(block.id ?? uid("spacer")),
        type,
        height: Math.max(8, Math.min(240, Number(block.height ?? 48))),
      })
    }
  }

  return blocks.length > 0 ? { blocks } : getDefaultDocumentForSlug(slug)
}

export function renderDocumentToHtml(document: SitePageBuilderDocument) {
  const blocksHtml = document.blocks
    .map((block) => {
      if (block.type === "heading") {
        const tag = `h${block.level}`
        return `<${tag} style="margin:0;color:${escapeHtml(block.color)};text-align:${block.align};font-weight:800;line-height:1.12;">${escapeHtml(block.content)}</${tag}>`
      }

      if (block.type === "rich_text") {
        return `<div class="me-managed-richtext">${sanitizeRichText(block.content)}</div>`
      }

      if (block.type === "image") {
        if (!block.src.trim()) {
          return `<div style="border:1px dashed rgba(36,39,66,0.28);border-radius:${block.radius}px;padding:28px;text-align:center;color:#475569;background:#f8fafc;">Imagem sem URL</div>`
        }
        return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="display:block;width:100%;max-width:100%;border-radius:${block.radius}px;" />`
      }

      if (block.type === "button") {
        return `<div style="text-align:${block.align};"><a href="${escapeHtml(block.href)}" style="display:inline-block;border-radius:999px;background:#242742;padding:14px 24px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">${escapeHtml(block.label)}</a></div>`
      }

      if (block.type === "divider") {
        return `<hr style="border:0;border-top:1px solid ${escapeHtml(block.color)};" />`
      }

      return `<div style="height:${block.height}px;"></div>`
    })
    .map((html) => `<section class="me-managed-block">${html}</section>`)
    .join("")

  return `<div class="me-managed-page-root">${blocksHtml}</div>`
}

export function getDefaultStyleCss() {
  return `
.me-managed-page-root {
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 20px 76px;
}
.me-managed-block + .me-managed-block {
  margin-top: 24px;
}
.me-managed-richtext {
  color: #24324a;
  line-height: 1.85;
  font-size: 18px;
}
.me-managed-richtext p {
  margin: 0 0 14px;
}
.me-managed-richtext h2,
.me-managed-richtext h3,
.me-managed-richtext h4 {
  margin: 0 0 12px;
  color: #0f122c;
}
  `.trim()
}
