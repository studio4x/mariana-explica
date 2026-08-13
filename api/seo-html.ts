type NodeRequest = {
  url?: string
}

type NodeResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

declare const process: { env: Record<string, string | undefined> }

const FALLBACK_ORIGIN = 'https://www.mariana-explica.pt'

const PAGE_KEYS: Record<string, string> = {
  '/': 'home',
  '/materiais': 'materials',
  '/suporte': 'support',
  '/explicacoes': 'explanations',
  '/sobre': 'about',
  '/privacidade': 'privacy',
  '/cookies': 'cookies',
  '/termos-de-uso': 'terms',
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pageKey(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return PAGE_KEYS[normalized] ?? 'home'
}

function replaceMeta(html: string, selector: string, tag: string) {
  const pattern = new RegExp(`<meta ${selector}[^>]*>`, 'i')
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

function removeMeta(html: string, selector: string) {
  return html.replace(new RegExp(`\\s*<meta ${selector}[^>]*>`, 'gi'), '')
}

function absoluteUrl(baseUrl: string, value: unknown, fallback: string) {
  const candidate = String(value ?? '').trim() || fallback
  try {
    return new URL(candidate, `${baseUrl.replace(/\/+$/, '')}/`).toString()
  } catch {
    return fallback
  }
}

async function readSeoConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const response = await fetch(
    `${supabaseUrl}/rest/v1/site_config?config_key=eq.site_seo&select=config_value&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )
  if (!response.ok) return null

  const rows = (await response.json()) as Array<{
    config_value?: Record<string, unknown>
  }>
  return rows[0]?.config_value ?? null
}

function shellOrigin() {
  const deploymentHost = process.env.VERCEL_URL?.trim()
  return deploymentHost ? `https://${deploymentHost}` : FALLBACK_ORIGIN
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  const requestUrl = new URL(req.url ?? '/', FALLBACK_ORIGIN)

  try {
    const shell = await fetch(`${shellOrigin()}/index.html`)
    if (!shell.ok) throw new Error(`shell ${shell.status}`)

    let html = await shell.text()
    const config = await readSeoConfig()
    const page = (config?.pages?.[pageKey(requestUrl.pathname)] ?? {}) as Record<
      string,
      unknown
    >
    const siteName = String(config?.site_name ?? 'Mariana Explica')
    const title = String(page.title ?? config?.default_title ?? siteName)
    const description = String(page.description ?? config?.default_description ?? '')
    const baseUrl = String(config?.canonical_base_url ?? FALLBACK_ORIGIN).replace(
      /\/+$/,
      ''
    )
    const canonical = `${baseUrl}${requestUrl.pathname === '/' ? '/' : requestUrl.pathname}`
    const image = absoluteUrl(
      baseUrl,
      config?.default_og_image_url,
      `${FALLBACK_ORIGIN}/social-preview-1200x630.jpg`
    )
    const locale = String(config?.locale ?? 'pt_PT')
    const imageAlt = `${title} — ${siteName}`

    html = replaceMeta(
      html,
      'name="description"',
      `<meta name="description" content="${escapeHtml(description)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:site_name"',
      `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:locale"',
      `<meta property="og:locale" content="${escapeHtml(locale)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:title"',
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:description"',
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    )
    html = replaceMeta(html, 'property="og:type"', '<meta property="og:type" content="website" />')
    html = replaceMeta(
      html,
      'property="og:url"',
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:image"',
      `<meta property="og:image" content="${escapeHtml(image)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:image:alt"',
      `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
    )
    html = replaceMeta(
      html,
      'name="twitter:title"',
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`
    )
    html = replaceMeta(
      html,
      'name="twitter:description"',
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`
    )
    html = replaceMeta(
      html,
      'name="twitter:image"',
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`
    )
    html = removeMeta(html, 'property="og:image:secure_url"')
    html = removeMeta(html, 'property="og:image:type"')
    html = removeMeta(html, 'property="og:image:width"')
    html = removeMeta(html, 'property="og:image:height"')
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(html)
  } catch {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end('Não foi possível preparar os metadados públicos.')
  }
}
