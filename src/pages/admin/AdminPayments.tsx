import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpRight, Check, CreditCard, Link2, MoreHorizontal, RefreshCw, Search, Settings2 } from "lucide-react"
import { Link, Navigate, useLocation, useParams } from "react-router-dom"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { CHECKOUT_MODES, type CheckoutMode } from "@/lib/admin-checkout"
import { ROUTES } from "@/lib/constants"
import {
  fetchAdminCheckoutModeConfig,
  fetchAdminOrdersView,
  fetchAdminPaymentsStatus,
  fetchAdminMoloniStatus,
  fetchAdminMoloniCatalog,
  fetchAdminFiscalDocumentUrl,
  disconnectAdminMoloni,
  markAdminOrderCancelled,
  markAdminOrderPaid,
  markAdminOrderRefunded,
  reconcileAdminOrder,
  retryAdminMoloniDocument,
  startAdminMoloniConnection,
  updateAdminMoloniSettings,
  upsertAdminMoloniMapping,
  updateAdminCheckoutModeConfig,
} from "@/services/admin.service"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"
import type { AdminOrderViewSummary } from "@/types/app.types"

type PaymentsTab = "history" | "settings"
type PaymentsFilter = "all" | "pending" | "paid" | "refunded"
type ActionFeedback = {
  tone: "success" | "warning" | "danger"
  message: string
}

const paymentTabRoutes: Record<PaymentsTab, string> = {
  history: ROUTES.ADMIN_PAYMENTS_HISTORY,
  settings: ROUTES.ADMIN_PAYMENTS_SETTINGS,
}

const paymentTabBySlug: Record<string, PaymentsTab> = {
  historico: "history",
  configuracoes: "settings",
}

const filterOptions: Array<{ key: PaymentsFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "paid", label: "Pagos" },
  { key: "refunded", label: "Reembolsados" },
]

function orderStatusTone(status: AdminOrderViewSummary["status"]) {
  if (status === "paid") return "success"
  if (status === "pending") return "warning"
  if (status === "refunded") return "danger"
  if (status === "failed") return "danger"
  return "neutral"
}

function paymentStatusLabel(status: AdminOrderViewSummary["status"]) {
  if (status === "paid") return "Pago"
  if (status === "pending") return "Pendente"
  if (status === "refunded") return "Reembolsado"
  if (status === "failed") return "Falhou"
  return "Cancelado"
}

function productTypeLabel(productType: AdminOrderViewSummary["product_type"] | null) {
  if (productType === "free") return "Gratuito"
  if (productType === "hybrid") return "Híbrido"
  if (productType === "external_service") return "Externo"
  return "Pago"
}

function getChargedAmount(order: AdminOrderViewSummary) {
  return order.total_paid_cents ?? order.final_price_cents
}

function toUiMode(mode: "test" | "live" | null | undefined): CheckoutMode {
  return mode === "live" ? "production" : "sandbox"
}

function getStripeDashboardUrl(order: AdminOrderViewSummary) {
  const environmentPath = order.payment_environment === "live" ? "" : "/test"

  if (order.payment_reference?.startsWith("pi_")) {
    return `https://dashboard.stripe.com${environmentPath}/payments/${order.payment_reference}`
  }

  if (order.checkout_session_id) {
    return `https://dashboard.stripe.com${environmentPath}/checkout/sessions/${order.checkout_session_id}`
  }

  return null
}

function getOrderActions(order: AdminOrderViewSummary) {
  const actions: Array<"reconcile" | "mark_paid" | "refund" | "cancel"> = []

  if (order.payment_provider === "stripe" || order.checkout_session_id) {
    actions.push("reconcile")
  }

  if (["pending", "failed", "cancelled"].includes(order.status)) {
    actions.push("mark_paid")
  }

  if (order.status === "paid") {
    actions.push("refund")
  }

  if (order.status === "pending") {
    actions.push("cancel")
  }

  return actions
}

