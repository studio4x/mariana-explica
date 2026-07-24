import { badRequest, conflict } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  assertAdminIntegrationRateLimit,
  extractRequestAuditContext,
  findInvalidMoloniCustomerReferences,
  MoloniClient,
  type MoloniCountry,
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

function remoteLabel(item: Record<string, unknown> | undefined, fallback: string) {
  const value = item?.name ?? item?.title ?? item?.reference
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 250) : fallback
}

function sanitizeCountries(countries: MoloniCountry[]) {
  return countries.map((country) => ({
    country_id: Number(country.country_id),
    iso_3166_1: String(country.iso_3166_1 ?? "").toUpperCase(),
    name: country.name?.trim() || country.languages?.find((language) => language.name?.trim())?.name?.trim(),
  }))
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
      if (
        body.moloniCompanyId !== undefined &&
        body.moloniCompanyId !== null &&
        (!Number.isInteger(body.moloniCompanyId) || body.moloniCompanyId <= 0)
      ) {
        throw badRequest("Empresa Moloni inválida")
      }
      const moloni = new MoloniClient(context.serviceClient, body.moloniEnvironment)
      const companies = await moloni.getCompanies()
      const [countries, languages] = await Promise.all([
        moloni.getCountries(),
        moloni.getLanguages(),
      ])
      if (!body.moloniCompanyId) {
        return jsonResponse({
          success: true,
          request_id: requestId,
          companies,
          countries: sanitizeCountries(countries),
          languages,
          maturity_dates: [],
        })
      }
      if (!companies.some((company) => Number(company.company_id) === body.moloniCompanyId)) {
        throw conflict("Empresa Moloni não pertence à conexão autenticada.")
      }
      const [products, documentSets, taxes, paymentMethods, maturityDates] = await Promise.all([
        moloni.getProducts(body.moloniCompanyId),
        moloni.getDocumentSets(body.moloniCompanyId),
        moloni.getTaxes(body.moloniCompanyId),
        moloni.getPaymentMethods(body.moloniCompanyId),
        moloni.getMaturityDates(body.moloniCompanyId),
      ])
      return jsonResponse({
        success: true,
        request_id: requestId,
        companies,
        countries: sanitizeCountries(countries),
        languages,
        maturity_dates: maturityDates,
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
      if (
        body.moloniCompanyId !== null &&
        (!Number.isInteger(body.moloniCompanyId) || body.moloniCompanyId <= 0)
      ) {
        throw badRequest("Empresa Moloni invalida")
      }
      for (const [label, value] of [
        ["país", body.customerCountryId],
        ["idioma", body.customerLanguageId],
        ["vencimento", body.customerMaturityDateId],
      ] as const) {
        if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) {
          throw badRequest(`${label[0].toUpperCase()}${label.slice(1)} Moloni invalido`)
        }
      }
      const moloni = new MoloniClient(context.serviceClient, body.moloniEnvironment)
      if (body.moloniCompanyId) {
        const companies = await moloni.getCompanies()
        if (!companies.some((company) => Number(company.company_id) === body.moloniCompanyId)) {
          throw conflict("Empresa Moloni selecionada nao existe na conexao autenticada.")
        }
      }
      const invalidCustomerReference = await findInvalidMoloniCustomerReferences(moloni, {
        companyId: body.moloniCompanyId,
        countryId: body.customerCountryId ?? null,
        languageId: body.customerLanguageId ?? null,
        maturityDateId: body.customerMaturityDateId ?? null,
      })
      if (invalidCustomerReference) throw conflict(invalidCustomerReference)
      if (body.emissionEnabled) {
        throw conflict("Use o fluxo dedicado de ativação com validação integral.")
      }
      const { data: currentSettings, error: currentSettingsError } = await context.serviceClient
        .from("moloni_fiscal_settings")
        .select("emission_enabled")
        .eq("payment_environment", body.paymentEnvironment)
        .maybeSingle()
      if (currentSettingsError) throw currentSettingsError
      if (currentSettings?.emission_enabled) {
        throw conflict("Desative a emissão Moloni antes de alterar a configuração fiscal.")
      }
      const { data: checklistApproved, error: checklistError } = await context.serviceClient
        .rpc("refresh_moloni_checklist_approval", {
          p_payment_environment: body.paymentEnvironment,
        })
      if (checklistError) throw checklistError
      if (
        body.moloniEnvironment === "live" &&
        (body.documentStatus !== 1 || body.paymentEnvironment !== "live")
      ) {
        throw conflict("Moloni live exige Stripe live e documento fechado.")
      }
      const { data: settings, error } = await context.serviceClient
        .from("moloni_fiscal_settings")
        .upsert({
          payment_environment: body.paymentEnvironment,
          moloni_environment: body.moloniEnvironment,
          emission_enabled: false,
          fiscal_checklist_approved: Boolean(checklistApproved),
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
      const { error: validationDeleteError } = await context.serviceClient
        .from("moloni_validation_runs")
        .delete()
        .eq("payment_environment", body.paymentEnvironment)
        .in("validation_type", [
          "company",
          "document_sets",
          "products",
          "taxes",
          "payment_method",
          "mappings",
        ])
      if (validationDeleteError) throw validationDeleteError

      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_settings_updated",
        entityType: "moloni_fiscal_settings",
        metadata: {
          payment_environment: body.paymentEnvironment,
          moloni_environment: body.moloniEnvironment,
          emission_enabled: false,
          checklist_approved: Boolean(checklistApproved),
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
    const remoteDocumentSet = documentSets.find((item) =>
      Number(item.document_set_id) === body.moloniDocumentSetId
    )
    const remoteTax = taxes.find((item) => Number(item.tax_id) === body.moloniTaxId)
    const remotePaymentMethod = paymentMethods.find((item) =>
      Number(item.payment_method_id) === body.moloniPaymentMethodId
    )
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
        moloni_product_name: remoteLabel(remoteProduct, `Artigo ${body.moloniProductId}`),
        moloni_document_set_name: remoteLabel(remoteDocumentSet, `Série ${body.moloniDocumentSetId}`),
        moloni_tax_name: body.moloniTaxId
          ? remoteLabel(remoteTax, `Taxa ${body.moloniTaxId}`)
          : null,
        moloni_payment_method_name: body.moloniPaymentMethodId
          ? remoteLabel(remotePaymentMethod, `Método ${body.moloniPaymentMethodId}`)
          : null,
        is_active: body.isActive,
        created_by: context.user.id,
        updated_by: context.user.id,
      }, { onConflict: "product_id,payment_environment" })
      .select("*")
      .single()
    if (error) throw error
    const { error: validationDeleteError } = await context.serviceClient
      .from("moloni_validation_runs")
      .delete()
      .eq("payment_environment", body.paymentEnvironment)
      .eq("validation_type", "mappings")
    if (validationDeleteError) throw validationDeleteError
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
