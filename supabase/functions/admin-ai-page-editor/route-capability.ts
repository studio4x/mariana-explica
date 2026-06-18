import { resolveManagedPageSlug, normalizeEditorPathname, isPublicEditorPath, isSensitiveEditorPath } from "./dynamic-slug.ts"
import { isPathAllowedByPatterns } from "./safety.ts"

export interface ManagedRouteCapability {
  normalizedPath: string
  route_is_public: boolean
  route_is_allowed: boolean
  route_is_sensitive: boolean
  dynamic_slug: string | null
  persistible_flow_enabled: boolean
  reason: string | null
}

export function resolveManagedRouteCapability(pathname: string, allowedPaths: string[]) {
  const normalizedPath = normalizeEditorPathname(pathname)
  const route_is_public = isPublicEditorPath(normalizedPath)
  const route_is_sensitive = isSensitiveEditorPath(normalizedPath)
  const route_is_allowed = allowedPaths.length > 0 ? isPathAllowedByPatterns(normalizedPath, allowedPaths) : false
  const dynamic_slug = route_is_public ? resolveManagedPageSlug(normalizedPath) : null
  const persistible_flow_enabled = Boolean(route_is_public && route_is_allowed && dynamic_slug)

  let reason: string | null = null
  if (!persistible_flow_enabled) {
    if (route_is_sensitive) {
      reason = "Esta area continua bloqueada para edicao segura porque e privada, administrativa, de autenticacao ou sensivel."
    } else if (!route_is_allowed) {
      reason = "Rota nao habilitada para o editor via IA"
    } else {
      reason = "Nao foi possivel resolver um slug persistente e seguro para esta rota."
    }
  }

  return {
    normalizedPath,
    route_is_public,
    route_is_allowed,
    route_is_sensitive,
    dynamic_slug,
    persistible_flow_enabled,
    reason,
  } satisfies ManagedRouteCapability
}
