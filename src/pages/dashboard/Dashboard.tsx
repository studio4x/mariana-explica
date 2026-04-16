import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Bell, Download, FolderOpen, LifeBuoy, Sparkles } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { useDashboardOverview, useDownloads } from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import { formatDate } from "@/utils/date"
import { getDashboardProductNote } from "@/lib/product-presentation"

export function Dashboard() {
  const { profile } = useAuth()
  const { data, isLoading, isError, error, refetch } = useDashboardOverview()
  const downloadsQuery = useDownloads()
  const [authFlash] = useState<string | null>(() => {
    const flash =
      window.sessionStorage.getItem("mariana-explica:auth-flash") ??
      window.sessionStorage.getItem("mariana-explica:password-flash")
    if (!flash) {
      return null
    }

    window.sessionStorage.removeItem("mariana-explica:auth-flash")
    window.sessionStorage.removeItem("mariana-explica:password-flash")
    return flash
  })

  if (isLoading) {
    return <LoadingState message="A carregar o teu painel..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o dashboard"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const products = data?.products ?? []
  const notifications = data?.recentNotifications ?? []
  const unreadNotificationsCount = data?.unreadNotificationsCount ?? 0
  const supportTickets = data?.supportTickets ?? []
  const downloads = downloadsQuery.data ?? []
  const nextProduct = products[0] ?? null
  const openSupportTickets = supportTickets.filter((ticket) => ticket.status !== "closed").length
  const attentionTicket = supportTickets.find(
    (ticket) => ticket.priority === "high" || ticket.status === "open",
  )
  const continuitySteps = [
    nextProduct
      ? `Continuar ${nextProduct.title} com ${nextProduct.module_count} modulo${nextProduct.module_count === 1 ? "" : "s"} e ${nextProduct.asset_count} material${nextProduct.asset_count === 1 ? "" : "is"} disponive${nextProduct.asset_count === 1 ? "l" : "is"}.`
      : null,
    unreadNotificationsCount > 0
      ? `Ler ${unreadNotificationsCount} notificacao${unreadNotificationsCount === 1 ? "" : "es"} ainda pendente${unreadNotificationsCount === 1 ? "" : "s"}.`
      : null,
    openSupportTickets > 0
      ? `Acompanhar ${openSupportTickets} pedido${openSupportTickets === 1 ? "" : "s"} de suporte ainda em curso.`
      : null,
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ola, ${profile?.full_name?.split(" ")[0] ?? "aluno"}`}
        description="Aqui tens um resumo rapido do teu acesso, das novidades mais recentes e dos proximos passos para continuar a estudar."
      />

      {authFlash ? (
        <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
          {authFlash}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Produtos disponiveis</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tudo o que ja tens pronto para consultar no teu painel.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Notificacoes por ler</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{unreadNotificationsCount}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Avisos e atualizacoes que ainda merecem a tua atencao.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Downloads seguros</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{downloads.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Materiais protegidos prontos para abrir quando o grant permite.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Suporte em curso</p>
          <p className="mt-3 text-3xl font-bold">{openSupportTickets}</p>
          <p className="mt-2 text-sm leading-6 text-white/82">
            Mantem aqui a leitura das conversas em aberto para nao perderes respostas ou ajustes importantes.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Continua o teu estudo</h2>
              <p className="mt-1 text-sm text-slate-600">Os acessos mais recentes ficam aqui para voltares sem perder tempo.</p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to={ROUTES.DASHBOARD_PRODUCTS}>Ver todos</Link>
            </Button>
          </div>

          {nextProduct ? (
            <div className="mt-6 rounded-[1.75rem] bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-6 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-white/65">Continua daqui</p>
              <h3 className="mt-3 font-display text-3xl font-bold">{nextProduct.title}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82">{getDashboardProductNote(nextProduct)}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <StatusBadge label={`${nextProduct.module_count} modulos`} tone="info" />
                <StatusBadge label={`${nextProduct.asset_count} materiais`} tone="success" />
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/75">
                  Disponivel desde {formatDate(nextProduct.granted_at)}
                </span>
                {nextProduct.download_count > 0 ? (
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/75">
                    {nextProduct.download_count} downloads protegidos
                  </span>
                ) : null}
              </div>
              <Button asChild variant="secondary" className="mt-6 rounded-full bg-white text-slate-950 hover:bg-white/90">
                <Link to={`${ROUTES.DASHBOARD_PRODUCT}/${nextProduct.id}`}>
                  Abrir produto
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="Ainda sem produtos ativos"
                message="Assim que ativares um produto, ele aparece aqui para poderes comecar a estudar."
              />
            </div>
          )}

          {products.length > 1 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {products.slice(1, 5).map((product) => (
                <div key={product.id} className="rounded-2xl border bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{product.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{getDashboardProductNote(product)}</p>
                    </div>
                    <StatusBadge label="Disponivel" tone="success" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge label={`${product.module_count} modulos`} tone="info" />
                    <StatusBadge label={`${product.asset_count} materiais`} tone="neutral" />
                    {product.download_count > 0 ? (
                      <StatusBadge label={`${product.download_count} downloads`} tone="success" />
                    ) : null}
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Disponivel desde {formatDate(product.granted_at)}
                  </p>
                  <Button asChild className="mt-4 w-full rounded-full" variant="outline">
                    <Link to={`${ROUTES.DASHBOARD_PRODUCT}/${product.id}`}>Abrir produto</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-slate-900" />
              <h2 className="font-display text-2xl font-bold text-slate-950">Atalhos rapidos</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <Button asChild variant="outline" className="justify-start rounded-full">
                <Link to={ROUTES.DASHBOARD_PRODUCTS}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Abrir os meus produtos
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start rounded-full">
                <Link to={ROUTES.DASHBOARD_DOWNLOADS}>
                  <Download className="mr-2 h-4 w-4" />
                  Ver downloads protegidos
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start rounded-full">
                <Link to={ROUTES.DASHBOARD_NOTIFICATIONS}>
                  <Bell className="mr-2 h-4 w-4" />
                  Ver notificacoes
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start rounded-full">
                <Link to={ROUTES.DASHBOARD_SUPPORT}>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Acompanhar suporte
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-slate-950">Proximos passos</h2>
            {continuitySteps.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Assim que houver novos materiais, mensagens ou pedidos em curso, os proximos passos vao aparecer aqui.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {continuitySteps.map((step) => (
                  <div key={step} className="rounded-2xl border bg-slate-50/70 p-4 text-sm leading-6 text-slate-700">
                    {step}
                  </div>
                ))}
              </div>
            )}
            {attentionTicket ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Suporte em destaque</p>
                <p className="mt-2 font-medium text-slate-950">{attentionTicket.subject}</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Prioridade {attentionTicket.priority} com atualizacao em {formatDate(attentionTicket.updated_at)}.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-slate-950">Novidades recentes</h2>
            {notifications.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Quando houver uma comunicacao importante, ela vai aparecer aqui.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl border bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">{notification.title}</p>
                      <StatusBadge
                        label={notification.status === "unread" ? "Nova" : "Lida"}
                        tone={notification.status === "unread" ? "warning" : "neutral"}
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
