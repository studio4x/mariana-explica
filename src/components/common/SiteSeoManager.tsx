import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { usePublishedProductBySlug } from '@/hooks/useProducts'
import {
  DEFAULT_SEO_CONFIG,
  SEO_PAGE_PATHS,
  absoluteSeoUrl,
  buildProductSeo,
  normalizeSeoConfigValue,
  type SeoPageKey,
} from '@/lib/seo'
import { fetchPublicSeoConfig } from '@/services/admin.service'
import { publicSupabase } from '@/integrations/supabase'
import { SITE_SEO_UPDATED_EVENT } from './site-seo'

type SeoScope = 'public' | 'private'

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.dataset.seoManaged = 'true'
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([key, value]) =>
    element?.setAttribute(key, value)
  )
}

function setLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLLinkElement>(selector)
  if (!element) {
    element = document.createElement('link')
    element.dataset.seoManaged = 'true'
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([key, value]) =>
    element?.setAttribute(key, value)
  )
}

function setJsonLd(value: unknown[] | null) {
  const current = document.head.querySelector<HTMLScriptElement>(
    'script[data-seo-json-ld="true"]'
  )
  if (!value?.length) {
    current?.remove()
    return
  }

  const element = current ?? document.createElement('script')
  element.type = 'application/ld+json'
  element.dataset.seoJsonLd = 'true'
  element.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': value,
  }).replace(/</g, '\\u003c')
  if (!current) document.head.appendChild(element)
}

function removeElement(selector: string) {
  document.head.querySelector(selector)?.remove()
}

function pageKeyFromPath(pathname: string): SeoPageKey | null {
  const entry = Object.entries(SEO_PAGE_PATHS).find(
    ([, path]) => path === pathname
  )
  return (entry?.[0] as SeoPageKey | undefined) ?? null
}

