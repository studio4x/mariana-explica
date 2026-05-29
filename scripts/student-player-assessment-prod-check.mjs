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
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 })
  }
}

async function dismissCookieBanner(page) {
  const acceptCookies = page.getByRole("button", { name: /aceitar cookies/i }).first()
  const isVisible = await acceptCookies.isVisible({ timeout: 2500 }).catch(() => false)
  if (isVisible) {
    await acceptCookies.click({ force: true, timeout: 2000 }).catch(() => {})
    await wait(200)
  }
}

async function assertRedirect(page, fromUrl, expectedPathname, evidenceParts, label) {
  await page.goto(fromUrl, { waitUntil: "domcontentloaded" })
  await dismissCookieBanner(page)
  await page.waitForURL((url) => url.pathname === expectedPathname, { timeout: 25000 })
  const got = new URL(page.url()).pathname
  assert(got === expectedPathname, `${label}: redirect esperado para ${expectedPathname}, obtido ${got}`)
  evidenceParts.push(`${new URL(fromUrl).pathname} -> ${got}`)
}

async function main() {
  const baseUrl = "https://www.mariana-explica.pt"
  const env = parseEnvFile(".env.local")
  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  const fallbackAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb2toZ3Vmc3hlcGxlbHBkYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDM1OTYsImV4cCI6MjA5MTY3OTU5Nn0.9uw7Tk9R8-3tlPAJzRY8LxTC5TQMYVkHMf5JWsxqGjI"

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const stamp = Date.now()
  const studentAEmail = `qa.alu33.a.${stamp}@example.com`
  const studentBEmail = `qa.alu33.b.${stamp}@example.com`
  const password = `Aa!${stamp}xyz`

  const productATitle = `QA ALU33 Course A ${stamp}`
  const productBTitle = `QA ALU33 Course B ${stamp}`
  const lessonATitle = `QA ALU33 Aula A ${stamp}`
  const lessonBTitle = `QA ALU33 Aula B ${stamp}`
  const lessonAText = `Texto de aula ALU33 ${stamp}`
  const assetATitle = `QA ALU33 Material protegido A ${stamp}`
  const assetBTitle = `QA ALU33 Material protegido B ${stamp}`
  const assessmentTitle = `QA ALU33 Quiz ${stamp}`

  let studentAId = null
  let studentBId = null
  let productAId = null
  let productBId = null
  let moduleAId = null
  let moduleBId = null
  let lessonAId = null
  let lessonBId = null
  let assessmentId = null
  let assetAId = null
  let assetBId = null

  const evidence = {}

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on("pageerror", (error) => {
    pageErrors.push(String(error))
  })
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  try {
    const studentA = await admin.auth.admin.createUser({
      email: studentAEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ALU33 Student A" },
    })
    if (studentA.error) throw studentA.error
    studentAId = studentA.data.user?.id ?? null
    assert(studentAId, "Falha ao criar usuario student A")

    const studentB = await admin.auth.admin.createUser({
      email: studentBEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA ALU33 Student B" },
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
          slug: `qa-alu33-course-a-${stamp}`,
          title: productATitle,
          short_description: "Produto teste ALU33 A",
          description: "Produto teste ALU33 A",
          product_type: "paid",
          status: "published",
          price_cents: 1900,
          currency: "EUR",
          is_public: false,
          workload_minutes: 40,
          has_linear_progression: false,
        },
        {
          slug: `qa-alu33-course-b-${stamp}`,
          title: productBTitle,
          short_description: "Produto teste ALU33 B",
          description: "Produto teste ALU33 B",
          product_type: "paid",
          status: "published",
          price_cents: 2500,
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

    const lessonsInsert = await admin
      .from("product_lessons")
      .insert([
        {
          module_id: moduleAId,
          title: lessonATitle,
          description: "Descricao da aula A",
          position: 1,
          is_required: true,
          lesson_type: "text",
          text_content: lessonAText,
          estimated_minutes: 12,
          status: "published",
        },
        {
          module_id: moduleBId,
          title: lessonBTitle,
          description: "Descricao da aula B",
          position: 1,
          is_required: true,
          lesson_type: "text",
          text_content: `Texto B ${stamp}`,
          estimated_minutes: 10,
          status: "published",
        },
      ])
      .select("id,title")

    if (lessonsInsert.error) throw lessonsInsert.error
    const insertedLessons = lessonsInsert.data ?? []
    lessonAId = insertedLessons.find((item) => item.title === lessonATitle)?.id ?? null
    lessonBId = insertedLessons.find((item) => item.title === lessonBTitle)?.id ?? null
    assert(lessonAId && lessonBId, "Falha ao criar aulas de teste")

    const assessmentInsert = await admin
      .from("product_assessments")
      .insert({
        product_id: productAId,
        module_id: moduleAId,
        assessment_type: "module",
        title: assessmentTitle,
        description: "Quiz de teste ALU33",
        is_required: true,
        passing_score: 70,
        max_attempts: 1,
        estimated_minutes: 10,
        is_active: true,
        builder_payload: {
          questions: [
            {
              id: "q1",
              prompt: "Qual alternativa esta correta?",
              type: "single_choice",
              options: [
                { id: "opt_a", label: "Resposta correta", is_correct: true },
                { id: "opt_b", label: "Resposta incorreta", is_correct: false },
              ],
            },
          ],
        },
      })
      .select("id")
      .single()

    if (assessmentInsert.error) throw assessmentInsert.error
    assessmentId = assessmentInsert.data?.id ?? null
    assert(assessmentId, "Falha ao criar avaliacao de teste")

    const assetsInsert = await admin
      .from("module_assets")
      .insert([
        {
          module_id: moduleAId,
          asset_type: "external_link",
          title: assetATitle,
          external_url: "https://example.com/qa-alu33-asset-a",
          allow_download: true,
          allow_stream: true,
          watermark_enabled: false,
          status: "active",
          sort_order: 1,
        },
        {
          module_id: moduleBId,
          asset_type: "external_link",
          title: assetBTitle,
          external_url: "https://example.com/qa-alu33-asset-b",
          allow_download: true,
          allow_stream: true,
          watermark_enabled: false,
          status: "active",
          sort_order: 1,
        },
      ])
      .select("id,title")

    if (assetsInsert.error) throw assetsInsert.error
    const insertedAssets = assetsInsert.data ?? []
    assetAId = insertedAssets.find((item) => item.title === assetATitle)?.id ?? null
    assetBId = insertedAssets.find((item) => item.title === assetBTitle)?.id ?? null
    assert(assetAId && assetBId, "Falha ao criar assets de teste")

    const grantsInsert = await admin
      .from("access_grants")
      .insert([
        {
          user_id: studentAId,
          product_id: productAId,
          source_type: "admin_grant",
          status: "active",
          granted_at: new Date().toISOString(),
        },
        {
          user_id: studentBId,
          product_id: productBId,
          source_type: "admin_grant",
          status: "active",
          granted_at: new Date().toISOString(),
        },
      ])

    if (grantsInsert.error) throw grantsInsert.error

    await login(page, baseUrl, studentAEmail, password, `/aluno/cursos/${productAId}/player`)
    await page.waitForURL((url) => url.pathname.startsWith("/aluno"), { timeout: 30000 })
    await dismissCookieBanner(page)

    await page.goto(`${baseUrl}/aluno/cursos/${productAId}/player`, { waitUntil: "domcontentloaded" })
    await dismissCookieBanner(page)
    await page.waitForURL((url) => url.pathname === `/aluno/cursos/${productAId}/player/aulas/${lessonAId}`, {
      timeout: 30000,
    })
    await page.getByRole("heading", { name: lessonATitle }).waitFor({ timeout: 20000 })
    evidence["ALU-020"] = `player abriu em /aluno/cursos/${productAId}/player e redirecionou para /aulas/${lessonAId} sem erro`

    const lessonTextAllowed = await page.locator("body").innerText()
    assert(lessonTextAllowed.includes(lessonAText), "ALU-021: aula liberada nao exibiu conteudo esperado")

    await page.goto(`${baseUrl}/aluno/cursos/${productBId}/player/aulas/${lessonBId}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || ""
        return text.includes("Material indisponivel") || text.includes("Nao foi possivel abrir o player")
      },
      { timeout: 25000 },
    )
    const lessonTextForbidden = await page.locator("body").innerText()
    assert(!lessonTextForbidden.includes(lessonBTitle), "ALU-021: aula de curso sem grant vazou conteudo")
    evidence["ALU-021"] = `aula com grant carregou conteudo e rota sem grant (/aluno/cursos/${productBId}/player/aulas/${lessonBId}) ficou bloqueada`

    await page.goto(`${baseUrl}/aluno/cursos/${productAId}/player/aulas/${lessonAId}`, {
      waitUntil: "domcontentloaded",
    })
    await dismissCookieBanner(page)
    await page.getByRole("heading", { name: lessonATitle }).waitFor({ timeout: 20000 })

    const assetTitleNode = page.getByText(assetATitle, { exact: true }).first()
    await assetTitleNode.waitFor({ state: "visible", timeout: 20000 })
    const assetCard = assetTitleNode.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/functions/v1/generate-asset-access") &&
        [200, 400, 401, 403, 500].includes(response.status()),
      { timeout: 20000 },
    )
    await assetCard.getByRole("button", { name: /abrir|aceder|download|ver/i }).first().click({ force: true })
    const protectedAssetResponse = await responsePromise
    assert(
      protectedAssetResponse.status() === 200,
      `ALU-022: generate-asset-access retornou status ${protectedAssetResponse.status()} para asset liberado`,
    )

    const studentClient = createClient(supabaseUrl, fallbackAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const signInStudentA = await studentClient.auth.signInWithPassword({
      email: studentAEmail,
      password,
    })
    if (signInStudentA.error) throw signInStudentA.error

    const forbiddenInvoke = await studentClient.functions.invoke("generate-asset-access", {
      body: { assetId: assetBId },
    })

    assert(Boolean(forbiddenInvoke.error), "ALU-022: backend liberou material protegido de curso sem grant")
    evidence["ALU-022"] = `material protegido usou generate-asset-access (200) e backend negou asset sem grant (${assetBId})`

    await page.goto(`${baseUrl}/aluno/cursos/${productAId}/player/avaliacoes/${assessmentId}`, {
      waitUntil: "domcontentloaded",
    })
    await dismissCookieBanner(page)
    const assessmentNetwork = []
    const networkListener = (response) => {
      const url = response.url()
      if (url.includes("/product_assessments") || url.includes("/functions/v1/student-assessment-attempts")) {
        assessmentNetwork.push(`${response.status()} ${url}`)
      }
    }
    page.on("response", networkListener)
    await page.waitForFunction(
      (title) => {
        const text = document.body?.innerText || ""
        return (
          text.includes(title) ||
          text.includes("Avaliacao nao encontrada") ||
          text.includes("Conteudo indisponivel") ||
          text.includes("Nao foi possivel abrir esta avaliacao")
        )
      },
      assessmentTitle,
      { timeout: 120000 },
    )
    const assessmentPageText = await page.locator("body").innerText()
    assert(
      assessmentPageText.includes(assessmentTitle),
      "ALU-023: pagina da avaliacao nao carregou o conteudo esperado para o aluno com grant",
    )
    try {
      await page.waitForFunction(
        () => {
          const text = document.body?.innerText || ""
          return (
            text.includes("Tentativa oficial") ||
            text.includes("Nao foi possivel abrir esta avaliacao") ||
            text.includes("Conteudo indisponivel")
          )
        },
        undefined,
        { timeout: 120000 },
      )
    } catch (error) {
      const assessmentBodySnapshot = await page.locator("body").innerText()
      throw new Error(
        `ALU-023: avaliacao nao saiu do loading. Snapshot: ${assessmentBodySnapshot.slice(0, 1200)} | Network: ${assessmentNetwork.join(" || ")} | PageErrors: ${pageErrors.join(" || ")} | ConsoleErrors: ${consoleErrors.join(" || ")}`,
      )
    } finally {
      page.off("response", networkListener)
    }
    const correctOption = page.locator("label", { hasText: "Resposta correta" }).first()
    if (await correctOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await correctOption.click({ force: true })
    }
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || ""
        return (
          text.includes("Submeter tentativa oficial") ||
          text.includes("Nao foi possivel abrir a tentativa") ||
          text.includes("Tentativa indisponivel")
        )
      },
      undefined,
      { timeout: 60000 },
    )
    const submitAttemptButton = page.getByRole("button", { name: "Submeter tentativa oficial" }).first()
    const submitVisible = await submitAttemptButton.isVisible({ timeout: 5000 }).catch(() => false)
    if (!submitVisible) {
      const assessmentBodySnapshot = await page.locator("body").innerText()
      throw new Error(
        `ALU-023: botao de submissao oficial nao ficou visivel. Snapshot: ${assessmentBodySnapshot.slice(0, 1400)}`,
      )
    }
    await submitAttemptButton.click({ force: true })

    let officialAttempt = null
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const latestAttempt = await admin
        .from("assessment_attempts")
        .select("id,status,submitted_at,final_score_percent,auto_score_percent")
        .eq("assessment_id", assessmentId)
        .eq("user_id", studentAId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestAttempt.error) throw latestAttempt.error
      const row = latestAttempt.data
      if (row && row.submitted_at && row.status !== "in_progress") {
        officialAttempt = row
        break
      }

      await wait(1000)
    }

    assert(officialAttempt, "ALU-023: tentativa oficial nao foi finalizada com persistencia")
    evidence["ALU-023"] = `avaliacao persistiu tentativa oficial (${officialAttempt.id}) com status=${officialAttempt.status}`

    const redirectEvidence = []
    await assertRedirect(page, `${baseUrl}/dashboard`, "/aluno/dashboard", redirectEvidence, "ALU-024")
    await assertRedirect(page, `${baseUrl}/dashboard/produtos`, "/aluno/cursos", redirectEvidence, "ALU-024")
    await assertRedirect(page, `${baseUrl}/dashboard/produto/${productAId}`, `/aluno/cursos/${productAId}`, redirectEvidence, "ALU-024")
    await assertRedirect(page, `${baseUrl}/dashboard/downloads`, "/aluno/downloads", redirectEvidence, "ALU-024")
    await assertRedirect(page, `${baseUrl}/dashboard/pagamentos`, "/aluno/pagamentos", redirectEvidence, "ALU-024")
    await assertRedirect(page, `${baseUrl}/dashboard/perfil`, "/aluno/perfil", redirectEvidence, "ALU-024")
    evidence["ALU-024"] = `redirecionamentos legados validados: ${redirectEvidence.join("; ")}`

    await logout(page, baseUrl)

    console.log("ALU33_RESULTS_START")
    for (const [key, value] of Object.entries(evidence)) {
      console.log(`${key}: ${value}`)
    }
    console.log("ALU33_RESULTS_END")
  } finally {
    await context.close()
    await browser.close()

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
  console.error("ALU33_CHECK_FAILED")
  console.error(error)
  process.exitCode = 1
})
