import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { AboutFallback } from "./About"
import { CookiePolicyFallback } from "./CookiePolicy"
import { HomeEditorBaseline } from "./Home"
import { PrivacyPolicyFallback } from "./PrivacyPolicy"
import { TermsOfUseFallback } from "./TermsOfUse"
import type { SitePageSlug } from "@/types/app.types"

const cache = new Map<string, string>()

function renderWithRouter(node: ReactNode) {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
}

export function getEditorBaselineHtml(slug: SitePageSlug | string) {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase()
  const cached = cache.get(normalizedSlug)
  if (cached) return cached

  let html = ""
  switch (normalizedSlug) {
    case "home":
      html = renderWithRouter(<HomeEditorBaseline />)
      break
    case "sobre":
      html = renderWithRouter(<AboutFallback />)
      break
    case "privacidade":
      html = renderWithRouter(<PrivacyPolicyFallback />)
      break
    case "cookies":
      html = renderWithRouter(<CookiePolicyFallback />)
      break
    case "termos":
      html = renderWithRouter(<TermsOfUseFallback />)
      break
    default:
      html = '<section class="me-section"><div class="me-container"><h2>Pagina sem baseline</h2></div></section>'
      break
  }

  cache.set(normalizedSlug, html)
  return html
}
