import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const CONFIG_KEY = "ai_page_editor_config"
const MANAGED_BASELINE_SOURCE = "managed_public_page_seed"
const auditOnly = process.argv.includes("--audit-only")

const KNOWN_PUBLIC_EDITOR_ROUTES = [
  { path: "/", slug: "home", title: "Home", usesPublicManagedPage: true },
  { path: "/sobre", slug: "sobre", title: "Sobre", usesPublicManagedPage: true },
  { path: "/explicacoes", slug: "explicacoes", title: "Explicações", usesPublicManagedPage: true },
  { path: "/materiais", slug: "materiais", title: "Materiais", usesPublicManagedPage: true },
  { path: "/suporte", slug: "suporte", title: "Suporte", usesPublicManagedPage: true },
  { path: "/privacidade", slug: "privacidade", title: "Privacidade", usesPublicManagedPage: true },
  { path: "/cookies", slug: "cookies", title: "Cookies", usesPublicManagedPage: true },
  { path: "/termos-de-uso", slug: "termos", title: "Termos de uso", usesPublicManagedPage: true },
]

const REPAIRABLE_SLUGS = new Set(["explicacoes", "materiais", "suporte"])

const BASE_LAYOUT = {
  gridColumns: 12,
  align: "center",
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  backgroundColor: "transparent",
  backgroundImageUrl: "",
  backgroundImageSize: "cover",
  borderRadius: 0,
  contentAlignX: "stretch",
  contentAlignY: "top",
  contentGap: 0,
  minHeight: 0,
}

