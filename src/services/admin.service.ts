import { supabase } from "@/integrations/supabase"
import {
  ensureAdminAiPageEditorConversationResponse,
  ensureAdminAiFooterCopyProposalResponse,
  ensureAdminAiHeaderCopyProposalResponse,
  normalizeAdminAiPageEditorError,
} from "@/lib/ai-page-editor-response"
import { APP_DESCRIPTION, APP_HEADER_ANNOUNCEMENT, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"
import { getFreshFunctionAuthContext } from "@/services/supabase-auth"
import type {
  AdminCheckoutModeConfig,
  AdminAiPageEditorConfig,
  AdminAiPageEditorConversationContext,
  AdminAiPageEditorConversationResponse,
  AdminAiPageEditorProviderTestResult,
  AdminAiPageEditorSecretStatus,
  AdminAiPageEditorUsageMetrics,
  AdminAffiliateReferralSummary,
  AdminAffiliateSummary,
  AdminDashboardOverview,
  AdminDashboardMetrics,
  AdminEmailDeliverySummary,
  AdminJobRunSummary,
  AdminNotificationSummary,
  AdminOperationsOverview,
  AdminOrderViewSummary,
  AdminOrderSummary,
  AdminPaymentsStatus,
  AdminCouponSummary,
  AdminCouponUsageSummary,
  AdminCourseReleaseSummary,
  AdminModulePdfWatermarkConfig,
  AdminBrandingConfig,
  AdminBrandingAsset,
  AdminCronInvokeResult,
  AdminCronKey,
  AdminCronScheduleSummary,
  AdminCronStatusOverview,
  AdminEmailStatus,
  AdminLegacyPageEditorConfig,
  AdminPendingInfoConfig,
  AdminPublicFormNotificationsConfig,
  AdminSitePageAsset,
  AdminSitePageDetail,
  AdminSitePageSummary,
  AdminSitePageVersion,
  AdminSiteMaintenanceConfig,
  SitePageSlug,
  AdminTrackingConfig,
  AdminSiteThemeConfig,
  AdminSiteThemeTextStyle,
  AdminStorageUploadResult,
  SiteThemeTextTransform,
  ProductLessonSummary,
  AdminSupportTicketSummary,
  PublicFormSubmissionSummary,
  AdminUserSummary,
  ModuleAssetSummary,
  AdminAssessmentMutationInput,
  AdminAssessmentUpdateInput,
  ProductAssessmentSummary,
  ProductModuleSummary,
  SupportTicketMessage,
  SupportAttachmentUploadResult,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"
import type { ProductCategorySummary } from "@/types/product.types"
import type { CheckoutMode } from "@/lib/admin-checkout"

function isSchemaMismatch(error: unknown, hint: string) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()

  if (fullText.includes("schema cache") || fullText.includes("does not exist") || fullText.includes("not found")) {
    return true
  }

  return fullText.includes(hint.toLowerCase())
}

function isAuthLockContentionMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes("lock") && normalized.includes("stole it")
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 45_000) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A IA demorou demasiado tempo a responder. Tenta novamente.")
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function invokeAdminFunction<TResponse>(name: string, body: unknown) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const auth = await getFreshFunctionAuthContext()
      if (!auth) {
        throw new Error("Sessão expirada")
      }

      const response = await fetchWithTimeout(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: auth.headers.Authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(typeof body === "object" && body !== null ? body : {}),
          access_token: auth.accessToken,
        }),
      })

      const contentType = response.headers.get("content-type") ?? ""
      const data = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text().catch(() => "")

      if (!response.ok) {
        const message =
          typeof data === "object" && data && "message" in data
            ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
            : typeof data === "string" && data
              ? data
              : `Edge Function returned ${response.status}`
        throw new Error(message)
      }

      return data as TResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = error instanceof Error ? error : new Error(message)
      if (attempt < 3 && isAuthLockContentionMessage(message)) {
        await wait(120 * attempt)
        continue
      }
      throw lastError
    }
  }

  throw lastError ?? new Error("Falha ao invocar função administrativa")
}

async function requireFreshAuth() {
  const auth = await getFreshFunctionAuthContext()
  if (!auth) {
    throw new Error("Sessão expirada")
  }

  return auth
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id

  if (!userId) {
    throw new Error("Sessão inválida")
  }

  return userId
}

const MODULE_PDF_WATERMARK_KEY = "module_pdf_watermark"
const DEFAULT_WATERMARK_SITE_NAME = "Mariana Explica"
const ADMIN_PENDING_INFO_KEY = "admin_pending_information"
const CHECKOUT_MODE_CONFIG_KEY = "checkout_environment"
const BRANDING_CONFIG_KEY = "site_branding"
const TRACKING_CONFIG_KEY = "site_tracking"
const PUBLIC_FORM_NOTIFICATIONS_KEY = "public_form_notifications"
const SITE_MAINTENANCE_KEY = "site_maintenance_mode"
const LEGACY_PAGE_EDITOR_KEY = "legacy_page_editor_config"
const AI_PAGE_EDITOR_KEY = "ai_page_editor_config"
const SITE_THEME_KEY = "site_theme"

const DEFAULT_SITE_THEME_PALETTE: AdminSiteThemeConfig["config_value"]["palette"] = {
  page_background: "#f4fbfd",
  surface_background: "#ffffff",
  border_color: "#d8e6eb",
  heading_color: "#15323b",
  body_color: "#5f7077",
  muted_color: "#7b8b92",
  link_color: "#1398b7",
  link_hover_color: "#0a3640",
  selection_background: "#dff2f8",
  selection_foreground: "#15323b",
}

const DEFAULT_SITE_THEME_TYPOGRAPHY: AdminSiteThemeConfig["config_value"]["typography"] = {
  h1: {
    font_family: '"Arvo", Georgia, serif',
    font_size: "3.5rem",
    font_weight: "700",
    line_height: "1.1",
    letter_spacing: "-0.02em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.heading_color,
  },
  h2: {
    font_family: '"Arvo", Georgia, serif',
    font_size: "3rem",
    font_weight: "700",
    line_height: "1.15",
    letter_spacing: "-0.02em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.heading_color,
  },
  h3: {
    font_family: '"Arvo", Georgia, serif',
    font_size: "2.25rem",
    font_weight: "700",
    line_height: "1.2",
    letter_spacing: "-0.02em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.heading_color,
  },
  h4: {
    font_family: '"Arvo", Georgia, serif',
    font_size: "1.75rem",
    font_weight: "700",
    line_height: "1.25",
    letter_spacing: "-0.01em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.heading_color,
  },
  h5: {
    font_family: '"Arvo", Georgia, serif',
    font_size: "1.375rem",
    font_weight: "700",
    line_height: "1.3",
    letter_spacing: "-0.01em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.heading_color,
  },
  h6: {
    font_family: '"Arvo", Georgia, serif',
    font_size: "1.125rem",
    font_weight: "700",
    line_height: "1.35",
    letter_spacing: "0",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.heading_color,
  },
  paragraph: {
    font_family: '"Inter", system-ui, sans-serif',
    font_size: "1rem",
    font_weight: "400",
    line_height: "1.7",
    letter_spacing: "0",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.body_color,
  },
  list_item: {
    font_family: '"Inter", system-ui, sans-serif',
    font_size: "1rem",
    font_weight: "400",
    line_height: "1.7",
    letter_spacing: "0",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.body_color,
  },
  link: {
    font_family: '"Inter", system-ui, sans-serif',
    font_size: "1rem",
    font_weight: "600",
    line_height: "1.7",
    letter_spacing: "0",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.link_color,
  },
  label: {
    font_family: '"Inter", system-ui, sans-serif',
    font_size: "0.875rem",
    font_weight: "600",
    line_height: "1.45",
    letter_spacing: "0.01em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.muted_color,
  },
  small: {
    font_family: '"Inter", system-ui, sans-serif',
    font_size: "0.875rem",
    font_weight: "500",
    line_height: "1.5",
    letter_spacing: "0.01em",
    text_transform: "none",
    color: DEFAULT_SITE_THEME_PALETTE.muted_color,
  },
}

export interface AdminModuleAssetSignedUploadResult {
  bucket: string
  path: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  max_file_size_bytes?: number | null
  uploaded_at: string | null
  public_url?: string | null
  signed_upload: {
    path: string
    token: string
    signed_url: string
  }
}

export interface AdminModuleAssetUploadLimitResult {
  bucket: string
  max_file_size_bytes: number | null
}

