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
      .select("id,email,full_name,role,is_admin,status")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) {
      return data
    }

    await wait(1000)
  }

  return null
}

async function waitForProfileByEmail(admin, email, timeoutMs = 30000) {
  const normalized = email.trim().toLowerCase()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,full_name,role,is_admin,status,notifications_enabled,marketing_consent")
      .eq("email", normalized)
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
      await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30000 })
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
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

async function waitForUsersPage(page) {
  await page.waitForURL((url) => url.pathname === "/admin/usuarios", { timeout: 30000 })
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const loaded = await Promise.race([
      page
        .getByRole("heading", { name: /Usuarios|Utilizadores/i })
        .first()
        .waitFor({ timeout: 25000 })
        .then(() => "loaded")
        .catch(() => null),
      page
        .getByRole("heading", { name: /Nao foi possivel carregar|Não foi possível carregar/i })
        .first()
        .waitFor({ timeout: 25000 })
        .then(() => "error")
        .catch(() => null),
      page
        .getByRole("button", { name: /Novo usuario|Novo utilizador/i })
        .first()
        .waitFor({ timeout: 25000 })
        .then(() => "loaded")
        .catch(() => null),
    ])

    if (loaded === "loaded") {
      return
    }

    if (loaded === "error" && attempt < 3) {
      await page.getByRole("button", { name: "Tentar novamente" }).click()
      continue
    }
  }

  const debugText = await page.locator("body").innerText().catch(() => "")
  const debugPath = "scripts/.tmp-admin-usuarios-fail.png"
  await page.screenshot({ path: debugPath, fullPage: true }).catch(() => {})
  console.error("DEBUG_ADMIN_USUARIOS_URL", page.url())
  console.error("DEBUG_ADMIN_USUARIOS_TEXT", debugText.slice(0, 1200))
  console.error("DEBUG_ADMIN_USUARIOS_SCREENSHOT", debugPath)
  throw new Error("Pagina /admin/usuarios nao carregou apos tentativas de retry.")
}

async function dismissCookieBanner(page) {
  const acceptButton = page.getByRole("button", { name: /Aceitar cookies|Manter apenas essenciais/i }).first()
  if (await acceptButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await acceptButton.click().catch(() => {})
    await wait(200)
  }
}

async function callAdminUsersFunction({ supabaseUrl, anonKey, accessToken, payload }) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
  }
}

