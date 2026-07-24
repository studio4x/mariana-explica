import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Link2,
  Loader2,
  PlugZap,
  RefreshCw,
  Save,
  ShieldCheck,
  Unplug,
} from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"
import { PageHeader, StatusBadge } from "@/components/common"
import { EmptyState, ErrorState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import {
  activateAdminMoloniLive,
  createAdminMoloniDraftTest,
  deactivateAdminMoloni,
  disconnectAdminMoloni,
  fetchAdminFiscalDocumentUrl,
  fetchAdminMoloniCatalog,
  fetchAdminMoloniOverview,
  runAdminMoloniJobAction,
  runAdminMoloniValidation,
  saveAdminMoloniCredentials,
  startAdminMoloniConnection,
  updateAdminMoloniChecklist,
  updateAdminMoloniSettings,
  upsertAdminMoloniMapping,
  type AdminMoloniOverview,
  type AdminMoloniPaymentEnvironment,
} from "@/services/admin.service"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

type Feedback = { tone: "success" | "danger" | "warning"; message: string }
type Catalog = Awaited<ReturnType<typeof fetchAdminMoloniCatalog>>

const inputClass =
  "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
const cardClass = "rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
const validationTypes = [
  ["credentials", "Credenciais"],
  ["oauth", "OAuth"],
  ["company", "Empresa"],
  ["document_sets", "Séries"],
  ["products", "Artigos"],
  ["taxes", "Impostos"],
  ["payment_method", "Pagamento"],
  ["mappings", "Mapeamentos"],
] as const

const moloniTabs = [
  { slug: "configuracao", label: "Configuração", description: "Credenciais e regras fiscais", path: ROUTES.ADMIN_MOLONI_SETTINGS },
  { slug: "checklist-fiscal", label: "Checklist fiscal", description: "Requisitos e aprovações", path: ROUTES.ADMIN_MOLONI_CHECKLIST },
  { slug: "fila-documentos-fiscais", label: "Fila e documentos fiscais", description: "Operação e documentos", path: ROUTES.ADMIN_MOLONI_QUEUE },
] as const
type MoloniTabSlug = (typeof moloniTabs)[number]["slug"]

function positiveInteger(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function recordId(item: Record<string, unknown>, keys: string[]) {
  const value = keys.map((key) => item[key]).find((candidate) => candidate !== null && candidate !== undefined)
  return value === undefined ? "" : String(value)
}

function recordLabel(item: Record<string, unknown>, keys: string[], fallback: string) {
  const value = keys.map((key) => item[key]).find((candidate) => typeof candidate === "string" && candidate.trim())
  return typeof value === "string" ? value : fallback
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação."
}

function MoloniSkeleton() {
  return (
    <div className="space-y-6" aria-label="A carregar configuração Moloni">
      <div className="h-24 animate-pulse rounded-[1.5rem] bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />)}
      </div>
      <div className="h-[32rem] animate-pulse rounded-[1.5rem] bg-slate-100" />
    </div>
  )
}

function ChecklistRow({
  item,
  disabled,
  onSave,
}: {
  item: AdminMoloniOverview["checklist"][number]
  disabled: boolean
  onSave: (input: {
    itemKey: string
    status: "pending" | "filled" | "approved"
    configuration: { value: string } | null
    notes: string
    confirmation?: string
  }) => void
}) {
  const [status, setStatus] = useState(item.status)
  const [notes, setNotes] = useState(item.notes ?? "")
  const initialConfiguration =
    item.configuration &&
    typeof item.configuration === "object" &&
    "value" in item.configuration &&
    typeof item.configuration.value === "string"
      ? item.configuration.value
      : ""
  const [configuration, setConfiguration] = useState(initialConfiguration)

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-slate-950">{item.title}</h4>
            {item.is_blocking ? <StatusBadge label="Obrigatório" tone="warning" /> : null}
            <StatusBadge
              label={item.status === "approved" ? "Aprovado" : item.status === "filled" ? "Preenchido" : "Pendente"}
              tone={item.status === "approved" ? "success" : item.status === "filled" ? "info" : "neutral"}
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
        <div className="grid min-w-56 gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Estado
            <select
              aria-label={`Estado: ${item.title}`}
              className={inputClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="pending">Pendente</option>
              <option value="filled">Preenchido</option>
              <option value="approved">Aprovado</option>
            </select>
          </label>
        </div>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Valor ou configuração aprovada
        <input
          aria-label={`Configuração: ${item.title}`}
          className={inputClass}
          value={configuration}
          onChange={(event) => setConfiguration(event.target.value)}
          placeholder="Regra, opção, referência ou “não se aplica”, conforme decisão fiscal."
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Evidência ou decisão
        <textarea
          aria-label={`Evidência: ${item.title}`}
          className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Registe a decisão, o responsável e a evidência utilizada."
        />
      </label>
      <Button
        type="button"
        variant="outline"
        className="mt-3 rounded-full"
        disabled={disabled || (status === "approved" && !notes.trim())}
        onClick={() => onSave({
          itemKey: item.item_key,
          status,
          configuration: configuration.trim() ? { value: configuration.trim() } : null,
          notes,
          confirmation: status === "approved" ? "APROVAR DECISAO FISCAL" : undefined,
        })}
      >
        <Save className="h-4 w-4" />
        Guardar item
      </Button>
      {item.approved_at ? (
        <p className="mt-3 text-xs text-slate-500">
          Aprovado em {formatDateTime(item.approved_at)} · responsável {item.approved_by?.slice(0, 8) ?? "admin"}
        </p>
      ) : null}
    </article>
  )
}

export function AdminMoloni() {
  const { tab } = useParams<{ tab?: string }>()
  const activeTab = moloniTabs.find((item) => item.slug === tab)?.slug as MoloniTabSlug | undefined
  const queryClient = useQueryClient()
  const [environment, setEnvironment] = useState<AdminMoloniPaymentEnvironment>("test")
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [documentKind, setDocumentKind] = useState<"invoice" | "invoice_receipt">("invoice_receipt")
  const [withoutVatRule, setWithoutVatRule] = useState("")
  const [countryId, setCountryId] = useState("")
  const [languageId, setLanguageId] = useState("")
  const [maturityId, setMaturityId] = useState("")
  const [paymentMethodId, setPaymentMethodId] = useState("")
  const [productId, setProductId] = useState("")
  const [moloniProductId, setMoloniProductId] = useState("")
  const [documentSetId, setDocumentSetId] = useState("")
  const [taxId, setTaxId] = useState("")
  const [taxValue, setTaxValue] = useState("0")
  const [exemptionReason, setExemptionReason] = useState("")
  const [mappingPaymentMethodId, setMappingPaymentMethodId] = useState("")
  const [eacId, setEacId] = useState("")
  const [draftDocumentId, setDraftDocumentId] = useState("")
  const [draftConfirmation, setDraftConfirmation] = useState("")
  const [activationConfirmation, setActivationConfirmation] = useState("")
  const [deactivationConfirmation, setDeactivationConfirmation] = useState("")

  const overviewQuery = useQuery({
    queryKey: ["admin", "moloni-overview"],
    queryFn: fetchAdminMoloniOverview,
    staleTime: 20_000,
  })
  const data = overviewQuery.data
  const settings = data?.settings.find((item) => item.payment_environment === environment)
  const connection = data?.connections.find((item) => item.environment === (environment === "test" ? "draft" : "live"))
  const mappings = useMemo(
    () => (data?.mappings ?? []).filter((item) => item.payment_environment === environment),
    [data?.mappings, environment],
  )
  const checklist = useMemo(
    () => (data?.checklist ?? []).filter((item) => item.payment_environment === environment),
    [data?.checklist, environment],
  )
  const eligibleDraftDocuments = useMemo(
    () => (data?.queue ?? []).filter((item) =>
      item.payment_environment === "test" &&
      item.environment === "draft" &&
      !item.document_number &&
      !item.moloni_document_id
    ),
    [data?.queue],
  )

  /* eslint-disable react-hooks/set-state-in-effect -- o formulário administrativo hidrata o snapshot remoto ao trocar de ambiente */
  useEffect(() => {
    if (!settings) return
    setCompanyId(settings.moloni_company_id ? String(settings.moloni_company_id) : "")
    setDocumentKind(settings.document_kind ?? "invoice_receipt")
    setWithoutVatRule(settings.customer_without_vat_rule ?? "")
    setCountryId(settings.customer_country_id ? String(settings.customer_country_id) : "")
    setLanguageId(settings.customer_language_id ? String(settings.customer_language_id) : "")
    setMaturityId(settings.customer_maturity_date_id ? String(settings.customer_maturity_date_id) : "")
    setPaymentMethodId(settings.customer_payment_method_id ? String(settings.customer_payment_method_id) : "")
  }, [settings])
  /* eslint-enable react-hooks/set-state-in-effect */

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "moloni-overview"] })
    await queryClient.invalidateQueries({ queryKey: ["admin", "moloni-status"] })
  }
  const succeed = async (message: string) => {
    setFeedback({ tone: "success", message })
    await refresh()
  }
  const fail = (error: unknown) => setFeedback({ tone: "danger", message: errorMessage(error) })

  const credentialsMutation = useMutation({
    mutationFn: saveAdminMoloniCredentials,
    onSuccess: async () => {
      setClientId("")
      setClientSecret("")
      await succeed("Credenciais guardadas de forma cifrada. Os valores não serão novamente exibidos.")
    },
    onError: fail,
  })
  const connectMutation = useMutation({
    mutationFn: startAdminMoloniConnection,
    onSuccess: (result) => window.location.assign(result.authorization_url),
    onError: fail,
  })
  const disconnectMutation = useMutation({
    mutationFn: disconnectAdminMoloni,
    onSuccess: () => succeed("Ligação OAuth removida sem apagar documentos ou histórico."),
    onError: fail,
  })
  const settingsMutation = useMutation({
    mutationFn: updateAdminMoloniSettings,
    onSuccess: () => succeed("Configuração fiscal guardada com emissão automática desativada."),
    onError: fail,
  })
  const catalogMutation = useMutation({
    mutationFn: fetchAdminMoloniCatalog,
    onError: fail,
  })
  const mappingMutation = useMutation({
    mutationFn: upsertAdminMoloniMapping,
    onSuccess: () => succeed("Mapeamento validado e guardado."),
    onError: fail,
  })
  const checklistMutation = useMutation({
    mutationFn: updateAdminMoloniChecklist,
    onSuccess: () => succeed("Item do checklist atualizado e auditado."),
    onError: fail,
  })
  const validationMutation = useMutation({
    mutationFn: runAdminMoloniValidation,
    onSuccess: () => succeed("Diagnóstico concluído e registado."),
    onError: fail,
  })
  const draftMutation = useMutation({
    mutationFn: createAdminMoloniDraftTest,
    onSuccess: async () => {
      setDraftConfirmation("")
      await succeed("Teste enviado exclusivamente como rascunho de homologação.")
    },
    onError: fail,
  })
  const activateMutation = useMutation({
    mutationFn: activateAdminMoloniLive,
    onSuccess: async () => {
      setActivationConfirmation("")
      await succeed("Emissão Moloni live ativada. Nenhum pedido histórico foi reprocessado.")
    },
    onError: fail,
  })
  const deactivateMutation = useMutation({
    mutationFn: ({ target, confirmation }: { target: AdminMoloniPaymentEnvironment; confirmation: string }) =>
      deactivateAdminMoloni(target, confirmation),
    onSuccess: async () => {
      setDeactivationConfirmation("")
      await succeed("Emissão automática desativada; histórico e documentos foram preservados.")
    },
    onError: fail,
  })
  const jobMutation = useMutation({
    mutationFn: runAdminMoloniJobAction,
    onSuccess: () => succeed("Ação aplicada de forma atómica à fila fiscal."),
    onError: fail,
  })

  if (overviewQuery.isLoading) return <MoloniSkeleton />
  if (overviewQuery.isError || !data) {
    return (
      <ErrorState
        title="Não foi possível carregar a Moloni"
        message={errorMessage(overviewQuery.error)}
        onRetry={() => void overviewQuery.refetch()}
      />
    )
  }

  const catalog: Catalog | undefined = catalogMutation.data
  const selectedMoloniEnvironment = environment === "test" ? "draft" : "live"
  const busy =
    credentialsMutation.isPending ||
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    settingsMutation.isPending ||
    catalogMutation.isPending ||
    mappingMutation.isPending ||
    checklistMutation.isPending ||
    validationMutation.isPending ||
    draftMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    jobMutation.isPending
  const connectionHealthy = connection?.status === "connected"
  const liveSettings = data.settings.find((item) => item.payment_environment === "live")

  if (!activeTab) return <Navigate to={ROUTES.ADMIN_MOLONI_SETTINGS} replace />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integração Moloni"
        description="Centro fiscal da Mariana Explica: configuração, homologação, mapeamentos, fila e ativação controlada. Nenhum segredo é exibido no cliente."
        backTo={ROUTES.ADMIN_PAYMENTS}
        backLabel="Voltar a Pagamentos"
        actions={
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void overviewQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <strong>Barreira de segurança:</strong> a configuração e os testes não ativam emissão real. A produção só pode ser ativada após todos os requisitos, validações e confirmação textual.
      </div>

      {feedback ? (
        <div
          aria-live="polite"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : feedback.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <nav className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-3" role="tablist" aria-label="Secções da integração Moloni">
        {moloniTabs.map((item) => (
          <Link
            key={item.slug}
            to={item.path}
            role="tab"
            aria-selected={activeTab === item.slug}
            className={`rounded-xl px-4 py-3 transition ${
              activeTab === item.slug
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
          >
            <span className="block text-sm font-bold">{item.label}</span>
            <span className={`mt-1 block text-xs ${activeTab === item.slug ? "text-slate-300" : "text-slate-500"}`}>{item.description}</span>
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Resumo Moloni">
        {[
          ["Estado", liveSettings?.emission_enabled ? "Ativa" : "Desativada"],
          ["Ambiente", environment === "test" ? "Stripe teste" : "Stripe live"],
          ["Empresa", connection?.company_name ?? "Não selecionada"],
          ["OAuth", connectionHealthy ? "Ligado" : "Ação necessária"],
          ["Último sucesso", connection?.last_success_at ? formatDateTime(connection.last_success_at) : "Sem comunicação"],
          ["Fila / bloqueios", `${data.metrics.pending} / ${data.metrics.blocked}`],
        ].map(([label, value]) => (
          <article key={label} className={cardClass}>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 break-words text-lg font-bold text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      {activeTab === "configuracao" ? (
        <section className={cardClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-sky-700" />
              <h2 className="text-xl font-black text-slate-950">Credenciais da aplicação e OAuth</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              O client ID e o client secret são cifrados no backend. Campos vazios preservam o valor já guardado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={data.credentials.configured ? "Credenciais configuradas" : "Credenciais em falta"} tone={data.credentials.configured ? "success" : "warning"} />
            <StatusBadge label={data.credentials.encryption_key_configured ? "Chave de cifra disponível" : "Chave de cifra em falta"} tone={data.credentials.encryption_key_configured ? "success" : "danger"} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Client ID
            <input
              className={inputClass}
              autoComplete="off"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder={data.credentials.client_id_configured ? "Configurado — introduza apenas para substituir" : "Introduza o client ID"}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Client secret
            <input
              aria-label="Client secret"
              type="password"
              className={inputClass}
              autoComplete="new-password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder={data.credentials.client_secret_configured ? "Configurado — nunca exibido" : "Introduza o client secret"}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button
            type="button"
            className="rounded-full"
            disabled={busy || (!clientId.trim() && !clientSecret.trim())}
            onClick={() => credentialsMutation.mutate({
              clientId: clientId.trim() || undefined,
              clientSecret: clientSecret || undefined,
            })}
          >
            <Save className="h-4 w-4" />
            Guardar credenciais
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={busy || !data.credentials.configured || !connectionHealthy}
            onClick={() => validationMutation.mutate({ paymentEnvironment: environment, validationType: "oauth" })}
          >
            <ShieldCheck className="h-4 w-4" />
            Testar conexão
          </Button>
          <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Callback OAuth
            <span className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 normal-case tracking-normal text-slate-700">
              <span className="min-w-0 flex-1 truncate">{data.credentials.callback_uri}</span>
              <button
                type="button"
                aria-label="Copiar callback OAuth"
                onClick={() => void navigator.clipboard.writeText(data.credentials.callback_uri)}
              >
                <Clipboard className="h-4 w-4" />
              </button>
            </span>
          </label>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(["draft", "live"] as const).map((target) => {
            const targetConnection = data.connections.find((item) => item.environment === target)
            const connected = targetConnection?.status === "connected"
            return (
              <article key={target} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">Moloni {target === "draft" ? "homologação/rascunho" : "produção"}</h3>
                    <p className="mt-1 text-sm text-slate-600">{targetConnection?.company_name ?? "Empresa não selecionada"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Token: {targetConnection?.token_expires_at ? `expira ${formatDateTime(targetConnection.token_expires_at)}` : "indisponível"}
                    </p>
                    {targetConnection?.last_error_message ? <p className="mt-2 text-xs text-rose-700">{targetConnection.last_error_message}</p> : null}
                  </div>
                  <StatusBadge label={connected ? "Ligado" : targetConnection?.status ?? "Desligado"} tone={connected ? "success" : "warning"} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={busy || !data.credentials.configured}
                    onClick={() => connectMutation.mutate(target)}
                  >
                    <Link2 className="h-4 w-4" />
                    {connected ? "Religar" : "Ligar OAuth"}
                  </Button>
                  {connected ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Desligar a Moloni ${target} sem apagar o histórico?`)) {
                          disconnectMutation.mutate(target)
                        }
                      }}
                    >
                      <Unplug className="h-4 w-4" />
                      Desligar
                    </Button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2" role="tablist" aria-label="Ambiente Stripe">
        {(["test", "live"] as const).map((target) => (
          <Button
            key={target}
            type="button"
            role="tab"
            aria-selected={environment === target}
            variant={environment === target ? "default" : "ghost"}
            className="rounded-xl"
            onClick={() => {
              setEnvironment(target)
              catalogMutation.reset()
            }}
          >
            Stripe {target === "test" ? "teste" : "live"}
          </Button>
        ))}
      </div>

      {activeTab === "configuracao" ? (
        <>
        <section className={cardClass}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Configuração fiscal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Defina empresa, documento, cliente genérico e referências Moloni. Guardar mantém a emissão desativada.
            </p>
          </div>
          <StatusBadge
            label={`Moloni ${selectedMoloniEnvironment === "draft" ? "rascunho" : "live"}`}
            tone={selectedMoloniEnvironment === "draft" ? "info" : "warning"}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Empresa Moloni
            <select
              className={inputClass}
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">Selecionar empresa</option>
              {companyId && !(catalog?.companies ?? []).some((item) => String(item.company_id) === companyId) ? <option value={companyId}>Empresa {companyId}</option> : null}
              {(catalog?.companies ?? []).map((item) => <option key={item.company_id} value={item.company_id}>{item.name ?? `Empresa ${item.company_id}`}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Documento
            <select className={inputClass} value={documentKind} onChange={(event) => setDocumentKind(event.target.value as typeof documentKind)}>
              <option value="invoice_receipt">Fatura-recibo</option>
              <option value="invoice">Fatura</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Regra de NIF ausente<input className={inputClass} value={withoutVatRule} onChange={(event) => setWithoutVatRule(event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">País ID<input inputMode="numeric" className={inputClass} value={countryId} onChange={(event) => setCountryId(event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Idioma ID<input inputMode="numeric" className={inputClass} value={languageId} onChange={(event) => setLanguageId(event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Vencimento ID<input inputMode="numeric" className={inputClass} value={maturityId} onChange={(event) => setMaturityId(event.target.value)} /></label>
          <label className="text-sm font-medium text-slate-700">
            Método de pagamento
            <select className={inputClass} value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
              <option value="">Selecionar</option>
              {paymentMethodId && !(catalog?.payment_methods ?? []).some((item) => recordId(item, ["payment_method_id", "id"]) === paymentMethodId) ? <option value={paymentMethodId}>Método {paymentMethodId}</option> : null}
              {(catalog?.payment_methods ?? []).map((item) => {
                const id = recordId(item, ["payment_method_id", "id"])
                return <option key={id} value={id}>{recordLabel(item, ["name"], id)}</option>
              })}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => catalogMutation.mutate({
              moloniEnvironment: selectedMoloniEnvironment,
              moloniCompanyId: positiveInteger(companyId),
            })}
          >
            {catalogMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Carregar catálogo
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={busy || !positiveInteger(companyId)}
            onClick={() => settingsMutation.mutate({
              paymentEnvironment: environment,
              moloniEnvironment: selectedMoloniEnvironment,
              emissionEnabled: false,
              fiscalChecklistApproved: false,
              documentKind,
              refundDocumentKind: null,
              documentStatus: environment === "test" ? 0 : 1,
              moloniCompanyId: positiveInteger(companyId),
              customerEmailFallbackEnabled: false,
              customerWithoutVatRule: withoutVatRule.trim() || null,
              customerCountryId: positiveInteger(countryId),
              customerLanguageId: positiveInteger(languageId),
              customerMaturityDateId: positiveInteger(maturityId),
              customerPaymentMethodId: positiveInteger(paymentMethodId),
            })}
          >
            <Save className="h-4 w-4" />
            Guardar sem ativar
          </Button>
        </div>
        </section>

        <section className={cardClass}>
        <h2 className="text-xl font-black text-slate-950">Mapeamento por produto</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Cada material pago publicado precisa de artigo, série e regra fiscal válidos no ambiente selecionado.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Artigo</th><th className="px-4 py-3">Série</th><th className="px-4 py-3">Imposto</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.products.map((product) => {
                const mapping = mappings.find((item) => item.product_id === product.id && item.is_active)
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{product.title}</td>
                    <td className="px-4 py-3"><StatusBadge label={mapping ? "Mapeado" : "Em falta"} tone={mapping ? "success" : "warning"} /></td>
                    <td className="px-4 py-3 text-slate-600">{mapping?.moloni_product_name ?? mapping?.moloni_product_id ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{mapping?.moloni_document_set_name ?? mapping?.moloni_document_set_id ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{mapping?.moloni_tax_name ?? (mapping ? `${mapping.tax_value ?? 0}%` : "—")}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-950">Editar mapeamento</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              Produto
              <select className={inputClass} value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Selecionar</option>
                {data.products.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Artigo Moloni
              <select className={inputClass} value={moloniProductId} onChange={(event) => setMoloniProductId(event.target.value)}>
                <option value="">Selecionar</option>
                {(catalog?.products ?? []).map((item) => {
                  const id = recordId(item, ["product_id", "id"])
                  return <option key={id} value={id}>{recordLabel(item, ["name", "reference"], id)}</option>
                })}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Série
              <select className={inputClass} value={documentSetId} onChange={(event) => setDocumentSetId(event.target.value)}>
                <option value="">Selecionar</option>
                {(catalog?.document_sets ?? []).map((item) => {
                  const id = recordId(item, ["document_set_id", "id"])
                  return <option key={id} value={id}>{recordLabel(item, ["name"], id)}</option>
                })}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Imposto
              <select
                className={inputClass}
                value={taxId}
                onChange={(event) => {
                  setTaxId(event.target.value)
                  const selected = (catalog?.taxes ?? []).find((item) => recordId(item, ["tax_id", "id"]) === event.target.value)
                  if (selected?.value !== undefined) setTaxValue(String(selected.value))
                }}
              >
                <option value="">Isento</option>
                {(catalog?.taxes ?? []).map((item) => {
                  const id = recordId(item, ["tax_id", "id"])
                  return <option key={id} value={id}>{recordLabel(item, ["name"], id)} ({String(item.value ?? 0)}%)</option>
                })}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Taxa %<input className={inputClass} value={taxValue} onChange={(event) => setTaxValue(event.target.value)} /></label>
            <label className="text-sm font-medium text-slate-700">Motivo de isenção<input className={inputClass} value={exemptionReason} onChange={(event) => setExemptionReason(event.target.value)} /></label>
            <label className="text-sm font-medium text-slate-700">CAE ID, quando aplicável<input inputMode="numeric" className={inputClass} value={eacId} onChange={(event) => setEacId(event.target.value)} /></label>
            <label className="text-sm font-medium text-slate-700">
              Método de pagamento
              <select className={inputClass} value={mappingPaymentMethodId} onChange={(event) => setMappingPaymentMethodId(event.target.value)}>
                <option value="">Usar configuração geral</option>
                {(catalog?.payment_methods ?? []).map((item) => {
                  const id = recordId(item, ["payment_method_id", "id"])
                  return <option key={id} value={id}>{recordLabel(item, ["name"], id)}</option>
                })}
              </select>
            </label>
          </div>
          <Button
            type="button"
            className="mt-4 rounded-full"
            disabled={busy || !productId || !positiveInteger(companyId) || !positiveInteger(moloniProductId) || !positiveInteger(documentSetId)}
            onClick={() => mappingMutation.mutate({
              paymentEnvironment: environment,
              productId,
              moloniCompanyId: positiveInteger(companyId) ?? 0,
              moloniProductId: positiveInteger(moloniProductId) ?? 0,
              moloniDocumentSetId: positiveInteger(documentSetId) ?? 0,
              moloniTaxId: positiveInteger(taxId),
              taxValue: Number(taxValue) || 0,
              exemptionReason: exemptionReason.trim() || null,
              eacId: positiveInteger(eacId),
              moloniPaymentMethodId: positiveInteger(mappingPaymentMethodId),
              isActive: true,
            })}
          >
            <FileCheck2 className="h-4 w-4" />
            Validar e guardar
          </Button>
        </div>
      </section>
        </>
      ) : null}

      {activeTab === "checklist-fiscal" ? (
        <section className={cardClass}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Checklist fiscal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              As decisões são independentes por ambiente, exigem evidência e ficam associadas ao administrador responsável.
            </p>
          </div>
          <StatusBadge
            label={`${checklist.filter((item) => item.status === "approved").length}/${checklist.filter((item) => item.is_blocking).length} aprovados`}
            tone={settings?.fiscal_checklist_approved ? "success" : "warning"}
          />
        </div>
        <div className="mt-4 space-y-3">
          {checklist.map((item) => (
            <ChecklistRow
              key={`${item.id}:${item.updated_at}`}
              item={item}
              disabled={busy}
              onSave={(input) => {
                if (
                  input.status !== "approved" ||
                  window.confirm("Aprovar esta decisão fiscal com o seu utilizador administrativo?")
                ) {
                  checklistMutation.mutate({ paymentEnvironment: environment, ...input })
                }
              }}
            />
          ))}
        </div>
        </section>
      ) : null}

      {activeTab === "configuracao" ? (
        <section className={cardClass}>
        <h2 className="text-xl font-black text-slate-950">Diagnóstico e homologação</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Execute verificações isoladas. O único teste documental permitido aqui cria um rascunho no ambiente de teste.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {validationTypes.map(([type, label]) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={busy}
              onClick={() => validationMutation.mutate({ paymentEnvironment: environment, validationType: type })}
            >
              <ShieldCheck className="h-4 w-4" />
              Validar {label}
            </Button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Documento elegível em Stripe teste
              <select className={inputClass} value={draftDocumentId} onChange={(event) => setDraftDocumentId(event.target.value)}>
                <option value="">Selecionar</option>
                {eligibleDraftDocuments.map((item) => (
                  <option key={item.fiscal_document_id} value={item.fiscal_document_id}>
                    {item.buyer_label} · {formatProductPrice(item.total_amount_cents, item.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Escreva CRIAR RASCUNHO DE TESTE
              <input className={inputClass} value={draftConfirmation} onChange={(event) => setDraftConfirmation(event.target.value)} />
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-end rounded-full"
            disabled={busy || !draftDocumentId || draftConfirmation !== "CRIAR RASCUNHO DE TESTE"}
            onClick={() => draftMutation.mutate({ fiscalDocumentId: draftDocumentId, confirmation: draftConfirmation })}
          >
            Criar rascunho de teste
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          {data.validations.filter((item) => item.payment_environment === environment).slice(0, 8).map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{item.summary}</p>
                <p className="text-xs text-slate-500">{item.validation_type} · {formatDateTime(item.created_at)}</p>
              </div>
              <StatusBadge label={item.status === "passed" ? "Passou" : "Falhou"} tone={item.status === "passed" ? "success" : "danger"} />
            </div>
          ))}
        </div>
        </section>
      ) : null}

      {activeTab === "fila-documentos-fiscais" ? (
        <section className={cardClass}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Fila e documentos fiscais</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Operações usam transições atómicas. Cancelar um job não apaga o pedido nem o documento fiscal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`${data.metrics.pending} pendentes`} tone="info" />
            <StatusBadge label={`${data.metrics.blocked} bloqueados`} tone="warning" />
            <StatusBadge label={`${data.metrics.permanent_failures} falhas permanentes`} tone="danger" />
          </div>
        </div>
        {data.queue.length === 0 ? (
          <EmptyState title="Fila fiscal vazia" message="Não existem documentos fiscais para apresentar." />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr><th className="px-4 py-3">Comprador</th><th className="px-4 py-3">Comercial</th><th className="px-4 py-3">Fiscal</th><th className="px-4 py-3">Tentativas</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Erro</th><th className="px-4 py-3">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.queue.map((item) => (
                  <tr key={item.fiscal_document_id}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-950">{item.buyer_label}</p><p className="text-xs text-slate-500">Pedido {item.order_id.slice(0, 8)}</p></td>
                    <td className="px-4 py-3">{item.commercial_status}</td>
                    <td className="px-4 py-3"><StatusBadge label={item.fiscal_status} tone={item.fiscal_status === "issued" ? "success" : item.job_status === "failed" ? "danger" : "warning"} /></td>
                    <td className="px-4 py-3">{item.attempt_count}/{item.max_attempts}</td>
                    <td className="px-4 py-3">{formatProductPrice(item.total_amount_cents, item.currency)}</td>
                    <td className="max-w-64 px-4 py-3 text-xs text-rose-700">{item.last_error ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.can_retry ? <Button size="sm" variant="outline" disabled={busy} onClick={() => jobMutation.mutate({ fiscalDocumentId: item.fiscal_document_id, action: "retry" })}>Repetir</Button> : null}
                        {item.job_status === "blocked" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => jobMutation.mutate({ fiscalDocumentId: item.fiscal_document_id, action: "unblock" })}>Desbloquear</Button> : null}
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => jobMutation.mutate({ fiscalDocumentId: item.fiscal_document_id, action: "reconcile" })}>Reconciliar</Button>
                        {item.can_cancel ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              const confirmation = window.prompt("Escreva CANCELAR JOB FISCAL para cancelar apenas o job.")
                              if (confirmation === "CANCELAR JOB FISCAL") {
                                jobMutation.mutate({ fiscalDocumentId: item.fiscal_document_id, action: "cancel", confirmation })
                              }
                            }}
                          >
                            Cancelar job
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="outline"><Link to={`${ROUTES.ADMIN_PAYMENTS}?order=${item.order_id}`}>Pedido <ExternalLink className="h-3 w-3" /></Link></Button>
                        {item.document_number ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void fetchAdminFiscalDocumentUrl(item.order_id).then((url) => window.open(url, "_blank", "noopener,noreferrer")).catch(fail)}
                          >
                            PDF
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {activeTab === "configuracao" ? (
        <section className={`rounded-[1.5rem] border p-5 shadow-sm ${data.activation_gate.ready ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          {data.activation_gate.ready ? <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-700" /> : <AlertTriangle className="mt-1 h-6 w-6 text-amber-700" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-950">Ativação controlada da produção</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              A ativação só afeta novos eventos Stripe live. Pedidos históricos não são reprocessados automaticamente.
            </p>
            {!data.activation_gate.ready ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-950">
                {data.activation_gate.missing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <label className="text-sm font-medium text-slate-700">
                Escreva ATIVAR MOLONI
                <input
                  aria-label="Confirmação de ativação"
                  className={inputClass}
                  value={activationConfirmation}
                  onChange={(event) => setActivationConfirmation(event.target.value)}
                />
              </label>
              <Button
                type="button"
                className="self-end rounded-full"
                disabled={busy || !data.activation_gate.ready || activationConfirmation !== "ATIVAR MOLONI" || Boolean(liveSettings?.emission_enabled)}
                onClick={() => activateMutation.mutate(activationConfirmation)}
              >
                <PlugZap className="h-4 w-4" />
                Ativar Moloni live
              </Button>
            </div>
            {liveSettings?.emission_enabled ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <label className="text-sm font-medium text-slate-700">
                  Escreva DESATIVAR MOLONI
                  <input className={inputClass} value={deactivationConfirmation} onChange={(event) => setDeactivationConfirmation(event.target.value)} />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="self-end rounded-full border-rose-300 text-rose-800"
                  disabled={busy || deactivationConfirmation !== "DESATIVAR MOLONI"}
                  onClick={() => deactivateMutation.mutate({ target: "live", confirmation: deactivationConfirmation })}
                >
                  Desativar emissão
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        </section>
      ) : null}
    </div>
  )
}
