import {
  badRequest,
  buildStoragePublicUrl,
  corsResponse,
  createServiceClient,
  downloadStorageObject,
  errorResponse,
  getBearerToken,
  getRequestId,
  jsonResponse,
  requireAdmin,
  uploadStorageObject,
} from "../_shared/mod.ts"

type BackfillSection =
  | "module_assets"
  | "module_pdfs"
  | "product_covers"
  | "branding"
  | "site_page_assets"
  | "profile_avatars"
  | "support_attachments"

interface BackfillBody {
  section?: BackfillSection
  limit?: number | null
  dry_run?: boolean | null
}

function parsePositiveInteger(value: number | null | undefined, fallback: number, max = 250) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.trunc(parsed), max)
}

function trimPath(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/^\/+/, "")
}

function extractStoragePathFromUrl(url: string | null | undefined, logicalBucket?: string | null) {
  const rawUrl = String(url ?? "").trim()
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    const canonicalPath = parsed.searchParams.get("storage_path")
    if (canonicalPath) {
      return decodeURIComponent(canonicalPath)
    }

    const publicMatch = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (publicMatch?.[2]) {
      return decodeURIComponent(publicMatch[2])
    }

    const logicalPrefix = trimPath(logicalBucket)
    if (logicalPrefix) {
      const r2Match = parsed.pathname.match(new RegExp(`/${logicalPrefix}/(.+)$`))
      if (r2Match?.[1]) {
        return decodeURIComponent(r2Match[1])
      }
    }
  } catch {
    return null
  }

  return null
}

async function copyObjectToR2(input: {
  serviceClient: ReturnType<typeof createServiceClient>
  logicalBucket: string
  storagePath: string
  dryRun: boolean
}) {
  if (input.dryRun) {
    return
  }

  const bytes = await downloadStorageObject({
    serviceClient: input.serviceClient,
    logicalBucket: input.logicalBucket,
    storagePath: input.storagePath,
    provider: "supabase",
  })

  await uploadStorageObject({
    serviceClient: input.serviceClient,
    logicalBucket: input.logicalBucket,
    storagePath: input.storagePath,
    provider: "r2",
    body: bytes,
  })
}

async function processModuleAssets(serviceClient: ReturnType<typeof createServiceClient>, limit: number, dryRun: boolean) {
  const { data, error } = await serviceClient
    .from("module_assets")
    .select("id,storage_bucket,storage_path,storage_provider")
    .eq("storage_provider", "supabase")
    .not("storage_bucket", "is", null)
    .not("storage_path", "is", null)
    .limit(limit)

  if (error) throw error

  const rows = data ?? []
  for (const row of rows) {
    await copyObjectToR2({
      serviceClient,
      logicalBucket: String(row.storage_bucket),
      storagePath: String(row.storage_path),
      dryRun,
    })

    if (!dryRun) {
      const { error: updateError } = await serviceClient
        .from("module_assets")
        .update({ storage_provider: "r2" })
        .eq("id", row.id)
      if (updateError) throw updateError
    }
  }

  return rows.map((row) => ({
    id: row.id,
    logical_bucket: row.storage_bucket,
    storage_path: row.storage_path,
  }))
}

async function processModulePdfs(serviceClient: ReturnType<typeof createServiceClient>, limit: number, dryRun: boolean) {
  const { data, error } = await serviceClient
    .from("product_modules")
    .select("id,module_pdf_storage_path,module_pdf_storage_provider")
    .eq("module_pdf_storage_provider", "supabase")
    .not("module_pdf_storage_path", "is", null)
    .limit(limit)

  if (error) throw error

  const rows = data ?? []
  for (const row of rows) {
    const storagePath = trimPath(row.module_pdf_storage_path)
    if (!storagePath) continue

    await copyObjectToR2({
      serviceClient,
      logicalBucket: "course-assets-private",
      storagePath,
      dryRun,
    })

    if (!dryRun) {
      const { error: updateError } = await serviceClient
        .from("product_modules")
        .update({ module_pdf_storage_provider: "r2" })
        .eq("id", row.id)
      if (updateError) throw updateError
    }
  }

  return rows.map((row) => ({
    id: row.id,
    logical_bucket: "course-assets-private",
    storage_path: row.module_pdf_storage_path,
  }))
}

