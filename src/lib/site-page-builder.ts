import type { SitePageSlug } from "@/types/app.types"

export type PageBlockType = "heading" | "rich_text" | "image" | "button" | "divider" | "spacer" | "columns"

export interface BlockLayoutStyle {
  gridColumns: number
  align: "left" | "center" | "right"
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  marginTop: number
  marginBottom: number
  backgroundColor: string
  borderRadius: number
}

interface BasePageBlock {
  id: string
  type: PageBlockType
  layout: BlockLayoutStyle
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

export interface ColumnsBlock extends BasePageBlock {
  type: "columns"
  columns: 2 | 3 | 4
  gap: number
  items: string[]
}

export type PageBlock =
  | HeadingBlock
  | RichTextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock

export interface SitePageBuilderDocument {
  blocks: PageBlock[]
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
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

export function getBlockLayoutDefaults(): BlockLayoutStyle {
  return {
    gridColumns: 12,
    align: "center",
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    marginTop: 0,
    marginBottom: 4,
    backgroundColor: "transparent",
    borderRadius: 0,
  }
}

export function normalizeLayoutStyle(raw: unknown): BlockLayoutStyle {
  const defaults = getBlockLayoutDefaults()
  if (!raw || typeof raw !== "object") return defaults
  const record = raw as Record<string, unknown>

  return {
    gridColumns: clamp(Number(record.gridColumns ?? defaults.gridColumns), 1, 12),
    align: (["left", "center", "right"].includes(String(record.align)) ? String(record.align) : defaults.align) as
      | "left"
      | "center"
      | "right",
    paddingTop: clamp(Number(record.paddingTop ?? defaults.paddingTop), 0, 240),
    paddingRight: clamp(Number(record.paddingRight ?? defaults.paddingRight), 0, 240),
    paddingBottom: clamp(Number(record.paddingBottom ?? defaults.paddingBottom), 0, 240),
    paddingLeft: clamp(Number(record.paddingLeft ?? defaults.paddingLeft), 0, 240),
    marginTop: clamp(Number(record.marginTop ?? defaults.marginTop), 0, 240),
    marginBottom: clamp(Number(record.marginBottom ?? defaults.marginBottom), 0, 240),
    backgroundColor: String(record.backgroundColor ?? defaults.backgroundColor),
    borderRadius: clamp(Number(record.borderRadius ?? defaults.borderRadius), 0, 120),
  }
}

export function createDefaultBlock(type: PageBlockType): PageBlock {
  const layout = getBlockLayoutDefaults()
  switch (type) {
    case "heading":
      return {
        id: uid("heading"),
        type: "heading",
        content: "Novo titulo",
        level: 2,
        align: "left",
        color: "#0f122c",
        layout,
      }
    case "rich_text":
      return {
        id: uid("text"),
        type: "rich_text",
        content: "<p>Escreve aqui o conteudo da pagina.</p>",
        layout,
      }
    case "image":
      return {
        id: uid("image"),
        type: "image",
        src: "",
        alt: "Imagem",
        radius: 18,
        layout,
      }
    case "button":
      return {
        id: uid("button"),
        type: "button",
        label: "Call to action",
        href: "/materiais",
        align: "left",
        layout,
      }
    case "divider":
      return {
        id: uid("divider"),
        type: "divider",
        color: "rgba(36,39,66,0.18)",
        layout,
      }
    case "spacer":
      return {
        id: uid("spacer"),
        type: "spacer",
        height: 48,
        layout,
      }
    case "columns":
      return {
        id: uid("columns"),
        type: "columns",
        columns: 2,
        gap: 18,
        items: [
          "<p><strong>Coluna 1</strong><br/>Conteudo editavel da primeira coluna.</p>",
          "<p><strong>Coluna 2</strong><br/>Conteudo editavel da segunda coluna.</p>",
        ],
        layout,
      }
    default:
      return {
        id: uid("text"),
        type: "rich_text",
        content: "<p>Conteudo.</p>",
        layout,
      }
  }
}

export function getDefaultDocumentForSlug(slug: SitePageSlug): SitePageBuilderDocument {
  if (slug === "home") {
    const heading = createDefaultBlock("heading")
    const text = createDefaultBlock("rich_text")
    const button = createDefaultBlock("button")
    const columns = createDefaultBlock("columns")

    if (heading.type === "heading") {
      heading.content = "Tens dificuldades a Portugues ou Filosofia?"
      heading.level = 1
    }
    if (text.type === "rich_text") {
      text.content =
        "<p>Este espaco foi criado para simplificar o teu estudo com clareza, estrategia e linguagem direta.</p>"
    }
    if (button.type === "button") {
      button.label = "Explorar materiais"
      button.href = "/materiais"
    }
    if (columns.type === "columns") {
      columns.columns = 3
      columns.gap = 16
      columns.items = [
        "<p><strong>Organizacao</strong><br/>Planos claros para estudares sem confusao.</p>",
        "<p><strong>Pratica</strong><br/>Exercicios orientados para o que realmente cai.</p>",
        "<p><strong>Apoio</strong><br/>Explicacoes diretas e objetivas para ganhar ritmo.</p>",
      ]
    }

    return {
      blocks: [heading, text, button, columns],
    }
  }

  return {
    blocks: [
      {
        ...(createDefaultBlock("heading") as HeadingBlock),
        content: "Titulo da pagina",
        level: 1,
      },
      {
        ...(createDefaultBlock("rich_text") as RichTextBlock),
        content: "<p>Comeca aqui a editar o conteudo desta pagina.</p>",
      },
    ],
  }
}

function normalizeColumnsItems(rawItems: unknown, columns: 2 | 3 | 4) {
  const source = Array.isArray(rawItems) ? rawItems.map((item) => String(item ?? "")) : []
  const sanitized = source.slice(0, columns).map((item) =>
    sanitizeRichText(item.trim() || "<p>Coluna vazia.</p>"),
  )
  while (sanitized.length < columns) {
    sanitized.push("<p>Coluna vazia.</p>")
  }
  return sanitized
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
    const layout = normalizeLayoutStyle(block.layout)

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
        layout,
      })
      continue
    }

    if (type === "rich_text") {
      blocks.push({
        id: String(block.id ?? uid("text")),
        type,
        content: String(block.content ?? "<p></p>"),
        layout,
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
        layout,
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
        layout,
      })
      continue
    }

    if (type === "divider") {
      blocks.push({
        id: String(block.id ?? uid("divider")),
        type,
        color: String(block.color ?? "rgba(36,39,66,0.18)"),
        layout,
      })
      continue
    }

    if (type === "spacer") {
      blocks.push({
        id: String(block.id ?? uid("spacer")),
        type,
        height: Math.max(8, Math.min(240, Number(block.height ?? 48))),
        layout,
      })
      continue
    }

    if (type === "columns") {
      const columns = clamp(Number(block.columns ?? 2), 2, 4) as 2 | 3 | 4
      blocks.push({
        id: String(block.id ?? uid("columns")),
        type,
        columns,
        gap: clamp(Number(block.gap ?? 18), 8, 64),
        items: normalizeColumnsItems(block.items, columns),
        layout,
      })
    }
  }

  return blocks.length > 0 ? { blocks } : getDefaultDocumentForSlug(slug)
}

