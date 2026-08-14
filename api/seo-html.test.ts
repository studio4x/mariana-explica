import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './seo-html'

function responseRecorder() {
  const headers = new Map<string, string>()
  let body: string | undefined
  const response = {
    statusCode: 0,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value)
    },
    end(value?: string) {
      body = value
    },
  }

  return { response, headers, body: () => body }
}

function publicConfigResponse(maintenanceEnabled: boolean) {
  return {
    ok: true,
    json: async () => [
      {
        config_key: 'site_seo',
        config_value: {
          site_name: 'Mariana Explica',
          canonical_base_url: 'https://www.mariana-explica.pt',
          pages: { home: { title: 'Home', description: 'Descrição pública.' } },
        },
        updated_at: '2026-08-14T12:00:00.000Z',
      },
      {
        config_key: 'site_maintenance_mode',
        config_value: {
          enabled: maintenanceEnabled,
          message: 'Voltamos em breve.',
        },
      },
    ],
  }
}

describe('seo-html maintenance response', () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.VITE_SUPABASE_ANON_KEY
  })

  it('returns a static 503 with Retry-After for public pages during maintenance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(publicConfigResponse(true))
    vi.stubGlobal('fetch', fetchMock)
    const recorder = responseRecorder()

    await handler({ method: 'GET', url: '/' }, recorder.response)

    expect(recorder.response.statusCode).toBe(503)
    expect(recorder.headers.get('retry-after')).toBe('3600')
    expect(recorder.headers.get('cache-control')).toBe('no-store, max-age=0')
    expect(recorder.body()).toContain('Estamos a preparar melhorias na plataforma')
    expect(recorder.body()).toContain('Voltamos em breve.')
    expect(recorder.body()).not.toContain('<script')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the admin route available while maintenance is enabled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(publicConfigResponse(true))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>',
      })
    vi.stubGlobal('fetch', fetchMock)
    const recorder = responseRecorder()

    await handler({ method: 'GET', url: '/admin' }, recorder.response)

    expect(recorder.response.statusCode).toBe(200)
    expect(recorder.headers.has('retry-after')).toBe(false)
    expect(recorder.body()).toContain('<div id="root"></div>')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('serves the regular public shell when maintenance is disabled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(publicConfigResponse(false))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>',
      })
    vi.stubGlobal('fetch', fetchMock)
    const recorder = responseRecorder()

    await handler({ method: 'GET', url: '/' }, recorder.response)

    expect(recorder.response.statusCode).toBe(200)
    expect(recorder.headers.has('retry-after')).toBe(false)
    expect(recorder.body()).toContain('<title>Home</title>')
  })
})
