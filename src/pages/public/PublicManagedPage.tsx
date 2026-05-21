import { useMemo } from "react"
import type { ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { ErrorState, LoadingState } from "@/components/feedback"
import { readSitePagePreviewFromSearch } from "@/lib/site-page-preview"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import type { SitePageSlug } from "@/types/app.types"

function normalizeHtml(layoutJson?: Record<string, unknown>) {
  if (!layoutJson || typeof layoutJson !== "object") return ""
  const directHtml = layoutJson.html
  if (typeof directHtml === "string" && directHtml.trim().length > 0) return directHtml
  return ""
}

function normalizeCss(styleJson?: Record<string, unknown>) {
  if (!styleJson || typeof styleJson !== "object") return ""
  const css = styleJson.css
  if (typeof css === "string" && css.trim().length > 0) return css
  return ""
}

interface PublicManagedPageProps {
  slug: SitePageSlug
  fallback: ReactNode
}

export function PublicManagedPage({ slug, fallback }: PublicManagedPageProps) {
  const location = useLocation()
  const pageQuery = usePublicSitePage(slug)

  const previewPayload = useMemo(() => {
    return readSitePagePreviewFromSearch(slug, location.search)
  }, [location.search, slug])

  const managedPayload = useMemo(() => {
    if (previewPayload) {
      return {
        html: previewPayload.html,
        css: previewPayload.css,
      }
    }

    if (!pageQuery.data?.version) return null
    return {
      html: normalizeHtml(pageQuery.data.version.layout_json),
      css: normalizeCss(pageQuery.data.version.style_json),
    }
  }, [pageQuery.data, previewPayload])

  if (pageQuery.isLoading && !previewPayload) {
    return <LoadingState message="A carregar conteudo da pagina..." />
  }

  if (pageQuery.isError && !previewPayload) {
    return (
      <ErrorState
        title="Nao foi possivel carregar esta pagina"
        message={pageQuery.error instanceof Error ? pageQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void pageQuery.refetch()}
      />
    )
  }

  if (!managedPayload?.html) {
    return <>{fallback}</>
  }

  return (
    <div className="w-full bg-white">
      {managedPayload.css ? <style>{managedPayload.css}</style> : null}
      <div dangerouslySetInnerHTML={{ __html: managedPayload.html }} />
    </div>
  )
}
