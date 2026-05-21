import { supabase } from "@/integrations/supabase"
import type { PublicSitePagePayload, SitePageSlug } from "@/types/app.types"

function isSchemaMismatch(error: unknown) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()
  return fullText.includes("does not exist") || fullText.includes("schema cache") || fullText.includes("not found")
}

export async function fetchPublicSitePage(slug: SitePageSlug | string): Promise<PublicSitePagePayload | null> {
  const normalizedSlug = String(slug ?? "").trim()
  if (!normalizedSlug) return null

  const { data: page, error: pageError } = await supabase
    .from("site_pages")
    .select("id,slug,title,updated_at,published_version_id")
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .maybeSingle()

  if (pageError) {
    if (isSchemaMismatch(pageError)) return null
    throw pageError
  }

  const typedPage = page as
    | {
        id: string
        slug: string
        title: string
        updated_at: string
        published_version_id: string | null
      }
    | null

  if (!typedPage?.published_version_id) return null

  const { data: version, error: versionError } = await supabase
    .from("site_page_versions")
    .select("id,page_id,version_number,layout_json,style_json,metadata,created_at")
    .eq("id", typedPage.published_version_id)
    .eq("page_id", typedPage.id)
    .maybeSingle()

  if (versionError) {
    if (isSchemaMismatch(versionError)) return null
    throw versionError
  }

  const typedVersion = version as
    | {
        id: string
        page_id: string
        version_number: number
        layout_json: Record<string, unknown> | null
        style_json: Record<string, unknown> | null
        metadata: Record<string, unknown> | null
        created_at: string
      }
    | null

  if (!typedVersion) return null

  return {
    page: {
      id: String(typedPage.id),
      slug: String(typedPage.slug),
      title: String(typedPage.title),
      updated_at: String(typedPage.updated_at),
      published_version_id: String(typedPage.published_version_id),
    },
    version: {
      id: String(typedVersion.id),
      page_id: String(typedVersion.page_id),
      version_number: Number(typedVersion.version_number ?? 1),
      layout_json: (typedVersion.layout_json ?? {}) as Record<string, unknown>,
      style_json: (typedVersion.style_json ?? {}) as Record<string, unknown>,
      metadata: (typedVersion.metadata ?? {}) as Record<string, unknown>,
      created_at: String(typedVersion.created_at),
    },
  }
}