export function SiteSeoManager({ scope = 'public' }: { scope?: SeoScope }) {
  const queryClient = useQueryClient()
  const location = useLocation()
  const productSlug =
    scope === 'public' && location.pathname.startsWith('/materiais/')
      ? decodeURIComponent(location.pathname.slice('/materiais/'.length))
      : undefined
  const seoQuery = useQuery({
    queryKey: ['site', 'seo'],
    queryFn: fetchPublicSeoConfig,
    staleTime: 5 * 60_000,
    enabled: scope === 'public',
  })
  const productQuery = usePublishedProductBySlug(productSlug)
  const config = normalizeSeoConfigValue(
    seoQuery.data?.config_value ?? DEFAULT_SEO_CONFIG
  )

  useEffect(() => {
    if (scope !== 'public') return

    const refreshSeo = () => {
      void queryClient.invalidateQueries({ queryKey: ['site', 'seo'] })
      void queryClient.refetchQueries({ queryKey: ['site', 'seo'], type: 'active' })
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'mariana-explica:site-seo-updated') refreshSeo()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(SITE_SEO_UPDATED_EVENT, refreshSeo)

    const channel = publicSupabase
      .channel('public-site-seo-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'site_config',
          filter: 'config_key=eq.site_seo',
        },
        refreshSeo
      )
      .subscribe()

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SITE_SEO_UPDATED_EVENT, refreshSeo)
      void publicSupabase.removeChannel(channel)
    }
  }, [queryClient, scope])

  const resolved = useMemo(() => {
    if (scope === 'private') {
      return {
        title: `Área reservada | ${DEFAULT_SEO_CONFIG.site_name}`,
        description: DEFAULT_SEO_CONFIG.default_description,
        canonical: null,
        image: DEFAULT_SEO_CONFIG.default_og_image_url,
        index: false,
        type: 'website',
        jsonLd: null,
      }
    }

    const pageKey = pageKeyFromPath(location.pathname)
    const isCheckout =
      location.pathname === '/checkout' ||
      location.pathname.startsWith('/checkout/')

    if (productSlug) {
      const product = productQuery.data
      if (product) {
        const productSeo = buildProductSeo(config, product)
        const price = (product.price_cents / 100).toFixed(2)
        return {
          ...productSeo,
          index: true,
          type: 'product',
          jsonLd: [
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Início',
                  item: config.canonical_base_url,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Materiais',
                  item: absoluteSeoUrl(config.canonical_base_url, '/materiais'),
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: product.title,
                  item: productSeo.canonical,
                },
              ],
            },
            {
              '@type': 'Product',
              name: product.title,
              description: productSeo.description,
              image: productSeo.image,
              url: productSeo.canonical,
              brand: { '@type': 'Brand', name: config.site_name },
              offers: {
                '@type': 'Offer',
                url: productSeo.canonical,
                price,
                priceCurrency: product.currency,
                availability: 'https://schema.org/InStock',
              },
            },
            {
              '@type': 'Course',
              name: product.title,
              description: productSeo.description,
              url: productSeo.canonical,
              provider: {
                '@type': 'Organization',
                name: config.organization_name,
                sameAs: config.canonical_base_url,
              },
            },
          ],
        }
      }

      const missing = productQuery.isFetched && !productQuery.isLoading
      return {
        title: missing
          ? `Material não encontrado | ${config.site_name}`
          : config.default_title,
        description: config.default_description,
        canonical: null,
        image: config.default_og_image_url,
        index: !missing,
        type: 'website',
        jsonLd: null,
      }
    }

    if (pageKey) {
      const page = config.pages[pageKey]
      const canonical = absoluteSeoUrl(
        config.canonical_base_url,
        SEO_PAGE_PATHS[pageKey]
      )
      const jsonLd =
        pageKey === 'home'
          ? [
              {
                '@type': 'WebSite',
                name: config.site_name,
                alternateName: config.alternate_site_name,
                url: config.canonical_base_url,
                inLanguage: config.language,
                keywords: [config.primary_keyword, ...config.secondary_keywords].join(', '),
              },
              {
                '@type': 'EducationalOrganization',
                name: config.organization_name,
                url: config.canonical_base_url,
                logo: absoluteSeoUrl(
                  config.canonical_base_url,
                  config.organization_logo_url
                ),
                email: config.contact_email,
                sameAs: config.social_profiles,
              },
            ]
          : [
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Início',
                    item: config.canonical_base_url,
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: page.title,
                    item: canonical,
                  },
                ],
              },
            ]

      return {
        title: page.title,
        description: page.description,
        canonical,
        image: absoluteSeoUrl(
          config.canonical_base_url,
          config.default_og_image_url
        ),
        index: config.robots_index && page.index,
        type: 'website',
        jsonLd,
      }
    }

    return {
      title: isCheckout
        ? `Checkout seguro | ${config.site_name}`
        : config.default_title,
      description: config.default_description,
      canonical: null,
      image: absoluteSeoUrl(
        config.canonical_base_url,
        config.default_og_image_url
      ),
      index: false,
      type: 'website',
      jsonLd: null,
    }
  }, [
    config,
    location.pathname,
    productQuery.data,
    productQuery.isFetched,
    productQuery.isLoading,
    productSlug,
    scope,
  ])

  useEffect(() => {
    const robots = resolved.index
      ? [
          'index',
          config.robots_follow ? 'follow' : 'nofollow',
          `max-snippet:${config.robots_max_snippet}`,
          `max-image-preview:${config.robots_max_image_preview}`,
          `max-video-preview:${config.robots_max_video_preview}`,
        ].join(', ')
      : 'noindex, nofollow, noarchive'

    document.documentElement.lang = config.language
    document.title = resolved.title
    setMeta('meta[name="description"]', {
      name: 'description',
      content: resolved.description,
    })
    setMeta('meta[name="robots"]', { name: 'robots', content: robots })
    setMeta('meta[name="googlebot"]', { name: 'googlebot', content: robots })
    setMeta('meta[name="author"]', {
      name: 'author',
      content: config.author_name,
    })
    setMeta('meta[name="keywords"]', {
      name: 'keywords',
      content: [config.primary_keyword, ...config.secondary_keywords].join(', '),
    })
    setMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: config.site_name,
    })
    setMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: config.locale,
    })
    setMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: resolved.title,
    })
    setMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: resolved.description,
    })
    setMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: resolved.type,
    })
    setMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: resolved.image,
    })
    setMeta('meta[property="og:image:alt"]', {
      property: 'og:image:alt',
      content: `${resolved.title} — ${config.site_name}`,
    })
    setMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    })
    setMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: resolved.title,
    })
    setMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: resolved.description,
    })
    setMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: resolved.image,
    })
    setMeta('meta[name="twitter:image:alt"]', {
      name: 'twitter:image:alt',
      content: `${resolved.title} — ${config.site_name}`,
    })

    if (resolved.canonical) {
      setLink('link[rel="canonical"]', {
        rel: 'canonical',
        href: resolved.canonical,
      })
      setLink('link[rel="alternate"][hreflang="pt-PT"]', {
        rel: 'alternate',
        hreflang: config.language,
        href: resolved.canonical,
      })
      setLink('link[rel="alternate"][hreflang="x-default"]', {
        rel: 'alternate',
        hreflang: 'x-default',
        href: resolved.canonical,
      })
      setMeta('meta[property="og:url"]', {
        property: 'og:url',
        content: resolved.canonical,
      })
    } else {
      removeElement('link[rel="canonical"]')
      document.head
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((item) => item.remove())
      removeElement('meta[property="og:url"]')
    }

    if (config.twitter_site) {
      setMeta('meta[name="twitter:site"]', {
        name: 'twitter:site',
        content: config.twitter_site,
      })
    } else {
      removeElement('meta[name="twitter:site"]')
    }

    if (config.google_site_verification) {
      setMeta('meta[name="google-site-verification"]', {
        name: 'google-site-verification',
        content: config.google_site_verification,
      })
    } else {
      removeElement('meta[name="google-site-verification"]')
    }

    if (config.bing_site_verification) {
      setMeta('meta[name="msvalidate.01"]', {
        name: 'msvalidate.01',
        content: config.bing_site_verification,
      })
    } else {
      removeElement('meta[name="msvalidate.01"]')
    }

    setJsonLd(resolved.jsonLd)
  }, [config, resolved])

  return null
}
