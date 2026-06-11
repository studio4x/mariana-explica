import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Activity, Code2, EyeOff, Image, Palette, RefreshCw, UploadCloud } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { ErrorState } from "@/components/feedback"
import { applySiteFavicon, broadcastBrandingUpdate, StatusBadge } from "@/components/common"
import {
  fetchAdminBrandingConfig,
  fetchAdminLegacyPageEditorConfig,
  fetchAdminSiteMaintenanceConfig,
  fetchAdminTrackingConfig,
  updateAdminBrandingConfig,
  updateAdminLegacyPageEditorConfig,
  updateAdminSiteMaintenanceConfig,
  updateAdminTrackingConfig,
  uploadAdminBrandingAssetFile,
} from "@/services/admin.service"
import type {
  AdminBrandingAsset,
  AdminBrandingConfig,
  AdminLegacyPageEditorConfig,
  AdminSiteMaintenanceConfig,
  AdminTrackingConfig,
} from "@/types/app.types"
import { AdminOperations } from "./AdminOperations"
import { AdminSiteThemeSettings } from "./AdminSiteThemeSettings"

type BrandingRole = Exclude<keyof AdminBrandingConfig["config_value"], "footer_description">
type SettingsTab = "branding" | "tracking" | "maintenance" | "legacy-editor" | "operations" | "site-theme"

const assetCards: Array<{
  role: BrandingRole
  eyebrow: string
  title: string
  description: string
  defaultFileName: string
  fallbackSrc: string
  previewTone: "dark" | "light" | "icon"
}> = [
  {
    role: "logo_light",
    eyebrow: "Uso em fundo escuro",
    title: "Logotipo light",
    description: "Aplicado automaticamente em headers, rodapes e secoes com fundo escuro.",
    defaultFileName: "logo-light-padrao.svg",
    fallbackSrc: "/favicon.svg",
    previewTone: "dark",
  },
  {
    role: "logo_dark",
    eyebrow: "Uso em fundo claro",
    title: "Logotipo dark",
    description: "Aplicado automaticamente em headers claros, admin e superficies claras do site.",
    defaultFileName: "logo-dark-padrao.svg",
    fallbackSrc: "/favicon.svg",
    previewTone: "light",
  },
  {
    role: "favicon",
    eyebrow: "Navegador",
    title: "Favicon",
    description: "Usado na aba do navegador e em atalhos quando a aplicação é aberta.",
    defaultFileName: "favicon.svg",
    fallbackSrc: "/favicon.svg",
    previewTone: "icon",
  },
]

function assetReady(asset: AdminBrandingAsset) {
  return Boolean(asset.public_url || asset.path)
}

function countReady(config: AdminBrandingConfig) {
  return assetCards.filter((item) => assetReady(config.config_value[item.role])).length
}

function BrandingPreview({
  asset,
  fallbackSrc,
  title,
  tone,
}: {
  asset: AdminBrandingAsset
  fallbackSrc: string
  title: string
  tone: "dark" | "light" | "icon"
}) {
  const hasUploadedAsset = Boolean(asset.public_url)
  const src = asset.public_url || fallbackSrc

  return (
    <div
      className={[
        "mt-6 flex h-28 items-center justify-center rounded-[1.4rem] border px-8",
        tone === "dark"
          ? "border-sky-950/20 bg-[#0f5966]"
          : tone === "light"
            ? "border-slate-200 bg-[#f4f9fb]"
            : "border-slate-200 bg-[#f4f9fb]",
      ].join(" ")}
    >
      {tone === "icon" ? (
        <img src={src} alt={title} className="h-16 w-16 object-contain" />
      ) : hasUploadedAsset ? (
        <img src={src} alt={title} className="h-16 max-w-full object-contain" />
      ) : (
        <div className="flex max-w-full items-center gap-3">
          <img src={src} alt="" className="h-12 w-12 shrink-0 object-contain" />
          <span
            className={[
              "truncate font-display text-xl font-black",
              tone === "dark" ? "text-white" : "text-slate-950",
            ].join(" ")}
          >
            Mariana Explica
          </span>
        </div>
      )}
    </div>
  )
}

