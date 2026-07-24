import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { MoloniClient, MoloniError } from "./moloni.ts"
import { normalizeIso2, normalizeVatNumber } from "./fiscal.ts"

type DocumentKind = "invoice" | "invoice_receipt"

interface FiscalDocumentRow {
  id: string
  order_id: string
  user_id: string
  document_kind: string
  status: string
  environment: "draft" | "live"
  source_payment_environment: "test" | "live"
  moloni_company_id: number | null
  currency: string
  net_amount_cents: number
  tax_amount_cents: number
  total_amount_cents: number
  your_reference: string
  payment_reference: string | null
}

interface MoloniJobRow {
  id: string
  fiscal_document_id: string
  attempt_count: number
  max_attempts: number
  result_uncertain: boolean
  locked_by: string | null
}

interface BillingRow {
  legal_name: string | null
  email: string | null
  vat_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country_code: string | null
  review_status: "incomplete" | "complete" | "requires_review"
}

interface FiscalSettingsRow {
  payment_environment: "test" | "live"
  moloni_environment: "draft" | "live"
  emission_enabled: boolean
  fiscal_checklist_approved: boolean
  document_kind: DocumentKind | null
  document_status: 0 | 1
  moloni_company_id: number | null
  customer_email_fallback_enabled: boolean
  customer_without_vat_rule: string | null
  customer_country_id: number | null
  customer_language_id: number | null
  customer_maturity_date_id: number | null
  customer_payment_method_id: number | null
}

interface OrderItemRow {
  product_id: string
  product_title_snapshot: string
  unit_price_cents: number
  discount_cents: number
  final_price_cents: number
}

interface MappingRow {
  product_id: string
  moloni_company_id: number
  moloni_product_id: number
  moloni_document_set_id: number
  moloni_tax_id: number | null
  tax_value: number | null
  exemption_reason: string | null
  eac_id: number | null
  moloni_payment_method_id: number | null
  is_active: boolean
}

export class FiscalProcessingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
    readonly blocked = false,
    readonly httpStatus: number | null = null,
  ) {
    super(message)
    this.name = "FiscalProcessingError"
  }
}

export async function resolveMoloniCountryId(
  moloni: Pick<MoloniClient, "getCountries">,
  countryCode: string | null,
  fallbackCountryId: number | null,
) {
  const iso = normalizeIso2(countryCode)
  if (!iso) return fallbackCountryId
  const countries = await moloni.getCountries()
  const country = countries.find((item) => item.iso_3166_1.toUpperCase() === iso)
  if (!country) {
    throw new FiscalProcessingError(
      `O país ${iso} do snapshot fiscal não existe no catálogo Moloni.`,
      "COUNTRY_NOT_FOUND",
      false,
      true,
    )
  }
  return Number(country.country_id)
}

export function centsToDecimal(cents: number) {
  return Number((cents / 100).toFixed(2))
}

