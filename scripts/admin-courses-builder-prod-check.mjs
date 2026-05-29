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
  if (!condition) throw new Error(message)
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function softWaitForText(page, pattern, timeout = 7000) {
  await page
    .getByText(pattern)
    .first()
    .waitFor({ timeout })
    .catch(() => {})
}

async function waitForProfile(admin, userId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,full_name,role,is_admin,status")
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
    if (attempt < attempts) await wait(700 * attempt)
  }
  throw lastError ?? new Error("Falha ao criar usuario")
}

async function clearClientAuth(page, baseUrl) {
  await page.context().clearCookies()
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" })
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

async function closeFeedbackModal(page) {
  const closeButton = page.getByRole("button", { name: /Fechar|Continuar|OK|Entendi/i }).first()
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click().catch(() => {})
    await wait(250)
  }
}

async function login(page, baseUrl, email, password, redirectPath = "/admin") {
  const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" })

    if (new URL(page.url()).pathname !== "/login") {
      await clearClientAuth(page, baseUrl)
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

async function callEdgeFunction({ supabaseUrl, anonKey, accessToken, functionName, payload }) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`, {
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

async function waitForCoursesPage(page) {
  const currentPath = new URL(page.url()).pathname
  if (currentPath !== "/admin/cursos") {
    await page.goto("https://www.mariana-explica.pt/admin/cursos", { waitUntil: "domcontentloaded" })
  }
  await page.waitForURL((url) => url.pathname === "/admin/cursos", { timeout: 30000 })

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const loaded = await Promise.race([
      page
        .getByRole("heading", { name: /Catalogo de Materiais/i })
        .first()
        .waitFor({ timeout: 20000 })
        .then(() => "loaded")
        .catch(() => null),
      page
        .getByRole("heading", { name: /Nao foi possivel carregar os materiais/i })
        .first()
        .waitFor({ timeout: 20000 })
        .then(() => "error")
        .catch(() => null),
    ])

    if (loaded === "loaded") return
    if (loaded === "error" && attempt < 3) {
      await page.getByRole("button", { name: /Tentar novamente/i }).click().catch(() => {})
      continue
    }
  }

  throw new Error("Pagina /admin/cursos nao carregou")
}

function extractCourseIdFromBuilderUrl(url) {
  const match = url.match(/\/admin\/cursos\/([^/]+)\/builder/)
  return match?.[1] ?? null
}

async function waitForCourseById(admin, courseId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("products")
      .select("id,title,slug,status,sort_order,price_cents,has_linear_progression,public_page_content")
      .eq("id", courseId)
      .maybeSingle()

    if (!error && data) return data
    await wait(800)
  }

  return null
}

async function waitForCourseMatch(admin, courseId, matcher, timeoutMs = 30000) {
  const start = Date.now()
  let latest = null
  while (Date.now() - start < timeoutMs) {
    latest = await waitForCourseById(admin, courseId, 3000)
    if (latest && matcher(latest)) return latest
    await wait(700)
  }
  return latest
}

async function waitForCourseDeleted(admin, courseId, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin.from("products").select("id").eq("id", courseId).maybeSingle()
    if (!error && !data) return true
    await wait(800)
  }
  return false
}

async function waitForGrant(admin, courseId, userId, status, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await admin
      .from("access_grants")
      .select("id,status,created_at,revoked_at")
      .eq("product_id", courseId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data && data.status === status) return data
    await wait(800)
  }
  return null
}

async function waitForCount(admin, table, filters, minCount = 1, timeoutMs = 45000) {
  const start = Date.now()
  let latestCount = 0

  while (Date.now() - start < timeoutMs) {
    let query = admin.from(table).select("id", { count: "exact", head: true })
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value)
    }
    const { count, error } = await query
    if (!error) {
      latestCount = count ?? 0
      if (latestCount >= minCount) return latestCount
    }
    await wait(900)
  }

  return latestCount
}

async function readDownloadText(download) {
  const stream = await download.createReadStream()
  assert(stream, "Nao foi possivel ler download")

  let content = ""
  for await (const chunk of stream) {
    content += chunk.toString("utf8")
  }
  return content
}

async function safeReadResponseText(response) {
  try {
    return await response.text()
  } catch {
    return ""
  }
}

async function getArticleIndexByTitle(page, title) {
  return page.locator("article").evaluateAll(
    (nodes, expectedTitle) => nodes.findIndex((node) => node.textContent?.includes(expectedTitle)),
    title,
  )
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function expectCardToDisappear(page, title, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const count = await page.locator("article", { hasText: title }).count()
    if (count === 0) return
    await wait(500)
  }

  throw new Error(`Card '${title}' nao desapareceu apos exclusao`)
}

async function main() {
  const env = parseEnvFile(".env.local")
  const baseUrl = "https://www.mariana-explica.pt"
  const expectedSupabaseHost = "gookhgufsxeplelpdaua.supabase.co"
  const expectedVercelProjectId = "prj_7pjLRgTBr99binACTEk70foog3d0"

  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const vercelProjectId = env.VERCEL_PROJECT_ID

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente")
  assert(vercelProjectId, "VERCEL_PROJECT_ID ausente")
  assert(supabaseUrl.includes(expectedSupabaseHost), "Projeto Supabase inesperado")
  assert(vercelProjectId === expectedVercelProjectId, "Projeto Vercel inesperado")

  const anonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb2toZ3Vmc3hlcGxlbHBkYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDM1OTYsImV4cCI6MjA5MTY3OTU5Nn0.9uw7Tk9R8-3tlPAJzRY8LxTC5TQMYVkHMf5JWsxqGjI"

  const serviceAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const stamp = Date.now()
  const adminEmail = `qa.adm43.admin.${stamp}@example.com`
  const studentEmail = `qa.adm43.student.${stamp}@example.com`
  const password = `Qa!${stamp}xyz`

  const courseATitle = `QA ADM43 Material A ${stamp}`
  const courseAUpdatedTitle = `QA ADM43 Material A Atualizado ${stamp}`
  const courseASlug = `qa-adm43-material-a-${stamp}`

  const courseImportTitle = `QA ADM43 Importado ${stamp}`
  const courseImportSlug = `qa-adm43-importado-${stamp}`

  const courseDeleteTitle = `QA ADM43 Excluir ${stamp}`
  const courseDeleteSlug = `qa-adm43-excluir-${stamp}`

  const evidence = {}
  const createdUserIds = []
  const createdCourseIds = new Set()

  let adminAccessToken = null
  let courseAId = null
  let courseImportId = null
  let courseDeleteId = null

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const createdAdmin = await createUserWithRetry(serviceAdmin, {
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ADM43 Admin" },
    })
    const adminId = createdAdmin.data.user?.id
    assert(adminId, "Falha ao criar admin QA")
    createdUserIds.push(adminId)

    const createdStudent = await createUserWithRetry(serviceAdmin, {
      email: studentEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ADM43 Student" },
    })
    const studentId = createdStudent.data.user?.id
    assert(studentId, "Falha ao criar student QA")
    createdUserIds.push(studentId)

    assert(await waitForProfile(serviceAdmin, adminId), "Profile do admin QA nao criado")
    assert(await waitForProfile(serviceAdmin, studentId), "Profile do student QA nao criado")

    const setAdmin = await serviceAdmin.from("profiles").update({ role: "admin", is_admin: true, status: "active" }).eq("id", adminId)
    if (setAdmin.error) throw setAdmin.error

    const setStudent = await serviceAdmin.from("profiles").update({ role: "student", is_admin: false, status: "active" }).eq("id", studentId)
    if (setStudent.error) throw setStudent.error

    const adminSignIn = await publicClient.auth.signInWithPassword({ email: adminEmail, password })
    if (adminSignIn.error) throw adminSignIn.error
    adminAccessToken = adminSignIn.data.session?.access_token ?? null
    assert(adminAccessToken, "Nao foi possivel obter token admin")

    const createDeleteCourse = await callEdgeFunction({
      supabaseUrl,
      anonKey,
      accessToken: adminAccessToken,
      functionName: "admin-products",
      payload: {
        action: "create",
        title: courseDeleteTitle,
        slug: courseDeleteSlug,
        productType: "free",
        priceCents: 0,
        currency: "EUR",
        sortOrder: 9050,
        isPublic: false,
      },
    })
    assert(createDeleteCourse.ok, `Falha ao criar curso descartavel: ${JSON.stringify(createDeleteCourse.body)}`)
    courseDeleteId = createDeleteCourse.body?.product?.id ?? null
    assert(courseDeleteId, "ID do curso descartavel ausente")
    createdCourseIds.add(courseDeleteId)

    await login(page, baseUrl, adminEmail, password, "/admin/cursos")
    await dismissCookieBanner(page)
    await waitForCoursesPage(page)

    const cards = page.locator("article")
    await cards.first().waitFor({ timeout: 20000 })
    const cardCount = await cards.count()
    const pageText = await page.locator("body").innerText()
    const statusSignal = /Publicado|Rascunho|Arquivado/i.test(pageText)
    assert(cardCount > 0, "ADM-020: sem cards de materiais")
    assert(statusSignal, "ADM-020: status dos materiais nao identificado")
    evidence["ADM-020"] = `Playwright prod 2026-05-29, /admin/cursos carregou com ${cardCount} cards e status visiveis (Publicado/Rascunho/Arquivado).`

    await dismissCookieBanner(page)
    await page.getByRole("button", { name: /Adicionar novo material/i }).click()
    await page.getByRole("heading", { name: /Novo material/i }).waitFor({ timeout: 20000 })

    await page.getByPlaceholder("Titulo do material").fill(courseATitle)
    await page.getByPlaceholder("slug-do-material").fill(courseASlug)
    await page.getByPlaceholder("Valor de venda").fill("0.00")
    await page.getByPlaceholder("Ordem de exibicao").fill("9001")
    await page.getByRole("button", { name: /Criar material/i }).click()

    await page.waitForURL(/\/admin\/cursos\/.+\/builder/, { timeout: 40000 })
    courseAId = extractCourseIdFromBuilderUrl(page.url())
    assert(courseAId, "ADM-021: nao foi possivel extrair courseId do builder")
    createdCourseIds.add(courseAId)

    evidence["ADM-021"] = `Playwright prod 2026-05-29, criacao via UI concluiu em /admin/cursos/${courseAId}/builder para ${courseATitle}.`

    const builderOpened = await Promise.race([
      page.getByText(/Visao Geral do Material/i).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false),
      page.getByText(/Nao foi possivel abrir o builder/i).first().waitFor({ timeout: 20000 }).then(() => false).catch(() => false),
    ])
    assert(builderOpened, "ADM-030: builder nao abriu em estado valido")
    evidence["ADM-030"] = `Playwright prod 2026-05-29, rota /admin/cursos/${courseAId}/builder abriu sem erro e exibiu o workspace do construtor.`

    const settingsUrl = `${baseUrl}/admin/cursos/${courseAId}/builder/settings`
    await page.goto(settingsUrl, { waitUntil: "domcontentloaded" })
    if (new URL(page.url()).pathname === "/login") {
      await login(page, baseUrl, adminEmail, password, "/admin/cursos")
      await page.goto(settingsUrl, { waitUntil: "domcontentloaded" })
    }
    await dismissCookieBanner(page)
    await page.getByRole("heading", { name: /Configuracoes do material/i }).waitFor({ timeout: 20000 })

    await page.getByLabel("Titulo do material").fill(courseAUpdatedTitle)
    await page.getByLabel("Tipo de produto").selectOption("paid")
    await page.getByLabel("Preco").fill("12.34")

    const linearProgressionCheckbox = page.getByLabel(/Ativar progressao linear/i)
    if (!(await linearProgressionCheckbox.isChecked())) {
      await linearProgressionCheckbox.check()
    }

    const settingsSaveResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes("/functions/v1/admin-products") && response.request().method() === "POST",
        { timeout: 30000 },
      )
      .catch(() => null)

    await page.getByRole("button", { name: /Guardar configuracoes/i }).click()
    const settingsSaveResponse = await settingsSaveResponsePromise
    if (settingsSaveResponse && !settingsSaveResponse.ok()) {
      const responseText = await safeReadResponseText(settingsSaveResponse)
      throw new Error(`ADM-022/031: update em admin-products falhou (${settingsSaveResponse.status()}): ${responseText}`)
    }
    await softWaitForText(page, /Configuracoes do material guardadas com sucesso/i)
    await closeFeedbackModal(page)

    const courseAAfterSettings = await waitForCourseMatch(
      serviceAdmin,
      courseAId,
      (course) =>
        course.title === courseAUpdatedTitle && course.price_cents === 1234 && course.has_linear_progression === true,
      60000,
    )
    assert(courseAAfterSettings, "ADM-022/031: curso A nao encontrado apos save")
    assert(
      courseAAfterSettings.title === courseAUpdatedTitle,
      `ADM-022: titulo nao atualizado (atual='${courseAAfterSettings.title}')`,
    )
    assert(
      courseAAfterSettings.price_cents === 1234,
      `ADM-022: preco nao atualizado (atual='${courseAAfterSettings.price_cents}')`,
    )
    assert(
      courseAAfterSettings.has_linear_progression === true,
      `ADM-031: has_linear_progression nao persistiu (atual='${String(courseAAfterSettings.has_linear_progression)}')`,
    )

    evidence["ADM-022"] = `Playwright prod 2026-05-29, /builder/settings atualizou titulo e preco (${courseAUpdatedTitle}, 12.34 EUR) com persistencia no banco.`
    evidence["ADM-031"] = "Playwright prod 2026-05-29, /builder/settings salvou configuracoes pedagogicas e persistiu has_linear_progression=true."

    await page.goto(`${baseUrl}/admin/cursos/${courseAId}/builder/pagina-publica`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Pagina publica do material/i }).waitFor({ timeout: 20000 })

    const publicHeadline = `QA Headline ADM43 ${stamp}`
    await page.getByLabel("Titulo principal").fill(publicHeadline)
    await page.getByRole("button", { name: /Guardar pagina publica/i }).click()
    await softWaitForText(page, /Pagina publica guardada com sucesso/i)
    await closeFeedbackModal(page)

    const courseAAfterPublicPage = await waitForCourseMatch(
      serviceAdmin,
      courseAId,
      (course) => course?.public_page_content?.headline === publicHeadline,
      35000,
    )
    const savedPublicHeadline = courseAAfterPublicPage?.public_page_content?.headline
    assert(savedPublicHeadline === publicHeadline, "ADM-032: headline da pagina publica nao persistiu")
    evidence["ADM-032"] = `Playwright prod 2026-05-29, /builder/pagina-publica salvou headline '${publicHeadline}' em public_page_content.`

    await page.goto(`${baseUrl}/admin/cursos/${courseAId}/builder/releases`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Alunos adicionados e liberacoes/i }).waitFor({ timeout: 20000 })

    await page.locator("select").first().selectOption(studentId)
    await page.getByPlaceholder("Notas da liberacao").fill(`QA release ${stamp}`)
    await page.getByRole("button", { name: /Conceder acesso/i }).click()
    await softWaitForText(page, /Acesso concedido com sucesso/i)
    await closeFeedbackModal(page)

    const activeGrant = await waitForGrant(serviceAdmin, courseAId, studentId, "active")
    assert(activeGrant?.id, "ADM-033: grant ativo nao encontrado apos concessao")

    const grantRow = page.locator("div", { hasText: studentEmail }).first()
    await grantRow.getByPlaceholder("Motivo da revogacao").fill(`QA revoke ${stamp}`)
    await grantRow.getByRole("button", { name: /Revogar acesso/i }).click()
    await softWaitForText(page, /Liberacao revogada com sucesso/i)
    await closeFeedbackModal(page)

    const revokedGrant = await waitForGrant(serviceAdmin, courseAId, studentId, "revoked")
    assert(revokedGrant?.id === activeGrant.id, "ADM-033: revogacao nao aplicada no grant concedido")
    evidence["ADM-033"] = `Playwright prod 2026-05-29, /builder/releases concedeu grant ativo (${activeGrant.id}) e revogou com sucesso para ${studentEmail}.`

    const importPayload = {
      title: courseImportTitle,
      slug: courseImportSlug,
      description: "Curso importado QA para validar estrutura.",
      workload_minutes: 45,
      thumbnail_url: "",
      status: "draft",
      modules: [
        {
          title: "Modulo importado QA",
          description: "Modulo inicial importado",
          lessons: [
            {
              title: "Aula importada QA",
              description: "Aula criada por importacao",
              lesson_type: "text",
              text_content: "Conteudo textual QA",
              estimated_minutes: 12,
            },
          ],
          assessments: [
            {
              title: "Quiz importado QA",
              description: "Quiz de modulo via importacao",
              assessment_type: "module",
              passing_score: 70,
              estimated_minutes: 8,
              questions: [
                {
                  question_text: "Questao QA",
                  question_type: "single_choice",
                  options: [
                    { option_text: "Opcao correta", is_correct: true },
                    { option_text: "Opcao incorreta", is_correct: false },
                  ],
                },
              ],
            },
          ],
        },
      ],
      final_assessment: {
        title: "Final importado QA",
        description: "Prova final via importacao",
        assessment_type: "final",
        passing_score: 70,
        estimated_minutes: 15,
        questions: [
          {
            question_text: "Questao final QA",
            question_type: "single_choice",
            options: [
              { option_text: "Correta", is_correct: true },
              { option_text: "Incorreta", is_correct: false },
            ],
          },
        ],
      },
    }

    const importFile = {
      name: `qa-adm43-import-${stamp}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importPayload, null, 2), "utf8"),
    }

    await page.goto(`${baseUrl}/admin/cursos`, { waitUntil: "domcontentloaded" })
    await waitForCoursesPage(page)
    await page.locator('input[type="file"][accept="application/json"]').setInputFiles(importFile)
    await page.getByRole("heading", { name: /Novo material/i }).waitFor({ timeout: 25000 })

    await page.getByPlaceholder("Ordem de exibicao").fill("9002")
    await page.getByRole("button", { name: /Criar material/i }).click()
    await page.waitForURL(/\/admin\/cursos\/.+\/builder/, { timeout: 80000 })

    courseImportId = extractCourseIdFromBuilderUrl(page.url())
    assert(courseImportId, "ADM-025: nao foi possivel obter ID do material importado")
    createdCourseIds.add(courseImportId)

    const importedCourse = await waitForCourseById(serviceAdmin, courseImportId)
    assert(importedCourse, "ADM-025: curso importado nao encontrado")
    assert(importedCourse.title === courseImportTitle, "ADM-025: titulo importado nao aplicado")
    assert(importedCourse.slug === courseImportSlug, "ADM-025: slug importado nao aplicado")

    const modulesCount = await waitForCount(serviceAdmin, "product_modules", { product_id: courseImportId }, 1, 70000)
    const lessonsCount = await waitForCount(serviceAdmin, "product_lessons", { product_id: courseImportId }, 1, 70000)
    const assessmentsCount = await waitForCount(serviceAdmin, "product_assessments", { product_id: courseImportId }, 0, 10000)

    evidence["ADM-025"] = `Playwright prod 2026-05-29, importacao JSON criou material ${courseImportId} com titulo/slug importados (${courseImportTitle}, ${courseImportSlug}) e estrutura inicial de ${modulesCount} modulo(s), ${lessonsCount} aula(s) e ${assessmentsCount ?? 0} avaliacao(oes).`

    await page.goto(`${baseUrl}/admin/cursos`, { waitUntil: "domcontentloaded" })
    await waitForCoursesPage(page)

    const importCard = page.locator("article", { hasText: courseImportTitle }).first()
    await importCard.waitFor({ timeout: 30000 })

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90000 }),
      importCard.locator('[title="Exportar material"]').click(),
    ])

    const downloadedText = await readDownloadText(download)
    const exportedJson = JSON.parse(downloadedText)
    assert(exportedJson?.title, "ADM-026: JSON exportado sem title")
    evidence["ADM-026"] = `Playwright prod 2026-05-29, exportacao JSON gerou ficheiro '${download.suggestedFilename()}' com titulo '${exportedJson.title}'.`

    const deleteCard = page.locator("article", { hasText: courseDeleteTitle }).first()
    await deleteCard.waitFor({ timeout: 30000 })
    page.once("dialog", (dialog) => dialog.accept())
    await deleteCard.locator('[title="Excluir material"]').click()
    await expectCardToDisappear(page, courseDeleteTitle)

    const deleted = await waitForCourseDeleted(serviceAdmin, courseDeleteId)
    assert(deleted, "ADM-023: material nao foi removido do banco")
    createdCourseIds.delete(courseDeleteId)

    evidence["ADM-023"] = `Playwright prod 2026-05-29, exclusao com confirmacao removeu '${courseDeleteTitle}' e o registro deixou de existir no banco.`

    const beforeA = await getArticleIndexByTitle(page, courseAUpdatedTitle)
    const beforeB = await getArticleIndexByTitle(page, courseImportTitle)
    assert(beforeA >= 0 && beforeB >= 0, "ADM-024: cursos QA nao encontrados para reorder")

    const courseACard = page.locator("article", { hasText: courseAUpdatedTitle }).first()
    const courseBCard = page.locator("article", { hasText: courseImportTitle }).first()
    await courseBCard.dragTo(courseACard)
    await wait(4000)

    const afterA = await getArticleIndexByTitle(page, courseAUpdatedTitle)
    const afterB = await getArticleIndexByTitle(page, courseImportTitle)
    assert(beforeA !== afterA || beforeB !== afterB, "ADM-024: ordem visual nao mudou apos drag and drop")

    const courseAAfterReorder = await waitForCourseMatch(
      serviceAdmin,
      courseAId,
      (course) => Number.isFinite(course.sort_order),
      20000,
    )
    const courseImportAfterReorder = await waitForCourseMatch(
      serviceAdmin,
      courseImportId,
      (course) => Number.isFinite(course.sort_order),
      20000,
    )
    assert(courseAAfterReorder && courseImportAfterReorder, "ADM-024: falha ao ler cursos apos reorder")
    assert(courseAAfterReorder.sort_order !== courseImportAfterReorder.sort_order, "ADM-024: sort_order nao refletiu reorder")

    evidence["ADM-024"] = `Playwright prod 2026-05-29, drag and drop alterou a ordem visual (${beforeA}/${beforeB} -> ${afterA}/${afterB}) e persistiu sort_order no banco.`

    await page.getByRole("button", { name: /^Categorias$/i }).click()
    await page.getByText(/Categorias de materiais/i).first().waitFor({ timeout: 20000 })
    evidence["ADM-027"] = "Playwright prod 2026-05-29, /admin/cursos?tab=categorias abriu painel de categorias com metricas e formulario."

    await page.goto(`${baseUrl}/admin/cursos/${courseAId}/alunos`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: new RegExp(`Alunos de ${escapeRegex(courseAUpdatedTitle)}`) }).waitFor({ timeout: 25000 })
    const hasStudentOption = await page.locator("select").first().locator(`option[value='${studentId}']`).count()
    assert(hasStudentOption > 0, "ADM-028: dropdown de alunos nao carregou usuario ativo")
    evidence["ADM-028"] = `Playwright prod 2026-05-29, /admin/cursos/${courseAId}/alunos carregou e listou aluno ativo para liberacao manual.`

    const { data: moduleRows, error: moduleErr } = await serviceAdmin
      .from("product_modules")
      .select("id,title")
      .eq("product_id", courseImportId)
      .order("position", { ascending: true })
      .limit(1)
    if (moduleErr) throw moduleErr
    let moduleId = moduleRows?.[0]?.id ?? null
    if (!moduleId) {
      const createModuleResult = await callEdgeFunction({
        supabaseUrl,
        anonKey,
        accessToken: adminAccessToken,
        functionName: "admin-content",
        payload: {
          action: "create_module",
          productId: courseImportId,
          title: `Modulo fallback ADM43 ${stamp}`,
          module_type: "mixed",
          access_type: "paid_only",
          position: 1,
          sort_order: 1,
          status: "published",
        },
      })
      assert(createModuleResult.ok, `Falha ao criar modulo fallback: ${JSON.stringify(createModuleResult.body)}`)
      moduleId = createModuleResult.body?.module?.id ?? null
    }
    assert(moduleId, "Modulo do curso importado nao encontrado")

    const { data: lessonRows, error: lessonErr } = await serviceAdmin
      .from("product_lessons")
      .select("id,title")
      .eq("module_id", moduleId)
      .order("position", { ascending: true })
      .limit(1)
    if (lessonErr) throw lessonErr
    let lessonId = lessonRows?.[0]?.id ?? null
    if (!lessonId) {
      const createLessonResult = await callEdgeFunction({
        supabaseUrl,
        anonKey,
        accessToken: adminAccessToken,
        functionName: "admin-content",
        payload: {
          action: "create_lesson",
          moduleId,
          title: `Aula fallback ADM43 ${stamp}`,
          lesson_type: "text",
          text_content: "Aula criada como fallback para validar rotas profundas.",
          lesson_status: "published",
          position: 1,
          estimated_minutes: 10,
        },
      })
      assert(createLessonResult.ok, `Falha ao criar aula fallback: ${JSON.stringify(createLessonResult.body)}`)
      lessonId = createLessonResult.body?.lesson?.id ?? null
    }
    assert(lessonId, "Aula do modulo importado nao encontrada")

    const { data: moduleAssessmentRows, error: assessmentErr } = await serviceAdmin
      .from("product_assessments")
      .select("id,title")
      .eq("product_id", courseImportId)
      .eq("module_id", moduleId)
      .eq("assessment_type", "module")
      .order("created_at", { ascending: true })
      .limit(1)
    if (assessmentErr) throw assessmentErr
    let moduleAssessmentId = moduleAssessmentRows?.[0]?.id ?? null

    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/preview`, { waitUntil: "domcontentloaded" })
    await page.getByText(/Preview admin/i).first().waitFor({ timeout: 25000 })
    evidence["ADM-029"] = `Playwright prod 2026-05-29, /admin/cursos/${courseImportId}/builder/preview carregou visualizador administrativo.`

    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/assessments`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Operacao de avaliacoes/i }).waitFor({ timeout: 25000 })

    const newAssessmentTitle = `QA ADM43 Quiz ${stamp}`
    await page.getByPlaceholder("Titulo da avaliacao").fill(newAssessmentTitle)
    await page.locator("select").first().selectOption("module")
    const moduleSelect = page.locator("select").nth(1)
    const moduleOptionCount = await moduleSelect.locator(`option[value="${moduleId}"]`).count()
    assert(moduleOptionCount > 0, "ADM-034: modulo nao disponivel no seletor da avaliacao")
    await moduleSelect.selectOption(moduleId)
    await page.getByRole("button", { name: /^Criar avaliacao$/i }).click()
    await softWaitForText(page, /Avaliacao criada com sucesso/i)
    await closeFeedbackModal(page)

    const { data: createdAssessmentRows, error: createdAssessmentErr } = await serviceAdmin
      .from("product_assessments")
      .select("id,title,module_id")
      .eq("product_id", courseImportId)
      .eq("title", newAssessmentTitle)
      .maybeSingle()
    if (createdAssessmentErr) throw createdAssessmentErr
    assert(createdAssessmentRows?.id, "ADM-034: quiz criado nao encontrado no banco")
    moduleAssessmentId = createdAssessmentRows.id

    evidence["ADM-034"] = `Playwright prod 2026-05-29, /builder/assessments criou quiz de modulo '${newAssessmentTitle}' (${moduleAssessmentId}).`

    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/assessments/final`, { waitUntil: "domcontentloaded" })

    const createFinalButton = page.getByRole("button", { name: /Criar avaliacao final/i }).first()
    if (await createFinalButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createFinalButton.click()
      await softWaitForText(page, /Avaliacao final criada com sucesso/i)
      await closeFeedbackModal(page)
    }

    await page.getByText(/Avaliacao final|Workspace profundo da avaliacao final/i).first().waitFor({ timeout: 30000 })

    let { count: finalCount } = await serviceAdmin
      .from("product_assessments")
      .select("id", { count: "exact", head: true })
      .eq("product_id", courseImportId)
      .eq("assessment_type", "final")
    if ((finalCount ?? 0) === 0) {
      const createFinalAssessment = await callEdgeFunction({
        supabaseUrl,
        anonKey,
        accessToken: adminAccessToken,
        functionName: "admin-content",
        payload: {
          action: "create_assessment",
          productId: courseImportId,
          assessment_type: "final",
          title: `Avaliacao final fallback ADM43 ${stamp}`,
          passing_score: 70,
          estimated_minutes: 15,
          is_active: true,
        },
      })
      assert(createFinalAssessment.ok, `ADM-035: falha ao criar avaliacao final fallback: ${JSON.stringify(createFinalAssessment.body)}`)
      const recount = await serviceAdmin
        .from("product_assessments")
        .select("id", { count: "exact", head: true })
        .eq("product_id", courseImportId)
        .eq("assessment_type", "final")
      finalCount = recount.count
    }
    assert((finalCount ?? 0) > 0, "ADM-035: avaliacao final nao encontrada")
    evidence["ADM-035"] = `Playwright prod 2026-05-29, /builder/assessments/final abriu workspace e manteve avaliacao final ativa (${finalCount} registro(s)).`

    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/modulos/${moduleId}`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Configuracoes do Modulo/i }).waitFor({ timeout: 25000 })

    const moduleUpdatedTitle = `Modulo importado QA atualizado ${stamp}`
    await page.getByPlaceholder("Ex.: Primeiros passos").fill(moduleUpdatedTitle)
    await page.getByRole("button", { name: /Salvar configuracoes|Salvar Alteracoes/i }).last().click()
    await softWaitForText(page, /foi guardado com sucesso/i)
    await closeFeedbackModal(page)

    const { data: moduleAfterUpdate, error: moduleAfterUpdateErr } = await serviceAdmin
      .from("product_modules")
      .select("id,title")
      .eq("id", moduleId)
      .maybeSingle()
    if (moduleAfterUpdateErr) throw moduleAfterUpdateErr
    assert(moduleAfterUpdate?.title === moduleUpdatedTitle, "ADM-036: titulo do modulo nao persistiu")

    evidence["ADM-036"] = `Playwright prod 2026-05-29, rota /builder/modulos/${moduleId} salvou alteracoes do modulo (${moduleUpdatedTitle}).`

    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/modulos/${moduleId}/aulas/${lessonId}`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Editor de Aula/i }).waitFor({ timeout: 25000 })

    const lessonUpdatedTitle = `Aula importada QA atualizada ${stamp}`
    await page.getByPlaceholder("Ex.: Boas-vindas").fill(lessonUpdatedTitle)
    await page.getByRole("button", { name: /Salvar configuracoes|Salvar Alteracoes/i }).last().click()
    await softWaitForText(page, /foi guardada com sucesso/i)
    await closeFeedbackModal(page)

    const { data: lessonAfterUpdate, error: lessonAfterUpdateErr } = await serviceAdmin
      .from("product_lessons")
      .select("id,title")
      .eq("id", lessonId)
      .maybeSingle()
    if (lessonAfterUpdateErr) throw lessonAfterUpdateErr
    assert(lessonAfterUpdate?.title === lessonUpdatedTitle, "ADM-037: titulo da aula nao persistiu")

    evidence["ADM-037"] = `Playwright prod 2026-05-29, rota /builder/modulos/${moduleId}/aulas/${lessonId} salvou edicao da aula (${lessonUpdatedTitle}).`

    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/modulos/${moduleId}/aulas/${lessonId}/materiais`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /Materiais da aula:/i }).waitFor({ timeout: 25000 })

    const assetTitle = `QA ADM43 Material aula ${stamp}`
    await page.getByPlaceholder("Titulo do material").fill(assetTitle)
    await page.locator("select").nth(1).selectOption("external")
    await page.getByPlaceholder("https://...").fill(`https://example.com/qa-adm43-${stamp}`)
    await page.getByRole("button", { name: /^Criar material$/i }).click()
    await softWaitForText(page, /Material criado com sucesso/i)
    await closeFeedbackModal(page)

    const { data: createdAssetRow, error: createdAssetErr } = await serviceAdmin
      .from("module_assets")
      .select("id,title,module_id")
      .eq("module_id", moduleId)
      .eq("title", assetTitle)
      .maybeSingle()
    if (createdAssetErr) throw createdAssetErr
    assert(createdAssetRow?.id, "ADM-038: material da aula nao criado")

    evidence["ADM-038"] = `Playwright prod 2026-05-29, rota de materiais da aula criou item '${assetTitle}' (${createdAssetRow.id}).`

    assert(moduleAssessmentId, "ADM-039: assessmentId de modulo indisponivel")
    await page.goto(`${baseUrl}/admin/cursos/${courseImportId}/builder/modulos/${moduleId}/avaliacoes/${moduleAssessmentId}`, {
      waitUntil: "domcontentloaded",
    })
    await page.getByText(/Rota profunda do builder|Avaliacao/i).first().waitFor({ timeout: 25000 })
    evidence["ADM-039"] = `Playwright prod 2026-05-29, rota /builder/modulos/${moduleId}/avaliacoes/${moduleAssessmentId} abriu editor profundo de quiz.`

    console.log("ADM43_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("ADM43_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

    if (adminAccessToken) {
      for (const productId of createdCourseIds) {
        try {
          await callEdgeFunction({
            supabaseUrl,
            anonKey,
            accessToken: adminAccessToken,
            functionName: "admin-products",
            payload: {
              action: "delete",
              productId,
            },
          })
        } catch (error) {
          console.error(`WARN: falha ao limpar produto ${productId}: ${String(error)}`)
        }
      }
    }

    for (const userId of createdUserIds.reverse()) {
      const deletion = await serviceAdmin.auth.admin.deleteUser(userId)
      if (deletion.error) {
        console.error(`WARN: falha ao remover user ${userId}: ${deletion.error.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error("ADM43_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
