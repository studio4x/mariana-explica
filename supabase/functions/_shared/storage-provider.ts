import { AwsClient } from "npm:aws4fetch@1.0.20"
import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { badRequest, internalError } from "./errors.ts"
import { getAppBaseUrl } from "./supabase.ts"

export type StorageProvider = "supabase" | "r2"
export type PublicProxyKind = "site_asset" | "course_media" | "profile_avatar"

interface SignedUploadTicketInput {
  serviceClient: SupabaseClient
  logicalBucket: string
  storagePath: string
  mimeType: string
  provider?: StorageProvider | null
  publicProxyKind?: PublicProxyKind | null
  expiresInSeconds?: number
}

interface SignedReadUrlInput {
  serviceClient: SupabaseClient
  logicalBucket: string
  storagePath: string
  provider?: StorageProvider | null
  expiresInSeconds?: number
  downloadFileName?: string | null
}

interface UploadObjectInput {
  serviceClient: SupabaseClient
  logicalBucket: string
  storagePath: string
  provider?: StorageProvider | null
  body: Blob | ArrayBuffer | ArrayBufferView | File | Uint8Array | string
  contentType?: string | null
  cacheControl?: string | null
}

interface DeleteObjectInput {
  serviceClient: SupabaseClient
  logicalBucket: string
  storagePath: string
  provider?: StorageProvider | null
}

interface DownloadObjectInput {
  serviceClient: SupabaseClient
  logicalBucket: string
  storagePath: string
  provider?: StorageProvider | null
}

function readEnv(name: string, fallback?: string) {
  const value = Deno.env.get(name) ?? fallback ?? ""
  const trimmed = value.trim()
  if (!trimmed) {
    throw internalError(`${name} nao configurado`)
  }
  return trimmed
}

