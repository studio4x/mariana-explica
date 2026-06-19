import { badRequest, unprocessable } from "../_shared/errors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { selectAiBaseVersion, toPatchEngineBaseVersion } from "./safety.ts"

const sitePageSelect = "id,slug,title,status,published_version_id,created_by,created_at,updated_at"
const sitePageVersionSelect = "id,page_id,version_number,status,layout_json,style_json,metadata,created_by,created_at"
export const BASELINE_INCOMPLETE_MESSAGE =
  "Preparei esta pagina para edicao, mas ainda nao consegui criar uma base segura com todos os elementos necessarios. Atualiza a pagina e tenta novamente para eu preservar a estrutura completa antes de alterar."
export const MANAGED_BASELINE_REQUIRED_MESSAGE =
  "Esta rota esta configurada no editor, mas ainda nao possui baseline gerida publicada. Para editar com IA, esta pagina precisa ser migrada para a estrutura gerida."

function normalizeJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  }
  return {}
}

function hasManagedBlocks(layoutJson: Record<string, unknown>) {
  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : null

  if (Array.isArray(projectData?.blocks) && projectData.blocks.length > 0) return true
  if (Array.isArray(layoutJson.blocks) && layoutJson.blocks.length > 0) return true
  return false
}

function countManagedBlocks(layoutJson: Record<string, unknown>) {
  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : null
  if (Array.isArray(projectData?.blocks)) return projectData.blocks.length
  if (Array.isArray(layoutJson.blocks)) return layoutJson.blocks.length
  return 0
}

function extractBaselineHtml(input: {
  layoutJson: Record<string, unknown>
  currentHtml?: string
}) {
  const layoutJson = normalizeJsonObject(input.layoutJson)
  if (typeof layoutJson.html === "string" && layoutJson.html.trim()) {
    return layoutJson.html.trim()
  }

  if (
    layoutJson.projectData &&
    typeof layoutJson.projectData === "object" &&
    typeof (layoutJson.projectData as Record<string, unknown>).html === "string"
  ) {
    return String((layoutJson.projectData as Record<string, unknown>).html ?? "").trim()
  }

  return String(input.currentHtml ?? "").trim()
}

