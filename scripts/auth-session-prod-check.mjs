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

async function login(page, baseUrl, email, password, redirectPath = "/aluno/dashboard") {
  const redirect = encodeURIComponent(redirectPath)
  const loginUrl = `${baseUrl}/login?redirect=${redirect}`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" })

    if (new URL(page.url()).pathname !== "/login") {
      await page.context().clearCookies()
      await page.evaluate(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
      })
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
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 })
  }
}

async function clearClientAuth(page, baseUrl) {
  await page.context().clearCookies()
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
}

async function waitForRegisterResult(page) {
  const verificationUi = page
    .getByText(/Conta pendente de verificacao|Ir para o login|Enviamos um email/i)
    .first()

  const result = await Promise.race([
    verificationUi
      .waitFor({ timeout: 20000 })
      .then(() => "pending_verification")
      .catch(() => null),
    page
      .waitForURL((url) => url.pathname.startsWith("/aluno") || url.pathname === "/admin", {
        timeout: 20000,
      })
      .then(() => "auto_session")
      .catch(() => null),
  ])

  if (!result) {
    throw new Error("Cadastro nao apresentou resultado esperado (pendente ou sessao ativa).")
  }

  return result
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
  const studentEmail = `qa.auth.student.${stamp}@example.com`
  const registerEmail = `qa.auth.register.${stamp}@example.com`
  const createAccountEmail = `qa.auth.create.${stamp}@example.com`
  const adminEmail = `qa.auth.admin.${stamp}@example.com`

  const initialPassword = `Aa!${stamp}xyz`
  const resetPassword = `Bb!${stamp}xyz`

  const createdUserIds = []
  const evidence = {}

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const studentCreate = await admin.auth.admin.createUser({
      email: studentEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: "QA Student" },
    })
    if (studentCreate.error) throw studentCreate.error
    const studentId = studentCreate.data.user?.id
    assert(studentId, "Falha ao criar usuario student")
    createdUserIds.push(studentId)

    const adminCreate = await admin.auth.admin.createUser({
      email: adminEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: "QA Admin" },
    })
    if (adminCreate.error) throw adminCreate.error
    const adminId = adminCreate.data.user?.id
    assert(adminId, "Falha ao criar usuario admin")
    createdUserIds.push(adminId)

    const studentProfile = await waitForProfile(admin, studentId)
    assert(studentProfile, "Profile do student nao foi criado no prazo")

    const adminProfile = await waitForProfile(admin, adminId)
    assert(adminProfile, "Profile do admin nao foi criado no prazo")

    const updateStudentProfile = await admin
      .from("profiles")
      .update({ status: "active", role: "student", is_admin: false })
      .eq("id", studentId)
    if (updateStudentProfile.error) throw updateStudentProfile.error

    const updateAdminProfile = await admin
      .from("profiles")
      .update({ status: "active", role: "admin", is_admin: true })
      .eq("id", adminId)
    if (updateAdminProfile.error) throw updateAdminProfile.error

    await page.goto(`${baseUrl}/aluno/dashboard`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 20000 })
    evidence["AUTH-006"] = `anon /aluno/dashboard -> ${page.url()}`

    await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 20000 })
    evidence["AUTH-007-anon"] = `anon /admin -> ${page.url()}`

    await login(page, baseUrl, studentEmail, initialPassword, "/aluno/dashboard")
    await page.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 30000 })
    await page.getByText(/Painel do Aluno|Ola,/i).first().waitFor({ timeout: 20000 })
    evidence["AUTH-001"] = `login student ok -> ${page.url()}`

    await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 })
    evidence["AUTH-007-student"] = `student /admin -> ${page.url()}`

    await logout(page, baseUrl)

    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    try {
      await login(adminPage, baseUrl, adminEmail, initialPassword, "/admin")
      await adminPage.waitForURL((url) => url.pathname === "/admin", { timeout: 30000 })
      await adminPage.getByText(/Painel admin|Visao geral/i).first().waitFor({ timeout: 20000 })
      evidence["AUTH-007-admin"] = `admin /admin ok -> ${adminPage.url()}`
      await logout(adminPage, baseUrl)
    } finally {
      await adminContext.close()
    }

    await clearClientAuth(page, baseUrl)

    await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded" })
    await page.locator("#name").fill("QA Register")
    await page.locator("#email").fill(registerEmail)
    await page.locator("#password").fill(initialPassword)
    await page.locator("#confirmPassword").fill(initialPassword)
    await page.getByRole("button", { name: "Criar conta" }).click()
    const registerResult = await waitForRegisterResult(page)
    evidence["AUTH-002-register"] = `register flow (${registerResult}) for ${registerEmail}`

    await clearClientAuth(page, baseUrl)

    await page.goto(`${baseUrl}/criar-conta`, { waitUntil: "domcontentloaded" })
    await page.locator("#name").fill("QA Criar Conta")
    await page.locator("#email").fill(createAccountEmail)
    await page.locator("#password").fill(initialPassword)
    await page.locator("#confirmPassword").fill(initialPassword)
    await page.getByRole("button", { name: "Criar conta" }).click()
    const createAccountResult = await waitForRegisterResult(page)
    evidence["AUTH-002-criar-conta"] = `criar-conta flow (${createAccountResult}) for ${createAccountEmail}`

    await page.goto(`${baseUrl}/recuperar-senha`, { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: /Esqueci a minha palavra-passe/i }).click()
    await page.locator("#forgotPasswordEmail").fill(studentEmail)
    await page.getByRole("button", { name: /Enviar link de recuperacao/i }).click()
    await page.getByText(/Enviamos um email de recuperacao/i).waitFor({ timeout: 20000 })
    evidence["AUTH-004"] = `recovery started from /recuperar-senha for ${studentEmail}`

    const recoveryLinkResult = await admin.auth.admin.generateLink({
      type: "recovery",
      email: studentEmail,
      options: {
        redirectTo: `${baseUrl}/redefinir-senha`,
      },
    })
    if (recoveryLinkResult.error) throw recoveryLinkResult.error
    const recoveryActionLink = recoveryLinkResult.data.properties?.action_link
    assert(recoveryActionLink, "Nao foi possivel gerar action_link de recovery")

    await page.goto(recoveryActionLink, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/redefinir-senha" || url.pathname.startsWith("/aluno"), { timeout: 30000 })

    if (new URL(page.url()).pathname === "/redefinir-senha") {
      await page.locator("#password").fill(resetPassword)
      await page.locator("#confirmPassword").fill(resetPassword)
      await page.getByRole("button", { name: /Guardar nova palavra-passe/i }).click()
    }

    await page.waitForURL((url) => url.pathname.startsWith("/aluno") || url.pathname === "/admin", { timeout: 30000 })
    evidence["AUTH-005"] = `password reset finalized -> ${page.url()}`

    await logout(page, baseUrl)

    const magicLinkResult = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: studentEmail,
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=/aluno/dashboard`,
      },
    })
    if (magicLinkResult.error) throw magicLinkResult.error
    const magicActionLink = magicLinkResult.data.properties?.action_link
    assert(magicActionLink, "Nao foi possivel gerar action_link de magiclink")

    const callbackHits = { count: 0 }
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        const pathname = new URL(frame.url()).pathname
        if (pathname === "/auth/callback") {
          callbackHits.count += 1
        }
      }
    })

    await page.goto(magicActionLink, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname.startsWith("/aluno") || url.pathname === "/admin", { timeout: 35000 })
    assert(callbackHits.count <= 5, `Possivel loop no callback: hits=${callbackHits.count}`)
    evidence["AUTH-003"] = `callback concluded with ${callbackHits.count} hit(s), final=${page.url()}`

    await page.goto(`${baseUrl}/aluno/dashboard`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 20000 })

    await page.evaluate(() => {
      const keys = Object.keys(window.localStorage)
      for (const key of keys) {
        if (!key.includes("-auth-token")) continue
        const raw = window.localStorage.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw)
          const currentSession = parsed?.currentSession
          if (!currentSession) continue
          currentSession.expires_at = Math.floor(Date.now() / 1000) - 3600
          currentSession.access_token = "expired-token"
          currentSession.refresh_token = "expired-refresh"
          window.localStorage.setItem(key, JSON.stringify(parsed))
        } catch {
          // ignore
        }
      }
      window.sessionStorage.removeItem("mariana-explica:auth-profile")
      window.localStorage.removeItem("mariana-explica:auth-profile:shared")
    })

    await page.goto(`${baseUrl}/aluno/dashboard`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === "/login", { timeout: 25000 })
    evidence["AUTH-008"] = `expired session redirected -> ${page.url()}`

    await login(page, baseUrl, studentEmail, resetPassword, "/aluno/dashboard")
    await page.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 30000 })

    await logout(page, baseUrl)
    await page.goBack({ waitUntil: "domcontentloaded" })
    await page.waitForTimeout(1000)
    const postLogoutPath = new URL(page.url()).pathname
    assert(postLogoutPath === "/login" || postLogoutPath === "/", `logout back-nav path inesperado: ${postLogoutPath}`)
    evidence["AUTH-009"] = `post-logout back nav -> ${page.url()}`

    console.log("AUTH_CHECK_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("AUTH_CHECK_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

    for (const userId of createdUserIds) {
      const deletion = await admin.auth.admin.deleteUser(userId)
      if (deletion.error) {
        console.error(`WARN: falha ao remover user ${userId}: ${deletion.error.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error("AUTH_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
