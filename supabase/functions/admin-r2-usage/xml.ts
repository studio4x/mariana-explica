interface ListedObject {
  key: string
  logical_bucket: string
  storage_path: string
  size_bytes: number
  last_modified: string | null
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function decodeXmlText(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (entity, code) => {
    switch (code) {
      case "amp":
        return "&"
      case "lt":
        return "<"
      case "gt":
        return ">"
      case "quot":
        return '"'
      case "apos":
        return "'"
      default: {
        if (!code.startsWith("#")) return entity
        const isHex = code[1]?.toLowerCase() === "x"
        const numericValue = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10)
        return Number.isFinite(numericValue) ? String.fromCodePoint(numericValue) : entity
      }
    }
  })
}

function readXmlTagValues(xmlText: string, tagName: string) {
  const escapedTagName = escapeRegExp(tagName)
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${escapedTagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escapedTagName}>`,
    "g",
  )

  return Array.from(xmlText.matchAll(pattern), (match) => decodeXmlText(match[1]?.trim() ?? ""))
}

function readFirstXmlTagValue(xmlText: string, tagName: string) {
  return readXmlTagValues(xmlText, tagName)[0] ?? null
}

export function parseListObjectsXml(xmlText: string): {
  objects: ListedObject[]
  nextCursor: string | null
  isTruncated: boolean
} {
  const contentBlocks = readXmlTagValues(xmlText, "Contents")
  const nextCursor = readFirstXmlTagValue(xmlText, "NextContinuationToken")
  const isTruncated = (readFirstXmlTagValue(xmlText, "IsTruncated") ?? "").toLowerCase() === "true"

  if (!contentBlocks.length && !xmlText.includes("<ListBucketResult") && !xmlText.includes(":ListBucketResult")) {
    throw new Error("Nao foi possivel interpretar a resposta do R2")
  }

  const objects = contentBlocks.map((contentXml) => {
    const key = readFirstXmlTagValue(contentXml, "Key") ?? ""
    const size = Number(readFirstXmlTagValue(contentXml, "Size") ?? "0")
    const lastModified = readFirstXmlTagValue(contentXml, "LastModified")
    const parts = key.split("/")
    const logicalBucket = parts.shift() ?? ""
    const storagePath = parts.join("/")

    return {
      key,
      logical_bucket: logicalBucket,
      storage_path: storagePath,
      size_bytes: Number.isFinite(size) ? size : 0,
      last_modified: lastModified,
    }
  })

  return { objects, nextCursor, isTruncated }
}
