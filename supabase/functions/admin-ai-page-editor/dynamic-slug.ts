const SPECIAL_SLUGS: Record<string, string> = {
  "/": "home",
  "/termos-de-uso": "termos",
}

const PRIVATE_ROUTE_PREFIXES = ["/admin", "/aluno"]
const SENSITIVE_ROUTE_PREFIXES = ["/checkout", "/login", "/criar-conta", "/cadastro"]

function normalizeToken(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function normalizeEditorPathname(pathname: string) {
  const trimmed = String(pathname ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/, 1)[0]
  if (!trimmed) return "/"
  if (trimmed === "/") return "/"
  return trimmed.replace(/\/+$/, "") || "/"
}

export function isSensitiveEditorPath(pathname: string) {
  const normalizedPath = normalizeEditorPathname(pathname)
  if (!normalizedPath.startsWith("/")) return true
  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return true
  }
  return SENSITIVE_ROUTE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
}

export function isPublicEditorPath(pathname: string) {
  const normalizedPath = normalizeEditorPathname(pathname)
  return normalizedPath.startsWith("/") && !isSensitiveEditorPath(normalizedPath)
}

export function resolveManagedPageSlug(pathname: string) {
  const normalizedPath = normalizeEditorPathname(pathname)
  if (!isPublicEditorPath(normalizedPath)) return null
  if (SPECIAL_SLUGS[normalizedPath]) {
    return SPECIAL_SLUGS[normalizedPath]
  }

  const slug = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      normalizeToken(segment)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("--")

  return slug || "home"
}
