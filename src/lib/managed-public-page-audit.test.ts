import { describe, expect, it } from "vitest"
import { auditManagedPublicPageRoute } from "./managed-public-page-audit"
import type { AdminSitePageDetail } from "@/types/app.types"

function createDetail(overrides: Record<string, unknown> = {}) {
  return {
    page: {
      id: "page-1",
      slug: "explicacoes",
      title: "Explicações",
      status: "published",
      published_version_id: "version-1",
      created_by: null,
      created_at: "2026-06-19T10:00:00.000Z",
      updated_at: "2026-06-19T10:00:00.000Z",
    },
    published_version: {
      id: "version-1",
      page_id: "page-1",
      version_number: 7,
      status: "published",
      layout_json: {
        projectData: {
          blocks: [{ id: "notes" }],
        },
        html: '<div class="me-managed-page-root"><section data-block-id="notes" data-managed-node-id="block:notes"><div data-managed-node-id="content:notes"><h2>Notas importantes antes de enviares o teu formulário:</h2></div></section></div>',
      },
      style_json: {},
      metadata: {
        source: "managed_public_page_seed",
      },
      created_by: null,
      created_at: "2026-06-19T10:00:00.000Z",
    },
    latest_draft: null,
    versions: [],
    assets: [],
    ...overrides,
  } as AdminSitePageDetail
}

describe("auditManagedPublicPageRoute", () => {
  it("classifies a published managed public page as managed_ready", () => {
    const audit = auditManagedPublicPageRoute({
      path: "/explicacoes",
      managedSlug: "explicacoes",
      inAllowedPaths: true,
      inRouteOptions: true,
      routeIsPublic: true,
      routeIsSensitive: false,
      usesPublicManagedPage: true,
      detail: createDetail(),
    })

    expect(audit.status).toBe("managed_ready")
    expect(audit.supportsPersistibleFlow).toBe(true)
    expect(audit.domHasManagedRoot).toBe(true)
    expect(audit.domHasBlockIds).toBe(true)
    expect(audit.domHasManagedNodeIds).toBe(true)
  })

  it("proves that allowed_paths alone does not unlock persistible flow", () => {
    const audit = auditManagedPublicPageRoute({
      path: "/explicacoes",
      managedSlug: "explicacoes",
      inAllowedPaths: true,
      inRouteOptions: true,
      routeIsPublic: true,
      routeIsSensitive: false,
      usesPublicManagedPage: true,
      detail: null,
    })

    expect(audit.status).toBe("hardcoded_fallback")
    expect(audit.supportsPersistibleFlow).toBe(false)
    expect(audit.reason).toContain("baseline")
  })

  it("classifies bootstrap-only baselines separately from real managed pages", () => {
    const audit = auditManagedPublicPageRoute({
      path: "/explicacoes",
      managedSlug: "explicacoes",
      inAllowedPaths: true,
      inRouteOptions: true,
      routeIsPublic: true,
      routeIsSensitive: false,
      usesPublicManagedPage: true,
      detail: createDetail({
        page: {
          id: "page-1",
          slug: "explicacoes",
          title: "Explicações",
          status: "draft",
          published_version_id: null,
          created_by: null,
          created_at: "2026-06-19T10:00:00.000Z",
          updated_at: "2026-06-19T10:00:00.000Z",
        },
        published_version: null,
        latest_draft: {
          id: "version-bootstrap",
          page_id: "page-1",
          version_number: 1,
          status: "draft",
          layout_json: {
            projectData: {
              blocks: [{ id: "bootstrap" }],
            },
            html: "<main><section>Bootstrap antigo</section></main>",
          },
          style_json: {},
          metadata: {
            source: "allowed_path_bootstrap",
          },
          created_by: null,
          created_at: "2026-06-19T10:00:00.000Z",
        },
        versions: [
          {
            id: "version-bootstrap",
            page_id: "page-1",
            version_number: 1,
            status: "draft",
            layout_json: {
              projectData: {
                blocks: [{ id: "bootstrap" }],
              },
              html: "<main><section>Bootstrap antigo</section></main>",
            },
            style_json: {},
            metadata: {
              source: "allowed_path_bootstrap",
            },
            created_by: null,
            created_at: "2026-06-19T10:00:00.000Z",
          },
        ],
      }),
    })

    expect(audit.status).toBe("bootstrap_only")
    expect(audit.supportsPersistibleFlow).toBe(false)
  })

  it("flags incomplete published baselines when managed markers are missing", () => {
    const audit = auditManagedPublicPageRoute({
      path: "/suporte",
      managedSlug: "suporte",
      inAllowedPaths: true,
      inRouteOptions: true,
      routeIsPublic: true,
      routeIsSensitive: false,
      usesPublicManagedPage: true,
      detail: createDetail({
        page: {
          id: "page-2",
          slug: "suporte",
          title: "Suporte",
          status: "published",
          published_version_id: "version-2",
          created_by: null,
          created_at: "2026-06-19T10:00:00.000Z",
          updated_at: "2026-06-19T10:00:00.000Z",
        },
        published_version: {
          id: "version-2",
          page_id: "page-2",
          version_number: 4,
          status: "published",
          layout_json: {
            projectData: {
              blocks: [{ id: "hero" }],
            },
            html: "<main><section>HTML sem marcadores geridos</section></main>",
          },
          style_json: {},
          metadata: {
            source: "managed_public_page_seed",
          },
          created_by: null,
          created_at: "2026-06-19T10:00:00.000Z",
        },
        versions: [],
      }),
    })

    expect(audit.status).toBe("managed_incomplete")
    expect(audit.supportsPersistibleFlow).toBe(false)
  })

  it("keeps blocked or sensitive routes out of the persistible flow", () => {
    const audit = auditManagedPublicPageRoute({
      path: "/login",
      managedSlug: null,
      inAllowedPaths: true,
      inRouteOptions: true,
      routeIsPublic: false,
      routeIsSensitive: true,
      usesPublicManagedPage: false,
      detail: null,
    })

    expect(audit.status).toBe("sensitive_or_blocked")
    expect(audit.supportsPersistibleFlow).toBe(false)
  })
})