function normalizeBrandingAsset(value: unknown): AdminBrandingAsset {
  const asset = value && typeof value === "object" ? (value as Record<string, unknown>) : {}

  return {
    bucket: String(asset.bucket ?? "").trim() || null,
    path: String(asset.path ?? "").trim() || null,
    public_url: String(asset.public_url ?? "").trim() || null,
    file_name: String(asset.file_name ?? "").trim() || null,
    uploaded_at: String(asset.uploaded_at ?? "").trim() || null,
  }
}

function normalizeModulePdfWatermarkConfig(
  row?: Partial<AdminModulePdfWatermarkConfig> | null,
): AdminModulePdfWatermarkConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const siteName = String(value.site_name ?? DEFAULT_WATERMARK_SITE_NAME).trim() || DEFAULT_WATERMARK_SITE_NAME
  const logoPath = String(value.logo_path ?? "").trim() || null
  const logoBucket = logoPath ? String(value.logo_bucket ?? "course-assets-private").trim() || "course-assets-private" : null

  return {
    config_key: row?.config_key ?? MODULE_PDF_WATERMARK_KEY,
    config_value: {
      site_name: siteName,
      logo_bucket: logoBucket,
      logo_path: logoPath,
    },
    description: row?.description ?? "Configuração do watermark aplicado ao PDF base dos módulos.",
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminPendingInfoConfig(
  row?: Partial<AdminPendingInfoConfig> | null,
): AdminPendingInfoConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const normalizeText = (key: string) => String(value[key] ?? "").trim()

  return {
    config_key: row?.config_key ?? ADMIN_PENDING_INFO_KEY,
    config_value: {
      email_provider_name: normalizeText("email_provider_name"),
      email_sender_name: normalizeText("email_sender_name"),
      email_sender_address: normalizeText("email_sender_address"),
      email_reply_to: normalizeText("email_reply_to"),
    },
    description:
      row?.description ??
      "Informações operacionais ainda pendentes de definicao manual pelo admin. Não armazenar segredos aqui.",
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeCheckoutModeConfig(
  row?: Partial<AdminCheckoutModeConfig> | null,
): AdminCheckoutModeConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const rawMode = String(value.mode ?? "").trim().toLowerCase()
  const mode = rawMode === "live" ? "live" : rawMode === "test" ? "test" : null

  return {
    config_key: row?.config_key ?? CHECKOUT_MODE_CONFIG_KEY,
    config_value: {
      mode: mode ?? "test",
    },
    description: row?.description ?? "Configuração operacional do ambiente do checkout Stripe.",
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminBrandingConfig(
  row?: Partial<AdminBrandingConfig> | null,
): AdminBrandingConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  return {
    config_key: row?.config_key ?? BRANDING_CONFIG_KEY,
    config_value: {
      logo_light: normalizeBrandingAsset(value.logo_light),
      logo_dark: normalizeBrandingAsset(value.logo_dark),
      favicon: normalizeBrandingAsset(value.favicon),
      header_announcement:
        String(value.header_announcement ?? APP_HEADER_ANNOUNCEMENT).trim() || APP_HEADER_ANNOUNCEMENT,
      footer_description: String(value.footer_description ?? APP_DESCRIPTION).trim() || APP_DESCRIPTION,
    },
    description: row?.description ?? "Assets oficiais de branding usados nas Áreas pública, aluno e admin.",
    is_public: row?.is_public ?? true,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminTrackingConfig(
  row?: Partial<AdminTrackingConfig> | null,
): AdminTrackingConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const normalizeText = (key: string) => String(value[key] ?? "").trim()

  return {
    config_key: row?.config_key ?? TRACKING_CONFIG_KEY,
    config_value: {
      google_tag_manager_id: normalizeText("google_tag_manager_id"),
      meta_pixel_id: normalizeText("meta_pixel_id"),
      custom_head_code: String(value.custom_head_code ?? ""),
      custom_body_code: String(value.custom_body_code ?? ""),
      custom_footer_code: String(value.custom_footer_code ?? ""),
    },
    description:
      row?.description ??
      "Configuração pública de rastreamento e códigos personalizados do site, respeitando consentimento quando aplicável.",
    is_public: row?.is_public ?? true,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeThemeColor(value: unknown, fallback: string) {
  const nextValue = String(value ?? "").trim()
  return nextValue || fallback
}

function normalizeThemeTransform(value: unknown, fallback: SiteThemeTextTransform): SiteThemeTextTransform {
  const nextValue = String(value ?? "").trim() as SiteThemeTextTransform
  if (
    nextValue === "none" ||
    nextValue === "uppercase" ||
    nextValue === "lowercase" ||
    nextValue === "capitalize" ||
    nextValue === "inherit"
  ) {
    return nextValue
  }

  return fallback
}

function normalizeSiteThemeTextStyle(
  value: unknown,
  fallback: AdminSiteThemeTextStyle,
): AdminSiteThemeTextStyle {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {}

  return {
    font_family: String(record.font_family ?? "").trim() || fallback.font_family,
    font_size: String(record.font_size ?? "").trim() || fallback.font_size,
    font_weight: String(record.font_weight ?? "").trim() || fallback.font_weight,
    line_height: String(record.line_height ?? "").trim() || fallback.line_height,
    letter_spacing: String(record.letter_spacing ?? "").trim() || fallback.letter_spacing,
    text_transform: normalizeThemeTransform(record.text_transform, fallback.text_transform),
    color: normalizeThemeColor(record.color, fallback.color),
  }
}

function normalizeAdminSiteThemeConfig(
  row?: Partial<AdminSiteThemeConfig> | null,
): AdminSiteThemeConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}
  const paletteValue =
    value.palette && typeof value.palette === "object"
      ? (value.palette as Record<string, unknown>)
      : {}
  const typographyValue =
    value.typography && typeof value.typography === "object"
      ? (value.typography as Record<string, unknown>)
      : {}

  return {
    config_key: row?.config_key ?? SITE_THEME_KEY,
    config_value: {
      palette: {
        page_background: normalizeThemeColor(
          paletteValue.page_background,
          DEFAULT_SITE_THEME_PALETTE.page_background,
        ),
        surface_background: normalizeThemeColor(
          paletteValue.surface_background,
          DEFAULT_SITE_THEME_PALETTE.surface_background,
        ),
        border_color: normalizeThemeColor(
          paletteValue.border_color,
          DEFAULT_SITE_THEME_PALETTE.border_color,
        ),
        heading_color: normalizeThemeColor(
          paletteValue.heading_color,
          DEFAULT_SITE_THEME_PALETTE.heading_color,
        ),
        body_color: normalizeThemeColor(
          paletteValue.body_color,
          DEFAULT_SITE_THEME_PALETTE.body_color,
        ),
        muted_color: normalizeThemeColor(
          paletteValue.muted_color,
          DEFAULT_SITE_THEME_PALETTE.muted_color,
        ),
        link_color: normalizeThemeColor(
          paletteValue.link_color,
          DEFAULT_SITE_THEME_PALETTE.link_color,
        ),
        link_hover_color: normalizeThemeColor(
          paletteValue.link_hover_color,
          DEFAULT_SITE_THEME_PALETTE.link_hover_color,
        ),
        selection_background: normalizeThemeColor(
          paletteValue.selection_background,
          DEFAULT_SITE_THEME_PALETTE.selection_background,
        ),
        selection_foreground: normalizeThemeColor(
          paletteValue.selection_foreground,
          DEFAULT_SITE_THEME_PALETTE.selection_foreground,
        ),
      },
      typography: {
        h1: normalizeSiteThemeTextStyle(typographyValue.h1, DEFAULT_SITE_THEME_TYPOGRAPHY.h1),
        h2: normalizeSiteThemeTextStyle(typographyValue.h2, DEFAULT_SITE_THEME_TYPOGRAPHY.h2),
        h3: normalizeSiteThemeTextStyle(typographyValue.h3, DEFAULT_SITE_THEME_TYPOGRAPHY.h3),
        h4: normalizeSiteThemeTextStyle(typographyValue.h4, DEFAULT_SITE_THEME_TYPOGRAPHY.h4),
        h5: normalizeSiteThemeTextStyle(typographyValue.h5, DEFAULT_SITE_THEME_TYPOGRAPHY.h5),
        h6: normalizeSiteThemeTextStyle(typographyValue.h6, DEFAULT_SITE_THEME_TYPOGRAPHY.h6),
        paragraph: normalizeSiteThemeTextStyle(
          typographyValue.paragraph,
          DEFAULT_SITE_THEME_TYPOGRAPHY.paragraph,
        ),
        list_item: normalizeSiteThemeTextStyle(
          typographyValue.list_item,
          DEFAULT_SITE_THEME_TYPOGRAPHY.list_item,
        ),
        link: normalizeSiteThemeTextStyle(typographyValue.link, DEFAULT_SITE_THEME_TYPOGRAPHY.link),
        label: normalizeSiteThemeTextStyle(typographyValue.label, DEFAULT_SITE_THEME_TYPOGRAPHY.label),
        small: normalizeSiteThemeTextStyle(typographyValue.small, DEFAULT_SITE_THEME_TYPOGRAPHY.small),
      },
    },
    description:
      row?.description ??
      "Configuração pública de tipografia e cores base do site, aplicada às tags globais e conteúdos textuais.",
    is_public: row?.is_public ?? true,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminPublicFormNotificationsConfig(
  row?: Partial<AdminPublicFormNotificationsConfig> | null,
): AdminPublicFormNotificationsConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const notificationEmail = String(value.notification_email ?? "").trim().toLowerCase()

  return {
    config_key: row?.config_key ?? PUBLIC_FORM_NOTIFICATIONS_KEY,
    config_value: {
      notification_email: notificationEmail,
    },
    description:
      row?.description ??
      "Endereço de email que recebe alertas dos formulários enviados no site público.",
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminSiteMaintenanceConfig(
  row?: Partial<AdminSiteMaintenanceConfig> | null,
): AdminSiteMaintenanceConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const message = String(value.message ?? "").trim()

  return {
    config_key: row?.config_key ?? SITE_MAINTENANCE_KEY,
    config_value: {
      enabled: value.enabled === true,
      message:
        message || "Estamos em manutencao para melhorar a tua experiência. Voltamos em breve.",
    },
    description:
      row?.description ??
      "Controle operacional do modo de manutencao da plataforma. Quando ativo, apenas admins autenticados acessam a aplicação.",
    is_public: row?.is_public ?? true,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminLegacyPageEditorConfig(
  row?: Partial<AdminLegacyPageEditorConfig> | null,
): AdminLegacyPageEditorConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  return {
    config_key: row?.config_key ?? LEGACY_PAGE_EDITOR_KEY,
    config_value: {
      enabled: value.enabled === true,
    },
    description:
      row?.description ?? "Controle da visibilidade do editor de páginas legado na plataforma admin.",
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeAdminAiPageEditorConfig(
  row?: Partial<AdminAiPageEditorConfig> | null,
): AdminAiPageEditorConfig {
  const value =
    row?.config_value && typeof row.config_value === "object"
      ? (row.config_value as Record<string, unknown>)
      : {}

  const allowedPaths = Array.isArray(value.allowed_paths)
    ? value.allowed_paths.map((item) => String(item ?? "").trim()).filter(Boolean)
    : []

  return {
    config_key: row?.config_key ?? AI_PAGE_EDITOR_KEY,
    config_value: {
      enabled: value.enabled === true,
      launcher_label: String(value.launcher_label ?? "Editar com IA").trim() || "Editar com IA",
      allowed_paths: allowedPaths,
      primary_provider: String(value.primary_provider ?? "").trim().toLowerCase() === "gemini" ? "gemini" : "openai",
      fallback_provider: String(value.fallback_provider ?? "").trim().toLowerCase() === "openai" ? "openai" : "gemini",
      gemini_model: String(value.gemini_model ?? "gemini-2.0-flash").trim() || "gemini-2.0-flash",
      openai_model: String(value.openai_model ?? "gpt-4.1-mini").trim() || "gpt-4.1-mini",
      max_attachments: Math.max(0, Math.min(6, Number(value.max_attachments ?? 2))),
      max_attachment_size_mb: Math.max(1, Math.min(20, Number(value.max_attachment_size_mb ?? 8))),
      base_prompt: String(value.base_prompt ?? "").trim(),
      require_confirmation: value.require_confirmation !== false,
      panel_width: String(value.panel_width ?? "wide") === "compact" ? "compact" : "wide",
    },
    description:
      row?.description ??
      "Configuração do editor via IA embutido no frontend. As chaves sensíveis ficam no backend seguro.",
    is_public: row?.is_public ?? false,
    updated_at: row?.updated_at ?? null,
  }
}

export async function uploadAdminModulePdf(input: {
  moduleId: string
  file: File
  replacePath?: string | null
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "module_pdf")
  formData.append("moduleId", input.moduleId)
  formData.append("file", input.file)
  if (input.replacePath) {
    formData.append("replacePath", input.replacePath)
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return (data as { success: true; upload: AdminStorageUploadResult }).upload
}

export async function uploadAdminProductCover(input: {
  productId: string
  file: File
  replacePath?: string | null
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "product_cover")
  formData.append("productId", input.productId)
  formData.append("file", input.file)
  if (input.replacePath) {
    formData.append("replacePath", input.replacePath)
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return (data as { success: true; upload: AdminStorageUploadResult }).upload
}

export async function uploadAdminModuleAssetFile(input: {
  moduleId: string
  file: File
  replacePath?: string | null
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "module_asset")
  formData.append("moduleId", input.moduleId)
  formData.append("file", input.file)
  if (input.replacePath) {
    formData.append("replacePath", input.replacePath)
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return (data as { success: true; upload: AdminStorageUploadResult }).upload
}

export async function createAdminModuleAssetSignedUpload(input: {
  moduleId: string
  fileName: string
  mimeType: string
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "module_asset_signed_url")
  formData.append("moduleId", input.moduleId)
  formData.append("fileName", input.fileName)
  formData.append("mimeType", input.mimeType)

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return (data as { success: true; upload: AdminModuleAssetSignedUploadResult }).upload
}

export async function fetchAdminModuleAssetUploadLimit(moduleId: string) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "module_asset_limits")
  formData.append("moduleId", moduleId)

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  const upload = (data as { success: true; upload: Partial<AdminModuleAssetUploadLimitResult> }).upload

  return {
    bucket: String(upload.bucket ?? "").trim(),
    max_file_size_bytes:
      typeof upload.max_file_size_bytes === "number" && Number.isFinite(upload.max_file_size_bytes)
        ? upload.max_file_size_bytes
        : null,
  } satisfies AdminModuleAssetUploadLimitResult
}

export async function uploadAdminWatermarkLogoFile(input: {
  file: File
  replacePath?: string | null
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "watermark_logo")
  formData.append("file", input.file)
  if (input.replacePath) {
    formData.append("replacePath", input.replacePath)
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return (data as { success: true; upload: AdminStorageUploadResult }).upload
}

export async function uploadAdminBrandingAssetFile(input: {
  role: "logo_light" | "logo_dark" | "favicon"
  file: File
  replacePath?: string | null
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("kind", "branding_asset")
  formData.append("assetRole", input.role)
  formData.append("file", input.file)
  if (input.replacePath) {
    formData.append("replacePath", input.replacePath)
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-storage-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`

    throw new Error(message)
  }

  return (data as { success: true; upload: AdminStorageUploadResult }).upload
}

export async function fetchAdminUsers() {
  const response = await invokeAdminFunction<{ success: true; users: AdminUserSummary[] }>("admin-users", {
    action: "list",
  })
  return response.users ?? []
}

export async function fetchAdminProducts() {
  const selectWithCategories =
    "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,launch_date,is_public,creator_id,creator_commission_percent,workload_minutes,has_linear_progression,quiz_type_settings,public_page_content,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,category_id,published_at"
  const selectLegacy =
    "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,launch_date,is_public,creator_id,creator_commission_percent,workload_minutes,has_linear_progression,quiz_type_settings,public_page_content,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,published_at"

  const { data, error } = await supabase
    .from("products")
    .select(selectWithCategories)
    .order("updated_at", { ascending: false })

  if (error && isSchemaMismatch(error, "category_id")) {
    const legacy = await supabase
      .from("products")
      .select(selectLegacy)
      .order("updated_at", { ascending: false })

    if (legacy.error) {
      throw legacy.error
    }

    const normalized = ((legacy.data ?? []) as Record<string, unknown>[]).map((item) => ({ ...item, category_id: null }))
    return normalized as ProductSummary[]
  }

  if (error) {
    throw error
  }

  return (data ?? []) as ProductSummary[]
}

export async function fetchAdminProductCategories() {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id,slug,title,description,sort_order,is_active,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error && isSchemaMismatch(error, "product_categories")) {
    return []
  }

  if (error) {
    throw error
  }

  return (data ?? []) as ProductCategorySummary[]
}

export async function createAdminProductCategory(input: {
  slug: string
  title: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}) {
  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      slug: input.slug.trim().toLowerCase(),
      title: input.title.trim(),
      description: input.description ?? null,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select("id,slug,title,description,sort_order,is_active,created_at,updated_at")
    .single()

  if (error) {
    throw error
  }

  return data as ProductCategorySummary
}

export async function updateAdminProductCategory(input: {
  categoryId: string
  slug?: string
  title?: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}) {
  const updates: Record<string, unknown> = {}

  if (input.slug !== undefined) updates.slug = input.slug.trim().toLowerCase()
  if (input.title !== undefined) updates.title = input.title.trim()
  if (input.description !== undefined) updates.description = input.description
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder
  if (input.isActive !== undefined) updates.is_active = input.isActive

  const { data, error } = await supabase
    .from("product_categories")
    .update(updates)
    .eq("id", input.categoryId)
    .select("id,slug,title,description,sort_order,is_active,created_at,updated_at")
    .single()

  if (error) {
    throw error
  }

  return data as ProductCategorySummary
}

export async function deleteAdminProductCategory(categoryId: string) {
  const { error } = await supabase.from("product_categories").delete().eq("id", categoryId)

  if (error) {
    throw error
  }

  return { success: true as const }
}

export async function fetchAdminOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,user_id,product_id,status,currency,base_price_cents,discount_cents,final_price_cents,payment_provider,payment_reference,checkout_session_id,payment_environment,paid_at,refunded_at,created_at",
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminOrderSummary[]
}

export async function fetchAdminOrdersView() {
  const response = await invokeAdminFunction<{
    success: true
    summary: {
      totalOrders: number
      pendingCount: number
      refundedCount: number
    }
    orders: AdminOrderViewSummary[]
  }>("admin-orders-view", {
    action: "list",
  })

  return {
    summary: response.summary,
    orders: response.orders ?? [],
  }
}

export async function fetchAdminPaymentsStatus() {
  const response = await invokeAdminFunction<{ success: true; stripe: AdminPaymentsStatus["stripe"] }>(
    "admin-payments-status",
    {},
  )

  return response.stripe
}

export async function updateAdminCheckoutModeConfig(mode: CheckoutMode) {
  const response = await invokeAdminFunction<{
    success: true
    checkout_mode: AdminCheckoutModeConfig
  }>("admin-checkout-mode", {
    action: "update",
    mode,
  })

  return normalizeCheckoutModeConfig(response.checkout_mode)
}

export async function fetchAdminCheckoutModeConfig() {
  const response = await invokeAdminFunction<{
    success: true
    checkout_mode: AdminCheckoutModeConfig | null
  }>("admin-checkout-mode", {
    action: "get",
  })

  return response.checkout_mode ? normalizeCheckoutModeConfig(response.checkout_mode) : null
}

export async function fetchAdminBrandingConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", BRANDING_CONFIG_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminBrandingConfig(data as Partial<AdminBrandingConfig> | null)
}

export async function fetchAdminTrackingConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", TRACKING_CONFIG_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminTrackingConfig(data as Partial<AdminTrackingConfig> | null)
}

export async function fetchPublicTrackingConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", TRACKING_CONFIG_KEY)
    .eq("is_public", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminTrackingConfig(data as Partial<AdminTrackingConfig> | null)
}

export async function fetchPublicBrandingConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", BRANDING_CONFIG_KEY)
    .eq("is_public", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminBrandingConfig(data as Partial<AdminBrandingConfig> | null)
}

export async function fetchPublicSiteMaintenanceConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", SITE_MAINTENANCE_KEY)
    .eq("is_public", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminSiteMaintenanceConfig(data as Partial<AdminSiteMaintenanceConfig> | null)
}

export async function fetchAdminSiteThemeConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", SITE_THEME_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminSiteThemeConfig(data as Partial<AdminSiteThemeConfig> | null)
}

export async function fetchPublicSiteThemeConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", SITE_THEME_KEY)
    .eq("is_public", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminSiteThemeConfig(data as Partial<AdminSiteThemeConfig> | null)
}

export async function fetchAdminModulePdfWatermarkConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", MODULE_PDF_WATERMARK_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeModulePdfWatermarkConfig(data as Partial<AdminModulePdfWatermarkConfig> | null)
}

export async function fetchAdminPendingInfoConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", ADMIN_PENDING_INFO_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminPendingInfoConfig(data as Partial<AdminPendingInfoConfig> | null)
}

export async function fetchAdminEmailStatus() {
  const response = await invokeAdminFunction<{ success: true; email: AdminEmailStatus }>("admin-email-status", {})
  return response.email
}

export async function fetchAdminCronStatus(): Promise<AdminCronStatusOverview> {
  const response = await invokeAdminFunction<{
    success: true
    scheduledJobs: AdminCronScheduleSummary[] | null
    jobRuns: AdminJobRunSummary[] | null
  }>("admin-cron-scheduler", {
    action: "status",
  })

  return {
    scheduledJobs: response.scheduledJobs ?? [],
    jobRuns: response.jobRuns ?? [],
  }
}

export async function scheduleAdminCronJobs() {
  const response = await invokeAdminFunction<{
    success: true
    schedule: {
      success: boolean
      scheduled_count: number
      jobs: AdminCronScheduleSummary[]
    }
  }>("admin-cron-scheduler", {
    action: "schedule",
  })

  return response.schedule
}

export async function runOneAdminCron(input: {
  cron: AdminCronKey
  batchSize?: number
  maxAttempts?: number
  retentionHours?: number
  maxUsers?: number
  dryRun?: boolean
}) {
  const response = await invokeAdminFunction<{
    success: boolean
    run: AdminCronInvokeResult
  }>("admin-cron-scheduler", {
    action: "run_one",
    ...input,
  })

  return response.run
}

export async function runAllAdminCrons() {
  const response = await invokeAdminFunction<{
    success: boolean
    runs: AdminCronInvokeResult[]
  }>("admin-cron-scheduler", {
    action: "run_all",
  })

  return response.runs ?? []
}

export async function queueAdminCronTestEmail(input: { emailTo: string; processImmediately?: boolean }) {
  const response = await invokeAdminFunction<{
    success: boolean
    emailDelivery: AdminEmailDeliverySummary
    process: AdminCronInvokeResult | null
  }>("admin-cron-scheduler", {
    action: "queue_test_email",
    ...input,
  })

  return response
}

export async function updateAdminModulePdfWatermarkConfig(input: {
  siteName: string
  logoBucket?: string | null
  logoPath?: string | null
}) {
  const payload = normalizeModulePdfWatermarkConfig({
    config_key: MODULE_PDF_WATERMARK_KEY,
    config_value: {
      site_name: input.siteName,
      logo_bucket: input.logoBucket ?? null,
      logo_path: input.logoPath ?? null,
    },
    description: "Configuração do watermark aplicado ao PDF base dos módulos.",
    is_public: false,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (...args: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Partial<AdminModulePdfWatermarkConfig> | null; error: Error | null }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: MODULE_PDF_WATERMARK_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: false,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return normalizeModulePdfWatermarkConfig(data as Partial<AdminModulePdfWatermarkConfig>)
}

export async function updateAdminBrandingConfig(input: AdminBrandingConfig["config_value"]) {
  const payload = normalizeAdminBrandingConfig({
    config_key: BRANDING_CONFIG_KEY,
    config_value: input,
    description: "Assets oficiais de branding usados nas Áreas pública, aluno e admin.",
    is_public: true,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (...args: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Partial<AdminBrandingConfig> | null; error: Error | null }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: BRANDING_CONFIG_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: true,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return normalizeAdminBrandingConfig(data as Partial<AdminBrandingConfig>)
}

export async function updateAdminTrackingConfig(
  input: AdminTrackingConfig["config_value"],
) {
  const payload = normalizeAdminTrackingConfig({
    config_key: TRACKING_CONFIG_KEY,
    config_value: input,
    description:
      "Configuração pública de rastreamento e códigos personalizados do site, respeitando consentimento quando aplicável.",
    is_public: true,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (...args: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Partial<AdminTrackingConfig> | null; error: Error | null }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: TRACKING_CONFIG_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: true,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return normalizeAdminTrackingConfig(data as Partial<AdminTrackingConfig>)
}

export async function updateAdminSiteThemeConfig(
  input: AdminSiteThemeConfig["config_value"],
) {
  const payload = normalizeAdminSiteThemeConfig({
    config_key: SITE_THEME_KEY,
    config_value: input,
    description:
      "Configuração pública de tipografia e cores base do site, aplicada às tags globais e conteúdos textuais.",
    is_public: true,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (...args: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Partial<AdminSiteThemeConfig> | null; error: Error | null }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: SITE_THEME_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: true,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return normalizeAdminSiteThemeConfig(data as Partial<AdminSiteThemeConfig>)
}

export async function updateAdminPendingInfoConfig(
  input: AdminPendingInfoConfig["config_value"],
) {
  const payload = normalizeAdminPendingInfoConfig({
    config_key: ADMIN_PENDING_INFO_KEY,
    config_value: input,
    description:
      "Informações operacionais ainda pendentes de definicao manual pelo admin. Não armazenar segredos aqui.",
    is_public: false,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (...args: unknown[]) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Partial<AdminPendingInfoConfig> | null; error: Error | null }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: ADMIN_PENDING_INFO_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: false,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return normalizeAdminPendingInfoConfig(data as Partial<AdminPendingInfoConfig>)
}

export async function updateAdminPublicFormNotificationsConfig(
  input: AdminPublicFormNotificationsConfig["config_value"],
) {
  const notificationEmail = String(input.notification_email ?? "").trim().toLowerCase()
  const payload = {
    config_key: PUBLIC_FORM_NOTIFICATIONS_KEY,
    config_value: {
      notification_email: notificationEmail,
    },
    description: "Endereço de email que recebe alertas dos formulários enviados no site público.",
    is_public: false,
  }

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (
      values: {
        config_key: string
        config_value: { notification_email: string }
        description: string
        is_public: boolean
      },
      options: { onConflict: "config_key" },
    ) => {
      select: (
        fields: string,
      ) => Promise<{ data: Partial<AdminPublicFormNotificationsConfig> | null; error: Error | null }>
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: PUBLIC_FORM_NOTIFICATIONS_KEY,
        config_value: payload.config_value,
        description: payload.description,
        is_public: payload.is_public,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")

  if (error) {
    throw error
  }

  return normalizeAdminPublicFormNotificationsConfig(data ?? payload)
}

export async function updateAdminSiteMaintenanceConfig(
  input: AdminSiteMaintenanceConfig["config_value"],
) {
  const payload = normalizeAdminSiteMaintenanceConfig({
    config_key: SITE_MAINTENANCE_KEY,
    config_value: {
      enabled: input.enabled,
      message: input.message,
    },
    description:
      "Controle operacional do modo de manutencao da plataforma. Quando ativo, apenas admins autenticados acessam a aplicação.",
    is_public: true,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (
      values: {
        config_key: string
        config_value: { enabled: boolean; message: string }
        description: string
        is_public: boolean
      },
      options: { onConflict: "config_key" },
    ) => {
      select: (
        fields: string,
      ) => Promise<{ data: Partial<AdminSiteMaintenanceConfig> | null; error: Error | null }>
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: SITE_MAINTENANCE_KEY,
        config_value: payload.config_value,
        description: payload.description ?? "",
        is_public: true,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")

  if (error) {
    throw error
  }

  return normalizeAdminSiteMaintenanceConfig(data ?? payload)
}

export async function updateAdminAiPageEditorConfig(input: {
  configValue: AdminAiPageEditorConfig["config_value"]
  geminiApiKey?: string | null
  openaiApiKey?: string | null
}) {
  const response = await invokeAdminFunction<{
    success: true
    config: AdminAiPageEditorConfig
    secret_status: AdminAiPageEditorSecretStatus
  }>("admin-ai-page-editor", {
    action: "update_config",
    configValue: input.configValue,
    geminiApiKey: input.geminiApiKey ?? null,
    openaiApiKey: input.openaiApiKey ?? null,
  })

  return {
    ...normalizeAdminAiPageEditorConfig(response.config),
    secret_status: response.secret_status,
  }
}

export async function fetchAdminPublicFormNotificationsConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", PUBLIC_FORM_NOTIFICATIONS_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminPublicFormNotificationsConfig(data as Partial<AdminPublicFormNotificationsConfig>)
}

export async function fetchAdminSiteMaintenanceConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", SITE_MAINTENANCE_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminSiteMaintenanceConfig(data as Partial<AdminSiteMaintenanceConfig> | null)
}

export async function fetchAdminLegacyPageEditorConfig() {
  const { data, error } = await supabase
    .from("site_config")
    .select("config_key,config_value,description,is_public,updated_at")
    .eq("config_key", LEGACY_PAGE_EDITOR_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeAdminLegacyPageEditorConfig(data as Partial<AdminLegacyPageEditorConfig> | null)
}

export async function updateAdminLegacyPageEditorConfig(input: {
  enabled: boolean
}) {
  const payload = normalizeAdminLegacyPageEditorConfig({
    config_key: LEGACY_PAGE_EDITOR_KEY,
    config_value: {
      enabled: input.enabled,
    },
    description: "Controle da visibilidade do editor de páginas legado na plataforma admin.",
    is_public: false,
  })

  const siteConfigTable = supabase.from("site_config") as unknown as {
    upsert: (
      values: {
        config_key: string
        config_value: { enabled: boolean }
        description: string
        is_public: boolean
      },
      options: { onConflict: "config_key" },
    ) => {
      select: (
        fields: string,
      ) => {
        single: () => Promise<{ data: Partial<AdminLegacyPageEditorConfig> | null; error: Error | null }>
      }
    }
  }

  const { data, error } = await siteConfigTable
    .upsert(
      {
        config_key: LEGACY_PAGE_EDITOR_KEY,
        config_value: payload.config_value,
        description: payload.description ?? "",
        is_public: false,
      },
      { onConflict: "config_key" },
    )
    .select("config_key,config_value,description,is_public,updated_at")
    .single()

  if (error) {
    throw error
  }

  return normalizeAdminLegacyPageEditorConfig(data as Partial<AdminLegacyPageEditorConfig> | null)
}

export async function fetchAdminAiPageEditorConfig() {
  const response = await invokeAdminFunction<{
    success: true
    config: AdminAiPageEditorConfig
    secret_status: AdminAiPageEditorSecretStatus
  }>("admin-ai-page-editor", {
    action: "get_config",
  })

  return {
    ...normalizeAdminAiPageEditorConfig(response.config),
    secret_status: response.secret_status,
  }
}

export async function testAdminAiPageEditorProviders() {
  return await invokeAdminFunction<{
    success: true
    provider_used: "gemini" | "openai" | null
    details: string
    summary: string
    provider_results: AdminAiPageEditorProviderTestResult[]
    secret_status: AdminAiPageEditorSecretStatus
  }>("admin-ai-page-editor", {
    action: "test_providers",
  })
}

export async function fetchAdminAiPageEditorUsageMetrics(periodDays = 30) {
  return await invokeAdminFunction<{
    success: true
    summary: AdminAiPageEditorUsageMetrics["summary"]
    breakdown: AdminAiPageEditorUsageMetrics["breakdown"]
    recent_events: AdminAiPageEditorUsageMetrics["recent_events"]
    pricing_reference: AdminAiPageEditorUsageMetrics["pricing_reference"]
  }>("admin-ai-page-editor", {
    action: "get_usage_metrics",
    periodDays,
  })
}

export async function generateAdminAiPageEditorProposal(input: {
  slug: string
  title: string
  path: string
  clientRequestId: string
  message: string
  currentLayoutJson: Record<string, unknown>
  currentStyleJson: Record<string, unknown>
  currentHtml: string
  attachments: Array<{
    name: string
    mime_type: string
    data_url: string
    size_bytes: number
  }>
  conversationContext?: AdminAiPageEditorConversationContext
}) {
  try {
    const response = await invokeAdminFunction<{
      success: true
      request_id?: string
      client_request_id?: string | null
      provider_used: AdminAiPageEditorConversationResponse["provider_used"]
      conversation_phase: AdminAiPageEditorConversationResponse["conversation_phase"]
      assistant_message: string
      quick_replies: string[]
      understanding_summary: string | null
      confirmation_token?: string | null
      confirmation_consumed?: boolean
      requires_user_confirmation: boolean
      can_generate_proposal: boolean
      warnings: string[]
      edit_plan?: AdminAiPageEditorConversationResponse["edit_plan"]
      proposal?: AdminAiPageEditorConversationResponse["proposal"]
      summary?: string
      explanation?: string
      final_status: AdminAiPageEditorConversationResponse["final_status"]
      change_detected: boolean
      draft_saved: boolean
      preview_available: boolean
      change_summary: AdminAiPageEditorConversationResponse["change_summary"]
    }>("admin-ai-page-editor", {
      action: "generate_proposal",
      client_request_id: input.clientRequestId,
      slug: input.slug,
      title: input.title,
      path: input.path,
      message: input.message,
      currentLayoutJson: input.currentLayoutJson,
      currentStyleJson: input.currentStyleJson,
      currentHtml: input.currentHtml,
      attachments: input.attachments,
      conversationContext: input.conversationContext,
    })

    return ensureAdminAiPageEditorConversationResponse(response)
  } catch (error) {
    throw normalizeAdminAiPageEditorError(error)
  }
}

export async function generateAdminAiFooterCopyProposal(input: {
  title: string
  path: string
  message: string
  currentFooterText: string
}) {
  try {
    const response = await invokeAdminFunction<{
      success: true
      provider_used: "gemini" | "openai"
      summary: string
      explanation: string
      warnings: string[]
      footer_description: string
    }>("admin-ai-page-editor", {
      action: "generate_footer_copy",
      title: input.title,
      path: input.path,
      message: input.message,
      currentFooterText: input.currentFooterText,
    })

    return ensureAdminAiFooterCopyProposalResponse(response)
  } catch (error) {
    throw normalizeAdminAiPageEditorError(error)
  }
}

export async function generateAdminAiHeaderCopyProposal(input: {
  title: string
  path: string
  message: string
  currentHeaderText: string
}) {
  try {
    const response = await invokeAdminFunction<{
      success: true
      provider_used: "gemini" | "openai"
      summary: string
      explanation: string
      warnings: string[]
      header_announcement: string
    }>("admin-ai-page-editor", {
      action: "generate_header_copy",
      title: input.title,
      path: input.path,
      message: input.message,
      currentHeaderText: input.currentHeaderText,
    })

    return ensureAdminAiHeaderCopyProposalResponse(response)
  } catch (error) {
    throw normalizeAdminAiPageEditorError(error)
  }
}

export async function fetchAdminSitePages() {
  const response = await invokeAdminFunction<{
    success: true
    pages: AdminSitePageSummary[]
  }>("admin-page-builder", {
    action: "list_pages",
  })

  return response.pages ?? []
}

export async function fetchAdminSitePageDetail(slug: SitePageSlug | string) {
  const normalizedSlug = String(slug ?? "").trim()
  if (!normalizedSlug) {
    throw new Error("slug e obrigatório")
  }

  const response = await invokeAdminFunction<{
    success: true
    page: AdminSitePageSummary
    versions: AdminSitePageVersion[]
    published_version: AdminSitePageVersion | null
    latest_draft: AdminSitePageVersion | null
    assets: AdminSitePageAsset[]
  }>("admin-page-builder", {
    action: "get_page",
    slug: normalizedSlug,
  })

  return {
    page: response.page,
    versions: response.versions ?? [],
    published_version: response.published_version ?? null,
    latest_draft: response.latest_draft ?? null,
    assets: response.assets ?? [],
  } satisfies AdminSitePageDetail
}

export async function saveAdminSitePageDraft(input: {
  slug: SitePageSlug | string
  title?: string
  layoutJson: Record<string, unknown>
  styleJson?: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  const response = await invokeAdminFunction<{
    success: true
    page: AdminSitePageSummary
    version: AdminSitePageVersion
  }>("admin-page-builder", {
    action: "save_draft",
    slug: input.slug,
    title: input.title,
    layoutJson: input.layoutJson,
    styleJson: input.styleJson ?? {},
    metadata: input.metadata ?? {},
  })

  return {
    page: response.page,
    version: response.version,
  }
}

export async function publishAdminSitePageVersion(input: {
  slug: SitePageSlug | string
  versionId: string
}) {
  const response = await invokeAdminFunction<{
    success: true
    page: AdminSitePageSummary
    version: AdminSitePageVersion
  }>("admin-page-builder", {
    action: "publish",
    slug: input.slug,
    versionId: input.versionId,
  })

  return {
    page: response.page,
    version: response.version,
  }
}

export async function rollbackAdminSitePageVersion(input: {
  slug: SitePageSlug | string
  versionId: string
}) {
  const response = await invokeAdminFunction<{
    success: true
    page: AdminSitePageSummary
    version: AdminSitePageVersion
  }>("admin-page-builder", {
    action: "rollback",
    slug: input.slug,
    versionId: input.versionId,
  })

  return {
    page: response.page,
    version: response.version,
  }
}

export async function unpublishAdminSitePage(input: {
  slug: SitePageSlug | string
}) {
  const response = await invokeAdminFunction<{
    success: true
    page: AdminSitePageSummary
    version: AdminSitePageVersion | null
  }>("admin-page-builder", {
    action: "unpublish",
    slug: input.slug,
  })

  return {
    page: response.page,
    version: response.version,
  }
}

export async function uploadAdminSitePageAssetFile(input: {
  slug: SitePageSlug | string
  file: File
}) {
  const auth = await requireFreshAuth()
  const formData = new FormData()
  formData.append("slug", String(input.slug ?? "").trim())
  formData.append("file", input.file)

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/admin-page-assets`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth.headers.Authorization,
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type") ?? ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message ?? `Edge Function returned ${response.status}`)
        : typeof data === "string" && data
          ? data
          : `Edge Function returned ${response.status}`
    throw new Error(message)
  }

  return (data as { success: true; asset: AdminSitePageAsset; upload: AdminStorageUploadResult })
}

export async function fetchAdminProductModules(productId: string) {
  const response = await invokeAdminFunction<{ success: true; modules: ProductModuleSummary[] }>("admin-content", {
    action: "list_modules",
    productId,
  })

  return response.modules ?? []
}

export async function createAdminProductModule(input: {
  productId: string
  title: string
  description?: string | null
  module_type?: ProductModuleSummary["module_type"]
  access_type?: ProductModuleSummary["access_type"]
  position?: number
  sort_order?: number
  is_preview?: boolean
  is_required?: boolean
  starts_at?: string | null
  ends_at?: string | null
  release_days_after_enrollment?: number | null
  module_pdf_storage_path?: string | null
  module_pdf_file_name?: string | null
  module_pdf_uploaded_at?: string | null
  status?: ProductModuleSummary["status"]
}) {
  const response = await invokeAdminFunction<{ success: true; module: ProductModuleSummary }>("admin-content", {
    action: "create_module",
    ...input,
  })

  return response.module
}

export async function updateAdminProductModule(input: {
  moduleId: string
  title?: string
  description?: string | null
  module_type?: ProductModuleSummary["module_type"]
  access_type?: ProductModuleSummary["access_type"]
  position?: number
  sort_order?: number
  is_preview?: boolean
  is_required?: boolean
  starts_at?: string | null
  ends_at?: string | null
  release_days_after_enrollment?: number | null
  module_pdf_storage_path?: string | null
  module_pdf_file_name?: string | null
  module_pdf_uploaded_at?: string | null
  status?: ProductModuleSummary["status"]
}) {
  const response = await invokeAdminFunction<{ success: true; module: ProductModuleSummary }>("admin-content", {
    action: "update_module",
    ...input,
  })

  return response.module
}

export async function deleteAdminProductModule(moduleId: string) {
  await invokeAdminFunction<{ success: true }>("admin-content", {
    action: "delete_module",
    moduleId,
  })
}

export async function fetchAdminModuleAssets(moduleId: string) {
  const response = await invokeAdminFunction<{ success: true; assets: ModuleAssetSummary[] }>("admin-content", {
    action: "list_assets",
    moduleId,
  })

  return response.assets ?? []
}

export async function createAdminModuleAsset(input: {
  moduleId: string
  asset_type: ModuleAssetSummary["asset_type"]
  title: string
  sort_order_asset?: number
  storage_bucket?: string | null
  storage_path?: string | null
  external_url?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  allow_download?: boolean
  allow_stream?: boolean
  watermark_enabled?: boolean
  asset_status?: ModuleAssetSummary["status"]
}) {
  const response = await invokeAdminFunction<{ success: true; asset: ModuleAssetSummary }>("admin-content", {
    action: "create_asset",
    ...input,
  })

  return response.asset
}

export async function updateAdminModuleAsset(input: {
  assetId: string
  asset_type?: ModuleAssetSummary["asset_type"]
  title?: string
  sort_order_asset?: number
  storage_bucket?: string | null
  storage_path?: string | null
  external_url?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  allow_download?: boolean
  allow_stream?: boolean
  watermark_enabled?: boolean
  asset_status?: ModuleAssetSummary["status"]
}) {
  const response = await invokeAdminFunction<{ success: true; asset: ModuleAssetSummary }>("admin-content", {
    action: "update_asset",
    ...input,
  })

  return response.asset
}

export async function deleteAdminModuleAsset(assetId: string) {
  await invokeAdminFunction<{ success: true }>("admin-content", {
    action: "delete_asset",
    assetId,
  })
}

export async function deleteAdminLessonStorageObject(input: {
  productId?: string | null
  moduleId?: string | null
  mediaBucket: string
  mediaPath: string
}) {
  await invokeAdminFunction<{ success: true }>("admin-content", {
    action: "delete_storage_object",
    productId: input.productId ?? null,
    moduleId: input.moduleId ?? null,
    media_bucket: input.mediaBucket,
    media_path: input.mediaPath,
  })
}

export async function fetchAdminProductLessons(moduleId: string) {
  const response = await invokeAdminFunction<{ success: true; lessons: ProductLessonSummary[] }>("admin-content", {
    action: "list_lessons",
    moduleId,
  })

  return response.lessons ?? []
}

export async function createAdminProductLesson(input: {
  moduleId: string
  title: string
  description?: string | null
  position?: number
  is_required?: boolean
  lesson_type?: ProductLessonSummary["lesson_type"]
  youtube_url?: string | null
  text_content?: string | null
  estimated_minutes?: number
  starts_at?: string | null
  ends_at?: string | null
  status?: ProductLessonSummary["status"]
}) {
  const { status, ...rest } = input
  const response = await invokeAdminFunction<{ success: true; lesson: ProductLessonSummary }>("admin-content", {
    action: "create_lesson",
    ...rest,
    lesson_status: status,
  })

  return response.lesson
}

export async function updateAdminProductLesson(input: {
  lessonId: string
  title?: string
  description?: string | null
  position?: number
  is_required?: boolean
  lesson_type?: ProductLessonSummary["lesson_type"]
  youtube_url?: string | null
  text_content?: string | null
  estimated_minutes?: number
  starts_at?: string | null
  ends_at?: string | null
  status?: ProductLessonSummary["status"]
}) {
  const { status, ...rest } = input
  const response = await invokeAdminFunction<{ success: true; lesson: ProductLessonSummary }>("admin-content", {
    action: "update_lesson",
    ...rest,
    lesson_status: status,
  })

  return response.lesson
}

export async function deleteAdminProductLesson(lessonId: string) {
  await invokeAdminFunction<{ success: true }>("admin-content", {
    action: "delete_lesson",
    lessonId,
  })
}

export async function fetchAdminProductAssessments(productId: string) {
  const response = await invokeAdminFunction<{ success: true; assessments: ProductAssessmentSummary[] }>(
    "admin-content",
    {
      action: "list_assessments",
      productId,
    },
  )

  return response.assessments ?? []
}

export async function createAdminProductAssessment(input: AdminAssessmentMutationInput) {
  const response = await invokeAdminFunction<{ success: true; assessment: ProductAssessmentSummary }>(
    "admin-content",
    {
      action: "create_assessment",
      productId: input.productId,
      moduleId: input.moduleId ?? null,
      assessment_type: input.assessmentType,
      title: input.title,
      description: input.description ?? null,
      is_required: input.isRequired,
      passing_score: input.passingScore,
      max_attempts: input.maxAttempts ?? null,
      estimated_minutes: input.estimatedMinutes,
      is_active: input.isActive,
      builder_payload: input.builderPayload ?? {},
    },
  )

  return response.assessment
}

export async function updateAdminProductAssessment(input: AdminAssessmentUpdateInput) {
  const response = await invokeAdminFunction<{ success: true; assessment: ProductAssessmentSummary }>(
    "admin-content",
    {
      action: "update_assessment",
      assessmentId: input.assessmentId,
      productId: input.productId,
      moduleId: input.moduleId,
      assessment_type: input.assessmentType,
      title: input.title,
      description: input.description,
      is_required: input.isRequired,
      passing_score: input.passingScore,
      max_attempts: input.maxAttempts,
      estimated_minutes: input.estimatedMinutes,
      is_active: input.isActive,
      builder_payload: input.builderPayload,
    },
  )

  return response.assessment
}

export async function deleteAdminProductAssessment(assessmentId: string) {
  await invokeAdminFunction<{ success: true }>("admin-content", {
    action: "delete_assessment",
    assessmentId,
  })
}

export async function fetchAdminCourseReleases(productId: string) {
  const response = await invokeAdminFunction<{ success: true; releases: AdminCourseReleaseSummary[] }>(
    "admin-course-releases",
    {
      action: "list",
      productId,
    },
  )

  return response.releases ?? []
}

export async function createAdminCourseRelease(input: {
  productId: string
  userId: string
  expiresAt?: string | null
  notes?: string | null
}) {
  const response = await invokeAdminFunction<{ success: true; release: AdminCourseReleaseSummary }>(
    "admin-course-releases",
    {
      action: "create",
      ...input,
    },
  )

  return response.release
}

export async function revokeAdminCourseRelease(input: {
  grantId: string
  reason?: string | null
}) {
  const response = await invokeAdminFunction<{ success: true; release: AdminCourseReleaseSummary }>(
    "admin-course-releases",
    {
      action: "revoke",
      ...input,
    },
  )

  return response.release
}

export async function fetchAdminSupportTickets() {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,user_id,product_id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminSupportTicketSummary[]
}

export async function fetchAdminPublicFormSubmissions() {
  const { data, error } = await supabase
    .from("public_form_submissions")
    .select("id,form_type,source_page,full_name,email,subject,message,metadata,notified_email_to,notified_at,created_at,updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as PublicFormSubmissionSummary[]
}

export async function replyAdminPublicFormSubmission(input: {
  submissionId: string
  message: string
  subject?: string | null
}) {
  const response = await invokeAdminFunction<{
    success: true
    request_id: string
    submission_id: string
    email_to: string
    queued: boolean
  }>("admin-public-forms", {
    action: "reply",
    submissionId: input.submissionId,
    subject: input.subject ?? null,
    message: input.message,
  })

  return response
}

export async function fetchAdminSupportTicket(ticketId: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id,user_id,product_id,subject,message,status,priority,category,assigned_admin_id,last_reply_at,first_response_due_at,first_response_at,sla_status,attachment_bucket,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,created_at,updated_at")
    .eq("id", ticketId)
    .single()

  if (error) {
    throw error
  }

  return data as AdminSupportTicketSummary
}

export async function fetchAdminNotifications(includeArchived = false, userId?: string) {
  const targetUserId = userId ?? (await getCurrentUserId())
  const baseQuery = supabase
    .from("notifications")
    .select("id,user_id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })

  const query = includeArchived ? baseQuery : baseQuery.neq("status", "archived")
  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as AdminNotificationSummary[]
}

export async function markAdminNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select("id,user_id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")
    .single()

  if (error) {
    throw error
  }

  return data as AdminNotificationSummary
}

export async function markAllAdminNotificationsAsRead() {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "archived",
      read_at: new Date().toISOString(),
    })
    .neq("status", "archived")
    .select("id,user_id,type,title,message,link,status,sent_via_email,sent_via_in_app,read_at,created_at")

  if (error) {
    throw error
  }

  return (data ?? []) as AdminNotificationSummary[]
}

export async function fetchAdminAffiliates() {
  const { data, error } = await supabase
    .from("affiliates")
    .select("id,user_id,affiliate_code,status,commission_type,commission_value,created_at,updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminAffiliateSummary[]
}

export async function fetchAdminAffiliateReferrals() {
  const { data, error } = await supabase
    .from("affiliate_referrals")
    .select("id,affiliate_id,user_id,product_id,order_id,referral_code,status,commission_cents,tracked_at,converted_at,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminAffiliateReferralSummary[]
}

export async function fetchAdminCoupons() {
  const { data, error } = await supabase
    .from("coupons")
    .select("id,code,title,discount_type,discount_value,status,starts_at,expires_at,max_uses,max_uses_per_user,current_uses,minimum_order_cents,created_at,updated_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminCouponSummary[]
}

export async function fetchAdminCouponUsages() {
  const { data, error } = await supabase
    .from("coupon_usages")
    .select("id,coupon_id,user_id,order_id,discount_cents,used_at")
    .order("used_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AdminCouponUsageSummary[]
}

export async function fetchAdminSupportTicketMessages(ticketId: string) {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id,ticket_id,sender_user_id,sender_role,message,attachment_bucket,attachment_path,attachment_name,attachment_mime_type,attachment_size_bytes,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as SupportTicketMessage[]
}

export async function fetchAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [users, products, orders] = await Promise.all([
    fetchAdminUsers(),
    fetchAdminProducts(),
    fetchAdminOrders(),
  ])

  return {
    totalUsers: users.length,
    totalPublishedProducts: products.filter((product) => product.status === "published").length,
    totalPaidOrders: orders.filter((order) => order.status === "paid").length,
    revenueCents: orders
      .filter((order) => order.status === "paid")
      .reduce((sum, order) => sum + order.final_price_cents, 0),
  }
}

export async function fetchAdminOperations(): Promise<AdminOperationsOverview> {
  const response = await invokeAdminFunction<{
    success: true
    summary: {
      queuedEmails: number
      failedEmails: number
      failedJobs: number
      deliveredEmails: number
    }
    emailDeliveries: AdminEmailDeliverySummary[]
    jobRuns: AdminJobRunSummary[]
  }>("admin-operations", {
    action: "list",
  })

  return {
    queuedEmails: response.summary.queuedEmails,
    failedEmails: response.summary.failedEmails,
    failedJobs: response.summary.failedJobs,
    deliveredEmails: response.summary.deliveredEmails,
    emailDeliveries: response.emailDeliveries ?? [],
    jobRuns: response.jobRuns ?? [],
  }
}

export async function fetchAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const response = await invokeAdminFunction<{
    success: true
    metrics: AdminDashboardMetrics
    recentOrders: AdminDashboardOverview["recentOrders"]
    alerts: AdminDashboardOverview["alerts"]
  }>("admin-dashboard", {
    action: "overview",
  })

  return {
    metrics: response.metrics,
    recentOrders: response.recentOrders ?? [],
    alerts: response.alerts,
  }
}

export function createAdminUser(input: {
  fullName: string
  email: string
  password: string
  role: AdminUserSummary["role"]
}) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "create",
    ...input,
  })
}

export function updateAdminUser(input: {
  userId: string
  fullName?: string
  email?: string
  role?: AdminUserSummary["role"]
  status?: AdminUserSummary["status"]
  notificationsEnabled?: boolean
  marketingConsent?: boolean
}) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "update",
    ...input,
  })
}

export function updateAdminUserPassword(input: { userId: string; password: string }) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "set_password",
    ...input,
  })
}

export function deleteAdminUser(userId: string) {
  return invokeAdminFunction<{ success: true; user: AdminUserSummary }>("admin-users", {
    action: "delete",
    userId,
  })
}

export function retryAdminEmailDelivery(emailDeliveryId: string) {
  return invokeAdminFunction<{
    success: true
    emailDelivery: AdminEmailDeliverySummary
  }>("admin-operations", {
    action: "retry_email",
    emailDeliveryId,
  })
}

export function createAdminProduct(input: {
  slug: string
  title: string
  coverImageUrl?: string | null
  shortDescription?: string | null
  description?: string | null
  productType: ProductSummary["product_type"]
  priceCents: number
  currency?: string
  salesPageEnabled?: boolean
  requiresAuth?: boolean
  isFeatured?: boolean
  allowAffiliate?: boolean
  sortOrder?: number
  categoryId?: string | null
  launchDate?: string | null
  isPublic?: boolean
  creatorId?: string | null
  creatorCommissionPercent?: number | null
  workloadMinutes?: number
  hasLinearProgression?: boolean
  quizTypeSettings?: Record<string, boolean>
  publicPageContent?: ProductSummary["public_page_content"]
}) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "create",
    ...input,
  })
}

