import { useEffect, useMemo, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ReactNode } from "react"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import type { SitePageSlug } from "@/types/app.types"
import "@/styles/public-page-builder.css"

function sanitizeHtmlSnapshot(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, ' $1="#"')
}

function sanitizeCssSnapshot(css: string) {
  return css
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
}

function injectWidgetPlaceholders(
  html: string,
  widgets: Array<{ key: string; node: ReactNode }>,
) {
  let nextHtml = html

  widgets.forEach((widget) => {
    const key = widget.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const commentPattern = new RegExp(`<!--\\s*ME_WIDGET:${key}\\s*-->`, "gi")
    const curlyPattern = new RegExp(`\\{\\{\\s*ME_WIDGET:${key}\\s*\\}\\}`, "gi")

    nextHtml = nextHtml
      .replace(commentPattern, `<div data-me-widget="${widget.key}"></div>`)
      .replace(curlyPattern, `<div data-me-widget="${widget.key}"></div>`)
  })

  return nextHtml
}

function resolvePublishedHtml(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as {
    version?: {
      layout_json?: Record<string, unknown>
      style_json?: Record<string, unknown>
    }
  }

  const layoutJson = source.version?.layout_json
  const styleJson = source.version?.style_json
  if (!layoutJson || typeof layoutJson !== "object") {
    return null
  }

  const cssFromStyleJson = typeof styleJson?.css === "string" ? styleJson.css : ""

  const htmlCandidate = layoutJson.html
  if (typeof htmlCandidate === "string" && htmlCandidate.trim().length > 0) {
    return {
      html: sanitizeHtmlSnapshot(htmlCandidate),
      css: sanitizeCssSnapshot(cssFromStyleJson),
    }
  }

  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : null

  if (!projectData) {
    return null
  }

  const pages = Array.isArray(projectData.pages) ? projectData.pages : []
  const firstPage = pages[0]
  if (!firstPage || typeof firstPage !== "object") {
    return null
  }

  const component = (firstPage as { component?: unknown }).component
  if (typeof component !== "string" || component.trim().length === 0) {
    return null
  }

  const pageStyles = (firstPage as { styles?: unknown }).styles
  const resolvedCss =
    cssFromStyleJson || (typeof pageStyles === "string" && pageStyles.trim().length > 0 ? pageStyles : "")

  return {
    html: sanitizeHtmlSnapshot(component),
    css: sanitizeCssSnapshot(resolvedCss),
  }
}

interface PublicManagedPageProps {
  slug: SitePageSlug
  fallback: ReactNode
  widgets?: Array<{ key: string; node: ReactNode }>
}

export function PublicManagedPage({ slug, fallback, widgets = [] }: PublicManagedPageProps) {
  const pageQuery = usePublicSitePage(slug)
  const widgetRootsRef = useRef<Root[]>([])
  const htmlContainerRef = useRef<HTMLDivElement | null>(null)
  const rendered = resolvePublishedHtml(pageQuery.data)
  const htmlWithWidgets = useMemo(
    () => (rendered ? injectWidgetPlaceholders(rendered.html, widgets) : ""),
    [rendered, widgets],
  )

  useEffect(() => {
    const container = htmlContainerRef.current
    if (!container || !rendered) return

    widgetRootsRef.current.forEach((root) => root.unmount())
    widgetRootsRef.current = []

    container.innerHTML = htmlWithWidgets

    if (widgets.length === 0) {
      return
    }

    widgets.forEach((widget) => {
      const placeholders = container.querySelectorAll(`[data-me-widget="${widget.key}"]`)
      placeholders.forEach((placeholder) => {
        const mountPoint = document.createElement("div")
        mountPoint.setAttribute("data-me-widget-mounted", widget.key)
        placeholder.replaceWith(mountPoint)
        const root = createRoot(mountPoint)
        root.render(widget.node)
        widgetRootsRef.current.push(root)
      })
    })

    return () => {
      widgetRootsRef.current.forEach((root) => root.unmount())
      widgetRootsRef.current = []
    }
  }, [htmlWithWidgets, rendered, widgets])

  if (pageQuery.isLoading) {
    return <>{fallback}</>
  }

  if (pageQuery.isError) {
    return <>{fallback}</>
  }

  if (!rendered) {
    return <>{fallback}</>
  }

  return (
    <section className="me-public-page-builder">
      {rendered.css ? <style>{rendered.css}</style> : null}
      <div ref={htmlContainerRef} />
    </section>
  )
}
