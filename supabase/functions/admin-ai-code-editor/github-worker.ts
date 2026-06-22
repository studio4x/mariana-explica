export type GitHubFileChangeType = "created" | "modified" | "deleted" | "renamed"

export interface GitHubSecrets {
  token: string
  owner: string
  repo: string
}

export interface GitHubRepositoryInfo {
  defaultBranch: string
  htmlUrl: string
}

export interface GitHubBranchInfo {
  ref: string
  sha: string
}

export interface GitHubFileSnapshot {
  path: string
  sha: string | null
  content: string | null
  exists: boolean
}

export interface GitHubAppliedChange {
  filePath: string
  changeType: GitHubFileChangeType
  previousFilePath?: string | null
  content?: string | null
  previousSha?: string | null
  nextSha?: string | null
  summary?: string | null
  rationale?: string | null
  language?: string | null
}

export interface GitHubPullRequestInfo {
  number: number
  url: string
  htmlUrl: string
  state: string
  merged: boolean
  headRef: string
  baseRef: string
}

export interface GitHubWorkflowSummary {
  status: "queued" | "in_progress" | "completed" | "not_found"
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "action_required" | "neutral" | null
  htmlUrl: string | null
  workflowName: string | null
}

interface GitHubCompareFile {
  filename?: string
  previous_filename?: string
  status?: string
  patch?: string
  sha?: string
}

function normalizeRepositoryPart(value: string) {
  return value.trim().replace(/\.git$/i, "")
}

function encodeBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
}

function decodeBase64(value: string) {
  return decodeURIComponent(escape(atob(value)))
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

export function buildTaskBranchName(taskId: string, prompt: string) {
  const taskToken = normalizeText(taskId).slice(0, 8) || "task"
  const slug = slugify(prompt).slice(0, 36) || "update"
  return `ai-editor/${taskToken}-${slug}`
}

export function parseGitHubRepository(value: string | null | undefined) {
  const raw = normalizeText(value)
  if (!raw) return null

  const trimmed = normalizeRepositoryPart(raw)
  const urlMatch = trimmed.match(/github\.com[:/]+([^/]+)\/([^/]+)$/i)
  if (urlMatch) {
    return {
      owner: normalizeRepositoryPart(urlMatch[1] ?? ""),
      repo: normalizeRepositoryPart(urlMatch[2] ?? ""),
    }
  }

  const parts = trimmed.split("/").map((item) => item.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      owner: normalizeRepositoryPart(parts[parts.length - 2] ?? ""),
      repo: normalizeRepositoryPart(parts[parts.length - 1] ?? ""),
    }
  }

  return null
}

export function readGitHubSecrets(configRepository?: string | null): GitHubSecrets {
  const token = normalizeText(Deno.env.get("GITHUB_TOKEN"))
  const owner = normalizeText(Deno.env.get("GITHUB_REPO_OWNER"))
  const repo = normalizeText(Deno.env.get("GITHUB_REPO_NAME"))
  const parsedConfigRepo = parseGitHubRepository(configRepository)

  const resolvedOwner = owner || parsedConfigRepo?.owner || ""
  const resolvedRepo = repo || parsedConfigRepo?.repo || ""

  if (!token || !resolvedOwner || !resolvedRepo) {
    throw new Error(
      "Integracao GitHub nao configurada. Configure GITHUB_TOKEN, GITHUB_REPO_OWNER e GITHUB_REPO_NAME nos secrets da funcao.",
    )
  }

  return {
    token,
    owner: resolvedOwner,
    repo: resolvedRepo,
  }
}

export function inferFileLanguage(filePath: string) {
  const normalized = filePath.toLowerCase()
  if (normalized.endsWith(".tsx")) return "tsx"
  if (normalized.endsWith(".ts")) return "ts"
  if (normalized.endsWith(".jsx")) return "jsx"
  if (normalized.endsWith(".js")) return "js"
  if (normalized.endsWith(".css")) return "css"
  if (normalized.endsWith(".json")) return "json"
  if (normalized.endsWith(".md")) return "markdown"
  if (normalized.endsWith(".sql")) return "sql"
  if (normalized.endsWith(".html")) return "html"
  return "text"
}

