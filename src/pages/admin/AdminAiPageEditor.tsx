import { useEffect, useMemo, useState } from "react"
import { Check, Plus, RefreshCw, Save, TestTube2, Trash2 } from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import {
  useAdminAiPageEditorConfig,
  useAdminAiPageEditorUsageMetrics,
  useTestAdminAiPageEditorProviders,
  useUpdateAdminAiPageEditorConfig,
} from "@/hooks/useAdmin"
import {
  AI_PAGE_EDITOR_ROUTE_OPTIONS,
} from "@/lib/ai-page-editor"
import { ROUTES } from "@/lib/constants"
import type {
  AdminAiPageEditorConfig,
  AdminAiPageEditorProviderTestResult,
  AdminAiPageEditorUsageAction,
} from "@/types/app.types"

type AllowedPathState = {
  path: string
  label: string
  preset: boolean
}

function splitAllowedPaths(paths: string[]) {
  return paths.map((path) => path.trim()).filter(Boolean)
}

function mergeAllowedPaths(current: AllowedPathState[], nextPath: string) {
  const normalized = nextPath.trim()
  if (!normalized) return current
  if (current.some((item) => item.path === normalized)) return current
  return [...current, { path: normalized, label: normalized, preset: false }]
}

function resolveLegacyModel(
  provider: AdminAiPageEditorConfig["config_value"]["primary_provider"],
  candidates: Array<{
    provider: AdminAiPageEditorConfig["config_value"]["primary_provider"]
    model: string
  }>,
  fallback: string,
) {
  const match = candidates.find((candidate) => candidate.provider === provider && candidate.model.trim())
  return match?.model.trim() || fallback
}

function getDefaultModelForProvider(provider: AdminAiPageEditorConfig["config_value"]["primary_provider"]) {
  return provider === "gemini" ? "gemini-2.0-flash" : "gpt-4.1-mini"
}

const numberFormatter = new Intl.NumberFormat("pt-PT")
const currencyFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

