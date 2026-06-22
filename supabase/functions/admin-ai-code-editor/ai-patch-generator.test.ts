import { beforeEach, describe, expect, it, vi } from "vitest"
import { generateTaskFileChanges } from "./ai-patch-generator.ts"

describe("ai-patch-generator", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("falls back to Gemini when OpenAI quota is exceeded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "You exceeded your current quota, please check your plan and billing details.",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "Atualizei o titulo solicitado.",
                      execution_notes: "Patch real gerado com fallback Gemini.",
                      risk_level: "low",
                      changed_files: [
                        {
                          file_path: "src/pages/public/Support.tsx",
                          change_type: "modified",
                          summary: "Troca localizada do titulo.",
                          rationale: "Ajuste pontual para o smoke do editor.",
                          language: "tsx",
                          content: "<Support />",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })

    vi.stubGlobal("fetch", fetchMock)

    const result = await generateTaskFileChanges({
      providers: [
        { provider: "openai", apiKey: "openai-key", model: "gpt-4.1-mini" },
        { provider: "gemini", apiKey: "gemini-key", model: "gemini-2.0-flash" },
      ],
      prompt: "altere o titulo da pagina /suporte",
      plan: {
        normalizedPrompt: "altere o titulo da pagina /suporte",
        title: "Atualizar titulo",
        summary: "Atualizacao pontual do titulo na pagina de suporte.",
        workerMode: "github_worker",
        scopeClassification: "frontend_copy",
        riskLevel: "low",
        branchName: "ai-editor/task-demo",
        commitMessage: "feat(ai-editor): atualizar titulo",
        steps: [],
        filesAnalyzed: ["src/pages/public/Support.tsx"],
        filesPlanned: ["src/pages/public/Support.tsx"],
        sensitiveChange: false,
        sensitiveReasons: [],
        requiresExplicitPublishConfirmation: true,
        fileChanges: [],
      },
      repository: "studio4x/mariana-explica",
      files: [
        {
          filePath: "src/pages/public/Support.tsx",
          language: "tsx",
          content: "old content",
        },
      ],
    })

    expect(result.providerUsed).toBe("gemini")
    expect(result.modelUsed).toBe("gemini-2.0-flash")
    expect(result.changedFiles).toHaveLength(1)
    expect(result.changedFiles[0]?.filePath).toBe("src/pages/public/Support.tsx")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("uses a deterministic fallback for simple support title requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateTaskFileChanges({
      providers: [
        { provider: "openai", apiKey: "openai-key", model: "gpt-4.1-mini" },
        { provider: "gemini", apiKey: "gemini-key", model: "gemini-2.0-flash" },
      ],
      prompt: "altere o texto de um titulo da pagina /suporte apenas para teste do Editor IA Irrestrito",
      plan: {
        normalizedPrompt: "altere o texto de um titulo da pagina /suporte apenas para teste do Editor IA Irrestrito",
        title: "Atualizar titulo",
        summary: "Atualizacao pontual do titulo na pagina de suporte.",
        workerMode: "github_worker",
        scopeClassification: "frontend_copy",
        riskLevel: "low",
        branchName: "ai-editor/task-demo",
        commitMessage: "feat(ai-editor): atualizar titulo",
        steps: [],
        filesAnalyzed: ["src/pages/public/Support.tsx"],
        filesPlanned: ["src/pages/public/Support.tsx"],
        sensitiveChange: false,
        sensitiveReasons: [],
        requiresExplicitPublishConfirmation: true,
        fileChanges: [],
      },
      repository: "studio4x/mariana-explica",
      files: [
        {
          filePath: "src/pages/public/Support.tsx",
          language: "tsx",
          content: "<h1>Como podemos ajudar?</h1>",
        },
      ],
    })

    expect(result.providerUsed).toBe("deterministic")
    expect(result.modelUsed).toBe("rule-based-support-title")
    expect(result.changedFiles[0]?.content).toContain("Teste do Editor IA Irrestrito")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
