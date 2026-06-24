import fs from "node:fs"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const BASE_URL = "https://www.mariana-explica.pt"
const FALLBACK_SUPABASE_ANON_KEY =
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
  if (!condition) {
    throw new Error(message)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createUserWithRetry(adminClient, payload, attempts = 3) {
  let lastError = null

  return (async () => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const result = await adminClient.auth.admin.createUser(payload)
      if (!result.error) return result
      lastError = result.error
      if (attempt < attempts) {
        await sleep(800 * attempt)
      }
    }

    throw lastError ?? new Error("Falha ao criar usuario")
  })()
}

async function waitForProfile(adminClient, userId, timeoutMs = 30000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id,role,is_admin,status")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) return data

    await sleep(1000)
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

      await dismissCookieBanner(page)
      await emailInput.fill(email)
      await passwordInput.fill(password)
      await page.getByRole("button", { name: "Entrar" }).click()
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

async function dismissCookieBanner(page) {
  const acceptCookies = page.getByRole("button", { name: /aceitar cookies/i }).first()
  if (await acceptCookies.isVisible({ timeout: 2500 }).catch(() => false)) {
    try {
      await acceptCookies.click({ force: true, timeout: 5000 })
      await sleep(400)
      return
    } catch {
      // fallback below
    }
  }

  await page.evaluate(() => {
    window.localStorage.setItem(
      "mariana-explica:cookie-consent",
      JSON.stringify({
        version: "2026-04-23",
        preferences: {
          essential: true,
          analytics: false,
          marketing: false,
        },
        updatedAt: new Date().toISOString(),
      }),
    )
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await sleep(400)
}

async function capturePageIssues(page, issues, label) {
  page.on("pageerror", (error) => {
    issues.push(`[${label}] pageerror: ${error.message}`)
  })

  page.on("response", (response) => {
    if (response.status() === 409) {
      issues.push(`[${label}] response:409: ${response.request().method()} ${response.url()}`)
    }
  })

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`[${label}] console:error: ${message.text()}`)
    }
  })
}

async function waitForPath(page, pathname, timeoutMs = 30000) {
  await page.waitForURL((url) => url.pathname === pathname, { timeout: timeoutMs })
}

async function getVisualPageState(adminClient, pageKey) {
  const pageResult = await adminClient
    .from("visual_site_pages")
    .select("id,page_key,title,status,published_version_id")
    .eq("page_key", pageKey)
    .maybeSingle()

  if (pageResult.error) throw pageResult.error
  assert(pageResult.data?.id, `Pagina visual ${pageKey} nao encontrada.`)

  const versionsResult = await adminClient
    .from("visual_site_page_versions")
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_at")
    .eq("page_id", pageResult.data.id)
    .order("version_number", { ascending: true })

  if (versionsResult.error) throw versionsResult.error

  return {
    page: pageResult.data,
    versions: versionsResult.data ?? [],
  }
}

async function getSupportState(adminClient) {
  return getVisualPageState(adminClient, "support")
}

function getHeroTitle(version) {
  return String(version?.entries_json?.hero?.title ?? "")
}

async function selectAndEditHeroTitle(page, currentTitle, newTitle, mode = "public") {
  const titleField = page.getByRole("button", { name: currentTitle })
  await titleField.waitFor({ state: "visible", timeout: 30000 })
  await titleField.click({ force: true })
  if (process.env.VISUAL_DEBUG_SCREENSHOT === "1") {
    await page.screenshot({ path: "tmp_visual_editor_debug.png", fullPage: true })
  }

  let selectedPanel
  if (mode === "admin") {
    const clearMessageButton = page.getByRole("button", { name: "Limpar mensagem" }).first()
    await clearMessageButton.waitFor({ state: "visible", timeout: 30000 })
    selectedPanel = clearMessageButton.locator("xpath=ancestor::div[contains(@class,'rounded-[1.75rem]')][1]")
  } else {
    const restoreFallbackButton = page.getByRole("button", { name: "Restaurar fallback" }).first()
    await restoreFallbackButton.waitFor({ state: "visible", timeout: 30000 })
    selectedPanel = restoreFallbackButton.locator("xpath=ancestor::section[1]")
  }

  const input = selectedPanel.locator("input, textarea").first()
  await input.waitFor({ state: "visible", timeout: 30000 })
  const currentValue = await input.inputValue()
  await input.fill(newTitle)
  const updatedValue = await input.inputValue()

  return { currentValue, updatedValue }
}

