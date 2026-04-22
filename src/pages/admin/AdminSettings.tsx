import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Activity, Image, Palette, RefreshCw, UploadCloud } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { ErrorState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import {
  fetchAdminBrandingConfig,
  updateAdminBrandingConfig,
  uploadAdminBrandingAssetFile,
} from "@/services/admin.service"
import type { AdminBrandingAsset, AdminBrandingConfig } from "@/types/app.types"
import { AdminOperations } from "./AdminOperations"

type BrandingRole = keyof AdminBrandingConfig["config_value"]
type SettingsTab = "branding" | "operations"

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
    description: "Usado na aba do navegador e em atalhos quando a aplicacao e aberta.",
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
  const activeTab: SettingsTab = searchParams.get("tab") === "operacoes" ? "operations" : "branding"

  const brandingQuery = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: fetchAdminBrandingConfig,
    staleTime: 60_000,
  })

  const saveBranding = useMutation({
    mutationFn: updateAdminBrandingConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "branding"] })
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

      await saveBranding.mutateAsync({
        ...currentConfig,
        [role]: {
          bucket: upload.bucket,
          path: upload.path,
          public_url: upload.public_url ?? null,
          file_name: upload.file_name,
          uploaded_at: upload.uploaded_at,
        },
      })

      setFeedback({ tone: "success", message: "Asset de branding publicado com sucesso." })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel publicar o asset.",
      })
    } finally {
      setUploadingRole(null)
    }
  }

  if (brandingQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar as configuracoes"
        message={brandingQuery.error instanceof Error ? brandingQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void brandingQuery.refetch()}
      />
    )
  }

  const branding = brandingQuery.data
  const readyCount = branding ? countReady(branding) : 0
  const tabs: Array<{ key: SettingsTab; label: string; icon: typeof Palette }> = [
    { key: "branding", label: "Branding", icon: Palette },
    { key: "operations", label: "Operacoes", icon: Activity },
  ]

  return (
    <div className="space-y-7">
      <div className="border-b border-slate-200 pb-6">
        <div className="inline-flex border border-slate-200 bg-[#eef6f9] px-4 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-700">Configuracoes do site</p>
        </div>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-950">Branding e logotipos</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Envie aqui os arquivos oficiais da marca. O sistema escolhe automaticamente o logotipo light ou dark de
              acordo com o fundo em cada area da plataforma.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void brandingQuery.refetch()}
            disabled={brandingQuery.isFetching}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {brandingQuery.isFetching ? "A atualizar..." : "Atualizar"}
          </button>
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

      {activeTab === "operations" ? (
        <AdminOperations embedded />
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
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Selecao dinamica</p>
              <p className="mt-4 text-2xl font-bold text-slate-950">Automatica</p>
              <p className="mt-2 text-sm text-slate-600">Light em fundo escuro, dark em fundo claro.</p>
            </div>
            <div className="border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Favicon</p>
              <div className="mt-4 flex items-center gap-3">
                <p className="text-2xl font-bold text-slate-950">Ativo</p>
                <StatusBadge label="OK" tone="success" />
              </div>
              <p className="mt-2 text-sm text-slate-600">Atualizado para as proximas sessoes do navegador.</p>
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
              nitidez em telas de alta resolucao.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
