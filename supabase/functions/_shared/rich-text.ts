const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "em",
  "h1",
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

const SELF_CLOSING_TAGS = new Set(["br"])
const REMOVABLE_BLOCK_TAGS = ["p", "li", "blockquote", "h1", "h2", "h3", "h4", "ul", "ol"]
const DANGEROUS_BLOCKS = ["script", "style", "iframe", "object", "embed", "svg", "math", "template"]

function sanitizeHref(value: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed
  }

  return null
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function stripDangerousBlocks(value: string) {
  return DANGEROUS_BLOCKS.reduce((current, tagName) => {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi")
    return current.replace(pattern, "")
  }, value)
}

function sanitizeTag(rawTag: string, tagName: string, attributeSource: string) {
  const normalizedTag = tagName.toLowerCase()

  if (!ALLOWED_TAGS.has(normalizedTag)) {
    return ""
  }

  const isClosingTag = /^<\//.test(rawTag)
  if (isClosingTag) {
    return SELF_CLOSING_TAGS.has(normalizedTag) ? "" : `</${normalizedTag}>`
  }

  if (SELF_CLOSING_TAGS.has(normalizedTag)) {
    return "<br>"
  }

  if (normalizedTag === "a") {
    const hrefMatch = attributeSource.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i)
    const rawHref = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? null
    const safeHref = sanitizeHref(rawHref)

    if (!safeHref) {
      return "<a>"
    }

    return `<a href="${escapeHtmlAttribute(safeHref)}" target="_blank" rel="noreferrer noopener">`
  }

  return `<${normalizedTag}>`
}

function removeEmptyBlocks(value: string) {
  let current = value

  for (const tagName of REMOVABLE_BLOCK_TAGS) {
    const pattern = new RegExp(`<${tagName}>\\s*(<br>\\s*)*<\\/${tagName}>`, "gi")
    current = current.replace(pattern, "")
  }

  return current
}

function normalizeHtml(html: string) {
  let current = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+(<\/(p|li|blockquote|h1|h2|h3|h4|ul|ol)>)/gi, "$1")
    .trim()

  let previous = ""
  while (current !== previous) {
    previous = current
    current = removeEmptyBlocks(current).trim()
  }

  return current
}

export function sanitizeRichTextHtml(value: string | null | undefined) {
  if (!value?.trim()) {
    return ""
  }

  const withoutDangerousBlocks = stripDangerousBlocks(value)
  const sanitized = withoutDangerousBlocks.replace(
    /<\s*(\/?)\s*([a-z0-9]+)\b([^>]*)>/gi,
    (match, _slash, tagName, attributes) => sanitizeTag(match, String(tagName).toLowerCase(), attributes),
  )

  return normalizeHtml(sanitized)
}

export function richTextToPlainText(value: string | null | undefined) {
  const sanitized = sanitizeRichTextHtml(value)
  if (!sanitized) {
    return ""
  }

  return sanitized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|blockquote|h1|h2|h3|h4|ul|ol)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function isRichTextEmpty(value: string | null | undefined) {
  return richTextToPlainText(value).length === 0
}
