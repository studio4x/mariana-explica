import fs from "node:fs"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const BASE_URL = "https://mariana-explica.pt"
const EXPECTED_SUPABASE_HOST = "gookhgufsxeplelpdaua.supabase.co"
const EXPECTED_VERCEL_HOST = "mariana-explica.pt"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb2toZ3Vmc3hlcGxlbHBkYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDM1OTYsImV4cCI6MjA5MTY3OTU5Nn0.9uw7Tk9R8-3tlPAJzRY8LxTC5TQMYVkHMf5JWsxqGjI"

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
  if (!condition) throw new Error(message)
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function clearClientAuth(page) {
  await page.context().clearCookies()
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
}

async function dismissCookieBanner(page) {
  const button = page.getByRole("button", { name: /Aceitar cookies|Manter apenas essenciais/i }).first()
  if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
    await button.click().catch(() => {})
    await wait(300)
  }
}

async function login(page, email, password, redirectPath = "/explicacoes") {
  const loginUrl = `${BASE_URL}/login?redirect=${encodeURIComponent(redirectPath)}`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" })

    if (new URL(page.url()).pathname !== "/login") {
      await clearClientAuth(page)
      continue
    }

    const emailInput = page.locator("#email")
    const passwordInput = page.locator("#password")
    await emailInput.waitFor({ state: "visible", timeout: 20000 })
    await passwordInput.waitFor({ state: "visible", timeout: 20000 })
    await emailInput.fill(email)
    await passwordInput.fill(password)
    await dismissCookieBanner(page)
    await page.getByRole("button", { name: "Entrar" }).click()
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30000 })
    return
  }

  throw new Error("Nao foi possivel autenticar no login")
}

async function waitForProfile(admin, userId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,role,is_admin,status")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) return data
    await wait(1000)
  }

  return null
}

async function createUserWithRetry(adminClient, payload, attempts = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await adminClient.auth.admin.createUser(payload)
    if (!result.error) return result
    lastError = result.error
    if (attempt < attempts) await wait(800 * attempt)
  }
  throw lastError ?? new Error("Falha ao criar usuario")
}

async function ensureRouteReady(page, path, visiblePattern) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" })
  await dismissCookieBanner(page)
  await page.getByText(visiblePattern).first().waitFor({ timeout: 30000 })
}

async function openEditor(page) {
  await page.getByRole("button", { name: /Editar com IA/i }).click()
  await page.getByRole("button", { name: /Fechar editor/i }).waitFor({ timeout: 20000 })
}

async function closeEditor(page) {
  const closeButton = page.getByRole("button", { name: /Fechar editor/i })
  if (await closeButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await closeButton.click()
  }
}

async function removePreviewToken(page, fallbackPath) {
  const currentUrl = new URL(page.url())
  currentUrl.searchParams.delete("builder-preview")
  const nextUrl =
    currentUrl.pathname && currentUrl.pathname !== "/login"
      ? `${currentUrl.origin}${currentUrl.pathname}${currentUrl.search}`
      : `${BASE_URL}${fallbackPath}`
  await page.goto(nextUrl, { waitUntil: "domcontentloaded" })
}

async function collectChatSnapshot(page) {
  const messages = await page
    .locator("[data-ai-page-editor-root] .rounded-2xl.border")
    .allTextContents()
    .catch(() => [])
  return messages.join("\n---\n").slice(-4000)
}

