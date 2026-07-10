import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { uploadStorageFile } from "@/features/storage/r2-upload"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"
import type { SupportAttachmentUploadResult } from "@/types/app.types"

async function requireFreshAuth() {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  return auth
}

async function invokeSupportFunction<TResponse>(name: string, body: unknown) {
  const auth = await requireFreshAuth()
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(typeof body === "object" && body !== null ? body : {}),
      access_token: auth.accessToken,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : `Edge Function returned ${response.status}`
    throw new Error(message)
  }

  return data as TResponse
}

export async function uploadSupportAttachment(input: {
  file: File
  ticketId?: string | null
}) {
  const upload = await uploadStorageFile({
    upload_kind: "support_attachment",
    entity_id: input.ticketId ?? "draft",
    file: input.file,
    file_name: input.file.name,
    mime_type: input.file.type || "application/octet-stream",
    file_size_bytes: input.file.size,
  })

  return {
    bucket: upload.bucket,
    path: upload.path,
    storage_provider: upload.storage_provider ?? "r2",
    file_name: upload.file_name,
    mime_type: upload.mime_type,
    file_size_bytes: upload.file_size_bytes,
  } satisfies SupportAttachmentUploadResult
}

export function fetchSupportAttachmentUrl(input: {
  ticketId: string
  bucket: string
  path: string
}) {
  return invokeSupportFunction<{ success: true; signed_url: string; expires_in: number }>(
    "support-attachment-access",
    input,
  )
}

export function deleteAdminSupportTicket(ticketId: string) {
  return invokeSupportFunction<{ success: true }>("admin-support-ticket-delete", { ticketId })
}