export function updateAdminProduct(input: {
  productId: string
  slug?: string
  title?: string
  coverImageUrl?: string | null
  shortDescription?: string | null
  description?: string | null
  productType?: ProductSummary["product_type"]
  status?: ProductSummary["status"]
  priceCents?: number
  currency?: string
  salesPageEnabled?: boolean
  requiresAuth?: boolean
  isFeatured?: boolean
  allowAffiliate?: boolean
  sortOrder?: number
  categoryId?: string | null
  launchDate?: string | null
  isPublic?: boolean
  creatorId?: string | null
  creatorCommissionPercent?: number | null
  workloadMinutes?: number
  hasLinearProgression?: boolean
  quizTypeSettings?: Record<string, boolean>
  publicPageContent?: ProductSummary["public_page_content"]
}) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "update",
    ...input,
  })
}

export function publishAdminProduct(productId: string) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "publish",
    productId,
  })
}

export function archiveAdminProduct(productId: string) {
  return invokeAdminFunction<{ success: true; product: ProductSummary }>("admin-products", {
    action: "archive",
    productId,
  })
}

export function deleteAdminProduct(productId: string) {
  return invokeAdminFunction<{ success: true; productId: string }>("admin-products", {
    action: "delete",
    productId,
  })
}

export function markAdminOrderPaid(orderId: string, paymentReference?: string | null) {
  return invokeAdminFunction("admin-orders", { action: "mark_paid", orderId, paymentReference })
}

