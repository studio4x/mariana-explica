import type { AdminSiteThemeConfig, AdminSiteThemeTextStyle } from "@/types/app.types"

const SITE_THEME_STORAGE_KEY = "mariana-explica:site-theme-updated"
export const SITE_THEME_UPDATED_EVENT = "mariana-explica:site-theme-updated"

function applyThemeToken(name: string, value: string | null | undefined) {
  if (!value) return
  document.documentElement.style.setProperty(name, value)
}

function applyTypographyToken(prefix: string, value: AdminSiteThemeTextStyle) {
  applyThemeToken(`--site-${prefix}-font-family`, value.font_family)
  applyThemeToken(`--site-${prefix}-font-size`, value.font_size)
  applyThemeToken(`--site-${prefix}-font-weight`, value.font_weight)
  applyThemeToken(`--site-${prefix}-line-height`, value.line_height)
  applyThemeToken(`--site-${prefix}-letter-spacing`, value.letter_spacing)
  applyThemeToken(`--site-${prefix}-text-transform`, value.text_transform)
  applyThemeToken(`--site-${prefix}-color`, value.color)
}

export function applySiteTheme(config: AdminSiteThemeConfig | null | undefined) {
  const palette = config?.config_value.palette
  const typography = config?.config_value.typography

  if (!palette || !typography) {
    return
  }

  applyThemeToken("--site-page-background", palette.page_background)
  applyThemeToken("--site-surface-background", palette.surface_background)
  applyThemeToken("--site-border-color", palette.border_color)
  applyThemeToken("--site-heading-color", palette.heading_color)
  applyThemeToken("--site-body-color", palette.body_color)
  applyThemeToken("--site-muted-color", palette.muted_color)
  applyThemeToken("--site-link-color", palette.link_color)
  applyThemeToken("--site-link-hover-color", palette.link_hover_color)
  applyThemeToken("--site-selection-background", palette.selection_background)
  applyThemeToken("--site-selection-foreground", palette.selection_foreground)
  applyThemeToken("--site-heading-font-family", typography.headline_xl.font_family)
  applyThemeToken("--site-body-font-family", typography.body_md.font_family)
  applyTypographyToken("headline-xl", typography.headline_xl)
  applyTypographyToken("headline-lg", typography.headline_lg)
  applyTypographyToken("headline-md", typography.headline_md)
  applyTypographyToken("headline-sm", typography.headline_sm)
  applyTypographyToken("headline-xs", typography.headline_xs)
  applyTypographyToken("headline-2xs", typography.headline_2xs)
  applyTypographyToken("body-lg", typography.body_lg)
  applyTypographyToken("body-md", typography.body_md)
  applyTypographyToken("body-sm", typography.body_sm)
  applyTypographyToken("label-md", typography.label_md)
  applyTypographyToken("h1", typography.h1)
  applyTypographyToken("h2", typography.h2)
  applyTypographyToken("h3", typography.h3)
  applyTypographyToken("h4", typography.h4)
  applyTypographyToken("h5", typography.h5)
  applyTypographyToken("h6", typography.h6)
  applyTypographyToken("paragraph", typography.paragraph)
  applyTypographyToken("list-item", typography.list_item)
  applyTypographyToken("link", typography.link)
  applyTypographyToken("label", typography.label)
  applyTypographyToken("small", typography.small)
}

export function broadcastSiteThemeUpdate(version?: string | null) {
  const payload = version ?? new Date().toISOString()
  window.localStorage.setItem(SITE_THEME_STORAGE_KEY, payload)
  window.dispatchEvent(new Event(SITE_THEME_UPDATED_EVENT))
}
