import { supabase } from "@/integrations/supabase"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"

export type StorageProvider = "supabase" | "r2"
export type StorageUploadKind =
  | "module_pdf"
  | "module_asset"
  | "lesson_file"
  | "product_cover"
  | "branding_asset"
  | "watermark_logo"
  | "profile_avatar"
  | "support_attachment"
  | "site_page_asset"

export interface PreparedStorageUploadTicket {
  provider: StorageProvider
  upload_method: "supabase_signed_upload" | "r2_signed_put" | "r2_multipart"
  upload_path: string
  upload_token: string | null
  upload_url: string
  upload_headers: Record<string, string>
  storage_bucket: string
  storage_provider: StorageProvider
  public_url: string | null
  max_file_size_bytes?: number | null
  multipart_upload_id?: string | null
}

interface PrepareStorageUploadPayload {
  upload_kind: StorageUploadKind
  entity_id?: string | null
  file_name: string
  mime_type: string
  file_size_bytes: number
  replace_path?: string | null
  asset_role?: string | null
  storage_provider?: StorageProvider | null
}

export interface UploadProgressInfo {
  loaded: number
  total: number | null
  percent: number | null
}

interface UploadFileWithPreparedTicketInput {
  file: File
  ticket: PreparedStorageUploadTicket
  onProgress?: (progress: UploadProgressInfo) => void
}

class RetryableUploadError extends Error {
  retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = "RetryableUploadError"
    this.retryable = retryable
  }
}

async function requireFreshAuth() {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessao expirada")
  }

  return auth
}

async function callAdminStorageUpload(body: Record<string, unknown>) {
  const auth = await requireFreshAuth()
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, access_token: auth.accessToken }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : `Edge Function returned ${response.status}`
    throw new Error(message)
  }

  return data as { success: true; upload: PreparedStorageUploadTicket }
}

export async function prepareStorageUpload(payload: PrepareStorageUploadPayload) {
  const data = await callAdminStorageUpload({
      operation: "prepare_upload",
      ...payload,
      storage_provider: payload.storage_provider ?? "r2",
  })

  return data.upload
}

export async function prepareMultipartStorageUpload(payload: PrepareStorageUploadPayload) {
  const data = await callAdminStorageUpload({
    operation: "prepare_multipart_upload",
    ...payload,
    storage_provider: "r2",
  })

  return data.upload
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isRetryableR2UploadError(error: unknown) {
  if (error instanceof RetryableUploadError) {
    return error.retryable
  }

  if (!(error instanceof Error)) {
    return false
  }

  const normalized = error.message.toLowerCase()
  return (
    normalized.includes("failed to fetch")
    || normalized.includes("networkerror")
    || normalized.includes("network error")
    || normalized.includes("timeout")
    || normalized.includes("temporarily unavailable")
  )
}

function normalizeR2UploadError(error: unknown) {
  if (!(error instanceof Error)) {
    return new Error("Falha no upload para R2.")
  }

  const normalized = error.message.toLowerCase()
  if (
    normalized.includes("failed to fetch")
    || normalized.includes("networkerror")
    || normalized.includes("network error")
    || normalized.includes("timeout")
  ) {
    return new Error("Falha de rede ao enviar o ficheiro para o storage. Tenta novamente.")
  }

  return error
}

function uploadToR2WithXhr(input: UploadFileWithPreparedTicketInput) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", input.ticket.upload_url, true)
    xhr.responseType = "text"

    for (const [header, value] of Object.entries(input.ticket.upload_headers)) {
      xhr.setRequestHeader(header, value)
    }

    xhr.upload.onprogress = (event) => {
      if (!input.onProgress) return
      const total = event.lengthComputable ? event.total : null
      const percent = event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : null
      input.onProgress({
        loaded: event.loaded,
        total,
        percent,
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }

      const responseText = String(xhr.responseText ?? "").trim()
      const message = responseText || `Falha no upload para R2 (${xhr.status}).`
      const retryable = xhr.status === 408 || xhr.status === 429 || xhr.status >= 500
      reject(new RetryableUploadError(message, retryable))
    }

    xhr.onerror = () => {
      reject(new RetryableUploadError("Failed to fetch", true))
    }

    xhr.onabort = () => {
      reject(new RetryableUploadError("Upload cancelado.", false))
    }

    xhr.ontimeout = () => {
      reject(new RetryableUploadError("Timeout no upload para R2.", true))
    }

    xhr.send(input.file)
  })
}

function uploadR2PartWithXhr(input: {
  blob: Blob
  uploadUrl: string
  uploadHeaders: Record<string, string>
  onProgress?: (loaded: number) => void
}) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", input.uploadUrl, true)
    xhr.responseType = "text"

    for (const [header, value] of Object.entries(input.uploadHeaders)) {
      xhr.setRequestHeader(header, value)
    }

    xhr.upload.onprogress = (event) => {
      input.onProgress?.(event.lengthComputable ? event.loaded : 0)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag")?.trim()
        if (!etag) {
          reject(new RetryableUploadError("R2 nao devolveu o ETag da parte enviada.", false))
          return
        }
        resolve(etag)
        return
      }

      const responseText = String(xhr.responseText ?? "").trim()
      const message = responseText || `Falha no upload da parte para R2 (${xhr.status}).`
      const retryable = xhr.status === 408 || xhr.status === 429 || xhr.status >= 500
      reject(new RetryableUploadError(message, retryable))
    }

    xhr.onerror = () => reject(new RetryableUploadError("Failed to fetch", true))
    xhr.onabort = () => reject(new RetryableUploadError("Upload cancelado.", false))
    xhr.ontimeout = () => reject(new RetryableUploadError("Timeout no upload da parte para R2.", true))
    xhr.send(input.blob)
  })
}

