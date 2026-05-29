import fs from "node:fs"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

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

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForProfile(admin, userId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,role,is_admin,status")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) {
      return data
    }

    await wait(1000)
  }

  return null
}

async function clearClientAuth(page, baseUrl) {
  await page.context().clearCookies()
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
}

async function login(page, baseUrl, email, password, redirectPath = "/aluno/dashboard") {
  const redirect = encodeURIComponent(redirectPath)
  const loginUrl = `${baseUrl}/login?redirect=${redirect}`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" })

    if (new URL(page.url()).pathname !== "/login") {
      await clearClientAuth(page, baseUrl)
      continue
    }

    const emailInput = page.locator("#email")
    const passwordInput = page.locator("#password")

    try {
      await emailInput.waitFor({ state: "visible", timeout: 20000 })
      const passwordVisible = await passwordInput.isVisible({ timeout: 20000 }).catch(() => false)
      if (!passwordVisible) {
        if (attempt === 2) {
          throw new Error("Campo de password nao ficou visivel na rota de login.")
        }
        continue
      }

      await emailInput.fill(email)
      await passwordInput.fill(password)
      await page.getByRole("button", { name: "Entrar" }).click()
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

async function logout(page, baseUrl) {
  const logoutButton = page.getByRole("button", { name: /sair( da conta)?/i }).first()
  if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutButton.click()
    await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/login", { timeout: 20000 })
    return
  }

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" })
  const navbarLogout = page.getByRole("button", { name: "Sair" }).first()
  if (await navbarLogout.isVisible({ timeout: 5000 }).catch(() => false)) {
    await navbarLogout.click()
    await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/login", { timeout: 20000 })
  }
}

async function createUserWithRetry(adminClient, payload, attempts = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await adminClient.auth.admin.createUser(payload)
    if (!result.error) return result
    lastError = result.error
    if (attempt < attempts) {
      await wait(800 * attempt)
    }
  }
  throw lastError ?? new Error("Falha ao criar usuario")
}

async function waitForAdminOverviewLoaded(page, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const overviewHeading = page.getByRole("heading", { name: /Visao geral/i }).first()
    const errorHeading = page.getByRole("heading", { name: "Nao foi possivel carregar o admin" }).first()

    const loaded = await Promise.race([
      overviewHeading.waitFor({ timeout: 15000 }).then(() => "loaded").catch(() => null),
      errorHeading.waitFor({ timeout: 15000 }).then(() => "error").catch(() => null),
    ])

    if (loaded === "loaded") {
      return
    }

    if (loaded === "error" && attempt < maxRetries) {
      await page.getByRole("button", { name: "Tentar novamente" }).click()
      continue
    }

    throw new Error(`Admin overview nao carregou apos ${attempt} tentativa(s).`)
  }
}

async function main() {
  const baseUrl = "https://www.mariana-explica.pt"
  const env = parseEnvFile(".env.local")
  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const stamp = Date.now()
  const studentEmail = `qa.adm41.student.${stamp}@example.com`
  const adminEmail = `qa.adm41.admin.${stamp}@example.com`
  const password = `Aa!${stamp}xyz`

  const createdUsers = []
  const evidence = {}

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const studentCreate = await createUserWithRetry(admin, {
      email: studentEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ADM 4.1 Student" },
    })
    if (studentCreate.error) throw studentCreate.error
    const studentId = studentCreate.data.user?.id
    assert(studentId, "Falha ao criar usuario student")
    createdUsers.push(studentId)

    const adminCreate = await createUserWithRetry(admin, {
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ADM 4.1 Admin" },
    })
    if (adminCreate.error) throw adminCreate.error
    const adminId = adminCreate.data.user?.id
    assert(adminId, "Falha ao criar usuario admin")
    createdUsers.push(adminId)

    const studentProfile = await waitForProfile(admin, studentId)
    const adminProfile = await waitForProfile(admin, adminId)
    assert(studentProfile, "Profile do student nao foi criado no prazo")
    assert(adminProfile, "Profile do admin nao foi criado no prazo")

    const updateStudent = await admin
      .from("profiles")
      .update({ status: "active", role: "student", is_admin: false })
      .eq("id", studentId)
    if (updateStudent.error) throw updateStudent.error

    const updateAdmin = await admin
      .from("profiles")
      .update({ status: "active", role: "admin", is_admin: true })
      .eq("id", adminId)
    if (updateAdmin.error) throw updateAdmin.error

    await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 20000 })
    evidence["ADM-002-anon"] = `anon /admin -> ${page.url()}`

    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()
    try {
      await login(studentPage, baseUrl, studentEmail, password, "/aluno/dashboard")
      await studentPage.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 30000 })
      await studentPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" })
      await studentPage.waitForURL((url) => url.pathname === "/", { timeout: 20000 })
      evidence["ADM-002-student"] = `student /admin -> ${studentPage.url()}`
    } finally {
      await studentContext.close()
    }

    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    try {
      await login(adminPage, baseUrl, adminEmail, password, "/admin")
      await adminPage.waitForURL((url) => url.pathname === "/admin", { timeout: 30000 })
      await waitForAdminOverviewLoaded(adminPage, 3)
      await adminPage.getByText("Utilizadores").first().waitFor({ timeout: 20000 })
      await adminPage.getByText("Materiais publicados").first().waitFor({ timeout: 20000 })
      await adminPage.getByText("Pedidos pagos").first().waitFor({ timeout: 20000 })
      await adminPage.getByText("Receita registada").first().waitFor({ timeout: 20000 })

      const metricNumbers = await adminPage.locator(".text-3xl.font-bold").allInnerTexts()
      const hasNumericMetric = metricNumbers.some((value) => /\d/.test(value))
      assert(hasNumericMetric, "ADM-001: metricas principais nao exibiram valores numericos")
      evidence["ADM-001"] = `dashboard admin carregou metricas: ${metricNumbers.join(" | ")}`
    } finally {
      await adminContext.close()
    }

    const retryContext = await browser.newContext({ serviceWorkers: "block" })
    const retryPage = await retryContext.newPage()
    let forcedFailures = 0

    try {
      await login(retryPage, baseUrl, adminEmail, password, "/admin")
      await retryPage.waitForURL((url) => url.pathname === "/admin", { timeout: 30000 })
      await waitForAdminOverviewLoaded(retryPage, 3)

      await retryContext.route("**/functions/v1/admin-dashboard", async (route, request) => {
        if (request.method() !== "POST") {
          await route.continue()
          return
        }

        if (forcedFailures < 3) {
          forcedFailures += 1
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              message: "QA forced admin-dashboard error",
            }),
          })
          return
        }

        await route.continue()
      })

      await retryPage.reload({ waitUntil: "domcontentloaded" })
      await retryPage.getByRole("heading", { name: "Nao foi possivel carregar o admin" }).waitFor({ timeout: 25000 })
      await retryPage.getByRole("button", { name: "Tentar novamente" }).click()
      await retryPage.getByRole("heading", { name: /Visao geral/i }).first().waitFor({ timeout: 25000 })
      evidence["ADM-003"] = `erro forcado no admin-dashboard exibiu retry e recuperou apos clique (forcedFailures=${forcedFailures})`

    } finally {
      await retryContext.close()
    }

    console.log("ADM41_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("ADM41_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

    for (const userId of createdUsers) {
      const deletion = await admin.auth.admin.deleteUser(userId)
      if (deletion.error) {
        console.error(`WARN: falha ao remover user ${userId}: ${deletion.error.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error("ADM41_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