function readOptionalEnv(name: string, fallback?: string) {
  const value = Deno.env.get(name) ?? fallback ?? ""
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeProvider(value: unknown): StorageProvider | null {
  if (value === "r2" || value === "supabase") return value
  return null
}

function normalizePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

function trimPath(value: string) {
  return value.replace(/^\/+/, "").trim()
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

function buildContentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeQueryValue(fileName)}`
}

function getR2EndpointBase() {
  return readEnv("R2_S3_ENDPOINT", readOptionalEnv("S3_API-CLOUDFLARE") ?? undefined).replace(/\/+$/, "")
}

function getR2PhysicalBucket() {
  return readEnv("R2_PRIVATE_BUCKET")
}

function getR2Region() {
  return readEnv("R2_REGION", "auto")
}

function getDefaultStorageProvider(): StorageProvider {
  return normalizeProvider(readOptionalEnv("STORAGE_PROVIDER_DEFAULT")) ?? "r2"
}

export function getSignedGetExpiresSeconds() {
  return normalizePositiveInteger(readOptionalEnv("R2_SIGNED_GET_EXPIRES_SECONDS"), 300)
}

export function getSignedVideoGetExpiresSeconds() {
  return normalizePositiveInteger(
    readOptionalEnv("R2_VIDEO_SIGNED_GET_EXPIRES_SECONDS"),
    Math.max(getSignedGetExpiresSeconds(), 60 * 60),
  )
}

function getSignedPutExpiresSeconds() {
  return normalizePositiveInteger(readOptionalEnv("R2_SIGNED_PUT_EXPIRES_SECONDS"), 600)
}

function getMaxFileSizeBytes() {
  return normalizePositiveInteger(readOptionalEnv("R2_MAX_FILE_SIZE_BYTES"), 50 * 1024 * 1024)
}

function buildR2ObjectKey(logicalBucket: string, storagePath: string) {
  const normalizedBucket = trimPath(logicalBucket)
  const normalizedPath = trimPath(storagePath)

  if (!normalizedBucket || !normalizedPath) {
    throw badRequest("logicalBucket e storagePath sao obrigatorios")
  }

  return `${normalizedBucket}/${normalizedPath}`
}

function getR2Client() {
  return new AwsClient({
    service: "s3",
    region: getR2Region(),
    accessKeyId: readEnv("R2_ACCESS_KEY_ID", readOptionalEnv("S3_ACCESS_KEY_ID") ?? undefined),
    secretAccessKey: readEnv("R2_SECRET_ACCESS_KEY", readOptionalEnv("S3_SECRET_ACCESS_KEY") ?? undefined),
  })
}

function buildPublicProxyUrl(kind: PublicProxyKind, storagePath: string) {
  const baseUrl = getAppBaseUrl().replace(/\/+$/, "")
  const encodedPath = encodeURIComponent(trimPath(storagePath))

  if (kind === "site_asset") {
    return `${baseUrl}/api/public/site-asset?storage_path=${encodedPath}`
  }

  if (kind === "course_media") {
    return `${baseUrl}/api/public/course-media?storage_path=${encodedPath}`
  }

  return `${baseUrl}/api/public/profile-avatar?storage_path=${encodedPath}`
}

export function resolveStorageProvider(provider?: StorageProvider | null) {
  return normalizeProvider(provider) ?? getDefaultStorageProvider()
}

export function getStorageLimits() {
  return {
    defaultProvider: getDefaultStorageProvider(),
    signedGetExpiresSeconds: getSignedGetExpiresSeconds(),
    signedVideoGetExpiresSeconds: getSignedVideoGetExpiresSeconds(),
    signedPutExpiresSeconds: getSignedPutExpiresSeconds(),
    maxFileSizeBytes: getMaxFileSizeBytes(),
  }
}

export async function createSignedUploadTicket(input: SignedUploadTicketInput) {
  const provider = resolveStorageProvider(input.provider)
  const expiresInSeconds = input.expiresInSeconds ?? getSignedPutExpiresSeconds()
  const normalizedStoragePath = trimPath(input.storagePath)
  const publicUrl = input.publicProxyKind ? buildPublicProxyUrl(input.publicProxyKind, normalizedStoragePath) : null

  if (provider === "supabase") {
    const signedUpload = await input.serviceClient.storage
      .from(input.logicalBucket)
      .createSignedUploadUrl(normalizedStoragePath)

    if (signedUpload.error || !signedUpload.data) {
      throw signedUpload.error ?? internalError("Nao foi possivel criar ticket de upload")
    }

    return {
      provider,
      upload_method: "supabase_signed_upload",
      upload_path: normalizedStoragePath,
      upload_token: signedUpload.data.token,
      upload_url: signedUpload.data.signedUrl,
      upload_headers: {} as Record<string, string>,
      storage_bucket: input.logicalBucket,
      storage_provider: provider,
      public_url: publicUrl,
    }
  }

  const objectKey = buildR2ObjectKey(input.logicalBucket, normalizedStoragePath)
  const signedRequest = await getR2Client().sign(
    new Request(
      `${getR2EndpointBase()}/${getR2PhysicalBucket()}/${objectKey}?X-Amz-Expires=${expiresInSeconds}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": input.mimeType,
        },
      },
    ),
    {
      aws: {
        signQuery: true,
      },
    },
  )

  return {
    provider,
    upload_method: "r2_signed_put",
    upload_path: normalizedStoragePath,
    upload_token: null,
    upload_url: signedRequest.url.toString(),
    upload_headers: {
      "Content-Type": input.mimeType,
    },
    storage_bucket: input.logicalBucket,
    storage_provider: provider,
    public_url: publicUrl,
  }
}