function normalizeCompareChangeType(status: string | null | undefined): GitHubFileChangeType {
  if (status === "added") return "created"
  if (status === "removed") return "deleted"
  if (status === "renamed") return "renamed"
  return "modified"
}

function isGitHubNotFoundError(error: unknown) {
  return error instanceof Error &&
    (
      error.message.includes("404") ||
      error.message.includes("Reference does not exist") ||
      error.message.includes("Not Found")
    )
}

export function buildPullRequestBody(input: {
  taskId: string
  prompt: string
  summary: string
  files: Array<{
    filePath: string
    summary?: string | null
    riskLevel?: string | null
  }>
  previewStatus: string
  previewUrl?: string | null
  testStatus: string
  buildStatus: string
  risks: string[]
}) {
  const changedFiles = input.files.length > 0
    ? input.files
      .map((file) => `- \`${file.filePath}\`${file.summary ? ` — ${file.summary}` : ""}`)
      .join("\n")
    : "- Nenhum diff persistido."
  const riskLines = input.risks.length > 0
    ? input.risks.map((risk) => `- ${risk}`).join("\n")
    : "- Sem riscos sensiveis adicionais detectados."
  const previewLine =
    input.previewUrl && input.previewStatus === "ready"
      ? `Preview pronto: ${input.previewUrl}`
      : input.previewStatus === "pending"
        ? "Preview em processamento no Vercel."
        : input.previewStatus === "failed"
          ? "Preview falhou e exige revisao."
          : "Preview ainda nao solicitado."

  return [
    "## Pedido original",
    input.prompt,
    "",
    "## Resumo do worker",
    input.summary,
    "",
    "## Arquivos alterados",
    changedFiles,
    "",
    "## Riscos",
    riskLines,
    "",
    "## Validacoes",
    `- Testes: ${input.testStatus}`,
    `- Build: ${input.buildStatus}`,
    `- ${previewLine}`,
    "",
    "## Task interna",
    `- Task ID: ${input.taskId}`,
    "",
    "## Revisao",
    "- Confirmar o diff abaixo e o preview antes do merge.",
  ].join("\n")
}

