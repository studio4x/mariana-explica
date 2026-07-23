import { badRequest } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireAdmin } from "../_shared/mod.ts"

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireAdmin(req)

    const { data: orders, error } = await context.serviceClient
      .from("orders")
      .select(
        "id,user_id,product_id,status,currency,base_price_cents,discount_cents,final_price_cents,tax_amount_cents,total_paid_cents,stripe_invoice_id,payment_provider,payment_reference,checkout_session_id,payment_environment,paid_at,refunded_at,created_at",
      )
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    const userIds = [...new Set((orders ?? []).map((order) => order.user_id))]
    const productIds = [...new Set((orders ?? []).map((order) => order.product_id))]

    const [
      { data: users, error: usersError },
      { data: products, error: productsError },
      { data: fiscalDocuments, error: fiscalError },
    ] = await Promise.all([
      userIds.length
        ? context.serviceClient
            .from("profiles")
            .select("id,full_name,email")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? context.serviceClient
            .from("products")
            .select("id,title,product_type")
            .in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      context.serviceClient
        .from("fiscal_documents")
        .select("id,order_id,status,document_kind,environment,document_number,issued_at,last_error_code,last_error_message")
        .is("original_fiscal_document_id", null),
    ])

    if (usersError) {
      throw usersError
    }

    if (productsError) {
      throw productsError
    }
    if (fiscalError) {
      throw fiscalError
    }
    const fiscalDocumentIds = (fiscalDocuments ?? []).map((document) => document.id)
    const { data: fiscalJobs, error: fiscalJobsError } = fiscalDocumentIds.length
      ? await context.serviceClient
          .from("moloni_document_jobs")
          .select("id,fiscal_document_id,status,attempt_count,max_attempts,available_at,last_error_code,last_error")
          .in("fiscal_document_id", fiscalDocumentIds)
      : { data: [], error: null }
    if (fiscalJobsError) throw fiscalJobsError

    const userMap = new Map((users ?? []).map((user) => [user.id, user]))
    const productMap = new Map((products ?? []).map((product) => [product.id, product]))
    const fiscalJobMap = new Map((fiscalJobs ?? []).map((job) => [job.fiscal_document_id, job]))
    const fiscalMap = new Map((fiscalDocuments ?? []).map((document) => [
      document.order_id,
      { ...document, job: fiscalJobMap.get(document.id) ?? null },
    ]))

    const enrichedOrders = (orders ?? []).map((order) => ({
      ...order,
      user_name: userMap.get(order.user_id)?.full_name ?? null,
      user_email: userMap.get(order.user_id)?.email ?? null,
      product_title: productMap.get(order.product_id)?.title ?? null,
      product_type: productMap.get(order.product_id)?.product_type ?? null,
      fiscal_document: fiscalMap.get(order.id) ?? null,
    }))

    return jsonResponse({
      success: true,
      request_id: requestId,
      summary: {
        totalOrders: enrichedOrders.length,
        pendingCount: enrichedOrders.filter((order) => order.status === "pending").length,
        refundedCount: enrichedOrders.filter((order) => order.status === "refunded").length,
      },
      orders: enrichedOrders,
    })
  } catch (error) {
    logError("Admin orders view failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
