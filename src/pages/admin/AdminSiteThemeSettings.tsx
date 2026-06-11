import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, RotateCcw, Save } from "lucide-react"
import { ErrorState } from "@/components/feedback"
import { broadcastSiteThemeUpdate } from "@/components/common"
import { fetchAdminSiteThemeConfig, updateAdminSiteThemeConfig } from "@/services/admin.service"
import type { AdminSiteThemeConfig, AdminSiteThemeTextStyle, SiteThemeTextTransform } from "@/types/app.types"

type TypographyKey = keyof AdminSiteThemeConfig["config_value"]["typography"]
type PaletteKey = keyof AdminSiteThemeConfig["config_value"]["palette"]

const FONT_OPTIONS = [
  { label: "Arvo", value: '"Arvo", Georgia, serif' },
  { label: "Manrope", value: '"Manrope", sans-serif' },
  { label: "DM Sans", value: '"DM Sans", sans-serif' },
  { label: "Readex Pro", value: '"Readex Pro", sans-serif' },
  { label: "Inter", value: '"Inter", system-ui, sans-serif' },
  { label: "Montserrat", value: '"Montserrat", sans-serif' },
  { label: "Oswald", value: '"Oswald", sans-serif' },
  { label: "Poppins", value: '"Poppins", sans-serif' },
  { label: "Lora", value: '"Lora", serif' },
  { label: "Merriweather", value: '"Merriweather", serif' },
  { label: "Playfair Display", value: '"Playfair Display", serif' },
]

const TRANSFORM_OPTIONS: SiteThemeTextTransform[] = ["none", "uppercase", "lowercase", "capitalize", "inherit"]

const TYPOGRAPHY_SECTIONS: Array<{ key: TypographyKey; title: string; sample: string }> = [
  { key: "h1", title: "Títulos H1", sample: "Aprendizagem com identidade forte e clareza imediata" },
  { key: "h2", title: "Títulos H2", sample: "Estrutura visual para páginas de alta conversão" },
  { key: "h3", title: "Títulos H3", sample: "Subtítulos, seções e destaques" },
  { key: "h4", title: "Títulos H4", sample: "Blocos intermediários e cards" },
  { key: "h5", title: "Títulos H5", sample: "Apoio visual em componentes menores" },
  { key: "h6", title: "Títulos H6", sample: "Legendas e cabeçalhos compactos" },
  { key: "paragraph", title: "Parágrafos", sample: "Texto corrido para explicar, orientar e dar contexto ao utilizador." },
  { key: "list_item", title: "Tópicos de lista", sample: "Item com leitura rápida e direta." },
  { key: "link", title: "Links", sample: "Ver material disponível" },
  { key: "label", title: "Labels", sample: "Campo obrigatório" },
  { key: "small", title: "Texto pequeno", sample: "Observação auxiliar e informação secundária." },
]

const PALETTE_FIELDS: Array<{ key: PaletteKey; label: string; description: string }> = [
  { key: "page_background", label: "Fundo da página", description: "Base visual do site e áreas neutras." },
  { key: "surface_background", label: "Fundo de superfície", description: "Cards, painéis e áreas elevadas." },
  { key: "border_color", label: "Cor de borda", description: "Contornos padrão e divisórias." },
  { key: "heading_color", label: "Cor dos títulos", description: "Tom principal para headings." },
  { key: "body_color", label: "Cor do corpo", description: "Texto corrido e blocos descritivos." },
  { key: "muted_color", label: "Cor auxiliar", description: "Textos de apoio, labels e notas." },
  { key: "link_color", label: "Cor de link", description: "Estado padrão dos links." },
  { key: "link_hover_color", label: "Link hover", description: "Estado ao passar o cursor." },
  { key: "selection_background", label: "Seleção de texto", description: "Fundo da seleção nativa do navegador." },
  { key: "selection_foreground", label: "Texto selecionado", description: "Cor do texto ao selecionar." },
]

function toPreviewStyle(style: AdminSiteThemeTextStyle) {
  return {
    color: style.color,
    fontFamily: style.font_family,
    fontSize: style.font_size,
    fontWeight: style.font_weight,
    lineHeight: style.line_height,
    letterSpacing: style.letter_spacing,
    textTransform: style.text_transform,
  } as const
}