export function buildRollbackPullRequestBody(input: {
  taskId: string
  originalPrompt: string
  originalPullRequestUrl?: string | null
  originalCommitSha?: string | null
  notes?: string | null
  files: Array<{
    filePath: string
    previousFilePath?: string | null
    changeType: GitHubFileChangeType
  }>
}) {
  const changedFiles = input.files.length > 0
    ? input.files
      .map((file) =>
        `- \`${file.filePath}\`${file.previousFilePath ? ` (antes: \`${file.previousFilePath}\`)` : ""} - ${file.changeType}`
      )
      .join("\n")
    : "- Nenhum arquivo mapeado para revert."

  return [
    "## Rollback solicitado",
    `Reverter a task ${input.taskId}.`,
    "",
    "## Pedido original",
    input.originalPrompt,
    "",
    "## Referencias",
    `- Commit original: ${input.originalCommitSha ?? "nao registado"}`,
    `- Pull Request original: ${input.originalPullRequestUrl ?? "nao registado"}`,
    "",
    "## Arquivos revertidos",
    changedFiles,
    "",
    "## Notas do admin",
    normalizeText(input.notes) || "Sem notas adicionais.",
    "",
    "## Revisao",
    "- Confirmar o diff de revert antes do merge em producao.",
  ].join("\n")
}

export class GitHubRepositoryClient {
  constructor(private readonly secrets: GitHubSecrets) {}

  private async request<T>(path: string, init?: RequestInit, accept = "application/vnd.github+json") {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: accept,
        Authorization: `Bearer ${this.secrets.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
    })

    if (response.status === 204) {
      return null as T
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
          ? String((payload as Record<string, unknown>).message)
          : `GitHub retornou ${response.status}`
      throw new Error(`GitHub: ${message}`)
    }

    return payload as T
  }

  async getRepositoryInfo(): Promise<GitHubRepositoryInfo> {
    const payload = await this.request<{
      default_branch?: string
      html_url?: string
    }>(`/repos/${this.secrets.owner}/${this.secrets.repo}`)

    return {
      defaultBranch: normalizeText(payload.default_branch) || "master",
      htmlUrl: normalizeText(payload.html_url),
    }
  }

  async getBranch(branchName: string): Promise<GitHubBranchInfo | null> {
    const encodedBranchName = branchName
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")

    try {
      const payload = await this.request<{
        ref?: string
        object?: { sha?: string }
      }>(`/repos/${this.secrets.owner}/${this.secrets.repo}/git/ref/heads/${encodedBranchName}`)

      return {
        ref: normalizeText(payload.ref) || `refs/heads/${branchName}`,
        sha: normalizeText(payload.object?.sha),
      }
    } catch (error) {
      if (isGitHubNotFoundError(error)) {
        return null
      }
      throw error
    }
  }

  async createBranch(branchName: string, baseSha: string) {
    await this.request(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/git/refs`,
      {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      },
    )
  }

  async ensureBranch(branchName: string, baseSha: string) {
    const existing = await this.getBranch(branchName)
    if (existing?.sha) {
      return existing
    }

    await this.createBranch(branchName, baseSha)
    return {
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    } satisfies GitHubBranchInfo
  }

  async getFile(path: string, ref: string): Promise<GitHubFileSnapshot> {
    const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/")

    const response = await fetch(
      `https://api.github.com/repos/${this.secrets.owner}/${this.secrets.repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.secrets.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    )

    if (response.status === 404) {
      return {
        path,
        sha: null,
        content: null,
        exists: false,
      }
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
          ? String((payload as Record<string, unknown>).message)
          : `GitHub retornou ${response.status}`
      throw new Error(`GitHub: ${message}`)
    }

    const record = payload as Record<string, unknown>
    const encodedContent = typeof record.content === "string"
      ? record.content.replace(/\n/g, "")
      : ""

    return {
      path,
      sha: normalizeText(record.sha),
      content: encodedContent ? decodeBase64(encodedContent) : "",
      exists: true,
    }
  }

  async getBlobText(blobSha: string) {
    const payload = await this.request<{
      content?: string
      encoding?: string
    }>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/git/blobs/${encodeURIComponent(blobSha)}`,
    )

    const encodedContent = typeof payload.content === "string"
      ? payload.content.replace(/\n/g, "")
      : ""

    if (!encodedContent) {
      return ""
    }

    if (normalizeText(payload.encoding) === "base64") {
      return decodeBase64(encodedContent)
    }

    return encodedContent
  }

  async upsertFile(input: {
    path: string
    branch: string
    message: string
    content: string
    previousSha?: string | null
  }) {
    const encodedPath = input.path.split("/").map((segment) => encodeURIComponent(segment)).join("/")
    const payload = await this.request<{
      content?: { sha?: string }
      commit?: { sha?: string; html_url?: string }
    }>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/contents/${encodedPath}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: input.message,
          content: encodeBase64(input.content),
          branch: input.branch,
          sha: input.previousSha ?? undefined,
        }),
      },
    )

    return {
      fileSha: normalizeText(payload.content?.sha) || null,
      commitSha: normalizeText(payload.commit?.sha) || null,
      commitUrl: normalizeText(payload.commit?.html_url) || null,
    }
  }

  async deleteFile(input: {
    path: string
    branch: string
    message: string
    previousSha: string
  }) {
    const encodedPath = input.path.split("/").map((segment) => encodeURIComponent(segment)).join("/")
    const payload = await this.request<{
      commit?: { sha?: string; html_url?: string }
    }>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/contents/${encodedPath}`,
      {
        method: "DELETE",
        body: JSON.stringify({
          message: input.message,
          branch: input.branch,
          sha: input.previousSha,
        }),
      },
    )

    return {
      commitSha: normalizeText(payload.commit?.sha) || null,
      commitUrl: normalizeText(payload.commit?.html_url) || null,
    }
  }

  async compare(base: string, head: string) {
    const payload = await this.request<{
      html_url?: string
      files?: GitHubCompareFile[]
    }>(`/repos/${this.secrets.owner}/${this.secrets.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`)

    const files = Array.isArray(payload.files) ? payload.files : []

    return {
      htmlUrl: normalizeText(payload.html_url) || null,
      files: files.map((file) => ({
        filePath: normalizeText(file.filename),
        previousFilePath: normalizeText(file.previous_filename) || null,
        changeType: normalizeCompareChangeType(file.status),
        patch: typeof file.patch === "string" ? file.patch : null,
        sha: normalizeText(file.sha) || null,
      })),
    }
  }

  async findOpenPullRequest(branchName: string) {
    const payload = await this.request<Array<Record<string, unknown>>>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/pulls?state=open&head=${encodeURIComponent(`${this.secrets.owner}:${branchName}`)}&per_page=10`,
    )

    const first = Array.isArray(payload) ? payload[0] : null
    if (!first) return null
    return this.normalizePullRequest(first)
  }

  async createPullRequest(input: {
    title: string
    body: string
    head: string
    base: string
  }) {
    const existing = await this.findOpenPullRequest(input.head)
    if (existing) {
      return existing
    }

    const payload = await this.request<Record<string, unknown>>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/pulls`,
      {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base,
        }),
      },
    )

    return this.normalizePullRequest(payload)
  }

  async closePullRequest(pullRequestNumber: number) {
    const payload = await this.request<Record<string, unknown>>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/pulls/${pullRequestNumber}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          state: "closed",
        }),
      },
    )

    return this.normalizePullRequest(payload)
  }

  async mergePullRequest(input: {
    pullRequestNumber: number
    commitTitle: string
  }) {
    const payload = await this.request<{
      merged?: boolean
      sha?: string
      message?: string
    }>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/pulls/${input.pullRequestNumber}/merge`,
      {
        method: "PUT",
        body: JSON.stringify({
          merge_method: "squash",
          commit_title: input.commitTitle,
        }),
      },
    )

    return {
      merged: payload.merged === true,
      sha: normalizeText(payload.sha) || null,
      message: normalizeText(payload.message),
    }
  }

  async listWorkflowRuns(headSha: string) {
    const payload = await this.request<{
      workflow_runs?: Array<Record<string, unknown>>
    }>(
      `/repos/${this.secrets.owner}/${this.secrets.repo}/actions/runs?head_sha=${encodeURIComponent(headSha)}&per_page=20`,
    )

    const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : []
    const relevant =
      runs.find((run) => normalizeText(run.name) === "AI Code Editor Checks") ??
      runs[0] ??
      null

    if (!relevant) {
      return {
        status: "not_found",
        conclusion: null,
        htmlUrl: null,
        workflowName: null,
      } satisfies GitHubWorkflowSummary
    }

    return {
      status: normalizeText(relevant.status) as GitHubWorkflowSummary["status"],
      conclusion: normalizeText(relevant.conclusion) as GitHubWorkflowSummary["conclusion"],
      htmlUrl: normalizeText(relevant.html_url) || null,
      workflowName: normalizeText(relevant.name) || null,
    } satisfies GitHubWorkflowSummary
  }

  private normalizePullRequest(payload: Record<string, unknown>) {
    const head = payload.head && typeof payload.head === "object" ? payload.head as Record<string, unknown> : {}
    const base = payload.base && typeof payload.base === "object" ? payload.base as Record<string, unknown> : {}

    return {
      number: Number(payload.number ?? 0),
      url: normalizeText(payload.url),
      htmlUrl: normalizeText(payload.html_url),
      state: normalizeText(payload.state) || "open",
      merged: payload.merged === true,
      headRef: normalizeText(head.ref),
      baseRef: normalizeText(base.ref),
    } satisfies GitHubPullRequestInfo
  }
}
