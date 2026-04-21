const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "em",
  "h2",
  "h3",
  "h4",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
])

const BLOCK_TAGS = new Set(["blockquote", "h2", "h3", "h4", "li", "ol", "p", "ul"])

function sanitizeHref(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed
  }
  return null
}

function unwrapNode(node: Element) {
  const parent = node.parentNode
  if (!parent) return

  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node)
  }

  parent.removeChild(node)
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return
  }

  if (!(node instanceof HTMLElement)) {
    node.parentNode?.removeChild(node)
    return
  }

  const tagName = node.tagName.toLowerCase()

  if (!ALLOWED_TAGS.has(tagName)) {
    unwrapNode(node)
    return
  }

  const attributes = Array.from(node.attributes)
  for (const attribute of attributes) {
    const name = attribute.name.toLowerCase()
    if (tagName === "a" && name === "href") {
      const href = sanitizeHref(attribute.value)
      if (!href) {
        node.removeAttribute(attribute.name)
      } else {
        node.setAttribute("href", href)
        node.setAttribute("target", "_blank")
        node.setAttribute("rel", "noreferrer noopener")
      }
      continue
    }

    node.removeAttribute(attribute.name)
  }

  const children = Array.from(node.childNodes)
  for (const child of children) {
    sanitizeNode(child)
  }

  if (BLOCK_TAGS.has(tagName) && !node.textContent?.trim() && node.querySelectorAll("br").length === 0) {
    node.remove()
  }
}

function normalizeHtml(html: string) {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/\s+(<\/(p|li|blockquote|h2|h3|h4|ul|ol)>)/g, "$1")
    .trim()
}

export function sanitizeRichTextHtml(value: string | null | undefined) {
  if (!value?.trim()) return ""
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return normalizeHtml(value)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${value}</div>`, "text/html")
  const root = doc.body.firstElementChild
  if (!root) return ""

  const children = Array.from(root.childNodes)
  for (const child of children) {
    sanitizeNode(child)
  }

  return normalizeHtml(root.innerHTML)
}

export function richTextToPlainText(value: string | null | undefined) {
  if (!value?.trim()) return ""
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(value, "text/html")
  return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? ""
}

export function isRichTextEmpty(value: string | null | undefined) {
  return richTextToPlainText(value).length === 0
}
