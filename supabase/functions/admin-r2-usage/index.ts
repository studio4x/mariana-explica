import { AwsClient } from "npm:aws4fetch@1.0.20"
import {
  badRequest,
  corsResponse,
  deleteStorageObject,
  errorResponse,
  getRequestId,
  jsonResponse,
  requireAdmin,
} from "../_shared/mod.ts"
import { parseListObjectsXml } from "./xml.ts"

type AdminAction = "overview" | "list_objects" | "delete_object"

interface AdminBody {
  action?: AdminAction
  prefix?: string | null
  cursor?: string | null
  limit?: number | null
  logical_bucket?: string | null
  storage_path?: string | null
  storage_provider?: "supabase" | "r2" | null
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
      const page = await listObjectsPage(body?.prefix, body?.cursor, body?.limit)
      return jsonResponse({
        success: true,
        request_id: requestId,
        objects: page.objects,
        next_cursor: page.nextCursor,
        has_more: page.isTruncated,
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
