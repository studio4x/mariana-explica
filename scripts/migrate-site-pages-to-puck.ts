import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { convertLegacyHtmlToPuckData } from "../src/pages/admin/page-editor/puckEditorConfig"
import { getEditorBaselineHtml } from "../src/pages/public/editorBaseline"

const TARGET_SLUGS = ["home", "sobre", "privacidade", "cookies", "termos"] as const

type SitePageRow = {
  id: string
  slug: string
  title: string
  status: "draft" | "published" | "archived"
  published_version_id: string | null
}

type SitePageVersionRow = {
  id: string
  page_id: string
  version_number: number
  status: "draft" | "published" | "archived"
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

function parseEnvLocal() {
  const envRaw = fs.readFileSync(".env.local", "utf8")
  const env: Record<string, string> = {}

  for (const line of envRaw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const idx = trimmed.indexOf("=")
    if (idx <= 0) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

function extractLegacyHtml(layoutJson: Record<string, unknown> | undefined) {
  if (!layoutJson || typeof layoutJson !== "object") return ""

  const htmlFromRoot = layoutJson.html
  if (typeof htmlFromRoot === "string" && htmlFromRoot.trim().length > 0) {
    return htmlFromRoot
  }

  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : layoutJson

  const pages = Array.isArray(projectData.pages) ? projectData.pages : []
  const firstPage = pages[0]
  if (!firstPage || typeof firstPage !== "object") return ""

  const pageAsRecord = firstPage as Record<string, unknown>
  const component = pageAsRecord.component
  if (typeof component === "string" && component.trim().length > 0) {
    return component
  }

  const frames = Array.isArray(pageAsRecord.frames) ? pageAsRecord.frames : []
  const firstFrame = frames[0]
  if (!firstFrame || typeof firstFrame !== "object") return ""

  const frameComponent = (firstFrame as Record<string, unknown>).component
  if (typeof frameComponent === "string" && frameComponent.trim().length > 0) {
    return frameComponent
  }

  return ""
}

function getNextVersionNumber(versions: SitePageVersionRow[]) {
  if (versions.length === 0) return 1
  return Math.max(...versions.map((item) => item.version_number)) + 1
}

async function run() {
  const env = parseEnvLocal()
  const url = env.SUPABASE_PROJECT_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error("SUPABASE_PROJECT_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local")
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: pagesData, error: pagesError } = await supabase
    .from("site_pages")
    .select("id,slug,title,status,published_version_id")
    .in("slug", [...TARGET_SLUGS])

  if (pagesError) throw pagesError

  const pages = (pagesData ?? []) as SitePageRow[]
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]))

  const missingSlugs = TARGET_SLUGS.filter((slug) => !pageBySlug.has(slug))
  if (missingSlugs.length > 0) {
    throw new Error(`Slugs nao encontrados em site_pages: ${missingSlugs.join(", ")}`)
  }

  const pageIds = pages.map((page) => page.id)
  const { data: versionsData, error: versionsError } = await supabase
    .from("site_page_versions")
    .select("id,page_id,version_number,status,layout_json,style_json,metadata,created_at")
    .in("page_id", pageIds)
    .order("created_at", { ascending: true })

  if (versionsError) throw versionsError

  const versions = (versionsData ?? []) as SitePageVersionRow[]
  const versionsByPageId = new Map<string, SitePageVersionRow[]>()

  for (const page of pages) {
    versionsByPageId.set(page.id, versions.filter((version) => version.page_id === page.id))
  }

  let seeded = 0
  let converted = 0
  let skippedAlreadyPuck = 0
  let skippedNoHtml = 0

  for (const slug of TARGET_SLUGS) {
    const page = pageBySlug.get(slug)
    if (!page) continue

    const pageVersions = versionsByPageId.get(page.id) ?? []

    if (pageVersions.length === 0) {
      const baselineHtml = getEditorBaselineHtml(slug)
      const puckData = convertLegacyHtmlToPuckData(baselineHtml)

      const insertPayload = {
        page_id: page.id,
        version_number: 1,
        status: "published",
        layout_json: {
          editor: "puck",
          schema_version: 1,
          html: baselineHtml,
          puckData,
        },
        style_json: {
          css: "",
        },
        metadata: {
          editor: "puck",
          seeded_from: "editor_baseline",
          seeded_at: new Date().toISOString(),
        },
        created_by: null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from("site_page_versions")
        .insert(insertPayload)
        .select("id")
        .single()

      if (insertError) throw insertError

      const { error: pageUpdateError } = await supabase
        .from("site_pages")
        .update({
          status: "published",
          published_version_id: inserted.id,
        })
        .eq("id", page.id)

      if (pageUpdateError) throw pageUpdateError

      seeded += 1
      continue
    }

    for (const version of pageVersions) {
      const layoutJson = (version.layout_json && typeof version.layout_json === "object")
        ? version.layout_json
        : {}

      if (layoutJson.puckData && typeof layoutJson.puckData === "object") {
        skippedAlreadyPuck += 1
        continue
      }

      const legacyHtml = extractLegacyHtml(layoutJson)
      if (!legacyHtml.trim()) {
        skippedNoHtml += 1
        continue
      }

      const puckData = convertLegacyHtmlToPuckData(legacyHtml)

      const nextLayoutJson = {
        ...layoutJson,
        editor: "puck",
        schema_version: 1,
        html: legacyHtml,
        puckData,
      }

      const nextMetadata = {
        ...(version.metadata && typeof version.metadata === "object" ? version.metadata : {}),
        editor: "puck",
        migrated_to_puck_at: new Date().toISOString(),
        migrated_to_puck_source: "legacy_html",
      }

      const { error: updateError } = await supabase
        .from("site_page_versions")
        .update({
          layout_json: nextLayoutJson,
          metadata: nextMetadata,
        })
        .eq("id", version.id)

      if (updateError) throw updateError
      converted += 1
    }

    if (!page.published_version_id) {
      const currentVersions = versionsByPageId.get(page.id) ?? []
      const nextVersionNumber = getNextVersionNumber(currentVersions)
      const baselineHtml = getEditorBaselineHtml(slug)
      const puckData = convertLegacyHtmlToPuckData(baselineHtml)

      const { data: inserted, error: insertError } = await supabase
        .from("site_page_versions")
        .insert({
          page_id: page.id,
          version_number: nextVersionNumber,
          status: "published",
          layout_json: {
            editor: "puck",
            schema_version: 1,
            html: baselineHtml,
            puckData,
          },
          style_json: { css: "" },
          metadata: {
            editor: "puck",
            seeded_from: "editor_baseline_missing_published",
            seeded_at: new Date().toISOString(),
          },
          created_by: null,
        })
        .select("id")
        .single()

      if (insertError) throw insertError

      const { error: pageUpdateError } = await supabase
        .from("site_pages")
        .update({
          status: "published",
          published_version_id: inserted.id,
        })
        .eq("id", page.id)

      if (pageUpdateError) throw pageUpdateError
      seeded += 1
    }
  }

  const { data: checkVersionsData, error: checkVersionsError } = await supabase
    .from("site_page_versions")
    .select("id,page_id,layout_json")
    .in("page_id", pageIds)

  if (checkVersionsError) throw checkVersionsError

  const totalVersions = (checkVersionsData ?? []).length
  const versionsWithPuck = (checkVersionsData ?? []).filter((item) => {
    const layout = item.layout_json
    return layout && typeof layout === "object" && (layout as Record<string, unknown>).puckData
  }).length

  console.log("--- Migracao para Puck concluida ---")
  console.log(`Paginas alvo: ${TARGET_SLUGS.join(", ")}`)
  console.log(`Seed inicial criado: ${seeded}`)
  console.log(`Versoes legadas convertidas: ${converted}`)
  console.log(`Ja com puckData: ${skippedAlreadyPuck}`)
  console.log(`Sem html legado: ${skippedNoHtml}`)
  console.log(`Total de versoes apos migracao: ${totalVersions}`)
  console.log(`Versoes com puckData apos migracao: ${versionsWithPuck}`)
}

void run().catch((error) => {
  console.error("Falha na migracao:", error)
  process.exit(1)
})
