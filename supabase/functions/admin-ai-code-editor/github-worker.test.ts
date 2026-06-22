import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildPullRequestBody,
  buildTaskBranchName,
  GitHubRepositoryClient,
  parseGitHubRepository,
  readGitHubSecrets,
} from "./github-worker.ts"

describe("github-worker helpers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("parses repository coordinates from owner/repo or URL", () => {
    expect(parseGitHubRepository("studio4x/mariana-explica")).toEqual({
      owner: "studio4x",
      repo: "mariana-explica",
    })
    expect(parseGitHubRepository("https://github.com/studio4x/mariana-explica.git")).toEqual({
      owner: "studio4x",
      repo: "mariana-explica",
    })
  })

  it("builds deterministic task branch names", () => {
    expect(buildTaskBranchName("550e8400-e29b-41d4-a716-446655440000", "Altere o layout dos cards")).toBe(
      "ai-editor/550e8400-altere-o-layout-dos-cards",
    )
  })

  it("returns a safe configuration error when GitHub secrets are missing", () => {
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn(() => ""),
      },
    })

    expect(() => readGitHubSecrets("studio4x/mariana-explica")).toThrow(
      "Integracao GitHub nao configurada",
    )
  })

  it("builds a PR body with task context and preview status", () => {
    const body = buildPullRequestBody({
      taskId: "task-1",
      prompt: "altere o titulo da pagina /suporte",
      summary: "Atualizei o titulo solicitado.",
      files: [
        {
          filePath: "src/pages/public/Support.tsx",
          summary: "Troca localizada do titulo principal.",
        },
      ],
      previewStatus: "pending",
      previewUrl: null,
      testStatus: "pending",
      buildStatus: "pending",
      risks: [],
    })

    expect(body).toContain("task-1")
    expect(body).toContain("Preview em processamento")
    expect(body).toContain("Support.tsx")
  })

  it("returns null when the branch does not exist on GitHub", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    }))

    vi.stubGlobal("fetch", fetchMock)

    const client = new GitHubRepositoryClient({
      token: "token",
      owner: "studio4x",
      repo: "mariana-explica",
    })

    await expect(client.getBranch("ai-editor/task-demo")).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/studio4x/mariana-explica/git/ref/heads/ai-editor/task-demo",
      expect.any(Object),
    )
  })
})
