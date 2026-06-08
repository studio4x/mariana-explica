import type { SitePageSlug } from "@/types/app.types"

export interface AiPageEditorRouteOption {
  slug: SitePageSlug
  label: string
  path: string
}

export const AI_PAGE_EDITOR_ROUTE_OPTIONS: AiPageEditorRouteOption[] = [
  { slug: "home", label: "Home", path: "/" },
  { slug: "sobre", label: "Sobre", path: "/sobre" },
  { slug: "privacidade", label: "Privacidade", path: "/privacidade" },
  { slug: "cookies", label: "Cookies", path: "/cookies" },
  { slug: "termos", label: "Termos de uso", path: "/termos-de-uso" },
]

export const AI_PAGE_EDITOR_DEFAULT_ALLOWED_PATHS = AI_PAGE_EDITOR_ROUTE_OPTIONS.map((item) => item.path)

export function getAiPageEditorRouteOption(pathname: string) {
  return AI_PAGE_EDITOR_ROUTE_OPTIONS.find((item) => item.path === pathname) ?? null
}

export function isAiPageEditorAllowedPath(pathname: string, allowedPaths: string[]) {
  if (allowedPaths.length === 0) return false
  return allowedPaths.includes(pathname)
}

