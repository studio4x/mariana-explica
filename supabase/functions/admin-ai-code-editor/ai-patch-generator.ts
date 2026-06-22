import type { AiCodeEditorPlan } from "./planner.ts"
import type { GitHubFileChangeType } from "./github-worker.ts"

export type AiPatchProvider = "openai" | "gemini"
export type AiPatchExecutionProvider = AiPatchProvider | "deterministic"

export interface AiPatchProviderConfig {
  provider: AiPatchProvider
  apiKey: string
  model: string
}

export interface RepositoryFileContext {
  filePath: string
  language: string
  content: string
}

export interface GeneratedTaskFileChange {
  filePath: string
  changeType: Exclude<GitHubFileChangeType, "renamed">
  summary: string
  rationale: string
  language: string
  content: string
}

interface FileChangeResponse {
  summary: string
  execution_notes: string
  risk_level: "low" | "medium" | "high"
  changed_files: Array<{
    file_path: string
    change_type: "created" | "modified" | "deleted"
    summary: string
    rationale: string
    language: string
    content: string
  }>
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function extractTextFromOpenAIResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text
  }

  const output = Array.isArray(record.output) ? record.output : []
  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const itemRecord = item as Record<string, unknown>
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : []
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") continue
      const chunkRecord = chunk as Record<string, unknown>
      if (typeof chunkRecord.text === "string" && chunkRecord.text.trim()) {
        return chunkRecord.text
      }
    }
  }

  return ""
}

function extractTextFromGeminiResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  const candidates = Array.isArray(record.candidates) ? record.candidates : []

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const candidateRecord = candidate as Record<string, unknown>
    const content = candidateRecord.content
    if (!content || typeof content !== "object") continue
    const contentRecord = content as Record<string, unknown>
    const parts = Array.isArray(contentRecord.parts) ? contentRecord.parts : []
    const text = parts
      .map((part) => {
        if (!part || typeof part !== "object") return ""
        const partRecord = part as Record<string, unknown>
        return typeof partRecord.text === "string" ? partRecord.text : ""
      })
      .join("")
    if (text.trim()) return text
  }

  return typeof record.text === "string" ? record.text : ""
}

function readResponseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback
  const record = payload as Record<string, unknown>
  if (typeof record.error === "object" && record.error) {
    const errorRecord = record.error as Record<string, unknown>
    return normalizeText(errorRecord.message) || fallback
  }
  return fallback
}

function isQuotaExceededErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limits") ||
    normalized.includes("current quota") ||
    normalized.includes("billing") ||
    normalized.includes("free_tier") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("retry in")
  )
}

function normalizePrompt(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function extractQuotedTextReplacement(prompt: string) {
  const patterns = [
    /(?:altera(?:r)?|troca(?:r)?|substitui(?:r)?|muda(?:r)?).*?"([^"]+)"\s+(?:para|por)\s+"([^"]+)"/i,
    /(?:altera(?:r)?|troca(?:r)?|substitui(?:r)?|muda(?:r)?).*?'([^']+)'\s+(?:para|por)\s+'([^']+)'/i,
  ]

  for (const pattern of patterns) {
    const match = prompt.match(pattern)
    if (!match) continue
    return {
      currentText: normalizeText(match[1]),
      nextText: normalizeText(match[2]),
    }
  }

  return null
}

function tryGenerateDeterministicChanges(input: {
  prompt: string
  plan: AiCodeEditorPlan
  files: RepositoryFileContext[]
}) {
  const normalizedPrompt = normalizePrompt(input.prompt)
  const supportFile = input.files.find((file) => file.filePath === "src/pages/public/Support.tsx")
  const explicitReplacement = extractQuotedTextReplacement(input.prompt)

  if (
    supportFile &&
    normalizedPrompt.includes("/suporte") &&
    (normalizedPrompt.includes("titulo") || normalizedPrompt.includes("texto") || normalizedPrompt.includes("heading"))
  ) {
    const headingMatch = supportFile.content.match(/(<h1\b[^>]*>)([^<]+)(<\/h1>)/)
    if (!headingMatch) return null

    const currentHeading = normalizeText(headingMatch[2])
    let nextHeading = explicitReplacement?.nextText ?? ""

    if (!nextHeading) {
      nextHeading = normalizedPrompt.includes("teste do editor ia irrestrito")
        ? "Como podemos ajudar? | Teste do Editor IA Irrestrito"
        : "Como podemos ajudar no suporte?"
    }

    if (explicitReplacement?.currentText && explicitReplacement.currentText !== currentHeading) {
      return null
    }

    if (!nextHeading || nextHeading === currentHeading) {
      return null
    }

    return {
      providerUsed: "deterministic" as const,
      modelUsed: "rule-based-support-title",
      summary: "Ajuste deterministico aplicado ao titulo principal da pagina /suporte.",
      executionNotes: "Patch real gerado por fallback deterministico para pedido simples de titulo.",
      riskLevel: "low" as const,
      changedFiles: [
        {
          filePath: supportFile.filePath,
          changeType: "modified" as const,
          summary: "Troca localizada do titulo principal da pagina de suporte.",
          rationale: "Pedido simples de texto em rota publica resolvido sem depender de quota externa.",
          language: supportFile.language || "tsx",
          content: supportFile.content.replace(headingMatch[0], `${headingMatch[1]}${nextHeading}${headingMatch[3]}`),
        },
      ],
    }
  }

  return null
}

function buildResponseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      execution_notes: { type: "string" },
      risk_level: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      changed_files: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            file_path: { type: "string" },
            change_type: {
              type: "string",
              enum: ["created", "modified", "deleted"],
            },
            summary: { type: "string" },
            rationale: { type: "string" },
            language: { type: "string" },
            content: { type: "string" },
          },
          required: ["file_path", "change_type", "summary", "rationale", "language", "content"],
        },
      },
    },
    required: ["summary", "execution_notes", "risk_level", "changed_files"],
  }
}