async function clickButtonAndWaitForMessage(page, name, messagePattern) {
  await page.getByRole("button", { name }).click()
  await page.getByText(messagePattern, { exact: false }).first().waitFor({ state: "visible", timeout: 30000 })
}

async function restoreVersionByNumber(page, versionNumber) {
  if (versionNumber === 1) {
    const restoreButtons = page.getByRole("button", { name: "Restaurar" })
    await restoreButtons.last().click()
    return
  }

  const exactVersionPattern = new RegExp(`Versao ${versionNumber}(?!\\d)`)
  const versionCard = page.locator("div.rounded-2xl.border").filter({ hasText: exactVersionPattern }).first()

  await versionCard.waitFor({ state: "visible", timeout: 30000 })
  await versionCard.getByRole("button", { name: "Restaurar" }).click()
}

async function promoteVisualPageVersion(adminClient, pageKey, versionId) {
  const versionUpdate = await adminClient
    .from("visual_site_page_versions")
    .update({ status: "published" })
    .eq("id", versionId)
    .select("id,version_number,status")
    .single()

  if (versionUpdate.error) throw versionUpdate.error

  const pageUpdate = await adminClient
    .from("visual_site_pages")
    .update({
      status: "published",
      published_version_id: versionId,
    })
    .eq("page_key", pageKey)
    .select("id,published_version_id,status")
    .single()

  if (pageUpdate.error) throw pageUpdate.error

  return {
    version: versionUpdate.data,
    page: pageUpdate.data,
  }
}

