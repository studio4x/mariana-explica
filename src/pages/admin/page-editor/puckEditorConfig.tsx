import { Render, type Config, type Data } from "@puckeditor/core"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

function createBlockId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `puck-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeInlineHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, ' $1="#"')
}

function safeRichText(html: string) {
  const normalized = String(html ?? "").trim()
  if (!normalized) return "<p></p>"
  return sanitizeInlineHtml(normalized)
}

function renderRichNode(value: unknown): ReactNode {
  if (typeof value === "string") {
    return <div dangerouslySetInnerHTML={{ __html: safeRichText(value) }} />
  }

  if (value == null) {
    return <div dangerouslySetInnerHTML={{ __html: "<p></p>" }} />
  }

  return value as ReactNode
}

export const sitePagePuckConfig: Config = {
  categories: {
    estrutura: {
      title: "Estrutura",
      components: ["SectionTitle", "Spacer", "TwoColumnsText", "RawHtml"],
    },
    conteudo: {
      title: "Conteudo",
      components: ["RichTextBlock", "ImageBlock", "ButtonBlock", "HomeReviewsWidget"],
    },
  },
  components: {
    SectionTitle: {
      label: "Titulo de secao",
      defaultProps: {
        eyebrow: "Secao",
        title: "Titulo da secao",
        subtitle: "Subtitulo opcional.",
        align: "center",
      },
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Titulo" },
        subtitle: { type: "textarea", label: "Subtitulo" },
        align: {
          type: "select",
          label: "Alinhamento",
          options: [
            { label: "Esquerda", value: "left" },
            { label: "Centro", value: "center" },
          ],
        },
      },
      render: ({ eyebrow, title, subtitle, align }) => {
        const alignmentClass = align === "left" ? "text-left" : "text-center"

        return (
          <section className="py-6 md:py-10">
            <div className={`mx-auto max-w-[1200px] px-6 ${alignmentClass}`}>
              {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.22em] text-[#567085]">{eyebrow}</p> : null}
              {title ? <h2 className="mt-2 font-display text-3xl font-bold text-[#0f122c] md:text-5xl">{title}</h2> : null}
              {subtitle ? <p className="mt-4 text-base leading-7 text-[#24324a] md:text-lg">{subtitle}</p> : null}
            </div>
          </section>
        )
      },
    },
    RichTextBlock: {
      label: "Texto rico",
      defaultProps: {
        content: "<p>Escreve aqui o conteudo da secao.</p>",
        align: "left",
      },
      fields: {
        content: { type: "richtext", label: "Conteudo" },
        align: {
          type: "select",
          label: "Alinhamento",
          options: [
            { label: "Esquerda", value: "left" },
            { label: "Centro", value: "center" },
          ],
        },
      },
      render: ({ content, align }) => {
        const alignmentClass = align === "center" ? "text-center" : "text-left"

        return (
          <section className="py-6 md:py-8">
            <div className={`mx-auto max-w-[1200px] px-6 text-[#24324a] ${alignmentClass}`}>{renderRichNode(content)}</div>
          </section>
        )
      },
    },
    ImageBlock: {
      label: "Imagem",
      defaultProps: {
        src: "https://placehold.co/1280x720?text=Imagem",
        alt: "Imagem",
        caption: "",
      },
      fields: {
        src: { type: "text", label: "URL da imagem" },
        alt: { type: "text", label: "Texto alternativo" },
        caption: { type: "text", label: "Legenda" },
      },
      render: ({ src, alt, caption }) => {
        return (
          <section className="py-6 md:py-10">
            <div className="mx-auto max-w-[1200px] px-6">
              <figure className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <img src={src} alt={alt || "Imagem"} className="h-auto w-full object-cover" loading="lazy" />
                {caption ? <figcaption className="px-4 py-3 text-sm text-[#4f5f76]">{caption}</figcaption> : null}
              </figure>
            </div>
          </section>
        )
      },
    },
    ButtonBlock: {
      label: "Botao",
      defaultProps: {
        label: "Abrir link",
        href: "#",
        align: "left",
      },
      fields: {
        label: { type: "text", label: "Texto do botao" },
        href: { type: "text", label: "Link" },
        align: {
          type: "select",
          label: "Alinhamento",
          options: [
            { label: "Esquerda", value: "left" },
            { label: "Centro", value: "center" },
          ],
        },
      },
      render: ({ label, href, align }) => {
        const alignmentClass = align === "center" ? "justify-center" : "justify-start"

        return (
          <section className="py-4 md:py-6">
            <div className={`mx-auto flex max-w-[1200px] px-6 ${alignmentClass}`}>
              <a
                href={href || "#"}
                className="inline-flex items-center justify-center rounded-full bg-[#242742] px-8 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#1d2036]"
              >
                {label || "Abrir link"}
              </a>
            </div>
          </section>
        )
      },
    },
    TwoColumnsText: {
      label: "2 colunas de texto",
      defaultProps: {
        left: "<p>Conteudo da coluna esquerda.</p>",
        right: "<p>Conteudo da coluna direita.</p>",
      },
      fields: {
        left: { type: "richtext", label: "Coluna esquerda" },
        right: { type: "richtext", label: "Coluna direita" },
      },
      render: ({ left, right }) => {
        return (
          <section className="py-6 md:py-10">
            <div className="mx-auto grid max-w-[1200px] gap-6 px-6 md:grid-cols-2">
              <article className="rounded-2xl bg-[#e8f0f4] px-6 py-6 text-[#24324a] md:px-8 md:py-8">
                {renderRichNode(left)}
              </article>
              <article className="rounded-2xl bg-[#e8f0f4] px-6 py-6 text-[#24324a] md:px-8 md:py-8">
                {renderRichNode(right)}
              </article>
            </div>
          </section>
        )
      },
    },
    Spacer: {
      label: "Espacador",
      defaultProps: {
        height: 32,
      },
      fields: {
        height: {
          type: "number",
          label: "Altura (px)",
          min: 8,
          max: 280,
          step: 4,
        },
      },
      render: ({ height }) => {
        const safeHeight = Number.isFinite(Number(height)) ? Number(height) : 32
        return <div style={{ height: Math.max(8, safeHeight) }} />
      },
    },
    HomeReviewsWidget: {
      label: "Widget Reviews (Home)",
      defaultProps: {
        title: "Widget dinamico: reviews da Home",
        note: "Este bloco e renderizado dinamicamente no site publico.",
      },
      fields: {
        title: { type: "text", label: "Titulo" },
        note: { type: "textarea", label: "Nota" },
      },
      render: ({ title, note }) => {
        return (
          <section data-me-widget="home-reviews" className="bg-[#f5fafc] py-20">
            <div className="mx-auto max-w-[1200px] px-6 text-center">
              <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-[rgba(71,71,77,0.24)] bg-white p-8 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#567085]">{title}</p>
                <p className="mt-3 text-sm leading-7 text-[#46464d]">{note}</p>
              </div>
            </div>
          </section>
        )
      },
    },
    RawHtml: {
      label: "HTML livre (legado)",
      defaultProps: {
        html: "<section><div class='mx-auto max-w-[1200px] px-6 py-12'><p>Conteudo HTML.</p></div></section>",
      },
      fields: {
        html: {
          type: "textarea",
          label: "HTML",
        },
      },
      render: ({ html }) => {
        return <div dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(String(html ?? "")) }} />
      },
    },
  },
}