async function signMultipartUploadPart(input: {
  storageBucket: string
  storagePath: string
  uploadId: string
  partNumber: number
  mimeType: string
}) {
  const data = await callAdminStorageUpload({
    operation: "sign_multipart_part",
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    upload_id: input.uploadId,
    part_number: input.partNumber,
    mime_type: input.mimeType,
  })

  return data.upload as PreparedStorageUploadTicket & {
    upload_url: string
    upload_headers: Record<string, string>
  }
}

async function completeMultipartStorageUpload(input: {
  storageBucket: string
  storagePath: string
  uploadId: string
  parts: Array<{ partNumber: number; etag: string }>
}) {
  await callAdminStorageUpload({
    operation: "complete_multipart_upload",
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    upload_id: input.uploadId,
    parts: input.parts.map((part) => ({ part_number: part.partNumber, etag: part.etag })),
  })
}

async function abortMultipartStorageUpload(input: {
  storageBucket: string
  storagePath: string
  uploadId: string
}) {
  await callAdminStorageUpload({
    operation: "abort_multipart_upload",
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
    upload_id: input.uploadId,
  })
}

async function uploadToR2Multipart(input: UploadFileWithPreparedTicketInput) {
  const uploadId = input.ticket.multipart_upload_id?.trim()
  if (!uploadId) {
    throw new Error("Ticket de multipart upload incompleto.")
  }

  const partSizeBytes = 64 * 1024 * 1024
  const totalParts = Math.ceil(input.file.size / partSizeBytes)
  const progressByPart = new Map<number, number>()
  const completedParts = new Map<number, string>()
  let nextPartIndex = 0

  const reportProgress = () => {
    const loaded = Array.from(progressByPart.values()).reduce((total, value) => total + value, 0)
    const percent = input.file.size > 0 ? Math.round((loaded / input.file.size) * 100) : null
    input.onProgress?.({ loaded, total: input.file.size, percent })
  }

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * partSizeBytes
    const end = Math.min(start + partSizeBytes, input.file.size)
    const blob = input.file.slice(start, end)
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      progressByPart.set(partNumber, 0)
      reportProgress()
      try {
        const ticket = await signMultipartUploadPart({
          storageBucket: input.ticket.storage_bucket,
          storagePath: input.ticket.upload_path,
          uploadId,
          partNumber,
          mimeType: input.file.type || "application/octet-stream",
        })
        const etag = await uploadR2PartWithXhr({
          blob,
          uploadUrl: ticket.upload_url,
          uploadHeaders: ticket.upload_headers,
          onProgress: (loaded) => {
            progressByPart.set(partNumber, loaded)
            reportProgress()
          },
        })
        progressByPart.set(partNumber, blob.size)
        completedParts.set(partNumber, etag)
        reportProgress()
        return
      } catch (error) {
        lastError = error
        if (attempt < 3 && isRetryableR2UploadError(error)) {
          await wait(500 * attempt)
          continue
        }
        throw normalizeR2UploadError(error)
      }
    }

    throw normalizeR2UploadError(lastError)
  }

  try {
    const workerCount = Math.min(3, totalParts)
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextPartIndex < totalParts) {
          const partNumber = nextPartIndex + 1
          nextPartIndex += 1
          await uploadPart(partNumber)
        }
      }),
    )

    await completeMultipartStorageUpload({
      storageBucket: input.ticket.storage_bucket,
      storagePath: input.ticket.upload_path,
      uploadId,
      parts: Array.from(completedParts.entries())
        .sort(([left], [right]) => left - right)
        .map(([partNumber, etag]) => ({ partNumber, etag })),
    })
  } catch (error) {
    await abortMultipartStorageUpload({
      storageBucket: input.ticket.storage_bucket,
      storagePath: input.ticket.upload_path,
      uploadId,
    }).catch(() => undefined)
    throw error
  }
}

export async function uploadFileWithPreparedTicket(input: UploadFileWithPreparedTicketInput) {
  if (input.ticket.upload_method === "supabase_signed_upload") {
    if (!input.ticket.upload_token) {
      throw new Error("Ticket de upload incompleto para Supabase.")
    }

    const { error } = await supabase.storage
      .from(input.ticket.storage_bucket)
      .uploadToSignedUrl(input.ticket.upload_path, input.ticket.upload_token, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      })

    if (error) {
      throw error
    }

    return
  }

  if (input.ticket.upload_method === "r2_multipart") {
    await uploadToR2Multipart(input)
    return
  }

  const maxAttempts = 3
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await uploadToR2WithXhr(input)
      return
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts && isRetryableR2UploadError(error)) {
        await wait(250 * attempt)
        continue
      }

      throw normalizeR2UploadError(error)
    }
  }

  throw normalizeR2UploadError(lastError)
}

export async function uploadStorageFile(input: PrepareStorageUploadPayload & { file: File }) {
  const ticket = await prepareStorageUpload({
    upload_kind: input.upload_kind,
    entity_id: input.entity_id,
    file_name: input.file_name,
    mime_type: input.mime_type,
    file_size_bytes: input.file_size_bytes,
    replace_path: input.replace_path,
    asset_role: input.asset_role,
  })

  await uploadFileWithPreparedTicket({
    file: input.file,
    ticket,
  })

  return {
    bucket: ticket.storage_bucket,
    path: ticket.upload_path,
    storage_provider: ticket.storage_provider,
    public_url: ticket.public_url,
    file_name: input.file.name,
    mime_type: input.file.type || input.mime_type || null,
    file_size_bytes: input.file.size,
    uploaded_at: new Date().toISOString(),
    ticket,
  }
}