function formatUsageActionLabel(action: AdminAiPageEditorUsageAction) {
  return action === "test_providers" ? "Teste de provedor" : "Pedido do editor"
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem registo"
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return "Sem registo"
  return new Date(parsed).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AdminAiPageEditor() {
  const query = useAdminAiPageEditorConfig()
  const usageQuery = useAdminAiPageEditorUsageMetrics(30)
  const updateMutation = useUpdateAdminAiPageEditorConfig()
  const testMutation = useTestAdminAiPageEditorProviders()
  const [allowedPaths, setAllowedPaths] = useState<AllowedPathState[]>([])
  const [launcherLabel, setLauncherLabel] = useState("Editar com IA")
  const [enabled, setEnabled] = useState(false)
  const [fallbackProvider, setFallbackProvider] = useState<AdminAiPageEditorConfig["config_value"]["fallback_provider"]>("gemini")
  const [conversationProvider, setConversationProvider] = useState<AdminAiPageEditorConfig["config_value"]["primary_provider"]>("openai")
  const [conversationModel, setConversationModel] = useState("gpt-4.1-mini")
  const [plannerProvider, setPlannerProvider] = useState<AdminAiPageEditorConfig["config_value"]["primary_provider"]>("openai")
  const [plannerModel, setPlannerModel] = useState("gpt-4.1-mini")
  const [complexProvider, setComplexProvider] = useState<AdminAiPageEditorConfig["config_value"]["primary_provider"]>("openai")
  const [complexModel, setComplexModel] = useState("gpt-4.1-mini")
  const [fallbackModel, setFallbackModel] = useState("gemini-2.0-flash")
  const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash")
  const [openaiModel, setOpenaiModel] = useState("gpt-4.1-mini")
  const [maxAttachments, setMaxAttachments] = useState(2)
  const [maxAttachmentSizeMb, setMaxAttachmentSizeMb] = useState(8)
  const [basePrompt, setBasePrompt] = useState("")
  const [requireConfirmation, setRequireConfirmation] = useState(true)
  const [panelWidth, setPanelWidth] = useState<AdminAiPageEditorConfig["config_value"]["panel_width"]>("wide")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [customPath, setCustomPath] = useState("")
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [providerTestOutput, setProviderTestOutput] = useState<string | null>(null)
  const [providerTestResults, setProviderTestResults] = useState<AdminAiPageEditorProviderTestResult[]>([])

  const config = query.data
  const usageMetrics = usageQuery.data
  const secretStatus = config?.secret_status ?? {
    gemini_api_key_present: false,
    openai_api_key_present: false,
  }

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza o formulário com a configuração carregada do backend */
  useEffect(() => {
    if (!config) return

    const value = config.config_value
    setEnabled(value.enabled)
    setLauncherLabel(value.launcher_label)
    setAllowedPaths(
      splitAllowedPaths(value.allowed_paths.length > 0 ? value.allowed_paths : AI_PAGE_EDITOR_ROUTE_OPTIONS.map((route) => route.path)).map((path) => ({
        path,
        label: AI_PAGE_EDITOR_ROUTE_OPTIONS.find((item) => item.path === path)?.label ?? path,
        preset: AI_PAGE_EDITOR_ROUTE_OPTIONS.some((item) => item.path === path),
      })),
    )
    setFallbackProvider(value.fallback_provider)
    setConversationProvider(value.conversation_provider ?? value.primary_provider)
    setConversationModel(value.conversation_model ?? (value.primary_provider === "gemini" ? value.gemini_model : value.openai_model))
    setPlannerProvider(value.planner_provider ?? value.primary_provider)
    setPlannerModel(value.planner_model ?? (value.primary_provider === "gemini" ? value.gemini_model : value.openai_model))
    setComplexProvider(value.complex_provider ?? value.primary_provider)
    setComplexModel(value.complex_model ?? (value.primary_provider === "gemini" ? value.gemini_model : value.openai_model))
    setFallbackModel(value.fallback_model ?? (value.fallback_provider === "gemini" ? value.gemini_model : value.openai_model))
    setGeminiModel(value.gemini_model)
    setOpenaiModel(value.openai_model)
    setMaxAttachments(value.max_attachments)
    setMaxAttachmentSizeMb(value.max_attachment_size_mb)
    setBasePrompt(value.base_prompt)
    setRequireConfirmation(value.require_confirmation)
    setPanelWidth(value.panel_width)
  }, [config])
  /* eslint-enable react-hooks/set-state-in-effect */

  const routeCards = useMemo(
    () =>
      AI_PAGE_EDITOR_ROUTE_OPTIONS.map((route) => {
        const active = allowedPaths.some((item) => item.path === route.path)
        return {
          ...route,
          active,
        }
      }),
    [allowedPaths],
  )

  const allowedPathsValue = allowedPaths.map((item) => item.path)

  if (query.isLoading) {
    return <LoadingState message="A carregar configuração do editor via IA..." />
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar a configuração do editor via IA"
        message={query.error instanceof Error ? query.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void query.refetch()}
      />
    )
  }

  async function handleSave() {
    setFeedback(null)
    try {
      const nextGeminiModel = resolveLegacyModel(
        "gemini",
        [
          { provider: conversationProvider, model: conversationModel },
          { provider: plannerProvider, model: plannerModel },
          { provider: complexProvider, model: complexModel },
          { provider: fallbackProvider, model: fallbackModel },
        ],
        geminiModel.trim() || "gemini-2.0-flash",
      )
      const nextOpenAiModel = resolveLegacyModel(
        "openai",
        [
          { provider: conversationProvider, model: conversationModel },
          { provider: plannerProvider, model: plannerModel },
          { provider: complexProvider, model: complexModel },
          { provider: fallbackProvider, model: fallbackModel },
        ],
        openaiModel.trim() || "gpt-4.1-mini",
      )

      const response = await updateMutation.mutateAsync({
        configValue: {
          enabled,
          launcher_label: launcherLabel.trim() || "Editar com IA",
          allowed_paths: allowedPathsValue,
          primary_provider: conversationProvider,
          fallback_provider: fallbackProvider,
          gemini_model: nextGeminiModel,
          openai_model: nextOpenAiModel,
          conversation_provider: conversationProvider,
          conversation_model: conversationModel.trim() || getDefaultModelForProvider(conversationProvider),
          planner_provider: plannerProvider,
          planner_model: plannerModel.trim() || getDefaultModelForProvider(plannerProvider),
          complex_provider: complexProvider,
          complex_model: complexModel.trim() || getDefaultModelForProvider(complexProvider),
          fallback_model: fallbackModel.trim() || getDefaultModelForProvider(fallbackProvider),
          max_attachments: maxAttachments,
          max_attachment_size_mb: maxAttachmentSizeMb,
          base_prompt: basePrompt.trim(),
          require_confirmation: requireConfirmation,
          panel_width: panelWidth,
        },
        geminiApiKey: geminiApiKey.trim() || null,
        openaiApiKey: openaiApiKey.trim() || null,
      })

      setGeminiApiKey("")
      setOpenaiApiKey("")
      setGeminiModel(response.config_value.gemini_model)
      setOpenaiModel(response.config_value.openai_model)
      setFeedback({ tone: "success", message: "Configuração do editor via IA atualizada com sucesso." })
      setProviderTestOutput(
        [
          `Gemini: ${response.secret_status.gemini_api_key_present ? "configurada" : "pendente"}`,
          `OpenAI: ${response.secret_status.openai_api_key_present ? "configurada" : "pendente"}`,
        ].join(" | "),
      )
      setProviderTestResults([])
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível guardar a configuração.",
      })
    }
  }

  async function handleTestProviders() {
    setFeedback(null)
    setProviderTestOutput(null)
    setProviderTestResults([])

    try {
      const result = await testMutation.mutateAsync()
      setProviderTestOutput(result.summary ?? result.details)
      setProviderTestResults(result.stage_results ?? result.provider_results ?? [])
      void usageQuery.refetch()

      const hasWarnings = (result.stage_results ?? result.provider_results ?? []).some(
        (item) => item.status === "quota_exceeded" || item.status === "missing_key",
      )

      setFeedback({
        tone: hasWarnings ? "danger" : "success",
        message: hasWarnings
          ? "O teste encontrou uma limitação operacional em pelo menos um provedor."
          : "Teste dos provedores executado com sucesso.",
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível testar os provedores.",
      })
    }
  }

  function toggleRoute(path: string, label?: string) {
    setAllowedPaths((current) => {
      const exists = current.some((item) => item.path === path)
      if (exists) {
        return current.filter((item) => item.path !== path)
      }
      return [...current, { path, label: label ?? path, preset: true }]
    })
  }

  function addCustomPath() {
    const next = customPath.trim()
    if (!next) return
    setAllowedPaths((current) => mergeAllowedPaths(current, next))
    setCustomPath("")
  }

  function removePath(path: string) {
    setAllowedPaths((current) => current.filter((item) => item.path !== path))
  }

  const configuredCount = allowedPaths.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor via IA"
        description="Configura o launcher do editor, as rotas habilitadas, os modelos e as chaves seguras guardadas no backend."
        backTo={ROUTES.ADMIN}
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <a href={ROUTES.HOME} target="_blank" rel="noreferrer">
              Abrir site
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Estado</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{enabled ? "Ativo" : "Inativo"}</p>
          <p className="mt-2 text-sm text-slate-600">Quando ativo, o launcher aparece apenas para admin nas rotas configuradas.</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Rotas</p>
          <p className="mt-3 text-2xl font-bold text-slate-950">{configuredCount}</p>
          <p className="mt-2 text-sm text-slate-600">Páginas/rotas onde o editor pode carregar no frontend.</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Segredos</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={secretStatus.gemini_api_key_present ? "Gemini pronto" : "Gemini pendente"} tone={secretStatus.gemini_api_key_present ? "success" : "warning"} />
            <StatusBadge label={secretStatus.openai_api_key_present ? "OpenAI pronto" : "OpenAI pendente"} tone={secretStatus.openai_api_key_present ? "success" : "warning"} />
          </div>
          <p className="mt-2 text-sm text-slate-600">Os valores reais ficam no Vault/backend, nunca no frontend.</p>
        </div>
      </div>

      {feedback ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm font-medium",
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Configuração principal</h2>
              <p className="mt-1 text-sm text-slate-600">Define o comportamento do launcher e como o editor distribui conversa, planeamento, proposta complexa e fallback.</p>
            </div>
            <StatusBadge label={enabled ? "Ativo" : "Desativado"} tone={enabled ? "success" : "neutral"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Label do launcher</span>
              <input
                value={launcherLabel}
                onChange={(event) => setLauncherLabel(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="Editar com IA"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Modo do painel</span>
              <select
                value={panelWidth}
                onChange={(event) => setPanelWidth(event.target.value as AdminAiPageEditorConfig["config_value"]["panel_width"])}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="wide">Largo</option>
                <option value="compact">Compacto</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Limite de anexos</span>
              <input
                type="number"
                min={0}
                max={6}
                value={maxAttachments}
                onChange={(event) => setMaxAttachments(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tamanho máx. por anexo (MB)</span>
              <input
                type="number"
                min={1}
                max={20}
                value={maxAttachmentSizeMb}
                onChange={(event) => setMaxAttachmentSizeMb(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Modelos do editor com IA</h3>
              <p className="mt-1 text-sm text-slate-600">
                Cada etapa usa o seu próprio modelo. O roteamento legado continua compatível no backend.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Modelo de conversa</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Usado para entender pedidos, fazer perguntas e confirmar intenção. Pode ser um modelo leve.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Provider</span>
                    <select
                      value={conversationProvider}
                      onChange={(event) => setConversationProvider(event.target.value as AdminAiPageEditorConfig["config_value"]["primary_provider"])}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Model</span>
                    <input
                      value={conversationModel}
                      onChange={(event) => setConversationModel(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      placeholder="gemini-2.0-flash-lite ou gpt-4.1-mini"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Modelo de planeamento visual/técnico</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Usado para analisar HTML, estilos, capturas e identificar o alvo visual com mais precisão.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Provider</span>
                    <select
                      value={plannerProvider}
                      onChange={(event) => setPlannerProvider(event.target.value as AdminAiPageEditorConfig["config_value"]["primary_provider"])}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Model</span>
                    <input
                      value={plannerModel}
                      onChange={(event) => setPlannerModel(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      placeholder="gemini-2.0-flash ou gpt-4.1"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Modelo de proposta complexa</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Usado apenas quando o ajuste exige proposta mais ampla e ainda passa pelos guardrails do editor.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Provider</span>
                    <select
                      value={complexProvider}
                      onChange={(event) => setComplexProvider(event.target.value as AdminAiPageEditorConfig["config_value"]["primary_provider"])}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Model</span>
                    <input
                      value={complexModel}
                      onChange={(event) => setComplexModel(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      placeholder="gemini-2.5-pro ou gpt-4.1"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Modelo de fallback</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Usado se o modelo principal da etapa falhar ou não tiver chave disponível no backend.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Provider</span>
                    <select
                      value={fallbackProvider}
                      onChange={(event) => setFallbackProvider(event.target.value as AdminAiPageEditorConfig["config_value"]["fallback_provider"])}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Model</span>
                    <input
                      value={fallbackModel}
                      onChange={(event) => setFallbackModel(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                      placeholder="gpt-4.1-mini ou gemini-2.0-flash"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Prompt base</span>
            <textarea
              rows={6}
              value={basePrompt}
              onChange={(event) => setBasePrompt(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
              placeholder="Instruções base para a IA..."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Ativar editor via IA
            </label>
            <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={requireConfirmation}
                onChange={(event) => setRequireConfirmation(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Exigir confirmação manual
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm leading-6 text-slate-600">
              Salva apenas as alterações desse card, incluindo rotas, modelo e comportamento do launcher.
            </p>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => void handleSave()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar configurações
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Segredos do backend</h2>
            <p className="mt-1 text-sm text-slate-600">Preenche apenas se quiser atualizar as chaves salvas no backend seguro.</p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Gemini API Key</span>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(event) => setGeminiApiKey(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="Cole a chave apenas para gravar no backend"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">OpenAI API Key</span>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(event) => setOpenaiApiKey(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="Fallback GPT"
            />
          </label>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Estado atual</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label={secretStatus.gemini_api_key_present ? "Gemini configurada" : "Gemini ausente"} tone={secretStatus.gemini_api_key_present ? "success" : "warning"} />
              <StatusBadge label={secretStatus.openai_api_key_present ? "OpenAI configurada" : "OpenAI ausente"} tone={secretStatus.openai_api_key_present ? "success" : "warning"} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              As chaves reais nunca voltam para o frontend. Guardamos apenas presença/estado.
            </p>
          </div>

          {providerTestOutput ? (
            <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Último teste</p>
              <p className="mt-2">{providerTestOutput}</p>
              {providerTestResults.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {providerTestResults.map((result) => (
                    <div
                      key={`${result.stage ?? "provider"}-${result.provider}-${result.model ?? "default"}`}
                      className={[
                        "rounded-2xl border px-3 py-2 text-sm",
                        result.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : result.status === "quota_exceeded"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-rose-200 bg-rose-50 text-rose-900",
                      ].join(" ")}
                    >
                      <p className="font-semibold capitalize">
                        {result.stage ? result.stage.replace(/_/g, " ") : result.provider}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-current/75">
                        {result.provider} {result.model ? `· ${result.model}` : ""}
                      </p>
                      <p className="mt-1 text-xs leading-5">{result.message}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="rounded-full"
              onClick={() => void handleSave()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar configuração
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void handleTestProviders()}
              disabled={testMutation.isPending}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              {testMutation.isPending ? "A testar..." : "Testar provedores"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void query.refetch()}
            >
              Atualizar estado
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Utilização e custos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Monitoriza o consumo do editor via IA nos últimos 30 dias, com tokens, pedidos e custo estimado por modelo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label="Janela de 30 dias" tone="neutral" />
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void usageQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar métricas
            </Button>
          </div>
        </div>

        {usageQuery.isLoading ? (
          <LoadingState message="A carregar métricas de utilização do editor via IA..." />
        ) : usageQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar a utilização do editor via IA"
            message={usageQuery.error instanceof Error ? usageQuery.error.message : "Tenta novamente dentro de instantes."}
            onRetry={() => void usageQuery.refetch()}
          />
        ) : usageMetrics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Pedidos</p>
                <p className="mt-3 text-2xl font-bold text-slate-950">{numberFormatter.format(usageMetrics.summary.total_requests)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {numberFormatter.format(usageMetrics.summary.total_generate_requests)} do editor e{" "}
                  {numberFormatter.format(usageMetrics.summary.total_test_requests)} testes.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Custo estimado</p>
                <p className="mt-3 text-2xl font-bold text-slate-950">{currencyFormatter.format(usageMetrics.summary.total_estimated_cost_usd)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {numberFormatter.format(usageMetrics.summary.priced_requests)} pedido(s) com tabela de preço conhecida.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Tokens de entrada</p>
                <p className="mt-3 text-2xl font-bold text-slate-950">{numberFormatter.format(usageMetrics.summary.total_input_tokens)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Saída: {numberFormatter.format(usageMetrics.summary.total_output_tokens)} tokens.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Última atividade</p>
                <p className="mt-3 text-lg font-bold text-slate-950">{formatDateTime(usageMetrics.summary.last_event_at)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Total analisado: {numberFormatter.format(usageMetrics.summary.total_tokens)} tokens.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-slate-600">
                {usageMetrics.pricing_reference.source}
              </p>
              {usageMetrics.summary.unpriced_requests > 0 ? (
                <p className="mt-2 text-sm font-medium text-amber-800">
                  {numberFormatter.format(usageMetrics.summary.unpriced_requests)} pedido(s) ficaram sem custo estimado porque o modelo usado ainda não tem preço mapeado nesta tela.
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Breakdown por modelo</h3>
                    <p className="text-sm text-slate-600">Agrupado por provedor, modelo e tipo de ação.</p>
                  </div>
                  <StatusBadge
                    label={`${numberFormatter.format(usageMetrics.breakdown.length)} combinações`}
                    tone={usageMetrics.breakdown.length > 0 ? "success" : "neutral"}
                  />
                </div>

                {usageMetrics.breakdown.length > 0 ? (
                  <div className="space-y-3">
                    {usageMetrics.breakdown.map((item) => (
                      <div key={`${item.provider}-${item.model}-${item.action}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {item.provider === "gemini" ? "Gemini" : "OpenAI"} · {item.model}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{formatUsageActionLabel(item.action)}</p>
                          </div>
                          <p className="text-sm font-semibold text-slate-700">{currencyFormatter.format(item.estimated_cost_usd)}</p>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Pedidos</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(item.requests)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Entrada</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(item.input_tokens)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Saída</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(item.output_tokens)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Sem preço</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{numberFormatter.format(item.unpriced_requests)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Ainda não há registos de utilização do editor via IA nesta janela.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Atividade recente</h3>
                    <p className="text-sm text-slate-600">Últimos pedidos e testes registados pelo backend.</p>
                  </div>
                  <StatusBadge
                    label={`${numberFormatter.format(usageMetrics.recent_events.length)} itens`}
                    tone={usageMetrics.recent_events.length > 0 ? "success" : "neutral"}
                  />
                </div>

                {usageMetrics.recent_events.length > 0 ? (
                  <div className="space-y-3">
                    {usageMetrics.recent_events.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{formatUsageActionLabel(event.action)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {event.provider === "gemini" ? "Gemini" : "OpenAI"} · {event.model}
                            </p>
                          </div>
                          <p className="text-xs font-medium text-slate-500">{formatDateTime(event.created_at)}</p>
                        </div>

                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>Rota: {event.path ?? "n/d"}</p>
                          <p>Página: {event.slug ?? "n/d"}</p>
                          <p>
                            Tokens: {numberFormatter.format(event.total_tokens)}{" "}
                            <span className="text-slate-400">
                              ({numberFormatter.format(event.input_tokens)} entrada / {numberFormatter.format(event.output_tokens)} saída)
                            </span>
                          </p>
                          <p>
                            Custo:{" "}
                            {event.estimated_cost_usd === null ? "n/d" : currencyFormatter.format(event.estimated_cost_usd)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Ainda não há atividade recente para mostrar.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Rotas permitidas</h2>
            <p className="mt-1 text-sm text-slate-600">Marca as rotas que podem carregar o launcher no frontend. Nesta fase, o fluxo persistível completo com draft, preview, publish e rollback fica restrito às páginas públicas com slug conhecido em site_page_versions.</p>
          </div>
          <StatusBadge label={`${configuredCount} rota(s)`} tone={configuredCount > 0 ? "success" : "warning"} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {routeCards.map((route) => (
            <button
              key={route.path}
              type="button"
              onClick={() => toggleRoute(route.path, route.label)}
              className={[
                "flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition",
                route.active
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              ].join(" ")}
            >
              <div>
                <p className="text-sm font-semibold">{route.label}</p>
                <p className="mt-1 text-xs text-slate-500">{route.path}</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">
                  {route.slug ? "Fluxo persistível suportado" : "Apenas contexto/launcher nesta fase"}
                </p>
              </div>
              {route.active ? <Check className="h-5 w-5 text-emerald-600" /> : <Plus className="h-5 w-5 text-slate-400" />}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={customPath}
            onChange={(event) => setCustomPath(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            placeholder="Adicionar rota customizada, ex.: /landing/campanha"
          />
          <Button type="button" variant="outline" className="rounded-full" onClick={() => addCustomPath()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {allowedPaths.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowedPaths.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => removePath(item.path)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                <span>{item.path}</span>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Ainda não há rotas configuradas.
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Ajuda</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O editor da fase 4 gera draft derivado do patch seguro, abre preview no frontend e só publica após confirmação explícita do admin.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Fallback</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Gemini tenta primeiro. Se falhar, o backend usa OpenAI como fallback estruturado.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Segurança</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O launcher só aparece para admin autenticado e respeita as rotas liberadas na configuração.
          </p>
        </div>
      </section>
    </div>
  )
}