async function restoreSupportVersion(adminClient, pageId, sourceVersionId) {
  const sourceVersion = await adminClient
    .from("visual_site_page_versions")
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .eq("id", sourceVersionId)
    .eq("page_id", pageId)
    .single()

  if (sourceVersion.error) throw sourceVersion.error

  const latestVersion = await adminClient
    .from("visual_site_page_versions")
    .select("version_number")
    .eq("page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(1)

  if (latestVersion.error) throw latestVersion.error

  const nextVersionNumber = ((latestVersion.data ?? [])[0]?.version_number ?? 0) + 1

  const restoredVersion = await adminClient
    .from("visual_site_page_versions")
    .insert({
      page_id: pageId,
      version_number: nextVersionNumber,
      status: "draft",
      entries_json: sourceVersion.data.entries_json ?? {},
      style_json: sourceVersion.data.style_json ?? {},
      metadata: {
        restored_from_version_id: sourceVersion.data.id,
      },
    })
    .select("id,page_id,version_number,status,entries_json,style_json,metadata,created_by,created_at")
    .single()

  if (restoredVersion.error) throw restoredVersion.error

  return restoredVersion.data
}

function createWriteCapableCommonClient(supabaseUrl) {
  return createClient(supabaseUrl, FALLBACK_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function main() {
  const env = parseEnvFile(".env.local")
  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const commonAuthClient = createWriteCapableCommonClient(supabaseUrl)
  const browser = await chromium.launch({ headless: true })
  const issues = []
  const evidence = {}
  const createdUsers = []

  const stamp = Date.now()
  const adminEmail = `qa.visual.admin.${stamp}@example.com`
  const commonEmail = `qa.visual.common.${stamp}@example.com`
  const password = `Qa!Visual${stamp}`

  let initialPageState = null
  let originalPublishedVersionId = null
  let originalPublishedVersionNumber = null
  let originalMaterialsPublishedVersionId = null
  let adminId = null
  let commonId = null

  try {
    const adminUser = await createUserWithRetry(adminClient, {
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA Visual Admin" },
    })

    adminId = adminUser.data.user?.id ?? null
    assert(adminId, "Falha ao criar usuario admin temporario")
    createdUsers.push(adminId)

    const commonUser = await createUserWithRetry(adminClient, {
      email: commonEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "QA Visual Common" },
    })

    commonId = commonUser.data.user?.id ?? null
    assert(commonId, "Falha ao criar usuario comum temporario")
    createdUsers.push(commonId)

    const adminProfile = await waitForProfile(adminClient, adminId)
    const commonProfile = await waitForProfile(adminClient, commonId)
    assert(adminProfile, "Profile admin nao foi criado no prazo")
    assert(commonProfile, "Profile comum nao foi criado no prazo")

    const activateAdmin = await adminClient.from("profiles").update({ status: "active", role: "admin", is_admin: true }).eq("id", adminId)
    if (activateAdmin.error) throw activateAdmin.error

    const activateCommon = await adminClient
      .from("profiles")
      .update({ status: "active", role: "student", is_admin: false })
      .eq("id", commonId)
    if (activateCommon.error) throw activateCommon.error

    const commonSignIn = await commonAuthClient.auth.signInWithPassword({
      email: commonEmail,
      password,
    })
    if (commonSignIn.error || !commonSignIn.data.session?.access_token) {
      throw commonSignIn.error ?? new Error("Nao foi possivel autenticar o usuario comum temporario")
    }

    initialPageState = await getSupportState(adminClient)
    originalPublishedVersionId = initialPageState.page.published_version_id
    assert(originalPublishedVersionId, "support page nao possui published_version_id inicial")

    const originalPublishedVersion = initialPageState.versions.find((item) => item.id === originalPublishedVersionId)
    assert(originalPublishedVersion, "Versao publicada inicial nao encontrada")
    originalPublishedVersionNumber = originalPublishedVersion.version_number
    const originalHeroTitle = getHeroTitle(originalPublishedVersion)
    assert(originalHeroTitle, "Titulo inicial do hero nao encontrado")

    const initialMaterialsState = await getVisualPageState(adminClient, "materials")
    originalMaterialsPublishedVersionId = initialMaterialsState.page.published_version_id
    assert(originalMaterialsPublishedVersionId, "materials page nao possui published_version_id inicial")

    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await capturePageIssues(adminPage, issues, "admin")

    try {
      await login(adminPage, BASE_URL, adminEmail, password, "/admin")
      await waitForPath(adminPage, "/admin")
      await dismissCookieBanner(adminPage)

      await adminPage.goto(`${BASE_URL}/admin/editor-visual`, { waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/admin/editor-visual")
      await adminPage.getByRole("heading", { name: "Editor Visual" }).waitFor({ state: "visible", timeout: 30000 })
      assert((await adminPage.getByRole("link", { name: "Editor IA Irrestrito" }).count()) === 0, "Menu admin ainda exibiu Editor IA Irrestrito")
      evidence.menu = "Editor Visual carregou e o menu nao exibiu Editor IA Irrestrito."

      evidence.adminRoute = "/admin/editor-visual carregou para admin."

      const currentHeroTitle = originalHeroTitle
      const smokeTitle = `${currentHeroTitle.replace(/\s*\|\s*Smoke Visual.*$/i, "")} | Smoke Visual ${stamp}`
      const inspectorBefore = await selectAndEditHeroTitle(adminPage, currentHeroTitle, smokeTitle, "admin")
      assert(inspectorBefore.currentValue.trim().length > 0, "Nao foi possivel ler o titulo atual no inspector")
      assert(inspectorBefore.updatedValue === smokeTitle, "Input do editor nao refletiu o novo titulo")

      await adminPage.getByRole("button", { name: "Guardar rascunho" }).waitFor({ state: "visible", timeout: 30000 })
      await clickButtonAndWaitForMessage(adminPage, "Guardar rascunho", /Rascunho salvo na versao \d+\./i)
      let afterSave = null
      let savedDraftVersion = null
      for (let attempt = 0; attempt < 10; attempt += 1) {
        afterSave = await getSupportState(adminClient)
        savedDraftVersion = afterSave.versions[afterSave.versions.length - 1]
        if (getHeroTitle(savedDraftVersion) === smokeTitle) {
          break
        }
        await sleep(1000)
      }
      assert(afterSave, "Nao foi possivel ler o estado apos o save")
      assert(savedDraftVersion, "Nao foi possivel localizar o rascunho salvo")
      assert(getHeroTitle(savedDraftVersion) === smokeTitle, "Rascunho salvo nao corresponde ao texto editado")
      evidence.savedDraft = `Hero title alterado para: ${smokeTitle}`

      await promoteVisualPageVersion(adminClient, "support", savedDraftVersion.id)
      evidence.publishedEditedVersion = `Versao ${savedDraftVersion.version_number} promovida no banco.`

      const afterEditedPublish = await getSupportState(adminClient)
      const editedPublishedVersion = afterEditedPublish.versions.find(
        (item) => item.id === afterEditedPublish.page.published_version_id,
      )
      assert(editedPublishedVersion, "Versao editada publicada nao encontrada no banco")
      assert(getHeroTitle(editedPublishedVersion) === smokeTitle, "Hero title publicado nao corresponde ao texto editado")
      evidence.dbAfterEdit = `published_version_id=${afterEditedPublish.page.published_version_id}, version=${editedPublishedVersion.version_number}`

      await adminPage.goto(`${BASE_URL}/suporte`, { waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/suporte")
      await adminPage.getByRole("button", { name: "Abrir editor visual" }).waitFor({ state: "visible", timeout: 30000 })
      await adminPage.getByRole("button", { name: "Abrir editor visual" }).click({ force: true })
      await adminPage.getByRole("button", { name: "Ativar edicao" }).waitFor({ state: "visible", timeout: 30000 })
      await adminPage.getByRole("button", { name: "Ativar edicao" }).click({ force: true })
      await adminPage.getByRole("button", { name: "Guardar rascunho" }).waitFor({ state: "visible", timeout: 30000 })
      await adminPage.getByRole("button", { name: "Publicar" }).waitFor({ state: "visible", timeout: 30000 })
      evidence.adminSupport = "Admin abriu o widget em /suporte e ativou a edicao visual."

      const commonContext = await browser.newContext()
      const commonPage = await commonContext.newPage()
      await capturePageIssues(commonPage, issues, "common")

      try {
        await login(commonPage, BASE_URL, commonEmail, password, "/suporte")
        await waitForPath(commonPage, "/suporte")
        await dismissCookieBanner(commonPage)
        await commonPage.waitForFunction((title) => document.body?.innerText.includes(title), smokeTitle, {
          timeout: 30000,
        })
        assert((await commonPage.getByRole("button", { name: "Abrir editor visual" }).count()) === 0, "Usuario comum enxergou o widget visual")
        assert((await commonPage.getByRole("button", { name: "Guardar rascunho" }).count()) === 0, "Usuario comum enxergou controles visuais")
        evidence.commonRead = "Usuario comum viu o texto editado sem controles visuais."
      } finally {
        await commonContext.close()
      }

      const anonContext = await browser.newContext()
      const anonPage = await anonContext.newPage()
      await capturePageIssues(anonPage, issues, "anon")

      try {
        await anonPage.goto(`${BASE_URL}/suporte`, { waitUntil: "domcontentloaded" })
        await waitForPath(anonPage, "/suporte")
        await dismissCookieBanner(anonPage)
        await anonPage.waitForFunction((title) => document.body?.innerText.includes(title), smokeTitle, {
          timeout: 30000,
        })
        assert((await anonPage.getByRole("button", { name: "Abrir editor visual" }).count()) === 0, "Visitante anonimo enxergou o widget visual")
        assert((await anonPage.getByRole("button", { name: "Guardar rascunho" }).count()) === 0, "Visitante anonimo enxergou controles visuais")
        evidence.anonRead = "Visitante anonimo viu o texto editado sem controles visuais."
      } finally {
        await anonContext.close()
      }

      await adminPage.goto(`${BASE_URL}/admin/editor-visual`, { waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/admin/editor-visual")
      await adminPage.getByRole("button", { name: "Restaurar" }).first().waitFor({ state: "visible", timeout: 30000 })
      const restoredDraftVersion = await restoreSupportVersion(adminClient, afterEditedPublish.page.id, originalPublishedVersionId)
      const afterRestoreDraft = await getSupportState(adminClient)
      const restoredDraftRecord = afterRestoreDraft.versions.find((item) => item.id === restoredDraftVersion.id)
      assert(restoredDraftRecord, "Nao foi possivel localizar o rascunho restaurado")
      assert(getHeroTitle(restoredDraftRecord) === originalHeroTitle, "Rascunho restaurado nao voltou ao hero original")
      await promoteVisualPageVersion(adminClient, "support", restoredDraftVersion.id)
      evidence.restorePublish = `Versao original restaurada e promovida como v${restoredDraftVersion.version_number}.`

      const afterRestorePublish = await getSupportState(adminClient)
      const restoredPublishedVersion = afterRestorePublish.versions.find(
        (item) => item.id === afterRestorePublish.page.published_version_id,
      )
      assert(restoredPublishedVersion, "Versao restaurada publicada nao encontrada no banco")
      assert(getHeroTitle(restoredPublishedVersion) === originalHeroTitle, "Restauro publicado nao voltou ao hero original")

      const clearOverride = await adminClient
        .from("visual_site_pages")
        .update({ published_version_id: null, status: "draft" })
        .eq("page_key", "support")
        .select("id,published_version_id,status")
        .single()

      if (clearOverride.error) throw clearOverride.error
      assert(clearOverride.data?.published_version_id === null, "Nao foi possivel limpar o override publicado")
      evidence.fallbackCleared = "published_version_id limpo temporariamente para validar fallback."

      await adminPage.goto(`${BASE_URL}/suporte`, { waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/suporte")
      await adminPage.waitForFunction(
        (title) => document.body?.innerText.includes(title),
        originalHeroTitle,
        { timeout: 30000 },
      )
      assert(
        (await adminPage.getByRole("button", { name: "Guardar rascunho" }).count()) === 0,
        "Fallback hardcoded ainda deixou controles visuais expostos",
      )
      evidence.fallbackVisible = "Fallback hardcoded voltou a aparecer em /suporte para admin."

      await adminPage.goto(`${BASE_URL}/materiais`, { waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/materiais")
      await adminPage.getByRole("button", { name: "Abrir editor visual" }).waitFor({ state: "visible", timeout: 30000 })
      await adminPage.getByRole("button", { name: "Abrir editor visual" }).click({ force: true })
      await adminPage.getByRole("button", { name: "Ativar edicao" }).waitFor({ state: "visible", timeout: 30000 })
      await adminPage.getByRole("button", { name: "Ativar edicao" }).click({ force: true })
      const materialsState = await getVisualPageState(adminClient, "materials")
      const materialsPublishedVersion = materialsState.versions.find((item) => item.id === materialsState.page.published_version_id)
      assert(materialsPublishedVersion, "Versao publicada inicial de materiais nao encontrada")
      const materialsOriginalTitle = getHeroTitle(materialsPublishedVersion)
      const smokeMaterialsTitle = `${materialsOriginalTitle.replace(/\s*\|\s*Smoke Visual.*$/i, "")} | Smoke Visual Materials ${stamp}`
      const materialsEditorBefore = await selectAndEditHeroTitle(adminPage, materialsOriginalTitle, smokeMaterialsTitle)
      assert(materialsEditorBefore.currentValue.trim().length > 0, "Nao foi possivel ler o titulo atual em materiais")
      assert(materialsEditorBefore.updatedValue === smokeMaterialsTitle, "Input do editor em materiais nao refletiu o novo titulo")
      await clickButtonAndWaitForMessage(adminPage, "Guardar rascunho", /Rascunho salvo na versao \d+\./i)
      let materialsAfterSave = null
      let materialsDraftVersion = null
      for (let attempt = 0; attempt < 10; attempt += 1) {
        materialsAfterSave = await getVisualPageState(adminClient, "materials")
        materialsDraftVersion = materialsAfterSave.versions[materialsAfterSave.versions.length - 1]
        if (getHeroTitle(materialsDraftVersion) === smokeMaterialsTitle) {
          break
        }
        await sleep(1000)
      }
      assert(materialsAfterSave, "Nao foi possivel ler o estado dos materiais apos o save")
      assert(materialsDraftVersion, "Nao foi possivel localizar o rascunho salvo em materiais")
      assert(getHeroTitle(materialsDraftVersion) === smokeMaterialsTitle, "Rascunho salvo em materiais nao corresponde ao texto editado")
      await promoteVisualPageVersion(adminClient, "materials", materialsDraftVersion.id)
      await adminPage.reload({ waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/materiais")
      await adminPage.waitForFunction((title) => document.body?.innerText.includes(title), smokeMaterialsTitle, {
        timeout: 30000,
      })
      evidence.materialsEdit = `Hero title alterado para: ${smokeMaterialsTitle}`

      const materialsCommonContext = await browser.newContext()
      const materialsCommonPage = await materialsCommonContext.newPage()
      await capturePageIssues(materialsCommonPage, issues, "materials-common")

      try {
        await login(materialsCommonPage, BASE_URL, commonEmail, password, "/materiais")
        await waitForPath(materialsCommonPage, "/materiais")
        await dismissCookieBanner(materialsCommonPage)
        await materialsCommonPage.waitForFunction((title) => document.body?.innerText.includes(title), smokeMaterialsTitle, {
          timeout: 30000,
        })
        assert((await materialsCommonPage.getByRole("button", { name: "Abrir editor visual" }).count()) === 0, "Usuario comum enxergou o widget visual em materiais")
        assert((await materialsCommonPage.getByRole("button", { name: "Guardar rascunho" }).count()) === 0, "Usuario comum enxergou controles visuais em materiais")
        evidence.materialsCommon = "Usuario comum viu materiais sem controles visuais."
      } finally {
        await materialsCommonContext.close()
      }

      const materialsAnonContext = await browser.newContext()
      const materialsAnonPage = await materialsAnonContext.newPage()
      await capturePageIssues(materialsAnonPage, issues, "materials-anon")

      try {
        await materialsAnonPage.goto(`${BASE_URL}/materiais`, { waitUntil: "domcontentloaded" })
        await waitForPath(materialsAnonPage, "/materiais")
        await dismissCookieBanner(materialsAnonPage)
        await materialsAnonPage.waitForFunction((title) => document.body?.innerText.includes(title), smokeMaterialsTitle, {
          timeout: 30000,
        })
        assert((await materialsAnonPage.getByRole("button", { name: "Abrir editor visual" }).count()) === 0, "Visitante anonimo enxergou o widget visual em materiais")
        assert((await materialsAnonPage.getByRole("button", { name: "Guardar rascunho" }).count()) === 0, "Visitante anonimo enxergou controles visuais em materiais")
        evidence.materialsAnon = "Visitante anonimo viu materiais sem controles visuais."
      } finally {
        await materialsAnonContext.close()
      }

      await adminPage.goto(`${BASE_URL}/materiais`, { waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/materiais")
      await promoteVisualPageVersion(adminClient, "materials", materialsPublishedVersion.id)
      await adminPage.reload({ waitUntil: "domcontentloaded" })
      await waitForPath(adminPage, "/materiais")
      await adminPage.waitForFunction((title) => document.body?.innerText.includes(title), materialsOriginalTitle, {
        timeout: 30000,
      })
      evidence.materialsRestore = "Materiais voltou ao conteudo original após restauracao."

      const commonWriteAttempt = await commonAuthClient
        .from("visual_site_pages")
        .update({ title: "Nao deve gravar" })
        .eq("page_key", "support")
        .select("id")

      assert((commonWriteAttempt.data ?? []).length === 0, "Usuario comum conseguiu escrever em visual_site_pages")
      evidence.commonWriteDenied = "Usuario comum nao conseguiu escrever em visual_site_pages."

      const restoreLiveState = await adminClient
        .from("visual_site_pages")
        .update({
          published_version_id: originalPublishedVersionId,
          status: "published",
        })
        .eq("page_key", "support")
        .select("id,published_version_id,status")
        .single()

      if (restoreLiveState.error) throw restoreLiveState.error
      assert(restoreLiveState.data?.published_version_id === originalPublishedVersionId, "Nao foi possivel restaurar o published_version_id inicial")
      evidence.finalSupport = "State restored to original published version in the database."

      const aiRoutes = [
        "/admin/editor-ia-irrestrito",
        "/admin/editor-ia-irrestrito/chat",
        "/admin/editor-ia-irrestrito/tasks",
        "/admin/editor-ia-irrestrito/configuracao",
      ]

      for (const path of aiRoutes) {
        await adminPage.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" })
        await waitForPath(adminPage, new URL(path, BASE_URL).pathname)
        await adminPage.getByRole("heading", { name: "Editor IA Irrestrito" }).waitFor({ state: "visible", timeout: 30000 })
        await adminPage.getByRole("heading", { name: "Acesso desativado" }).waitFor({ state: "visible", timeout: 30000 })
        assert((await adminPage.getByRole("tab").count()) === 0, "Tela desativada ainda exibiu abas")
        evidence[`ai_${path.split("/").pop() || "base"}`] = `${path} carregou como tela desativada.`
      }

      const anonRedirectContext = await browser.newContext()
      const anonRedirectPage = await anonRedirectContext.newPage()
      await capturePageIssues(anonRedirectPage, issues, "anon-redirect")

      try {
        await anonRedirectPage.goto(`${BASE_URL}/admin/editor-visual`, { waitUntil: "domcontentloaded" })
        await waitForPath(anonRedirectPage, "/login")
        evidence.adminRedirect = "Anonimo foi redirecionado para /login ao tentar abrir /admin/editor-visual."
      } finally {
        await anonRedirectContext.close()
      }
    } finally {
      await adminContext.close()
    }

    if (issues.length > 0) {
      throw new Error(`Erros de console/pageerror encontrados: ${issues.join(" | ")}`)
    }

    console.log("VISUAL_EDITOR_SMOKE_OK")
    console.log(JSON.stringify(evidence, null, 2))
  } finally {
    if (originalPublishedVersionId) {
      const restoreSupport = await promoteVisualPageVersion(adminClient, "support", originalPublishedVersionId)
      if (restoreSupport?.page?.published_version_id !== originalPublishedVersionId) {
        console.error("WARN: nao foi possivel restaurar support para a versao publicada original")
      }
    }

    if (originalMaterialsPublishedVersionId) {
      const restoreMaterials = await promoteVisualPageVersion(adminClient, "materials", originalMaterialsPublishedVersionId)
      if (restoreMaterials?.page?.published_version_id !== originalMaterialsPublishedVersionId) {
        console.error("WARN: nao foi possivel restaurar materials para a versao publicada original")
      }
    }

    await browser.close()

    for (const userId of createdUsers) {
      const deletion = await adminClient.auth.admin.deleteUser(userId)
      if (deletion.error) {
        console.error(`WARN: falha ao remover user ${userId}: ${deletion.error.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error("VISUAL_EDITOR_SMOKE_FAILED")
  console.error(error)
  process.exitCode = 1
})
