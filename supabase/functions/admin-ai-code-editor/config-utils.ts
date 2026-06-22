import type { AiCodeEditorConfigValue } from "./task-state.ts"

export function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function ensureValidConfigPatch(value: unknown) {
  if (value !== undefined && !isPlainObject(value)) {
    throw new Error("configValue invalido")
  }
}

export function mergeConfigValue(
  current: AiCodeEditorConfigValue,
  patch?: Partial<AiCodeEditorConfigValue>,
) {
  return {
    ...current,
    ...(patch ?? {}),
    provider_statuses: {
      ...current.provider_statuses,
      ...(patch?.provider_statuses ?? {}),
    },
  } satisfies AiCodeEditorConfigValue
}
