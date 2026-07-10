import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

type Action = "list_pages" | "get_page" | "save_draft" | "publish" | "rollback" | "unpublish"

interface Body {
  action: Action
  slug?: string
  title?: string
  versionId?: string
  layoutJson?: Record<string, unknown>
  styleJson?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

const pageSelect = "id,slug,title,status,published_version_id,created_by,created_at,updated_at"
const versionSelect = "id,page_id,version_number,status,layout_json,style_json,metadata,created_by,created_at"
const KNOWN_MANAGED_PAGE_TITLES: Record<string, string> = {
  home: "Home",
  sobre: "Sobre",
  explicacoes: "Explicacoes",
  materiais: "Materiais",
  suporte: "Suporte",
  privacidade: "Privacidade",
  cookies: "Cookies",
  termos: "Termos de uso",
  checkout: "Checkout",
  "checkout-success": "Checkout concluido",
}

function sanitizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function requireSlug(value: unknown) {
  const normalized = sanitizeSlug(String(value ?? "").trim())
  if (!normalized) throw badRequest("slug e obrigatorio")
  if (normalized.length < 2 || normalized.length > 120) throw badRequest("slug invalido")
  return normalized
}

function normalizeTitle(value: unknown) {
  const title = String(value ?? "").trim()
  if (!title) return null
  if (title.length > 180) throw badRequest("title excede o limite de 180 caracteres")
  return title
}

function normalizeObject(value: unknown, label: string) {
  if (value === undefined || value === null) return {}
  if (typeof value !== "object" || Array.isArray(value)) throw badRequest(`${label} invalido`)
  return value as Record<string, unknown>
}

function extractAiAuditMetadata(metadata: Record<string, unknown>) {
  const aiInvariants =
    metadata.ai_invariants && typeof metadata.ai_invariants === "object" && !Array.isArray(metadata.ai_invariants)
      ? (metadata.ai_invariants as Record<string, unknown>)
      : null
  const aiEditPlan =
    metadata.ai_edit_plan && typeof metadata.ai_edit_plan === "object" && !Array.isArray(metadata.ai_edit_plan)
      ? (metadata.ai_edit_plan as Record<string, unknown>)
      : null
  const targetIds = Array.isArray(aiEditPlan?.target_ids)
    ? aiEditPlan.target_ids.map((item) => String(item ?? "").trim()).filter(Boolean)
    : []

  return {
    editor: typeof metadata.editor === "string" ? metadata.editor : null,
    source: typeof metadata.source === "string" ? metadata.source : null,
    ai_revision_kind: typeof metadata.ai_revision_kind === "string" ? metadata.ai_revision_kind : null,
    ai_contract_version: typeof metadata.ai_contract_version === "string" ? metadata.ai_contract_version : null,
    ai_mode: typeof aiEditPlan?.mode === "string" ? aiEditPlan.mode : null,
    ai_scope: typeof aiEditPlan?.scope === "string" ? aiEditPlan.scope : null,
    ai_risk_level: typeof aiEditPlan?.risk_level === "string" ? aiEditPlan.risk_level : null,
    ai_target_ids: targetIds,
    ai_requires_strict_confirmation:
      typeof aiEditPlan?.requires_strict_confirmation === "boolean"
        ? aiEditPlan.requires_strict_confirmation
        : null,
    base_version_id:
      metadata.base_version && typeof metadata.base_version === "object" && !Array.isArray(metadata.base_version)
        ? String((metadata.base_version as Record<string, unknown>).id ?? "")
        : null,
    base_version_number:
      metadata.base_version && typeof metadata.base_version === "object" && !Array.isArray(metadata.base_version)
        ? Number((metadata.base_version as Record<string, unknown>).version_number ?? 0) || null
        : null,
    base_version_status:
      metadata.base_version && typeof metadata.base_version === "object" && !Array.isArray(metadata.base_version)
        ? String((metadata.base_version as Record<string, unknown>).status ?? "")
        : null,
    context_source: typeof aiInvariants?.context_source === "string" ? aiInvariants.context_source : null,
    degraded_draft_bypassed:
      typeof aiInvariants?.degraded_draft_bypassed === "boolean" ? aiInvariants.degraded_draft_bypassed : null,
    context_selection_reason:
      typeof aiInvariants?.context_selection_reason === "string" ? aiInvariants.context_selection_reason : null,
  }
}

async function fetchPageBySlug(serviceClient: ReturnType<typeof createServiceClient>, slug: string) {
  const { data, error } = await serviceClient
    .from("site_pages")
    .select(pageSelect)
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw error
  if (!data) throw badRequest("Pagina nao encontrada")
  return data
}

async function ensureManagedPageBySlug(serviceClient: ReturnType<typeof createServiceClient>, slug: string) {
  const existingPage = await fetchPageBySlug(serviceClient, slug).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes("pagina nao encontrada")) {
      return null
    }
    throw error
  })

  if (existingPage) return existingPage

  const knownTitle = KNOWN_MANAGED_PAGE_TITLES[slug]
  if (!knownTitle) {
    throw badRequest("Pagina nao encontrada")
  }

  const { data, error } = await serviceClient
    .from("site_pages")
    .insert({
      slug,
      title: knownTitle,
      status: "draft",
    })
    .select(pageSelect)
    .single()

  if (error) throw error
  return data
}

