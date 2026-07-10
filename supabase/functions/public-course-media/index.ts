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
    const { data: product, error } = await serviceClient
      .from("products")
      .select("cover_image_storage_bucket,cover_image_storage_path,cover_image_storage_provider")
      .eq("cover_image_storage_path", storagePath)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!product?.cover_image_storage_bucket || !product.cover_image_storage_path) {
      throw notFound("Midia publica do curso nao encontrada")
    }

    const signedUrl = await createSignedReadUrl({
      serviceClient,
      logicalBucket: String(product.cover_image_storage_bucket),
      storagePath: String(product.cover_image_storage_path),
      provider: product.cover_image_storage_provider === "r2" ? "r2" : "supabase",
    })

    return redirectResponse(signedUrl)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Nao foi possivel abrir a midia do curso (${requestId})`

    return new Response(message, {
      status: message.toLowerCase().includes("nao encontrada") ? 404 : 400,
      headers: {
        ...corsHeaders,
        "Cache-Control": "private, no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  }
})
