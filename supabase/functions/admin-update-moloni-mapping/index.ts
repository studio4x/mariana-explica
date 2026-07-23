import { badRequest, conflict } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  assertAdminIntegrationRateLimit,
  extractRequestAuditContext,
  MoloniClient,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

type Environment = "test" | "live"

type Input =
  | { action: "status" }
  | {
      action: "catalog"
      moloniEnvironment: "draft" | "live"
      moloniCompanyId?: number | null
    }
  | {
      action: "update_settings"
      paymentEnvironment: Environment
      moloniEnvironment: "draft" | "live"
      emissionEnabled: boolean
      fiscalChecklistApproved: boolean
      documentKind: "invoice" | "invoice_receipt" | null
      refundDocumentKind?: "credit_note" | "payment_return" | null
      documentStatus: 0 | 1
      moloniCompanyId: number | null
      customerEmailFallbackEnabled: boolean
      customerWithoutVatRule?: string | null
      customerCountryId?: number | null
      customerLanguageId?: number | null
      customerMaturityDateId?: number | null
      customerPaymentMethodId?: number | null
      confirmation?: string
    }
  | {
      action: "upsert_mapping"
      paymentEnvironment: Environment
      productId: string
      moloniCompanyId: number
      moloniProductId: number
      moloniDocumentSetId: number
      moloniTaxId?: number | null
      taxValue?: number | null
      exemptionReason?: string | null
      eacId?: number | null
      moloniPaymentMethodId?: number | null
      isActive: boolean
    }

