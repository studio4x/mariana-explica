type NodeRequest = {
  method?: string
}

type NodeResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string | Uint8Array): void
}

declare const process: { env: Record<string, string | undefined> }

const SITE_ORIGIN = 'https://www.mariana-explica.pt'
const SUPABASE_URL = 'https://gookhgufsxeplelpdaua.supabase.co'
const FALLBACK_IMAGE = `${SITE_ORIGIN}/social-preview-1200x630.jpg`

async function readConfiguredImageUrl() {
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) return FALLBACK_IMAGE

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/site_config?config_key=eq.site_seo&select=config_value&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  )
  if (!response.ok) return FALLBACK_IMAGE

  const rows = (await response.json()) as Array<{
    config_value?: { default_og_image_url?: unknown }
  }>
  const candidate = String(rows[0]?.config_value?.default_og_image_url ?? '').trim()
  if (!candidate) return FALLBACK_IMAGE

  try {
    const image = new URL(candidate, `${SITE_ORIGIN}/`)
    if (image.hostname.replace(/^www\./i, '') === 'mariana-explica.pt') {
      image.protocol = 'https:'
      image.host = 'www.mariana-explica.pt'
    }
    return image.toString()
  } catch {
    return FALLBACK_IMAGE
  }
}

function isImage(bytes: Uint8Array, contentType: string) {
  if (!contentType.toLowerCase().startsWith('image/')) return false
  if (bytes.length < 12) return false

  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'

  return jpeg || png || webp || contentType.toLowerCase().includes('svg')
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, HEAD')
    res.end('Método não permitido')
    return
  }

  try {
    const imageUrl = await readConfiguredImageUrl()
    const upstream = await fetch(imageUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        'User-Agent': 'MarianaExplicaSocialImage/1.0',
      },
    })
    if (!upstream.ok) throw new Error(`imagem ${upstream.status}`)

    const bytes = new Uint8Array(await upstream.arrayBuffer())
    const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!isImage(bytes, contentType)) throw new Error('conteúdo não reconhecido como imagem')

    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(bytes.length))
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(req.method === 'HEAD' ? undefined : bytes)
  } catch {
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end('Não foi possível preparar a imagem social.')
  }
}
