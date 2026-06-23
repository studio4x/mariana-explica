import { publicSupabase, supabase } from "@/integrations/supabase"
import type {
  VisualEditorDocument,
  VisualEditorPageDetail,
  VisualEditorPageSummary,
  VisualEditorPageVersion,
  VisualEditorPublicPagePayload,
} from "./types"

function isSchemaMismatch(error: unknown) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()
  return fullText.includes("does not exist") || fullText.includes("schema cache") || fullText.includes("not found")
}

function isAuthLockContention(error: unknown) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()
  return fullText.includes("lock") && fullText.includes("stole it")
}

async function fetchVisualEditorPageRecord(
  client: typeof supabase,
  pageKey: string,
  publishedOnly: boolean,
): Promise<VisualEditorPageSummary | null> {
  const query = client
    .from("visual_site_pages")
    .select("id,page_key,title,status,published_version_id,created_by,created_at,updated_at")
    .eq("page_key", pageKey)

  if (publishedOnly) {
    query.eq("status", "published")
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    if (isSchemaMismatch(error) || isAuthLockContention(error)) return null
    throw error
  }

  const page = data as VisualEditorPageSummary | null
  return page
}

async function fetchVisualEditorVersionRecord(
  client: typeof supabase,
  versionId: string,
  pageId: string,
): Promise<VisualEditorPageVersion | null> {
  const { data, error } = await client
    .from("visual_site_page_versions")
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .eq("id", versionId)
    .eq("page_id", pageId)
    .maybeSingle()

  if (error) {
    if (isSchemaMismatch(error) || isAuthLockContention(error)) return null
    throw error
  }

  const version = data as VisualEditorPageVersion | null
  return version
}

export async function fetchPublicVisualEditorPage(pageKey: string): Promise<VisualEditorPublicPagePayload | null> {
  const normalizedKey = String(pageKey ?? "").trim()
  if (!normalizedKey) return null

  const page = await fetchVisualEditorPageRecord(publicSupabase, normalizedKey, true)
  if (!page?.published_version_id) return null

  const version = await fetchVisualEditorVersionRecord(publicSupabase, page.published_version_id, page.id)
  if (!version) return null

  return {
    page: {
      id: page.id,
      page_key: page.page_key,
      title: page.title,
      updated_at: page.updated_at,
      published_version_id: page.published_version_id,
    },
    version: {
      id: version.id,
      page_id: version.page_id,
      version_number: version.version_number,
      entries_json: version.entries_json ?? {},
      style_json: version.style_json ?? {},
      metadata: version.metadata ?? {},
      created_at: version.created_at,
    },
  }
}

export async function fetchAdminVisualEditorPageDetail(pageKey: string): Promise<VisualEditorPageDetail | null> {
  const normalizedKey = String(pageKey ?? "").trim()
  if (!normalizedKey) return null

  const page = await fetchVisualEditorPageRecord(supabase, normalizedKey, false)
  if (!page) return null

  const { data: versionsData, error: versionsError } = await supabase
    .from("visual_site_page_versions")
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .eq("page_id", page.id)
    .order("version_number", { ascending: false })

  if (versionsError) {
    if (isSchemaMismatch(versionsError) || isAuthLockContention(versionsError)) return null
    throw versionsError
  }

  const versions = (versionsData ?? []) as VisualEditorPageVersion[]
  const publishedVersion = versions.find((version) => version.id === page.published_version_id) ?? null
  const latestDraft = versions.find((version) => version.status === "draft") ?? null

  const { data: assetsData, error: assetsError } = await supabase
    .from("visual_site_page_assets")
    .select("id,page_id,bucket,path,public_url,file_name,mime_type,file_size_bytes,uploaded_by,created_at")
    .eq("page_id", page.id)
    .order("created_at", { ascending: false })

  if (assetsError) {
    if (isSchemaMismatch(assetsError) || isAuthLockContention(assetsError)) return null
    throw assetsError
  }

  return {
    page,
    versions,
    publishedVersion,
    latestDraft,
    assets: (assetsData ?? []) as VisualEditorPageDetail["assets"],
  }
}