export function markAdminOrderRefunded(orderId: string, reason?: string | null) {
  return invokeAdminFunction("admin-orders", { action: "mark_refunded", orderId, reason })
}

export function markAdminOrderCancelled(orderId: string, reason?: string | null) {
  return invokeAdminFunction("admin-orders", { action: "mark_cancelled", orderId, reason })
}

export interface ReconcileAdminOrderResponse {
  success: true
  request_id: string
  action: "noop" | "mark_paid" | "mark_failed"
  order: AdminOrderSummary
  grants: unknown[]
  stripe: {
    id?: string
    status?: string | null
    payment_status?: string | null
  }
}

export function reconcileAdminOrder(orderId: string) {
  return invokeAdminFunction<ReconcileAdminOrderResponse>("reconcile-orders", { orderId })
}

export function replyAdminSupportTicket(input: {
  ticketId: string
  message?: string
  status?: AdminSupportTicketSummary["status"]
  priority?: AdminSupportTicketSummary["priority"]
  attachment?: SupportAttachmentUploadResult | null
}) {
  return invokeAdminFunction<{ success: true; message: SupportTicketMessage }>("support-ticket-reply", input)
}

export function createAdminNotification(input: {
  audience: "single" | "role" | "all"
  userId?: string
  role?: AdminUserSummary["role"]
  status?: AdminUserSummary["status"]
  type: AdminNotificationSummary["type"]
  title: string
  message: string
  link?: string | null
  sentViaEmail?: boolean
  sentViaInApp?: boolean
}) {
  return invokeAdminFunction<{ success: true; inserted_count: number }>("admin-notifications", input)
}