function reconcileFeedbackMessage(action: "noop" | "mark_paid" | "mark_pending" | "mark_failed", stripe: {
  status?: string | null
  payment_status?: string | null
}) {
  const stripeState = [stripe.status, stripe.payment_status].filter(Boolean).join(" / ")

  if (action === "mark_paid") {
    return "Pedido reconciliado com a Stripe, marcado como pago e acesso sincronizado."
  }

  if (action === "mark_failed") {
    return "Pedido reconciliado com a Stripe e marcado como falhou porque a sessão externa não confirmou pagamento."
  }

  if (action === "mark_pending") {
    return "A Stripe ainda não confirmou o pagamento. O pedido voltou para pendente e qualquer acesso ativo foi revogado."
  }

  return `Reconciliação concluída sem mudanças. Estado Stripe: ${stripeState || "sem alteração relevante"}.`
}

function AdminPaymentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-[1.5rem] border bg-white" />
      <div className="h-[32rem] animate-pulse rounded-[1.75rem] border bg-white" />
    </div>
  )
}
function numberOrNull(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function MoloniSettingsPanel() {
  const queryClient = useQueryClient()
  const statusQuery = useQuery({
    queryKey: ["admin", "moloni-status"],
    queryFn: fetchAdminMoloniStatus,
    staleTime: 30_000,
  })
  const [environment, setEnvironment] = useState<"test" | "live">("test")
  const [companyId, setCompanyId] = useState("")
  const [documentKind, setDocumentKind] = useState<"invoice" | "invoice_receipt">("invoice_receipt")
  const [withoutVatRule, setWithoutVatRule] = useState("")
  const [countryId, setCountryId] = useState("")
  const [languageId, setLanguageId] = useState("")
  const [maturityId, setMaturityId] = useState("")
  const [paymentMethodId, setPaymentMethodId] = useState("")
  const [checklistApproved, setChecklistApproved] = useState(false)
  const [emissionEnabled, setEmissionEnabled] = useState(false)
  const [productId, setProductId] = useState("")
  const [moloniProductId, setMoloniProductId] = useState("")
  const [documentSetId, setDocumentSetId] = useState("")
  const [taxId, setTaxId] = useState("")
  const [taxValue, setTaxValue] = useState("0")
  const [exemptionReason, setExemptionReason] = useState("")
  const [mappingPaymentMethodId, setMappingPaymentMethodId] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  const settings = statusQuery.data?.settings.find((item) => item.payment_environment === environment)
  /* eslint-disable react-hooks/set-state-in-effect -- formulário administrativo hidrata um snapshot remoto ao trocar de ambiente */
  useEffect(() => {
    if (!settings) return
    setCompanyId(settings.moloni_company_id ? String(settings.moloni_company_id) : "")
    setDocumentKind(settings.document_kind ?? "invoice_receipt")
    setWithoutVatRule(String(settings.customer_without_vat_rule ?? ""))
    setCountryId(settings.customer_country_id ? String(settings.customer_country_id) : "")
    setLanguageId(settings.customer_language_id ? String(settings.customer_language_id) : "")
    setMaturityId(settings.customer_maturity_date_id ? String(settings.customer_maturity_date_id) : "")
    setPaymentMethodId(settings.customer_payment_method_id ? String(settings.customer_payment_method_id) : "")
    setChecklistApproved(settings.fiscal_checklist_approved)
    setEmissionEnabled(settings.emission_enabled)
  }, [settings])
  /* eslint-enable react-hooks/set-state-in-effect */

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "moloni-status"] })
  }
  const connect = useMutation({
    mutationFn: startAdminMoloniConnection,
    onSuccess: (result) => window.location.assign(result.authorization_url),
  })
  const disconnect = useMutation({
    mutationFn: disconnectAdminMoloni,
    onSuccess: refresh,
  })
  const saveSettings = useMutation({
    mutationFn: updateAdminMoloniSettings,
    onSuccess: async () => {
      setFeedback("Configuração fiscal guardada.")
      await refresh()
    },
  })
  const saveMapping = useMutation({
    mutationFn: upsertAdminMoloniMapping,
    onSuccess: async () => {
      setFeedback("Mapeamento validado e guardado.")
      await refresh()
    },
  })
  const loadCatalog = useMutation({
    mutationFn: fetchAdminMoloniCatalog,
  })

  if (statusQuery.isLoading) {
    return <div className="h-48 animate-pulse rounded-[1.5rem] border bg-slate-50" />
  }
  if (statusQuery.isError) {
    return (
      <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        Não foi possível carregar a integração Moloni.{" "}
        <button className="font-semibold underline" onClick={() => void statusQuery.refetch()}>Tentar novamente</button>
      </div>
    )
  }

  const data = statusQuery.data
  const selectedMoloniEnvironment =
    environment === "test" || !checklistApproved ? "draft" : "live"
  const busy =
    connect.isPending ||
    disconnect.isPending ||
    saveSettings.isPending ||
    saveMapping.isPending ||
    loadCatalog.isPending
  const catalog = loadCatalog.data

  return ROUTES.ADMIN_MOLONI ? (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Integração fiscal</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Moloni</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Credenciais, OAuth, regras fiscais, homologação, mapeamentos e fila estão centralizados numa área protegida própria.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={`${data?.metrics.pending ?? 0} na fila`} tone="info" />
            <StatusBadge label={`${data?.metrics.blocked ?? 0} bloqueados`} tone={(data?.metrics.blocked ?? 0) > 0 ? "warning" : "success"} />
            <StatusBadge label={`${data?.metrics.issued ?? 0} emitidos`} tone="success" />
          </div>
        </div>
        <Button asChild type="button" className="rounded-full">
          <Link to={ROUTES.ADMIN_MOLONI}>
            <Settings2 className="h-4 w-4" />
            Abrir configuração Moloni
          </Link>
        </Button>
      </div>
    </section>
  ) : (
    <section className="space-y-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Integração fiscal</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Moloni</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Credenciais nunca são exibidas. Stripe test fica isolada em rascunhos; emissão live exige checklist e confirmação explícita.
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => void statusQuery.refetch()}>
          <RefreshCw className="h-4 w-4" /> Atualizar estado
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Fila", data?.metrics.pending ?? 0],
          ["Bloqueados", data?.metrics.blocked ?? 0],
          ["Falhas", data?.metrics.failed ?? 0],
          ["Emitidos", data?.metrics.issued ?? 0],
          ["Retificações", data?.metrics.adjustmentsRequiringReview ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["draft", "live"] as const).map((target) => {
          const connection = data?.connections.find((item) => item.environment === target)
          const connected = connection?.status === "connected"
          return (
            <div key={target} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">Moloni {target === "draft" ? "rascunho" : "live"}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {connection?.company_name ?? "Empresa ainda não selecionada"} · {connection?.status ?? "desconectada"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Último sucesso: {connection?.last_success_at ? formatDateTime(connection.last_success_at) : "sem comunicação"}
                  </p>
                </div>
                <StatusBadge label={connected ? "Conectada" : "Ação necessária"} tone={connected ? "success" : "warning"} />
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => void connect.mutateAsync(target)}
                >
                  <Link2 className="h-4 w-4" /> {connected ? "Reconectar" : "Conectar"}
                </Button>
                {connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Desconectar Moloni ${target} sem apagar o histórico?`)) {
                        void disconnect.mutateAsync(target)
                      }
                    }}
                  >
                    Desconectar
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border bg-slate-50 p-4">
        <div className="flex flex-wrap gap-2">
          {(["test", "live"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={environment === item ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setEnvironment(item)}
            >
              Stripe {item}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Empresa Moloni<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={companyId} onChange={(event) => { setCompanyId(event.target.value); const nextCompanyId = numberOrNull(event.target.value); if (nextCompanyId) void loadCatalog.mutateAsync({ moloniEnvironment: selectedMoloniEnvironment, moloniCompanyId: nextCompanyId }) }}><option value="">Selecionar empresa</option>{companyId && !(catalog?.companies ?? []).some((item) => String(item.company_id) === companyId) ? <option value={companyId}>Empresa {companyId}</option> : null}{(catalog?.companies ?? []).map((company) => <option key={company.company_id} value={company.company_id}>{company.name ?? `Empresa ${company.company_id}`}</option>)}</select></label>
          <label className="text-sm">Documento<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={documentKind} onChange={(event) => setDocumentKind(event.target.value as typeof documentKind)}><option value="invoice_receipt">Fatura-recibo</option><option value="invoice">Fatura</option></select></label>
          <label className="text-sm">NIF genérico aprovado<input className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={withoutVatRule} onChange={(event) => setWithoutVatRule(event.target.value)} /></label>
          <label className="text-sm">País<select aria-label="País Moloni" className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={countryId} onChange={(event) => setCountryId(event.target.value)}><option value="">Selecionar país</option>{(catalog?.countries ?? []).map((item) => <option key={item.country_id} value={String(item.country_id)}>{item.name ?? `País (${item.iso_3166_1})`} — {item.iso_3166_1}</option>)}</select></label>
          <label className="text-sm">Idioma<select aria-label="Idioma Moloni" className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={languageId} onChange={(event) => setLanguageId(event.target.value)}><option value="">Selecionar idioma</option>{(catalog?.languages ?? []).map((item) => <option key={item.language_id} value={String(item.language_id)}>{item.title}</option>)}</select></label>
          <label className="text-sm">Vencimento<select aria-label="Vencimento Moloni" className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={maturityId} onChange={(event) => setMaturityId(event.target.value)} disabled={!numberOrNull(companyId)}><option value="">{numberOrNull(companyId) ? "Selecionar vencimento" : "Selecione uma empresa primeiro"}</option>{(catalog?.maturity_dates ?? []).map((item) => <option key={item.maturity_date_id} value={String(item.maturity_date_id)}>{item.name} — {item.days} {item.days === 1 ? "dia" : "dias"}</option>)}</select></label>
          <label className="text-sm">Método pagamento<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}><option value="">Selecionar</option>{paymentMethodId && !(catalog?.payment_methods ?? []).some((item) => String(item.payment_method_id) === paymentMethodId) ? <option value={paymentMethodId}>Método {paymentMethodId}</option> : null}{(catalog?.payment_methods ?? []).map((item) => <option key={String(item.payment_method_id)} value={String(item.payment_method_id)}>{String(item.name ?? item.payment_method_id)}</option>)}</select></label>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={checklistApproved} onChange={(event) => setChecklistApproved(event.target.checked)} /> Checklist fiscal aprovado</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={emissionEnabled} onChange={(event) => setEmissionEnabled(event.target.checked)} /> Emissão automática</label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => void loadCatalog.mutateAsync({
              moloniEnvironment: selectedMoloniEnvironment,
              moloniCompanyId: numberOrNull(companyId),
            })}
          >
            Carregar catálogo Moloni
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={busy}
            onClick={() => {
            if (emissionEnabled && !window.confirm(`Ativar emissão fiscal para Stripe ${environment}?`)) return
            void saveSettings.mutateAsync({
              paymentEnvironment: environment,
              moloniEnvironment: selectedMoloniEnvironment,
              emissionEnabled,
              fiscalChecklistApproved: checklistApproved,
              documentKind,
              refundDocumentKind: null,
              documentStatus: selectedMoloniEnvironment === "draft" ? 0 : 1,
              moloniCompanyId: numberOrNull(companyId),
              customerEmailFallbackEnabled: false,
              customerWithoutVatRule: withoutVatRule || null,
              customerCountryId: numberOrNull(countryId),
              customerLanguageId: numberOrNull(languageId),
              customerMaturityDateId: numberOrNull(maturityId),
              customerPaymentMethodId: numberOrNull(paymentMethodId),
              confirmation: emissionEnabled
                ? environment === "live"
                  ? "ATIVAR_EMISSAO_FISCAL_LIVE"
                  : "ATIVAR_HOMOLOGACAO_RASCUNHO"
                : undefined,
            })
            }}
          >
            Guardar configuração segura
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-slate-50 p-4">
        <h4 className="font-semibold text-slate-950">Mapear produto</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Produto<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecionar</option>{(data?.products ?? []).map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
          <label className="text-sm">Artigo Moloni<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={moloniProductId} onChange={(event) => setMoloniProductId(event.target.value)}><option value="">Selecionar</option>{(catalog?.products ?? []).map((item) => <option key={String(item.product_id)} value={String(item.product_id)}>{String(item.name ?? item.reference ?? item.product_id)}</option>)}</select></label>
          <label className="text-sm">Série<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={documentSetId} onChange={(event) => setDocumentSetId(event.target.value)}><option value="">Selecionar</option>{(catalog?.document_sets ?? []).map((item) => <option key={String(item.document_set_id)} value={String(item.document_set_id)}>{String(item.name ?? item.document_set_id)}</option>)}</select></label>
          <label className="text-sm">Taxa<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={taxId} onChange={(event) => { setTaxId(event.target.value); const selected = (catalog?.taxes ?? []).find((item) => String(item.tax_id) === event.target.value); if (selected?.value !== undefined) setTaxValue(String(selected.value)) }}><option value="">Isento</option>{(catalog?.taxes ?? []).map((item) => <option key={String(item.tax_id)} value={String(item.tax_id)}>{String(item.name ?? item.tax_id)} ({String(item.value ?? 0)}%)</option>)}</select></label>
          <label className="text-sm">Taxa %<input className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={taxValue} onChange={(event) => setTaxValue(event.target.value)} /></label>
          <label className="text-sm">Motivo isenção<input className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={exemptionReason} onChange={(event) => setExemptionReason(event.target.value)} /></label>
          <label className="text-sm">Método pagamento<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3" value={mappingPaymentMethodId} onChange={(event) => setMappingPaymentMethodId(event.target.value)}><option value="">Usar configuração</option>{(catalog?.payment_methods ?? []).map((item) => <option key={String(item.payment_method_id)} value={String(item.payment_method_id)}>{String(item.name ?? item.payment_method_id)}</option>)}</select></label>
        </div>
        <Button
          type="button"
          className="mt-4 rounded-full"
          disabled={busy || !productId}
          onClick={() => void saveMapping.mutateAsync({
            paymentEnvironment: environment,
            productId,
            moloniCompanyId: numberOrNull(companyId) ?? 0,
            moloniProductId: numberOrNull(moloniProductId) ?? 0,
            moloniDocumentSetId: numberOrNull(documentSetId) ?? 0,
            moloniTaxId: numberOrNull(taxId),
            taxValue: Number(taxValue) || 0,
            exemptionReason: exemptionReason || null,
            moloniPaymentMethodId: numberOrNull(mappingPaymentMethodId),
            isActive: true,
          })}
        >
          Validar artigo e guardar mapeamento
        </Button>
      </div>

      {feedback ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</p> : null}
      {(connect.error || disconnect.error || saveSettings.error || saveMapping.error || loadCatalog.error) ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {(connect.error ?? disconnect.error ?? saveSettings.error ?? saveMapping.error ?? loadCatalog.error) instanceof Error
            ? (connect.error ?? disconnect.error ?? saveSettings.error ?? saveMapping.error ?? loadCatalog.error as Error).message
            : "Não foi possível concluir a operação Moloni."}
        </p>
      ) : null}
    </section>
  )
}

export function AdminPayments() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const { tab: tabSlug } = useParams<{ tab?: string }>()
  const tab = tabSlug ? paymentTabBySlug[tabSlug] : undefined
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<PaymentsFilter>("all")
  const [draftMode, setDraftMode] = useState<CheckoutMode>("sandbox")
  const [openActionOrderId, setOpenActionOrderId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null)

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders-view"],
    queryFn: fetchAdminOrdersView,
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const paymentsStatusQuery = useQuery({
    queryKey: ["admin", "payments-status"],
    queryFn: fetchAdminPaymentsStatus,
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const checkoutModeQuery = useQuery({
    queryKey: ["admin", "checkout-mode"],
    queryFn: fetchAdminCheckoutModeConfig,
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const updateCheckoutMode = useMutation({
    mutationFn: updateAdminCheckoutModeConfig,
    onSuccess: async (nextMode) => {
      setDraftMode(toUiMode(nextMode.config_value.mode))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "checkout-mode"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "payments-status"] }),
      ])
    },
  })

  const invalidateOrders = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "orders-view"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ])
  }

  const reconcileOrder = useMutation({
    mutationFn: reconcileAdminOrder,
    onSuccess: invalidateOrders,
  })

  const markPaid = useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => markAdminOrderPaid(orderId),
    onSuccess: invalidateOrders,
  })

  const markRefunded = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string | null }) =>
      markAdminOrderRefunded(orderId, reason),
    onSuccess: invalidateOrders,
  })

  const markCancelled = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string | null }) =>
      markAdminOrderCancelled(orderId, reason),
    onSuccess: invalidateOrders,
  })
  const retryFiscalDocument = useMutation({
    mutationFn: retryAdminMoloniDocument,
    onSuccess: async () => {
      await Promise.all([
        invalidateOrders(),
        queryClient.invalidateQueries({ queryKey: ["admin", "moloni-status"] }),
      ])
    },
  })
  const openFiscalDocument = useMutation({
    mutationFn: fetchAdminFiscalDocumentUrl,
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  })

  const runOrderAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setActionFeedback(null)

    try {
      await action()
      setActionFeedback({ tone: "success", message: successMessage })
    } catch (error) {
      setActionFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível concluir a ação do pedido.",
      })
    }
  }

  const runReconciliation = async (orderId: string) => {
    setActionFeedback(null)

    try {
      const result = await reconcileOrder.mutateAsync(orderId)
      setActionFeedback({
        tone: result.action === "noop" ? "warning" : "success",
        message: reconcileFeedbackMessage(result.action, result.stripe),
      })
    } catch (error) {
      setActionFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Não foi possível reconciliar o pedido.",
      })
    }
  }

  const activeMode = useMemo(() => {
    const persisted = checkoutModeQuery.data?.config_value.mode ?? null
    const fallback = paymentsStatusQuery.data?.mode ?? null
    return toUiMode(persisted ?? fallback)
  }, [checkoutModeQuery.data?.config_value.mode, paymentsStatusQuery.data?.mode])

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza o estado do selector com o modo persistido */
  useEffect(() => {
    setDraftMode(activeMode)
  }, [activeMode])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!tab) {
    return <Navigate to={ROUTES.ADMIN_PAYMENTS_HISTORY} replace />
  }

  const isLoading =
    ordersQuery.isLoading ||
    paymentsStatusQuery.isLoading ||
    checkoutModeQuery.isLoading

  const isError =
    ordersQuery.isError ||
    paymentsStatusQuery.isError ||
    checkoutModeQuery.isError

  if (isLoading) {
    return <AdminPaymentsSkeleton />
  }

  if (isError) {
    const error =
      ordersQuery.error instanceof Error
        ? ordersQuery.error
        : paymentsStatusQuery.error instanceof Error
          ? paymentsStatusQuery.error
          : checkoutModeQuery.error instanceof Error
            ? checkoutModeQuery.error
            : null

    return (
      <ErrorState
        title="Não foi possível carregar os pagamentos"
        message={error?.message ?? "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void ordersQuery.refetch()
          void paymentsStatusQuery.refetch()
          void checkoutModeQuery.refetch()
        }}
      />
    )
  }

  const orders = ordersQuery.data?.orders ?? []
  const pendingCount = ordersQuery.data?.summary.pendingCount ?? 0
  const refundedCount = ordersQuery.data?.summary.refundedCount ?? 0
  const paidCount = orders.filter((order) => order.status === "paid").length
  const currentUiMode = activeMode
  const currentModeConfig = CHECKOUT_MODES[currentUiMode]

  const filteredOrders = orders.filter((order) => {
    const matchesQuery = [
      order.id,
      order.user_name ?? "",
      order.user_email ?? "",
      order.product_title ?? "",
      order.status,
      order.payment_reference ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())

    if (!matchesQuery) {
      return false
    }

    if (filter === "all") {
      return true
    }

    return order.status === filter
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Pagamentos"
        description="Acompanhe compras registradas e ajuste o ambiente operacional do checkout."
      />

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Admin / Pagamentos</p>
            <h2 className="font-display text-2xl font-bold text-slate-950">Histórico de pagamentos</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Consulta os pedidos processados, acompanha os estados e alterna o ambiente do checkout sem sair da página.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void ordersQuery.refetch()
              void paymentsStatusQuery.refetch()
              void checkoutModeQuery.refetch()
            }}
            disabled={ordersQuery.isFetching || paymentsStatusQuery.isFetching || checkoutModeQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" />
            {ordersQuery.isFetching || paymentsStatusQuery.isFetching || checkoutModeQuery.isFetching
              ? "A atualizar..."
              : "Atualizar"}
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
            { key: "history" as const, label: "Hist\u00f3rico", icon: CreditCard },
            { key: "settings" as const, label: "Configura\u00e7\u00f5es", icon: Settings2 },
          ].map((item) => {
            const Icon = item.icon
            const active = tab === item.key

            return (
              <Link
                key={item.key}
                to={`${paymentTabRoutes[item.key]}${location.search}`}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {actionFeedback ? (
          <div
            className={[
              "mt-5 rounded-2xl border px-4 py-3 text-sm font-medium",
              actionFeedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : actionFeedback.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {actionFeedback.message}
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Total de pedidos</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{orders.length}</p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Pagos</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{paidCount}</p>
              </div>
              <div className="rounded-[1.5rem] border bg-slate-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Pendentes e reembolsados</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">
                  {pendingCount + refundedCount}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <label className="block flex-1">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Buscar
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por cliente, item, referencia ou status..."
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                </label>

                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((item) => {
                    const active = filter === item.key

                    return (
                      <Button
                        key={item.key}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className={[
                          "rounded-full",
                          active ? "bg-slate-950 text-white" : "bg-white",
                        ].join(" ")}
                        onClick={() => setFilter(item.key)}
                      >
                        {item.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <EmptyState
                title="Sem pagamentos encontrados"
                message="Tenta outro termo ou remove os filtros aplicados."
              />
            ) : (
              <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Comprado</th>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Detalhes</th>
                      <th className="px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const stripeUrl = getStripeDashboardUrl(order)
                      const actions = getOrderActions(order)
                      const actionsOpen = openActionOrderId === order.id
                      const actionPending =
                        reconcileOrder.isPending ||
                        markPaid.isPending ||
                        markRefunded.isPending ||
                        markCancelled.isPending ||
                        retryFiscalDocument.isPending ||
                        openFiscalDocument.isPending

                      return (
                        <tr key={order.id} className="border-b last:border-b-0 align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-950">{order.user_name ?? "Cliente não identificado"}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">{order.user_email ?? order.user_id}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {productTypeLabel(order.product_type)}
                            </p>
                            <p className="mt-1 font-medium text-slate-950">{order.product_title ?? order.product_id}</p>
                            <p className="mt-1 text-xs text-slate-500">Pedido {order.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{formatDateTime(order.created_at)}</td>
                          <td className="px-4 py-4">
                            <StatusBadge label={paymentStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
                            {order.fiscal_document ? (
                              <div className="mt-2 space-y-1 text-xs text-slate-600">
                                <p>Fiscal: {order.fiscal_document.status}</p>
                                {order.fiscal_document.document_number ? <p>{order.fiscal_document.document_number}</p> : null}
                                {order.fiscal_document.job ? (
                                  <p>
                                    Tentativas {order.fiscal_document.job.attempt_count}/{order.fiscal_document.job.max_attempts}
                                  </p>
                                ) : null}
                                {order.fiscal_document.status === "issued" ? (
                                  <button
                                    type="button"
                                    className="font-semibold text-slate-900 underline"
                                    disabled={actionPending}
                                    onClick={() => void openFiscalDocument.mutateAsync(order.id)}
                                  >
                                    Abrir documento
                                  </button>
                                ) : null}
                                {order.fiscal_document.last_error_code ? (
                                  <p className="max-w-48 break-words text-rose-700">{order.fiscal_document.last_error_code}</p>
                                ) : null}
                                {["blocked_data", "failed_retryable", "failed_permanent"].includes(order.fiscal_document.status) ? (
                                  <button
                                    type="button"
                                    className="font-semibold text-slate-900 underline"
                                    disabled={actionPending}
                                    onClick={() => void retryFiscalDocument.mutateAsync(order.fiscal_document!.id)}
                                  >
                                    Reprocessar
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500">Fiscal não planeado</p>
                            )}
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-950">
                            {formatProductPrice(getChargedAmount(order), order.currency)}
                          </td>
                          <td className="px-4 py-4">
                            {stripeUrl ? (
                              <Button asChild type="button" variant="outline" className="rounded-full">
                                <a href={stripeUrl} target="_blank" rel="noreferrer">
                                  Abrir pedido
                                  <ArrowUpRight className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-500">Sem link Stripe</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {actions.length > 0 ? (
                              <div className="relative">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={() => setOpenActionOrderId(actionsOpen ? null : order.id)}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  Ações
                                </Button>

                                {actionsOpen ? (
                                  <div className="absolute right-0 z-20 mt-2 grid min-w-56 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                    {actions.includes("reconcile") ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="justify-start rounded-xl"
                                        disabled={actionPending}
                                        onClick={() => {
                                          setOpenActionOrderId(null)
                                          void runReconciliation(order.id)
                                        }}
                                      >
                                        Reconciliar
                                      </Button>
                                    ) : null}
                                    {actions.includes("mark_paid") ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="justify-start rounded-xl"
                                        disabled={actionPending}
                                        onClick={() => {
                                          if (!window.confirm("Marcar este pedido como pago e liberar o acesso?")) return
                                          setOpenActionOrderId(null)
                                          void runOrderAction(
                                            () => markPaid.mutateAsync({ orderId: order.id }),
                                            "Pedido marcado como pago e acesso sincronizado.",
                                          )
                                        }}
                                      >
                                        Marcar como pago
                                      </Button>
                                    ) : null}
                                    {actions.includes("refund") ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="justify-start rounded-xl text-rose-700 hover:text-rose-700"
                                        disabled={actionPending}
                                        onClick={() => {
                                          if (!window.confirm("Marcar este pedido como reembolsado e revogar o acesso?")) return
                                          setOpenActionOrderId(null)
                                          void runOrderAction(
                                            () =>
                                              markRefunded.mutateAsync({
                                                orderId: order.id,
                                                reason: "Reembolso registrado pelo admin na tela de pagamentos.",
                                              }),
                                            "Pedido marcado como reembolsado e acesso revogado.",
                                          )
                                        }}
                                      >
                                        Reembolsar
                                      </Button>
                                    ) : null}
                                    {actions.includes("cancel") ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="justify-start rounded-xl text-rose-700 hover:text-rose-700"
                                        disabled={actionPending}
                                        onClick={() => {
                                          if (!window.confirm("Cancelar este pedido pendente?")) return
                                          setOpenActionOrderId(null)
                                          void runOrderAction(
                                            () =>
                                              markCancelled.mutateAsync({
                                                orderId: order.id,
                                                reason: "Pedido cancelado pelo admin na tela de pagamentos.",
                                              }),
                                            "Pedido pendente cancelado.",
                                          )
                                        }}
                                      >
                                        Cancelar pedido
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Sem ações</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 pt-6">
            <MoloniSettingsPanel />
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Modo ativo</p>
                    <h3 className="mt-2 text-3xl font-bold">{currentModeConfig.label}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/80">
                      {paymentsStatusQuery.data?.mode === "live"
                        ? "Checkout real com chaves de produção."
                        : "Checkout de teste para validar a experiência sem impacto comercial."}
                    </p>
                  </div>

                  <StatusBadge
                    label={currentModeConfig.label}
                    tone={paymentsStatusQuery.data?.mode === "live" ? "success" : "warning"}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Trocar ambiente</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {(["sandbox", "production"] as CheckoutMode[]).map((mode) => {
                      const active = draftMode === mode

                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            if (updateCheckoutMode.isPending) return
                            void updateCheckoutMode.mutateAsync(mode).catch(() => undefined)
                          }}
                          className={[
                            "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                            active
                              ? "border-white bg-white text-slate-950 shadow-sm"
                              : "border-white/20 bg-transparent text-white hover:border-white/50",
                          ].join(" ")}
                        >
                          {active ? <Check className="h-4 w-4" /> : null}
                          {CHECKOUT_MODES[mode].label}
                        </button>
                      )
                    })}
                  </div>
                  {updateCheckoutMode.isPending ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/60">A guardar alteração...</p>
                  ) : null}
                </div>

                <p className="mt-5 text-sm leading-7 text-white/75">
                  A mudança entra no checkout imediatamente. O pedido interno e a confirmação da Stripe passam a usar o
                  mesmo ambiente selecionado aqui.
                </p>
              </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Modo do checkout</p>
                <StatusBadge
                  label={currentModeConfig.label}
                  tone={paymentsStatusQuery.data?.mode === "live" ? "success" : "warning"}
                />
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                O checkout público passa a obedecer o modo selecionado acima. Se alterares para Sandbox, as próximas
                sessões Stripe são criadas com chaves de teste; se alterares para Produção, passam a usar as chaves
                reais do backend.
              </p>
            </div>
          </div>
          </div>
        )}

      </section>
    </div>
  )
}
