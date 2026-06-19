import type { AdminSitePageDetail } from "@/types/app.types"

export type ManagedPublicPageAuditStatus =
  | "managed_ready"
  | "managed_incomplete"
  | "bootstrap_only"
  | "hardcoded_fallback"
  | "unmanaged"
  | "sensitive_or_blocked"

export interface ManagedPublicPageAuditResult {
  path: string
  managedSlug: string | null
  inAllowedPaths: boolean
  inRouteOptions: boolean
  routeIsPublic: boolean
  routeIsSensitive: boolean
  supportsPersistibleFlow: boolean
  usesPublicManagedPage: boolean
  hasHardcodedFallback: boolean
  sitePageExists: boolean
  sitePageId: string | null
  publishedVersionId: string | null
  versionsCount: number
  publishedVersionNumber: number | null
  latestVersionNumber: number | null
  layoutJsonExists: boolean
  layoutBlockCount: number
  htmlExists: boolean
  htmlSize: number
  styleJsonExists: boolean
  domHasManagedRoot: boolean
  domHasBlockIds: boolean
  domHasManagedNodeIds: boolean
  isBootstrapBaseline: boolean
  status: ManagedPublicPageAuditStatus
  reason: string | null
}

export const PUBLIC_MANAGED_PAGE_ROUTE_SLUGS = new Set([
  "home",
  "sobre",
  "explicacoes",
  "materiais",
  "suporte",
  "privacidade",
  "cookies",
  "termos",
])

function normalizeJsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function countManagedBlocks(layoutJson: Record<string, unknown> | null) {
  if (!layoutJson) return 0
  const projectData = normalizeJsonRecord(layoutJson.projectData)
  if (Array.isArray(projectData?.blocks)) return projectData.blocks.length
  if (Array.isArray(layoutJson.blocks)) return layoutJson.blocks.length
  return 0
}

function extractPersistedHtml(layoutJson: Record<string, unknown> | null) {
  if (!layoutJson) return ""
  if (typeof layoutJson.html === "string" && layoutJson.html.trim()) return layoutJson.html.trim()
  const projectData = normalizeJsonRecord(layoutJson.projectData)
  if (typeof projectData?.html === "string" && projectData.html.trim()) {
    return projectData.html.trim()
  }
  return ""
}

function hasManagedRoot(html: string) {
  return /class=(['"])[^'"]*\bme-managed-page-root\b/i.test(html)
}

function hasBlockIds(html: string) {
  return /data-block-id=/i.test(html)
}

function hasManagedNodeIds(html: string) {
  return /data-managed-node-id=/i.test(html)
}

function extractVersionSource(detail: AdminSitePageDetail | null) {
  const currentVersion = detail?.published_version ?? detail?.latest_draft ?? detail?.versions?.[0] ?? null
  const metadata = normalizeJsonRecord(currentVersion?.metadata)
  return String(metadata?.source ?? "").trim().toLowerCase()
}

export function auditManagedPublicPageRoute(input: {
  path: string
  managedSlug: string | null
  inAllowedPaths: boolean
  inRouteOptions: boolean
  routeIsPublic: boolean
  routeIsSensitive: boolean
  usesPublicManagedPage: boolean
  detail: AdminSitePageDetail | null
}) {
  const detail = input.detail
  const publishedVersion = detail?.published_version ?? null
  const latestVersion = detail?.versions?.[0] ?? null
  const layoutJson = normalizeJsonRecord(publishedVersion?.layout_json ?? latestVersion?.layout_json)
  const styleJson = normalizeJsonRecord(publishedVersion?.style_json ?? latestVersion?.style_json)
  const html = extractPersistedHtml(layoutJson)
  const layoutBlockCount = countManagedBlocks(layoutJson)
  const source = extractVersionSource(detail)
  const domHasManagedRoot = hasManagedRoot(html)
  const domHasBlockIds = hasBlockIds(html)
  const domHasManagedNodeIds = hasManagedNodeIds(html)
  const publishedVersionId = detail?.page.published_version_id ?? null
  const sitePageExists = Boolean(detail?.page?.id)
  const publishedVersionReady =
    Boolean(publishedVersionId) &&
    publishedVersion?.status === "published" &&
    layoutBlockCount > 0 &&
    html.length > 0 &&
    domHasManagedRoot &&
    domHasBlockIds &&
    domHasManagedNodeIds

  let status: ManagedPublicPageAuditStatus
  let reason: string | null = null

  if (!input.routeIsPublic || input.routeIsSensitive || !input.inAllowedPaths) {
    status = "sensitive_or_blocked"
    reason = !input.inAllowedPaths
      ? "A rota pública ainda não está habilitada em allowed_paths."
      : "A rota é sensível, privada ou bloqueada para o fluxo persistível."
  } else if (!sitePageExists) {
    status = input.usesPublicManagedPage ? "hardcoded_fallback" : "unmanaged"
    reason = "Ainda não existe site_pages/published baseline para esta rota."
  } else if (source === "allowed_path_bootstrap" && !publishedVersionReady) {
    status = "bootstrap_only"
    reason = "A rota ainda depende de baseline allowed_path_bootstrap e não de uma baseline publicada real."
  } else if (!input.usesPublicManagedPage) {
    status = "hardcoded_fallback"
    reason = "A rota ainda não usa PublicManagedPage como renderização principal."
  } else if (!publishedVersionReady) {
    status = publishedVersionId ? "managed_incomplete" : "hardcoded_fallback"
    reason = publishedVersionId
      ? "Existe site_page, mas a versão publicada ainda não está completa ou não emite marcadores geridos."
      : "A rota ainda cai em fallback porque published_version_id não está preenchido."
  } else {
    status = "managed_ready"
  }

  return {
    path: input.path,
    managedSlug: input.managedSlug,
    inAllowedPaths: input.inAllowedPaths,
    inRouteOptions: input.inRouteOptions,
    routeIsPublic: input.routeIsPublic,
    routeIsSensitive: input.routeIsSensitive,
    supportsPersistibleFlow: status === "managed_ready",
    usesPublicManagedPage: input.usesPublicManagedPage,
    hasHardcodedFallback: status === "hardcoded_fallback",
    sitePageExists,
    sitePageId: detail?.page.id ?? null,
    publishedVersionId,
    versionsCount: detail?.versions.length ?? 0,
    publishedVersionNumber: publishedVersion?.version_number ?? null,
    latestVersionNumber: latestVersion?.version_number ?? null,
    layoutJsonExists: Boolean(layoutJson),
    layoutBlockCount,
    htmlExists: html.length > 0,
    htmlSize: html.length,
    styleJsonExists: Boolean(styleJson),
    domHasManagedRoot,
    domHasBlockIds,
    domHasManagedNodeIds,
    isBootstrapBaseline: source === "allowed_path_bootstrap",
    status,
    reason,
  } satisfies ManagedPublicPageAuditResult
}