function BrandingAssetCard({
  asset,
  card,
  uploading,
  onUpload,
}: {
  asset: AdminBrandingAsset
  card: (typeof assetCards)[number]
  uploading: boolean
  onUpload: (file: File) => void
}) {
  const inputId = `branding-upload-${card.role}`
  const currentFile = asset.file_name || card.defaultFileName

  return (
    <article className="border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{card.eyebrow}</p>
      <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">{card.title}</h2>
      <p className="mt-3 min-h-12 text-sm leading-7 text-slate-600">{card.description}</p>

      <BrandingPreview asset={asset} fallbackSrc={card.fallbackSrc} title={card.title} tone={card.previewTone} />

      <div className="mt-5 rounded-2xl border border-slate-200 bg-[#f4f9fb] px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Arquivo atual</p>
        <p className="mt-2 break-all text-sm font-bold text-slate-950">{currentFile}</p>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Enviar novo arquivo</p>
        <label
          htmlFor={inputId}
          className="mt-2 flex h-14 cursor-pointer items-center justify-center gap-3 border border-slate-200 bg-[#eef6f9] px-4 text-xs font-black uppercase tracking-[0.18em] text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
        >
          <UploadCloud className="h-4 w-4" />
          {uploading ? "A publicar..." : "Escolher arquivo"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/avif,image/x-icon,.ico"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) onUpload(file)
          }}
        />
      </div>

      <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
        Ao escolher um arquivo, o upload e a publicacao acontecem automaticamente.
      </p>
    </article>
  )
}

