export type AiProvider = "gemini" | "openai"

export type AiEditorModelStage =
  | "conversation"
  | "planner"
  | "complex_proposal"
  | "provider_test"

export interface AiEditorConfigValue {
  primary_provider: AiProvider
  fallback_provider: AiProvider
  gemini_model: string
  openai_model: string
  conversation_provider?: AiProvider
  conversation_model?: string
  planner_provider?: AiProvider
  planner_model?: string
  complex_provider?: AiProvider
  complex_model?: string
  fallback_model?: string
}

export interface AiModelSelection {
  provider: AiProvider
  model: string
}

export interface AiModelSelectionWithFallback {
  stage: AiEditorModelStage
  primary: AiModelSelection
  fallback: AiModelSelection
}

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? "").trim() || fallback
}

function normalizeProvider(value: unknown, fallback: AiProvider) {
  return String(value ?? "").trim().toLowerCase() === "openai"
    ? "openai"
    : String(value ?? "").trim().toLowerCase() === "gemini"
      ? "gemini"
      : fallback
}

function getLegacyModelForProvider(provider: AiProvider, config: AiEditorConfigValue) {
  return provider === "gemini"
    ? normalizeString(config.gemini_model, "gemini-2.0-flash")
    : normalizeString(config.openai_model, "gpt-4.1-mini")
}

function getStagePrimary(stage: AiEditorModelStage, config: AiEditorConfigValue): AiModelSelection {
  if (stage === "conversation") {
    const provider = normalizeProvider(config.conversation_provider, normalizeProvider(config.primary_provider, "gemini"))
    return {
      provider,
      model: normalizeString(config.conversation_model, getLegacyModelForProvider(provider, config)),
    }
  }

  if (stage === "planner") {
    const provider = normalizeProvider(config.planner_provider, normalizeProvider(config.primary_provider, "gemini"))
    return {
      provider,
      model: normalizeString(config.planner_model, getLegacyModelForProvider(provider, config)),
    }
  }

  const provider = normalizeProvider(config.complex_provider, normalizeProvider(config.primary_provider, "gemini"))
  return {
    provider,
    model: normalizeString(config.complex_model, getLegacyModelForProvider(provider, config)),
  }
}

function getFallback(config: AiEditorConfigValue): AiModelSelection {
  const provider = normalizeProvider(config.fallback_provider, "openai")
  return {
    provider,
    model: normalizeString(config.fallback_model, getLegacyModelForProvider(provider, config)),
  }
}

export function selectAiModelForStage(
  stage: AiEditorModelStage,
  config: AiEditorConfigValue,
): AiModelSelectionWithFallback {
  if (stage === "provider_test") {
    return {
      stage,
      primary: getStagePrimary("conversation", config),
      fallback: getFallback(config),
    }
  }

  return {
    stage,
    primary: getStagePrimary(stage, config),
    fallback: getFallback(config),
  }
}

