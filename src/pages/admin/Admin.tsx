import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { APP_NAME, ROUTES } from "@/lib/constants"
import {
  useAdminDashboardOverview,
  useAdminModulePdfWatermarkConfig,
  useUpdateAdminModulePdfWatermarkConfig,
  useUploadAdminWatermarkLogoFile,
} from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"

interface OperationalAlert {
  title: string
  message: string
  tone: "warning" | "danger" | "info" | "neutral"
  to: string
  cta: string
}

function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Visao geral"
        description="Indicadores rapidos da operacao, contexto para tomada de decisao e os pedidos mais recentes para acompanhamento imediato."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-8 w-52 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-full space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function Admin() {
  const overviewQuery = useAdminDashboardOverview()
  const watermarkConfigQuery = useAdminModulePdfWatermarkConfig()
  const updateWatermarkConfig = useUpdateAdminModulePdfWatermarkConfig()
  const uploadWatermarkLogo = useUploadAdminWatermarkLogoFile()
  const [siteName, setSiteName] = useState(APP_NAME)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!watermarkConfigQuery.data) {
      return
    }

    setSiteName(watermarkConfigQuery.data.config_value.site_name || APP_NAME)
  }, [watermarkConfigQuery.data])

  if (overviewQuery.isLoading) {
    return <AdminOverviewSkeleton />
  }

  if (overviewQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o admin"
        message={
          overviewQuery.error instanceof Error ? overviewQuery.error.message : "Tenta novamente dentro de instantes."
        }
        onRetry={() => {
          void overviewQuery.refetch()
        }}
      />
    )
  }

  const overview = overviewQuery.data
  const metrics = overview?.metrics
  const recentOrders = overview?.recentOrders ?? []
  const alerts: OperationalAlert[] = []

  if (!overview || !metrics) {
    return (
      <EmptyState
        title="Sem dados operacionais"
        message="Assim que houver movimentacao, os indicadores vao aparecer aqui."
      />
    )
  }

  if (overview.alerts.openSupportTickets > 0) {
    alerts.push({
      title: "Tickets de suporte a pedir resposta",
      message: `${overview.alerts.openSupportTickets} ticket(s) em aberto com impacto direto na experiencia do aluno.`,
      tone: overview.alerts.highPrioritySupportTickets > 0 ? "danger" : "warning",
      to: ROUTES.ADMIN_SUPPORT,
      cta: "Abrir suporte",
    })
  }

  if (overview.alerts.unreadNotifications > 0) {
    alerts.push({
      title: "Notificacoes recentes por rever",
      message: `${overview.alerts.unreadNotifications} notificacao(oes) ainda estao sem leitura na fila operacional.`,
      tone: "neutral",
      to: ROUTES.ADMIN_NOTIFICATIONS,
      cta: "Abrir notificacoes",
    })
  }

  if (overview.alerts.failedEmails > 0) {
    alerts.push({
      title: "Emails com falha na fila",
      message: `${overview.alerts.failedEmails} entrega(s) precisam de reprocessamento ou leitura do erro.`,
      tone: "danger",
      to: ROUTES.ADMIN_OPERATIONS,
      cta: "Abrir operacoes",
    })
  }

  if (overview.alerts.failedJobs > 0) {
    alerts.push({
      title: "Jobs com falha recente",
      message: `${overview.alerts.failedJobs} execucao(oes) falharam e merecem conferencia operacional.`,
      tone: "warning",
      to: ROUTES.ADMIN_OPERATIONS,
      cta: "Rever jobs",
    })
  }

  const watermarkConfig = watermarkConfigQuery.data
  const currentLogoPath = watermarkConfig?.config_value.logo_path ?? null

  async function handleWatermarkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage(null)
    setFormError(null)

    try {
      let logoBucket = watermarkConfig?.config_value.logo_bucket ?? null
      let logoPath = watermarkConfig?.config_value.logo_path ?? null

      if (logoFile) {
        const upload = await uploadWatermarkLogo.mutateAsync({
          file: logoFile,
          replacePath: logoPath,
        })
        logoBucket = upload.bucket
        logoPath = upload.path
      }

      await updateWatermarkConfig.mutateAsync({
        siteName: siteName.trim() || APP_NAME,
        logoBucket,
        logoPath,
      })

      setLogoFile(null)
      setFormMessage("Configuracao do watermark atualizada.")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel atualizar o watermark.")
    }
  }

  async function handleRemoveLogo() {
    setFormMessage(null)
    setFormError(null)

    try {
      await updateWatermarkConfig.mutateAsync({
        siteName: siteName.trim() || APP_NAME,
        logoBucket: null,
        logoPath: null,
      })
      setLogoFile(null)
      setFormMessage("Logotipo removido da configuracao do watermark.")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel remover o logotipo.")
    }
  }

  const isSavingWatermark = updateWatermarkConfig.isPending || uploadWatermarkLogo.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visao geral"
        description="Indicadores rapidos da operacao, contexto para tomada de decisao e os pedidos mais recentes para acompanhamento imediato."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to={ROUTES.ADMIN_OPERATIONS}>Operacoes</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Utilizadores</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalUsers}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Base total sincronizada com o sistema de autenticacao.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Cursos publicados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalPublishedProducts}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Oferta publicada com visibilidade na area publica.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pedidos pagos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{metrics.totalPaidOrders}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pedidos fechados com impacto direto no acesso e grants.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-primary p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Receita registada</p>
          <p className="mt-3 text-3xl font-bold">{formatProductPrice(metrics.revenueCents, "EUR")}</p>
          <p className="mt-2 text-sm leading-6 text-white/82">Leitura rapida do volume financeiro registado no sistema.</p>
        </div>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Watermark do PDF base</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              O PDF base do modulo agora gera uma copia derivada com watermark visual. O nome do site entra como marca
              provisoria, e o logotipo pode ser definido manualmente aqui para a sobreposicao futura.
            </p>
          </div>
          <StatusBadge
            label={watermarkConfig?.config_value.logo_path ? "Logo configurado" : "Texto provisório"}
            tone={watermarkConfig?.config_value.logo_path ? "success" : "warning"}
          />
        </div>

        <form className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={(event) => void handleWatermarkSubmit(event)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nome do site usado no watermark</span>
              <input
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                placeholder={APP_NAME}
              />
            </label>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Logotipo privado do watermark</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Aceita PNG ou JPG. O ficheiro fica em storage privado e entra apenas na copia derivada entregue ao aluno.
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="mt-4 block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              />
              {logoFile ? (
                <p className="mt-2 text-sm text-slate-600">Novo ficheiro selecionado: {logoFile.name}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Estado atual</p>
            {watermarkConfigQuery.isLoading ? (
              <p className="mt-4 text-sm text-slate-600">A carregar configuracao...</p>
            ) : watermarkConfigQuery.isError ? (
              <p className="mt-4 text-sm text-red-600">
                {watermarkConfigQuery.error instanceof Error
                  ? watermarkConfigQuery.error.message
                  : "Nao foi possivel ler a configuracao atual."}
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-600">Texto atual: {watermarkConfig?.config_value.site_name ?? APP_NAME}</p>
                <p className="mt-2 break-all text-sm text-slate-600">
                  Logo atual: {currentLogoPath ?? "Nao configurado"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Ultima atualizacao: {watermarkConfig?.updated_at ? formatDateTime(watermarkConfig.updated_at) : "Ainda nao guardado"}
                </p>
              </>
            )}

            {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}
            {formMessage ? <p className="mt-4 text-sm text-emerald-700">{formMessage}</p> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" className="rounded-full" disabled={isSavingWatermark}>
                {isSavingWatermark ? "A guardar..." : "Guardar watermark"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={isSavingWatermark || !currentLogoPath}
                onClick={() => void handleRemoveLogo()}
              >
                Remover logotipo
              </Button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Alertas operacionais</h2>
            <p className="mt-1 text-sm text-slate-600">Leitura curta do que merece acao antes de seguir para o restante da operacao.</p>
          </div>
          <StatusBadge label={`${alerts.length} alertas`} tone={alerts.length > 0 ? "warning" : "success"} />
        </div>

        {alerts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Sem alertas criticos"
              message="A operacao principal esta estavel neste momento."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-[1.5rem] border bg-slate-50/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{alert.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{alert.message}</p>
                  </div>
                  <StatusBadge label="Atencao" tone={alert.tone} />
                </div>
                <Button asChild variant="outline" className="mt-4 rounded-full">
                  <Link to={alert.to}>{alert.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Pedidos recentes</h2>
            <p className="mt-1 text-sm text-slate-600">Leitura rapida para conferencia e acao operacional.</p>
          </div>
          <StatusBadge label={`${recentOrders.length} linhas`} tone="neutral" />
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Sem pedidos recentes"
              message="Os pedidos mais recentes vao aparecer aqui."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Pedido</th>
                  <th className="py-3 pr-4 font-medium">Estado</th>
                  <th className="py-3 pr-4 font-medium">Total</th>
                  <th className="py-3 pr-4 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="py-4 pr-4 font-medium text-slate-900">{order.id.slice(0, 8)}</td>
                    <td className="py-4 pr-4">
                      <StatusBadge
                        label={order.status}
                        tone={order.status === "paid" ? "success" : order.status === "pending" ? "warning" : "neutral"}
                      />
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {formatProductPrice(order.final_price_cents, order.currency)}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