export function createAdminAffiliate(input: {
  userId: string
  affiliateCode: string
  commissionType: AdminAffiliateSummary["commission_type"]
  commissionValue: number
  status?: AdminAffiliateSummary["status"]
}) {
  return invokeAdminFunction<{ success: true; affiliate: AdminAffiliateSummary }>("admin-affiliates", {
    action: "create",
    ...input,
  })
}

export function updateAdminAffiliate(input: {
  affiliateId: string
  affiliateCode?: string
  commissionType?: AdminAffiliateSummary["commission_type"]
  commissionValue?: number
  status?: AdminAffiliateSummary["status"]
}) {
  return invokeAdminFunction<{ success: true; affiliate: AdminAffiliateSummary }>("admin-affiliates", {
    action: "update",
    ...input,
  })
}

export function createAdminCoupon(input: {
  code: string
  title?: string | null
  discountType: AdminCouponSummary["discount_type"]
  discountValue: number
  status?: AdminCouponSummary["status"]
  startsAt?: string | null
  expiresAt?: string | null
  maxUses?: number | null
  maxUsesPerUser?: number | null
  minimumOrderCents?: number | null
}) {
  return invokeAdminFunction<{ success: true; coupon: AdminCouponSummary }>("admin-coupons", {
    action: "create",
    ...input,
  })
}

export function updateAdminCoupon(input: {
  couponId: string
  code?: string
  title?: string | null
  discountType?: AdminCouponSummary["discount_type"]
  discountValue?: number
  status?: AdminCouponSummary["status"]
  startsAt?: string | null
  expiresAt?: string | null
  maxUses?: number | null
  maxUsesPerUser?: number | null
  minimumOrderCents?: number | null
}) {
  return invokeAdminFunction<{ success: true; coupon: AdminCouponSummary }>("admin-coupons", {
    action: "update",
    ...input,
  })
}