function createStructuredBlock(type: string, props: Record<string, unknown>) {
  return {
    type,
    props: {
      id: createBlockId(),
      ...props,
    },
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && normalizeText(node.textContent).length > 0)
}

function unwrapLegacyWrapper(element: Element): Element {
  let current = element

  while (
    ["DIV", "MAIN", "SECTION", "ARTICLE"].includes(current.tagName) &&
    current.children.length === 1 &&
    !hasDirectText(current) &&
    !current.querySelector('[data-me-widget="home-reviews"]')
  ) {
    const next = current.children[0]
    if (!(next instanceof Element)) break
    current = next
  }

  return current
}

function looksLikeTwoColumns(element: Element) {
  if (element.children.length !== 2) return false

  const [left, right] = Array.from(element.children)
  if (!(left instanceof Element) || !(right instanceof Element)) return false

  const className = (element.getAttribute("class") ?? "").toLowerCase()
  const hasGridHint =
    className.includes("grid") ||
    className.includes("columns") ||
    className.includes("col-") ||
    className.includes("md:grid-cols-2") ||
    className.includes("lg:grid-cols-2")

  const leftText = normalizeText(left.textContent)
  const rightText = normalizeText(right.textContent)
  const hasEnoughText = leftText.length > 36 && rightText.length > 36

  return hasGridHint || hasEnoughText
}