async function processProductCovers(serviceClient: ReturnType<typeof createServiceClient>, limit: number, dryRun: boolean) {
  const { data, error } = await serviceClient
    .from("products")
    .select("id,cover_image_url,cover_image_storage_bucket,cover_image_storage_path,cover_image_storage_provider")
    .eq("cover_image_storage_provider", "supabase")
    .not("cover_image_url", "is", null)
    .limit(limit)

  if (error) throw error

  const rows = data ?? []
  const items: Array<Record<string, unknown>> = []

  for (const row of rows) {
    const logicalBucket = trimPath(row.cover_image_storage_bucket) || "course-cover-public"
    const storagePath = trimPath(row.cover_image_storage_path) || extractStoragePathFromUrl(row.cover_image_url, logicalBucket)
    if (!storagePath) continue

    await copyObjectToR2({ serviceClient, logicalBucket, storagePath, dryRun })

    if (!dryRun) {
      const { error: updateError } = await serviceClient
        .from("products")
        .update({
          cover_image_url: buildStoragePublicUrl("course_media", storagePath),
          cover_image_storage_bucket: logicalBucket,
          cover_image_storage_path: storagePath,
          cover_image_storage_provider: "r2",
        })
        .eq("id", row.id)
      if (updateError) throw updateError
    }

    items.push({ id: row.id, logical_bucket: logicalBucket, storage_path: storagePath })
  }

  return items
}

async function processBranding(serviceClient: ReturnType<typeof createServiceClient>, dryRun: boolean) {
  const { data, error } = await serviceClient
    .from("site_config")
    .select("id,config_value")
    .eq("config_key", "site_branding")
    .maybeSingle()

  if (error) throw error
  if (!data?.config_value || typeof data.config_value !== "object") return []

  const currentValue = data.config_value as Record<string, unknown>
  const roles = ["logo_light", "logo_dark", "favicon"] as const
  const nextValue = structuredClone(currentValue)
  const items: Array<Record<string, unknown>> = []

  for (const role of roles) {
    const asset = currentValue[role]
    const assetRecord = asset && typeof asset === "object" ? (asset as Record<string, unknown>) : null
    if (!assetRecord) continue

    const logicalBucket = trimPath(String(assetRecord.bucket ?? "")) || "site-branding-public"
    const storagePath = trimPath(String(assetRecord.path ?? "")) || extractStoragePathFromUrl(String(assetRecord.public_url ?? ""), logicalBucket)
    const provider = assetRecord.storage_provider === "r2" ? "r2" : storagePath ? "supabase" : null
    if (!storagePath || provider !== "supabase") continue

    await copyObjectToR2({ serviceClient, logicalBucket, storagePath, dryRun })

    const nextAsset = {
      ...assetRecord,
      bucket: logicalBucket,
      path: storagePath,
      storage_provider: "r2",
      public_url: buildStoragePublicUrl("site_asset", storagePath),
    }

    nextValue[role] = nextAsset
    items.push({ role, logical_bucket: logicalBucket, storage_path: storagePath })
  }

  if (!dryRun && items.length > 0) {
    const { error: updateError } = await serviceClient
      .from("site_config")
      .update({ config_value: nextValue })
      .eq("id", data.id)
    if (updateError) throw updateError
  }

  return items
}

async function processSitePageAssets(serviceClient: ReturnType<typeof createServiceClient>, limit: number, dryRun: boolean) {
  const items: Array<Record<string, unknown>> = []

  const tables = [
    { table: "site_page_assets", proxyKind: "site_asset" as const },
    { table: "visual_site_page_assets", proxyKind: "site_asset" as const },
  ]

  for (const entry of tables) {
    const { data, error } = await serviceClient
      .from(entry.table)
      .select("id,bucket,path,storage_provider")
      .eq("storage_provider", "supabase")
      .limit(limit)

    if (error) throw error

    for (const row of data ?? []) {
      const logicalBucket = trimPath(row.bucket)
      const storagePath = trimPath(row.path)
      if (!logicalBucket || !storagePath) continue

      await copyObjectToR2({ serviceClient, logicalBucket, storagePath, dryRun })

      if (!dryRun) {
        const { error: updateError } = await serviceClient
          .from(entry.table)
          .update({
            storage_provider: "r2",
            public_url: buildStoragePublicUrl(entry.proxyKind, storagePath),
          })
          .eq("id", row.id)
        if (updateError) throw updateError
      }

      items.push({ id: row.id, table: entry.table, logical_bucket: logicalBucket, storage_path: storagePath })
    }
  }

  return items
}

