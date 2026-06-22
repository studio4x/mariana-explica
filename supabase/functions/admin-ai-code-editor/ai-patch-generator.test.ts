import { beforeEach, describe, expect, it, vi } from "vitest"
import { AiPatchGenerationError, generateTaskFileChanges } from "./ai-patch-generator.ts"

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

  it("uses deterministic exact text replacement after provider quota failures when requested", async () => {
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
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "RESOURCE_EXHAUSTED: free_tier quota reached",
          },
        }),
      })

    vi.stubGlobal("fetch", fetchMock)

    const result = await generateTaskFileChanges({
      providers: [
        { provider: "openai", apiKey: "openai-key", model: "gpt-4.1-mini" },
        { provider: "gemini", apiKey: "gemini-key", model: "gemini-2.0-flash" },
      ],
      preferDeterministicFirst: false,
      prompt:
        'troque o texto "Notas importantes antes de enviares o teu formulário:" por "Notas importantes antes de enviares o teu formulário: TESTE" na página /explicacoes',
      plan: {
        normalizedPrompt:
          'troque o texto "Notas importantes antes de enviares o teu formulário:" por "Notas importantes antes de enviares o teu formulário: TESTE" na página /explicacoes',
        title: "Atualizar titulo",
        summary: "Atualizacao pontual de texto na pagina de explicacoes.",
        workerMode: "github_worker",
        scopeClassification: "frontend_copy",
        riskLevel: "low",
        branchName: "ai-editor/task-demo",
        commitMessage: "feat(ai-editor): atualizar texto",
        steps: [],
        filesAnalyzed: ["src/pages/public/Explicacoes.tsx"],
        filesPlanned: ["src/pages/public/Explicacoes.tsx"],
        sensitiveChange: false,
        sensitiveReasons: [],
        requiresExplicitPublishConfirmation: true,
        fileChanges: [],
      },
      repository: "studio4x/mariana-explica",
      files: [
        {
          filePath: "src/pages/public/Explicacoes.tsx",
          language: "tsx",
          content: "<h2>Notas importantes antes de enviares o teu formulário:</h2>",
        },
      ],
    })

    expect(result.providerUsed).toBe("deterministic")
    expect(result.changedFiles[0]?.content).toContain("TESTE")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns a clear blocked_provider_quota error when all providers fail and no deterministic fallback applies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "You exceeded your current quota, please check your plan and billing details. sk-live-secret-value",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: "RESOURCE_EXHAUSTED: free_tier quota reached",
          },
        }),
      })

    vi.stubGlobal("fetch", fetchMock)

    let capturedError: unknown = null

    await expect(
      generateTaskFileChanges({
        providers: [
          { provider: "openai", apiKey: "openai-key", model: "gpt-4.1-mini" },
          { provider: "gemini", apiKey: "gemini-key", model: "gemini-2.0-flash" },
        ],
        preferDeterministicFirst: false,
        prompt: "altere levemente o layout de um card da pagina /materiais apenas para teste do Editor IA Irrestrito",
        plan: {
          normalizedPrompt: "altere levemente o layout de um card da pagina /materiais apenas para teste do Editor IA Irrestrito",
          title: "Atualizar card",
          summary: "Atualizacao livre do card de materiais.",
          workerMode: "github_worker",
          scopeClassification: "frontend_copy",
          riskLevel: "low",
          branchName: "ai-editor/task-demo",
          commitMessage: "feat(ai-editor): atualizar card",
          steps: [],
          filesAnalyzed: ["src/components/product/ProductCard.tsx"],
          filesPlanned: ["src/components/product/ProductCard.tsx"],
          sensitiveChange: false,
          sensitiveReasons: [],
          requiresExplicitPublishConfirmation: true,
          fileChanges: [],
        },
        repository: "studio4x/mariana-explica",
        files: [
          {
            filePath: "src/components/product/ProductCard.tsx",
            language: "tsx",
            content: "<div>card</div>",
          },
        ],
      }).catch((error) => {
        capturedError = error
        throw error
      }),
    ).rejects.toMatchObject({
      code: "blocked_provider_quota",
    } satisfies Partial<AiPatchGenerationError>)

    expect(capturedError).toBeInstanceOf(AiPatchGenerationError)
    expect((capturedError as AiPatchGenerationError).message).not.toContain("sk-live-secret-value")
  })
})