async function loadStatus(context: Awaited<ReturnType<typeof requireAdmin>>) {
  const [
    settingsResult,
    connectionsResult,
    mappingsResult,
    productsResult,
    documentsResult,
    jobsResult,
    adjustmentsResult,
  ] = await Promise.all([
    context.serviceClient.from("moloni_fiscal_settings").select("*").order("payment_environment"),
    context.serviceClient.from("moloni_connections").select("*").order("environment"),
    context.serviceClient.from("moloni_product_mappings").select("*").order("created_at"),
    context.serviceClient
      .from("products")
      .select("id,title,status,product_type")
      .in("product_type", ["paid", "hybrid"])
      .order("title"),
    context.serviceClient
      .from("fiscal_documents")
      .select("id,order_id,status,document_kind,environment,document_number,issued_at,last_error_code,last_error_message,updated_at")
      .order("created_at", { ascending: false })
      .limit(100),
    context.serviceClient
      .from("moloni_document_jobs")
      .select("id,fiscal_document_id,status,attempt_count,max_attempts,last_error_code,last_error,available_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100),
    context.serviceClient
      .from("fiscal_adjustment_requests")
      .select("id,order_id,adjustment_type,status,amount_cents,currency,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ])
  for (const result of [
    settingsResult,
    connectionsResult,
    mappingsResult,
    productsResult,
    documentsResult,
    jobsResult,
    adjustmentsResult,
  ]) {
    if (result.error) throw result.error
  }
  const jobs = jobsResult.data ?? []
  return {
    settings: settingsResult.data ?? [],
    connections: connectionsResult.data ?? [],
    mappings: mappingsResult.data ?? [],
    products: productsResult.data ?? [],
    documents: documentsResult.data ?? [],
    jobs,
    adjustments: adjustmentsResult.data ?? [],
    metrics: {
      pending: jobs.filter((job) => ["pending", "retry", "processing"].includes(job.status)).length,
      blocked: jobs.filter((job) => job.status === "blocked").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      issued: (documentsResult.data ?? []).filter((document) => document.status === "issued").length,
      adjustmentsRequiringReview: (adjustmentsResult.data ?? []).filter((item) => item.status === "requires_review").length,
    },
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()
  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")
    const context = await requireAdmin(req)
    await assertAdminIntegrationRateLimit(
      context.serviceClient,
      context.user.id,
      "moloni.admin_configuration",
      30,
    )
    const body = await readJsonBody<Input>(req)
    if (body.action === "status") {
      return jsonResponse({ success: true, request_id: requestId, ...(await loadStatus(context)) })
    }

    if (body.action === "catalog") {
      if (!["draft", "live"].includes(body.moloniEnvironment)) {
        throw badRequest("Ambiente Moloni inválido")
      }
      const moloni = new MoloniClient(context.serviceClient, body.moloniEnvironment)
      const companies = await moloni.getCompanies()
      if (!body.moloniCompanyId) {
        return jsonResponse({ success: true, request_id: requestId, companies })
      }
      if (!companies.some((company) => Number(company.company_id) === body.moloniCompanyId)) {
        throw conflict("Empresa Moloni não pertence à conexão autenticada.")
      }
      const [products, documentSets, taxes, paymentMethods] = await Promise.all([
        moloni.getProducts(body.moloniCompanyId),
        moloni.getDocumentSets(body.moloniCompanyId),
        moloni.getTaxes(body.moloniCompanyId),
        moloni.getPaymentMethods(body.moloniCompanyId),
      ])
      return jsonResponse({
        success: true,
        request_id: requestId,
        companies,
        products,
        document_sets: documentSets,
        taxes,
        payment_methods: paymentMethods,
      })
    }

    if (body.action === "update_settings") {
      if (!["test", "live"].includes(body.paymentEnvironment)) throw badRequest("Ambiente Stripe inválido")
      if (body.paymentEnvironment === "test" && (body.moloniEnvironment !== "draft" || body.documentStatus !== 0)) {
        throw conflict("Stripe test só pode usar Moloni em rascunho.")
      }
      if (body.emissionEnabled) {
        const expected = body.paymentEnvironment === "live"
          ? "ATIVAR_EMISSAO_FISCAL_LIVE"
          : "ATIVAR_HOMOLOGACAO_RASCUNHO"
        if (body.confirmation !== expected) {
          throw conflict("Confirmação explícita de ativação ausente.")
        }
      }
      if (
        body.moloniEnvironment === "live" &&
        (!body.fiscalChecklistApproved || body.documentStatus !== 1 || body.paymentEnvironment !== "live")
      ) {
        throw conflict("Moloni live exige checklist aprovado, Stripe live e documento fechado.")
      }
      const { data: settings, error } = await context.serviceClient
        .from("moloni_fiscal_settings")
        .upsert({
          payment_environment: body.paymentEnvironment,
          moloni_environment: body.moloniEnvironment,
          emission_enabled: body.emissionEnabled,
          fiscal_checklist_approved: body.fiscalChecklistApproved,
          document_kind: body.documentKind,
          refund_document_kind: body.refundDocumentKind ?? null,
          document_status: body.documentStatus,
          moloni_company_id: body.moloniCompanyId,
          customer_email_fallback_enabled: body.customerEmailFallbackEnabled,
          customer_without_vat_rule: body.customerWithoutVatRule?.trim() || null,
          customer_country_id: body.customerCountryId ?? null,
          customer_language_id: body.customerLanguageId ?? null,
          customer_maturity_date_id: body.customerMaturityDateId ?? null,
          customer_payment_method_id: body.customerPaymentMethodId ?? null,
          updated_by: context.user.id,
        }, { onConflict: "payment_environment" })
        .select("*")
        .single()
      if (error) throw error

      if (body.emissionEnabled) {
        const { data: blockedDocuments } = await context.serviceClient
          .from("fiscal_documents")
          .select("id,order_id")
          .eq("source_payment_environment", body.paymentEnvironment)
          .eq("status", "blocked_data")
          .eq("last_error_code", "FISCAL_CONFIGURATION_INCOMPLETE")
        for (const document of blockedDocuments ?? []) {
          await context.serviceClient.rpc("ensure_order_fiscal_outbox", { p_order_id: document.order_id })
          await context.serviceClient
            .from("fiscal_documents")
            .update({
              status: "pending",
              document_kind: body.documentKind,
              environment: body.moloniEnvironment,
              moloni_company_id: body.moloniCompanyId,
              last_error_code: null,
              last_error_message: null,
            })
            .eq("id", document.id)
          await context.serviceClient
            .from("moloni_document_jobs")
            .update({ status: "retry", available_at: new Date().toISOString(), last_error_code: null, last_error: null })
            .eq("fiscal_document_id", document.id)
            .eq("status", "blocked")
        }
      }
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_settings_updated",
        entityType: "moloni_fiscal_settings",
        metadata: {
          payment_environment: body.paymentEnvironment,
          moloni_environment: body.moloniEnvironment,
          emission_enabled: body.emissionEnabled,
          checklist_approved: body.fiscalChecklistApproved,
          document_kind: body.documentKind,
        },
        ...extractRequestAuditContext(req),
      })
      return jsonResponse({ success: true, request_id: requestId, settings })
    }

    if (body.action !== "upsert_mapping") throw badRequest("Ação inválida")
    if (
      !body.productId ||
      !Number.isInteger(body.moloniCompanyId) ||
      !Number.isInteger(body.moloniProductId) ||
      !Number.isInteger(body.moloniDocumentSetId)
    ) {
      throw badRequest("Mapeamento Moloni incompleto")
    }
    if (!body.moloniTaxId && !body.exemptionReason?.trim()) {
      throw badRequest("Informe taxa Moloni ou motivo de isenção aprovado")
    }

    const { data: settings, error: settingsError } = await context.serviceClient
      .from("moloni_fiscal_settings")
      .select("moloni_environment,moloni_company_id")
      .eq("payment_environment", body.paymentEnvironment)
      .single()
    if (settingsError) throw settingsError
    if (settings.moloni_company_id && settings.moloni_company_id !== body.moloniCompanyId) {
      throw conflict("A empresa do mapeamento diverge da configuração do ambiente.")
    }
    const moloni = new MoloniClient(context.serviceClient, settings.moloni_environment)
    const [remoteProduct, documentSets, taxes, paymentMethods] = await Promise.all([
      moloni.getProduct(body.moloniCompanyId, body.moloniProductId),
      moloni.getDocumentSets(body.moloniCompanyId),
      body.moloniTaxId ? moloni.getTaxes(body.moloniCompanyId) : Promise.resolve([]),
      body.moloniPaymentMethodId
        ? moloni.getPaymentMethods(body.moloniCompanyId)
        : Promise.resolve([]),
    ])
    if (Number(remoteProduct.product_id) !== body.moloniProductId) {
      throw conflict("Artigo Moloni não confirmado.")
    }
    if (!documentSets.some((item) => Number(item.document_set_id) === body.moloniDocumentSetId)) {
      throw conflict("Série Moloni não confirmada.")
    }
    if (body.moloniTaxId && !taxes.some((item) => Number(item.tax_id) === body.moloniTaxId)) {
      throw conflict("Taxa Moloni não confirmada.")
    }
    if (
      body.moloniPaymentMethodId &&
      !paymentMethods.some((item) => Number(item.payment_method_id) === body.moloniPaymentMethodId)
    ) {
      throw conflict("Método de pagamento Moloni não confirmado.")
    }
    const { data: mapping, error } = await context.serviceClient
      .from("moloni_product_mappings")
      .upsert({
        product_id: body.productId,
        payment_environment: body.paymentEnvironment,
        moloni_company_id: body.moloniCompanyId,
        moloni_product_id: body.moloniProductId,
        moloni_document_set_id: body.moloniDocumentSetId,
        moloni_tax_id: body.moloniTaxId ?? null,
        tax_value: body.taxValue ?? null,
        exemption_reason: body.exemptionReason?.trim() || null,
        eac_id: body.eacId ?? null,
        moloni_payment_method_id: body.moloniPaymentMethodId ?? null,
        is_active: body.isActive,
        created_by: context.user.id,
        updated_by: context.user.id,
      }, { onConflict: "product_id,payment_environment" })
      .select("*")
      .single()
    if (error) throw error
    await writeAuditLog(context.serviceClient, context, {
      action: "admin.moloni_product_mapping_updated",
      entityType: "product",
      entityId: body.productId,
      metadata: {
        payment_environment: body.paymentEnvironment,
        moloni_company_id: body.moloniCompanyId,
        moloni_product_id: body.moloniProductId,
        active: body.isActive,
      },
      ...extractRequestAuditContext(req),
    })
    return jsonResponse({ success: true, request_id: requestId, mapping })
  } catch (error) {
    logError("Moloni admin configuration failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
