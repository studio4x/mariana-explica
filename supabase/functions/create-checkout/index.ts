import {
  assertPaidProduct,
  calculateAffiliateCommission,
  calculateCouponDiscount,
  calculateOrderTotals,
  countCouponUsagesByUser,
  createOrderWithItems,
  ensureActiveGrant,
  extractRequestAuditContext,
  findActiveGrantForProduct,
  getAppBaseUrl,
  getProductByIdentifier,
  markOrderFailed,
  recordAffiliateReferral,
  recordCouponUsage,
  resolveAffiliateByCode,
  resolveCouponByCode,
  writeAuditLog,
} from "../_shared/mod.ts"
import { badRequest, internalError, unprocessable } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError, logInfo } from "../_shared/logger.ts"
import {
  createStripeCheckoutSession,
  getStripeCheckoutSession,
  resolveCheckoutEnvironment,
} from "../_shared/payments.ts"
import { requireActiveUser } from "../_shared/auth.ts"

interface CreateCheckoutInput {
  productId?: string
  productSlug?: string
  couponCode?: string | null
  affiliateCode?: string | null
  successUrl?: string | null
  cancelUrl?: string | null
}

const STRIPE_MINIMUM_AMOUNT_CENTS: Record<string, number> = {
  eur: 50,
  usd: 50,
  gbp: 30,
  brl: 50,
}

function buildFallbackSuccessUrl() {
  return `${getAppBaseUrl()}/aluno/dashboard?checkout=success`
}

function buildFallbackCancelUrl(productSlug: string) {
  return `${getAppBaseUrl()}/cursos/${productSlug}?checkout=cancelled`
}

function assertStripeMinimumAmount(currency: string, amountCents: number) {
  const currencyKey = currency.trim().toLowerCase()
  const minimum = STRIPE_MINIMUM_AMOUNT_CENTS[currencyKey] ?? 50

  if (amountCents > 0 && amountCents < minimum) {
    const formattedMinimum = (minimum / 100).toLocaleString("pt-PT", {
      style: "currency",
      currency: currency.toUpperCase(),
    })

    throw unprocessable(
      `O valor minimo para pagamento Stripe em ${currency.toUpperCase()} e ${formattedMinimum}. Ajuste o preco do curso ou marque como gratuito.`,
    )
  }
}

