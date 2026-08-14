type NodeRequest = {
  method?: string
  url?: string
}

type NodeResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

declare const process: { env: Record<string, string | undefined> }

const FALLBACK_ORIGIN = 'https://www.mariana-explica.pt'
const SUPABASE_URL = 'https://gookhgufsxeplelpdaua.supabase.co'
const SOCIAL_IMAGE_WIDTH = 1200
const SOCIAL_IMAGE_HEIGHT = 627
const MAINTENANCE_RETRY_AFTER_SECONDS = 3600

const MAINTENANCE_BYPASS_PATHS = [
  '/admin',
  '/login',
  '/auth',
  '/recuperar-senha',
  '/redefinir-senha',
]

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

function absoluteUrl(baseUrl: string, value: unknown, fallback: string) {
  const candidate = String(value ?? '').trim() || fallback
  try {
    return new URL(candidate, `${baseUrl.replace(/\/+$/, '')}/`).toString()
  } catch {
    return fallback
  }
}

function canonicalAssetUrl(baseUrl: string, value: unknown, fallback: string) {
  const absolute = absoluteUrl(baseUrl, value, fallback)
  try {
    const base = new URL(baseUrl)
    const asset = new URL(absolute)
    const sameSite = asset.hostname.replace(/^www\./i, '') === base.hostname.replace(/^www\./i, '')
    if (sameSite) {
      asset.protocol = base.protocol
      asset.host = base.host
    }
    return asset.toString()
  } catch {
    return fallback
  }
}

function imageMimeType(value: string) {
  const pathname = new URL(value).pathname.toLowerCase()
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.webp')) return 'image/webp'
  if (pathname.endsWith('.svg') || pathname.endsWith('.svgz')) return 'image/svg+xml'
  return 'image/jpeg'
}

function bypassesMaintenance(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return MAINTENANCE_BYPASS_PATHS.some(
    (path) => normalized === path || normalized.startsWith(`${path}/`)
  )
}

function maintenanceHtml(message: unknown) {
  const maintenanceMessage =
    String(message ?? '').trim() ||
    'Estamos em manutenção para melhorar a tua experiência. Voltamos em breve.'

  return `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#123f59" />
    <title>Manutenção temporária | Mariana Explica</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #eef7fb; color: #15323b; font-family: Inter, system-ui, sans-serif; }
      main { width: min(720px, 100%); border: 1px solid #d7e6ee; border-radius: 28px; background: #fff; padding: clamp(28px, 6vw, 52px); box-shadow: 0 24px 70px rgba(18, 63, 89, .12); }
      .label { color: #24506a; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: 18px 0 0; font-family: Georgia, serif; font-size: clamp(30px, 6vw, 46px); line-height: 1.16; }
      p { margin: 20px 0 0; color: #456173; font-size: 17px; line-height: 1.7; }
      a { display: inline-flex; margin-top: 28px; border-radius: 999px; background: #123f59; padding: 12px 22px; color: #fff; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <div class="label">Mariana Explica · manutenção temporária</div>
      <h1>Estamos a preparar melhorias na plataforma</h1>
      <p>${escapeHtml(maintenanceMessage)}</p>
      <p>O acesso público regressará automaticamente assim que os trabalhos terminarem.</p>
      <a href="/login">Acesso administrativo</a>
    </main>
  </body>
</html>`
}

async function readPublicConfig() {
  // These configurations are explicitly public. Use the frontend's public key so
  // this endpoint does not require a server secret to render crawler metadata.
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) return null

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/site_config?config_key=in.(site_seo,site_maintenance_mode)&select=config_key,config_value,updated_at`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  )
  if (!response.ok) return null

  const rows = (await response.json()) as Array<{
    config_key?: string
    config_value?: Record<string, unknown>
    updated_at?: string | null
  }>
  return {
    seo: rows.find((row) => row.config_key === 'site_seo') ?? null,
    maintenance: rows.find((row) => row.config_key === 'site_maintenance_mode') ?? null,
  }
}

function shellOrigin() {
  // The deployment URL is protected on this project. Fetching it from the
  // serverless function redirects to Vercel's login page, so use the public
  // canonical domain for the static SPA shell instead.
  return FALLBACK_ORIGIN
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  const requestUrl = new URL(req.url ?? '/', FALLBACK_ORIGIN)

  try {
    const publicConfig = await readPublicConfig()
    const maintenance = publicConfig?.maintenance?.config_value
    if (maintenance?.enabled === true && !bypassesMaintenance(requestUrl.pathname)) {
      const html = maintenanceHtml(maintenance.message)
      res.statusCode = 503
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      res.setHeader('Retry-After', String(MAINTENANCE_RETRY_AFTER_SECONDS))
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.end(req.method === 'HEAD' ? undefined : html)
      return
    }

    const shell = await fetch(`${shellOrigin()}/index.html`)
    if (!shell.ok) throw new Error(`shell ${shell.status}`)

    let html = await shell.text()
    const configRow = publicConfig?.seo ?? null
    const config = configRow?.config_value ?? null
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
    const configuredImage = canonicalAssetUrl(
      baseUrl,
      config?.default_og_image_url,
      `${FALLBACK_ORIGIN}/social-preview-1200x630.jpg`
    )
    const imageVersion = encodeURIComponent(
      configRow?.updated_at?.trim() || 'default'
    )
    // Keep a stable, crawler-facing path outside /api. The configured source
    // stays editable in the admin, while updated_at changes this versioned URL
    // whenever that configuration is saved.
    const image = `${baseUrl}/social-share-image.jpg?v=${imageVersion}`
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
      'property="og:image:secure_url"',
      `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:image:type"',
      `<meta property="og:image:type" content="${imageMimeType(configuredImage)}" />`
    )
    html = replaceMeta(
      html,
      'property="og:image:width"',
      `<meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />`
    )
    html = replaceMeta(
      html,
      'property="og:image:height"',
      `<meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />`
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
