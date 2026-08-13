import { badRequest, corsHeaders, corsResponse, createSignedReadUrl, createServiceClient, getRequestId, notFound } from "../_shared/mod.ts"

async function proxyAssetResponse(url: string, method: "GET" | "HEAD") {
  // Always read the complete object upstream. Some R2/S3 signed URLs reject
  // HEAD even though GET is valid; Meta uses HEAD while validating og:image.
  // We still return an empty body to the caller for HEAD below.
  const upstream = await fetch(url)

  if (!upstream.ok) {
    throw new Error(`Falha ao ler asset publico (${upstream.status})`)
  }

  const headers = new Headers(corsHeaders)
  for (const headerName of ["content-type", "content-length", "etag", "last-modified"]) {
    const value = upstream.headers.get(headerName)
    if (value) headers.set(headerName, value)
  }
  headers.set("Cache-Control", "public, max-age=300, s-maxage=3600")
  headers.set("X-Content-Type-Options", "nosniff")

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: 200,
    headers,
  })
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Metodo nao permitido", {
      status: 405,
      headers: { ...corsHeaders, Allow: "GET, HEAD, OPTIONS", "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  try {
    const url = new URL(req.url)
    let storagePath = decodeURIComponent(url.searchParams.get("storage_path")?.trim() ?? "")
    const brandingRole = url.searchParams.get("branding_role")?.trim() ?? ""
    if (!storagePath && brandingRole !== "favicon") {
      throw badRequest("storage_path e obrigatorio")
    }

    const serviceClient = createServiceClient()

    let asset: { bucket: string; path: string; storage_provider: string | null } | null = null

    if (storagePath) {
      const { data: legacyAsset, error: legacyError } = await serviceClient
        .from("site_page_assets")
        .select("bucket,path,storage_provider")
        .eq("path", storagePath)
        .maybeSingle()

      if (legacyError) {
        throw legacyError
      }

      asset = legacyAsset

      if (!asset) {
        const visualAssetResult = await serviceClient
          .from("visual_site_page_assets")
          .select("bucket,path,storage_provider")
          .eq("path", storagePath)
          .maybeSingle()

        if (visualAssetResult.error) {
          throw visualAssetResult.error
        }

        asset = visualAssetResult.data
      }
    }

    if (!asset) {
      const brandingConfigResult = await serviceClient
        .from("site_config")
        .select("config_value")
        .eq("config_key", "site_branding")
        .maybeSingle()

      if (brandingConfigResult.error) {
        throw brandingConfigResult.error
      }

      const configValue =
        brandingConfigResult.data?.config_value && typeof brandingConfigResult.data.config_value === "object"
          ? (brandingConfigResult.data.config_value as Record<string, unknown>)
          : {}
      const brandingCandidates = brandingRole === "favicon" ? ["favicon"] : ["logo_light", "logo_dark", "favicon"]

      for (const candidate of brandingCandidates) {
        const item = configValue[candidate]
        const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : null
        if (!itemRecord) continue
        const candidatePath = String(itemRecord.path ?? "").trim()
        if (!candidatePath || (storagePath && candidatePath !== storagePath)) continue

        storagePath = candidatePath

        asset = {
          bucket: String(itemRecord.bucket ?? "site-branding-public"),
          path: storagePath,
          storage_provider: itemRecord.storage_provider === "r2" ? "r2" : "supabase",
        }
        break
      }
    }

    if (!asset && /^(logo_light|logo_dark|favicon)\//.test(storagePath)) {
      asset = {
        bucket: "site-branding-public",
        path: storagePath,
        storage_provider: "r2",
      }
    }

    if (!asset?.bucket || !asset.path) {
      throw notFound("Asset publico nao encontrado")
    }

    const signedUrl = await createSignedReadUrl({
      serviceClient,
      logicalBucket: String(asset.bucket),
      storagePath: String(asset.path),
      provider: asset.storage_provider === "r2" ? "r2" : "supabase",
    })

    return await proxyAssetResponse(signedUrl, req.method)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Nao foi possivel abrir o asset publico (${requestId})`

    return new Response(message, {
      status: message.toLowerCase().includes("nao encontrado") ? 404 : 400,
      headers: {
        ...corsHeaders,
        "Cache-Control": "private, no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  }
})