export function AdminSettings() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [uploadingRole, setUploadingRole] = useState<BrandingRole | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [trackingDraft, setTrackingDraft] = useState<AdminTrackingConfig["config_value"] | null>(null)
  const [maintenanceDraft, setMaintenanceDraft] = useState<AdminSiteMaintenanceConfig["config_value"] | null>(null)
  const currentTab = searchParams.get("tab")
  const activeTab: SettingsTab =
    currentTab === "operacoes"
      ? "operations"
      : currentTab === "tipografia"
        ? "site-theme"
      : currentTab === "editor-antigo"
        ? "legacy-editor"
      : currentTab === "rastreamento"
        ? "tracking"
        : currentTab === "manutencao"
          ? "maintenance"
          : "branding"

  const brandingQuery = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: fetchAdminBrandingConfig,
    staleTime: 60_000,
  })
  const trackingQuery = useQuery({
    queryKey: ["admin", "tracking"],
    queryFn: fetchAdminTrackingConfig,
    staleTime: 60_000,
  })
  const legacyEditorQuery = useQuery({
    queryKey: ["admin", "legacy-page-editor"],
    queryFn: fetchAdminLegacyPageEditorConfig,
    staleTime: 60_000,
  })
  const maintenanceQuery = useQuery({
    queryKey: ["admin", "site-maintenance"],
    queryFn: fetchAdminSiteMaintenanceConfig,
    staleTime: 30_000,
  })

  const saveBranding = useMutation({
    mutationFn: updateAdminBrandingConfig,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "branding"] }),
        queryClient.invalidateQueries({ queryKey: ["site", "branding"] }),
      ])
    },
  })
  const saveTracking = useMutation({
    mutationFn: updateAdminTrackingConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "tracking"] })
      await queryClient.invalidateQueries({ queryKey: ["site", "tracking"] })
    },
  })
  const saveLegacyEditor = useMutation({
    mutationFn: updateAdminLegacyPageEditorConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "legacy-page-editor"] })
    },
  })
  const saveMaintenance = useMutation({
    mutationFn: updateAdminSiteMaintenanceConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "site-maintenance"] })
      await queryClient.invalidateQueries({ queryKey: ["site", "maintenance"] })
    },
  })

  const handleUpload = async (role: BrandingRole, file: File) => {
    if (!brandingQuery.data) return

    setUploadingRole(role)
    setFeedback(null)

    try {
      const currentConfig = brandingQuery.data.config_value
      const currentAsset = currentConfig[role]
      const upload = await uploadAdminBrandingAssetFile({
        role,
        file,
        replacePath: currentAsset.path,
      })

      const updatedConfig = await saveBranding.mutateAsync({
        ...currentConfig,
        [role]: {
          bucket: upload.bucket,
          path: upload.path,
          public_url: upload.public_url ?? null,
          file_name: upload.file_name,
          uploaded_at: upload.uploaded_at,
        },
      })

      queryClient.setQueryData(["admin", "branding"], updatedConfig)
      queryClient.setQueryData(["site", "branding"], updatedConfig)
      broadcastBrandingUpdate(updatedConfig.updated_at)

      if (role === "favicon") {
        applySiteFavicon(upload.public_url, upload.uploaded_at)
      }

      setFeedback({ tone: "success", message: "Asset de branding publicado com sucesso." })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível publicar o asset.",
      })
    } finally {
      setUploadingRole(null)
    }
  }

  if (brandingQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as configurações"
        message={brandingQuery.error instanceof Error ? brandingQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void brandingQuery.refetch()}
      />
    )
  }

  if (trackingQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as configurações"
        message={trackingQuery.error instanceof Error ? trackingQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void trackingQuery.refetch()}
      />
    )
  }

  if (maintenanceQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as configurações"
        message={maintenanceQuery.error instanceof Error ? maintenanceQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void maintenanceQuery.refetch()}
      />
    )
  }

  if (legacyEditorQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as configurações"
        message={legacyEditorQuery.error instanceof Error ? legacyEditorQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void legacyEditorQuery.refetch()}
      />
    )
  }

  const branding = brandingQuery.data
  const trackingConfig = trackingQuery.data ?? {
    config_key: "site_tracking",
    config_value: {
      google_tag_manager_id: "",
      meta_pixel_id: "",
      custom_head_code: "",
      custom_body_code: "",
      custom_footer_code: "",
    },
    description: null,
    is_public: true,
    updated_at: null,
  }
  const trackingState = trackingDraft ?? trackingConfig.config_value
  const maintenanceConfig = maintenanceQuery.data ?? {
    config_key: "site_maintenance_mode",
    config_value: {
      enabled: false,
      message: "Estamos em manutenção para melhorar a tua experiência. Voltamos em breve.",
    },
    description: null,
    is_public: true,
    updated_at: null,
  }
  const legacyEditorConfig = legacyEditorQuery.data ?? {
    config_key: "legacy_page_editor_config",
    config_value: {
      enabled: true,
    },
    description: null,
    is_public: false,
    updated_at: null,
  } satisfies AdminLegacyPageEditorConfig
  const maintenanceState = maintenanceDraft ?? maintenanceConfig.config_value
  const readyCount = branding ? countReady(branding) : 0
  const tabs: Array<{ key: SettingsTab; label: string; icon: typeof Palette }> = [
    { key: "branding", label: "Branding", icon: Palette },
    { key: "site-theme", label: "Tipografia & cores", icon: Palette },
    { key: "tracking", label: "Rastreamento", icon: Code2 as typeof Palette },
    { key: "maintenance", label: "Manutenção", icon: Activity },
    { key: "legacy-editor", label: "Editor antigo", icon: EyeOff as typeof Palette },
    { key: "operations", label: "Operações", icon: Activity },
  ]
  const sectionCopy = {
    branding: {
      title: "Branding e logotipos",
      description:
        "Envie aqui os arquivos oficiais da marca. O sistema escolhe automaticamente o logotipo light ou dark de acordo com o fundo em cada área da plataforma.",
    },
    "site-theme": {
      title: "Tipografia e cores do site",
      description:
        "Define a base global de headings, parágrafos, links, labels e palette visual usada nas tags estruturais do site.",
    },
    tracking: {
      title: "Rastreamento e códigos globais",
      description:
        "Configure GTM, Meta Pixel e códigos personalizados do site. Os identificadores de rastreamento respeitam o centro de preferências de cookies da plataforma.",
    },
    maintenance: {
      title: "Modo manutenção",
      description:
        "Ative este modo para restringir o acesso da plataforma durante ajustes operacionais. Admins autenticados continuam com acesso total.",
    },
    "legacy-editor": {
      title: "Editor antigo",
      description:
        "Desative o editor de páginas antigo para escondê-lo da plataforma e concentrar a edição no novo fluxo com IA.",
    },
    operations: {
      title: "Operações do ambiente",
      description:
        "Acompanhe rotinas operacionais, jobs, entregas técnicas e ajustes sensíveis do ambiente de produção.",
    },
  } as const

  const handleTrackingDraft = (updates: Partial<AdminTrackingConfig["config_value"]>) => {
    setTrackingDraft({ ...trackingState, ...updates })
  }

  return (
    <div className="space-y-7">
      <div className="border-b border-slate-200 pb-6">
        <div className="inline-flex border border-slate-200 bg-[#eef6f9] px-4 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-700">Configurações do site</p>
        </div>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-950">{sectionCopy[activeTab].title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {sectionCopy[activeTab].description}
            </p>
          </div>
          {activeTab !== "site-theme" ? (
            <button
              type="button"
              onClick={() => {
                if (activeTab === "tracking") {
                  void trackingQuery.refetch()
                  return
                }
                if (activeTab === "maintenance") {
                  void maintenanceQuery.refetch()
                  return
                }
                if (activeTab === "legacy-editor") {
                  void legacyEditorQuery.refetch()
                  return
                }
                void brandingQuery.refetch()
              }}
              disabled={brandingQuery.isFetching || trackingQuery.isFetching || maintenanceQuery.isFetching || legacyEditorQuery.isFetching}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              {brandingQuery.isFetching || trackingQuery.isFetching || maintenanceQuery.isFetching || legacyEditorQuery.isFetching ? "A atualizar..." : "Atualizar"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (tab.key === "branding") {
                  setSearchParams({})
                } else if (tab.key === "site-theme") {
                  setSearchParams({ tab: "tipografia" })
                } else if (tab.key === "tracking") {
                  setSearchParams({ tab: "rastreamento" })
                } else if (tab.key === "maintenance") {
                  setSearchParams({ tab: "manutencao" })
                } else if (tab.key === "legacy-editor") {
                  setSearchParams({ tab: "editor-antigo" })
                } else {
                  setSearchParams({ tab: "operacoes" })
                }
              }}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                active
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "site-theme" ? (
        <AdminSiteThemeSettings />
      ) : activeTab === "maintenance" ? (
        <>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Estado atual</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">{maintenanceState.enabled ? "Ativo" : "Inativo"}</p>
              <p className="mt-2 text-sm text-slate-600">
                Quando ativo, visitantes e alunos veem a página de manutenção.
              </p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Acesso admin</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">Liberado</p>
              <p className="mt-2 text-sm text-slate-600">Administradores autenticados mantem acesso completo.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Visibilidade</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">Pública</p>
              <p className="mt-2 text-sm text-slate-600">Configuração lida pelo frontend em tempo quase real.</p>
            </div>
          </div>

          <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-2xl border border-slate-200 bg-[#f4f9fb] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Controle</p>
              <button
                type="button"
                onClick={() => {
                  setFeedback(null)
                  setMaintenanceDraft({
                    ...maintenanceState,
                    enabled: !maintenanceState.enabled,
                  })
                }}
                className={[
                  "mt-3 inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold transition",
                  maintenanceState.enabled
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700",
                ].join(" ")}
              >
                {maintenanceState.enabled ? "Desativar modo manutenção" : "Ativar modo manutenção"}
              </button>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Salva a configuração para aplicar imediatamente o comportamento no site.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                Mensagem exibida na página de manutenção
              </span>
              <textarea
                value={maintenanceState.message}
                onChange={(event) => {
                  setFeedback(null)
                  setMaintenanceDraft({
                    ...maintenanceState,
                    message: event.target.value,
                  })
                }}
                rows={5}
                placeholder="Escreve aqui o recado para os visitantes durante a manutenção."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setMaintenanceDraft(maintenanceConfig.config_value)
                  setFeedback(null)
                }}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300"
              >
                Repor alterações
              </button>
              <button
                type="button"
                onClick={async () => {
                  setFeedback(null)
                  try {
                    await saveMaintenance.mutateAsync(maintenanceState)
                    setMaintenanceDraft(null)
                    setFeedback({ tone: "success", message: "Modo manutenção atualizado com sucesso." })
                  } catch (error) {
                    setFeedback({
                      tone: "danger",
                      message: error instanceof Error ? error.message : "Não foi possível atualizar o modo manutenção.",
                    })
                  }
                }}
                disabled={saveMaintenance.isPending}
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saveMaintenance.isPending ? "A guardar..." : "Guardar manutenção"}
              </button>
            </div>
          </section>
        </>
      ) : activeTab === "operations" ? (
        <AdminOperations embedded />
      ) : activeTab === "legacy-editor" ? (
        <>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Estado atual</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">
                {legacyEditorConfig.config_value.enabled ? "Ativo" : "Inativo"}
              </p>
              <p className="mt-2 text-sm text-slate-600">Enquanto ativo, o editor antigo continua visível no admin.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Visibilidade</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">
                {legacyEditorConfig.config_value.enabled ? "Exposto" : "Oculto"}
              </p>
              <p className="mt-2 text-sm text-slate-600">Quando desligado, o menu some e a rota antiga redireciona.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Substituto</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">Editor IA</p>
              <p className="mt-2 text-sm text-slate-600">O novo fluxo passa a ser a interface oficial de edição.</p>
            </div>
          </div>

          <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-2xl border border-slate-200 bg-[#f4f9fb] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Controle</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Usa este botão para desligar ou reativar o editor de páginas antigo. Quando desligado, ele fica
                invisível na plataforma para os admins.
              </p>
              <button
                type="button"
                onClick={async () => {
                  setFeedback(null)
                  try {
                    await saveLegacyEditor.mutateAsync({ enabled: !legacyEditorConfig.config_value.enabled })
                    setFeedback({
                      tone: "success",
                      message: legacyEditorConfig.config_value.enabled
                        ? "Editor antigo desativado com sucesso."
                        : "Editor antigo reativado com sucesso.",
                    })
                  } catch (error) {
                    setFeedback({
                      tone: "danger",
                      message: error instanceof Error ? error.message : "Não foi possível atualizar o editor antigo.",
                    })
                  }
                }}
                disabled={saveLegacyEditor.isPending}
                className={[
                  "mt-4 inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60",
                  legacyEditorConfig.config_value.enabled
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700",
                ].join(" ")}
              >
                {saveLegacyEditor.isPending
                  ? "A guardar..."
                  : legacyEditorConfig.config_value.enabled
                    ? "Desativar editor antigo"
                    : "Reativar editor antigo"}
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
              <p>
                Quando este switch estiver desligado, o item do menu some, a rota antiga deixa de ser exibida e o
                editor IA passa a ser o caminho principal.
              </p>
            </div>
          </section>
        </>
      ) : activeTab === "tracking" ? (
        <>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Google tag manager</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">
                {trackingState.google_tag_manager_id ? "Configurado" : "Pendente"}
              </p>
              <p className="mt-2 text-sm text-slate-600">Carregado apenas com consentimento analitico.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Meta pixel</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">
                {trackingState.meta_pixel_id ? "Configurado" : "Pendente"}
              </p>
              <p className="mt-2 text-sm text-slate-600">Carregado apenas com consentimento de marketing.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Códigos globais</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">
                {[trackingState.custom_head_code, trackingState.custom_body_code, trackingState.custom_footer_code].some((value) => value.trim())
                  ? "Ativos"
                  : "Vazios"}
              </p>
              <p className="mt-2 text-sm text-slate-600">Snippets livres para head, body e footer do site.</p>
            </div>
          </div>

          <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  ID do container GTM
                </span>
                <input
                  value={trackingState.google_tag_manager_id}
                  onChange={(event) => handleTrackingDraft({ google_tag_manager_id: event.target.value })}
                  placeholder="Ex.: GTM-XXXXXXX"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Use o ID do container. O script e injetado automaticamente quando o utilizador aceita cookies analiticos.
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  ID do Meta Pixel
                </span>
                <input
                  value={trackingState.meta_pixel_id}
                  onChange={(event) => handleTrackingDraft({ meta_pixel_id: event.target.value })}
                  placeholder="Ex.: 123456789012345"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  O pixel só dispara quando o utilizador aceita cookies de marketing.
                </p>
              </label>
            </div>

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Código personalizado no head
                </span>
                <textarea
                  value={trackingState.custom_head_code}
                  onChange={(event) => handleTrackingDraft({ custom_head_code: event.target.value })}
                  placeholder="<script>/* código global no head */</script>"
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Código personalizado no body
                </span>
                <textarea
                  value={trackingState.custom_body_code}
                  onChange={(event) => handleTrackingDraft({ custom_body_code: event.target.value })}
                  placeholder="<script>/* código no body */</script>"
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Código personalizado no footer
                </span>
                <textarea
                  value={trackingState.custom_footer_code}
                  onChange={(event) => handleTrackingDraft({ custom_footer_code: event.target.value })}
                  placeholder="<script>/* código no footer */</script>"
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-[#f4f9fb] p-4 text-sm leading-7 text-slate-600">
              <p>
                O GTM e o Meta Pixel respeitam o centro de preferências de cookies. Já os códigos personalizados são
                injetados conforme inseridos aqui, por isso use esses campos apenas para snippets que realmente devam
                existir no site.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTrackingDraft(trackingConfig.config_value)
                    setFeedback(null)
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300"
                >
                  Repor alterações
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setFeedback(null)
                    try {
                      await saveTracking.mutateAsync(trackingState)
                      setTrackingDraft(null)
                      setFeedback({ tone: "success", message: "Configurações de rastreamento guardadas com sucesso." })
                    } catch (error) {
                      setFeedback({
                        tone: "danger",
                        message: error instanceof Error ? error.message : "Não foi possível guardar o rastreamento.",
                      })
                    }
                  }}
                  disabled={saveTracking.isPending}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {saveTracking.isPending ? "A guardar..." : "Guardar rastreamento"}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Status</p>
              <p className="mt-4 text-3xl font-bold text-slate-950">{brandingQuery.isLoading ? "..." : `${readyCount}/3`}</p>
              <p className="mt-2 text-sm text-slate-600">Assets de branding publicados</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Seleção dinâmica</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">Automática</p>
              <p className="mt-2 text-sm text-slate-600">Light em fundo escuro, dark em fundo claro.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Favicon</p>
              <div className="mt-4 flex items-center gap-3">
                <p className="text-2xl font-bold text-slate-950">Ativo</p>
                <StatusBadge label="OK" tone="success" />
              </div>
              <p className="mt-2 text-sm text-slate-600">Atualizado para as próximas sessões do navegador.</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {assetCards.map((card) => (
              <BrandingAssetCard
                key={card.role}
                card={card}
                asset={branding?.config_value[card.role] ?? {
                  bucket: null,
                  path: null,
                  public_url: null,
                  file_name: null,
                  uploaded_at: null,
                }}
                uploading={uploadingRole === card.role || brandingQuery.isLoading}
                onUpload={(file) => void handleUpload(card.role, file)}
              />
            ))}
          </div>

          <div className="flex items-start gap-3 border border-slate-200 bg-[#f4f9fb] p-4 text-sm leading-7 text-slate-600">
            <Image className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
            <p>
              Formatos aceitos: SVG, PNG, JPG, WEBP, GIF, AVIF e ICO. Use SVG ou PNG com fundo transparente para manter a
              nitidez em telas de alta resolução.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
