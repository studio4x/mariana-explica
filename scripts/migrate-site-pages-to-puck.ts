import fs from "node:fs"
import { JSDOM } from "jsdom"
import { createClient } from "@supabase/supabase-js"
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

type PuckContentItem = {
  type: string
  props: Record<string, unknown>
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

function createBlockId() {
  return crypto.randomUUID()
}

function sanitizeInlineHtml(html: string) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, ' $1="#"')
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some((node) => node.nodeType === 3 && normalizeText(node.textContent).length > 0)
}

function unwrapLegacyWrapper(element: Element): Element {
  let current = element

  while (
    ["DIV", "MAIN", "SECTION", "ARTICLE"].includes(current.tagName) &&
    current.children.length === 1 &&
    !hasDirectText(current) &&
    !current.querySelector('[data-me-widget="home-reviews"]')
  ) {
    const next = current.children[0]
    if (!next || next.nodeType !== 1) break
    current = next
  }

  return current
}

function looksLikeTwoColumns(element: Element) {
  if (element.children.length !== 2) return false

  const [left, right] = Array.from(element.children)
  if (!left || !right || left.nodeType !== 1 || right.nodeType !== 1) return false

  const className = (element.getAttribute("class") ?? "").toLowerCase()
  const hasGridHint =
    className.includes("grid") ||
    className.includes("columns") ||
    className.includes("col-") ||
    className.includes("md:grid-cols-2") ||
    className.includes("lg:grid-cols-2")

  const leftText = normalizeText(left.textContent)
  const rightText = normalizeText(right.textContent)
  const hasEnoughText = leftText.length > 36 && rightText.length > 36

  return hasGridHint || hasEnoughText
}

function pickMainImage(element: Element) {
  if (element.tagName === "IMG") {
    return element as HTMLImageElement
  }

  const directChildren = Array.from(element.children).filter((node): node is Element => node.nodeType === 1)
  const directImages = directChildren.filter((child) => child.tagName === "IMG")

  if (directImages.length === 1 && directChildren.length <= 2) {
    return directImages[0] as HTMLImageElement
  }

  return null
}

function pickPrimaryButton(element: Element) {
  if (element.tagName === "A") {
    return element as HTMLAnchorElement
  }

  const candidates = Array.from(element.querySelectorAll("a")) as HTMLAnchorElement[]
  const buttonLike = candidates.find((anchor) => {
    const className = (anchor.getAttribute("class") ?? "").toLowerCase()
    return className.includes("btn") || className.includes("button") || className.includes("rounded") || className.includes("bg-")
  })

  if (buttonLike) return buttonLike
  if (candidates.length === 1) return candidates[0]

  return null
}

function extractDirectHeading(element: Element) {
  const heading = element.querySelector(":scope > h1, :scope > h2, :scope > h3")
  if (!heading) return null
  const text = normalizeText(heading.textContent)
  if (!text) return null
  return heading
}

function createStructuredBlock(type: string, props: Record<string, unknown>): PuckContentItem {
  return {
    type,
    props: {
      id: createBlockId(),
      ...props,
    },
  }
}

function addConvertedBlocksFromElement(element: Element, blocks: PuckContentItem[]) {
  const normalizedElement = unwrapLegacyWrapper(element)

  if (normalizedElement.matches('[data-me-widget="home-reviews"]')) {
    blocks.push(
      createStructuredBlock("HomeReviewsWidget", {
        title: "Widget dinamico: reviews da Home",
        note: "Este bloco e renderizado dinamicamente no site publico.",
      }),
    )
    return
  }

  const spacerMatch = /(?:height|min-height)\s*:\s*(\d+)px/i.exec(normalizedElement.getAttribute("style") ?? "")
  if (spacerMatch && normalizedElement.children.length === 0) {
    blocks.push(
      createStructuredBlock("Spacer", {
        height: Number(spacerMatch[1]),
      }),
    )
    return
  }

  if (looksLikeTwoColumns(normalizedElement)) {
    const [left, right] = Array.from(normalizedElement.children) as Element[]
    blocks.push(
      createStructuredBlock("TwoColumnsText", {
        left: sanitizeInlineHtml(left.innerHTML || left.outerHTML),
        right: sanitizeInlineHtml(right.innerHTML || right.outerHTML),
      }),
    )
    return
  }

  const image = pickMainImage(normalizedElement)
  if (image) {
    blocks.push(
      createStructuredBlock("ImageBlock", {
        src: image.getAttribute("src") ?? "https://placehold.co/1280x720?text=Imagem",
        alt: image.getAttribute("alt") ?? "Imagem",
        caption: "",
      }),
    )
    return
  }

  const childElements = Array.from(normalizedElement.children)
  const canUnrollChildren =
    ["DIV", "MAIN", "SECTION"].includes(normalizedElement.tagName) &&
    childElements.length > 1 &&
    !hasDirectText(normalizedElement)

  if (canUnrollChildren) {
    childElements.forEach((child) => {
      if (child.nodeType === 1) {
        addConvertedBlocksFromElement(child, blocks)
      }
    })
    return
  }

  const heading = extractDirectHeading(normalizedElement)
  if (heading) {
    const title = normalizeText(heading.textContent)
    const subtitleParts = Array.from(normalizedElement.querySelectorAll(":scope > p"))
      .map((paragraph) => normalizeText(paragraph.textContent))
      .filter(Boolean)

    blocks.push(
      createStructuredBlock("SectionTitle", {
        eyebrow: "Secao",
        title,
        subtitle: subtitleParts.join(" "),
        align: "center",
      }),
    )

    const clone = normalizedElement.cloneNode(true) as Element
    clone.querySelectorAll("h1,h2,h3").forEach((node) => node.remove())
    const remainder = sanitizeInlineHtml(clone.innerHTML).trim()
    if (remainder.length > 0) {
      blocks.push(
        createStructuredBlock("RichTextBlock", {
          content: remainder,
          align: "left",
        }),
      )
    }

    return
  }

  const button = pickPrimaryButton(normalizedElement)
  if (button && normalizeText(button.textContent).length > 0) {
    blocks.push(
      createStructuredBlock("ButtonBlock", {
        label: normalizeText(button.textContent),
        href: button.getAttribute("href") ?? "#",
        align: "left",
      }),
    )
    return
  }

  blocks.push(
    createStructuredBlock("RichTextBlock", {
      content: sanitizeInlineHtml(normalizedElement.outerHTML),
      align: "left",
    }),
  )
}