function ThemeStyleCard({
  title,
  sample,
  value,
  onChange,
}: {
  title: string
  sample: string
  value: AdminSiteThemeTextStyle
  onChange: (updates: Partial<AdminSiteThemeTextStyle>) => void
}) {
  return (
    <section className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
      <h3 className="text-sm font-black text-[#15323b]">{title}</h3>
      <p className="mt-3 rounded-[14px] border border-white bg-white px-4 py-3" style={toPreviewStyle(value)}>
        {sample}
      </p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Fonte</span>
          <select
            value={value.font_family}
            onChange={(event) => onChange({ font_family: event.target.value })}
            className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Tamanho</span>
            <input
              value={value.font_size}
              onChange={(event) => onChange({ font_size: event.target.value })}
              placeholder="Ex.: 3rem"
              className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Peso</span>
            <input
              value={value.font_weight}
              onChange={(event) => onChange({ font_weight: event.target.value })}
              placeholder="Ex.: 700"
              className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Entrelinha</span>
            <input
              value={value.line_height}
              onChange={(event) => onChange({ line_height: event.target.value })}
              placeholder="Ex.: 1.4"
              className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Letter spacing</span>
            <input
              value={value.letter_spacing}
              onChange={(event) => onChange({ letter_spacing: event.target.value })}
              placeholder="Ex.: -0.02em"
              className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Transformação</span>
            <select
              value={value.text_transform}
              onChange={(event) => onChange({ text_transform: event.target.value as SiteThemeTextTransform })}
              className="h-11 rounded-[12px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
            >
              {TRANSFORM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">Cor</span>
            <div className="flex h-11 items-center gap-2 rounded-[12px] border border-[#D8E6EB] bg-white px-3">
              <input
                type="color"
                value={value.color}
                onChange={(event) => onChange({ color: event.target.value })}
                className="h-7 w-7 rounded border-0 bg-transparent p-0"
              />
              <input
                value={value.color}
                onChange={(event) => onChange({ color: event.target.value })}
                className="h-full flex-1 bg-transparent text-sm font-semibold text-[#15323b] outline-none"
              />
            </div>
          </label>
        </div>
      </div>
    </section>
  )
}

export function AdminSiteThemeSettings() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AdminSiteThemeConfig["config_value"] | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)

  const themeQuery = useQuery({
    queryKey: ["admin", "site-theme"],
    queryFn: fetchAdminSiteThemeConfig,
    staleTime: 60_000,
  })

  const saveTheme = useMutation({
    mutationFn: updateAdminSiteThemeConfig,
    onSuccess: async (data) => {
      queryClient.setQueryData(["admin", "site-theme"], data)
      queryClient.setQueryData(["site", "theme"], data)
      await queryClient.invalidateQueries({ queryKey: ["admin", "site-theme"] })
      await queryClient.invalidateQueries({ queryKey: ["site", "theme"] })
      broadcastSiteThemeUpdate(data.updated_at)
    },
  })

  const currentValue = draft ?? themeQuery.data?.config_value ?? null

  const previewStyles = useMemo(() => {
    if (!currentValue) return null
    return {
      h1: toPreviewStyle(currentValue.typography.h1),
      h2: toPreviewStyle(currentValue.typography.h2),
      h3: toPreviewStyle(currentValue.typography.h3),
      h4: toPreviewStyle(currentValue.typography.h4),
      h5: toPreviewStyle(currentValue.typography.h5),
      h6: toPreviewStyle(currentValue.typography.h6),
      paragraph: toPreviewStyle(currentValue.typography.paragraph),
      list_item: toPreviewStyle(currentValue.typography.list_item),
      link: toPreviewStyle(currentValue.typography.link),
      label: toPreviewStyle(currentValue.typography.label),
      small: toPreviewStyle(currentValue.typography.small),
    }
  }, [currentValue])

  if (themeQuery.isLoading || !currentValue || !previewStyles) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-48 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-72 animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  if (themeQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o tema do site"
        message={themeQuery.error instanceof Error ? themeQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void themeQuery.refetch()}
      />
    )
  }

  const updateTypography = (key: TypographyKey, updates: Partial<AdminSiteThemeTextStyle>) => {
    setFeedback(null)
    setDraft({
      ...currentValue,
      typography: {
        ...currentValue.typography,
        [key]: {
          ...currentValue.typography[key],
          ...updates,
        },
      },
    })
  }

  const updatePalette = (key: PaletteKey, value: string) => {
    setFeedback(null)
    setDraft({
      ...currentValue,
      palette: {
        ...currentValue.palette,
        [key]: value,
      },
    })
  }

  const applyFontFamilyToAll = (fontFamily: string) => {
    setFeedback(null)
    setDraft({
      ...currentValue,
      typography: Object.fromEntries(
        Object.entries(currentValue.typography).map(([key, value]) => [
          key,
          {
            ...value,
            font_family: fontFamily,
          },
        ]),
      ) as AdminSiteThemeConfig["config_value"]["typography"],
    })
  }

  return (
    <div className="space-y-5">
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

      <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Tipografia e cores</p>
            <h2 className="mt-1 text-xl font-semibold text-[#15323b]">Padrão global de textos e palette base</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5F7077]">
              Defina fonte, tamanho, peso e cor para títulos, parágrafos, links e etiquetas do site inteiro.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(themeQuery.data?.config_value ?? currentValue)
                setFeedback(null)
              }}
              className="inline-flex h-8 items-center justify-center gap-2 border border-[#D8E6EB] bg-white px-3 text-sm font-medium text-[#15323b] transition hover:bg-[#F2F7F9]"
            >
              <RotateCcw className="h-4 w-4" />
              Repor alterações
            </button>
            <button
              type="button"
              onClick={() => void themeQuery.refetch()}
              className="inline-flex h-8 items-center justify-center gap-2 border border-[#D8E6EB] bg-white px-3 text-sm font-medium text-[#15323b] transition hover:bg-[#F2F7F9]"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={async () => {
                setFeedback(null)
                try {
                  const saved = await saveTheme.mutateAsync(currentValue)
                  setDraft(saved.config_value)
                  setFeedback({ tone: "success", message: "Tipografia e cores guardadas com sucesso." })
                } catch (error) {
                  setFeedback({
                    tone: "danger",
                    message: error instanceof Error ? error.message : "Não foi possível guardar o tema do site.",
                  })
                }
              }}
              disabled={saveTheme.isPending}
              className="inline-flex h-8 items-center justify-center gap-2 bg-[#0A3640] px-3 text-sm font-medium text-white transition hover:bg-[#0A3640]/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saveTheme.isPending ? "A guardar..." : "Salvar tipografia"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
            Aplicar fonte rápida em todos os grupos
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyFontFamilyToAll(option.value)}
                className="rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#15323b] hover:bg-[#F2F7F9]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
          <h3 className="text-sm font-black text-[#15323b]">Paleta base do site</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {PALETTE_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1 rounded-[14px] border border-white bg-white p-3">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">{field.label}</span>
                <span className="text-xs leading-5 text-[#5F7077]">{field.description}</span>
                <div className="mt-1 flex h-11 items-center gap-2 rounded-[12px] border border-[#D8E6EB] bg-white px-3">
                  <input
                    type="color"
                    value={currentValue.palette[field.key]}
                    onChange={(event) => updatePalette(field.key, event.target.value)}
                    className="h-7 w-7 rounded border-0 bg-transparent p-0"
                  />
                  <input
                    value={currentValue.palette[field.key]}
                    onChange={(event) => updatePalette(field.key, event.target.value)}
                    className="h-full flex-1 bg-transparent text-sm font-semibold text-[#15323b] outline-none"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {TYPOGRAPHY_SECTIONS.map((section) => (
            <ThemeStyleCard
              key={section.key}
              title={section.title}
              sample={section.sample}
              value={currentValue.typography[section.key]}
              onChange={(updates) => updateTypography(section.key, updates)}
            />
          ))}
        </div>

        <section className="mt-4 rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Pré-visualização global</p>
          <div
            className="mt-3 rounded-[18px] border px-5 py-6"
            style={{
              backgroundColor: currentValue.palette.surface_background,
              borderColor: currentValue.palette.border_color,
            }}
          >
            <h1 style={previewStyles.h1}>Título H1 com presença comercial</h1>
            <h2 className="mt-4" style={previewStyles.h2}>Título H2 para secções principais</h2>
            <h3 className="mt-4" style={previewStyles.h3}>Título H3 para subdivisões</h3>
            <h4 className="mt-4" style={previewStyles.h4}>Título H4 em cards e blocos</h4>
            <h5 className="mt-4" style={previewStyles.h5}>Título H5 para apoios</h5>
            <h6 className="mt-4" style={previewStyles.h6}>Título H6 compacto</h6>
            <p className="mt-4" style={previewStyles.paragraph}>
              Este parágrafo mostra como o texto corrido vai aparecer ao longo do site, com foco em legibilidade,
              clareza e ritmo de leitura.
            </p>
            <ul className="mt-4 list-disc pl-5">
              <li style={previewStyles.list_item}>Primeiro tópico de uma lista informativa.</li>
              <li style={previewStyles.list_item}>Segundo tópico com leitura escaneável.</li>
            </ul>
            <p className="mt-4">
              <a href="#site-theme-preview" style={previewStyles.link}>
                Exemplo de link com hover configurável
              </a>
            </p>
            <label className="mt-4 block" style={previewStyles.label}>
              Label de campo
            </label>
            <small className="mt-2 block" style={previewStyles.small}>
              Texto pequeno para notas, observações e estados auxiliares.
            </small>
          </div>
        </section>
      </article>
    </div>
  )
}
