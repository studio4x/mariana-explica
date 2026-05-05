import {
  badRequest,
  corsResponse,
  createServiceClient,
  errorResponse,
  findOrderForCheckoutSession,
  getAppBaseUrl,
  getRequestId,
  jsonResponse,
  readJsonBody,
  unprocessable,
} from "../_shared/mod.ts"

interface CheckoutAutologinInput {
  checkout_session_id?: string
  product_id?: string | null
  next_path?: string | null
}

function isSafeInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
}

function normalizeNextPath(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  return isSafeInternalPath(trimmed) ? trimmed : fallback
}

function extractActionLink(data: unknown) {
  if (!data || typeof data !== "object") {
    return null
  }

  const properties = (data as { properties?: unknown }).properties
  if (!properties || typeof properties !== "object") {
    return null
  }

  const fromSnake = (properties as { action_link?: unknown }).action_link
  if (typeof fromSnake === "string" && fromSnake.trim()) {
    return fromSnake.trim()
  }

  const fromCamel = (properties as { actionLink?: unknown }).actionLink
  if (typeof fromCamel === "string" && fromCamel.trim()) {
    return fromCamel.trim()
  }

  return null
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const body = await readJsonBody<CheckoutAutologinInput>(req)
    const checkoutSessionId = body.checkout_session_id?.trim() ?? ""
    const requestedProductId = body.product_id?.trim() || null

    if (!checkoutSessionId.startsWith("cs_")) {
      throw badRequest("checkout_session_id invalido")
    }

    const serviceClient = createServiceClient()
    const order = await findOrderForCheckoutSession(serviceClient, checkoutSessionId)

    if (order.payment_provider !== "stripe") {
      throw badRequest("Pedido sem checkout Stripe")
    }

    if (requestedProductId && requestedProductId !== order.product_id) {
      throw badRequest("product_id nao corresponde ao pedido")
    }

    if (["failed", "cancelled", "refunded"].includes(order.status)) {
      throw unprocessable("Pedido sem acesso disponivel para login automatico")
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const fallbackNextPath = `/checkout/confirmacao?product_id=${encodeURIComponent(order.product_id)}&session_id=${encodeURIComponent(checkoutSessionId)}`
    const nextPath = normalizeNextPath(body.next_path, fallbackNextPath)
    const callbackUrl = new URL(`${getAppBaseUrl()}/auth/callback`)
    callbackUrl.searchParams.set("next", nextPath)

    const authUserResponse = await serviceClient.auth.admin.getUserById(order.user_id)
    if (authUserResponse.error) {
      throw authUserResponse.error
    }

    const userEmail = profile?.email ?? authUserResponse.data.user?.email ?? null
    if (!userEmail) {
      throw badRequest("Nao foi possivel identificar o email da conta")
    }

    const { data: generatedLink, error: generatedLinkError } = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (generatedLinkError) {
      throw generatedLinkError
    }

    const autologinUrl = extractActionLink(generatedLink)
    if (!autologinUrl) {
      throw badRequest("Nao foi possivel gerar o link de acesso automatico")
    }

    return jsonResponse({
      success: true,
      request_id: requestId,
      autologin_url: autologinUrl,
    })
  } catch (error) {
    return errorResponse(error, requestId)
  }
})