async function drivePreviewFlow(page) {
  const startedAt = Date.now()
  let clickedPreview = false

  while (Date.now() - startedAt < 120000) {
    const confirmChanges = page.getByRole("button", { name: /Confirmar alteracoes/i }).first()
    if (await confirmChanges.isVisible({ timeout: 1000 }).catch(() => false)) {
      const snapshot = await collectChatSnapshot(page)
      return {
        success: true,
        clickedPreview,
        reviewReady: true,
        snapshot,
      }
    }

    const quickReplyButtons = await page
      .locator("[data-ai-page-editor-root] button")
      .evaluateAll((elements) =>
        elements
          .map((element) => ({
            text: element.textContent?.trim() ?? "",
            disabled: (element instanceof HTMLButtonElement && element.disabled) || element.getAttribute("aria-disabled") === "true",
          }))
          .filter((entry) => entry.text),
      )
      .catch(() => [])
    const confirmReply = quickReplyButtons.find(
      (entry) => !entry.disabled && /^Sim\b/i.test(entry.text) && !/Confirmar alteracoes|Preparar previa/i.test(entry.text),
    )
    if (confirmReply?.text) {
      const button = page.getByRole("button", { name: new RegExp(`^${confirmReply.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).first()
      if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
        await button.click()
        await wait(1200)
        continue
      }
    }

    const previewButton = page.getByRole("button", { name: /Preparar previa/i }).first()
    if (await previewButton.isVisible({ timeout: 500 }).catch(() => false)) {
      clickedPreview = true
      await previewButton.click()
      await wait(1800)
      continue
    }

    const sendButton = page.getByRole("button", { name: /^Enviar$/i }).first()
    if (await sendButton.isEnabled({ timeout: 500 }).catch(() => false)) {
      // No actionable step is visible; give the backend time to finish.
    }

    await wait(1500)
  }

  return {
    success: false,
    clickedPreview,
    reviewReady: false,
    snapshot: await collectChatSnapshot(page),
  }
}

async function runEditorSmoke(page, { path, visiblePattern, prompt }) {
  await ensureRouteReady(page, path, visiblePattern)
  await openEditor(page)

  const textarea = page.locator("[data-ai-page-editor-root] textarea")
  await textarea.waitFor({ state: "visible", timeout: 20000 })
  await textarea.waitFor({ state: "attached", timeout: 20000 })
  await page.waitForFunction(
    () => {
      const textarea = document.querySelector("[data-ai-page-editor-root] textarea")
      return textarea instanceof HTMLTextAreaElement && !textarea.disabled
    },
    undefined,
    { timeout: 30000 },
  )
  await textarea.fill(prompt)
  await page.getByRole("button", { name: /^Enviar$/i }).click()

  const flow = await drivePreviewFlow(page)
  await closeEditor(page)
  await removePreviewToken(page, path)

  return flow
}

async function main() {
  const env = parseEnvFile(".env.local")
  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const vercelAppUrl = env.VERCEL_APP_URL

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")
  assert(vercelAppUrl, "VERCEL_APP_URL ausente no .env.local")
  assert(supabaseUrl.includes(EXPECTED_SUPABASE_HOST), "Projeto Supabase inesperado no .env.local")
  assert(vercelAppUrl.includes(EXPECTED_VERCEL_HOST), "Projeto Vercel inesperado no .env.local")

  const serviceAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const adminEmail = `qa.ai-editor.admin.${stamp}@example.com`
  const adminPassword = `Ai!Smoke${stamp}`
  const createdUsers = []
  const evidence = {}
  const routeFilter = new Set(process.argv.slice(2))
  const routeScenarios = [
    {
      key: "explicacoes",
      path: "/explicacoes",
      visiblePattern: /Notas importantes antes de enviares o teu formulario|Notas importantes antes de enviares o teu formulário/i,
      prompt: 'altere a cor do texto "Notas importantes antes de enviares o teu formulário:" para branco (#fff)',
    },
    {
      key: "sobre",
      path: "/sobre",
      visiblePattern: /De estudante para estudante|Como e estudar comigo\?/i,
      prompt:
        'altere apenas o texto "De estudante para estudante: porque este projeto?" para "De estudante para estudante: porque nasceu este projeto?"',
    },
    {
      key: "materiais",
      path: "/materiais",
      visiblePattern: /Tudo o que precisas para brilhares/i,
      prompt:
        'altere apenas o texto "Tudo o que precisas para brilhares" para "Tudo o que precisas para estudar com clareza"',
    },
  ].filter((scenario) => routeFilter.size === 0 || routeFilter.has(scenario.key))

  const browser = await chromium.launch({ headless: true })
  const anonContext = await browser.newContext()
  const adminContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  const adminPage = await adminContext.newPage()

  try {
    const adminCreate = await createUserWithRetry(serviceAdmin, {
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "QA AI Editor Admin" },
    })
    const adminId = adminCreate.data.user?.id
    assert(adminId, "Falha ao criar usuario admin temporario")
    createdUsers.push(adminId)

    const adminProfile = await waitForProfile(serviceAdmin, adminId)
    assert(adminProfile, "Profile admin nao foi criado no prazo")

    const profileUpdate = await serviceAdmin
      .from("profiles")
      .update({ status: "active", role: "admin", is_admin: true })
      .eq("id", adminId)
    if (profileUpdate.error) throw profileUpdate.error

    await anonPage.goto(`${BASE_URL}/explicacoes`, { waitUntil: "domcontentloaded" })
    const maintenanceVisible = await anonPage
      .getByText(/Estamos em manutencao para melhorar a tua experiência|Estamos em manutencao para melhorar a tua experiencia/i)
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false)
    evidence.maintenance_for_anon = maintenanceVisible

    await login(adminPage, adminEmail, adminPassword)

    for (const scenario of routeScenarios) {
      console.log(`Running route smoke: ${scenario.key}`)
      evidence[scenario.key] = await runEditorSmoke(adminPage, scenario)
    }

    console.log(JSON.stringify(evidence, null, 2))
  } finally {
    await adminContext.close().catch(() => {})
    await anonContext.close().catch(() => {})
    await browser.close().catch(() => {})

    for (const userId of createdUsers.reverse()) {
      await serviceAdmin.auth.admin.deleteUser(userId).catch(() => {})
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
