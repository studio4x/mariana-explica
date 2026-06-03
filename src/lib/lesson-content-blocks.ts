import { sanitizeRichTextHtml } from "@/lib/rich-text"

export interface LessonImageBlockContent {
  storage_path: string
  public_url?: string | null
  alt: string
}

export interface LessonVideoBlockContent {
  storage_path: string
  public_url?: string | null
  title: string
}

export type LessonContentBlock =
  | { type: "rich-text"; content: string }
  | { type: "table"; content: string }
  | { type: "image"; content: LessonImageBlockContent }
  | { type: "video"; content: LessonVideoBlockContent }

const TABLE_ALLOWED_TAGS = new Set([
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
])

const TABLE_ALLOWED_ATTRS = new Set(["colspan", "rowspan", "scope", "span"])

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value.trim()
}

function resolveLessonImageSrc(content: LessonImageBlockContent) {
  return content.public_url?.trim() || content.storage_path.trim()
}

function resolveLessonVideoSrc(content: LessonVideoBlockContent) {
  return content.public_url?.trim() || content.storage_path.trim()
}

export function normalizeLessonImageBlockContent(input: unknown): LessonImageBlockContent {
  const raw = asRecord(input) ?? {}
  const assetRaw = asRecord(raw.asset) ?? raw

  return {
    storage_path: asText(assetRaw.storage_path) || asText(raw.storage_path),
    public_url: asText(assetRaw.public_url) || asText(raw.public_url) || null,
    alt: asText(assetRaw.alt) || asText(raw.alt) || "Imagem da aula",
  }
}

export function normalizeLessonVideoBlockContent(input: unknown): LessonVideoBlockContent {
  const raw = asRecord(input) ?? {}
  const assetRaw = asRecord(raw.asset) ?? raw

  return {
    storage_path: asText(assetRaw.storage_path) || asText(raw.storage_path),
    public_url: asText(assetRaw.public_url) || asText(raw.public_url) || null,
    title: asText(assetRaw.title) || asText(raw.title) || "Vídeo da aula",
  }
}

function serializeImageFallback(content: LessonImageBlockContent) {
  const src = resolveLessonImageSrc(content)
  const alt = escapeHtml(content.alt || "Imagem da aula")
  const payload = encodeURIComponent(JSON.stringify(content))

  return src
    ? `<figure class="hcm-image-block" data-hcm-block="image" data-hcm-payload="${payload}"><img src="${escapeHtml(
        src,
      )}" alt="${alt}" loading="lazy" /></figure>`
    : `<figure class="hcm-image-block" data-hcm-block="image" data-hcm-payload="${payload}"></figure>`
}

export function buildLessonVideoEmbedUrl(source: string) {
  const trimmed = source.trim()
  if (!trimmed || typeof window === "undefined" || typeof URL === "undefined") return null

  try {
    const url = new URL(trimmed, window.location.origin)
    const host = url.hostname.toLowerCase()

    if (host.includes("youtu.be")) {
      const videoId = url.pathname.replace(/^\/+/, "").split(/[?#/]/)[0]
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }

    if (host.includes("youtube.com")) {
      const embedded = url.pathname.match(/\/embed\/([^/?#]+)/)?.[1]
      if (embedded) return `https://www.youtube-nocookie.com/embed/${embedded}`

      const videoId = url.searchParams.get("v")
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }

    if (host.includes("vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean).pop()
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }
  } catch {
    return null
  }

  return null
}

function serializeVideoFallback(content: LessonVideoBlockContent) {
  const src = resolveLessonVideoSrc(content)
  const title = escapeHtml(content.title || "Vídeo da aula")
  const payload = encodeURIComponent(JSON.stringify(content))
  const embedUrl = buildLessonVideoEmbedUrl(src)

  if (!src) {
    return `<figure class="hcm-video-block" data-hcm-block="video" data-hcm-payload="${payload}"></figure>`
  }

  if (embedUrl) {
    return `<figure class="hcm-video-block" data-hcm-block="video" data-hcm-payload="${payload}"><iframe src="${escapeHtml(
      embedUrl,
    )}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>`
  }

  return `<figure class="hcm-video-block" data-hcm-block="video" data-hcm-payload="${payload}"><video controls preload="metadata" src="${escapeHtml(
    src,
  )}"></video></figure>`
}

function serializeNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "")
  }
  if (node instanceof Element) {
    return node.outerHTML
  }
  return ""
}

export function sanitizeTableHtml(tableHtml: string) {
  if (!tableHtml.trim()) return ""
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return tableHtml.trim()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${tableHtml}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return ""

  root.querySelectorAll("script,style,iframe,object,embed").forEach((node) => node.remove())

  const walk = (node: Element) => {
    const tag = node.tagName.toLowerCase()
    if (!TABLE_ALLOWED_TAGS.has(tag)) {
      const parent = node.parentNode
      if (parent) {
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node)
        }
        parent.removeChild(node)
      }
      return
    }

    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase()
      if (!TABLE_ALLOWED_ATTRS.has(name)) {
        node.removeAttribute(attribute.name)
      }
    }

    Array.from(node.children).forEach(walk)
  }

  Array.from(root.children).forEach(walk)

  root.querySelectorAll("th,td").forEach((cell) => {
    if (!cell.textContent?.trim() && cell.querySelectorAll("br").length === 0) {
      cell.setAttribute("data-empty-cell", "true")
    } else {
      cell.removeAttribute("data-empty-cell")
    }
  })

  return root.innerHTML.trim()
}