async function processProfileAvatars(serviceClient: ReturnType<typeof createServiceClient>, limit: number, dryRun: boolean) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,avatar_url,avatar_storage_bucket,avatar_storage_path,avatar_storage_provider")
    .eq("avatar_storage_provider", "supabase")
    .not("avatar_url", "is", null)
    .limit(limit)

  if (error) throw error

  const items: Array<Record<string, unknown>> = []
  for (const row of data ?? []) {
    const logicalBucket = trimPath(row.avatar_storage_bucket) || "profile-avatars-public"
    const storagePath = trimPath(row.avatar_storage_path) || extractStoragePathFromUrl(row.avatar_url, logicalBucket)
    if (!storagePath) continue

    await copyObjectToR2({ serviceClient, logicalBucket, storagePath, dryRun })

    if (!dryRun) {
      const { error: updateError } = await serviceClient
        .from("profiles")
        .update({
          avatar_url: buildStoragePublicUrl("profile_avatar", storagePath),
          avatar_storage_bucket: logicalBucket,
          avatar_storage_path: storagePath,
          avatar_storage_provider: "r2",
        })
        .eq("id", row.id)
      if (updateError) throw updateError
    }

    items.push({ id: row.id, logical_bucket: logicalBucket, storage_path: storagePath })
  }

  return items
}

async function processSupportAttachments(serviceClient: ReturnType<typeof createServiceClient>, limit: number, dryRun: boolean) {
  const items: Array<Record<string, unknown>> = []

  const ticketRows = await serviceClient
    .from("support_tickets")
    .select("id,attachment_bucket,attachment_path,attachment_storage_provider")
    .eq("attachment_storage_provider", "supabase")
    .not("attachment_path", "is", null)
    .limit(limit)

  if (ticketRows.error) throw ticketRows.error

  for (const row of ticketRows.data ?? []) {
    const logicalBucket = trimPath(row.attachment_bucket) || "support-attachments"
    const storagePath = trimPath(row.attachment_path)
    if (!storagePath) continue
    await copyObjectToR2({ serviceClient, logicalBucket, storagePath, dryRun })
    if (!dryRun) {
      const { error: updateError } = await serviceClient
        .from("support_tickets")
        .update({ attachment_storage_provider: "r2" })
        .eq("id", row.id)
      if (updateError) throw updateError
    }
    items.push({ id: row.id, table: "support_tickets", logical_bucket: logicalBucket, storage_path: storagePath })
  }

  const messageRows = await serviceClient
    .from("support_ticket_messages")
    .select("id,attachment_bucket,attachment_path,attachment_storage_provider")
    .eq("attachment_storage_provider", "supabase")
    .not("attachment_path", "is", null)
    .limit(limit)

  if (messageRows.error) throw messageRows.error

  for (const row of messageRows.data ?? []) {
    const logicalBucket = trimPath(row.attachment_bucket) || "support-attachments"
    const storagePath = trimPath(row.attachment_path)
    if (!storagePath) continue
    await copyObjectToR2({ serviceClient, logicalBucket, storagePath, dryRun })
    if (!dryRun) {
      const { error: updateError } = await serviceClient
        .from("support_ticket_messages")
        .update({ attachment_storage_provider: "r2" })
        .eq("id", row.id)
      if (updateError) throw updateError
    }
    items.push({
      id: row.id,
      table: "support_ticket_messages",
      logical_bucket: logicalBucket,
      storage_path: storagePath,
    })
  }

  return items
}

async function requireBackfillAccess(req: Request) {
  const sharedToken = Deno.env.get("ADMIN_BACKFILL_TOKEN")?.trim() ?? ""
  const bearerToken = getBearerToken(req)?.trim() ?? ""

  if (sharedToken && bearerToken && sharedToken === bearerToken) {
    return { serviceClient: createServiceClient(), actor: "token" as const }
  }

  const context = await requireAdmin(req)
  return { serviceClient: context.serviceClient, actor: "admin" as const }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const access = await requireBackfillAccess(req)
    const body = (await req.json().catch(() => null)) as BackfillBody | null
    const section = body?.section
    if (!section) {
      throw badRequest("section e obrigatoria")
    }

    const limit = parsePositiveInteger(body?.limit, 50)
    const dryRun = body?.dry_run === true

    let items: Array<Record<string, unknown>> = []

    if (section === "module_assets") {
      items = await processModuleAssets(access.serviceClient, limit, dryRun)
    } else if (section === "module_pdfs") {
      items = await processModulePdfs(access.serviceClient, limit, dryRun)
    } else if (section === "product_covers") {
      items = await processProductCovers(access.serviceClient, limit, dryRun)
    } else if (section === "branding") {
      items = await processBranding(access.serviceClient, dryRun)
    } else if (section === "site_page_assets") {
      items = await processSitePageAssets(access.serviceClient, limit, dryRun)
    } else if (section === "profile_avatars") {
      items = await processProfileAvatars(access.serviceClient, limit, dryRun)
    } else if (section === "support_attachments") {
      items = await processSupportAttachments(access.serviceClient, limit, dryRun)
    } else {
      throw badRequest("section invalida")
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      actor: access.actor,
      section,
      dry_run: dryRun,
      processed_count: items.length,
      items,
    })
  } catch (error) {
    return errorResponse(error, requestId)
  }
})