function getHeadingLevel(tagName: string): 1 | 2 | 3 | 4 {
  if (tagName === "h1") return 1
  if (tagName === "h2") return 2
  if (tagName === "h3") return 3
  return 4
}

function pushRichTextBlockFromHtml(blocks: PageBlock[], html: string) {
  const content = sanitizeRichText(html).trim()
  if (!content) return
  blocks.push({
    ...(createDefaultBlock("rich_text") as RichTextBlock),
    id: uid("text"),
    content,
  })
}

function extractLegacyElements(node: Element, blocks: PageBlock[]) {
  const children = Array.from(node.children)

  for (const child of children) {
    const tag = child.tagName.toLowerCase()

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      const text = child.textContent?.trim() ?? ""
      if (!text) continue
      const heading = createDefaultBlock("heading")
      if (heading.type !== "heading") continue
      heading.id = uid("heading")
      heading.content = text
      heading.level = getHeadingLevel(tag)
      blocks.push(heading)
      continue
    }

    if (tag === "img") {
      const image = child as HTMLImageElement
      const src = image.getAttribute("src")?.trim() ?? ""
      if (!src) continue
      const block = createDefaultBlock("image")
      if (block.type !== "image") continue
      block.id = uid("image")
      block.src = src
      block.alt = image.getAttribute("alt")?.trim() ?? "Imagem"
      blocks.push(block)
      continue
    }

    if (tag === "hr") {
      const divider = createDefaultBlock("divider")
      divider.id = uid("divider")
      blocks.push(divider)
      continue
    }

    if (tag === "a") {
      const href = child.getAttribute("href")?.trim() ?? "#"
      const label = child.textContent?.trim() ?? ""
      if (label && label.length <= 90) {
        const button = createDefaultBlock("button")
        if (button.type === "button") {
          button.id = uid("button")
          button.label = label
          button.href = href
          blocks.push(button)
        }
      } else {
        pushRichTextBlockFromHtml(blocks, child.outerHTML)
      }
      continue
    }

    if (tag === "p" || tag === "ul" || tag === "ol" || tag === "blockquote") {
      pushRichTextBlockFromHtml(blocks, child.outerHTML)
      continue
    }

    if (tag === "section" || tag === "article" || tag === "main" || tag === "div") {
      const hasStructuredChildren = child.querySelector("h1,h2,h3,h4,p,ul,ol,img,a,hr")
      if (hasStructuredChildren) {
        extractLegacyElements(child, blocks)
        continue
      }

      const text = child.textContent?.trim() ?? ""
      if (text) {
        pushRichTextBlockFromHtml(blocks, `<p>${escapeHtml(text)}</p>`)
      }
      continue
    }
  }
}

