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
    const { data: profile, error } = await serviceClient
      .from("profiles")
      .select("avatar_storage_bucket,avatar_storage_path,avatar_storage_provider")
      .eq("avatar_storage_path", storagePath)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!profile?.avatar_storage_bucket || !profile.avatar_storage_path) {
      throw notFound("Avatar publico nao encontrado")
    }

    const signedUrl = await createSignedReadUrl({
      serviceClient,
      logicalBucket: String(profile.avatar_storage_bucket),
      storagePath: String(profile.avatar_storage_path),
      provider: profile.avatar_storage_provider === "r2" ? "r2" : "supabase",
    })

    return redirectResponse(signedUrl)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Nao foi possivel abrir o avatar (${requestId})`

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