export function buildMoloniDocumentPayload(params: {
  document: FiscalDocumentRow
  settings: FiscalSettingsRow
  customerId: number
  paidAt: string
  items: OrderItemRow[]
  mappings: MappingRow[]
}) {
  const { document, settings } = params
  if (!settings.document_kind) {
    throw new FiscalProcessingError(
      "O tipo de documento fiscal ainda não foi aprovado.",
      "DOCUMENT_KIND_NOT_APPROVED",
      false,
      true,
    )
  }
  if (document.currency !== "EUR") {
    throw new FiscalProcessingError(
      "A estratégia fiscal para esta moeda ainda não foi aprovada.",
      "CURRENCY_RULE_MISSING",
      false,
      true,
    )
  }
  const mappedByProduct = new Map(params.mappings.map((mapping) => [mapping.product_id, mapping]))
  const itemNetTotal = params.items.reduce((sum, item) => sum + item.final_price_cents, 0)
  if (itemNetTotal !== document.net_amount_cents) {
    throw new FiscalProcessingError(
      "O líquido dos itens diverge do líquido confirmado no pedido.",
      "ORDER_ITEM_TOTAL_MISMATCH",
      false,
      true,
    )
  }

  const products = params.items.map((item, index) => {
    const mapping = mappedByProduct.get(item.product_id)
    if (!mapping?.is_active) {
      throw new FiscalProcessingError(
        "Existe produto sem mapeamento fiscal ativo.",
        "PRODUCT_MAPPING_MISSING",
        false,
        true,
      )
    }
    if (mapping.moloni_company_id !== settings.moloni_company_id) {
      throw new FiscalProcessingError(
        "O mapeamento do produto pertence a outra empresa Moloni.",
        "MAPPING_COMPANY_MISMATCH",
        false,
        true,
      )
    }
    if (!mapping.moloni_tax_id && !mapping.exemption_reason?.trim()) {
      throw new FiscalProcessingError(
        "O mapeamento não possui imposto nem motivo de isenção aprovado.",
        "TAX_RULE_MISSING",
        false,
        true,
      )
    }

    const discountPercentage = item.unit_price_cents > 0
      ? Number(((item.discount_cents / item.unit_price_cents) * 100).toFixed(6))
      : 0
    return {
      product_id: mapping.moloni_product_id,
      name: item.product_title_snapshot,
      qty: 1,
      price: centsToDecimal(item.unit_price_cents),
      discount: discountPercentage,
      order: index,
      ...(mapping.moloni_tax_id
        ? {
            taxes: [{
              tax_id: mapping.moloni_tax_id,
              ...(mapping.tax_value !== null ? { value: Number(mapping.tax_value) } : {}),
              order: 1,
              cumulative: 0,
            }],
          }
        : { exemption_reason: mapping.exemption_reason?.trim() }),
    }
  })

  const primaryMapping = params.mappings[0]
  const issueDate = params.paidAt.slice(0, 10)
  const payload: Record<string, unknown> = {
    company_id: settings.moloni_company_id,
    date: issueDate,
    expiration_date: issueDate,
    document_set_id: primaryMapping.moloni_document_set_id,
    customer_id: params.customerId,
    your_reference: document.your_reference,
    products,
    status: document.source_payment_environment === "test" ? 0 : settings.document_status,
    ...(primaryMapping.eac_id ? { eac_id: primaryMapping.eac_id } : {}),
  }

  if (settings.document_kind === "invoice_receipt") {
    const paymentMethodId =
      primaryMapping.moloni_payment_method_id ?? settings.customer_payment_method_id
    if (!paymentMethodId) {
      throw new FiscalProcessingError(
        "O método de pagamento Stripe na Moloni ainda não foi mapeado.",
        "PAYMENT_METHOD_MISSING",
        false,
        true,
      )
    }
    payload.payments = [{
      payment_method_id: paymentMethodId,
      date: params.paidAt,
      value: centsToDecimal(document.total_amount_cents),
      notes: "Stripe",
    }]
  }

  return payload
}

function sanitizedError(error: unknown) {
  if (error instanceof FiscalProcessingError || error instanceof MoloniError) {
    return {
      code: error.code,
      message: error.message.slice(0, 300),
      retryable: error.retryable,
      blocked: error instanceof FiscalProcessingError ? error.blocked : false,
      httpStatus: error.httpStatus,
    }
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: "Falha inesperada durante o processamento fiscal.",
    retryable: true,
    blocked: false,
    httpStatus: null,
  }
}

