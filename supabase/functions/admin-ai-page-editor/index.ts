import { extractRequestAuditContext, requireAdmin, writeAuditLog } from "../_shared/mod.ts"
import { badRequest, forbidden, unprocessable } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { createServiceClient } from "../_shared/supabase.ts"

type Action = "get_config" | "update_config" | "test_providers" | "generate_proposal"

interface AttachmentInput {
  name: string
  mime_type: string
  data_url: string
  size_bytes: number
}

interface Body {
  action: Action
  slug?: string
  title?: string
  path?: string
  message?: string
  configValue?: Record<string, unknown>
  geminiApiKey?: string | null
  openaiApiKey?: string | null
  currentLayoutJson?: Record<string, unknown>
  currentStyleJson?: Record<string, unknown>
  currentHtml?: string
  attachments?: AttachmentInput[]
}

const CONFIG_KEY = "ai_page_editor_config"
const GEMINI_SECRET_NAME = "mariana_explica_ai_gemini_api_key"
const OPENAI_SECRET_NAME = "mariana_explica_ai_openai_api_key"
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
const MAX_PROMPT_LENGTH = 24_000
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    explanation: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    proposal: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string" },
        title: { type: "string" },
        layout_json: {
          type: "object",
          additionalProperties: true,
        },
        style_json: {
          type: "object",
          additionalProperties: true,
        },
        metadata: {
          type: "object",
          additionalProperties: true,
        },
      },
      required: ["slug", "title", "layout_json", "style_json", "metadata"],
    },
  },
  required: ["summary", "explanation", "warnings", "proposal"],
} as const

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => String(item ?? "").trim()).filter(Boolean)
}

function normalizeProvider(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "openai" ? "openai" : "gemini"
}

function normalizeConfigValue(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const allowedPaths = normalizeStringArray(value.allowed_paths)

  return {
    enabled: value.enabled === true,
    launcher_label: normalizeString(value.launcher_label, "Editar com IA"),
    allowed_paths: allowedPaths,
    primary_provider: normalizeProvider(value.primary_provider),
    fallback_provider: normalizeProvider(value.fallback_provider === "gemini" ? "gemini" : "openai"),
    gemini_model: normalizeString(value.gemini_model, DEFAULT_GEMINI_MODEL),
    openai_model: normalizeString(value.openai_model, DEFAULT_OPENAI_MODEL),
    max_attachments: Math.max(0, Math.min(6, Number(value.max_attachments ?? 2))),
    max_attachment_size_mb: Math.max(1, Math.min(20, Number(value.max_attachment_size_mb ?? 8))),
    base_prompt: normalizeString(value.base_prompt, ""),
    require_confirmation: value.require_confirmation !== false,
    panel_width: String(value.panel_width ?? "wide") === "compact" ? "compact" : "wide",
  }
}

function normalizeSecretStatus(geminiPresent: boolean, openaiPresent: boolean) {
  return {
    gemini_api_key_present: geminiPresent,
    openai_api_key_present: openaiPresent,
  }
}

function parseJsonFromString(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function extractDataUrlParts(dataUrl: string) {
  const trimmed = String(dataUrl ?? "").trim()
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i)
  if (!match) return null
  return {
    mimeType: match[1],
    base64: match[2],
  }
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

function readResponseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback
  const record = payload as Record<string, unknown>
  if (typeof record.error === "object" && record.error) {
    const errorRecord = record.error as Record<string, unknown>
    return normalizeString(errorRecord.message, fallback)
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
    normalized.includes("retry in")
  )
}

async function readConfig(serviceClient: ReturnType<typeof createServiceClient>) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_by,updated_at")
    .eq("config_key", CONFIG_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  const config = normalizeConfigValue(data?.config_value ?? {})
  return {
    config_key: data?.config_key ?? CONFIG_KEY,
    config_value: config,
    description: data?.description ?? "Configuração do editor via IA",
    is_public: data?.is_public ?? false,
    updated_at: data?.updated_at ?? null,
  }
}

