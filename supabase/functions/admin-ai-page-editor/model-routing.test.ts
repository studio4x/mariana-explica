import { describe, expect, it } from "vitest"
import { selectAiModelForStage } from "./model-routing.ts"

describe("selectAiModelForStage", () => {
  it("uses the stage-specific models when they are configured", () => {
    const config = {
      primary_provider: "gemini" as const,
      fallback_provider: "openai" as const,
      gemini_model: "gemini-2.0-flash",
      openai_model: "gpt-4.1-mini",
      conversation_provider: "gemini" as const,
      conversation_model: "gemini-3.1-flash-lite",
      planner_provider: "openai" as const,
      planner_model: "gpt-4.1",
      complex_provider: "gemini" as const,
      complex_model: "gemini-3.1-pro",
      fallback_model: "gpt-4.1-mini",
    }

    expect(selectAiModelForStage("conversation", config)).toMatchObject({
      primary: { provider: "gemini", model: "gemini-3.1-flash-lite" },
      fallback: { provider: "openai", model: "gpt-4.1-mini" },
    })
    expect(selectAiModelForStage("planner", config)).toMatchObject({
      primary: { provider: "openai", model: "gpt-4.1" },
    })
    expect(selectAiModelForStage("complex_proposal", config)).toMatchObject({
      primary: { provider: "gemini", model: "gemini-3.1-pro" },
    })
  })

  it("keeps backward compatibility when only legacy fields exist", () => {
    const config = {
      primary_provider: "openai" as const,
      fallback_provider: "gemini" as const,
      gemini_model: "gemini-2.0-flash",
      openai_model: "gpt-4.1-mini",
    }

    expect(selectAiModelForStage("conversation", config)).toMatchObject({
      primary: { provider: "openai", model: "gpt-4.1-mini" },
      fallback: { provider: "gemini", model: "gemini-2.0-flash" },
    })
    expect(selectAiModelForStage("planner", config)).toMatchObject({
      primary: { provider: "openai", model: "gpt-4.1-mini" },
    })
    expect(selectAiModelForStage("complex_proposal", config)).toMatchObject({
      primary: { provider: "openai", model: "gpt-4.1-mini" },
    })
  })

  it("returns the conversation primary and configured fallback for provider tests", () => {
    const config = {
      primary_provider: "gemini" as const,
      fallback_provider: "openai" as const,
      gemini_model: "gemini-2.0-flash",
      openai_model: "gpt-4.1-mini",
      conversation_provider: "gemini" as const,
      conversation_model: "gemini-3.1-flash-lite",
      fallback_model: "gpt-4.1-mini",
    }

    expect(selectAiModelForStage("provider_test", config)).toMatchObject({
      primary: { provider: "gemini", model: "gemini-3.1-flash-lite" },
      fallback: { provider: "openai", model: "gpt-4.1-mini" },
    })
  })
})