async function resolveMoloniCustomer(params: {
  client: SupabaseClient
  moloni: MoloniClient
  document: FiscalDocumentRow
  settings: FiscalSettingsRow
  billing: BillingRow
  workerId: string
}) {
  const { client, moloni, document, settings, billing } = params
  if (!settings.moloni_company_id) {
    throw new FiscalProcessingError("Empresa Moloni não configurada.", "COMPANY_MISSING", false, true)
  }
  const effectiveVat = normalizeVatNumber(billing.vat_number) ||
    normalizeVatNumber(settings.customer_without_vat_rule)
  if (!effectiveVat) {
    throw new FiscalProcessingError(
      "A regra para comprador sem NIF ainda não foi aprovada.",
      "CUSTOMER_WITHOUT_VAT_RULE_MISSING",
      false,
      true,
    )
  }

  const lockMaterial = `${moloni.environment}:${settings.moloni_company_id}:${effectiveVat}`
  const lockDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(lockMaterial))
  const lockKey = Array.from(new Uint8Array(lockDigest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  const { data: claimed, error: lockError } = await client.rpc("claim_moloni_customer_lock", {
    p_lock_key: lockKey,
    p_worker_id: params.workerId,
    p_lease_seconds: 120,
  })
  if (lockError) throw lockError
  if (!claimed) {
    throw new FiscalProcessingError(
      "Outro worker está resolvendo este cliente Moloni.",
      "CUSTOMER_LOCK_BUSY",
      true,
    )
  }

  try {
    const { data: link, error: linkError } = await client
      .from("moloni_customer_links")
      .select("moloni_customer_id,vat_number_snapshot")
      .eq("user_id", document.user_id)
      .eq("environment", moloni.environment)
      .eq("moloni_company_id", settings.moloni_company_id)
      .maybeSingle()
    if (linkError) throw linkError
    if (link?.moloni_customer_id) {
      const linkedVat = normalizeVatNumber(link.vat_number_snapshot)
      if (linkedVat && linkedVat !== effectiveVat) {
        throw new FiscalProcessingError(
          "O NIF do vínculo Moloni diverge do snapshot do pedido.",
          "CUSTOMER_VAT_MISMATCH",
          false,
          true,
        )
      }
      return Number(link.moloni_customer_id)
    }

    const byVat = await moloni.getCustomerByVat(settings.moloni_company_id, effectiveVat)
    let customer = byVat.find((item) =>
      normalizeVatNumber(String(item.vat ?? "")) === effectiveVat
    )
    if (
      !customer &&
      settings.customer_email_fallback_enabled &&
      billing.email
    ) {
      const byEmail = await moloni.getCustomerByEmail(settings.moloni_company_id, billing.email)
      const candidate = byEmail.length === 1 ? byEmail[0] : null
      if (candidate) {
        const candidateVat = normalizeVatNumber(String(candidate.vat ?? ""))
        if (candidateVat && candidateVat !== effectiveVat) {
          throw new FiscalProcessingError(
            "O cliente encontrado por e-mail possui NIF divergente.",
            "CUSTOMER_VAT_MISMATCH",
            false,
            true,
          )
        }
        customer = candidate
      }
    }

    let customerId = Number(customer?.customer_id ?? 0)
    if (!customerId) {
      const effectiveCountryId = await resolveMoloniCountryId(
        moloni,
        billing.country_code,
        settings.customer_country_id,
      )
      const missingConfig = [
        !effectiveCountryId ? "country_id" : null,
        !settings.customer_language_id ? "language_id" : null,
        !settings.customer_maturity_date_id ? "maturity_date_id" : null,
        !settings.customer_payment_method_id ? "payment_method_id" : null,
      ].filter(Boolean)
      if (missingConfig.length > 0) {
        throw new FiscalProcessingError(
          `Configuração de cliente Moloni incompleta: ${missingConfig.join(", ")}.`,
          "CUSTOMER_CONFIGURATION_MISSING",
          false,
          true,
        )
      }
      const nextNumber = await moloni.getNextCustomerNumber(settings.moloni_company_id)
      const created = await moloni.createCustomer({
        company_id: settings.moloni_company_id,
        vat: effectiveVat,
        number: nextNumber.number,
        name: billing.legal_name,
        language_id: settings.customer_language_id,
        address: [billing.address_line1, billing.address_line2].filter(Boolean).join(" "),
        zip_code: billing.postal_code ?? "",
        city: billing.city,
        country_id: effectiveCountryId,
        email: billing.email ?? "",
        maturity_date_id: settings.customer_maturity_date_id,
        payment_method_id: settings.customer_payment_method_id,
      })
      customerId = Number(created.customer_id)
      if (!customerId) {
        throw new FiscalProcessingError(
          "A Moloni não devolveu o identificador do cliente.",
          "CUSTOMER_CREATE_INVALID_RESPONSE",
          true,
        )
      }
    }

    const { error: saveError } = await client
      .from("moloni_customer_links")
      .upsert({
        user_id: document.user_id,
        environment: moloni.environment,
        moloni_company_id: settings.moloni_company_id,
        moloni_customer_id: customerId,
        vat_number_snapshot: effectiveVat,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,environment,moloni_company_id" })
    if (saveError) throw saveError
    return customerId
  } finally {
    await client.rpc("release_moloni_customer_lock", {
      p_lock_key: lockKey,
      p_worker_id: params.workerId,
    })
  }
}

function validateRemoteTotals(remote: Record<string, unknown>, document: FiscalDocumentRow) {
  const netCents = Math.round(Number(remote.net_value ?? 0) * 100)
  const taxCents = Math.round(Number(remote.taxes_value ?? 0) * 100)
  const totalCents = netCents + taxCents
  if (
    netCents !== document.net_amount_cents ||
    taxCents !== document.tax_amount_cents ||
    totalCents !== document.total_amount_cents
  ) {
    throw new FiscalProcessingError(
      "Os totais devolvidos pela Moloni divergem do pedido confirmado.",
      "MOLONI_TOTAL_MISMATCH",
      false,
      true,
    )
  }
}

export async function processMoloniDocumentJob(
  client: SupabaseClient,
  job: MoloniJobRow,
  options: { allowDraftHomologation?: boolean } = {},
) {
  const workerId = job.locked_by || crypto.randomUUID()
  try {
    const { data: documentData, error: documentError } = await client
      .from("fiscal_documents")
      .select("*")
      .eq("id", job.fiscal_document_id)
      .single()
    if (documentError) throw documentError
    const document = documentData as FiscalDocumentRow

    const [{ data: settingsData, error: settingsError }, { data: billingData, error: billingError }] =
      await Promise.all([
        client
          .from("moloni_fiscal_settings")
          .select("*")
          .eq("payment_environment", document.source_payment_environment)
          .single(),
        client
          .from("order_billing_details")
          .select("*")
          .eq("order_id", document.order_id)
          .single(),
      ])
    if (settingsError) throw settingsError
    if (billingError) throw billingError
    const settings = settingsData as FiscalSettingsRow
    const billing = billingData as BillingRow

    const manualDraftHomologation =
      options.allowDraftHomologation === true &&
      document.source_payment_environment === "test" &&
      settings.payment_environment === "test" &&
      settings.moloni_environment === "draft" &&
      settings.document_status === 0
    if (
      ((!settings.emission_enabled || !settings.fiscal_checklist_approved) && !manualDraftHomologation) ||
      !settings.document_kind ||
      !settings.moloni_company_id
    ) {
      throw new FiscalProcessingError(
        "A emissão fiscal está desativada até aprovação do checklist.",
        "FISCAL_CONFIGURATION_INCOMPLETE",
        false,
        true,
      )
    }
    if (document.source_payment_environment === "test" && settings.moloni_environment !== "draft") {
      throw new FiscalProcessingError(
        "Venda Stripe test não pode usar Moloni live.",
        "ENVIRONMENT_ISOLATION_VIOLATION",
        false,
        true,
      )
    }
    if (billing.review_status !== "complete") {
      throw new FiscalProcessingError(
        "O snapshot fiscal do pedido está incompleto ou requer revisão.",
        "BILLING_SNAPSHOT_INCOMPLETE",
        false,
        true,
      )
    }

    const [{ data: order }, { data: items, error: itemsError }] = await Promise.all([
      client.from("orders").select("paid_at,status").eq("id", document.order_id).single(),
      client
        .from("order_items")
        .select("product_id,product_title_snapshot,unit_price_cents,discount_cents,final_price_cents")
        .eq("order_id", document.order_id)
        .order("created_at"),
    ])
    if (itemsError) throw itemsError
    if (!order || order.status !== "paid" || !order.paid_at) {
      throw new FiscalProcessingError("O pedido não está pago.", "ORDER_NOT_PAID", false, true)
    }
    const productIds = (items ?? []).map((item) => item.product_id)
    const { data: mappings, error: mappingError } = await client
      .from("moloni_product_mappings")
      .select("*")
      .eq("payment_environment", document.source_payment_environment)
      .in("product_id", productIds)
    if (mappingError) throw mappingError

    const moloni = new MoloniClient(client, settings.moloni_environment)
    const customerId = await resolveMoloniCustomer({
      client,
      moloni,
      document,
      settings,
      billing,
      workerId,
    })
    const payload = buildMoloniDocumentPayload({
      document,
      settings,
      customerId,
      paidAt: order.paid_at,
      items: (items ?? []) as OrderItemRow[],
      mappings: (mappings ?? []) as MappingRow[],
    })

    await client
      .from("fiscal_documents")
      .update({
        document_kind: settings.document_kind,
        status: "processing",
        environment: settings.moloni_environment,
        moloni_company_id: settings.moloni_company_id,
        moloni_customer_id: customerId,
        moloni_document_set_id: Number((mappings?.[0] as MappingRow | undefined)?.moloni_document_set_id ?? 0) || null,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", document.id)

    let remote = await moloni.getDocument(settings.document_kind, settings.moloni_company_id, {
      your_reference: document.your_reference,
    })

    if (!remote?.document_id) {
      const created = await moloni.createDocument(settings.document_kind, payload)
      if (!created.document_id) {
        throw new FiscalProcessingError(
          "A Moloni não devolveu o identificador do documento.",
          "DOCUMENT_CREATE_INVALID_RESPONSE",
          true,
        )
      }
      remote = await moloni.getDocument(settings.document_kind, settings.moloni_company_id, {
        document_id: created.document_id,
      })
    }

    validateRemoteTotals(remote, document)
    const documentNumber = String(remote.number ?? remote.document_id ?? "")
    if (!documentNumber) {
      throw new FiscalProcessingError(
        "A Moloni não devolveu o número do documento.",
        "DOCUMENT_CONFIRM_INVALID_RESPONSE",
        true,
      )
    }

    const issuedAt = new Date().toISOString()
    const { error: issueError } = await client
      .from("fiscal_documents")
      .update({
        status: "issued",
        environment: settings.moloni_environment,
        moloni_document_id: Number(remote.document_id),
        document_number: documentNumber,
        remote_status: Number(remote.status ?? settings.document_status),
        issued_at: issuedAt,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", document.id)
    if (issueError) throw issueError

    const { error: completeError } = await client
      .from("moloni_document_jobs")
      .update({
        status: "completed",
        completed_at: issuedAt,
        locked_at: null,
        locked_by: null,
        result_uncertain: false,
        last_http_status: 200,
        last_error_code: null,
        last_error: null,
      })
      .eq("id", job.id)
    if (completeError) throw completeError

    return { status: "completed" as const, documentId: document.id, moloniDocumentId: Number(remote.document_id) }
  } catch (error) {
    const failure = sanitizedError(error)
    const exhausted = job.attempt_count >= job.max_attempts
    const jobStatus = failure.blocked
      ? "blocked"
      : failure.retryable && !exhausted
        ? "retry"
        : "failed"
    const documentStatus = failure.blocked
      ? "blocked_data"
      : failure.retryable && !exhausted
        ? "failed_retryable"
        : "failed_permanent"
    const backoffMinutes = [1, 5, 15, 60, 360][Math.min(Math.max(job.attempt_count - 1, 0), 4)]
    await Promise.all([
      client
        .from("fiscal_documents")
        .update({
          status: documentStatus,
          last_error_code: failure.code,
          last_error_message: failure.message,
        })
        .eq("id", job.fiscal_document_id),
      client
        .from("moloni_document_jobs")
        .update({
          status: jobStatus,
          available_at: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
          locked_at: null,
          locked_by: null,
          result_uncertain: failure.retryable,
          last_http_status: failure.httpStatus,
          last_error_code: failure.code,
          last_error: failure.message,
        })
        .eq("id", job.id),
    ])
    return { status: jobStatus as "blocked" | "retry" | "failed", code: failure.code }
  }
}
