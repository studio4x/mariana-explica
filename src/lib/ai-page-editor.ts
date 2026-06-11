import type { SitePageSlug } from "@/types/app.types"

export interface AiPageEditorRouteOption {
  slug: SitePageSlug | null
  label: string
  path: string
}

export const AI_PAGE_EDITOR_ROUTE_OPTIONS: AiPageEditorRouteOption[] = [
  { slug: "home", label: "Home", path: "/" },
  { slug: "sobre", label: "Sobre", path: "/sobre" },
  { slug: "privacidade", label: "Privacidade", path: "/privacidade" },
  { slug: "cookies", label: "Cookies", path: "/cookies" },
  { slug: "termos", label: "Termos de uso", path: "/termos-de-uso" },
  { slug: null, label: "Área do aluno · Dashboard", path: "/aluno/dashboard" },
  { slug: null, label: "Área do aluno · Materiais", path: "/aluno/cursos" },
  { slug: null, label: "Área do aluno · Detalhe do material", path: "/aluno/cursos/:courseId" },
  { slug: null, label: "Área do aluno · Player do curso", path: "/aluno/cursos/:courseId/player/*" },
  { slug: null, label: "Área do aluno · Downloads", path: "/aluno/downloads" },
  { slug: null, label: "Área do aluno · Pagamentos", path: "/aluno/pagamentos" },
  { slug: null, label: "Área do aluno · Notificações", path: "/aluno/notificacoes" },
  { slug: null, label: "Área do aluno · Chamados", path: "/aluno/chamados" },
  { slug: null, label: "Área do aluno · Perfil", path: "/aluno/perfil" },
]

export const AI_PAGE_EDITOR_DEFAULT_ALLOWED_PATHS = AI_PAGE_EDITOR_ROUTE_OPTIONS.map((item) => item.path)

function normalizePathname(pathname: string) {
  const trimmed = String(pathname ?? "").trim()
  if (!trimmed) return "/"
  if (trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

function matchPathPattern(pathname: string, pattern: string) {
  const normalizedPath = normalizePathname(pathname)
  const normalizedPattern = normalizePathname(pattern)

  if (normalizedPattern === normalizedPath) {
    return true
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean)
  const patternSegments = normalizedPattern.split("/").filter(Boolean)
  const hasWildcard = patternSegments[patternSegments.length - 1] === "*"
  const comparablePatternSegments = hasWildcard ? patternSegments.slice(0, -1) : patternSegments

  if (!hasWildcard && comparablePatternSegments.length !== pathSegments.length) {
    return false
  }

  if (hasWildcard && comparablePatternSegments.length > pathSegments.length) {
    return false
  }

  for (let index = 0; index < comparablePatternSegments.length; index += 1) {
    const patternSegment = comparablePatternSegments[index]
    const pathSegment = pathSegments[index]

    if (patternSegment?.startsWith(":")) {
      if (!pathSegment) return false
      continue
    }

    if (patternSegment !== pathSegment) {
      return false
    }
  }

  return hasWildcard || comparablePatternSegments.length === pathSegments.length
}

export function getAiPageEditorRouteOption(pathname: string) {
  return AI_PAGE_EDITOR_ROUTE_OPTIONS.find((item) => matchPathPattern(pathname, item.path)) ?? null
}

export function isAiPageEditorAllowedPath(pathname: string, allowedPaths: string[]) {
  if (allowedPaths.length === 0) return false
  return allowedPaths.some((pattern) => matchPathPattern(pathname, pattern))
}
