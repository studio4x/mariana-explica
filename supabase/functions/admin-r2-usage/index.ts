import { AwsClient } from "npm:aws4fetch@1.0.20"
import {
  badRequest,
  createSignedReadUrl,
  corsResponse,
  deleteStorageObject,
  errorResponse,
  getRequestId,
  jsonResponse,
  requireAdmin,
} from "../_shared/mod.ts"
import { parseListObjectsXml } from "./xml.ts"

type AdminAction = "overview" | "list_objects" | "delete_object"
type AdminR2FileType = "image" | "video" | "audio" | "document" | "archive" | "other"

interface AdminBody {
  action?: AdminAction
  prefix?: string | null
  cursor?: string | null
  limit?: number | null
  search?: string | null
  file_type?: AdminR2FileType | "all" | null
  logical_bucket?: string | null
  storage_path?: string | null
  storage_provider?: "supabase" | "r2" | null
}

interface AdminListedObject {
  key: string
  logical_bucket: string
  storage_path: string
  size_bytes: number
  last_modified: string | null
  file_type: AdminR2FileType
  preview_url: string | null
}

function readEnv(name: string, fallback?: string) {
  const value = Deno.env.get(name) ?? fallback ?? ""
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${name} nao configurado`)
  }
  return trimmed
}

function getEndpointBase() {
  return readEnv("R2_S3_ENDPOINT", Deno.env.get("S3_API-CLOUDFLARE") ?? "").replace(/\/+$/, "")
}

function getPhysicalBucket() {
  return readEnv("R2_PRIVATE_BUCKET")
}

function getRegion() {
  return readEnv("R2_REGION", "auto")
}

function getClient() {
  return new AwsClient({
    service: "s3",
    region: getRegion(),
    accessKeyId: readEnv("R2_ACCESS_KEY_ID", Deno.env.get("S3_ACCESS_KEY_ID") ?? ""),
    secretAccessKey: readEnv("R2_SECRET_ACCESS_KEY", Deno.env.get("S3_SECRET_ACCESS_KEY") ?? ""),
  })
}

function parsePositiveInteger(value: number | null | undefined, fallback: number, max = 1000) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.trunc(parsed), max)
}

function trimPath(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/^\/+/, "")
}

function normalizeSearch(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizeToken(value: string | null | undefined) {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

function normalizeFileType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (["image", "video", "audio", "document", "archive", "other"].includes(normalized)) {
    return normalized as AdminR2FileType
  }

  return null
}

function getFileExtension(storagePath: string) {
  const lastSegment = storagePath.split("/").at(-1) ?? ""
  const extension = lastSegment.split(".").at(-1)?.trim().toLowerCase() ?? ""
  return extension && extension !== lastSegment.toLowerCase() ? extension : ""
}

function inferFileType(storagePath: string): AdminR2FileType {
  const extension = getFileExtension(storagePath)

  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "ico"].includes(extension)) {
    return "image"
  }

  if (["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv"].includes(extension)) {
    return "video"
  }

  if (["mp3", "wav", "m4a", "aac", "flac", "oga"].includes(extension)) {
    return "audio"
  }

  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "csv", "ppt", "pptx", "odt"].includes(extension)) {
    return "document"
  }

  if (["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"].includes(extension)) {
    return "archive"
  }

  return "other"
}

function encodeCursor(cursor: { continuationToken: string | null; offset: number }) {
  return btoa(JSON.stringify(cursor))
}

function decodeCursor(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) {
    return { continuationToken: null, offset: 0 }
  }

  try {
    const decoded = JSON.parse(atob(raw)) as { continuationToken?: unknown; offset?: unknown }
    const continuationToken = normalizeToken(typeof decoded.continuationToken === "string" ? decoded.continuationToken : null)
    const offset = parsePositiveInteger(typeof decoded.offset === "number" ? decoded.offset : 0, 0, 1000)
    return { continuationToken, offset: Math.max(0, offset) }
  } catch {
    return { continuationToken: normalizeToken(raw), offset: 0 }
  }
}

function matchesObjectFilters(
  object: { key: string; logical_bucket: string; storage_path: string; file_type: AdminR2FileType },
  search: string,
  fileType: AdminR2FileType | null,
) {
  if (fileType && object.file_type !== fileType) {
    return false
  }

  if (!search) {
    return true
  }

  const haystack = `${object.logical_bucket} ${object.storage_path} ${object.key}`.toLowerCase()
  return haystack.includes(search)
}

async function enrichObjectPreview(
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  object: {
    key: string
    logical_bucket: string
    storage_path: string
    size_bytes: number
    last_modified: string | null
    file_type: AdminR2FileType
  },
): Promise<AdminListedObject> {
  if (object.file_type !== "image") {
    return {
      ...object,
      preview_url: null,
    }
  }

  const previewUrl = await createSignedReadUrl({
    serviceClient,
    logicalBucket: object.logical_bucket,
    storagePath: object.storage_path,
    provider: "r2",
    expiresInSeconds: 600,
  }).catch(() => null)

  return {
    ...object,
    preview_url: previewUrl,
  }
}

async function listObjectsPage(prefix?: string | null, cursor?: string | null, limit?: number | null) {
  const url = new URL(`${getEndpointBase()}/${getPhysicalBucket()}`)
  url.searchParams.set("list-type", "2")
  url.searchParams.set("max-keys", String(parsePositiveInteger(limit, 100)))

  const normalizedPrefix = trimPath(prefix)
  if (normalizedPrefix) {
    url.searchParams.set("prefix", normalizedPrefix)
  }

  const continuationToken = trimPath(cursor)
  if (continuationToken) {
    url.searchParams.set("continuation-token", continuationToken)
  }

  const response = await getClient().fetch(url.toString(), { method: "GET" })
  if (!response.ok) {
    throw new Error(`Falha ao listar objectos no R2 (${response.status})`)
  }

  return parseListObjectsXml(await response.text())
}

async function listFilteredObjects(
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  input?: {
    prefix?: string | null
    cursor?: string | null
    limit?: number | null
    search?: string | null
    fileType?: string | null
  },
) {
  const limit = parsePositiveInteger(input?.limit, 100, 250)
  const search = normalizeSearch(input?.search)
  const fileType = normalizeFileType(input?.fileType)
  const decodedCursor = decodeCursor(input?.cursor)
  const scanBatchSize = Math.min(Math.max(limit * 3, 200), 1000)

  let continuationToken = decodedCursor.continuationToken
  let offset = decodedCursor.offset
  let scannedPages = 0
  const matchedObjects: AdminListedObject[] = []

  while (scannedPages < 25) {
    const page = await listObjectsPage(input?.prefix, continuationToken, scanBatchSize)
    const typedObjects = page.objects.map((object) => ({
      ...object,
      file_type: inferFileType(object.storage_path),
    }))

    for (let index = offset; index < typedObjects.length; index += 1) {
      const object = typedObjects[index]
      if (!matchesObjectFilters(object, search, fileType)) {
        continue
      }

      matchedObjects.push(await enrichObjectPreview(serviceClient, object))

      if (matchedObjects.length >= limit) {
        const hasMoreInCurrentPage = index + 1 < typedObjects.length
        const nextCursor = hasMoreInCurrentPage
          ? encodeCursor({ continuationToken, offset: index + 1 })
          : page.nextCursor
            ? encodeCursor({ continuationToken: page.nextCursor, offset: 0 })
            : null

        return {
          objects: matchedObjects,
          nextCursor,
          hasMore: Boolean(nextCursor),
        }
      }
    }

    if (!page.isTruncated || !page.nextCursor) {
      return {
        objects: matchedObjects,
        nextCursor: null,
        hasMore: false,
      }
    }

    continuationToken = page.nextCursor
    offset = 0
    scannedPages += 1
  }

  return {
    objects: matchedObjects,
    nextCursor: continuationToken ? encodeCursor({ continuationToken, offset: 0 }) : null,
    hasMore: Boolean(continuationToken),
  }
}

async function computeOverview(prefix?: string | null) {
  let cursor: string | null = null
  let objectCount = 0
  let totalSizeBytes = 0
  let pageCount = 0

  do {
    const page = await listObjectsPage(prefix, cursor, 1000)
    objectCount += page.objects.length
    totalSizeBytes += page.objects.reduce((sum, object) => sum + object.size_bytes, 0)
    cursor = page.nextCursor
    pageCount += 1
  } while (cursor && pageCount < 200)

  return {
    bucket: getPhysicalBucket(),
    prefix: trimPath(prefix) || null,
    object_count: objectCount,
    total_size_bytes: totalSizeBytes,
    provider_default: Deno.env.get("STORAGE_PROVIDER_DEFAULT")?.trim() || "r2",
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const body = (await req.json().catch(() => null)) as AdminBody | null
    const action = body?.action

    if (!action) {
      throw badRequest("action e obrigatorio")
    }

    if (action === "overview") {
      const overview = await computeOverview(body?.prefix)
      return jsonResponse({ success: true, request_id: requestId, overview })
    }

    if (action === "list_objects") {
      const page = await listFilteredObjects(context.serviceClient, {
        prefix: body?.prefix,
        cursor: body?.cursor,
        limit: body?.limit,
        search: body?.search,
        fileType: body?.file_type,
      })
      return jsonResponse({
        success: true,
        request_id: requestId,
        objects: page.objects,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      })
    }

    if (action === "delete_object") {
      const logicalBucket = trimPath(body?.logical_bucket)
      const storagePath = trimPath(body?.storage_path)
      if (!logicalBucket || !storagePath) {
        throw badRequest("logical_bucket e storage_path sao obrigatorios")
      }

      await deleteStorageObject({
        serviceClient: context.serviceClient,
        logicalBucket,
        storagePath,
        provider: body?.storage_provider === "supabase" ? "supabase" : "r2",
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        deleted: {
          logical_bucket: logicalBucket,
          storage_path: storagePath,
        },
      })
    }

    throw badRequest("action invalida")
  } catch (error) {
    return errorResponse(error, requestId)
  }
})
