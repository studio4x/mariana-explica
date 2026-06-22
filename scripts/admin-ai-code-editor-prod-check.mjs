import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb2toZ3Vmc3hlcGxlbHBkYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDM1OTYsImV4cCI6MjA5MTY3OTU5Nn0.9uw7Tk9R8-3tlPAJzRY8LxTC5TQMYVkHMf5JWsxqGjI"
const DEFAULT_PROMPT = "altere o texto de um titulo da pagina /suporte apenas para teste do Editor IA Irrestrito"

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

function sleep(ms) {
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
    await sleep(1000)
  }

  return null
}

async function createUserWithRetry(adminClient, payload, attempts = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await adminClient.auth.admin.createUser(payload)
    if (!result.error) return result
    lastError = result.error
    if (attempt < attempts) await sleep(800 * attempt)
  }
  throw lastError ?? new Error("Falha ao criar usuario")
}

async function callAdminAiCodeEditor({ supabaseUrl, accessToken, payload }) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/admin-ai-code-editor`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      access_token: accessToken,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data
      ? String(data.message)
      : `Edge Function returned ${response.status}`
    throw new Error(message)
  }

  return data
}

async function main() {
  const env = parseEnvFile(".env.local")
  const supabaseUrl = env.SUPABASE_PROJECT_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const prompt = process.argv.slice(2).join(" ").trim() || DEFAULT_PROMPT

  assert(supabaseUrl, "SUPABASE_PROJECT_URL ausente no .env.local")
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  const anonClient = createClient(supabaseUrl, ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const adminEmail = `qa.ai-code-editor.${stamp}@example.com`
  const adminPassword = `Ai!CodeEditor${stamp}`
  const createdUsers = []

  try {
    const created = await createUserWithRetry(adminClient, {
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "QA AI Code Editor Admin" },
    })
    const adminId = created.data.user?.id
    assert(adminId, "Falha ao criar usuario admin temporario")
    createdUsers.push(adminId)

    const profile = await waitForProfile(adminClient, adminId)
    assert(profile, "Profile admin nao foi criado no prazo")

    const profileUpdate = await adminClient
      .from("profiles")
      .update({ status: "active", role: "admin", is_admin: true })
      .eq("id", adminId)
    if (profileUpdate.error) throw profileUpdate.error

    const signIn = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })
    if (signIn.error || !signIn.data.session?.access_token) {
      throw signIn.error ?? new Error("Nao foi possivel autenticar o usuario temporario")
    }

    const accessToken = signIn.data.session.access_token
    const createdTask = await callAdminAiCodeEditor({
      supabaseUrl,
      accessToken,
      payload: {
        action: "create_task",
        prompt,
      },
    })

    let task = createdTask.task
    const startedAt = Date.now()

    while (Date.now() - startedAt < 8 * 60_000) {
      task = (
        await callAdminAiCodeEditor({
          supabaseUrl,
          accessToken,
          payload: {
            action: "refresh_task_status",
            taskId: task.id,
          },
        })
      ).task

      task = (
        await callAdminAiCodeEditor({
          supabaseUrl,
          accessToken,
          payload: {
            action: "refresh_task_preview",
            taskId: task.id,
          },
        })
      ).task

      if (task.pull_request_url && task.commit_sha && Array.isArray(task.file_changes) && task.file_changes.some((item) => item.diff_patch)) {
        break
      }

      await sleep(15_000)
    }

    assert(task.branch_name, "Task sem branch real")
    assert(task.commit_sha, "Task sem commit real")
    assert(task.pull_request_url, "Task sem Pull Request real")
    assert(Array.isArray(task.file_changes) && task.file_changes.some((item) => item.diff_patch), "Task sem diff real")

    const summary = {
      task_id: task.id,
      status: task.status,
      branch_name: task.branch_name,
      commit_sha: task.commit_sha,
      pull_request_url: task.pull_request_url,
      preview_status: task.preview_status,
      preview_url: task.preview_url,
      test_status: task.test_status,
      build_status: task.build_status,
    }

    console.log(JSON.stringify(summary, null, 2))

    await callAdminAiCodeEditor({
      supabaseUrl,
      accessToken,
      payload: {
        action: "reject_task",
        taskId: task.id,
        notes: "Smoke automatico do editor irrestrito concluido sem publicar em producao.",
      },
    })
  } finally {
    for (const userId of createdUsers.reverse()) {
      await adminClient.auth.admin.deleteUser(userId).catch(() => {})
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
