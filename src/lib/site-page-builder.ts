import type { SitePageSlug } from "@/types/app.types"
import homeHeroIllustration from "@/assets/home-hero-illustration.svg"

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

const HOME_CANONICAL_MARKER = "data-me-home-canonical"

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
    return createCanonicalHomeDocument()
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

function createHomeRichSection(content: string) {
  const block = createDefaultBlock("rich_text")
  if (block.type !== "rich_text") {
    return createDefaultBlock("rich_text") as RichTextBlock
  }
  block.content = content
  block.layout = {
    ...block.layout,
    gridColumns: 12,
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
}

function createCanonicalHomeDocument(): SitePageBuilderDocument {
  const hero = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-hero">
      <div class="me-home-shell me-home-hero-grid">
        <div class="me-home-hero-art">
          <img src="${escapeHtml(homeHeroIllustration)}" alt="Ilustracao de materiais de estudo para Portugues e Filosofia" />
        </div>
        <div class="me-home-hero-copy">
          <h1>Tens dificuldades a Portugues ou Filosofia?</h1>
          <h2>Nunca tiveste a disciplina e vais fazer exame?</h2>
          <p>Entao fica aqui que este local e para ti!</p>
          <a class="me-home-primary-button" href="/materiais">Explorar materiais</a>
        </div>
      </div>
    </section>
  `)

  const objective = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-soft">
      <div class="me-home-shell me-home-grid-two">
        <article class="me-home-card me-home-card-centered">
          <span class="me-home-eyebrow me-home-eyebrow-dark">Objetivo Principal</span>
          <p class="me-home-display-copy">Criei este espaco para te dar o apoio que os manuais nao dao: leveza, clareza e uma estrategia real para brilhares nos exames de Filosofia e Portugues. Vamo-nos simplificar?</p>
        </article>
        <div class="me-home-feature-grid">
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">EM BREVE - AULAS GRAVADAS</span>
            <p>Domina temas complexos ao teu ritmo, com aulas organizadas e flexiveis, prontas quando tu estiveres.</p>
          </article>
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">EXPLICACOES</span>
            <p>Acompanhamento personalizado e focado nas tuas duvidas especificas para garantires resultados.</p>
          </article>
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">MATERIAIS DIGITAIS</span>
            <p>Resumos visuais e esquemas claros para simplificar o teu estudo e garantires a nota maxima sem complicacoes.</p>
          </article>
          <article class="me-home-card me-home-card-small">
            <span class="me-home-eyebrow me-home-eyebrow-dark">MATERIAIS DIGITAIS - GRATUITOS</span>
            <p>Dicas flash e recursos rapidos para descarregar e dares um boost imediato no teu estudo.</p>
          </article>
        </div>
      </div>
    </section>
  `)

  const steps = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-neutral">
      <div class="me-home-shell">
        <div class="me-home-section-intro">
          <h2>O teu caminho para o sucesso e simples</h2>
          <p>Esquece as complicacoes burocraticas. Aqui, o foco e o teu estudo. Em tres passos rapidos, tens tudo o que precisas para comecar a brilhar.</p>
        </div>
        <div class="me-home-steps-grid">
          <article class="me-home-card">
            <span class="me-home-eyebrow me-home-eyebrow-dark">ENCONTRA O TEU APOIO</span>
            <p>Explora as sebentas e materiais disponiveis. Cada material foi criado para resolver uma dor especifica, por isso vais perceber logo qual e o ideal para o teu momento.</p>
          </article>
          <article class="me-home-card">
            <span class="me-home-eyebrow me-home-eyebrow-dark">ACESSO RAPIDO E SEGURO</span>
            <p>O processo e direto e transparente. Sem taxas escondidas ou passos desnecessarios. Pagas de forma segura e o material e teu no segundo seguinte.</p>
          </article>
          <article class="me-home-card">
            <span class="me-home-eyebrow me-home-eyebrow-dark">FOCA-TE NO QUE IMPORTA</span>
            <p>Tudo fica organizado na tua Area do Aluno. Podes aceder aos PDFs e aulas sempre que quiseres, ao teu ritmo, e retomar o estudo exatamente onde paraste.</p>
          </article>
        </div>
      </div>
    </section>
  `)

  const trust = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-soft">
      <div class="me-home-shell me-home-grid-two">
        <article class="me-home-card me-home-trust-left">
          <h3 class="me-home-chip-title me-home-chip-blue">Vantagens de trabalhares comigo</h3>
          <ul class="me-home-list">
            <li><strong>Linguagem Direta:</strong> Falamos a mesma lingua. Esquece os termos impossiveis dos manuais e entende a materia a primeira.</li>
            <li><strong>Foco no Exame:</strong> Materiais desenhados apenas com o que realmente sai. Sem distracoes.</li>
            <li><strong>Resumos Visuais:</strong> Esquemas e cores pensados para quem precisa de organizar ideias rapidamente.</li>
          </ul>
        </article>
        <article class="me-home-trust-right">
          <h3 class="me-home-chip-title me-home-chip-white">Leveza e Confianca em cada passo</h3>
          <ul class="me-home-list me-home-list-compact">
            <li>Suporte Real: Nao recebes so um PDF. Tens uma "amiga" (eu!) nas DMs para te apoiar sempre que precisares.</li>
            <li>Tudo Organizado: Esquece o caos do WhatsApp. Os teus materiais ficam sempre guardados na tua Area do Aluno.</li>
            <li>Pes na Terra: Filosofia e Portugues deixam de ser abstratos e passam a ser ferramentas que dominas com seguranca.</li>
          </ul>
          <div class="me-home-actions">
            <a class="me-home-secondary-button" href="/materiais">Explorar materiais</a>
            <a class="me-home-secondary-button" href="/registar">Criar Conta</a>
          </div>
        </article>
      </div>
    </section>
  `)

  const reviews = createHomeRichSection(`
    <section ${HOME_CANONICAL_MARKER}="1" class="me-home-section me-home-reviews">
      <div class="me-home-shell me-home-center">
        <span class="me-home-pill">Reviews</span>
        <h2>E o que dizem os nossos alunos?</h2>
        <p>Avaliacoes reais publicadas no modulo de Reviews.</p>
        <div class="me-home-review-placeholder">
          <p>Esta secao continua ligada ao modulo dinamico de reviews no frontend publico.</p>
        </div>
      </div>
    </section>
  `)

  return {
    blocks: [hero, objective, steps, trust, reviews],
  }
}

