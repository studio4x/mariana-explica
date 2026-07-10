import fs from "node:fs"
import path from "node:path"

const PROJECT_ROOT = process.cwd()
const ENV_FILE = path.join(PROJECT_ROOT, ".env.local")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const env = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    env[key] = rawValue.replace(/^"(.*)"$/, "$1")
  }

  return env
}

function parseArgs(argv) {
  const args = {
    section: null,
    limit: 50,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--section") args.section = argv[index + 1] ?? null
    if (value === "--limit") args.limit = Number(argv[index + 1] ?? "50")
    if (value === "--dry-run") args.dryRun = true
  }

  return args
}

async function main() {
  const env = { ...loadEnvFile(ENV_FILE), ...process.env }
  const args = parseArgs(process.argv.slice(2))
  const functionBase = String(env.SUPABASE_PROJECT_URL ?? "").replace(/\/+$/, "")
  const adminBackfillToken = String(env.ADMIN_BACKFILL_TOKEN ?? "").trim()

  if (!functionBase) {
    throw new Error("SUPABASE_PROJECT_URL ausente no .env.local")
  }

  if (!adminBackfillToken) {
    throw new Error("ADMIN_BACKFILL_TOKEN ausente no .env.local")
  }

  if (!args.section) {
    throw new Error("Usa --section <module_assets|module_pdfs|product_covers|branding|site_page_assets|profile_avatars|support_attachments>")
  }

  const response = await fetch(`${functionBase}/functions/v1/admin-backfill-storage-r2`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminBackfillToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      section: args.section,
      limit: Number.isFinite(args.limit) ? args.limit : 50,
      dry_run: args.dryRun,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "message" in data
        ? String(data.message ?? `Falha ${response.status}`)
        : `Falha ${response.status}`,
    )
  }

  console.log(JSON.stringify(data, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
