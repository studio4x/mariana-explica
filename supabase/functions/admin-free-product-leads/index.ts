import { badRequest } from "../_shared/errors.ts"
import {
  corsResponse,
  errorResponse,
  getRequestId,
  jsonResponse,
  readJsonBody,
} from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import {
  extractRequestAuditContext,
  requireAdmin,
  writeAuditLog,
} from "../_shared/mod.ts"

type DeliveryStatus = "queued" | "sent" | "failed"
type Action = "list" | "export"

interface AdminFreeProductLeadsInput {
  action?: Action
  query?: unknown
  productId?: unknown
  deliveryStatus?: unknown
  dateFrom?: unknown
  dateTo?: unknown
  offset?: unknown
  limit?: unknown
  access_token?: unknown
}

interface NormalizedFilters {
  query: string
  productId: string | null
  deliveryStatus: DeliveryStatus | null
  dateFrom: string | null
  dateToExclusive: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_FIELDS = new Set([
  "action",
  "query",
  "productId",
  "deliveryStatus",
  "dateFrom",
  "dateTo",
  "offset",
  "limit",
  "access_token",
])

const LEAD_SELECT = [
  "id",
  "product_id",
  "name",
  "email",
  "delivery_status",
  "request_count",
  "source",
  "first_requested_at",
  "last_requested_at",
  "created_at",
  "updated_at",
  "product:products!inner(id,title,slug,product_type)",
].join(",")

function normalizeInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw badRequest("Parâmetros de paginação inválidos")
  }
  return parsed
}

function normalizeDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw badRequest(`${fieldName} inválida`)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw badRequest(`${fieldName} inválida`)
  }
  return date
}

function normalizeFilters(body: AdminFreeProductLeadsInput): NormalizedFilters {
  const rawQuery = typeof body.query === "string" ? body.query.trim().replace(/\s+/g, " ") : ""
  if (rawQuery.length > 120) throw badRequest("A pesquisa deve ter no máximo 120 caracteres")

  // PostgREST's `or` filter uses punctuation as syntax, so remove those control
  // characters before interpolating the value into the server-side filter.
  const query = rawQuery.replace(/[%,()_.\\]/g, " ").replace(/\s+/g, " ").trim()
  const rawProductId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (rawProductId && !UUID_PATTERN.test(rawProductId)) throw badRequest("Material inválido")

  const rawStatus = typeof body.deliveryStatus === "string" ? body.deliveryStatus.trim() : ""
  if (rawStatus && !["queued", "sent", "failed"].includes(rawStatus)) {
    throw badRequest("Estado de entrega inválido")
  }

  const from = normalizeDate(body.dateFrom, "Data inicial")
  const to = normalizeDate(body.dateTo, "Data final")
  if (from && to && from.getTime() > to.getTime()) {
    throw badRequest("A data inicial não pode ser posterior à data final")
  }

  if (to) to.setUTCDate(to.getUTCDate() + 1)

  return {
    query,
    productId: rawProductId || null,
    deliveryStatus: (rawStatus || null) as DeliveryStatus | null,
    dateFrom: from?.toISOString() ?? null,
    dateToExclusive: to?.toISOString() ?? null,
  }
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)
  if (req.method === "OPTIONS") return corsResponse()

  try {
    if (req.method !== "POST") throw badRequest("Método não suportado")

    const context = await requireAdmin(req)
    const body = await readJsonBody<AdminFreeProductLeadsInput>(req)
    if (Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field))) {
      throw badRequest("Pedido administrativo inválido")
    }

    const action = body.action ?? "list"
    if (action !== "list" && action !== "export") throw badRequest("Ação administrativa inválida")

    const filters = normalizeFilters(body)
    const offset = action === "list" ? normalizeInteger(body.offset, 0, 0, 1_000_000) : 0
    const limit = action === "list" ? normalizeInteger(body.limit, 25, 1, 100) : 10_000

    let query = context.serviceClient
      .from("free_product_leads")
      .select(LEAD_SELECT, { count: "exact" })
      .order("last_requested_at", { ascending: false })

    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,email.ilike.%${filters.query}%`)
    }
    if (filters.productId) query = query.eq("product_id", filters.productId)
    if (filters.deliveryStatus) query = query.eq("delivery_status", filters.deliveryStatus)
    if (filters.dateFrom) query = query.gte("last_requested_at", filters.dateFrom)
    if (filters.dateToExclusive) query = query.lt("last_requested_at", filters.dateToExclusive)

    const { data, count, error } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    if (action === "export") {
      await writeAuditLog(context.serviceClient, context, {
        action: "admin.free_product_leads_exported",
        entityType: "free_product_lead",
        metadata: {
          exported_count: data?.length ?? 0,
          total_matching: count ?? 0,
          truncated: (count ?? 0) > limit,
          product_id: filters.productId,
          delivery_status: filters.deliveryStatus,
          date_from: filters.dateFrom,
          date_to_exclusive: filters.dateToExclusive,
          has_search: Boolean(filters.query),
        },
        ...extractRequestAuditContext(req),
      })

      return jsonResponse({
        success: true,
        request_id: requestId,
        rows: data ?? [],
        count: count ?? 0,
        truncated: (count ?? 0) > limit,
      })
    }

    const countByStatus = async (status?: DeliveryStatus) => {
      let countQuery = context.serviceClient
        .from("free_product_leads")
        .select("id", { count: "exact", head: true })
      if (status) countQuery = countQuery.eq("delivery_status", status)
      const result = await countQuery
      if (result.error) throw result.error
      return result.count ?? 0
    }

    const [total, queued, sent, failed] = await Promise.all([
      countByStatus(),
      countByStatus("queued"),
      countByStatus("sent"),
      countByStatus("failed"),
    ])

    return jsonResponse({
      success: true,
      request_id: requestId,
      rows: data ?? [],
      count: count ?? 0,
      metrics: { total, queued, sent, failed },
    })
  } catch (error) {
    logError("Admin free product leads failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
