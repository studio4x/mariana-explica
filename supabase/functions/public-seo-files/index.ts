import {
  corsHeaders,
  corsResponse,
  createServiceClient,
} from '../_shared/mod.ts'

const DEFAULT_BASE_URL = 'https://www.mariana-explica.pt'
const STATIC_PAGES: Array<{ key: string; path: string }> = [
  { key: 'home', path: '/' },
  { key: 'materials', path: '/materiais' },
  { key: 'support', path: '/suporte' },
  { key: 'explanations', path: '/explicacoes' },
  { key: 'about', path: '/sobre' },
  { key: 'privacy', path: '/privacidade' },
  { key: 'cookies', path: '/cookies' },
  { key: 'terms', path: '/termos-de-uso' },
]

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function baseUrlFromConfig(config: Record<string, unknown>) {
  const candidate = String(config.canonical_base_url ?? DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, '')
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' ? candidate : DEFAULT_BASE_URL
  } catch {
    return DEFAULT_BASE_URL
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeMarkdown(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function response(body: string, contentType: string) {
  const headers = new Headers(corsHeaders)
  headers.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600')
  headers.set('Content-Type', `${contentType}; charset=utf-8`)
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(body, {
    status: 200,
    headers,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const url = new URL(req.url)
    const file = String(url.searchParams.get('file') ?? 'sitemap')
      .trim()
      .toLowerCase()
    const client = createServiceClient()
    const [
      { data: seoRow, error: seoError },
      { data: products, error: productsError },
    ] = await Promise.all([
      client
        .from('site_config')
        .select('config_value,updated_at')
        .eq('config_key', 'site_seo')
        .eq('is_public', true)
        .maybeSingle(),
      client
        .from('products')
        .select('slug,title,short_description,updated_at')
        .eq('status', 'published')
        .eq('sales_page_enabled', true)
        .order('sort_order', { ascending: true }),
    ])

    if (seoError) throw seoError
    if (productsError) throw productsError

    const config = record(seoRow?.config_value)
    const pages = record(config.pages)
    const baseUrl = baseUrlFromConfig(config)
    const siteName =
      String(config.site_name ?? 'Mariana Explica').trim() || 'Mariana Explica'
    const defaultDescription =
      String(config.default_description ?? '').trim() ||
      'Explicações e materiais de Português e Filosofia.'

    if (file === 'robots') {
      return response(
        [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          '',
          `Sitemap: ${baseUrl}/sitemap.xml`,
          '',
        ].join('\n'),
        'text/plain'
      )
    }

    if (file === 'llms') {
      const materialLines = (products ?? []).map((product) => {
        const description = escapeMarkdown(product.short_description)
        return `- [${escapeMarkdown(product.title)}](${baseUrl}/materiais/${encodeURIComponent(product.slug)})${description ? `: ${description}` : ''}`
      })
      const body = [
        `# ${siteName}`,
        '',
        `> ${defaultDescription}`,
        '',
        'A Mariana Explica disponibiliza explicações, materiais digitais e cursos de Português e Filosofia em português europeu.',
        '',
        '## Páginas principais',
        '',
        `- [Página inicial](${baseUrl}/)`,
        `- [Materiais](${baseUrl}/materiais)`,
        `- [Explicações](${baseUrl}/explicacoes)`,
        `- [Sobre](${baseUrl}/sobre)`,
        `- [Suporte](${baseUrl}/suporte)`,
        '',
        '## Materiais publicados',
        '',
        ...(materialLines.length
          ? materialLines
          : [
              '- Consulta o catálogo público para ver os materiais disponíveis.',
            ]),
        '',
        '## Políticas',
        '',
        `- [Privacidade](${baseUrl}/privacidade)`,
        `- [Cookies](${baseUrl}/cookies)`,
        `- [Termos de uso](${baseUrl}/termos-de-uso)`,
        '',
        'O conteúdo das áreas de aluno e administração é privado e não deve ser indexado.',
        '',
      ].join('\n')
      return response(body, 'text/plain')
    }

    if (file !== 'sitemap') {
      return new Response('Not found', { status: 404 })
    }

    const staticLastmod = seoRow?.updated_at
      ? new Date(seoRow.updated_at).toISOString()
      : null
    const urls = STATIC_PAGES.filter(({ key }) => {
      const page = record(pages[key])
      return page.index !== false
    }).map(({ path }) => ({
      loc: `${baseUrl}${path === '/' ? '/' : path}`,
      lastmod: staticLastmod,
    }))

    for (const product of products ?? []) {
      urls.push({
        loc: `${baseUrl}/materiais/${encodeURIComponent(product.slug)}`,
        lastmod: product.updated_at
          ? new Date(product.updated_at).toISOString()
          : null,
      })
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(({ loc, lastmod }) =>
        [
          '  <url>',
          `    <loc>${escapeXml(loc)}</loc>`,
          ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
          '  </url>',
        ].join('\n')
      ),
      '</urlset>',
      '',
    ].join('\n')

    return response(xml, 'application/xml')
  } catch (error) {
    console.error('[public-seo-files]', error)
    return new Response('Não foi possível gerar o arquivo SEO.', {
      status: 500,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
})