export async function createSignedReadUrl(input: SignedReadUrlInput) {
  const provider = resolveStorageProvider(input.provider)
  const expiresInSeconds = input.expiresInSeconds ?? getSignedGetExpiresSeconds()
  const normalizedStoragePath = trimPath(input.storagePath)

  if (provider === "supabase") {
    const signedUrl = await input.serviceClient.storage
      .from(input.logicalBucket)
      .createSignedUrl(normalizedStoragePath, expiresInSeconds, {
        download: input.downloadFileName ?? undefined,
      })

    if (signedUrl.error || !signedUrl.data?.signedUrl) {
      throw signedUrl.error ?? internalError("Nao foi possivel criar acesso temporario")
    }

    return signedUrl.data.signedUrl
  }

  const objectKey = buildR2ObjectKey(input.logicalBucket, normalizedStoragePath)
  const url = new URL(`${getR2EndpointBase()}/${getR2PhysicalBucket()}/${objectKey}`)
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds))

  if (input.downloadFileName) {
    url.searchParams.set("response-content-disposition", buildContentDisposition(input.downloadFileName))
  }

  const signedRequest = await getR2Client().sign(new Request(url.toString()), {
    aws: {
      signQuery: true,
    },
  })

  return signedRequest.url.toString()
}

export async function uploadStorageObject(input: UploadObjectInput) {
  const provider = resolveStorageProvider(input.provider)
  const normalizedStoragePath = trimPath(input.storagePath)

  if (provider === "supabase") {
    const upload = await input.serviceClient.storage.from(input.logicalBucket).upload(normalizedStoragePath, input.body, {
      upsert: false,
      contentType: input.contentType ?? undefined,
      cacheControl: input.cacheControl ?? undefined,
    })

    if (upload.error) {
      throw upload.error
    }

    return
  }

  const objectKey = buildR2ObjectKey(input.logicalBucket, normalizedStoragePath)
  const response = await getR2Client().fetch(
    `${getR2EndpointBase()}/${getR2PhysicalBucket()}/${objectKey}`,
    {
      method: "PUT",
      headers: {
        ...(input.contentType ? { "Content-Type": input.contentType } : {}),
        ...(input.cacheControl ? { "Cache-Control": input.cacheControl } : {}),
      },
      body: input.body,
    },
  )

  if (!response.ok) {
    throw internalError(`Falha ao enviar objecto para R2 (${response.status})`)
  }
}

export async function deleteStorageObject(input: DeleteObjectInput) {
  const provider = resolveStorageProvider(input.provider)
  const normalizedStoragePath = trimPath(input.storagePath)

  if (!normalizedStoragePath) return

  if (provider === "supabase") {
    const remove = await input.serviceClient.storage.from(input.logicalBucket).remove([normalizedStoragePath])
    if (remove.error) {
      throw remove.error
    }
    return
  }

  const objectKey = buildR2ObjectKey(input.logicalBucket, normalizedStoragePath)
  const response = await getR2Client().fetch(
    `${getR2EndpointBase()}/${getR2PhysicalBucket()}/${objectKey}`,
    { method: "DELETE" },
  )

  if (!response.ok && response.status !== 404) {
    throw internalError(`Falha ao apagar objecto no R2 (${response.status})`)
  }
}

export async function downloadStorageObject(input: DownloadObjectInput) {
  const provider = resolveStorageProvider(input.provider)
  const normalizedStoragePath = trimPath(input.storagePath)

  if (provider === "supabase") {
    const download = await input.serviceClient.storage.from(input.logicalBucket).download(normalizedStoragePath)
    if (download.error || !download.data) {
      throw download.error ?? internalError("Nao foi possivel ler o objecto")
    }

    return new Uint8Array(await download.data.arrayBuffer())
  }

  const objectKey = buildR2ObjectKey(input.logicalBucket, normalizedStoragePath)
  const response = await getR2Client().fetch(
    `${getR2EndpointBase()}/${getR2PhysicalBucket()}/${objectKey}`,
  )

  if (!response.ok) {
    throw internalError(`Falha ao ler objecto no R2 (${response.status})`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

export function buildStoragePublicUrl(kind: PublicProxyKind, storagePath: string) {
  return buildPublicProxyUrl(kind, storagePath)
}

export function buildStorageObjectKey(logicalBucket: string, storagePath: string) {
  return buildR2ObjectKey(logicalBucket, storagePath)
}