async function findReusablePendingCheckout(
  client: Awaited<ReturnType<typeof requireActiveUser>>["serviceClient"],
  params: {
    userId: string
    productId: string
    currency: string
    finalPriceCents: number
    paymentEnvironment: "test" | "live"
  },
) {
  const createdAfter = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from("orders")
    .select("id,checkout_session_id,payment_environment,final_price_cents,currency,created_at")
    .eq("user_id", params.userId)
    .eq("product_id", params.productId)
    .eq("status", "pending")
    .eq("payment_provider", "stripe")
    .eq("payment_environment", params.paymentEnvironment)
    .eq("final_price_cents", params.finalPriceCents)
    .eq("currency", params.currency)
    .not("checkout_session_id", "is", null)
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.checkout_session_id) {
    return null
  }

  return data as {
    id: string
    checkout_session_id: string
    payment_environment: "test" | "live"
    final_price_cents: number
    currency: string
  }
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

    const context = await requireActiveUser(req)
    const body = await readJsonBody<CreateCheckoutInput>(req)
    const identifier = body.productId ?? body.productSlug

    if (!identifier) {
      throw badRequest("Informe productId ou productSlug")
    }

    const product = await getProductByIdentifier(context.serviceClient, identifier)
    assertPaidProduct(product)

    const existingGrant = await findActiveGrantForProduct(context.serviceClient, {
      userId: context.user.id,
      productId: product.id,
    })
    if (existingGrant) {
      throw unprocessable("VocÃª jÃ¡ possui acesso ativo a este produto")
    }

    if (body.affiliateCode && !product.allow_affiliate) {
      throw unprocessable("Este produto não aceita afiliados")
    }

    const coupon = await resolveCouponByCode(context.serviceClient, body.couponCode)
    if (body.couponCode && !coupon) {
      throw badRequest("Cupom não encontrado")
    }

    const affiliate = await resolveAffiliateByCode(context.serviceClient, body.affiliateCode)
    if (body.affiliateCode && !affiliate) {
      throw badRequest("Afiliado não encontrado")
    }

    if (coupon) {
      const couponUsageCount = await countCouponUsagesByUser(
        context.serviceClient,
        coupon.id,
        context.user.id,
      )

      if (coupon.max_uses_per_user !== null && couponUsageCount >= coupon.max_uses_per_user) {
        throw unprocessable("Limite de uso por usuário atingido")
      }
    }

    const discountCents = coupon
      ? calculateCouponDiscount(product.price_cents, coupon)
      : 0
    const totals = calculateOrderTotals(product.price_cents, discountCents)
    const isFreeOrder = totals.finalPriceCents === 0 || product.product_type === "free"

    if (isFreeOrder) {
      const order = await createOrderWithItems(context.serviceClient, {
        userId: context.user.id,
        product,
        totals,
        couponId: coupon?.id ?? null,
        affiliateId: affiliate?.id ?? null,
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

      if (coupon) {
        await recordCouponUsage(context.serviceClient, {
          couponId: coupon.id,
          userId: context.user.id,
          orderId: order.id,
          discountCents: totals.discountCents,
        })
      }

      if (affiliate) {
        await recordAffiliateReferral(context.serviceClient, {
          affiliateId: affiliate.id,
          userId: context.user.id,
          productId: product.id,
          orderId: order.id,
          referralCode: affiliate.affiliate_code,
          commissionCents: calculateAffiliateCommission(affiliate, totals.finalPriceCents),
        })
      }

      logInfo("Free checkout completed", {
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
          action: "checkout.free_completed",
          entityType: "order",
          entityId: order.id,
          metadata: {
            product_id: product.id,
            grant_id: grant.grant.id,
            coupon_id: coupon?.id ?? null,
            affiliate_id: affiliate?.id ?? null,
          },
          ...extractRequestAuditContext(req),
        },
      )

      return jsonResponse({
        success: true,
        request_id: requestId,
        mode: "free",
        order_id: order.id,
        grant_id: grant.grant.id,
        final_price_cents: totals.finalPriceCents,
        currency: product.currency,
      })
    }

    assertStripeMinimumAmount(product.currency, totals.finalPriceCents)

    const stripeMode = await resolveCheckoutEnvironment(context.serviceClient)
    const reusableOrder = await findReusablePendingCheckout(context.serviceClient, {
      userId: context.user.id,
      productId: product.id,
      currency: product.currency,
      finalPriceCents: totals.finalPriceCents,
      paymentEnvironment: stripeMode,
    })

    if (reusableOrder) {
      try {
        const existingSession = await getStripeCheckoutSession(reusableOrder.checkout_session_id, {
          mode: stripeMode,
        })

        if (existingSession.url && existingSession.status === "open") {
          logInfo("Reusing pending checkout session", {
            request_id: requestId,
            user_id: context.user.id,
            product_id: product.id,
            order_id: reusableOrder.id,
            checkout_session_id: reusableOrder.checkout_session_id,
            payment_environment: stripeMode,
            stripe_livemode: existingSession.livemode,
          })

          return jsonResponse({
            success: true,
            request_id: requestId,
            mode: "stripe",
            order_id: reusableOrder.id,
            checkout_session_id: reusableOrder.checkout_session_id,
            checkout_url: existingSession.url,
            payment_environment: stripeMode,
            stripe_livemode: existingSession.livemode,
            final_price_cents: totals.finalPriceCents,
            currency: product.currency,
          })
        }
      } catch (reuseError) {
        logError("Reusable checkout lookup failed", {
          request_id: requestId,
          user_id: context.user.id,
          product_id: product.id,
          order_id: reusableOrder.id,
          error: String(reuseError),
        })
      }
    }

    const order = await createOrderWithItems(context.serviceClient, {
      userId: context.user.id,
      product,
      totals,
      couponId: coupon?.id ?? null,
      affiliateId: affiliate?.id ?? null,
      paymentProvider: "stripe",
      paymentEnvironment: stripeMode,
    })

    let session: Awaited<ReturnType<typeof createStripeCheckoutSession>>
    try {
      session = await createStripeCheckoutSession({
        success_url: body.successUrl ?? buildFallbackSuccessUrl(),
        cancel_url: body.cancelUrl ?? buildFallbackCancelUrl(product.slug),
        client_reference_id: order.id,
        metadata: {
          order_id: order.id,
          user_id: context.user.id,
          product_id: product.id,
          payment_environment: stripeMode,
          coupon_id: coupon?.id ?? "",
          affiliate_id: affiliate?.id ?? "",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: product.currency,
              unit_amount: totals.finalPriceCents,
              product_data: {
                name: product.title,
                description: product.short_description ?? product.description ?? undefined,
              },
            },
          },
        ],
      }, { mode: stripeMode })
    } catch (stripeError) {
      await markOrderFailed(context.serviceClient, {
        orderId: order.id,
        paymentReference: `stripe_session_failed:${crypto.randomUUID()}`,
      })

      logError("Stripe checkout session failed", {
        request_id: requestId,
        user_id: context.user.id,
        product_id: product.id,
        order_id: order.id,
        error: String(stripeError),
      })

      throw unprocessable("Nao foi possivel iniciar o pagamento na Stripe. Verifique a configuracao do checkout e tente novamente.")
    }

    const { error: updateError } = await context.serviceClient
      .from("orders")
      .update({
        checkout_session_id: session.id,
        payment_reference: session.id,
      })
      .eq("id", order.id)

    if (updateError) {
      throw updateError
    }

    logInfo("Checkout session created", {
      request_id: requestId,
      user_id: context.user.id,
      product_id: product.id,
      order_id: order.id,
      checkout_session_id: session.id,
      payment_environment: stripeMode,
      stripe_livemode: session.livemode,
    })

    await writeAuditLog(
      context.serviceClient,
      context,
      {
        action: "checkout.session_created",
        entityType: "order",
        entityId: order.id,
        metadata: {
          product_id: product.id,
          checkout_session_id: session.id,
          coupon_id: coupon?.id ?? null,
          affiliate_id: affiliate?.id ?? null,
          final_price_cents: totals.finalPriceCents,
          payment_environment: stripeMode,
          stripe_livemode: session.livemode,
        },
        ...extractRequestAuditContext(req),
      },
    )

    return jsonResponse({
      success: true,
      request_id: requestId,
      mode: "stripe",
      order_id: order.id,
      checkout_session_id: session.id,
      checkout_url: session.url,
      payment_environment: stripeMode,
      stripe_livemode: session.livemode,
      final_price_cents: totals.finalPriceCents,
      currency: product.currency,
    })
  } catch (error) {
    logError("Checkout failed", { request_id: requestId, error: String(error) })

    if (error instanceof Error && error.message.includes("STRIPE_SECRET_KEY")) {
      return errorResponse(internalError("Integração Stripe não configurada"), requestId)
    }

    return errorResponse(error, requestId)
  }
})
