import { supabase } from "@/integrations/supabase"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"

export type StorageProvider = "supabase" | "r2"
export type StorageUploadKind =
  | "module_pdf"
  | "module_asset"
  | "product_cover"
  | "branding_asset"
  | "watermark_logo"
  | "profile_avatar"
  | "support_attachment"
  | "site_page_asset"

export interface PreparedStorageUploadTicket {
  provider: StorageProvider
  upload_method: "supabase_signed_upload" | "r2_signed_put"
  upload_path: string
  upload_token: string | null
  upload_url: string
  upload_headers: Record<string, string>
  storage_bucket: string
  storage_provider: StorageProvider
  public_url: string | null
  max_file_size_bytes?: number | null
}

interface PrepareStorageUploadPayload {
  upload_kind: StorageUploadKind
  entity_id?: string | null
  file_name: string
  mime_type: string
  file_size_bytes: number
  replace_path?: string | null
  asset_role?: string | null
}

async function requireFreshAuth() {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessao expirada")
  }

  return auth
}

export async function prepareStorageUpload(payload: PrepareStorageUploadPayload) {
  const auth = await requireFreshAuth()
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation: "prepare_upload",
      ...payload,
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

  return (data as { success: true; upload: PreparedStorageUploadTicket }).upload
}

export async function uploadFileWithPreparedTicket(input: {
  file: File
  ticket: PreparedStorageUploadTicket
}) {
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

  const response = await fetch(input.ticket.upload_url, {
    method: "PUT",
    headers: input.ticket.upload_headers,
    body: input.file,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `Falha no upload para R2 (${response.status}).`)
  }
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
