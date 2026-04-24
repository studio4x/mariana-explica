import { sanitizeRichTextHtml } from "@/lib/rich-text"

export interface LessonImageHotspot {
  id: string
  x: number
  y: number
  title: string
  body_html: string
}

export interface LessonImageHotspotsBlockContent {
  asset: {
    storage_path: string
    signed_url?: string | null
    alt: string
    width: number
    height: number
  }
  hotspots: LessonImageHotspot[]
}

export type LessonContentBlock =
  | { type: "rich-text"; content: string }
  | { type: "table"; content: string }
  | { type: "image-hotspots"; content: LessonImageHotspotsBlockContent }

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value.trim()
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function sanitizeSimpleLinks(root: HTMLElement) {
  root.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href")?.trim() ?? ""
    if (!href) {
      anchor.removeAttribute("href")
      return
    }
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
      anchor.removeAttribute("href")
      return
    }
    anchor.setAttribute("target", "_blank")
    anchor.setAttribute("rel", "noreferrer noopener")
  })

  root.querySelectorAll("script,style,iframe,object,embed").forEach((node) => node.remove())
  root.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      if (name === "href" && node.tagName.toLowerCase() === "a") continue
      if (name === "target" && node.tagName.toLowerCase() === "a") continue
      if (name === "rel" && node.tagName.toLowerCase() === "a") continue
      if (name.startsWith("on") || name === "style") node.removeAttribute(attr.name)
    }
  })
}

export function sanitizeHotspotBodyHtml(input: string) {
  const html = sanitizeRichTextHtml(input)
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") return html
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return ""
  sanitizeSimpleLinks(root)
  return root.innerHTML.trim()
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

function serializeImageHotspotsFallback(content: LessonImageHotspotsBlockContent) {
  const items = content.hotspots
    .map(
      (hotspot) =>
        `<li><strong>${escapeHtml(hotspot.title)}</strong><div>${sanitizeHotspotBodyHtml(
          hotspot.body_html,
        )}</div></li>`,
    )
    .join("")
  return `<div class="hcm-image-hotspots-fallback"><p><strong>Imagem interativa</strong></p><ul>${items}</ul></div>`
}

export function normalizeLessonImageHotspotsBlockContent(
  input: unknown,
): LessonImageHotspotsBlockContent {
  const raw = asRecord(input) ?? {}
  const assetRaw = asRecord(raw.asset) ?? {}
  const rawHotspots = ensureArray<unknown>(raw.hotspots)

  const hotspots = rawHotspots.map((hotspot, index) => {
    const record = asRecord(hotspot) ?? {}
    const id = asText(record.id) || (typeof crypto !== "undefined" ? crypto.randomUUID() : `hotspot-${index + 1}`)
    const x = Number(clamp(asNumber(record.x, 0), 0, 100).toFixed(2))
    const y = Number(clamp(asNumber(record.y, 0), 0, 100).toFixed(2))
    return {
      id,
      x,
      y,
      title: asText(record.title) || `Hotspot ${index + 1}`,
      body_html: sanitizeHotspotBodyHtml(asText(record.body_html)),
    }
  })

  return {
    asset: {
      storage_path: asText(assetRaw.storage_path),
      signed_url: asText(assetRaw.signed_url) || null,
      alt: asText(assetRaw.alt) || "Imagem interativa da aula",
      width: Math.max(1, Math.round(asNumber(assetRaw.width, 1600))),
      height: Math.max(1, Math.round(asNumber(assetRaw.height, 900))),
    },
    hotspots,
  }
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
      child.dataset.hcmBlock === "image-hotspots" &&
      child.dataset.hcmPayload
    ) {
      pushPendingRichText()
      try {
        const payloadText = decodeURIComponent(child.dataset.hcmPayload)
        const payload = JSON.parse(payloadText) as unknown
        blocks.push({
          type: "image-hotspots",
          content: normalizeLessonImageHotspotsBlockContent(payload),
        })
      } catch {
        pendingRichText += child.innerHTML
      }
      continue
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

      const normalized = normalizeLessonImageHotspotsBlockContent(block.content)
      const payload = encodeURIComponent(JSON.stringify(normalized))
      const fallback = serializeImageHotspotsFallback(normalized)
      return `<div data-hcm-block="image-hotspots" data-hcm-payload="${payload}">${fallback}</div>`
    })
    .filter((chunk) => chunk.trim().length > 0)

  return chunks.join("\n\n").trim()
}

export function isLessonContentEmpty(value: string | null | undefined) {
  return mergeLessonContent(splitLessonContent(value)).length === 0
}