export async function saveVisualEditorPageDraft(input: {
  pageKey: string
  document: VisualEditorDocument
  title?: string
}) {
  const page = await fetchVisualEditorPageRecord(supabase, input.pageKey, false)
  if (!page) {
    throw new Error("Pagina visual nao encontrada.")
  }

  const { data: versionsData, error: versionsError } = await supabase
    .from("visual_site_page_versions")
    .select("version_number")
    .eq("page_id", page.id)
    .order("version_number", { ascending: false })
    .limit(1)

  if (versionsError) {
    throw versionsError
  }

  const latestVersion = (versionsData ?? [])[0] as { version_number: number } | undefined
  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1

  const { data: versionData, error: versionError } = await supabase
    .from("visual_site_page_versions")
    .insert({
      page_id: page.id,
      version_number: nextVersionNumber,
      status: "draft",
      entries_json: input.document,
      style_json: {},
      metadata: {
        saved_via: "visual_editor",
      },
    })
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .single()

  if (versionError) {
    throw versionError
  }

  if (typeof input.title === "string" && input.title.trim()) {
    const { error: pageError } = await supabase
      .from("visual_site_pages")
      .update({
        title: input.title.trim(),
      })
      .eq("id", page.id)

    if (pageError) {
      throw pageError
    }
  }

  return {
    page: await fetchVisualEditorPageRecord(supabase, input.pageKey, false),
    version: versionData as VisualEditorPageVersion,
  }
}

export async function publishVisualEditorPageVersion(input: { pageKey: string; versionId: string }) {
  const page = await fetchVisualEditorPageRecord(supabase, input.pageKey, false)
  if (!page) {
    throw new Error("Pagina visual nao encontrada.")
  }

  const { data: versionData, error: versionError } = await supabase
    .from("visual_site_page_versions")
    .update({
      status: "published",
    })
    .eq("id", input.versionId)
    .eq("page_id", page.id)
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .single()

  if (versionError) {
    throw versionError
  }

  const { error: pageError } = await supabase
    .from("visual_site_pages")
    .update({
      status: "published",
      published_version_id: input.versionId,
    })
    .eq("id", page.id)

  if (pageError) {
    throw pageError
  }

  return {
    page: await fetchVisualEditorPageRecord(supabase, input.pageKey, false),
    version: versionData as VisualEditorPageVersion,
  }
}

export async function restoreVisualEditorPageVersion(input: { pageKey: string; versionId: string }) {
  const page = await fetchVisualEditorPageRecord(supabase, input.pageKey, false)
  if (!page) {
    throw new Error("Pagina visual nao encontrada.")
  }

  const sourceVersion = await fetchVisualEditorVersionRecord(supabase, input.versionId, page.id)
  if (!sourceVersion) {
    throw new Error("Versao visual nao encontrada.")
  }

  const { data: versionsData, error: versionsError } = await supabase
    .from("visual_site_page_versions")
    .select("version_number")
    .eq("page_id", page.id)
    .order("version_number", { ascending: false })
    .limit(1)

  if (versionsError) {
    throw versionsError
  }

  const latestVersion = (versionsData ?? [])[0] as { version_number: number } | undefined
  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1

  const { data: restoredVersionData, error: restoredVersionError } = await supabase
    .from("visual_site_page_versions")
    .insert({
      page_id: page.id,
      version_number: nextVersionNumber,
      status: "draft",
      entries_json: sourceVersion.entries_json ?? {},
      style_json: sourceVersion.style_json ?? {},
      metadata: {
        restored_from_version_id: sourceVersion.id,
      },
    })
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .single()

  if (restoredVersionError) {
    throw restoredVersionError
  }

  return {
    page,
    version: restoredVersionData as VisualEditorPageVersion,
  }
}

