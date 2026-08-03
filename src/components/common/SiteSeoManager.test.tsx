import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteSeoManager } from './SiteSeoManager'

vi.mock('@/services/admin.service', () => ({
  fetchPublicSeoConfig: vi.fn().mockResolvedValue({ config_value: {} }),
}))

vi.mock('@/hooks/useProducts', () => ({
  usePublishedProductBySlug: () => ({
    data: null,
    isFetched: true,
    isLoading: false,
  }),
}))

function renderManager(path: string, scope: 'public' | 'private' = 'public') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SiteSeoManager scope={scope} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SiteSeoManager', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  it('applies unique metadata, canonical and structured data to a public page', async () => {
    renderManager('/sobre')

    await waitFor(() => {
      expect(document.title).toBe('Sobre a Mariana Explica')
    })

    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      expect.stringContaining('index')
    )
    expect(
      document.head.querySelector('link[rel="canonical"]')
    ).toHaveAttribute('href', 'https://www.mariana-explica.pt/sobre')
    expect(
      document.head.querySelector('script[type="application/ld+json"]')
        ?.textContent
    ).toContain('BreadcrumbList')
  })

  it('prevents private areas from being indexed and removes canonical', async () => {
    renderManager('/admin/configuracoes', 'private')

    await waitFor(() => {
      expect(
        document.head.querySelector('meta[name="robots"]')
      ).toHaveAttribute('content', 'noindex, nofollow, noarchive')
    })

    expect(
      document.head.querySelector('link[rel="canonical"]')
    ).not.toBeInTheDocument()
    expect(
      document.head.querySelector('script[type="application/ld+json"]')
    ).not.toBeInTheDocument()
  })
})