function parseEnvFile(path) {
  const content = fs.readFileSync(path, "utf8")
  const env = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizePath(pathname) {
  const trimmed = String(pathname ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/, 1)[0]
  if (!trimmed) return "/"
  if (trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

function normalizeSlugToken(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function resolveManagedSlug(pathname) {
  const normalizedPath = normalizePath(pathname)
  if (normalizedPath === "/") return "home"
  if (normalizedPath === "/termos-de-uso") return "termos"
  return (
    normalizedPath
      .split("/")
      .filter(Boolean)
      .map((segment) => normalizeSlugToken(segment))
      .filter(Boolean)
      .join("--") || "home"
  )
}

function isSensitivePath(pathname) {
  const normalizedPath = normalizePath(pathname)
  return ["/admin", "/aluno", "/checkout", "/login", "/criar-conta", "/cadastro"].some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  )
}

function isPublicPath(pathname) {
  const normalizedPath = normalizePath(pathname)
  return normalizedPath.startsWith("/") && !isSensitivePath(normalizedPath)
}

function isPathAllowed(pathname, allowedPaths) {
  const normalizedPath = normalizePath(pathname)
  return allowedPaths.some((pattern) => normalizePath(pattern) === normalizedPath)
}

function createRichTextBlock(id, content) {
  return {
    id,
    type: "rich_text",
    content,
    layout: { ...BASE_LAYOUT },
  }
}

function buildWrapperStyle(layout) {
  return [
    "width:100%",
    `margin-top:${layout.marginTop}px`,
    `margin-bottom:${layout.marginBottom}px`,
    "margin-left:auto",
    "margin-right:auto",
    `padding:${layout.paddingTop}px ${layout.paddingRight}px ${layout.paddingBottom}px ${layout.paddingLeft}px`,
    `background-color:${layout.backgroundColor}`,
    `border-radius:${layout.borderRadius}px`,
    "display:flex",
    "flex-direction:column",
    "align-items:stretch",
    "justify-content:flex-start",
    `gap:${layout.contentGap}px`,
    `min-height:${layout.minHeight}px`,
  ].join(";")
}

function renderManagedHtml(blocks) {
  const blocksHtml = blocks
    .map((block, index) => {
      const contentHtml =
        `<div class="me-managed-richtext"` +
        ` data-parent-block-id="${block.id}"` +
        ` data-managed-node-id="content:${block.id}"` +
        ` data-ai-editor-id="managed:${block.id}:content"` +
        ` data-block-type="${block.type}">` +
        `${block.content}</div>`
      return (
        `<section class="me-managed-block"` +
        ` data-block-id="${block.id}"` +
        ` data-block-type="${block.type}"` +
        ` data-managed-node-id="block:${block.id}"` +
        ` data-ai-editor-id="managed:${block.id}"` +
        ` data-section-index="${index}"` +
        ` style="${buildWrapperStyle(block.layout)}">` +
        `${contentHtml}</section>`
      )
    })
    .join("")

  return `<div class="me-managed-page-root">${blocksHtml}</div>`
}

function buildCanonicalPayload(slug) {
  switch (slug) {
    case "explicacoes": {
      const blocks = [
        createRichTextBlock(
          "explicacoes-hero",
          `
            <section data-me-page-canonical="explicacoes" class="me-explicacoes-page">
              <div class="me-explicacoes-shell">
                <div class="me-explicacoes-hero-card">
                  <p class="me-explicacoes-pill">Explicações</p>
                  <h1>Vamos descomplicar o teu ano letivo juntos?</h1>
                  <p>Não tens Instagram ou preferes o contacto formal por e-mail? Sem problema, estás no sítio certo! Este espaço foi pensado tanto para estudantes como para encarregados de educação que queiram esclarecer dúvidas sobre os meus materiais ou solicitar apoio individual.</p>
                </div>
              </div>
            </section>
          `.trim(),
        ),
        createRichTextBlock(
          "explicacoes-notes",
          `
            <section data-me-page-canonical="explicacoes" class="me-explicacoes-page">
              <div class="me-explicacoes-shell">
                <article class="me-explicacoes-notes-card">
                  <h2>Notas importantes antes de enviares o teu formulário:</h2>
                  <div class="me-explicacoes-note-list">
                    <p><strong>Planeamento Prévio:</strong> Devido à agenda preenchida, todos os pedidos para explicações devem ser efetuados com um mínimo de 3 semanas de antecedência.</p>
                    <p><strong>Não Garante Reserva:</strong> O envio e submissão deste formulário funciona estritamente como um pedido de informações e consulta de disponibilidade. Não constitui, de forma alguma, uma marcação automática ou garantia de vaga.</p>
                  </div>
                </article>
              </div>
            </section>
          `.trim(),
        ),
        createRichTextBlock(
          "explicacoes-form",
          `
            <section data-me-page-canonical="explicacoes" class="me-explicacoes-page">
              <div class="me-explicacoes-shell">
                <div class="me-explicacoes-form-placeholder"></div>
              </div>
            </section>
          `.trim(),
        ),
      ]
      const html = renderManagedHtml(blocks)
      return {
        title: "Explicações",
        layout_json: {
          projectData: {
            blocks,
          },
          html,
        },
        style_json: {},
        html,
      }
    }
    case "materiais": {
      const blocks = [
        createRichTextBlock(
          "materiais-hero",
          `
            <section data-me-page-canonical="materiais" class="me-materiais-page">
              <div class="me-materiais-shell">
                <div class="me-materiais-hero">
                  <p class="me-materiais-eyebrow">Materiais</p>
                  <h1>Tudo o que precisas para brilhares</h1>
                  <p>Encontra aqui os teus melhores amigos de estudo: resumos leves, esquemas práticos e o apoio certo para dominares o português e a filosofia sem stress.</p>
                </div>
              </div>
            </section>
          `.trim(),
        ),
        createRichTextBlock(
          "materiais-experience",
          `
            <section data-me-page-canonical="materiais" class="me-materiais-page me-materiais-page-soft">
              <div class="me-materiais-shell">
                <div class="me-materiais-support-copy">
                  <p class="me-materiais-helper-label">Catálogo dinâmico</p>
                  <h2>Pesquisa, filtros e apoio continuam ativos nesta área.</h2>
                  <p>O catálogo publicado, as FAQs e o suporte de escolha permanecem ligados ao frontend dinâmico, enquanto a estrutura principal desta página passa a ser gerida com baseline persistida.</p>
                </div>
                <div class="me-products-experience-placeholder"></div>
              </div>
            </section>
          `.trim(),
        ),
      ]
      const html = renderManagedHtml(blocks)
      return {
        title: "Materiais",
        layout_json: {
          projectData: {
            blocks,
          },
          html,
        },
        style_json: {},
        html,
      }
    }
    case "suporte": {
      const blocks = [
        createRichTextBlock(
          "suporte-hero",
          `
            <section data-me-page-canonical="suporte" class="me-support-page">
              <div class="me-support-shell">
                <div class="me-support-hero">
                  <p class="me-support-icon-badge">Suporte</p>
                  <h1>Como podemos ajudar?</h1>
                  <p>Encontre respostas rápidas na FAQ e, se ainda precisar, abra um chamado para a equipa acompanhar o seu caso.</p>
                </div>
              </div>
            </section>
          `.trim(),
        ),
        createRichTextBlock(
          "suporte-experience",
          `
            <section data-me-page-canonical="suporte" class="me-support-page me-support-page-soft">
              <div class="me-support-shell">
                <div class="me-support-helper-copy">
                  <p class="me-support-helper-label">Ajuda contínua</p>
                  <h2>A pesquisa, os filtros da FAQ e os atalhos para chamado continuam ativos aqui.</h2>
                  <p>Esta secção usa renderização gerida como base e mantém o comportamento dinâmico do frontend público através de uma ilha React segura.</p>
                </div>
                <div class="me-support-experience-placeholder"></div>
              </div>
            </section>
          `.trim(),
        ),
      ]
      const html = renderManagedHtml(blocks)
      return {
        title: "Suporte",
        layout_json: {
          projectData: {
            blocks,
          },
          html,
        },
        style_json: {},
        html,
      }
    }
    default:
      return null
  }
}

function countManagedBlocks(layoutJson) {
  const projectData =
    layoutJson && typeof layoutJson === "object" && layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? layoutJson.projectData
      : null
  if (Array.isArray(projectData?.blocks)) return projectData.blocks.length
  if (Array.isArray(layoutJson?.blocks)) return layoutJson.blocks.length
  return 0
}

function extractPersistedHtml(layoutJson) {
  if (!layoutJson || typeof layoutJson !== "object") return ""
  if (typeof layoutJson.html === "string" && layoutJson.html.trim()) return layoutJson.html.trim()
  if (
    layoutJson.projectData &&
    typeof layoutJson.projectData === "object" &&
    typeof layoutJson.projectData.html === "string" &&
    layoutJson.projectData.html.trim()
  ) {
    return layoutJson.projectData.html.trim()
  }
  return ""
}

function extractVersionSource(detail) {
  const currentVersion = detail?.published_version ?? detail?.latest_draft ?? detail?.versions?.[0] ?? null
  const source = currentVersion?.metadata?.source
  return String(source ?? "").trim().toLowerCase()
}

function auditManagedRoute(route, allowedPaths, detail) {
  const publishedVersion = detail?.published_version ?? null
  const latestVersion = detail?.versions?.[0] ?? null
  const layoutJson = publishedVersion?.layout_json ?? latestVersion?.layout_json ?? null
  const styleJson = publishedVersion?.style_json ?? latestVersion?.style_json ?? null
  const html = extractPersistedHtml(layoutJson)
  const layoutBlockCount = countManagedBlocks(layoutJson)
  const source = extractVersionSource(detail)
  const sitePageExists = Boolean(detail?.page?.id)
  const publishedVersionId = detail?.page?.published_version_id ?? null
  const domHasManagedRoot = /class=(['"])[^'"]*\bme-managed-page-root\b/i.test(html)
  const domHasBlockIds = /data-block-id=/i.test(html)
  const domHasManagedNodeIds = /data-managed-node-id=/i.test(html)
  const publishedVersionReady =
    Boolean(publishedVersionId) &&
    Boolean(publishedVersion) &&
    publishedVersion.status === "published" &&
    layoutBlockCount > 0 &&
    html.length > 0 &&
    domHasManagedRoot &&
    domHasBlockIds &&
    domHasManagedNodeIds

  let status = "managed_ready"
  let reason = null

  if (!route.routeIsPublic || route.routeIsSensitive || !route.inAllowedPaths) {
    status = "sensitive_or_blocked"
    reason = !route.inAllowedPaths
      ? "A rota pública ainda não está habilitada em allowed_paths."
      : "A rota é sensível, privada ou bloqueada para o fluxo persistível."
  } else if (!sitePageExists) {
    status = route.usesPublicManagedPage ? "hardcoded_fallback" : "unmanaged"
    reason = "Ainda não existe site_pages/published baseline para esta rota."
  } else if (source === "allowed_path_bootstrap" && !publishedVersionReady) {
    status = "bootstrap_only"
    reason = "A rota ainda depende de baseline allowed_path_bootstrap e não de uma baseline publicada real."
  } else if (!route.usesPublicManagedPage) {
    status = "hardcoded_fallback"
    reason = "A rota ainda não usa PublicManagedPage como renderização principal."
  } else if (!publishedVersionReady) {
    status = publishedVersionId ? "managed_incomplete" : "hardcoded_fallback"
    reason = publishedVersionId
      ? "Existe site_page, mas a versão publicada ainda não está completa ou não emite marcadores geridos."
      : "A rota ainda cai em fallback porque published_version_id não está preenchido."
  }

  return {
    path: route.path,
    managedSlug: route.managedSlug,
    inAllowedPaths: route.inAllowedPaths,
    inRouteOptions: route.inRouteOptions,
    routeIsPublic: route.routeIsPublic,
    routeIsSensitive: route.routeIsSensitive,
    supportsPersistibleFlow: status === "managed_ready",
    usesPublicManagedPage: route.usesPublicManagedPage,
    hasHardcodedFallback: status === "hardcoded_fallback",
    sitePageExists,
    sitePageId: detail?.page?.id ?? null,
    publishedVersionId,
    versionsCount: detail?.versions?.length ?? 0,
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
  }
}

async function readEditorConfig(admin) {
  const { data, error } = await admin
    .from("site_config")
    .select("config_value")
    .eq("config_key", CONFIG_KEY)
    .maybeSingle()

  if (error) throw error
  const allowedPaths = Array.isArray(data?.config_value?.allowed_paths)
    ? data.config_value.allowed_paths.map((item) => normalizePath(item)).filter(Boolean)
    : []
  return {
    allowedPaths,
  }
}

async function fetchPageDetail(admin, slug) {
  const { data: page, error: pageError } = await admin
    .from("site_pages")
    .select("id,slug,title,status,published_version_id,created_by,created_at,updated_at")
    .eq("slug", slug)
    .maybeSingle()

  if (pageError) throw pageError
  if (!page) return null

  const { data: versions, error: versionsError } = await admin
    .from("site_page_versions")
    .select("id,page_id,version_number,status,layout_json,style_json,metadata,created_by,created_at")
    .eq("page_id", page.id)
    .order("version_number", { ascending: false })

  if (versionsError) throw versionsError

  const publishedVersion = page.published_version_id
    ? (versions ?? []).find((item) => item.id === page.published_version_id) ?? null
    : null
  const latestDraft = (versions ?? []).find((item) => item.status === "draft") ?? null

  return {
    page,
    versions: versions ?? [],
    published_version: publishedVersion,
    latest_draft: latestDraft,
    assets: [],
  }
}

async function ensurePage(admin, slug, title) {
  const existing = await fetchPageDetail(admin, slug)
  if (existing?.page) return existing.page

  const { data, error } = await admin
    .from("site_pages")
    .insert({
      slug,
      title,
      status: "draft",
    })
    .select("id,slug,title,status,published_version_id,created_by,created_at,updated_at")
    .single()

  if (error) throw error
  return data
}

async function repairManagedBaseline(admin, route, detail) {
  if (!REPAIRABLE_SLUGS.has(route.managedSlug)) {
    return { changed: false, skipped: true, reason: "sem payload canónico local para reparo automático" }
  }

  const payload = buildCanonicalPayload(route.managedSlug)
  assert(payload, `Payload canónico ausente para ${route.managedSlug}`)

  const page = detail?.page ?? (await ensurePage(admin, route.managedSlug, payload.title))
  const versions = detail?.versions ?? []
  const nextVersionNumber = Math.max(0, ...versions.map((item) => Number(item.version_number) || 0)) + 1

  const { data: insertedVersion, error: insertError } = await admin
    .from("site_page_versions")
    .insert({
      page_id: page.id,
      version_number: nextVersionNumber,
      status: "published",
      layout_json: payload.layout_json,
      style_json: payload.style_json,
      metadata: {
        source: MANAGED_BASELINE_SOURCE,
        managed_public_page_seed: true,
        migrated_public_route: route.path,
        migrated_slug: route.managedSlug,
        repaired_from_status: detail ? auditManagedRoute(route, [], detail).status : "unmanaged",
      },
      created_by: null,
    })
    .select("id,version_number,status")
    .single()

  if (insertError) throw insertError

  const previousPublishedIds = versions
    .filter((item) => item.status === "published" && item.id !== insertedVersion.id)
    .map((item) => item.id)

  if (previousPublishedIds.length > 0) {
    const { error: archiveError } = await admin
      .from("site_page_versions")
      .update({ status: "archived" })
      .in("id", previousPublishedIds)
    if (archiveError) throw archiveError
  }

  const { error: pageUpdateError } = await admin
    .from("site_pages")
    .update({
      title: payload.title,
      status: "published",
      published_version_id: insertedVersion.id,
    })
    .eq("id", page.id)

  if (pageUpdateError) throw pageUpdateError

  return {
    changed: true,
    pageId: page.id,
    publishedVersionId: insertedVersion.id,
    publishedVersionNumber: insertedVersion.version_number,
  }
}

async function main() {
  const env = parseEnvFile(".env.local")
  const supabaseUrl = env.SUPABASE_PROJECT_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const projectRef = env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_ID || null

  assert(supabaseUrl, "SUPABASE_PROJECT_URL/VITE_SUPABASE_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const config = await readEditorConfig(admin)
  const allowedPaths = Array.from(new Set([...KNOWN_PUBLIC_EDITOR_ROUTES.map((item) => item.path), ...config.allowedPaths]))
  const dynamicAllowedPublicRoutes = allowedPaths
    .filter((path) => isPublicPath(path))
    .map((path) => {
      const known = KNOWN_PUBLIC_EDITOR_ROUTES.find((item) => item.path === path)
      return {
        path,
        slug: known?.slug ?? resolveManagedSlug(path),
        title: known?.title ?? path,
        usesPublicManagedPage: Boolean(known?.usesPublicManagedPage),
      }
    })

  const routes = Array.from(
    new Map(dynamicAllowedPublicRoutes.map((item) => [item.path, item])).values(),
  )

  console.log("Projeto alvo")
  console.log(
    JSON.stringify(
      {
        project_ref: projectRef,
        supabase_url: supabaseUrl,
        mode: auditOnly ? "audit_only" : "repair_and_audit",
      },
      null,
      2,
    ),
  )

  const before = []
  const repairs = []

  for (const routeMeta of routes) {
    const detail = await fetchPageDetail(admin, routeMeta.slug)
    const route = {
      path: routeMeta.path,
      managedSlug: routeMeta.slug,
      inAllowedPaths: isPathAllowed(routeMeta.path, allowedPaths),
      inRouteOptions: KNOWN_PUBLIC_EDITOR_ROUTES.some((item) => item.path === routeMeta.path),
      routeIsPublic: isPublicPath(routeMeta.path),
      routeIsSensitive: isSensitivePath(routeMeta.path),
      usesPublicManagedPage: routeMeta.usesPublicManagedPage,
    }
    const audit = auditManagedRoute(route, allowedPaths, detail)
    before.push(audit)

    if (!auditOnly && audit.status !== "managed_ready") {
      const repair = await repairManagedBaseline(admin, route, detail)
      repairs.push({
        path: route.path,
        slug: route.managedSlug,
        ...repair,
      })
    }
  }

  const after = []
  for (const routeMeta of routes) {
    const detail = await fetchPageDetail(admin, routeMeta.slug)
    const route = {
      path: routeMeta.path,
      managedSlug: routeMeta.slug,
      inAllowedPaths: isPathAllowed(routeMeta.path, allowedPaths),
      inRouteOptions: KNOWN_PUBLIC_EDITOR_ROUTES.some((item) => item.path === routeMeta.path),
      routeIsPublic: isPublicPath(routeMeta.path),
      routeIsSensitive: isSensitivePath(routeMeta.path),
      usesPublicManagedPage: routeMeta.usesPublicManagedPage,
    }
    after.push(auditManagedRoute(route, allowedPaths, detail))
  }

  console.log("Auditoria inicial")
  console.log(JSON.stringify(before, null, 2))
  if (!auditOnly) {
    console.log("Reparos aplicados")
    console.log(JSON.stringify(repairs, null, 2))
  }
  console.log("Auditoria final")
  console.log(JSON.stringify(after, null, 2))

  const blockingStatuses = after.filter((item) => item.status !== "managed_ready")
  if (blockingStatuses.length > 0) {
    console.log("Rotas ainda bloqueadas")
    console.log(JSON.stringify(blockingStatuses, null, 2))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
