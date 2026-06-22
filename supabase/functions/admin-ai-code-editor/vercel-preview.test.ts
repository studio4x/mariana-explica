import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchVercelPreviewDeployment, readVercelSecrets } from "./vercel-preview.ts"

describe("vercel-preview helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns a safe configuration error when Vercel secrets are missing", () => {
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn(() => ""),
      },
    })

    expect(() => readVercelSecrets()).toThrow("Integracao Vercel nao configurada")
  })

  it("extracts preview URL and status from the Vercel API response", async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((key: string) => {
          if (key === "VERCEL_TOKEN") return "token"
          if (key === "VERCEL_PROJECT_ID") return "project"
          return ""
        }),
      },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            deployments: [
              {
                uid: "dep_123",
                url: "preview.mariana-explica.pt",
                state: "READY",
                readyState: "READY",
                ready: Date.parse("2026-06-22T12:00:00.000Z"),
                meta: {
                  githubCommitSha: "abc123",
                  githubCommitRef: "ai-editor/task",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ))
    )

    const deployment = await fetchVercelPreviewDeployment({
      commitSha: "abc123",
      branchName: "ai-editor/task",
    })

    expect(deployment.status).toBe("ready")
    expect(deployment.deploymentId).toBe("dep_123")
    expect(deployment.deploymentUrl).toBe("https://preview.mariana-explica.pt")
  })
})
