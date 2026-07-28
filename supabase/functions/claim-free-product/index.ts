import {
  assertPaidProduct,
  buildFreeProductClaimedEmail,
  calculateOrderTotals,
  createOrderWithItems,
  ensureActiveGrant,
  extractRequestAuditContext,
  findActiveGrantForProduct,
  getProductByIdentifier,
  queueEmailDelivery,
  queueBrevoContactSync,
  writeAuditLog,
} from "../_shared/mod.ts"
import { badRequest, internalError, unprocessable } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getAccessToken,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/auth.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { HttpError } from "../_shared/errors.ts"

interface ClaimFreeProductInput {
  productId?: string
  productSlug?: string
  pendingUserId?: string | null
  contentUpdatesConsent?: boolean
}

async function waitForProfileById(serviceClient: ReturnType<typeof createServiceClient>, userId: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id,full_name,email,nif,role,is_admin,status,content_updates_consent")
      .eq("id", userId)
      .maybeSingle()

    if (!error && data) {
      return data as {
        id: string
        full_name: string | null
        email: string | null
        nif: string | null
        role: "student" | "affiliate" | "admin"
        is_admin: boolean
        status: "active" | "inactive" | "blocked" | "pending_review"
        content_updates_consent: boolean
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  return null
}

async function resolveClaimContext(req: Request, pendingUserId: string | null) {
  const accessToken = await getAccessToken(req)

  if (accessToken) {
    try {
      return await requireActiveUser(req)
    } catch (error) {
      if (!pendingUserId) {
        throw error
      }

      if (!(error instanceof HttpError) || error.status !== 401) {
        throw error
      }
    }
  }

  if (!pendingUserId) {
    return null
  }

  const serviceClient = createServiceClient()
  const { data: authUserData, error: authUserError } = await serviceClient.auth.admin.getUserById(pendingUserId)
  if (authUserError) throw authUserError

  const user = authUserData.user
  if (!user) throw badRequest("Utilizador pendente nao encontrado")

  const profile = await waitForProfileById(serviceClient, pendingUserId)
  if (!profile) throw badRequest("Perfil pendente nao encontrado")

  return { user, profile, serviceClient, token: "" }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Método não suportado")
    }

    const body = await readJsonBody<ClaimFreeProductInput>(req)
    const identifier = body.productId ?? body.productSlug
    const pendingUserId = body.pendingUserId?.trim() || null

    if (!identifier) {
      throw badRequest("Informe productId ou productSlug")
    }

    const context = await resolveClaimContext(req, pendingUserId)

    if (!context) {
      throw badRequest("Sessao ausente. Cria a conta para continuar.")
    }

    const contentUpdatesConsent = body.contentUpdatesConsent === true || context.profile.content_updates_consent === true
    if (contentUpdatesConsent && !context.profile.content_updates_consent) {
      const { error: consentError } = await context.serviceClient
        .from("profiles")
        .update({
          content_updates_consent: true,
          content_updates_consent_at: new Date().toISOString(),
          content_updates_consent_source: "claim-free-product",
          content_updates_consent_evidence: { flow: "claim-free-product", request_id: requestId, explicit_checkbox: true },
        })
        .eq("id", context.user.id)
      if (consentError) throw consentError
    }

    const product = await getProductByIdentifier(context.serviceClient, identifier)
    assertPaidProduct(product)

    if (product.product_type !== "free") {
      throw badRequest("Somente produtos gratuitos podem ser reivindicados aqui")
    }

    const existingGrant = await findActiveGrantForProduct(context.serviceClient, {
      userId: context.user.id,
      productId: product.id,
    })
    if (existingGrant) {
      throw unprocessable("VocÃª jÃ¡ ativou este produto")
    }

    const totals = calculateOrderTotals(product.price_cents, 0)
    const order = await createOrderWithItems(context.serviceClient, {
      userId: context.user.id,
      product,
      totals,
      paymentProvider: "internal",
      paymentReference: `free:${crypto.randomUUID()}`,
      status: "paid",
      paidAt: new Date().toISOString(),
    })

    const grant = await ensureActiveGrant(context.serviceClient, {
      userId: context.user.id,
      productId: product.id,
      sourceType: "free_claim",
      sourceOrderId: order.id,
    })

    const { data: notification, error: notificationError } = await context.serviceClient
      .from("notifications")
      .insert({
        user_id: context.user.id,
        type: "transactional",
        title: "Produto gratuito ativado",
        message: `O produto "${product.title}" ja esta disponivel na tua area do aluno.`,
        link: "/aluno/cursos",
        status: "unread",
        sent_via_email: Boolean(context.profile.email),
        sent_via_in_app: true,
      })
      .select("id")
      .single()

    if (notificationError) {
      throw notificationError
    }

    if (context.profile.email) {
      const email = await buildFreeProductClaimedEmail(context.serviceClient, {
        fullName: context.profile.full_name,
        productTitle: product.title,
        productType: product.product_type,
        dashboardUrl: "/aluno/cursos",
      })

      await queueEmailDelivery(context.serviceClient, {
        userId: context.user.id,
        notificationId: notification.id,
        emailTo: context.profile.email,
        templateKey: "free_product_claimed",
        subject: email.subject,
        html: email.html,
        text: email.text,
        metadata: {
          order_id: order.id,
          product_id: product.id,
        },
      })

      if (contentUpdatesConsent) {
        try {
          await queueBrevoContactSync(context.serviceClient, {
            userId: context.user.id,
            email: context.profile.email,
            fullName: context.profile.full_name,
            nif: context.profile.nif,
            product: product.title,
            productId: product.id,
            orderId: order.id,
            source: "free_checkout",
            consentEvidence: { flow: "claim-free-product", request_id: requestId, explicit_checkbox: true },
          })
        } catch (brevoError) {
          logError("Free checkout Brevo contact queue failed", {
            request_id: requestId,
            user_id: context.user.id,
            error: String(brevoError),
          })
        }
      }
    }

    logInfo("Free product claimed", {
      request_id: requestId,
      user_id: context.user.id,
      product_id: product.id,
      order_id: order.id,
      grant_id: grant.grant.id,
    })

    await writeAuditLog(
      context.serviceClient,
      context,
      {
        action: "product.free_claimed",
        entityType: "order",
        entityId: order.id,
        metadata: {
          product_id: product.id,
          grant_id: grant.grant.id,
        },
        ...extractRequestAuditContext(req),
      },
    )

    return jsonResponse({
      success: true,
      request_id: requestId,
      order_id: order.id,
      grant_id: grant.grant.id,
      mode: "free_claim",
    })
  } catch (error) {
    logError("Free product claim failed", { request_id: requestId, error: String(error) })

    if (error instanceof Error && error.message.includes("STRIPE_SECRET_KEY")) {
      return errorResponse(internalError("Integração Stripe não configurada"), requestId)
    }

    return errorResponse(error, requestId)
  }
})