function convertLegacyHtmlToPuckData(html: string) {
  const sanitized = sanitizeInlineHtml(String(html ?? "")).trim()
  if (!sanitized) {
    return {
      root: { props: { title: "Pagina institucional" } },
      content: [
        {
          type: "RawHtml",
          props: { id: createBlockId(), html: "" },
        },
      ],
    }
  }

  const dom = new JSDOM(`<!doctype html><html><body><div id="me-legacy-root">${sanitized}</div></body></html>`)
  const doc = dom.window.document
  const root = doc.getElementById("me-legacy-root")

  if (!root) {
    return {
      root: { props: { title: "Pagina institucional" } },
      content: [
        {
          type: "RawHtml",
          props: { id: createBlockId(), html: sanitized },
        },
      ],
    }
  }

  const topLevelElements = Array.from(root.children).filter((node): node is Element => node.nodeType === 1)
  const blocks: PuckContentItem[] = []

  topLevelElements.forEach((element) => addConvertedBlocksFromElement(element, blocks))

  if (blocks.length === 0) {
    return {
      root: { props: { title: "Pagina institucional" } },
      content: [
        {
          type: "RawHtml",
          props: { id: createBlockId(), html: sanitized },
        },
      ],
    }
  }

  return {
    root: { props: { title: "Pagina institucional" } },
    content: blocks,
  }
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

function isRawHtmlOnlyPuckData(layoutJson: Record<string, unknown>) {
  const puckData = layoutJson.puckData
  if (!puckData || typeof puckData !== "object") return false

  const content = (puckData as { content?: unknown }).content
  if (!Array.isArray(content) || content.length !== 1) return false

  const first = content[0]
  if (!first || typeof first !== "object") return false
  return (first as { type?: unknown }).type === "RawHtml"
}

function shouldForceReconvert(layoutJson: Record<string, unknown>) {
  const puckData = layoutJson.puckData
  if (!puckData || typeof puckData !== "object") return true

  const content = (puckData as { content?: unknown }).content
  if (!Array.isArray(content)) return true

  // Conteudo com bloco unico costuma vir de conversao ruim (ex.: apenas botao/widget).
  if (content.length <= 1) return true

  return false
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
  let skippedStructured = 0
  let skippedNoHtml = 0

  for (const slug of TARGET_SLUGS) {
    const page = pageBySlug.get(slug)
    if (!page) continue

    const pageVersions = versionsByPageId.get(page.id) ?? []

    if (pageVersions.length === 0) {
      const baselineHtml = getEditorBaselineHtml(slug)
      const puckData = convertLegacyHtmlToPuckData(baselineHtml)

      const { data: inserted, error: insertError } = await supabase
        .from("site_page_versions")
        .insert({
          page_id: page.id,
          version_number: 1,
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
            seeded_from: "editor_baseline",
            seeded_at: new Date().toISOString(),
          },
          created_by: null,
        })
        .select("id")
        .single()

      if (insertError) throw insertError

      const { error: pageUpdateError } = await supabase
        .from("site_pages")
        .update({ status: "published", published_version_id: inserted.id })
        .eq("id", page.id)

      if (pageUpdateError) throw pageUpdateError
      seeded += 1
      continue
    }

    for (const version of pageVersions) {
      const layoutJson =
        version.layout_json && typeof version.layout_json === "object"
          ? version.layout_json
          : {}

      const isRawOnly = isRawHtmlOnlyPuckData(layoutJson)
      const mustReconvert = shouldForceReconvert(layoutJson)

      if (!mustReconvert) {
        skippedStructured += 1
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
        migrated_to_puck_source: isRawOnly ? "rawhtml_reconvert" : "legacy_reconvert",
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
        .update({ status: "published", published_version_id: inserted.id })
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
  const rawOnlyAfter = (checkVersionsData ?? []).filter((item) => {
    const layout = item.layout_json
    if (!layout || typeof layout !== "object") return false
    return isRawHtmlOnlyPuckData(layout as Record<string, unknown>)
  }).length

  console.log("--- Migracao para Puck concluida ---")
  console.log(`Paginas alvo: ${TARGET_SLUGS.join(", ")}`)
  console.log(`Seed inicial criado: ${seeded}`)
  console.log(`Versoes convertidas/reconvertidas: ${converted}`)
  console.log(`Versoes estruturadas mantidas: ${skippedStructured}`)
  console.log(`Versoes sem html legado: ${skippedNoHtml}`)
  console.log(`Total de versoes apos migracao: ${totalVersions}`)
  console.log(`RawHtml unico apos migracao: ${rawOnlyAfter}`)
}

void run().catch((error) => {
  console.error("Falha na migracao:", error)
  process.exit(1)
})
