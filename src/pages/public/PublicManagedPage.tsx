import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import { HomeReviewsFeed } from "@/components/reviews"
import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { formatAiPageEditorModeLabel, formatAiPageEditorScopeLabel } from "@/lib/ai-page-editor"
import {
  buildCanonicalManagedPagePayload,
  composeManagedPageCss,
  renderDocumentToHtml,
  resolveBuilderDocumentFromLayoutJson,
} from "@/lib/site-page-builder"
import { readSitePagePreviewFromSearch } from "@/lib/site-page-preview"
import { usePublicSitePage } from "@/hooks/usePublicSitePage"
import type { PublicSitePagePayload, SitePageSlug } from "@/types/app.types"
import { ExplicacoesFormExperience } from "./ExplicacoesFormExperience"
import { ProductsCatalogExperience } from "./ProductsCatalogExperience"
import { SupportFaqExperienceBody } from "./SupportFaqExperience"

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

function rebuildManagedPayloadFromVersion(
  slug: SitePageSlug,
  version: PublicSitePagePayload["version"] | null | undefined,
) {
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
  slug: SitePageSlug
  fallback?: ReactNode
}

export function PublicManagedPage({ slug, fallback }: PublicManagedPageProps) {
  const location = useLocation()
  const pageQuery = usePublicSitePage(slug)
  const managedRootRef = useRef<HTMLDivElement | null>(null)
  const [homeReviewsMountNode, setHomeReviewsMountNode] = useState<HTMLElement | null>(null)
  const [explicacoesFormMountNode, setExplicacoesFormMountNode] = useState<HTMLElement | null>(null)
  const [productsExperienceMountNode, setProductsExperienceMountNode] = useState<HTMLElement | null>(null)
  const [supportExperienceMountNode, setSupportExperienceMountNode] = useState<HTMLElement | null>(null)
  const [highlightedTargetsCount, setHighlightedTargetsCount] = useState(0)

  const previewPayload = useMemo(() => {
    return readSitePagePreviewFromSearch(slug, location.search)
  }, [location.search, slug])

  const canonicalPayload = useMemo(() => {
    const baseline = buildCanonicalManagedPagePayload(slug)
    return {
      html: baseline.html,
      css: composeManagedPageCss(""),
    }
  }, [slug])

  const managedPayload = useMemo(() => {
    if (previewPayload) {
      return {
        html: previewPayload.html,
        css: previewPayload.css,
      }
    }

    if (pageQuery.data?.version) {
      return rebuildManagedPayloadFromVersion(slug, pageQuery.data.version) ?? canonicalPayload
    }

    return canonicalPayload
  }, [canonicalPayload, pageQuery.data?.version, previewPayload, slug])
  const shouldHideInitialManagedPaint =
    !previewPayload && pageQuery.isLoading && !pageQuery.data && !pageQuery.isError

  function prepareMountNode(selector: string, markerName: string) {
    const root = managedRootRef.current
    if (!root) return null

    const placeholder = root.querySelector<HTMLElement>(selector)
    if (!placeholder) return null

    placeholder.setAttribute(markerName, "1")
    placeholder.innerHTML = ""
    return placeholder
  }

  useEffect(() => {
    setHomeReviewsMountNode(
      slug === "home" ? prepareMountNode(".me-home-review-placeholder", "data-me-home-reviews-live") : null,
    )
    setExplicacoesFormMountNode(
      slug === "explicacoes"
        ? prepareMountNode(".me-explicacoes-form-placeholder", "data-me-explicacoes-form-live")
        : null,
    )
    setProductsExperienceMountNode(
      slug === "materiais"
        ? prepareMountNode(".me-products-experience-placeholder", "data-me-products-experience-live")
        : null,
    )
    setSupportExperienceMountNode(
      slug === "suporte"
        ? prepareMountNode(".me-support-experience-placeholder", "data-me-support-experience-live")
        : null,
    )
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

  if (pageQuery.isError && !previewPayload && fallback) {
    return <>{fallback}</>
  }

  if (!managedPayload?.html) {
    return fallback ? <>{fallback}</> : null
  }

  const pageContent = (
    <div
      data-public-managed-page-paint={shouldHideInitialManagedPaint ? "pending" : "ready"}
      className="w-full bg-white"
      style={shouldHideInitialManagedPaint ? { opacity: 0, pointerEvents: "none" } : undefined}
    >
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
      <style>{`
        .me-home-review-placeholder[data-me-home-reviews-live="1"] {
          max-width: none;
          border: 0;
          background: transparent;
          padding: 0;
        }

        .me-explicacoes-form-placeholder[data-me-explicacoes-form-live="1"],
        .me-products-experience-placeholder[data-me-products-experience-live="1"],
        .me-support-experience-placeholder[data-me-support-experience-live="1"] {
          min-height: 0;
        }
      `}</style>
      {previewPayload ? (
        <div className="border-b border-sky-200 bg-sky-50/95 px-4 py-3 text-slate-900 shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
              <span>Pré-visualização IA</span>
              {previewPayload.editPlan ? (
                <span className="rounded-full bg-white px-2 py-1 text-[10px] text-sky-900">
                  {formatAiPageEditorModeLabel(previewPayload.editPlan.mode)} ·{" "}
                  {formatAiPageEditorScopeLabel(previewPayload.editPlan.scope)}
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
              <span>
                {highlightedTargetsCount > 0
                  ? `${highlightedTargetsCount} alvo(s) destacados`
                  : "Sem destaque visual disponivel"}
              </span>
              {previewPayload.warnings?.length ? <span>{previewPayload.warnings.length} aviso(s) desta proposta</span> : null}
            </div>
            {previewPayload.warnings?.length ? (
              <ul className="space-y-1 text-xs leading-5 text-amber-900">
                {previewPayload.warnings.slice(0, 3).map((warning) => (
                  <li key={warning}>- {warning}</li>
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
      {slug === "explicacoes" && explicacoesFormMountNode
        ? createPortal(<ExplicacoesFormExperience />, explicacoesFormMountNode)
        : null}
      {slug === "materiais" && productsExperienceMountNode
        ? createPortal(<ProductsCatalogExperience />, productsExperienceMountNode)
        : null}
      {slug === "suporte" && supportExperienceMountNode
        ? createPortal(<SupportFaqExperienceBody />, supportExperienceMountNode)
        : null}
    </div>
  )

  return slug === "suporte" ? <VisualEditorProvider pageKey="support">{pageContent}</VisualEditorProvider> : pageContent
}
