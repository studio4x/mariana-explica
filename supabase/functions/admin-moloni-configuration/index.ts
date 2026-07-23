import { badRequest, conflict, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  assertAdminIntegrationRateLimit,
  buildMoloniAuthorizationUrl,
  extractRequestAuditContext,
  getMissingMoloniActivationRequirements,
  getMoloniAppCredentialStatus,
  hasApprovedChecklistItem,
  isDraftHomologationConfirmation,
  isStrongMoloniActivationConfirmation,
  minimalBuyerLabel,
  MoloniClient,
  processMoloniDocumentJob,
  requireAdmin,
  storeMoloniAppConfiguration,
  writeAuditLog,
} from "../_shared/mod.ts"

type PaymentEnvironment = "test" | "live"
type ValidationType =
  | "credentials"
  | "oauth"
  | "company"
  | "document_sets"
  | "products"
  | "taxes"
  | "payment_method"
  | "mappings"

type Input =
  | { action: "overview" }
  | { action: "save_credentials"; clientId?: string; clientSecret?: string }
  | {
      action: "update_checklist"
      paymentEnvironment: PaymentEnvironment
      itemKey: string
      status: "pending" | "filled" | "approved"
      configuration?: unknown
      notes?: string | null
      confirmation?: string
    }
  | {
      action: "run_validation"
      paymentEnvironment: PaymentEnvironment
      validationType: ValidationType
    }
  | {
      action: "create_draft_test"
      fiscalDocumentId: string
      confirmation: string
    }
  | {
      action: "activate"
      paymentEnvironment: "live"
      confirmation: string
    }
  | {
      action: "deactivate"
      paymentEnvironment: PaymentEnvironment
      confirmation: string
    }

interface ValidationRow {
  id: string
  payment_environment: PaymentEnvironment
  validation_type: string
  status: "passed" | "failed"
  summary: string
  details: Record<string, unknown>
  created_at: string
}

function assertPaymentEnvironment(value: unknown): asserts value is PaymentEnvironment {
  if (value !== "test" && value !== "live") throw badRequest("Ambiente de pagamento inválido")
}

function safeMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 250)
  return "A validação não foi concluída."
}

function latestValidation(
  validations: ValidationRow[],
  paymentEnvironment: PaymentEnvironment,
  type: string,
) {
  return validations.find((item) =>
    item.payment_environment === paymentEnvironment && item.validation_type === type
  ) ?? null
}

function validationMatchesCompany(validation: ValidationRow | null, companyId: number | null) {
  return Boolean(
    validation?.status === "passed" &&
      companyId &&
      Number(validation.details?.company_id) === companyId,
  )
}

async function recordValidation(
  context: Awaited<ReturnType<typeof requireAdmin>>,
  input: {
    paymentEnvironment: PaymentEnvironment
    validationType: ValidationType | "draft_document"
    status: "passed" | "failed"
    summary: string
    details?: Record<string, unknown>
  },
) {
  const { data, error } = await context.serviceClient
    .from("moloni_validation_runs")
    .insert({
      payment_environment: input.paymentEnvironment,
      validation_type: input.validationType,
      status: input.status,
      summary: input.summary.slice(0, 300),
      details: input.details ?? {},
      created_by: context.user.id,
    })
    .select("*")
    .single()
  if (error) throw error
  return data as ValidationRow
}

