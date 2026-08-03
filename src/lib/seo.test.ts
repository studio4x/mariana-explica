import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEO_CONFIG,
  SEO_PAGE_PATHS,
  buildProductSeo,
  normalizeSeoConfigValue,
} from './seo'
import type { ProductSummary } from '@/types/product.types'

function product(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'sebenta-filosofia',
    title: 'Sebenta de Filosofia',
    short_description:
      'Filosofia explicada de forma clara para preparar o exame nacional.',
    description: null,
    product_type: 'paid',
    status: 'published',
    price_cents: 2490,
    currency: 'EUR',
    cover_image_url: '/icon-512.png',
    access_expiration_mode: 'lifetime',
    access_expires_at: null,
    access_duration_days: null,
    renewal_enabled: false,
    renewal_discount_enabled: false,
    renewal_discount_percent: null,
    launch_date: null,
    is_public: true,
    creator_id: null,
    creator_commission_percent: null,
    workload_minutes: 120,
    has_linear_progression: false,
    quiz_type_settings: {},
    public_page_content: null,
    sales_page_enabled: true,
    requires_auth: true,
    course_chat_enabled: false,
    is_featured: true,
    allow_affiliate: true,
    sort_order: 1,
    category_id: null,
    published_at: '2026-08-03T10:00:00.000Z',
    ...overrides,
  }
}

describe('SEO configuration', () => {
  it('ships unique, indexable metadata for every public sitemap page', () => {
    const pages = Object.values(DEFAULT_SEO_CONFIG.pages)
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length)
    expect(new Set(pages.map((page) => page.description)).size).toBe(
      pages.length
    )
    expect(
      pages.every((page) => page.index && page.description.length > 70)
    ).toBe(true)
    expect(Object.keys(DEFAULT_SEO_CONFIG.pages)).toHaveLength(
      Object.keys(SEO_PAGE_PATHS).length
    )
  })

  it('normalizes unsafe or incomplete persisted values to production defaults', () => {
    const normalized = normalizeSeoConfigValue({
      canonical_base_url: 'javascript:alert(1)',
      site_name: '',
      robots_max_image_preview: 'huge',
      pages: {
        home: { title: 'Título personalizado', description: '', index: false },
      },
    })

    expect(normalized.canonical_base_url).toBe('https://www.mariana-explica.pt')
    expect(normalized.site_name).toBe('Mariana Explica')
    expect(normalized.robots_max_image_preview).toBe('large')
    expect(normalized.pages.home.title).toBe('Título personalizado')
    expect(normalized.pages.home.description).toBe(
      DEFAULT_SEO_CONFIG.pages.home.description
    )
    expect(normalized.pages.home.index).toBe(false)
  })

  it('builds canonical, share image and unique metadata from a published product', () => {
    const result = buildProductSeo(DEFAULT_SEO_CONFIG, product())

    expect(result.title).toBe(
      'Sebenta de Filosofia | Material de estudo | Mariana Explica'
    )
    expect(result.canonical).toBe(
      'https://www.mariana-explica.pt/materiais/sebenta-filosofia'
    )
    expect(result.image).toBe('https://www.mariana-explica.pt/icon-512.png')
    expect(result.description).toContain('preparar o exame nacional')
  })

  it('replaces incomplete product copy with the configured SEO template', () => {
    const result = buildProductSeo(
      DEFAULT_SEO_CONFIG,
      product({
        title: 'Curso Completo de Filosofia',
        short_description: '<p>testeee</p>',
        description: null,
      })
    )

    expect(result.description).toBe(
      DEFAULT_SEO_CONFIG.course_description_template.replace(
        '%s',
        'Curso Completo de Filosofia'
      )
    )
  })
})