function pickMainImage(element: Element) {
  if (element.tagName === "IMG") {
    return element as HTMLImageElement
  }

  const images = element.querySelectorAll("img")
  if (images.length !== 1) return null
  return images[0] as HTMLImageElement
}

function pickPrimaryButton(element: Element) {
  if (element.tagName === "A") {
    return element as HTMLAnchorElement
  }

  const candidates = Array.from(element.querySelectorAll("a")) as HTMLAnchorElement[]
  const buttonLike = candidates.find((anchor) => {
    const className = (anchor.getAttribute("class") ?? "").toLowerCase()
    return className.includes("btn") || className.includes("button") || className.includes("rounded") || className.includes("bg-")
  })

  if (buttonLike) return buttonLike
  if (candidates.length === 1) return candidates[0]

  return null
}

function extractDirectHeading(element: Element) {
  const heading = element.querySelector(":scope > h1, :scope > h2, :scope > h3")
  if (!heading) return null
  const text = normalizeText(heading.textContent)
  if (!text) return null
  return heading
}

function addConvertedBlocksFromElement(element: Element, blocks: Array<{ type: string; props: Record<string, unknown> }>) {
  const normalizedElement = unwrapLegacyWrapper(element)

  if (normalizedElement.matches('[data-me-widget="home-reviews"]') || normalizedElement.querySelector('[data-me-widget="home-reviews"]')) {
    blocks.push(
      createStructuredBlock("HomeReviewsWidget", {
        title: "Widget dinamico: reviews da Home",
        note: "Este bloco e renderizado dinamicamente no site publico.",
      }),
    )
    return
  }

  const spacerMatch = /(?:height|min-height)\s*:\s*(\d+)px/i.exec(normalizedElement.getAttribute("style") ?? "")
  if (spacerMatch && normalizedElement.children.length === 0) {
    blocks.push(
      createStructuredBlock("Spacer", {
        height: Number(spacerMatch[1]),
      }),
    )
    return
  }

  if (looksLikeTwoColumns(normalizedElement)) {
    const [left, right] = Array.from(normalizedElement.children) as Element[]
    blocks.push(
      createStructuredBlock("TwoColumnsText", {
        left: sanitizeInlineHtml(left.innerHTML || left.outerHTML),
        right: sanitizeInlineHtml(right.innerHTML || right.outerHTML),
      }),
    )
    return
  }

  const image = pickMainImage(normalizedElement)
  if (image) {
    blocks.push(
      createStructuredBlock("ImageBlock", {
        src: image.getAttribute("src") ?? "https://placehold.co/1280x720?text=Imagem",
        alt: image.getAttribute("alt") ?? "Imagem",
        caption: "",
      }),
    )
    return
  }

  const heading = extractDirectHeading(normalizedElement)
  if (heading) {
    const title = normalizeText(heading.textContent)
    const subtitleParts = Array.from(normalizedElement.querySelectorAll(":scope > p"))
      .map((paragraph) => normalizeText(paragraph.textContent))
      .filter(Boolean)

    blocks.push(
      createStructuredBlock("SectionTitle", {
        eyebrow: "Secao",
        title,
        subtitle: subtitleParts.join(" "),
        align: "center",
      }),
    )

    const clone = normalizedElement.cloneNode(true) as Element
    clone.querySelectorAll("h1,h2,h3").forEach((node) => node.remove())
    const remainder = sanitizeInlineHtml(clone.innerHTML).trim()
    if (remainder.length > 0) {
      blocks.push(
        createStructuredBlock("RichTextBlock", {
          content: remainder,
          align: "left",
        }),
      )
    }

    return
  }

  const button = pickPrimaryButton(normalizedElement)
  if (button && normalizeText(button.textContent).length > 0) {
    blocks.push(
      createStructuredBlock("ButtonBlock", {
        label: normalizeText(button.textContent),
        href: button.getAttribute("href") ?? "#",
        align: "left",
      }),
    )
    return
  }

  const childElements = Array.from(normalizedElement.children)
  const canUnrollChildren =
    ["DIV", "MAIN", "SECTION"].includes(normalizedElement.tagName) &&
    childElements.length > 1 &&
    !hasDirectText(normalizedElement)

  if (canUnrollChildren) {
    childElements.forEach((child) => {
      if (child instanceof Element) {
        addConvertedBlocksFromElement(child, blocks)
      }
    })
    return
  }

  blocks.push(
    createStructuredBlock("RichTextBlock", {
      content: sanitizeInlineHtml(normalizedElement.outerHTML),
      align: "left",
    }),
  )
}