async function loadCoreState(context: Awaited<ReturnType<typeof requireAdmin>>) {
  const [
    credentials,
    settingsResult,
    connectionsResult,
    checklistResult,
    validationsResult,
    activationEventsResult,
    mappingsResult,
    productsResult,
    documentsResult,
    jobsResult,
    adjustmentsResult,
    paidOrdersResult,
  ] = await Promise.all([
    getMoloniAppCredentialStatus(context.serviceClient),
    context.serviceClient.from("moloni_fiscal_settings").select("*").order("payment_environment"),
    context.serviceClient.from("moloni_connections").select("*").order("environment"),
    context.serviceClient
      .from("moloni_fiscal_checklist_items")
      .select("*")
      .order("payment_environment")
      .order("created_at"),
    context.serviceClient
      .from("moloni_validation_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    context.serviceClient
      .from("moloni_activation_events")
      .select("id,payment_environment,action,configuration_snapshot,actor_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    context.serviceClient.from("moloni_product_mappings").select("*").order("updated_at", { ascending: false }),
    context.serviceClient
      .from("products")
      .select("id,title,status,product_type")
      .in("product_type", ["paid", "hybrid"])
      .order("title"),
    context.serviceClient
      .from("fiscal_documents")
      .select(
        "id,order_id,user_id,status,document_kind,environment,source_payment_environment,document_number,moloni_document_id,total_amount_cents,currency,issued_at,last_error_code,last_error_message,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    context.serviceClient
      .from("moloni_document_jobs")
      .select(
        "id,fiscal_document_id,job_type,status,attempt_count,max_attempts,available_at,locked_at,last_http_status,last_error_code,last_error,last_admin_action,last_admin_action_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    context.serviceClient
      .from("fiscal_adjustment_requests")
      .select("id,order_id,adjustment_type,status,amount_cents,currency,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    context.serviceClient
      .from("orders")
      .select("id,user_id,status,payment_environment,total_paid_cents,currency,created_at")
      .eq("payment_provider", "stripe")
      .eq("status", "paid")
      .limit(2000),
  ])

  const results = [
    settingsResult,
    connectionsResult,
    checklistResult,
    validationsResult,
    activationEventsResult,
    mappingsResult,
    productsResult,
    documentsResult,
    jobsResult,
    adjustmentsResult,
    paidOrdersResult,
  ]
  for (const result of results) {
    if (result.error) throw result.error
  }

  const documents = documentsResult.data ?? []
  const orderIds = [...new Set(documents.map((item) => item.order_id))]
  const ordersResult = orderIds.length
    ? await context.serviceClient
      .from("orders")
      .select("id,user_id,status,payment_environment,total_paid_cents,currency,created_at")
      .in("id", orderIds)
    : { data: [], error: null }
  if (ordersResult.error) throw ordersResult.error
  const orders = ordersResult.data ?? []
  const userIds = [...new Set(orders.map((item) => item.user_id))]
  const profilesResult = userIds.length
    ? await context.serviceClient.from("profiles").select("id,full_name,email").in("id", userIds)
    : { data: [], error: null }
  if (profilesResult.error) throw profilesResult.error

  return {
    credentials,
    settings: settingsResult.data ?? [],
    connections: connectionsResult.data ?? [],
    checklist: checklistResult.data ?? [],
    validations: (validationsResult.data ?? []) as ValidationRow[],
    activationEvents: activationEventsResult.data ?? [],
    mappings: mappingsResult.data ?? [],
    products: productsResult.data ?? [],
    documents,
    jobs: jobsResult.data ?? [],
    adjustments: adjustmentsResult.data ?? [],
    paidOrders: paidOrdersResult.data ?? [],
    orders,
    profiles: profilesResult.data ?? [],
  }
}

function buildOverview(state: Awaited<ReturnType<typeof loadCoreState>>) {
  const orderById = new Map(state.orders.map((item) => [item.id, item]))
  const profileById = new Map(state.profiles.map((item) => [item.id, item]))
  const jobByDocumentId = new Map(state.jobs.map((item) => [item.fiscal_document_id, item]))
  const documentedOrderIds = new Set(state.documents.map((item) => item.order_id))

  const queue = state.documents.map((document) => {
    const order = orderById.get(document.order_id)
    const profile = order ? profileById.get(order.user_id) : null
    const job = jobByDocumentId.get(document.id) ?? null
    return {
      fiscal_document_id: document.id,
      order_id: document.order_id,
      buyer_label: minimalBuyerLabel(profile?.full_name, profile?.email),
      commercial_status: order?.status ?? "unknown",
      fiscal_status: document.status,
      job_type: job?.job_type ?? null,
      job_status: job?.status ?? null,
      attempt_count: job?.attempt_count ?? 0,
      max_attempts: job?.max_attempts ?? 0,
      last_error: job?.last_error ?? document.last_error_message ?? null,
      last_error_code: job?.last_error_code ?? document.last_error_code ?? null,
      available_at: job?.available_at ?? null,
      document_number: document.document_number,
      moloni_document_id: document.moloni_document_id,
      environment: document.environment,
      payment_environment: document.source_payment_environment,
      total_amount_cents: document.total_amount_cents,
      currency: document.currency,
      issued_at: document.issued_at,
      can_retry: Boolean(job && ["blocked", "failed", "retry"].includes(job.status) && !document.moloni_document_id),
      can_cancel: Boolean(
        job &&
          ["pending", "retry", "blocked", "failed"].includes(job.status) &&
          !document.moloni_document_id,
      ),
    }
  })

  const liveSettings = state.settings.find((item) => item.payment_environment === "live")
  const liveConnection = state.connections.find((item) => item.environment === "live")
  const liveChecklist = state.checklist.filter((item) =>
    item.payment_environment === "live" && item.is_blocking
  )
  const publishedPaidProducts = state.products.filter((item) => item.status === "published")
  const liveActiveMappings = state.mappings.filter((item) =>
    item.payment_environment === "live" && item.is_active
  )
  const mappedProductIds = new Set(liveActiveMappings.map((item) => item.product_id))
  const missingPaidProductMappings = publishedPaidProducts.filter((item) => !mappedProductIds.has(item.id)).length
  const companyId = Number(liveSettings?.moloni_company_id ?? 0) || null
  const validations = state.validations
  const companyValidation = latestValidation(validations, "live", "company")
  const documentSetsValidation = latestValidation(validations, "live", "document_sets")
  const productsValidation = latestValidation(validations, "live", "products")
  const taxesValidation = latestValidation(validations, "live", "taxes")
  const paymentValidation = latestValidation(validations, "live", "payment_method")
  const mappingsValidation = latestValidation(validations, "live", "mappings")
  const draftValidation = latestValidation(validations, "test", "draft_document")
  const tokenUsable = Boolean(
    liveConnection?.status === "connected" &&
      (
        (liveConnection?.token_expires_at &&
          new Date(liveConnection.token_expires_at).getTime() > Date.now()) ||
        !liveConnection?.refresh_token_expires_at ||
        new Date(liveConnection.refresh_token_expires_at).getTime() > Date.now()
      ),
  )
  const gateInput = {
    credentialsConfigured: state.credentials.configured,
    encryptionKeyConfigured: state.credentials.encryption_key_configured,
    oauthConnected: liveConnection?.status === "connected",
    tokenUsable,
    companyConfigured: Boolean(companyId),
    companyValidated: validationMatchesCompany(companyValidation, companyId),
    documentSetsValidated: validationMatchesCompany(documentSetsValidation, companyId),
    productsValidated: validationMatchesCompany(productsValidation, companyId),
    taxesValidated: validationMatchesCompany(taxesValidation, companyId),
    paymentMethodValidated: validationMatchesCompany(paymentValidation, companyId),
    mappingsValidated: validationMatchesCompany(mappingsValidation, companyId),
    missingPaidProductMappings,
    approvedChecklistItems: liveChecklist.filter((item) => item.status === "approved").length,
    requiredChecklistItems: liveChecklist.length,
    draftTestPassed: draftValidation?.status === "passed",
    monetaryDivergences: state.documents.filter((item) =>
      item.source_payment_environment === "live" &&
      ["MOLONI_TOTAL_MISMATCH", "ORDER_ITEM_TOTAL_MISMATCH"].includes(item.last_error_code ?? "")
    ).length,
    moloniEnvironment: (liveSettings?.moloni_environment ?? "draft") as "draft" | "live",
    documentStatus: (liveSettings?.document_status ?? 0) as 0 | 1,
  }

  return {
    credentials: state.credentials,
    settings: state.settings,
    connections: state.connections,
    checklist: state.checklist,
    validations: state.validations.slice(0, 100),
    activation_events: state.activationEvents,
    mappings: state.mappings,
    products: state.products,
    queue,
    adjustments: state.adjustments,
    metrics: {
      pending: state.jobs.filter((item) => ["pending", "retry", "processing"].includes(item.status)).length,
      blocked: state.jobs.filter((item) => item.status === "blocked").length,
      permanent_failures: state.jobs.filter((item) => item.status === "failed").length,
      issued: state.documents.filter((item) => item.status === "issued").length,
      paid_without_document: state.paidOrders.filter((item) => !documentedOrderIds.has(item.id)).length,
      adjustments_requiring_review: state.adjustments.filter((item) => item.status === "requires_review").length,
    },
    activation_gate: {
      ready: getMissingMoloniActivationRequirements(gateInput).length === 0,
      missing: getMissingMoloniActivationRequirements(gateInput),
      ...gateInput,
    },
  }
}

async function runValidation(
  context: Awaited<ReturnType<typeof requireAdmin>>,
  paymentEnvironment: PaymentEnvironment,
  validationType: ValidationType,
) {
  const state = await loadCoreState(context)
  const settings = state.settings.find((item) => item.payment_environment === paymentEnvironment)
  if (!settings) throw notFound("Configuração fiscal não encontrada")
  const moloniEnvironment = settings.moloni_environment as "draft" | "live"
  const companyId = Number(settings.moloni_company_id ?? 0) || null

  try {
    let summary = ""
    let details: Record<string, unknown> = {}
    if (validationType === "credentials") {
      if (!state.credentials.configured || !state.credentials.encryption_key_configured) {
        throw conflict("As credenciais ou a chave externa de criptografia estão incompletas.")
      }
      await buildMoloniAuthorizationUrl(context.serviceClient, "safe-configuration-validation")
      summary = "Credenciais cifradas e callback validados."
      details = { source: state.credentials.source }
    } else {
      const moloni = new MoloniClient(context.serviceClient, moloniEnvironment)
      const companies = await moloni.getCompanies()
      if (validationType === "oauth") {
        summary = "OAuth validado por consulta autenticada."
        details = { company_count: companies.length }
      } else {
        if (!companyId || !companies.some((item) => Number(item.company_id) === companyId)) {
          throw conflict("A empresa configurada não foi encontrada na ligação Moloni.")
        }
        details = { company_id: companyId }
        if (validationType === "company") {
          summary = "Empresa Moloni confirmada."
        } else if (validationType === "document_sets") {
          const rows = await moloni.getDocumentSets(companyId)
          if (!rows.length) throw conflict("Nenhuma série documental disponível.")
          summary = `${rows.length} série(s) documental(is) validada(s).`
          details.count = rows.length
        } else if (validationType === "products") {
          const rows = await moloni.getProducts(companyId)
          if (!rows.length) throw conflict("Nenhum artigo Moloni disponível.")
          summary = `${rows.length} artigo(s) Moloni validado(s).`
          details.count = rows.length
        } else if (validationType === "taxes") {
          const rows = await moloni.getTaxes(companyId)
          if (!rows.length) throw conflict("Nenhuma taxa Moloni disponível.")
          summary = `${rows.length} taxa(s) fiscal(is) validada(s).`
          details.count = rows.length
        } else if (validationType === "payment_method") {
          const rows = await moloni.getPaymentMethods(companyId)
          if (!rows.some((item) =>
            Number(item.payment_method_id) === Number(settings.customer_payment_method_id)
          )) {
            throw conflict("O método de pagamento configurado não foi confirmado na Moloni.")
          }
          summary = "Método de pagamento Stripe confirmado na Moloni."
          details.payment_method_id = settings.customer_payment_method_id
        } else if (validationType === "mappings") {
          const publishedProducts = state.products.filter((item) => item.status === "published")
          const mappings = state.mappings.filter((item) =>
            item.payment_environment === paymentEnvironment && item.is_active
          )
          const mappingByProduct = new Map(mappings.map((item) => [item.product_id, item]))
          const missing = publishedProducts.filter((item) => !mappingByProduct.has(item.id))
          if (missing.length) {
            throw conflict(`${missing.length} produto(s) pago(s) ainda não possuem mapeamento ativo.`)
          }
          const [remoteProducts, documentSets, taxes, paymentMethods] = await Promise.all([
            moloni.getProducts(companyId),
            moloni.getDocumentSets(companyId),
            moloni.getTaxes(companyId),
            moloni.getPaymentMethods(companyId),
          ])
          for (const mapping of mappings) {
            if (!remoteProducts.some((item) => Number(item.product_id) === mapping.moloni_product_id)) {
              throw conflict("Um artigo mapeado deixou de existir na Moloni.")
            }
            if (!documentSets.some((item) =>
              Number(item.document_set_id) === mapping.moloni_document_set_id
            )) {
              throw conflict("Uma série mapeada deixou de existir na Moloni.")
            }
            if (
              mapping.moloni_tax_id &&
              !taxes.some((item) => Number(item.tax_id) === mapping.moloni_tax_id)
            ) {
              throw conflict("Uma taxa mapeada deixou de existir na Moloni.")
            }
            if (
              mapping.moloni_payment_method_id &&
              !paymentMethods.some((item) =>
                Number(item.payment_method_id) === mapping.moloni_payment_method_id
              )
            ) {
              throw conflict("Um método de pagamento mapeado deixou de existir na Moloni.")
            }
          }
          summary = `${mappings.length} mapeamento(s) fiscal(is) validado(s).`
          details.mapping_count = mappings.length
        }
      }
    }
    return await recordValidation(context, {
      paymentEnvironment,
      validationType,
      status: "passed",
      summary,
      details,
    })
  } catch (error) {
    await recordValidation(context, {
      paymentEnvironment,
      validationType,
      status: "failed",
      summary: safeMessage(error),
      details: { company_id: companyId },
    })
    throw error
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
      "moloni.admin_control_plane",
      30,
    )
    const body = await readJsonBody<Input>(req)

    if (body.action === "overview") {
      const overview = buildOverview(await loadCoreState(context))
      return jsonResponse({ success: true, request_id: requestId, ...overview })
    }

    if (body.action === "save_credentials") {
      const clientId = body.clientId?.trim() || null
      const clientSecret = body.clientSecret?.trim() || null
      if (clientId && (clientId.length < 3 || clientId.length > 300)) throw badRequest("Client ID inválido")
      if (clientSecret && (clientSecret.length < 8 || clientSecret.length > 500)) {
        throw badRequest("Client Secret inválido")
      }
      if (!clientId && !clientSecret) throw badRequest("Informe pelo menos uma credencial para substituir")
      await storeMoloniAppConfiguration(context.serviceClient, {
        clientId,
        clientSecret,
        actorUserId: context.user.id,
      })
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_credentials_replaced",
        entityType: "moloni_configuration",
        metadata: {
          client_id_replaced: Boolean(clientId),
          client_secret_replaced: Boolean(clientSecret),
        },
        ...extractRequestAuditContext(req),
      })
      return jsonResponse({
        success: true,
        request_id: requestId,
        credentials: await getMoloniAppCredentialStatus(context.serviceClient),
      })
    }

    if (body.action === "update_checklist") {
      assertPaymentEnvironment(body.paymentEnvironment)
      const status = body.status
      if (!["pending", "filled", "approved"].includes(status)) throw badRequest("Status do checklist inválido")
      if (!body.itemKey?.trim()) throw badRequest("Item do checklist inválido")
      if (status === "approved" && body.confirmation !== "APROVAR DECISAO FISCAL") {
        throw conflict("A confirmação explícita da aprovação está ausente.")
      }
      const notes = body.notes?.trim().slice(0, 2000) || null
      const configuration = body.configuration === undefined ? null : body.configuration
      if (status !== "pending" && configuration === null && !notes) {
        throw badRequest("Preencha a decisão ou uma observação antes de guardar.")
      }
      const approved = status === "approved"
      if (!approved) {
        const { data: activeSettings, error: activeSettingsError } = await context.serviceClient
          .from("moloni_fiscal_settings")
          .select("emission_enabled")
          .eq("payment_environment", body.paymentEnvironment)
          .maybeSingle()
        if (activeSettingsError) throw activeSettingsError
        if (activeSettings?.emission_enabled) {
          const { error: deactivationError } = await context.serviceClient
            .rpc("deactivate_moloni_emission", {
              p_payment_environment: body.paymentEnvironment,
              p_actor_user_id: context.user.id,
            })
          if (deactivationError) throw conflict(deactivationError.message)
        }
      }
      const { data: item, error } = await context.serviceClient
        .from("moloni_fiscal_checklist_items")
        .update({
          status,
          configuration,
          notes,
          approved_by: approved ? context.user.id : null,
          approved_at: approved ? new Date().toISOString() : null,
          updated_by: context.user.id,
        })
        .eq("payment_environment", body.paymentEnvironment)
        .eq("item_key", body.itemKey)
        .select("*")
        .maybeSingle()
      if (error) throw error
      if (!item) throw notFound("Item do checklist não encontrado")
      await writeAuditLog(context.serviceClient, context, {
        action: approved ? "admin.moloni_checklist_approved" : "admin.moloni_checklist_updated",
        entityType: "moloni_fiscal_checklist",
        entityId: item.id,
        metadata: {
          payment_environment: body.paymentEnvironment,
          item_key: body.itemKey,
          status,
        },
        ...extractRequestAuditContext(req),
      })
      return jsonResponse({ success: true, request_id: requestId, item })
    }

    if (body.action === "run_validation") {
      assertPaymentEnvironment(body.paymentEnvironment)
      if (![
        "credentials",
        "oauth",
        "company",
        "document_sets",
        "products",
        "taxes",
        "payment_method",
        "mappings",
      ].includes(body.validationType)) {
        throw badRequest("Diagnóstico Moloni inválido")
      }
      const validation = await runValidation(context, body.paymentEnvironment, body.validationType)
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_validation_run",
        entityType: "moloni_validation",
        entityId: validation.id,
        metadata: {
          payment_environment: body.paymentEnvironment,
          validation_type: body.validationType,
          status: validation.status,
        },
        ...extractRequestAuditContext(req),
      })
      return jsonResponse({ success: true, request_id: requestId, validation })
    }

    if (body.action === "create_draft_test") {
      if (!isDraftHomologationConfirmation(body.confirmation)) {
        throw conflict("Digite CRIAR RASCUNHO DE TESTE para confirmar.")
      }
      const { data: checklist, error: checklistError } = await context.serviceClient
        .from("moloni_fiscal_checklist_items")
        .select("item_key,status")
        .eq("payment_environment", "test")
      if (checklistError) throw checklistError
      if (!hasApprovedChecklistItem(checklist ?? [], "homologation_strategy")) {
        throw conflict("A estratégia de homologação ainda não foi aprovada.")
      }
      const { data: document, error: documentError } = await context.serviceClient
        .from("fiscal_documents")
        .select("id,status,source_payment_environment,environment,moloni_document_id")
        .eq("id", body.fiscalDocumentId)
        .maybeSingle()
      if (documentError) throw documentError
      if (!document) throw notFound("Documento de teste não encontrado")
      if (
        document.source_payment_environment !== "test" ||
        document.environment !== "draft" ||
        document.moloni_document_id
      ) {
        throw conflict("A homologação aceita somente pedido Stripe test e documento Moloni em rascunho.")
      }
      const { data: claimedJob, error: claimError } = await context.serviceClient
        .from("moloni_document_jobs")
        .update({
          status: "processing",
          locked_at: new Date().toISOString(),
          locked_by: `admin-draft:${requestId}`,
          attempt_count: 1,
          last_error_code: null,
          last_error: null,
        })
        .eq("fiscal_document_id", document.id)
        .in("status", ["pending", "retry", "blocked", "failed"])
        .select("*")
        .maybeSingle()
      if (claimError) throw claimError
      if (!claimedJob) throw conflict("O documento de teste já está em processamento ou foi concluído.")
      const result = await processMoloniDocumentJob(context.serviceClient, claimedJob, {
        allowDraftHomologation: true,
      })
      const passed = result.status === "completed"
      const validation = await recordValidation(context, {
        paymentEnvironment: "test",
        validationType: "draft_document",
        status: passed ? "passed" : "failed",
        summary: passed
          ? "Documento de homologação criado somente em rascunho."
          : "O documento de homologação não foi concluído.",
        details: {
          fiscal_document_id: document.id,
          result_status: result.status,
        },
      })
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_draft_homologation_run",
        entityType: "fiscal_document",
        entityId: document.id,
        metadata: { status: result.status, validation_id: validation.id },
        ...extractRequestAuditContext(req),
      })
      if (!passed) throw conflict("A homologação ficou bloqueada. Consulte o erro sanitizado na fila.")
      return jsonResponse({ success: true, request_id: requestId, result, validation })
    }

    if (body.action === "activate") {
      if (body.paymentEnvironment !== "live") throw badRequest("A ativação automática é exclusiva de produção")
      if (!isStrongMoloniActivationConfirmation(body.confirmation)) {
        throw conflict("Digite ATIVAR MOLONI para confirmar a ativação.")
      }
      const state = await loadCoreState(context)
      const overview = buildOverview(state)
      if (!overview.activation_gate.ready) {
        throw conflict(`A ativação continua bloqueada: ${overview.activation_gate.missing.join("; ")}.`)
      }
      const settings = state.settings.find((item) => item.payment_environment === "live")
      if (!settings) throw notFound("Configuração live não encontrada")
      const snapshot = {
        moloni_environment: settings.moloni_environment,
        company_id: settings.moloni_company_id,
        document_kind: settings.document_kind,
        document_status: settings.document_status,
        mapping_count: state.mappings.filter((item) =>
          item.payment_environment === "live" && item.is_active
        ).length,
        checklist_approved: true,
        historical_reprocessing: false,
      }
      const { data: activationRows, error: activationError } = await context.serviceClient
        .rpc("activate_moloni_live", {
          p_actor_user_id: context.user.id,
        })
      if (activationError) throw conflict(activationError.message)
      const activation = Array.isArray(activationRows) ? activationRows[0] : activationRows
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_live_emission_enabled",
        entityType: "moloni_fiscal_settings",
        metadata: snapshot,
        ...extractRequestAuditContext(req),
      })
      return jsonResponse({
        success: true,
        request_id: requestId,
        activated_at: activation?.activated_at ?? null,
        activation_event_id: activation?.activation_event_id ?? null,
        changed: activation?.changed ?? false,
        historical_reprocessing_started: false,
      })
    }

    if (body.action === "deactivate") {
      assertPaymentEnvironment(body.paymentEnvironment)
      if (body.confirmation !== "DESATIVAR MOLONI") {
        throw conflict("Digite DESATIVAR MOLONI para confirmar.")
      }
      const { data: deactivationRows, error: deactivationError } = await context.serviceClient
        .rpc("deactivate_moloni_emission", {
          p_payment_environment: body.paymentEnvironment,
          p_actor_user_id: context.user.id,
        })
      if (deactivationError) throw conflict(deactivationError.message)
      const deactivation = Array.isArray(deactivationRows) ? deactivationRows[0] : deactivationRows
      const snapshot = {
        payment_environment: body.paymentEnvironment,
        documents_preserved: true,
        jobs_preserved: true,
        stripe_and_grants_unchanged: true,
      }
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.moloni_emission_disabled",
        entityType: "moloni_fiscal_settings",
        metadata: snapshot,
        ...extractRequestAuditContext(req),
      })
      return jsonResponse({
        success: true,
        request_id: requestId,
        deactivated_at: deactivation?.deactivated_at ?? null,
        activation_event_id: deactivation?.activation_event_id ?? null,
        changed: deactivation?.changed ?? false,
      })
    }

    throw badRequest("Ação Moloni inválida")
  } catch (error) {
    logError("Moloni admin control plane failed", {
      request_id: requestId,
      error: safeMessage(error),
    })
    return errorResponse(error, requestId)
  }
})