async function upsertConfig(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  configValue: ReturnType<typeof normalizeConfigValue>,
) {
  const { data, error } = await serviceClient
    .from("site_config")
    .upsert(
      {
        config_key: CONFIG_KEY,
        config_value: configValue,
        description:
          "Configuração do editor via IA embutido no frontend. As chaves sensíveis ficam no backend seguro.",
        is_public: false,
        updated_by: userId,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return {
    config_key: data.config_key,
    config_value: normalizeConfigValue(data.config_value),
    description: data.description,
    is_public: data.is_public,
    updated_at: data.updated_at,
  }
}

async function readSecret(serviceClient: ReturnType<typeof createServiceClient>, name: string) {
  const { data, error } = await serviceClient.rpc("get_platform_vault_secret", {
    p_name: name,
  })

  if (error) {
    throw error
  }

  return typeof data === "string" && data.trim() ? data.trim() : null
}

async function writeSecret(
  serviceClient: ReturnType<typeof createServiceClient>,
  name: string,
  secret: string,
  description: string,
) {
  const { error } = await serviceClient.rpc("upsert_platform_vault_secret", {
    p_name: name,
    p_secret: secret,
    p_description: description,
  })

  if (error) {
    throw error
  }
}

function buildSystemPrompt(config: ReturnType<typeof normalizeConfigValue>, currentTitle: string, currentPath: string) {
  return [
    config.base_prompt || "Atua como editora sênior da Mariana Explica.",
    "Modo padrão: alteração cirúrgica e localizada.",
    "Preserva a estrutura visual, o layout, o grid, o header, o footer, a navegação, os CTAs, os estados de loading/erro/vazio e a lógica funcional existente.",
    "Não alteres tipografia, cores, espaçamentos, alinhamentos, responsividade, ordem dos blocos ou wrappers globais a menos que o usuário peça isso de forma expressa.",
    "Se a solicitação puder ser atendida com uma mudança pontual, faz apenas essa mudança e mantém todo o resto igual.",
    "Se o pedido implicar mudanças estruturais ou de layout, deves assinalar isso claramente em warnings e evitar reestruturar a página sem pedido explícito.",
    "Quando a página já estiver em blocos, devolve a mesma estrutura de blocos e altera só o conteúdo necessário. Mantém os ids dos blocos, a ordem e os estilos de layout sempre que possível.",
    "Não alteres o admin nem áreas privadas.",
    "Quando precisares propor edição, devolve JSON válido apenas com summary, explanation, warnings e proposal.",
    `Página atual: ${currentTitle} (${currentPath})`,
    "A proposta deve continuar compatível com o builder atual de páginas públicas.",
  ].join("\n")
}

function buildUserPrompt(input: {
  message: string
  currentHtml: string
  currentLayoutJson: Record<string, unknown>
  currentStyleJson: Record<string, unknown>
  attachments: AttachmentInput[]
}) {
  const attachmentsSummary = input.attachments.length
    ? input.attachments
        .map(
          (attachment, index) =>
            `${index + 1}. ${attachment.name} (${attachment.mime_type}, ${Math.round(attachment.size_bytes / 1024)} KB)`,
        )
        .join("\n")
    : "Nenhum anexo"

  const prompt = [
    "Pedido do editor:",
    input.message.trim(),
    "",
    "Regra de execução:",
    "Executa apenas a alteração pedida, de forma pontual.",
    "Mantém o layout e a estrutura original inalterados, salvo se o pedido mencionar explicitamente redesign, reorganização, troca de secções, mudança de grid ou mudança visual ampla.",
    "Se houver ambiguidade, preferir a menor alteração possível e avisar em warnings.",
    "Se a página atual já usa projectData.blocks, devolve a mesma estrutura e muda apenas o(s) bloco(s) necessário(s), sem recriar a página do zero.",
    "Se precisares mudar apenas uma frase, altera apenas o campo de conteúdo do bloco correspondente.",
    "",
    "HTML atual de referência:",
    input.currentHtml.slice(0, MAX_PROMPT_LENGTH),
    "",
    "Layout JSON atual:",
    JSON.stringify(input.currentLayoutJson).slice(0, MAX_PROMPT_LENGTH),
    "",
    "Style JSON atual:",
    JSON.stringify(input.currentStyleJson).slice(0, MAX_PROMPT_LENGTH),
    "",
    "Anexos:",
    attachmentsSummary,
    "",
    "Responde apenas com JSON válido.",
  ].join("\n")

  return prompt.slice(0, MAX_PROMPT_LENGTH)
}

function getResponseSchema() {
  return proposalSchema
}

function buildFallbackRichTextBlock(html: string) {
  return {
    id: `ai-text-${crypto.randomUUID()}`,
    type: "rich_text",
    content: html,
    layout: {
      gridColumns: 12,
      align: "left",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      backgroundColor: "transparent",
      backgroundImageUrl: "",
      backgroundImageSize: "cover",
      borderRadius: 0,
      contentAlignX: "stretch",
      contentAlignY: "top",
      contentGap: 0,
      minHeight: 0,
    },
  }
}

function coerceLayoutJsonToBuilderCompatibleJson(layoutJson: Record<string, unknown>) {
  const record = layoutJson && typeof layoutJson === "object" ? layoutJson : {}
  const projectData =
    record.projectData && typeof record.projectData === "object"
      ? (record.projectData as Record<string, unknown>)
      : null

  const rootBlocks = Array.isArray(record.blocks) ? record.blocks : null
  const projectBlocks = Array.isArray(projectData?.blocks) ? projectData.blocks : null
  const htmlFromRecord = typeof record.html === "string" ? record.html.trim() : ""
  const htmlFromProjectData = projectData && typeof projectData.html === "string" ? String(projectData.html).trim() : ""
  const html = htmlFromRecord || htmlFromProjectData

  if (projectBlocks && projectBlocks.length > 0) {
    return {
      ...record,
      projectData: {
        ...projectData,
        blocks: projectBlocks,
      },
    }
  }

  if (rootBlocks && rootBlocks.length > 0) {
    return {
      ...record,
      projectData: {
        ...(projectData ?? {}),
        blocks: rootBlocks,
      },
    }
  }

  if (html) {
    return {
      ...record,
      projectData: {
        ...(projectData ?? {}),
        blocks: [buildFallbackRichTextBlock(html)],
      },
      html,
    }
  }

  return null
}

async function callGemini(input: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  attachments: AttachmentInput[]
}) {
  const parts = [{ text: input.userPrompt }]
  for (const attachment of input.attachments) {
    const parsed = extractDataUrlParts(attachment.data_url)
    if (!parsed) continue
    parts.push({
      inline_data: {
        mime_type: parsed.mimeType,
        data: parsed.base64,
      },
    } as Record<string, unknown>)
  }

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
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseJsonSchema: getResponseSchema(),
        },
      }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseErrorMessage(payload, `Gemini retornou ${response.status}`))
  }

  const text = extractTextFromGeminiResponse(payload)
  if (!text.trim()) {
    throw unprocessable("Gemini não devolveu um JSON válido")
  }

  return {
    raw: payload,
    text,
  }
}

