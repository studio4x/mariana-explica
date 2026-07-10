import { badRequest, corsHeaders, corsResponse, createSignedReadUrl, createServiceClient, getRequestId, notFound } from "../_shared/mod.ts"

function redirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: url,
      "Cache-Control": "private, no-store",
    },
  })
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") return corsResponse()

  try {
    const url = new URL(req.url)
    const storagePath = decodeURIComponent(url.searchParams.get("storage_path")?.trim() ?? "")
    if (!storagePath) {
      throw badRequest("storage_path e obrigatorio")
    }

    const serviceClient = createServiceClient()

    const { data: legacyAsset, error: legacyError } = await serviceClient
      .from("site_page_assets")
      .select("bucket,path,storage_provider")
      .eq("path", storagePath)
      .maybeSingle()

    if (legacyError) {
      throw legacyError
    }

    let asset = legacyAsset

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
      const brandingCandidates = ["logo_light", "logo_dark", "favicon"]

      for (const candidate of brandingCandidates) {
        const item = configValue[candidate]
        const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : null
        if (!itemRecord) continue
        if (String(itemRecord.path ?? "").trim() !== storagePath) continue

        asset = {
          bucket: String(itemRecord.bucket ?? "site-branding-public"),
          path: storagePath,
          storage_provider: itemRecord.storage_provider === "r2" ? "r2" : "supabase",
        }
        break
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

    return redirectResponse(signedUrl)
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