export function convertLegacyHtmlToBuilderDocument(
  html: string | null | undefined,
  slug: SitePageSlug,
): SitePageBuilderDocument {
  const source = typeof html === "string" ? html.trim() : ""
  if (!source) return getDefaultDocumentForSlug(slug)

  const richText = createDefaultBlock("rich_text")
  if (richText.type !== "rich_text") return getDefaultDocumentForSlug(slug)

  // For full legacy layouts (hero/sections/grid), split by top-level sections to keep
  // element-scoped editing in inspector instead of one huge rich text block.
  if (/<(header|section|main|footer|div)\b/i.test(source)) {
    if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
      const parser = new DOMParser()
      const parsed = parser.parseFromString(source, "text/html")
      const topLevel = Array.from(parsed.body.children).filter((child) => child.tagName.toLowerCase() !== "script")

      if (topLevel.length > 0) {
        const blocks = topLevel.map((child, index) => {
          const block = createDefaultBlock("rich_text")
          if (block.type !== "rich_text") return null
          block.id = uid(`legacy-${index + 1}`)
          block.content = sanitizeRichText(child.outerHTML)
          block.layout = {
            ...block.layout,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            marginTop: 0,
            marginBottom: 0,
            backgroundColor: "transparent",
            borderRadius: 0,
          }
          return block
        }).filter((block): block is RichTextBlock => Boolean(block))

        if (blocks.length > 0) {
          return { blocks }
        }
      }
    }

    richText.content = sanitizeRichText(source)
    richText.layout = {
      ...richText.layout,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      marginTop: 0,
      marginBottom: 0,
      backgroundColor: "transparent",
      borderRadius: 0,
    }
    return { blocks: [richText] }
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    richText.content = sanitizeRichText(source)
    return { blocks: [richText] }
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(source, "text/html")
  const blocks: PageBlock[] = []
  extractLegacyElements(parsed.body, blocks)

  if (blocks.length === 0) {
    richText.content = sanitizeRichText(source)
    return { blocks: [richText] }
  }

  return { blocks }
}

function getWrapperStyle(layout: BlockLayoutStyle) {
  const widthPercent = Math.round((layout.gridColumns / 12) * 10000) / 100
  const widthCss = `min(100%, ${widthPercent}%)`

  const marginLeft = layout.align === "right" ? "auto" : layout.align === "center" ? "auto" : "0"
  const marginRight = layout.align === "left" ? "auto" : layout.align === "center" ? "auto" : "0"

  return [
    `width:${widthCss}`,
    `margin-top:${layout.marginTop}px`,
    `margin-bottom:${layout.marginBottom}px`,
    `margin-left:${marginLeft}`,
    `margin-right:${marginRight}`,
    `padding:${layout.paddingTop}px ${layout.paddingRight}px ${layout.paddingBottom}px ${layout.paddingLeft}px`,
    `background:${escapeHtml(layout.backgroundColor)}`,
    `border-radius:${layout.borderRadius}px`,
  ].join(";")
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

      if (block.type === "spacer") {
        return `<div style="height:${block.height}px;"></div>`
      }

      const items = block.items
        .slice(0, block.columns)
        .map((item) => `<article class="me-managed-column-item">${sanitizeRichText(item)}</article>`)
        .join("")

      return `<section class="me-managed-columns" style="grid-template-columns:repeat(${block.columns},minmax(0,1fr));gap:${block.gap}px;">${items}</section>`
    })
    .map((html, index) => {
      const block = document.blocks[index]
      return `<section class="me-managed-block" style="${getWrapperStyle(block.layout)}">${html}</section>`
    })
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
.me-managed-block {
  box-sizing: border-box;
}
.me-managed-block + .me-managed-block {
  margin-top: 8px;
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
.me-managed-columns {
  display: grid;
}
.me-managed-column-item {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: #ffffff;
  padding: 16px;
}
@media (max-width: 880px) {
  .me-managed-columns {
    grid-template-columns: 1fr !important;
  }
}
  `.trim()
}
