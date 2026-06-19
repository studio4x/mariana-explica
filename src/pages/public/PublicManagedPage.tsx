import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { LoadingState } from "@/components/feedback"
import { HomeReviewsFeed } from "@/components/reviews"
import { formatAiPageEditorModeLabel, formatAiPageEditorScopeLabel } from "@/lib/ai-page-editor"
import {
  composeManagedPageCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { readSitePagePreviewFromSearch } from "@/lib/site-page-preview"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import type { PublicSitePagePayload } from "@/types/app.types"
import { ExplicacoesFormExperience } from "./ExplicacoesFormExperience"
import { ProductsCatalogExperience } from "./ProductsCatalogExperience"
import { SupportFaqExperience } from "./SupportFaqExperience"

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

function rebuildManagedPayloadFromVersion(slug: string, version: PublicSitePagePayload["version"] | null | undefined) {
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
      css: composeManagedPageCss(normalizeCss(version.style_json)),
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
  slug: string
  fallback: ReactNode
}

export function PublicManagedPage({ slug, fallback }: PublicManagedPageProps) {
  const location = useLocation()
  const pageQuery = usePublicSitePage(slug)
  const managedRootRef = useRef<HTMLDivElement | null>(null)
  const [homeReviewsMountNode, setHomeReviewsMountNode] = useState<HTMLElement | null>(null)
  const [managedExperienceMountNode, setManagedExperienceMountNode] = useState<HTMLElement | null>(null)
  const [highlightedTargetsCount, setHighlightedTargetsCount] = useState(0)

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

  useEffect(() => {
    const root = managedRootRef.current
    if (!root) {
      setManagedExperienceMountNode(null)
      return
    }

    const placeholderSelector =
      slug === "explicacoes"
        ? ".me-explicacoes-form-placeholder"
        : slug === "materiais"
          ? ".me-products-experience-placeholder"
          : slug === "suporte"
            ? ".me-support-experience-placeholder"
            : null

    if (!placeholderSelector) {
      setManagedExperienceMountNode(null)
      return
    }

    const placeholder = root.querySelector<HTMLElement>(placeholderSelector)
    if (!placeholder) {
      setManagedExperienceMountNode(null)
      return
    }

    placeholder.innerHTML = ""
    setManagedExperienceMountNode(placeholder)
  }, [managedPayload?.html, slug])

  useEffect(() => {
    const root = managedRootRef.current
    if (!root) {
      setHighlightedTargetsCount(0)
      return
    }

    root.querySelectorAll("[data-me-ai-preview-highlight='1']").forEach((node) => {
      node.removeAttribute("data-me-ai-preview-highlight")
    })

    const selectors = previewPayload?.highlightSelectors ?? []
    if (selectors.length === 0) {
      setHighlightedTargetsCount(0)
      return
    }

    const highlighted = new Set<HTMLElement>()
    selectors.forEach((selector) => {
      try {
        root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
          highlighted.add(node)
        })
      } catch {
        // Ignore invalid selectors coming from older preview payloads.
      }
    })

    highlighted.forEach((node) => {
      node.setAttribute("data-me-ai-preview-highlight", "1")
    })

    const firstTarget = highlighted.values().next().value
    if (firstTarget && typeof firstTarget.scrollIntoView === "function") {
      firstTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    }

    setHighlightedTargetsCount(highlighted.size)

    return () => {
      highlighted.forEach((node) => {
        node.removeAttribute("data-me-ai-preview-highlight")
      })
    }
  }, [managedPayload?.html, previewPayload?.highlightSelectors])

  if (pageQuery.isLoading && !previewPayload) {
    return <LoadingState message="A carregar conteúdo da página..." />
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
      {previewPayload ? (
        <style>{`
          [data-me-ai-preview-highlight="1"] {
            position: relative;
            outline: 3px solid rgba(14, 165, 233, 0.95);
            outline-offset: 4px;
            box-shadow: 0 0 0 8px rgba(186, 230, 253, 0.6);
            border-radius: 1rem;
            animation: meAiPreviewPulse 1.6s ease-in-out infinite alternate;
          }

          @keyframes meAiPreviewPulse {
            from {
              box-shadow: 0 0 0 6px rgba(186, 230, 253, 0.45);
            }
            to {
              box-shadow: 0 0 0 12px rgba(186, 230, 253, 0.72);
            }
          }
        `}</style>
      ) : null}
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
      {previewPayload ? (
        <div className="border-b border-sky-200 bg-sky-50/95 px-4 py-3 text-slate-900 shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
              <span>Pré-visualização IA</span>
              {previewPayload.editPlan ? (
                <span className="rounded-full bg-white px-2 py-1 text-[10px] text-sky-900">
                  {formatAiPageEditorModeLabel(previewPayload.editPlan.mode)} · {formatAiPageEditorScopeLabel(previewPayload.editPlan.scope)}
                </span>
              ) : null}
              {previewPayload.baseVersion ? (
                <span className="rounded-full bg-white px-2 py-1 text-[10px] text-slate-700">
                  Base v{previewPayload.baseVersion.version_number}
                </span>
              ) : null}
            </div>
            {previewPayload.summary ? <p className="text-sm font-semibold text-slate-950">{previewPayload.summary}</p> : null}
            {previewPayload.explanation ? <p className="text-sm leading-6 text-slate-700">{previewPayload.explanation}</p> : null}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>{highlightedTargetsCount > 0 ? `${highlightedTargetsCount} alvo(s) destacados` : "Sem destaque visual disponível"}</span>
              {previewPayload.warnings?.length ? <span>{previewPayload.warnings.length} aviso(s) desta proposta</span> : null}
            </div>
            {previewPayload.warnings?.length ? (
              <ul className="space-y-1 text-xs leading-5 text-amber-900">
                {previewPayload.warnings.slice(0, 3).map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
      <div ref={managedRootRef} dangerouslySetInnerHTML={{ __html: managedPayload.html }} />
      {slug === "home" && homeReviewsMountNode
        ? createPortal(<HomeReviewsFeed className="!mt-0" />, homeReviewsMountNode)
        : null}
      {slug === "explicacoes" && managedExperienceMountNode
        ? createPortal(<ExplicacoesFormExperience />, managedExperienceMountNode)
        : null}
      {slug === "materiais" && managedExperienceMountNode
        ? createPortal(<ProductsCatalogExperience />, managedExperienceMountNode)
        : null}
      {slug === "suporte" && managedExperienceMountNode
        ? createPortal(<SupportFaqExperience />, managedExperienceMountNode)
        : null}
    </div>
  )
}