function isCanonicalHomeDocument(document: SitePageBuilderDocument) {
  return document.blocks.some(
    (block) => block.type === "rich_text" && typeof block.content === "string" && block.content.includes(HOME_CANONICAL_MARKER),
  )
}

function isHomeLegacyLikeDocument(document: SitePageBuilderDocument) {
  if (document.blocks.length < 4) return false
  return document.blocks.every((block) => {
    if (block.type === "rich_text") {
      return !/<(section|article|main)\b/i.test(block.content)
    }
    return block.type === "heading" || block.type === "image" || block.type === "button"
  })
}

export function maybeCanonicalizeHomeDocument(document: SitePageBuilderDocument, slug: SitePageSlug): SitePageBuilderDocument {
  if (slug !== "home") return document
  if (isCanonicalHomeDocument(document)) return document
  if (!isHomeLegacyLikeDocument(document)) return document
  return createCanonicalHomeDocument()
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

function setLegacyBlockLayout(block: PageBlock) {
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
}

function appendLegacyNodeAsBlocks(node: Element, blocks: PageBlock[]) {
  const beforeCount = blocks.length
  extractLegacyElements(node, blocks)
  if (blocks.length > beforeCount) {
    for (let index = beforeCount; index < blocks.length; index += 1) {
      setLegacyBlockLayout(blocks[index])
    }
    return
  }

  const fallbackHtml = sanitizeRichText(node.outerHTML).trim()
  if (!fallbackHtml) return
  const fallbackBlock = createDefaultBlock("rich_text")
  if (fallbackBlock.type !== "rich_text") return
  fallbackBlock.id = uid("legacy")
  fallbackBlock.content = fallbackHtml
  setLegacyBlockLayout(fallbackBlock)
  blocks.push(fallbackBlock)
}

function shouldExpandStructuredLegacyHtml(source: string) {
  return /<(header|section|main|footer|div)\b/i.test(source)
}

export function expandStructuredRichTextBlocks(document: SitePageBuilderDocument): SitePageBuilderDocument {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return document
  }

  const nextBlocks: PageBlock[] = []
  let changed = false
  const parser = new DOMParser()

  for (const block of document.blocks) {
    if (block.type !== "rich_text" || !shouldExpandStructuredLegacyHtml(block.content)) {
      nextBlocks.push(block)
      continue
    }

    const parsed = parser.parseFromString(block.content, "text/html")
    const topLevel = Array.from(parsed.body.children).filter((child) => child.tagName.toLowerCase() !== "script")
    if (topLevel.length === 0) {
      nextBlocks.push(block)
      continue
    }

    const expandedBefore = nextBlocks.length
    topLevel.forEach((child) => appendLegacyNodeAsBlocks(child, nextBlocks))
    if (nextBlocks.length > expandedBefore) {
      changed = true
      continue
    }

    nextBlocks.push(block)
  }

  if (!changed) {
    return document
  }

  return { blocks: nextBlocks }
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
  if (shouldExpandStructuredLegacyHtml(source)) {
    if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
      const parser = new DOMParser()
      const parsed = parser.parseFromString(source, "text/html")
      const topLevel = Array.from(parsed.body.children).filter((child) => child.tagName.toLowerCase() !== "script")

      if (topLevel.length > 0) {
        const blocks: PageBlock[] = []
        topLevel.forEach((child) => appendLegacyNodeAsBlocks(child, blocks))

        if (blocks.length > 0) {
          return { blocks }
        }
      }
    }

    richText.content = sanitizeRichText(source)
    setLegacyBlockLayout(richText)
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
.me-managed-richtext img {
  max-width: 100%;
  height: auto;
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
.me-home-section {
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding: 72px 0;
}
.me-home-shell {
  width: min(1200px, calc(100vw - 48px));
  margin: 0 auto;
}
.me-home-hero {
  background: #f5fafc;
}
.me-home-hero-grid,
.me-home-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  align-items: center;
}
.me-home-hero-art {
  aspect-ratio: 1 / 1;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.me-home-hero-art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 24px;
  box-sizing: border-box;
}
.me-home-hero-copy h1 {
  max-width: 12ch;
  margin: 0 0 16px;
  font-size: clamp(48px, 6vw, 72px);
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: #0f122c;
}
.me-home-hero-copy h2 {
  max-width: 14ch;
  margin: 0 0 18px;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.18;
  color: rgba(15, 18, 44, 0.82);
}
.me-home-hero-copy p {
  max-width: 18ch;
  margin: 0 0 28px;
  font-size: 22px;
  line-height: 1.55;
  color: #46464d;
}
.me-home-primary-button,
.me-home-secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-weight: 800;
}
.me-home-primary-button {
  border-radius: 999px;
  background: #242742;
  color: #ffffff;
  padding: 16px 30px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  box-shadow: 0 16px 40px rgba(36, 39, 66, 0.18);
}
.me-home-soft {
  background: rgba(239, 244, 246, 0.5);
}
.me-home-neutral {
  background: #eff4f6;
}
.me-home-card {
  border: 1px solid rgba(71, 71, 77, 0.12);
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  padding: 32px;
  box-sizing: border-box;
}
.me-home-card-centered {
  padding: 48px;
  text-align: center;
}
.me-home-card-small {
  text-align: center;
  min-height: 100%;
}
.me-home-feature-grid,
.me-home-steps-grid {
  display: grid;
  gap: 24px;
}
.me-home-feature-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.me-home-steps-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.me-home-eyebrow {
  display: inline-flex;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.me-home-eyebrow-dark {
  background: #242742;
  color: #ffffff;
}
.me-home-display-copy {
  margin: 24px 0 0;
  font-size: 38px;
  line-height: 1.45;
  color: #0f122c;
}
.me-home-card-small p,
.me-home-steps-grid p,
.me-home-section-intro p,
.me-home-trust-right p,
.me-home-review-placeholder p {
  color: #46464d;
}
.me-home-card-small p {
  margin: 18px 0 0;
  font-size: 14px;
  line-height: 1.75;
}
.me-home-section-intro {
  max-width: 700px;
  margin-bottom: 48px;
}
.me-home-section-intro h2,
.me-home-reviews h2 {
  margin: 0 0 20px;
  font-size: clamp(40px, 5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #0f122c;
}
.me-home-section-intro p,
.me-home-reviews > .me-home-shell > p {
  margin: 0;
  font-size: 18px;
  line-height: 1.8;
}
.me-home-steps-grid .me-home-card p {
  margin: 28px 0 0;
  font-size: 16px;
  line-height: 1.8;
}
.me-home-chip-title {
  display: inline-flex;
  border-radius: 999px;
  padding: 10px 18px;
  font-size: 22px;
  margin: 0 0 28px;
}
.me-home-chip-blue {
  background: rgba(169, 207, 255, 0.35);
  color: #0f122c;
}
.me-home-chip-white {
  background: #ffffff;
  color: #0f122c;
}
.me-home-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 18px;
  color: #242742;
}
.me-home-list li {
  line-height: 1.75;
}
.me-home-trust-right {
  border-radius: 24px;
  background: rgba(169, 207, 255, 0.2);
  padding: 40px;
  box-sizing: border-box;
}
.me-home-list-compact li {
  font-size: 15px;
}
.me-home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 32px;
}
.me-home-secondary-button {
  border-radius: 14px;
  border: 1px solid rgba(71, 71, 77, 0.12);
  background: #ffffff;
  color: #0f122c;
  padding: 14px 22px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 11px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}
.me-home-reviews {
  background: #f5fafc;
}
.me-home-center {
  text-align: center;
}
.me-home-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #ffffff;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #567085;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}
.me-home-review-placeholder {
  max-width: 760px;
  margin: 36px auto 0;
  border-radius: 20px;
  border: 1px dashed rgba(71, 71, 77, 0.18);
  background: #ffffff;
  padding: 28px;
}
@media (max-width: 880px) {
  .me-managed-columns {
    grid-template-columns: 1fr !important;
  }
  .me-home-shell {
    width: min(100vw - 28px, 1200px);
  }
  .me-home-hero-grid,
  .me-home-grid-two,
  .me-home-feature-grid,
  .me-home-steps-grid {
    grid-template-columns: 1fr;
  }
  .me-home-section {
    padding: 44px 0;
  }
  .me-home-card,
  .me-home-card-centered,
  .me-home-trust-right {
    padding: 24px;
  }
  .me-home-display-copy {
    font-size: 28px;
  }
}
  `.trim()
}