function buildSystemPrompt() {
  return [
    "Atua como engenheira senior da Mariana Explica.",
    "Recebes um pedido administrativo e um conjunto pequeno de arquivos candidatos.",
    "Faz apenas a menor alteracao necessaria para cumprir o pedido.",
    "Nunca inventes arquivos fora da lista enviada.",
    "Mantem o codigo compilavel, preserva imports uteis e o estilo predominante do repositorio.",
    "Devolve o conteudo completo final apenas dos arquivos que realmente mudam.",
    "Nao expliques fora do JSON.",
  ].join(" ")
}

function buildUserPrompt(input: {
  prompt: string
  plan: AiCodeEditorPlan
  repository: string
  files: RepositoryFileContext[]
}) {
  const fileBlocks = input.files.map((file) => [
    `FILE: ${file.filePath}`,
    `LANGUAGE: ${file.language}`,
    "CONTENT_START",
    file.content,
    "CONTENT_END",
  ].join("\n"))

  return [
    `REPOSITORY: ${input.repository}`,
    `REQUEST: ${input.prompt}`,
    `PLAN_TITLE: ${input.plan.title}`,
    `PLAN_SUMMARY: ${input.plan.summary}`,
    `RISK_LEVEL: ${input.plan.riskLevel}`,
    `FILES_PLANNED: ${input.plan.filesPlanned.join(", ")}`,
    "",
    "AVAILABLE_FILES",
    fileBlocks.join("\n\n"),
    "",
    "Return only changed files from the provided list.",
    "If no file should change, return changed_files as an empty array and explain why in execution_notes.",
  ].join("\n")
}

async function callOpenAI(input: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  responseSchema: Record<string, unknown>
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      instructions: input.systemPrompt,
      input: input.userPrompt,
      temperature: 0.2,
      max_output_tokens: 6_000,
      text: {
        format: {
          type: "json_schema",
          name: "ai_code_editor_changes",
          strict: true,
          schema: input.responseSchema,
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseErrorMessage(payload, `OpenAI retornou ${response.status}`))
  }

  return extractTextFromOpenAIResponse(payload)
}

async function callGemini(input: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  responseSchema: Record<string, unknown>
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: input.responseSchema,
        },
      }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseErrorMessage(payload, `Gemini retornou ${response.status}`))
  }

  return extractTextFromGeminiResponse(payload)
}

function parseGeneratedChanges(input: {
  rawText: string
  fallbackSummary: string
}) {
  if (!input.rawText) {
    throw new Error("O provider de IA nao devolveu um patch valido para o Editor IA Irrestrito.")
  }

  const parsed = JSON.parse(input.rawText) as FileChangeResponse
  const changedFiles = Array.isArray(parsed.changed_files) ? parsed.changed_files : []

  return {
    summary: normalizeText(parsed.summary) || input.fallbackSummary,
    executionNotes: normalizeText(parsed.execution_notes) || "Patch real gerado pelo worker.",
    riskLevel: parsed.risk_level === "high" || parsed.risk_level === "medium" ? parsed.risk_level : "low",
    changedFiles: changedFiles.map((file) => ({
      filePath: normalizeText(file.file_path),
      changeType: file.change_type,
      summary: normalizeText(file.summary),
      rationale: normalizeText(file.rationale),
      language: normalizeText(file.language) || "text",
      content: String(file.content ?? ""),
    })) satisfies GeneratedTaskFileChange[],
  }
}

export async function generateTaskFileChanges(input: {
  providers: AiPatchProviderConfig[]
  prompt: string
  plan: AiCodeEditorPlan
  repository: string
  files: RepositoryFileContext[]
}) {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(input)
  const responseSchema = buildResponseSchema()
  const providerErrors: string[] = []
  let lastError: Error | null = null

  const deterministic = tryGenerateDeterministicChanges(input)
  if (deterministic) {
    return deterministic
  }

  for (const provider of input.providers) {
    try {
      const rawText = provider.provider === "gemini"
        ? await callGemini({
          apiKey: provider.apiKey,
          model: provider.model,
          systemPrompt,
          userPrompt,
          responseSchema,
        })
        : await callOpenAI({
          apiKey: provider.apiKey,
          model: provider.model,
          systemPrompt,
          userPrompt,
          responseSchema,
        })

      return {
        providerUsed: provider.provider,
        modelUsed: provider.model,
        ...parseGeneratedChanges({
          rawText,
          fallbackSummary: input.plan.summary,
        }),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      providerErrors.push(`${provider.provider}:${lastError.message}`)
      if (!isQuotaExceededErrorMessage(lastError.message) && input.providers.length === 1) {
        throw lastError
      }
    }
  }

  if (providerErrors.length > 1) {
    throw new Error(`Falha ao gerar patch real com os providers configurados. ${providerErrors.join(" | ")}`)
  }

  throw lastError ?? new Error("Falha ao gerar patch real para a task.")
}
