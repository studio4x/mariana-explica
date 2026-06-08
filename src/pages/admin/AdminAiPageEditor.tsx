import { useEffect, useMemo, useState } from "react"
import { Check, Plus, RefreshCw, Save, TestTube2, Trash2 } from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { ErrorState, LoadingState } from "@/components/feedback"
import {
  useAdminAiPageEditorConfig,
  useTestAdminAiPageEditorProviders,
  useUpdateAdminAiPageEditorConfig,
} from "@/hooks/useAdmin"
import {
  AI_PAGE_EDITOR_ROUTE_OPTIONS,
} from "@/lib/ai-page-editor"
import { ROUTES } from "@/lib/constants"
import type { AdminAiPageEditorConfig } from "@/types/app.types"

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

export function AdminAiPageEditor() {
  const query = useAdminAiPageEditorConfig()
  const updateMutation = useUpdateAdminAiPageEditorConfig()
  const testMutation = useTestAdminAiPageEditorProviders()
  const [allowedPaths, setAllowedPaths] = useState<AllowedPathState[]>([])
  const [launcherLabel, setLauncherLabel] = useState("Editar com IA")
  const [enabled, setEnabled] = useState(false)
  const [primaryProvider, setPrimaryProvider] = useState<AdminAiPageEditorConfig["config_value"]["primary_provider"]>("gemini")
  const [fallbackProvider, setFallbackProvider] = useState<AdminAiPageEditorConfig["config_value"]["fallback_provider"]>("openai")
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

  const config = query.data
  const secretStatus = config?.secret_status ?? {
    gemini_api_key_present: false,
    openai_api_key_present: false,
  }

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
    setPrimaryProvider(value.primary_provider)
    setFallbackProvider(value.fallback_provider)
    setGeminiModel(value.gemini_model)
    setOpenaiModel(value.openai_model)
    setMaxAttachments(value.max_attachments)
    setMaxAttachmentSizeMb(value.max_attachment_size_mb)
    setBasePrompt(value.base_prompt)
    setRequireConfirmation(value.require_confirmation)
    setPanelWidth(value.panel_width)
  }, [config])

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
      const response = await updateMutation.mutateAsync({
        configValue: {
          enabled,
          launcher_label: launcherLabel.trim() || "Editar com IA",
          allowed_paths: allowedPathsValue,
          primary_provider: primaryProvider,
          fallback_provider: fallbackProvider,
          gemini_model: geminiModel.trim() || "gemini-2.0-flash",
          openai_model: openaiModel.trim() || "gpt-4.1-mini",
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
      setFeedback({ tone: "success", message: "Configuração do editor via IA atualizada com sucesso." })
      setProviderTestOutput(
        [
          `Gemini: ${response.secret_status.gemini_api_key_present ? "configurada" : "pendente"}`,
          `OpenAI: ${response.secret_status.openai_api_key_present ? "configurada" : "pendente"}`,
        ].join(" | "),
      )
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

    try {
      const result = await testMutation.mutateAsync()
      setProviderTestOutput(result.details)
      setFeedback({ tone: "success", message: "Teste dos provedores executado com sucesso." })
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
              <p className="mt-1 text-sm text-slate-600">Define o comportamento do launcher e a ordem de fallback dos provedores.</p>
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
              <span className="text-sm font-medium text-slate-700">Provedor principal</span>
              <select
                value={primaryProvider}
                onChange={(event) => setPrimaryProvider(event.target.value as AdminAiPageEditorConfig["config_value"]["primary_provider"])}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fallback</span>
              <select
                value={fallbackProvider}
                onChange={(event) => setFallbackProvider(event.target.value as AdminAiPageEditorConfig["config_value"]["fallback_provider"])}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Modelo Gemini</span>
              <input
                value={geminiModel}
                onChange={(event) => setGeminiModel(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="gemini-2.0-flash"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Modelo OpenAI</span>
              <input
                value={openaiModel}
                onChange={(event) => setOpenaiModel(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="gpt-4.1-mini"
              />
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
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Rotas permitidas</h2>
            <p className="mt-1 text-sm text-slate-600">Marca as rotas que podem carregar o launcher no frontend. O editor funciona melhor nas páginas públicas já geridas pelo builder.</p>
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
            O editor grava apenas rascunhos. A publicação continua manual através do fluxo normal do builder.
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
