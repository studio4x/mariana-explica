import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { LoadingState } from "@/components/feedback"
import { HomeReviewsFeed } from "@/components/reviews"
import {
  getDefaultStyleCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { readSitePagePreviewFromSearch } from "@/lib/site-page-preview"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import type { PublicSitePagePayload, SitePageSlug } from "@/types/app.types"

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

function rebuildManagedPayloadFromVersion(slug: SitePageSlug, version: PublicSitePagePayload["version"] | null | undefined) {
  if (!version?.layout_json || typeof version.layout_json !== "object") return null

  const layoutJson = version.layout_json as Record<string, unknown>
  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : null

  if (projectData && Array.isArray(projectData.blocks) && projectData.blocks.length > 0) {
    const document = resolveBuilderDocumentFromLayoutJson(slug, version.layout_json)

    return {
      html: renderDocumentToHtml(document),
      css: getDefaultStyleCss(),
    }
  }

  const html = normalizeHtml(version.layout_json)
  if (!html) return null

  return {
    html,
    css: normalizeCss(version.style_json),
  }
}

interface PublicManagedPageProps {
  slug: SitePageSlug
  fallback: ReactNode
}

export function PublicManagedPage({ slug, fallback }: PublicManagedPageProps) {
  const location = useLocation()
  const pageQuery = usePublicSitePage(slug)
  const managedRootRef = useRef<HTMLDivElement | null>(null)
  const [homeReviewsMountNode, setHomeReviewsMountNode] = useState<HTMLElement | null>(null)

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
    return rebuildManagedPayloadFromVersion(slug, pageQuery.data.version)
  }, [pageQuery.data, previewPayload, slug])

  useEffect(() => {
    if (slug !== "home") {
      setHomeReviewsMountNode(null)
      return
    }

    const root = managedRootRef.current
    if (!root) {
      setHomeReviewsMountNode(null)
      return
    }

    const placeholder = root.querySelector<HTMLElement>(".me-home-review-placeholder")
    if (!placeholder) {
      setHomeReviewsMountNode(null)
      return
    }

    placeholder.setAttribute("data-me-home-reviews-live", "1")
    placeholder.innerHTML = ""
    setHomeReviewsMountNode(placeholder)
  }, [managedPayload?.html, slug])

  if (pageQuery.isLoading && !previewPayload) {
    return <LoadingState message="A carregar conteudo da pagina..." />
  }

  if (pageQuery.isError && !previewPayload) {
    // Fail-open for public pages: fallback component prevents hard outage when managed content fails.
    return <>{fallback}</>
  }

  if (!managedPayload?.html) {
    return <>{fallback}</>
  }

  return (
    <div className="w-full bg-white">
      {managedPayload.css ? <style>{managedPayload.css}</style> : null}
      {slug === "home" ? (
        <style>{`
          .me-home-review-placeholder[data-me-home-reviews-live="1"] {
            max-width: none;
            border: 0;
            background: transparent;
            padding: 0;
          }
        `}</style>
      ) : null}
      <div ref={managedRootRef} dangerouslySetInnerHTML={{ __html: managedPayload.html }} />
      {slug === "home" && homeReviewsMountNode
        ? createPortal(<HomeReviewsFeed className="!mt-0" />, homeReviewsMountNode)
        : null}
    </div>
  )
}
