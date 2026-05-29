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

    if (!error && data) return data
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
        if (attempt === 2) throw new Error("Campo de password nao ficou visivel na rota de login.")
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

async function dismissCookieBanner(page) {
  const acceptCookies = page.getByRole("button", { name: /aceitar cookies/i }).first()
  if (await acceptCookies.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptCookies.click()
    await wait(400)
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
  const studentAEmail = `qa.alu452.a.${stamp}@example.com`
  const studentBEmail = `qa.alu452.b.${stamp}@example.com`
  const password = `Aa!${stamp}xyz`

  const seedSubjectA = `QA ALU-010 proprio ${stamp}`
  const seedMessageA = `Mensagem propria do aluno A ${stamp}`
  const seedSubjectB = `QA ALU-010 outro usuario ${stamp}`
  const seedMessageB = `Mensagem do aluno B ${stamp}`

  const newSubject = `QA ALU-011 novo ticket ${stamp}`
  const newMessage = `Descricao do chamado ALU-011 ${stamp}`
  const adminReplyText = `Resposta admin ALU-012 ${stamp}`
  const studentReplyText = `Resposta aluno ALU-013 ${stamp}`

  let studentAId = null
  let studentBId = null
  let adminUserId = null
  let seededTicketAId = null
  let seededTicketBId = null
  let createdTicketId = null

  const evidence = {}

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const adminUser = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_admin", true)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()

    if (adminUser.error) throw adminUser.error
    adminUserId = adminUser.data?.id ?? null
    assert(adminUserId, "Nao foi encontrado usuario admin ativo para validar timeline do ticket")

    const studentA = await admin.auth.admin.createUser({
      email: studentAEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ALU452 Student A" },
    })
    if (studentA.error) throw studentA.error
    studentAId = studentA.data.user?.id ?? null
    assert(studentAId, "Falha ao criar usuario student A")

    const studentB = await admin.auth.admin.createUser({
      email: studentBEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ALU452 Student B" },
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

    const seededTickets = await admin
      .from("support_tickets")
      .insert([
        {
          user_id: studentAId,
          subject: seedSubjectA,
          message: seedMessageA,
          status: "open",
          priority: "normal",
          category: "general",
        },
        {
          user_id: studentBId,
          subject: seedSubjectB,
          message: seedMessageB,
          status: "open",
          priority: "normal",
          category: "general",
        },
      ])
      .select("id,user_id")

    if (seededTickets.error) throw seededTickets.error
    const seededRows = seededTickets.data ?? []
    seededTicketAId = seededRows.find((item) => item.user_id === studentAId)?.id ?? null
    seededTicketBId = seededRows.find((item) => item.user_id === studentBId)?.id ?? null
    assert(seededTicketAId && seededTicketBId, "Falha ao criar tickets de semente")

    await login(page, baseUrl, studentAEmail, password, "/aluno/chamados")
    await page.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 30000 })
    await dismissCookieBanner(page)

    await page.goto(`${baseUrl}/aluno/chamados`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Chamados/i }).waitFor({ timeout: 20000 })
    await page.waitForFunction((subject) => document.body?.innerText.includes(subject), seedSubjectA, { timeout: 20000 })
    const supportListText = await page.locator("body").innerText()
    assert(supportListText.includes(seedSubjectA), "ALU-010: ticket do proprio usuario nao apareceu na listagem")
    assert(!supportListText.includes(seedSubjectB), "ALU-010: ticket de outro usuario apareceu na listagem")
    evidence["ALU-010"] = `listagem exibiu apenas ticket proprio (${seedSubjectA}) e ocultou ticket de outro usuario`

    await page.goto(`${baseUrl}/aluno/chamados?openTicketModal=1&ticketStep=form`, { waitUntil: "domcontentloaded" })
    await dismissCookieBanner(page)
    await page.getByRole("heading", { name: "Novo chamado" }).waitFor({ timeout: 20000 })
    await page.getByPlaceholder("Ex: problema com pagamento ou acesso").fill(newSubject)
    await page
      .getByPlaceholder("Inclui contexto, passos ja tentados e o que precisas resolver.")
      .fill(newMessage)
    await page.getByRole("button", { name: "Enviar chamado" }).click()

    await page.waitForURL((url) => /^\/aluno\/chamados\/[0-9a-f-]+$/i.test(url.pathname), { timeout: 30000 })
    const createdPath = new URL(page.url()).pathname
    createdTicketId = createdPath.split("/").filter(Boolean).at(-1) ?? null
    assert(createdTicketId, "ALU-011: nao foi possivel obter o ticket criado")
    await page.getByRole("heading", { name: newSubject }).waitFor({ timeout: 20000 })
    evidence["ALU-011"] = `criacao de ticket via UI concluiu com redirect para ${createdPath}`

    const adminReplyInsert = await admin
      .from("support_ticket_messages")
      .insert({
        ticket_id: createdTicketId,
        sender_user_id: adminUserId,
        sender_role: "admin",
        message: adminReplyText,
      })
      .select("id")
      .single()

    if (adminReplyInsert.error) throw adminReplyInsert.error

    await page.reload({ waitUntil: "domcontentloaded" })
    await dismissCookieBanner(page)
    await page.getByRole("heading", { name: newSubject }).waitFor({ timeout: 20000 })
    await page.waitForFunction((text) => document.body?.innerText.includes(text), adminReplyText, { timeout: 20000 })
    const timelineText = await page.locator("body").innerText()
    assert(timelineText.includes("Historico de mensagens"), "ALU-012: secao de timeline nao carregou")
    assert(timelineText.includes(newMessage), "ALU-012: descricao inicial nao apareceu no detalhe")
    assert(timelineText.includes(adminReplyText), "ALU-012: resposta admin nao apareceu na timeline")
    evidence["ALU-012"] = `detalhe ${createdPath} exibiu descricao inicial e resposta admin na timeline`

    await page.getByPlaceholder("Escreve a tua resposta").fill(studentReplyText)
    await page.getByRole("button", { name: "Enviar" }).click({ force: true })
    await page.waitForFunction((text) => document.body?.innerText.includes(text), studentReplyText, { timeout: 20000 })

    let persistedReply = null
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const replyRow = await admin
        .from("support_ticket_messages")
        .select("id,message,sender_user_id,sender_role")
        .eq("ticket_id", createdTicketId)
        .eq("sender_user_id", studentAId)
        .eq("sender_role", "student")
        .eq("message", studentReplyText)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (replyRow.error) throw replyRow.error
      if (replyRow.data) {
        persistedReply = replyRow.data
        break
      }

      await wait(1000)
    }

    assert(persistedReply, "ALU-013: resposta do aluno nao persistiu no backend")
    evidence["ALU-013"] = `resposta do aluno persistida como mensagem ${persistedReply.id}`

    await logout(page, baseUrl)

    console.log("ALU452_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("ALU452_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

    const ticketIds = [seededTicketAId, seededTicketBId, createdTicketId].filter(Boolean)
    if (ticketIds.length > 0) {
      await admin.from("support_tickets").delete().in("id", ticketIds)
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
  console.error("ALU452_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