async function main() {
  const env = parseEnvFile(".env.local")

  const baseUrl = "https://www.mariana-explica.pt"
  const expectedSupabaseHost = "gookhgufsxeplelpdaua.supabase.co"
  const expectedVercelHost = "mariana-explica.pt"

  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const vercelAppUrl = env.VERCEL_APP_URL

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")
  assert(vercelAppUrl, "VERCEL_APP_URL ausente no .env.local")
  assert(supabaseUrl.includes(expectedSupabaseHost), "Projeto Supabase inesperado no .env.local")
  assert(vercelAppUrl.includes(expectedVercelHost), "Projeto Vercel inesperado no .env.local")

  const anonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb2toZ3Vmc3hlcGxlbHBkYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDM1OTYsImV4cCI6MjA5MTY3OTU5Nn0.9uw7Tk9R8-3tlPAJzRY8LxTC5TQMYVkHMf5JWsxqGjI"

  const serviceAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const stamp = Date.now()
  const adminEmail = `qa.adm42.admin.${stamp}@example.com`
  const adminPassword = `Aa!${stamp}xyz`
  const createdUserInitialEmail = `qa.adm42.user.${stamp}@example.com`
  const createdUserUpdatedEmail = `qa.adm42.user.updated.${stamp}@example.com`
  const createdUserPassword = `Qa!Create${stamp}`
  const resetPassword = `Qa!Reset${stamp}`

  const createdUserIds = []
  const evidence = {}

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const adminCreate = await createUserWithRetry(serviceAdmin, {
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "QA ADM 4.2 Admin" },
    })
    if (adminCreate.error) throw adminCreate.error

    const adminId = adminCreate.data.user?.id
    assert(adminId, "Falha ao criar usuario admin de QA")
    createdUserIds.push(adminId)

    const adminProfile = await waitForProfile(serviceAdmin, adminId)
    assert(adminProfile, "Profile do admin de QA nao foi criado no prazo")

    const promoteAdmin = await serviceAdmin
      .from("profiles")
      .update({ status: "active", role: "admin", is_admin: true })
      .eq("id", adminId)

    if (promoteAdmin.error) throw promoteAdmin.error

    await login(page, baseUrl, adminEmail, adminPassword, "/admin")
    await dismissCookieBanner(page)
    await page.goto(`${baseUrl}/admin/usuarios`, { waitUntil: "domcontentloaded" })
    await waitForUsersPage(page)
    await dismissCookieBanner(page)

    const tableRows = page.locator("tbody tr")
    await tableRows.first().waitFor({ timeout: 20000 })
    const rowCount = await tableRows.count()
    assert(rowCount > 0, "ADM-010: tabela de usuarios sem linhas")

    const adminRowVisible = await page.locator("tr", { hasText: adminEmail }).first().isVisible().catch(() => false)
    assert(adminRowVisible, "ADM-010: admin de QA nao apareceu na lista")

    evidence["ADM-010"] = `Playwright prod 2026-05-29, /admin/usuarios carregou com ${rowCount} linhas e usuario admin QA visivel (${adminEmail}).`

    await page.getByRole("button", { name: /Novo usuario|Novo utilizador/i }).click()
    await page.getByRole("heading", { name: /Novo usuario|Novo utilizador/i }).waitFor({ timeout: 15000 })

    await page.getByPlaceholder("Nome completo").fill("QA ADM42 Usuario Criado")
    await page.getByPlaceholder("email@dominio.com").fill(createdUserInitialEmail)
    await page.getByPlaceholder("Minimo 8 caracteres").first().fill(createdUserPassword)

    await page.getByRole("button", { name: /Criar usuario|Criar utilizador/i }).click()
    await page.getByText(/Utilizador criado com sucesso|Usuario criado com sucesso/i).waitFor({ timeout: 20000 })

    const createdProfile = await waitForProfileByEmail(serviceAdmin, createdUserInitialEmail)
    assert(createdProfile, "ADM-011: usuario criado nao encontrado no banco")
    createdUserIds.push(createdProfile.id)

    assert(createdProfile.role === "student", "ADM-011: role inicial inesperada")
    assert(createdProfile.status === "active", "ADM-011: status inicial inesperado")

    evidence["ADM-011"] = `Playwright prod 2026-05-29, criacao via UI concluida para ${createdUserInitialEmail} com profile role=student status=active.`

    const createdRow = page.locator("tr", { hasText: createdUserInitialEmail }).first()
    await createdRow.waitFor({ timeout: 20000 })
    await createdRow.getByRole("button", { name: "Editar" }).click()
    await page.getByRole("heading", { name: /Editar QA ADM42 Usuario Criado/i }).waitFor({ timeout: 15000 })

    const editSubmitButton = page.getByRole("button", { name: /Guardar alteracoes|Guardar alterações/i }).last()
    const editDialog = editSubmitButton.locator("xpath=ancestor::form")
    await editDialog.locator("input").nth(0).fill("QA ADM42 Usuario Editado")
    await editDialog.locator("input").nth(1).fill(createdUserUpdatedEmail)
    await editDialog.locator("select").nth(0).selectOption("affiliate")
    await editDialog.locator("select").nth(1).selectOption("blocked")

    await editSubmitButton.click()
    await page.getByText(/Dados de .* atualizados/i).waitFor({ timeout: 20000 })

    const blockedProfile = await waitForProfileByEmail(serviceAdmin, createdUserUpdatedEmail)
    assert(blockedProfile, "ADM-012/013: usuario editado nao encontrado")
    assert(blockedProfile.full_name === "QA ADM42 Usuario Editado", "ADM-012: nome nao atualizado")
    assert(blockedProfile.role === "affiliate", "ADM-012: role nao atualizada")
    assert(blockedProfile.status === "blocked", "ADM-013: status bloqueado nao aplicado")

    const blockedContext = await browser.newContext()
    const blockedPage = await blockedContext.newPage()
    try {
      await login(blockedPage, baseUrl, createdUserUpdatedEmail, createdUserPassword, "/aluno/dashboard")
      await blockedPage.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 })
      await wait(6000)
      const blockedPath = new URL(blockedPage.url()).pathname
      assert(!blockedPath.startsWith("/aluno"), "ADM-013: usuario bloqueado acessou area privada")
    } finally {
      await blockedContext.close()
    }

    await page.locator("tr", { hasText: createdUserUpdatedEmail }).first().getByRole("button", { name: "Editar" }).click()
    const unblockSubmitButton = page.getByRole("button", { name: /Guardar alteracoes|Guardar alterações/i }).last()
    const unblockDialog = unblockSubmitButton.locator("xpath=ancestor::form")
    await unblockDialog.locator("select").nth(1).selectOption("active")
    await unblockSubmitButton.click()
    await page.getByText(/Dados de .* atualizados/i).waitFor({ timeout: 20000 })

    const unblockedProfile = await waitForProfileByEmail(serviceAdmin, createdUserUpdatedEmail)
    assert(unblockedProfile?.status === "active", "ADM-013: desbloqueio nao aplicado")

    const unblockedContext = await browser.newContext()
    const unblockedPage = await unblockedContext.newPage()
    try {
      await login(unblockedPage, baseUrl, createdUserUpdatedEmail, createdUserPassword, "/aluno/dashboard")
      await unblockedPage.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 })
      await wait(3000)
      const unblockedPath = new URL(unblockedPage.url()).pathname
      assert(unblockedPath.startsWith("/aluno"), "ADM-013: usuario ativo nao conseguiu acessar area privada")
    } finally {
      await unblockedContext.close()
    }

    const adminSignIn = await publicClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })
    if (adminSignIn.error) throw adminSignIn.error
    const adminAccessToken = adminSignIn.data.session?.access_token
    assert(adminAccessToken, "Nao foi possivel obter access token admin para validacao backend")

    const invalidRoleResponse = await callAdminUsersFunction({
      supabaseUrl,
      anonKey,
      accessToken: adminAccessToken,
      payload: {
        action: "update",
        userId: unblockedProfile.id,
        role: "owner",
      },
    })

    assert(invalidRoleResponse.status === 400, "ADM-012: validacao backend de role invalida nao retornou 400")

    evidence["ADM-012"] = `Playwright prod 2026-05-29, edicao via UI atualizou nome/email/role para ${createdUserUpdatedEmail} (role=affiliate) e validacao backend rejeitou role invalida com status ${invalidRoleResponse.status}.`
    evidence["ADM-013"] = `Playwright prod 2026-05-29, status bloqueado aplicado e login bloqueado; apos retorno para active o login voltou a funcionar.`

    await page.locator("tr", { hasText: createdUserUpdatedEmail }).first().getByRole("button", { name: /Senha/i }).click()
    await page.getByRole("heading", { name: /Redefinir senha de QA ADM42 Usuario Editado/i }).waitFor({ timeout: 15000 })

    const passwordSubmitButton = page.getByRole("button", { name: /Atualizar senha/i }).last()
    const passwordDialog = passwordSubmitButton.locator("xpath=ancestor::form")
    await passwordDialog.locator('input[type="password"]').first().fill(resetPassword)
    await passwordDialog.locator('input[type="password"]').nth(1).fill(resetPassword)
    await passwordSubmitButton.click()
    await page.getByText(/Senha redefinida para/i).waitFor({ timeout: 20000 })

    const signInOldPassword = await publicClient.auth.signInWithPassword({
      email: createdUserUpdatedEmail,
      password: createdUserPassword,
    })
    assert(signInOldPassword.error, "ADM-014: senha antiga deveria falhar apos reset")

    const signInNewPassword = await publicClient.auth.signInWithPassword({
      email: createdUserUpdatedEmail,
      password: resetPassword,
    })
    if (signInNewPassword.error) throw signInNewPassword.error
    await publicClient.auth.signOut()

    evidence["ADM-014"] = "Playwright prod 2026-05-29, reset de senha por admin aplicou nova credencial; senha antiga falhou e nova senha autenticou com sucesso."

    const selfDeleteResponse = await callAdminUsersFunction({
      supabaseUrl,
      anonKey,
      accessToken: adminAccessToken,
      payload: {
        action: "delete",
        userId: adminId,
      },
    })

    const selfDemoteResponse = await callAdminUsersFunction({
      supabaseUrl,
      anonKey,
      accessToken: adminAccessToken,
      payload: {
        action: "update",
        userId: adminId,
        role: "student",
      },
    })

    assert(selfDeleteResponse.status === 403, "ADM-015: autoexclusao nao bloqueada")
    assert(selfDemoteResponse.status === 403, "ADM-015: auto-rebaixamento admin nao bloqueado")

    evidence["ADM-015"] = `Playwright+API prod 2026-05-29, backend bloqueou autoexclusao (${selfDeleteResponse.status}) e auto-rebaixamento (${selfDemoteResponse.status}) do admin autenticado.`

    const relevantActions = [
      "admin.user_created",
      "admin.user_updated",
      "admin.user_password_reset",
    ]

    const { data: auditLogs, error: auditError } = await serviceAdmin
      .from("audit_logs")
      .select("action,entity_id,actor_user_id,created_at")
      .eq("actor_user_id", adminId)
      .eq("entity_type", "profile")
      .eq("entity_id", unblockedProfile.id)
      .in("action", relevantActions)
      .order("created_at", { ascending: true })

    if (auditError) throw auditError

    const foundActions = new Set((auditLogs ?? []).map((entry) => entry.action))
    for (const action of relevantActions) {
      assert(foundActions.has(action), `ADM-016: auditoria sem acao ${action}`)
    }

    evidence["ADM-016"] = `Playwright prod 2026-05-29, audit_logs registrou ${Array.from(foundActions).join(", ")} para actor=${adminId} e entity=${unblockedProfile.id}.`

    await publicClient.auth.signOut()

    console.log("ADM42_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("ADM42_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

    for (const userId of createdUserIds.reverse()) {
      const deletion = await serviceAdmin.auth.admin.deleteUser(userId)
      if (deletion.error) {
        console.error(`WARN: falha ao remover user ${userId}: ${deletion.error.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error("ADM42_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
