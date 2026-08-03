import type { ProductSummary } from '@/types/product.types'

export const SEO_CONFIG_KEY = 'site_seo'
export const DEFAULT_SITE_URL = 'https://www.mariana-explica.pt'

export type SeoPageKey =
  | 'home'
  | 'materials'
  | 'support'
  | 'explanations'
  | 'about'
  | 'privacy'
  | 'cookies'
  | 'terms'

export interface SeoPageConfig {
  title: string
  description: string
  index: boolean
}

export interface SeoConfigValue {
  site_name: string
  alternate_site_name: string
  canonical_base_url: string
  default_title: string
  title_template: string
  default_description: string
  default_og_image_url: string
  language: string
  locale: string
  author_name: string
  organization_name: string
  organization_logo_url: string
  contact_email: string
  social_profiles: string[]
  twitter_site: string
  google_site_verification: string
  bing_site_verification: string
  robots_index: boolean
  robots_follow: boolean
  robots_max_snippet: number
  robots_max_image_preview: 'none' | 'standard' | 'large'
  robots_max_video_preview: number
  course_title_template: string
  course_description_template: string
  pages: Record<SeoPageKey, SeoPageConfig>
}

export interface SeoConfig {
  config_key: string
  config_value: SeoConfigValue
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export const SEO_PAGE_LABELS: Record<SeoPageKey, string> = {
  home: 'Página inicial',
  materials: 'Materiais',
  support: 'Suporte',
  explanations: 'Explicações',
  about: 'Sobre',
  privacy: 'Privacidade',
  cookies: 'Cookies',
  terms: 'Termos de uso',
}

export const SEO_PAGE_PATHS: Record<SeoPageKey, string> = {
  home: '/',
  materials: '/materiais',
  support: '/suporte',
  explanations: '/explicacoes',
  about: '/sobre',
  privacy: '/privacidade',
  cookies: '/cookies',
  terms: '/termos-de-uso',
}

export const DEFAULT_SEO_CONFIG: SeoConfigValue = {
  site_name: 'Mariana Explica',
  alternate_site_name: 'Mariana.explica',
  canonical_base_url: DEFAULT_SITE_URL,
  default_title: 'Mariana Explica | Português e Filosofia sem complicações',
  title_template: '%s | Mariana Explica',
  default_description:
    'Explicações e materiais de estudo de Português e Filosofia, com conteúdos claros para aprender, organizar a matéria e preparar os exames.',
  default_og_image_url: `${DEFAULT_SITE_URL}/icon-512.png`,
  language: 'pt-PT',
  locale: 'pt_PT',
  author_name: 'Mariana Teixeira',
  organization_name: 'Mariana Explica',
  organization_logo_url: `${DEFAULT_SITE_URL}/icon-512.png`,
  contact_email: 'marianaexplica.online@gmail.com',
  social_profiles: ['https://www.instagram.com/mariana.explica/'],
  twitter_site: '',
  google_site_verification: '',
  bing_site_verification: '',
  robots_index: true,
  robots_follow: true,
  robots_max_snippet: -1,
  robots_max_image_preview: 'large',
  robots_max_video_preview: -1,
  course_title_template: '%s | Material de estudo | Mariana Explica',
  course_description_template:
    '%s. Consulta o programa, os conteúdos e as condições de acesso deste material na Mariana Explica.',
  pages: {
    home: {
      title:
        'Explicações e materiais de Português e Filosofia | Mariana Explica',
      description:
        'Aprende Português e Filosofia com explicações claras, materiais de estudo organizados e preparação focada para testes e exames.',
      index: true,
    },
    materials: {
      title: 'Materiais de Português e Filosofia | Mariana Explica',
      description:
        'Explora materiais e cursos de Português e Filosofia para rever a matéria, consolidar conhecimentos e preparar testes e exames.',
      index: true,
    },
    support: {
      title: 'Suporte e perguntas frequentes | Mariana Explica',
      description:
        'Encontra respostas sobre materiais, pagamentos, acesso à plataforma e fala com o suporte da Mariana Explica.',
      index: true,
    },
    explanations: {
      title: 'Explicações de Português e Filosofia | Mariana Explica',
      description:
        'Pede informações sobre explicações de Português e Filosofia e encontra um plano de estudo adequado aos teus objetivos.',
      index: true,
    },
    about: {
      title: 'Sobre a Mariana Explica',
      description:
        'Conhece a Mariana Teixeira e o projeto Mariana Explica, criado para tornar o estudo de Português e Filosofia mais claro e organizado.',
      index: true,
    },
    privacy: {
      title: 'Política de Privacidade | Mariana Explica',
      description:
        'Consulta como a Mariana Explica recolhe, utiliza e protege os dados pessoais dos utilizadores da plataforma.',
      index: true,
    },
    cookies: {
      title: 'Política de Cookies | Mariana Explica',
      description:
        'Consulta os cookies utilizados pela Mariana Explica e gere as tuas preferências de privacidade e rastreamento.',
      index: true,
    },
    terms: {
      title: 'Termos de Uso | Mariana Explica',
      description:
        'Consulta as condições de utilização da plataforma, compra e acesso aos conteúdos digitais da Mariana Explica.',
      index: true,
    },
  },
}

function text(value: unknown, fallback: string) {
  return String(value ?? '').trim() || fallback
}

function integer(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function stringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function normalizeBaseUrl(value: unknown) {
  const candidate = text(value, DEFAULT_SITE_URL).replace(/\/+$/, '')
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost'
      ? parsed.toString().replace(/\/+$/, '')
      : DEFAULT_SITE_URL
  } catch {
    return DEFAULT_SITE_URL
  }
}

export function normalizeSeoConfigValue(value: unknown): SeoConfigValue {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const rawPages =
    record.pages &&
    typeof record.pages === 'object' &&
    !Array.isArray(record.pages)
      ? (record.pages as Partial<Record<SeoPageKey, unknown>>)
      : {}

  const pages = Object.fromEntries(
    (Object.keys(DEFAULT_SEO_CONFIG.pages) as SeoPageKey[]).map((key) => {
      const rawPage =
        rawPages[key] && typeof rawPages[key] === 'object'
          ? (rawPages[key] as Record<string, unknown>)
          : {}
      const fallback = DEFAULT_SEO_CONFIG.pages[key]
      return [
        key,
        {
          title: text(rawPage.title, fallback.title),
          description: text(rawPage.description, fallback.description),
          index:
            typeof rawPage.index === 'boolean' ? rawPage.index : fallback.index,
        },
      ]
    })
  ) as Record<SeoPageKey, SeoPageConfig>

  const preview = String(record.robots_max_image_preview ?? '')
  const robotsMaxImagePreview =
    preview === 'none' || preview === 'standard' || preview === 'large'
      ? preview
      : DEFAULT_SEO_CONFIG.robots_max_image_preview

  return {
    site_name: text(record.site_name, DEFAULT_SEO_CONFIG.site_name),
    alternate_site_name: text(
      record.alternate_site_name,
      DEFAULT_SEO_CONFIG.alternate_site_name
    ),
    canonical_base_url: normalizeBaseUrl(record.canonical_base_url),
    default_title: text(record.default_title, DEFAULT_SEO_CONFIG.default_title),
    title_template: text(
      record.title_template,
      DEFAULT_SEO_CONFIG.title_template
    ),
    default_description: text(
      record.default_description,
      DEFAULT_SEO_CONFIG.default_description
    ),
    default_og_image_url: text(
      record.default_og_image_url,
      DEFAULT_SEO_CONFIG.default_og_image_url
    ),
    language: text(record.language, DEFAULT_SEO_CONFIG.language),
    locale: text(record.locale, DEFAULT_SEO_CONFIG.locale),
    author_name: text(record.author_name, DEFAULT_SEO_CONFIG.author_name),
    organization_name: text(
      record.organization_name,
      DEFAULT_SEO_CONFIG.organization_name
    ),
    organization_logo_url: text(
      record.organization_logo_url,
      DEFAULT_SEO_CONFIG.organization_logo_url
    ),
    contact_email: text(record.contact_email, DEFAULT_SEO_CONFIG.contact_email),
    social_profiles: stringArray(
      record.social_profiles,
      DEFAULT_SEO_CONFIG.social_profiles
    ),
    twitter_site: String(record.twitter_site ?? '').trim(),
    google_site_verification: String(
      record.google_site_verification ?? ''
    ).trim(),
    bing_site_verification: String(record.bing_site_verification ?? '').trim(),
    robots_index:
      typeof record.robots_index === 'boolean' ? record.robots_index : true,
    robots_follow:
      typeof record.robots_follow === 'boolean' ? record.robots_follow : true,
    robots_max_snippet: integer(record.robots_max_snippet, -1),
    robots_max_image_preview: robotsMaxImagePreview,
    robots_max_video_preview: integer(record.robots_max_video_preview, -1),
    course_title_template: text(
      record.course_title_template,
      DEFAULT_SEO_CONFIG.course_title_template
    ),
    course_description_template: text(
      record.course_description_template,
      DEFAULT_SEO_CONFIG.course_description_template
    ),
    pages,
  }
}

export function normalizeSeoConfig(row?: Partial<SeoConfig> | null): SeoConfig {
  return {
    config_key: row?.config_key ?? SEO_CONFIG_KEY,
    config_value: normalizeSeoConfigValue(row?.config_value),
    description:
      row?.description ??
      'Configuração pública de metadados, indexação, canonical, redes sociais e identidade para mecanismos de pesquisa.',
    is_public: row?.is_public ?? true,
    updated_at: row?.updated_at ?? null,
  }
}

export function absoluteSeoUrl(baseUrl: string, value: string) {
  try {
    return new URL(value || '/', `${baseUrl.replace(/\/+$/, '')}/`).toString()
  } catch {
    return `${DEFAULT_SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
  }
}

export function plainText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncateSeoDescription(value: string, maxLength = 180) {
  const normalized = plainText(value)
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`
}

export function applySeoTemplate(template: string, value: string) {
  return template.includes('%s')
    ? template.replace('%s', value)
    : `${value} | Mariana Explica`
}

export function buildProductSeo(
  config: SeoConfigValue,
  product: ProductSummary
) {
  const title = applySeoTemplate(config.course_title_template, product.title)
  const description = truncateSeoDescription(
    product.short_description ||
      product.description ||
      config.course_description_template.replace('%s', product.title)
  )
  const canonical = absoluteSeoUrl(
    config.canonical_base_url,
    `/materiais/${encodeURIComponent(product.slug)}`
  )
  const image = absoluteSeoUrl(
    config.canonical_base_url,
    product.cover_image_url || config.default_og_image_url
  )

  return { title, description, canonical, image }
}
