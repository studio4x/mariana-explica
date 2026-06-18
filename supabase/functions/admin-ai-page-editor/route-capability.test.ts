import { describe, expect, it } from "vitest"
import { resolveManagedRouteCapability } from "./route-capability.ts"

describe("route-capability", () => {
  it("enables persistible flow for an allowed public route", () => {
    const capability = resolveManagedRouteCapability("/explicacoes?origem=x", ["/", "/sobre", "/explicacoes"])

    expect(capability.normalizedPath).toBe("/explicacoes")
    expect(capability.route_is_public).toBe(true)
    expect(capability.route_is_allowed).toBe(true)
    expect(capability.dynamic_slug).toBe("explicacoes")
    expect(capability.persistible_flow_enabled).toBe(true)
    expect(capability.reason).toBeNull()
  })

  it("blocks routes that are not in allowed_paths", () => {
    const capability = resolveManagedRouteCapability("/rota-nao-permitida", ["/", "/sobre"])

    expect(capability.route_is_public).toBe(true)
    expect(capability.route_is_allowed).toBe(false)
    expect(capability.persistible_flow_enabled).toBe(false)
  })

  it("keeps private areas blocked even if they appear in allowed_paths", () => {
    const capability = resolveManagedRouteCapability("/aluno/dashboard", ["/aluno/dashboard"])

    expect(capability.route_is_public).toBe(false)
    expect(capability.route_is_sensitive).toBe(true)
    expect(capability.persistible_flow_enabled).toBe(false)
    expect(capability.reason).toContain("privada")
  })
})
