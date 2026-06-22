import { describe, expect, it, vi } from "vitest"
import { writeAuditLog } from "./audit.ts"

describe("writeAuditLog", () => {
  it("keeps text config keys out of the uuid entity_id column", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = {
      from: vi.fn().mockReturnValue({
        insert,
      }),
    } as never

    await writeAuditLog(client, {
      user: { id: "user-1" } as never,
      profile: {
        id: "profile-1",
        full_name: "Admin",
        email: "admin@example.com",
        nif: null,
        role: "admin",
        is_admin: true,
        status: "active",
        content_updates_consent: true,
      },
    }, {
      action: "admin.ai_code_editor_config_updated",
      entityType: "site_config",
      entityId: "ai_code_editor_config",
      metadata: {
        config_key: "ai_code_editor_config",
      },
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: null,
        metadata: {
          config_key: "ai_code_editor_config",
        },
      }),
    )
  })

  it("preserves valid uuid entity ids", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = {
      from: vi.fn().mockReturnValue({
        insert,
      }),
    } as never

    await writeAuditLog(client, {
      user: { id: "user-1" } as never,
      profile: {
        id: "profile-1",
        full_name: "Admin",
        email: "admin@example.com",
        nif: null,
        role: "admin",
        is_admin: true,
        status: "active",
        content_updates_consent: true,
      },
    }, {
      action: "admin.ai_code_editor_task_updated",
      entityType: "ai_code_editor_task",
      entityId: "4c0f20be-a6e7-4b19-86e0-b8197325f1cb",
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: "4c0f20be-a6e7-4b19-86e0-b8197325f1cb",
      }),
    )
  })
})
