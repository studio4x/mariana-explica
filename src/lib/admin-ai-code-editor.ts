import type { AdminAiCodeEditorConfig } from "@/types/app.types"

export interface AdminAiCodeEditorTransitionState {
  showNewEditor: boolean
  showLegacyAiEditor: boolean
  newEditorIsDefault: boolean
}

const DEFAULT_TRANSITION_STATE: AdminAiCodeEditorTransitionState = {
  showNewEditor: false,
  showLegacyAiEditor: true,
  newEditorIsDefault: false,
}

export function resolveAdminAiCodeEditorTransition(
  config?: Pick<AdminAiCodeEditorConfig, "config_value"> | null,
): AdminAiCodeEditorTransitionState {
  if (!config) {
    return DEFAULT_TRANSITION_STATE
  }

  const value = config.config_value
  const showNewEditor = value.enabled === true
  const showLegacyAiEditor = value.legacy_editor_fallback_enabled !== false
  const newEditorIsDefault = showNewEditor && value.make_default === true

  return {
    showNewEditor,
    showLegacyAiEditor,
    newEditorIsDefault,
  }
}