function hasManagedHtmlRoot(html: string) {
  return /class=(['"])[^'"]*\bme-managed-page-root\b/i.test(html)
}

function hasManagedHtmlDataMarkers(html: string) {
  return /data-(?:managed-node-id|block-id|ai-editor-id)=/i.test(html)
}

export function assessBootstrapBaseline(input: {
  layoutJson: Record<string, unknown>
  styleJson?: Record<string, unknown>
  currentHtml?: string
}) {
  const layoutJson = normalizeJsonObject(input.layoutJson)
  const styleJson = normalizeJsonObject(input.styleJson)
  const html = extractBaselineHtml({
    layoutJson,
    currentHtml: input.currentHtml,
  })
  const blockCount = countManagedBlocks(layoutJson)
  const cssLength = typeof styleJson.css === "string" ? styleJson.css.trim().length : 0
  const managedHtmlRoot = hasManagedHtmlRoot(html)
  const managedHtmlDataMarkers = hasManagedHtmlDataMarkers(html)
  const persistibleSafe = blockCount > 0 && html.length > 0 && managedHtmlRoot && managedHtmlDataMarkers
  const complete = blockCount > 0 && html.length > 0

  return {
    complete,
    persistible_safe: persistibleSafe,
    block_count: blockCount,
    html_length: html.length,
    css_length: cssLength,
    has_managed_html_root: managedHtmlRoot,
    has_managed_html_data_markers: managedHtmlDataMarkers,
    reason: !complete ? "missing_blocks_or_html_context" : persistibleSafe ? null : "missing_managed_html_markers",
  }
}

export function hasBootstrapContext(layoutJson: Record<string, unknown>, currentHtml: string) {
  const html =
    typeof layoutJson.html === "string"
      ? layoutJson.html.trim()
      : layoutJson.projectData && typeof layoutJson.projectData === "object" && typeof (layoutJson.projectData as Record<string, unknown>).html === "string"
        ? String((layoutJson.projectData as Record<string, unknown>).html ?? "").trim()
        : ""

  return hasManagedBlocks(layoutJson) || html.length > 0 || currentHtml.trim().length > 0
}

export function normalizeBootstrapLayout(layoutJson: Record<string, unknown>, currentHtml: string) {
  const nextLayoutJson = normalizeJsonObject(layoutJson)
  const safeHtml = currentHtml.trim()

  if (safeHtml) {
    if (typeof nextLayoutJson.html !== "string" || !String(nextLayoutJson.html).trim()) {
      nextLayoutJson.html = safeHtml
    }

    const projectData =
      nextLayoutJson.projectData && typeof nextLayoutJson.projectData === "object"
        ? ({ ...(nextLayoutJson.projectData as Record<string, unknown>) } satisfies Record<string, unknown>)
        : {}

    if (typeof projectData.html !== "string" || !String(projectData.html).trim()) {
      projectData.html = safeHtml
    }
    nextLayoutJson.projectData = projectData
  }

  return nextLayoutJson
}

export function normalizeBootstrapStyle(styleJson: Record<string, unknown>) {
  return normalizeJsonObject(styleJson)
}

async function fetchPageBySlug(serviceClient: ReturnType<typeof createServiceClient>, slug: string) {
  const { data, error } = await serviceClient
    .from("site_pages")
    .select(sitePageSelect)
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw error
  return data
}

async function fetchVersions(serviceClient: ReturnType<typeof createServiceClient>, pageId: string) {
  const { data, error } = await serviceClient
    .from("site_page_versions")
    .select(sitePageVersionSelect)
    .eq("page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(60)

  if (error) throw error
  return data ?? []
}

export async function ensureManagedPageContext(input: {
  serviceClient: ReturnType<typeof createServiceClient>
  slug: string
  pathname: string
  title: string
  currentLayoutJson: Record<string, unknown>
  currentStyleJson: Record<string, unknown>
  currentHtml: string
  userId: string
}) {
  const slug = String(input.slug ?? "").trim().toLowerCase()
  if (!slug) throw badRequest("slug e obrigatorio")

  const page = await fetchPageBySlug(input.serviceClient, slug)
  let baselineCreated = false
  let baselineVersionId: string | null = null

  if (!page) {
    throw unprocessable(MANAGED_BASELINE_REQUIRED_MESSAGE)
  }

  let versions = await fetchVersions(input.serviceClient, String(page.id))

  if (versions.length === 0) {
    throw unprocessable(MANAGED_BASELINE_REQUIRED_MESSAGE)
  }

  const publishedVersion =
    page.published_version_id
      ? versions.find((item) => String(item.id) === String(page.published_version_id)) ?? null
      : null

  if (!page.published_version_id || !publishedVersion || publishedVersion.status !== "published") {
    throw unprocessable(MANAGED_BASELINE_REQUIRED_MESSAGE)
  }

  const latestDraft = versions.find((item) => String(item.status ?? "") === "draft") ?? null
  const selectedBaseVersion = selectAiBaseVersion({
    latestDraft,
    publishedVersion,
  })

  if (!selectedBaseVersion.baseVersion) {
    throw unprocessable("Nao encontrei uma base_version segura para esta pagina.")
  }

  const selectedBaselineAssessment = assessBootstrapBaseline({
    layoutJson: normalizeJsonObject(selectedBaseVersion.baseVersion.layout_json),
    styleJson: normalizeJsonObject(selectedBaseVersion.baseVersion.style_json),
  })
  const selectedBaseVersionMetadata =
    selectedBaseVersion.baseVersion.metadata && typeof selectedBaseVersion.baseVersion.metadata === "object"
      ? (selectedBaseVersion.baseVersion.metadata as Record<string, unknown>)
      : {}
  const selectedBaseVersionSource = String(selectedBaseVersionMetadata.source ?? "").trim().toLowerCase()
  const selectedBaseRequiresManagedMarkers =
    selectedBaseVersionSource === "allowed_path_bootstrap" || selectedBaseVersionSource === "request_live_dom_snapshot"

  if (!selectedBaselineAssessment.complete || (selectedBaseRequiresManagedMarkers && !selectedBaselineAssessment.persistible_safe)) {
    throw unprocessable(BASELINE_INCOMPLETE_MESSAGE)
  }

  const baseVersion = toPatchEngineBaseVersion(selectedBaseVersion.baseVersion)
  baseVersion.metadata = {
    ...(baseVersion.metadata ?? {}),
    slug,
    pathname: input.pathname,
    page_status: String(page.status ?? "draft"),
    published_version_id: page.published_version_id ? String(page.published_version_id) : null,
    baseline_complete: selectedBaselineAssessment.complete,
    baseline_persistible_safe: selectedBaselineAssessment.persistible_safe,
    baseline_block_count: selectedBaselineAssessment.block_count,
    baseline_html_length: selectedBaselineAssessment.html_length,
    baseline_css_length: selectedBaselineAssessment.css_length,
    baseline_has_managed_html_root: selectedBaselineAssessment.has_managed_html_root,
    baseline_has_managed_html_data_markers: selectedBaselineAssessment.has_managed_html_data_markers,
    baseline_integrity_reason: selectedBaselineAssessment.reason,
  }

  return {
    page,
    versions,
    publishedVersion,
    latestDraft,
    baseVersion,
    baseVersionSource: selectedBaseVersion.source,
    degradedDraftBypassed: selectedBaseVersion.degradedDraftBypassed,
    baseVersionSelectionReason: selectedBaseVersion.reason,
    pageCreated: false,
    baselineCreated,
    baselineVersionId,
    baselineComplete: selectedBaselineAssessment.complete,
    baselineAssessment: selectedBaselineAssessment,
  }
}
