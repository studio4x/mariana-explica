import type { AiCodeEditorPlan } from "./planner.ts"
import type { GitHubFileChangeType } from "./github-worker.ts"

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

interface OpenAiFileChangeResponse {
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

export async function generateTaskFileChanges(input: {
  apiKey: string
  model: string
  prompt: string
  plan: AiCodeEditorPlan
  repository: string
  files: RepositoryFileContext[]
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      instructions: buildSystemPrompt(),
      input: buildUserPrompt(input),
      temperature: 0.2,
      max_output_tokens: 6_000,
      text: {
        format: {
          type: "json_schema",
          name: "ai_code_editor_changes",
          strict: true,
          schema: buildResponseSchema(),
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "object"
        ? normalizeText(((payload as Record<string, unknown>).error as Record<string, unknown>).message)
        : `OpenAI retornou ${response.status}`
    throw new Error(message || `OpenAI retornou ${response.status}`)
  }

  const text = extractTextFromOpenAIResponse(payload)
  if (!text) {
    throw new Error("OpenAI nao devolveu um patch valido para o Editor IA Irrestrito.")
  }

  const parsed = JSON.parse(text) as OpenAiFileChangeResponse
  const changedFiles = Array.isArray(parsed.changed_files) ? parsed.changed_files : []

  return {
    summary: normalizeText(parsed.summary) || input.plan.summary,
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