async function ensureKnownManagedPages(serviceClient: ReturnType<typeof createServiceClient>) {
  const slugs = Object.keys(KNOWN_MANAGED_PAGE_TITLES)
  const { data: existingPages, error } = await serviceClient
    .from("site_pages")
    .select("slug")
    .in("slug", slugs)

  if (error) throw error

  const existingSlugs = new Set((existingPages ?? []).map((page) => String(page.slug ?? "").trim()).filter(Boolean))
  const missingSlugs = slugs.filter((slug) => !existingSlugs.has(slug))

  if (missingSlugs.length === 0) return

  const { error: insertError } = await serviceClient.from("site_pages").insert(
    missingSlugs.map((slug) => ({
      slug,
      title: KNOWN_MANAGED_PAGE_TITLES[slug] ?? slug,
      status: "draft",
    })),
  )

  if (insertError) throw insertError
}

async function fetchNextVersionNumber(serviceClient: ReturnType<typeof createServiceClient>, pageId: string) {
  const { data, error } = await serviceClient
    .from("site_page_versions")
    .select("version_number")
    .eq("page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Number(data?.version_number ?? 0) + 1
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") throw badRequest("Metodo nao suportado")

    const context = await requireAdmin(req)
    const serviceClient = createServiceClient()
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<Body>(req)

    if (!body.action) throw badRequest("action e obrigatorio")

    if (body.action === "list_pages") {
      await ensureKnownManagedPages(serviceClient)
      const { data, error } = await serviceClient
        .from("site_pages")
        .select(pageSelect)
        .order("slug", { ascending: true })
      if (error) throw error
      return jsonResponse({ success: true, request_id: requestId, pages: data ?? [] })
    }

    if (body.action === "get_page") {
      const slug = requireSlug(body.slug)
      const page = await ensureManagedPageBySlug(serviceClient, slug)

      const { data: versions, error: versionsError } = await serviceClient
        .from("site_page_versions")
        .select(versionSelect)
        .eq("page_id", page.id)
        .order("version_number", { ascending: false })
        .limit(60)
      if (versionsError) throw versionsError

      const publishedVersion =
        page.published_version_id
          ? (versions ?? []).find((item) => item.id === page.published_version_id) ?? null
          : null
      const latestDraft = (versions ?? []).find((item) => item.status === "draft") ?? null

      const { data: assets, error: assetsError } = await serviceClient
        .from("site_page_assets")
        .select("id,page_id,bucket,path,storage_provider,public_url,file_name,mime_type,file_size_bytes,uploaded_by,created_at")
        .eq("page_id", page.id)
        .order("created_at", { ascending: false })
        .limit(100)
      if (assetsError) throw assetsError

      return jsonResponse({
        success: true,
        request_id: requestId,
        page,
        versions: versions ?? [],
        published_version: publishedVersion,
        latest_draft: latestDraft,
        assets: assets ?? [],
      })
    }

    if (body.action === "save_draft") {
      const slug = requireSlug(body.slug)
      const title = normalizeTitle(body.title)
      const layoutJson = normalizeObject(body.layoutJson, "layoutJson")
      const styleJson = normalizeObject(body.styleJson, "styleJson")
      const metadata = normalizeObject(body.metadata, "metadata")

      const page = await ensureManagedPageBySlug(serviceClient, slug)
      const versionNumber = await fetchNextVersionNumber(serviceClient, page.id)

      const { data: draftVersion, error: draftError } = await serviceClient
        .from("site_page_versions")
        .insert({
          page_id: page.id,
          version_number: versionNumber,
          status: "draft",
          layout_json: layoutJson,
          style_json: styleJson,
          metadata,
          created_by: context.user.id,
        })
        .select(versionSelect)
        .single()
      if (draftError) throw draftError

      const pagePatch: Record<string, unknown> = {
        status: page.status === "published" ? "published" : "draft",
      }
      if (title) pagePatch.title = title

      const { data: updatedPage, error: pageUpdateError } = await serviceClient
        .from("site_pages")
        .update(pagePatch)
        .eq("id", page.id)
        .select(pageSelect)
        .single()
      if (pageUpdateError) throw pageUpdateError

      await writeAuditLog(serviceClient, context, {
        action: "admin.page_builder_draft_saved",
        entityType: "site_page_version",
        entityId: draftVersion.id,
        metadata: {
          slug,
          page_id: page.id,
          version_number: versionNumber,
          ...extractAiAuditMetadata(metadata),
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        page: updatedPage,
        version: draftVersion,
      })
    }

    if (body.action === "publish" || body.action === "rollback") {
      const slug = requireSlug(body.slug)
      const versionId = String(body.versionId ?? "").trim()
      if (!versionId) throw badRequest("versionId e obrigatorio")

      const page = await ensureManagedPageBySlug(serviceClient, slug)
      const previousPublishedVersionId = page.published_version_id ? String(page.published_version_id) : null
      const { data: targetVersion, error: targetVersionError } = await serviceClient
        .from("site_page_versions")
        .select(versionSelect)
        .eq("id", versionId)
        .eq("page_id", page.id)
        .maybeSingle()
      if (targetVersionError) throw targetVersionError
      if (!targetVersion) throw badRequest("Versao nao encontrada para esta pagina")

      const { error: archivePreviousError } = await serviceClient
        .from("site_page_versions")
        .update({ status: "archived" })
        .eq("page_id", page.id)
        .eq("status", "published")
        .neq("id", targetVersion.id)
      if (archivePreviousError) throw archivePreviousError

      const { data: publishedVersion, error: publishVersionError } = await serviceClient
        .from("site_page_versions")
        .update({ status: "published" })
        .eq("id", targetVersion.id)
        .select(versionSelect)
        .single()
      if (publishVersionError) throw publishVersionError

      const { data: updatedPage, error: pageUpdateError } = await serviceClient
        .from("site_pages")
        .update({
          status: "published",
          published_version_id: targetVersion.id,
        })
        .eq("id", page.id)
        .select(pageSelect)
        .single()
      if (pageUpdateError) throw pageUpdateError

      await writeAuditLog(serviceClient, context, {
        action: body.action === "publish" ? "admin.page_builder_published" : "admin.page_builder_rollback",
        entityType: "site_page",
        entityId: page.id,
        metadata: {
          slug,
          page_id: page.id,
          version_id: targetVersion.id,
          version_number: targetVersion.version_number,
          previous_published_version_id: previousPublishedVersionId,
          ...extractAiAuditMetadata(
            targetVersion.metadata && typeof targetVersion.metadata === "object" && !Array.isArray(targetVersion.metadata)
              ? (targetVersion.metadata as Record<string, unknown>)
              : {},
          ),
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        page: updatedPage,
        version: publishedVersion,
      })
    }

    if (body.action === "unpublish") {
      const slug = requireSlug(body.slug)
      const page = await ensureManagedPageBySlug(serviceClient, slug)

      const { error: archivePreviousError } = await serviceClient
        .from("site_page_versions")
        .update({ status: "archived" })
        .eq("page_id", page.id)
        .eq("status", "published")
      if (archivePreviousError) throw archivePreviousError

      const { data: updatedPage, error: pageUpdateError } = await serviceClient
        .from("site_pages")
        .update({
          status: "draft",
          published_version_id: null,
        })
        .eq("id", page.id)
        .select(pageSelect)
        .single()
      if (pageUpdateError) throw pageUpdateError

      await writeAuditLog(serviceClient, context, {
        action: "admin.page_builder_unpublished",
        entityType: "site_page",
        entityId: page.id,
        metadata: {
          slug,
          page_id: page.id,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        page: updatedPage,
        version: null,
      })
    }

    throw badRequest("action invalida")
  } catch (error) {
    logError("Admin page builder failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