export function splitLessonContent(content: string | null | undefined): LessonContentBlock[] {
  const html = content?.trim() ?? ""
  if (!html) return [{ type: "rich-text", content: "" }]
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return [{ type: "rich-text", content: html }]
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild
  if (!root) return [{ type: "rich-text", content: html }]

  const blocks: LessonContentBlock[] = []
  let pendingRichText = ""

  const pushPendingRichText = () => {
    const normalized = pendingRichText.trim()
    if (normalized) {
      blocks.push({ type: "rich-text", content: normalized })
    }
    pendingRichText = ""
  }

  const children = Array.from(root.childNodes)
  for (const child of children) {
    if (
      child instanceof HTMLElement &&
      (child.dataset.hcmBlock === "image" || child.dataset.hcmBlock === "image-hotspots") &&
      child.dataset.hcmPayload
    ) {
      pushPendingRichText()
      try {
        const payloadText = decodeURIComponent(child.dataset.hcmPayload)
        const payload = JSON.parse(payloadText) as unknown
        blocks.push({
          type: "image",
          content: normalizeLessonImageBlockContent(payload),
        })
      } catch {
        pendingRichText += child.innerHTML
      }
      continue
    }

    if (
      child instanceof HTMLElement &&
      child.dataset.hcmBlock === "video" &&
      child.dataset.hcmPayload
    ) {
      pushPendingRichText()
      try {
        const payloadText = decodeURIComponent(child.dataset.hcmPayload)
        const payload = JSON.parse(payloadText) as unknown
        blocks.push({
          type: "video",
          content: normalizeLessonVideoBlockContent(payload),
        })
      } catch {
        pendingRichText += child.innerHTML
      }
      continue
    }

    if (child instanceof HTMLImageElement) {
      pushPendingRichText()
      blocks.push({
        type: "image",
        content: normalizeLessonImageBlockContent({
          storage_path: child.getAttribute("src") ?? "",
          public_url: child.getAttribute("src") ?? null,
          alt: child.getAttribute("alt") ?? "Imagem da aula",
        }),
      })
      continue
    }

    if (child instanceof HTMLVideoElement) {
      pushPendingRichText()
      const source =
        child.getAttribute("src") ||
        child.querySelector("source")?.getAttribute("src") ||
        ""
      blocks.push({
        type: "video",
        content: normalizeLessonVideoBlockContent({
          storage_path: source,
          public_url: source || null,
          title: child.getAttribute("title") || child.getAttribute("aria-label") || "Vídeo da aula",
        }),
      })
      continue
    }

    if (child instanceof HTMLIFrameElement) {
      const src = child.getAttribute("src") ?? ""
      if (src && /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(src)) {
        pushPendingRichText()
        blocks.push({
          type: "video",
          content: normalizeLessonVideoBlockContent({
            storage_path: src,
            public_url: src,
            title: child.getAttribute("title") || "Vídeo da aula",
          }),
        })
        continue
      }
    }

    if (child instanceof HTMLTableElement) {
      pushPendingRichText()
      blocks.push({ type: "table", content: sanitizeTableHtml(child.outerHTML) })
      continue
    }

    pendingRichText += serializeNode(child)
  }

  pushPendingRichText()

  if (blocks.length === 0) {
    return [{ type: "rich-text", content: html }]
  }

  return blocks
}

export function mergeLessonContent(blocks: LessonContentBlock[]): string {
  const chunks = blocks
    .map((block) => {
      if (block.type === "rich-text") {
        return sanitizeRichTextHtml(block.content)
      }

      if (block.type === "table") {
        return sanitizeTableHtml(block.content)
      }

      if (block.type === "video") {
        return serializeVideoFallback(normalizeLessonVideoBlockContent(block.content))
      }

      return serializeImageFallback(normalizeLessonImageBlockContent(block.content))
    })
    .filter((chunk) => chunk.trim().length > 0)

  return chunks.join("\n\n").trim()
}

export function isLessonContentEmpty(value: string | null | undefined) {
  return mergeLessonContent(splitLessonContent(value)).length === 0
}