export function convertLegacyHtmlToPuckData(html: string): Data {
  const sanitized = sanitizeInlineHtml(String(html ?? "")).trim()
  if (!sanitized) return createFallbackPuckDataFromHtml(html)

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return createFallbackPuckDataFromHtml(sanitized)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="me-legacy-root">${sanitized}</div>`, "text/html")
  const root = doc.getElementById("me-legacy-root")

  if (!root) {
    return createFallbackPuckDataFromHtml(sanitized)
  }

  const topLevelElements = Array.from(root.children).filter((node): node is Element => node instanceof Element)
  const blocks: Array<{ type: string; props: Record<string, unknown> }> = []

  topLevelElements.forEach((element) => {
    addConvertedBlocksFromElement(element, blocks)
  })

  if (blocks.length === 0) {
    return createFallbackPuckDataFromHtml(sanitized)
  }

  return {
    root: {
      props: {
        title: "Pagina institucional",
      },
    },
    content: blocks,
  } as Data
}

export function createFallbackPuckDataFromHtml(html: string): Data {
  return {
    root: {
      props: {
        title: "Pagina institucional",
      },
    },
    content: [
      {
        type: "RawHtml",
        props: {
          id: createBlockId(),
          html: sanitizeInlineHtml(String(html ?? "")),
        },
      },
    ],
  }
}

export function extractPuckDataFromLayout(layoutJson: Record<string, unknown> | undefined): Data | null {
  if (!layoutJson || typeof layoutJson !== "object") return null

  const direct = layoutJson.puckData
  if (direct && typeof direct === "object") {
    const data = direct as Record<string, unknown>
    if (Array.isArray(data.content) && data.root && typeof data.root === "object") {
      return data as Data
    }
  }

  const nested = layoutJson.data
  if (nested && typeof nested === "object") {
    const data = nested as Record<string, unknown>
    if (Array.isArray(data.content) && data.root && typeof data.root === "object") {
      return data as Data
    }
  }

  return null
}

export function renderPuckHtmlSnapshot(data: Data) {
  return renderToStaticMarkup(<Render config={sitePagePuckConfig} data={data} />)
}
