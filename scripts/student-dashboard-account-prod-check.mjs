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

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55)
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForProfile(admin, userId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,role,is_admin,status,full_name,email")
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
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 })
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
  const studentAEmail = `qa.alu31.a.${stamp}@example.com`
  const studentBEmail = `qa.alu31.b.${stamp}@example.com`
  const password = `Aa!${stamp}xyz`

  const productATitle = `QA ALU31 Material A ${stamp}`
  const productBTitle = `QA ALU31 Material B ${stamp}`
  const downloadATitle = `QA ALU31 Download A ${stamp}`
  const downloadANotAllowedTitle = `QA ALU31 Download BLOCK ${stamp}`
  const downloadBTitle = `QA ALU31 Download B ${stamp}`
  const notificationATitle = `QA ALU31 Notificacao A ${stamp}`
  const notificationBTitle = `QA ALU31 Notificacao B ${stamp}`

  let studentAId = null
  let studentBId = null
  let productAId = null
  let productBId = null
  let moduleAId = null
  let moduleBId = null
  let orderAId = null
  let orderBId = null
  let grantAId = null
  let grantBId = null
  let notificationAId = null
  let notificationBId = null

  const evidence = {}

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const studentA = await admin.auth.admin.createUser({
      email: studentAEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ALU31 Student A" },
    })
    if (studentA.error) throw studentA.error
    studentAId = studentA.data.user?.id ?? null
    assert(studentAId, "Falha ao criar usuario student A")

    const studentB = await admin.auth.admin.createUser({
      email: studentBEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ALU31 Student B" },
    })
    if (studentB.error) throw studentB.error
    studentBId = studentB.data.user?.id ?? null
    assert(studentBId, "Falha ao criar usuario student B")

    const profileA = await waitForProfile(admin, studentAId)
    const profileB = await waitForProfile(admin, studentBId)
    assert(profileA, "Profile do student A nao foi criado")
    assert(profileB, "Profile do student B nao foi criado")

    const activateA = await admin
      .from("profiles")
      .update({ status: "active", role: "student", is_admin: false })
      .eq("id", studentAId)
    if (activateA.error) throw activateA.error

    const activateB = await admin
      .from("profiles")
      .update({ status: "active", role: "student", is_admin: false })
      .eq("id", studentBId)
    if (activateB.error) throw activateB.error

    const productsInsert = await admin
      .from("products")
      .insert([
        {
          slug: slugify(`qa-alu31-material-a-${stamp}`),
          title: productATitle,
          short_description: "Produto de teste ALU 3.1 A",
          description: "Produto de teste ALU 3.1 A",
          product_type: "paid",
          status: "published",
          price_cents: 1990,
          currency: "EUR",
          is_public: false,
          workload_minutes: 30,
          has_linear_progression: false,
        },
        {
          slug: slugify(`qa-alu31-material-b-${stamp}`),
          title: productBTitle,
          short_description: "Produto de teste ALU 3.1 B",
          description: "Produto de teste ALU 3.1 B",
          product_type: "paid",
          status: "published",
          price_cents: 2990,
          currency: "EUR",
          is_public: false,
          workload_minutes: 45,
          has_linear_progression: false,
        },
      ])
      .select("id,title")

    if (productsInsert.error) throw productsInsert.error
    const insertedProducts = productsInsert.data ?? []
    productAId = insertedProducts.find((item) => item.title === productATitle)?.id ?? null
    productBId = insertedProducts.find((item) => item.title === productBTitle)?.id ?? null
    assert(productAId && productBId, "Falha ao criar produtos de teste")

    const modulesInsert = await admin
      .from("product_modules")
      .insert([
        {
          product_id: productAId,
          title: `Modulo A ${stamp}`,
          description: "Modulo A",
          module_type: "external_link",
          access_type: "paid_only",
          sort_order: 1,
          position: 1,
          status: "published",
          is_preview: false,
          is_required: true,
        },
        {
          product_id: productBId,
          title: `Modulo B ${stamp}`,
          description: "Modulo B",
          module_type: "external_link",
          access_type: "paid_only",
          sort_order: 1,
          position: 1,
          status: "published",
          is_preview: false,
          is_required: true,
        },
      ])
      .select("id,product_id")

    if (modulesInsert.error) throw modulesInsert.error
    const insertedModules = modulesInsert.data ?? []
    moduleAId = insertedModules.find((item) => item.product_id === productAId)?.id ?? null
    moduleBId = insertedModules.find((item) => item.product_id === productBId)?.id ?? null
    assert(moduleAId && moduleBId, "Falha ao criar modulos de teste")

    const assetsInsert = await admin
      .from("module_assets")
      .insert([
        {
          module_id: moduleAId,
          asset_type: "external_link",
          title: downloadATitle,
          external_url: "https://example.com/qa-alu31-download-a",
          allow_download: true,
          allow_stream: true,
          watermark_enabled: false,
          status: "active",
          sort_order: 1,
        },
        {
          module_id: moduleAId,
          asset_type: "external_link",
          title: downloadANotAllowedTitle,
          external_url: "https://example.com/qa-alu31-download-block",
          allow_download: false,
          allow_stream: true,
          watermark_enabled: false,
          status: "active",
          sort_order: 2,
        },
        {
          module_id: moduleBId,
          asset_type: "external_link",
          title: downloadBTitle,
          external_url: "https://example.com/qa-alu31-download-b",
          allow_download: true,
          allow_stream: true,
          watermark_enabled: false,
          status: "active",
          sort_order: 1,
        },
      ])

    if (assetsInsert.error) throw assetsInsert.error

    const nowIso = new Date().toISOString()

    const ordersInsert = await admin
      .from("orders")
      .insert([
        {
          user_id: studentAId,
          product_id: productAId,
          status: "paid",
          currency: "EUR",
          base_price_cents: 1990,
          discount_cents: 0,
          final_price_cents: 1990,
          payment_provider: "stripe",
          payment_reference: `qa_alu31_a_${stamp}`,
          checkout_session_id: `cs_test_qa_alu31_a_${stamp}`,
          paid_at: nowIso,
          payment_environment: "test",
        },
        {
          user_id: studentBId,
          product_id: productBId,
          status: "paid",
          currency: "EUR",
          base_price_cents: 2990,
          discount_cents: 0,
          final_price_cents: 2990,
          payment_provider: "stripe",
          payment_reference: `qa_alu31_b_${stamp}`,
          checkout_session_id: `cs_test_qa_alu31_b_${stamp}`,
          paid_at: nowIso,
          payment_environment: "test",
        },
      ])
      .select("id,user_id")

    if (ordersInsert.error) throw ordersInsert.error
    const insertedOrders = ordersInsert.data ?? []
    orderAId = insertedOrders.find((item) => item.user_id === studentAId)?.id ?? null
    orderBId = insertedOrders.find((item) => item.user_id === studentBId)?.id ?? null
    assert(orderAId && orderBId, "Falha ao criar pedidos de teste")

    const grantsInsert = await admin
      .from("access_grants")
      .insert([
        {
          user_id: studentAId,
          product_id: productAId,
          source_type: "purchase",
          source_order_id: orderAId,
          status: "active",
          granted_at: nowIso,
        },
        {
          user_id: studentBId,
          product_id: productBId,
          source_type: "purchase",
          source_order_id: orderBId,
          status: "active",
          granted_at: nowIso,
        },
      ])
      .select("id,user_id")

    if (grantsInsert.error) throw grantsInsert.error
    const insertedGrants = grantsInsert.data ?? []
    grantAId = insertedGrants.find((item) => item.user_id === studentAId)?.id ?? null
    grantBId = insertedGrants.find((item) => item.user_id === studentBId)?.id ?? null
    assert(grantAId && grantBId, "Falha ao criar grants de teste")

    const notificationsInsert = await admin
      .from("notifications")
      .insert([
        {
          user_id: studentAId,
          type: "informational",
          title: notificationATitle,
          message: "Notificacao do aluno A para validacao ALU-007",
          status: "unread",
          sent_via_email: false,
          sent_via_in_app: true,
        },
        {
          user_id: studentBId,
          type: "informational",
          title: notificationBTitle,
          message: "Notificacao do aluno B para validacao ALU-007",
          status: "unread",
          sent_via_email: false,
          sent_via_in_app: true,
        },
      ])
      .select("id,user_id,title")

    if (notificationsInsert.error) throw notificationsInsert.error
    const insertedNotifications = notificationsInsert.data ?? []
    notificationAId = insertedNotifications.find((item) => item.user_id === studentAId)?.id ?? null
    notificationBId = insertedNotifications.find((item) => item.user_id === studentBId)?.id ?? null
    assert(notificationAId && notificationBId, "Falha ao criar notificacoes de teste")

    await login(page, baseUrl, studentAEmail, password, "/aluno/dashboard")

    await page.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 30000 })
    await page.goto(`${baseUrl}/aluno/dashboard`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Ola,/i }).waitFor({ timeout: 20000 })
    const dashboardText = await page.locator("body").innerText()
    assert(dashboardText.includes(productATitle), "ALU-001: dashboard nao exibiu dados do usuario com material ativo")
    evidence["ALU-001"] = `dashboard carregou com produto do aluno (${productATitle})`

    await page.goto(`${baseUrl}/aluno/cursos`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Meus materiais/i }).waitFor({ timeout: 20000 })
    const coursesText = await page.locator("body").innerText()
    assert(coursesText.includes(productATitle), "ALU-002: curso liberado do proprio usuario nao apareceu")
    assert(!coursesText.includes(productBTitle), "ALU-002: curso de outro usuario apareceu na listagem")
    evidence["ALU-002"] = `cursos exibiu apenas o acesso proprio (${productATitle})`

    await page.goto(`${baseUrl}/aluno/cursos/${productAId}`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: productATitle }).waitFor({ timeout: 20000 })

    await page.goto(`${baseUrl}/aluno/cursos/${productBId}`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => {
      const text = document.body?.innerText || ""
      return text.includes("Material indisponivel") || text.includes("Nao foi possivel carregar este material")
    }, { timeout: 25000 })
    const forbiddenText = await page.locator("body").innerText()
    assert(!forbiddenText.includes(productBTitle), "ALU-003: detalhe de curso sem grant exibiu dados indevidos")
    evidence["ALU-003"] = `detalhe respeitou grant: curso sem acesso bloqueado para /aluno/cursos/${productBId}`

    await page.goto(`${baseUrl}/aluno/perfil`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Perfil/i }).waitFor({ timeout: 20000 })

    const newFullName = `QA ALU31 Perfil ${stamp}`
    const newPhone = "912345678"
    const newNif = "123456789"

    await page.getByPlaceholder("Nome completo").fill(newFullName)
    await page.getByPlaceholder("Telefone").fill(newPhone)
    await page.locator("label:has-text('NIF') input").fill(newNif)
    await page.getByRole("button", { name: /Guardar alteracoes/i }).click()
    await page.getByText(/Preferencias atualizadas com sucesso/i).waitFor({ timeout: 20000 })

    const profileAfterUpdate = await admin
      .from("profiles")
      .select("full_name,phone,nif,role,status,is_admin")
      .eq("id", studentAId)
      .single()

    if (profileAfterUpdate.error) throw profileAfterUpdate.error
    assert(profileAfterUpdate.data.full_name === newFullName, "ALU-004: full_name nao foi atualizado")
    assert((profileAfterUpdate.data.phone ?? "") === newPhone, "ALU-004: phone nao foi atualizado")
    assert((profileAfterUpdate.data.nif ?? "") === newNif, "ALU-004: nif nao foi atualizado")
    assert(profileAfterUpdate.data.role === "student" && profileAfterUpdate.data.is_admin === false, "ALU-004: perfil alterou campo sensivel indevido")
    evidence["ALU-004"] = "perfil atualizou campos permitidos e preservou role/is_admin"

    await page.goto(`${baseUrl}/aluno/pagamentos`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Pagamentos/i }).waitFor({ timeout: 20000 })
    const paymentsText = await page.locator("body").innerText()
    assert(paymentsText.includes(productATitle), "ALU-005: pagamento proprio nao apareceu")
    assert(!paymentsText.includes(productBTitle), "ALU-005: pagamento de outro usuario apareceu")
    evidence["ALU-005"] = `pagamentos exibiu apenas historico proprio (${productATitle})`

    await page.goto(`${baseUrl}/aluno/downloads`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Downloads/i }).waitFor({ timeout: 20000 })
    const downloadsText = await page.locator("body").innerText()
    assert(downloadsText.includes(downloadATitle), "ALU-006: download liberado nao apareceu")
    assert(!downloadsText.includes(downloadANotAllowedTitle), "ALU-006: download sem permissao apareceu")
    assert(!downloadsText.includes(downloadBTitle), "ALU-006: download de outro usuario apareceu")
    evidence["ALU-006"] = "downloads mostrou somente ficheiros liberados do proprio usuario"

    await page.goto(`${baseUrl}/aluno/notificacoes`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Notificacoes/i }).waitFor({ timeout: 20000 })
    const notificationsText = await page.locator("body").innerText()
    assert(notificationsText.includes(notificationATitle), "ALU-007: notificacao propria nao apareceu")
    assert(!notificationsText.includes(notificationBTitle), "ALU-007: notificacao de outro usuario apareceu")

    await page.getByRole("button", { name: /Marcar como lida/i }).first().click()

    let notificationStatus = null
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const row = await admin
        .from("notifications")
        .select("status,read_at")
        .eq("id", notificationAId)
        .single()

      if (row.error) throw row.error
      if (row.data.status === "read" && row.data.read_at) {
        notificationStatus = row.data
        break
      }
      await wait(1000)
    }

    assert(notificationStatus, "ALU-007: acao de marcar notificacao como lida nao persistiu")

    const notificationBStatus = await admin
      .from("notifications")
      .select("status")
      .eq("id", notificationBId)
      .single()

    if (notificationBStatus.error) throw notificationBStatus.error
    assert(notificationBStatus.data.status === "unread", "ALU-007: notificacao de outro usuario foi alterada")
    evidence["ALU-007"] = "notificacoes listou somente dados proprios e marcou leitura corretamente"

    await logout(page, baseUrl)

    console.log("ALU31_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("ALU31_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

    if (grantAId || grantBId) {
      await admin.from("access_grants").delete().in("id", [grantAId, grantBId].filter(Boolean))
    }

    if (notificationAId || notificationBId) {
      await admin.from("notifications").delete().in("id", [notificationAId, notificationBId].filter(Boolean))
    }

    if (orderAId || orderBId) {
      await admin.from("orders").delete().in("id", [orderAId, orderBId].filter(Boolean))
    }

    if (productAId || productBId) {
      await admin.from("products").delete().in("id", [productAId, productBId].filter(Boolean))
    }

    for (const userId of [studentAId, studentBId]) {
      if (!userId) continue
      const deletion = await admin.auth.admin.deleteUser(userId)
      if (deletion.error) {
        console.error(`WARN: falha ao remover user ${userId}: ${deletion.error.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error("ALU31_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