async function callOpenAI(input: {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  attachments: AttachmentInput[]
}) {
  const inputItems: Array<Record<string, unknown>> = [
    {
      role: "user",
      content: [{ type: "input_text", text: input.userPrompt }],
    },
  ]

  for (const attachment of input.attachments) {
    if (!attachment.data_url.trim()) continue
    inputItems.push({
      role: "user",
      content: [
        {
          type: "input_image",
          image_url: attachment.data_url,
          detail: "high",
        },
      ],
    })
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      instructions: input.systemPrompt,
      input: inputItems,
      temperature: 0.3,
      max_output_tokens: 3000,
      text: {
        format: {
          type: "json_schema",
          name: "ai_page_editor_proposal",
          strict: true,
          schema: getResponseSchema(),
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseErrorMessage(payload, `OpenAI retornou ${response.status}`))
  }

  const text = extractTextFromOpenAIResponse(payload)
  if (!text.trim()) {
    throw unprocessable("OpenAI não devolveu um JSON válido")
  }

  return {
    raw: payload,
    text,
  }
}

function validateProposal(value: unknown) {
  if (!value || typeof value !== "object") {
    throw unprocessable("Resposta da IA em formato inválido")
  }

  const record = value as Record<string, unknown>
  const summary = normalizeString(record.summary)
  const explanation = normalizeString(record.explanation)
  const warnings = normalizeStringArray(record.warnings)
  const proposal = record.proposal && typeof record.proposal === "object" ? (record.proposal as Record<string, unknown>) : null

  if (!summary) throw unprocessable("A IA não devolveu um resumo válido")
  if (!explanation) throw unprocessable("A IA não devolveu uma explicação válida")
  if (!proposal) throw unprocessable("A IA não devolveu uma proposta válida")

  const slug = normalizeString(proposal.slug)
  const title = normalizeString(proposal.title)
  const layoutJson = proposal.layout_json && typeof proposal.layout_json === "object" ? (proposal.layout_json as Record<string, unknown>) : null
  const styleJson = proposal.style_json && typeof proposal.style_json === "object" ? (proposal.style_json as Record<string, unknown>) : null
  const metadata = proposal.metadata && typeof proposal.metadata === "object" ? (proposal.metadata as Record<string, unknown>) : {}

  if (!slug || !title || !layoutJson || !styleJson) {
    throw unprocessable("A proposta da IA está incompleta")
  }

  const normalizedLayoutJson = coerceLayoutJsonToBuilderCompatibleJson(layoutJson)
  if (!normalizedLayoutJson) {
    throw unprocessable("A proposta da IA precisa incluir projectData.blocks ou um HTML convertível")
  }

  return {
    summary,
    explanation,
    warnings,
    proposal: {
      slug,
      title,
      layout_json: normalizedLayoutJson,
      style_json: styleJson,
      metadata,
    },
  }
}

async function getProviderSecrets(serviceClient: ReturnType<typeof createServiceClient>) {
  const [geminiApiKey, openaiApiKey] = await Promise.all([
    readSecret(serviceClient, GEMINI_SECRET_NAME),
    readSecret(serviceClient, OPENAI_SECRET_NAME),
  ])

  return {
    geminiApiKey,
    openaiApiKey,
    secret_status: normalizeSecretStatus(Boolean(geminiApiKey), Boolean(openaiApiKey)),
  }
}

async function testProviderByName(input: {
  provider: "gemini" | "openai"
  model: string
  apiKey: string | null
}) {
  if (!input.apiKey) {
    return {
      ok: false,
      status: "missing_key" as const,
      message: `${input.provider} sem chave configurada`,
    }
  }

  const systemPrompt = "Responde apenas com JSON válido com o formato {\"ok\":true}."
  const userPrompt = "Gera JSON mínimo para testar conectividade."

  if (input.provider === "gemini") {
    try {
      const result = await callGemini({
        apiKey: input.apiKey,
        model: input.model || DEFAULT_GEMINI_MODEL,
        systemPrompt,
        userPrompt,
        attachments: [],
      })
      const parsed = parseJsonFromString(result.text)
      return {
        ok: Boolean(parsed && typeof parsed === "object"),
        status: "ok" as const,
        message: "Gemini respondeu com sucesso",
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no Gemini"
      return {
        ok: false,
        status: isQuotaExceededErrorMessage(message) ? "quota_exceeded" : "error",
        message,
      }
    }
  }

  try {
    const result = await callOpenAI({
      apiKey: input.apiKey,
      model: input.model || DEFAULT_OPENAI_MODEL,
      systemPrompt,
      userPrompt,
      attachments: [],
    })
    const parsed = parseJsonFromString(result.text)
    return {
      ok: Boolean(parsed && typeof parsed === "object"),
      status: "ok" as const,
      message: "OpenAI respondeu com sucesso",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no OpenAI"
    return {
      ok: false,
      status: isQuotaExceededErrorMessage(message) ? "quota_exceeded" : "error",
      message,
    }
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)
    const serviceClient = createServiceClient()
    const auditMeta = extractRequestAuditContext(req)
    const body = await readJsonBody<Body>(req)

    if (!body.action) {
      throw badRequest("action e obrigatorio")
    }

    if (body.action === "get_config") {
      const [config, secrets] = await Promise.all([readConfig(serviceClient), getProviderSecrets(serviceClient)])

      return jsonResponse({
        success: true,
        request_id: requestId,
        config,
        secret_status: secrets.secret_status,
      })
    }

    if (body.action === "update_config") {
      const configValue = normalizeConfigValue(body.configValue ?? {})
      const savedConfig = await upsertConfig(serviceClient, context.user.id, configValue)

      if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) {
        await writeSecret(
          serviceClient,
          GEMINI_SECRET_NAME,
          body.geminiApiKey.trim(),
          "Chave Gemini usada pelo editor via IA",
        )
      }

      if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) {
        await writeSecret(
          serviceClient,
          OPENAI_SECRET_NAME,
          body.openaiApiKey.trim(),
          "Chave OpenAI usada como fallback do editor via IA",
        )
      }

      const secrets = await getProviderSecrets(serviceClient)

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_config_updated",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          enabled: configValue.enabled,
          allowed_paths: configValue.allowed_paths,
          primary_provider: configValue.primary_provider,
          fallback_provider: configValue.fallback_provider,
          gemini_secret_present: secrets.secret_status.gemini_api_key_present,
          openai_secret_present: secrets.secret_status.openai_api_key_present,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        config: savedConfig,
        secret_status: secrets.secret_status,
      })
    }

    if (body.action === "test_providers") {
      const config = await readConfig(serviceClient)
      const secrets = await getProviderSecrets(serviceClient)

      const providerOrder = [
        {
          provider: config.config_value.primary_provider,
          model: config.config_value.primary_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.primary_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
        {
          provider: config.config_value.fallback_provider,
          model: config.config_value.fallback_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.fallback_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
      ] as const

      const outcomes = []
      const providerResults = []
      for (const provider of providerOrder) {
        const result = await testProviderByName(provider)
        providerResults.push({
          provider: provider.provider,
          ok: result.ok,
          status: result.status,
          message: result.message,
        })
        outcomes.push(`${provider.provider}: ${result.message}`)
      }

      const anyQuotaIssue = providerResults.some((item) => item.status === "quota_exceeded")
      const anyMissingKey = providerResults.some((item) => item.status === "missing_key")
      const summary = anyQuotaIssue
        ? "Teste executado, mas um provedor excedeu a quota disponível."
        : anyMissingKey
          ? "Teste executado, mas ao menos um provedor não tem chave configurada."
          : "Teste dos provedores executado com sucesso."

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_provider_tested",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          outcomes,
        },
        ...auditMeta,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        provider_used: null,
        details: outcomes.join(" | "),
        summary,
        provider_results: providerResults,
        secret_status: secrets.secret_status,
      })
    }

    if (body.action === "generate_proposal") {
      const slug = normalizeString(body.slug)
      const title = normalizeString(body.title)
      const path = normalizeString(body.path)
      const message = normalizeString(body.message)
      const currentHtml = normalizeString(body.currentHtml)
      const currentLayoutJson = body.currentLayoutJson && typeof body.currentLayoutJson === "object" ? body.currentLayoutJson : {}
      const currentStyleJson = body.currentStyleJson && typeof body.currentStyleJson === "object" ? body.currentStyleJson : {}
      const attachments = Array.isArray(body.attachments) ? body.attachments : []

      if (!slug) throw badRequest("slug e obrigatorio")
      if (!title) throw badRequest("title e obrigatorio")
      if (!path) throw badRequest("path e obrigatorio")
      if (!message) throw badRequest("message e obrigatorio")
      if (!attachments.every((item) => item && typeof item === "object")) {
        throw badRequest("attachments invalido")
      }

      const config = await readConfig(serviceClient)
      if (!config.config_value.enabled) {
        throw forbidden("Editor via IA desativado")
      }

      if (config.config_value.allowed_paths.length > 0 && !config.config_value.allowed_paths.includes(path)) {
        throw forbidden("Rota nao habilitada para o editor via IA")
      }

      const validAttachments = attachments.map((item, index) => {
        const attachment = item as AttachmentInput
        const name = normalizeString(attachment.name, `anexo-${index + 1}`)
        const mime_type = normalizeString(attachment.mime_type)
        const data_url = normalizeString(attachment.data_url)
        const size_bytes = Math.max(0, Number(attachment.size_bytes ?? 0))
        if (!data_url.startsWith("data:")) {
          throw badRequest(`Anexo ${index + 1} sem data URL valida`)
        }
        if (size_bytes > config.config_value.max_attachment_size_mb * 1024 * 1024) {
          throw badRequest(`Anexo ${index + 1} excede o limite configurado`)
        }
        return {
          name,
          mime_type,
          data_url,
          size_bytes,
        }
      })

      if (validAttachments.length > config.config_value.max_attachments) {
        throw badRequest("Número de anexos acima do limite configurado")
      }

      const secrets = await getProviderSecrets(serviceClient)
      const systemPrompt = buildSystemPrompt(config.config_value, title, path)
      const userPrompt = buildUserPrompt({
        message,
        currentHtml,
        currentLayoutJson,
        currentStyleJson,
        attachments: validAttachments,
      })

      const providerCandidates = [
        {
          provider: config.config_value.primary_provider,
          model: config.config_value.primary_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.primary_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
        {
          provider: config.config_value.fallback_provider,
          model: config.config_value.fallback_provider === "gemini" ? config.config_value.gemini_model : config.config_value.openai_model,
          apiKey: config.config_value.fallback_provider === "gemini" ? secrets.geminiApiKey : secrets.openaiApiKey,
        },
      ] as const

      let lastError: unknown = null
      let rawText = ""
      let providerUsed: "gemini" | "openai" | null = null

      for (const candidate of providerCandidates) {
        if (!candidate.apiKey) {
          lastError = new Error(`${candidate.provider} sem chave configurada`)
          continue
        }

        try {
          const result =
            candidate.provider === "gemini"
              ? await callGemini({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_GEMINI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: validAttachments,
                })
              : await callOpenAI({
                  apiKey: candidate.apiKey,
                  model: candidate.model || DEFAULT_OPENAI_MODEL,
                  systemPrompt,
                  userPrompt,
                  attachments: validAttachments,
                })

          rawText = result.text
          providerUsed = candidate.provider
          lastError = null
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!providerUsed || !rawText.trim()) {
        throw lastError instanceof Error ? lastError : new Error("Nenhum provedor disponível para gerar a proposta")
      }

      const parsed = parseJsonFromString(rawText)
      const proposal = validateProposal(parsed)

      await writeAuditLog(serviceClient, context, {
        action: "admin.ai_page_editor_proposal_generated",
        entityType: "site_config",
        entityId: null,
        metadata: {
          config_key: CONFIG_KEY,
          slug,
          path,
          provider_used: providerUsed,
          attachment_count: validAttachments.length,
        },
        ...auditMeta,
      })

      logInfo("AI page editor proposal generated", {
        request_id: requestId,
        user_id: context.user.id,
        slug,
        path,
        provider_used: providerUsed,
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        provider_used: providerUsed,
        summary: proposal.summary,
        explanation: proposal.explanation,
        warnings: proposal.warnings,
        proposal: proposal.proposal,
      })
    }

    throw badRequest("action invalida")
  } catch (error) {
    logError("Admin AI page editor failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
