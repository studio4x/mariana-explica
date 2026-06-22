import type { AiCodeEditorPlan } from "./planner.ts"
import type { GitHubFileChangeType } from "./github-worker.ts"

export type AiPatchProvider = "openai" | "gemini"
export type AiPatchExecutionProvider = AiPatchProvider | "deterministic"
export type AiPatchGenerationFailureCode = "blocked_provider_quota" | "ai_generation_unavailable"
export type AiPatchProviderFailureType = "quota" | "provider_error" | "not_configured"

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

export interface AiPatchProviderAttempt {
  provider: AiPatchProvider
  model: string
  failureType: AiPatchProviderFailureType
  message: string
  occurredAt: string
}

export interface AiPatchDeterministicAttempt {
  attempted: boolean
  applied: boolean
  message: string
}

export class AiPatchGenerationError extends Error {
  readonly code: AiPatchGenerationFailureCode
  readonly providerAttempts: AiPatchProviderAttempt[]
  readonly deterministicAttempt: AiPatchDeterministicAttempt

  constructor(input: {
    code: AiPatchGenerationFailureCode
    message: string
    providerAttempts: AiPatchProviderAttempt[]
    deterministicAttempt: AiPatchDeterministicAttempt
  }) {
    super(input.message)
    this.name = "AiPatchGenerationError"
    this.code = input.code
    this.providerAttempts = input.providerAttempts
    this.deterministicAttempt = input.deterministicAttempt
  }
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

function sanitizeProviderErrorMessage(message: string) {
  return normalizeText(message)
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
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
    /(?:altera(?:r)?|altere|troca(?:r)?|troque|substitui(?:r)?|substitua|muda(?:r)?|mude).*?"([^"]+)"\s+(?:para|por)\s+"([^"]+)"/i,
    /(?:altera(?:r)?|altere|troca(?:r)?|troque|substitui(?:r)?|substitua|muda(?:r)?|mude).*?'([^']+)'\s+(?:para|por)\s+'([^']+)'/i,
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

function countOccurrences(content: string, searchText: string) {
  if (!searchText) return 0

  let count = 0
  let startIndex = 0
  while (true) {
    const nextIndex = content.indexOf(searchText, startIndex)
    if (nextIndex === -1) break
    count += 1
    startIndex = nextIndex + searchText.length
  }

  return count
}

function replaceFirstOccurrence(content: string, searchText: string, replacementText: string) {
  const index = content.indexOf(searchText)
  if (index === -1) return content
  return `${content.slice(0, index)}${replacementText}${content.slice(index + searchText.length)}`
}

function tryGenerateExactTextReplacement(input: {
  prompt: string
  files: RepositoryFileContext[]
}) {
  const explicitReplacement = extractQuotedTextReplacement(input.prompt)
  if (!explicitReplacement?.currentText || !explicitReplacement.nextText) {
    return {
      success: false as const,
      message: "O fallback deterministico exige texto atual e texto novo entre aspas.",
    }
  }

  const matches = input.files
    .map((file) => ({
      file,
      occurrences: countOccurrences(file.content, explicitReplacement.currentText),
    }))
    .filter((item) => item.occurrences > 0)

  const totalOccurrences = matches.reduce((sum, item) => sum + item.occurrences, 0)
  if (totalOccurrences === 0) {
    return {
      success: false as const,
      message: `Nao encontrei o texto "${explicitReplacement.currentText}" nos arquivos candidatos desta task.`,
    }
  }

  if (totalOccurrences > 1) {
    return {
      success: false as const,
      message:
        `Encontrei ${totalOccurrences} ocorrencias de "${explicitReplacement.currentText}" nos arquivos candidatos. ` +
        "Especifica melhor o alvo antes de aplicar o fallback deterministico.",
    }
  }

  const matchedFile = matches[0]?.file
  if (!matchedFile) {
    return {
      success: false as const,
      message: "Nao foi possivel determinar com seguranca o arquivo alvo do fallback deterministico.",
    }
  }

  return {
    success: true as const,
    providerUsed: "deterministic" as const,
    modelUsed: "rule-based-exact-text-replacement",
    summary: `Troca deterministica aplicada em ${matchedFile.filePath}.`,
    executionNotes: "Patch real gerado por substituicao textual exata sem depender de quota externa.",
    riskLevel: "low" as const,
    changedFiles: [
      {
        filePath: matchedFile.filePath,
        changeType: "modified" as const,
        summary: `Substituicao textual exata de "${explicitReplacement.currentText}" por "${explicitReplacement.nextText}".`,
        rationale: "Pedido simples de texto resolvido por fallback deterministico com alvo unico.",
        language: matchedFile.language || "text",
        content: replaceFirstOccurrence(
          matchedFile.content,
          explicitReplacement.currentText,
          explicitReplacement.nextText,
        ),
      },
    ],
  }
}

function tryGenerateDeterministicChanges(input: {
  prompt: string
  plan: AiCodeEditorPlan
  files: RepositoryFileContext[]
}) {
  const exactReplacement = tryGenerateExactTextReplacement(input)
  if (exactReplacement.success) {
    return exactReplacement
  }

  const normalizedPrompt = normalizePrompt(input.prompt)
  const supportFile = input.files.find((file) => file.filePath === "src/pages/public/Support.tsx")
  const explicitReplacement = extractQuotedTextReplacement(input.prompt)

  if (
    supportFile &&
    normalizedPrompt.includes("/suporte") &&
    (normalizedPrompt.includes("titulo") || normalizedPrompt.includes("texto") || normalizedPrompt.includes("heading"))
  ) {
    const headingMatch = supportFile.content.match(/(<h1\b[^>]*>)([^<]+)(<\/h1>)/)
    if (!headingMatch) {
      return {
        success: false as const,
        message: "Nao encontrei o titulo principal esperado na pagina /suporte.",
      }
    }

    const currentHeading = normalizeText(headingMatch[2])
    let nextHeading = explicitReplacement?.nextText ?? ""

    if (!nextHeading) {
      nextHeading = normalizedPrompt.includes("teste do editor ia irrestrito")
        ? "Como podemos ajudar? | Teste do Editor IA Irrestrito"
        : "Como podemos ajudar no suporte?"
    }

    if (explicitReplacement?.currentText && explicitReplacement.currentText !== currentHeading) {
      return {
        success: false as const,
        message: "O texto atual indicado nao corresponde ao titulo principal encontrado na pagina /suporte.",
      }
    }

    if (!nextHeading || nextHeading === currentHeading) {
      return {
        success: false as const,
        message: "O fallback deterministico nao encontrou um novo titulo valido para aplicar em /suporte.",
      }
    }

    return {
      success: true as const,
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

  return {
    success: false as const,
    message: exactReplacement.message || "Nenhum fallback deterministico seguro foi reconhecido para esta task.",
  }
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
  preferDeterministicFirst?: boolean
}) {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(input)
  const responseSchema = buildResponseSchema()
  const providerAttempts: AiPatchProviderAttempt[] = []
  const preferDeterministicFirst = input.preferDeterministicFirst !== false

  const deterministic = tryGenerateDeterministicChanges(input)
  if (preferDeterministicFirst && deterministic.success) {
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
      const rawMessage = error instanceof Error ? error.message : String(error)
      providerAttempts.push({
        provider: provider.provider,
        model: provider.model,
        failureType: isQuotaExceededErrorMessage(rawMessage) ? "quota" : "provider_error",
        message: sanitizeProviderErrorMessage(rawMessage),
        occurredAt: new Date().toISOString(),
      })
    }
  }

  if (!preferDeterministicFirst && deterministic.success) {
    return deterministic
  }

  if (input.providers.length === 0) {
    throw new AiPatchGenerationError({
      code: "ai_generation_unavailable",
      message:
        "A geracao livre por IA esta indisponivel porque nao ha providers configurados e nao encontrei fallback deterministico seguro para este pedido.",
      providerAttempts,
      deterministicAttempt: {
        attempted: true,
        applied: false,
        message: deterministic.message,
      },
    })
  }

  const allQuotaFailures = providerAttempts.length > 0 &&
    providerAttempts.every((attempt) => attempt.failureType === "quota")

  throw new AiPatchGenerationError({
    code: allQuotaFailures ? "blocked_provider_quota" : "ai_generation_unavailable",
    message: allQuotaFailures
      ? "A geracao livre por IA esta temporariamente indisponivel porque os providers configurados retornaram erro de quota. Configure creditos/limites em OpenAI ou Gemini, ou use uma alteracao deterministica suportada."
      : "Nao foi possivel gerar um patch real confiavel com os providers configurados nem com o fallback deterministico disponivel para esta task.",
    providerAttempts,
    deterministicAttempt: {
      attempted: true,
      applied: false,
      message: deterministic.success
        ? "O fallback deterministico estava disponivel, mas esta task ficou reservada para geracao por IA."
        : deterministic.message,
    },
  })
}
