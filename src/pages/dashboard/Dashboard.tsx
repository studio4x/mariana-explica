import { Link } from "react-router-dom"
import { Bell, FolderOpen, Sparkles } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { useDashboardOverview } from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import { formatDate } from "@/utils/date"

export function Dashboard() {
  const { profile } = useAuth()
  const { data, isLoading, isError, error, refetch } = useDashboardOverview()

  if (isLoading) {
    return <LoadingState message="Carregando o seu painel..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o dashboard"
        message={error instanceof Error ? error.message : "Tente novamente em instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const products = data?.products ?? []
  const notifications = data?.recentNotifications ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${profile?.full_name?.split(" ")[0] ?? "aluno"}`}
        description="Aqui está um resumo rápido do seu acesso, das novidades e dos próximos passos."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Produtos liberados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Notificações recentes</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{notifications.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Estado da conta</p>
          <p className="mt-3 text-3xl font-bold">Ativa</p>
          <p className="mt-2 text-sm leading-6 text-white/80">
            O acesso continua sempre validado pelo banco e pelos grants.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Meus produtos</h2>
              <p className="mt-1 text-sm text-slate-600">Acessos ativos e mais recentes.</p>
            </div>
            <Button asChild variant="outline">
              <Link to={ROUTES.DASHBOARD_PRODUCTS}>Ver todos</Link>
            </Button>
          </div>

          {products.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Ainda sem produtos ativos"
                message="Quando um grant for criado, os seus produtos aparecem aqui."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {products.slice(0, 4).map((product) => (
                <div key={product.id} className="rounded-2xl border bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{product.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {product.short_description ?? product.description ?? "Conteúdo disponível para consumo."}
                      </p>
                    </div>
                    <StatusBadge label={product.product_type === "free" ? "Gratuito" : "Pago"} tone="info" />
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Liberado em {formatDate(product.granted_at)}
                  </p>
                  <Button asChild className="mt-4 w-full">
                    <Link to={`${ROUTES.DASHBOARD_PRODUCT}/${product.id}`}>Abrir produto</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-slate-900" />
              <h2 className="text-xl font-semibold text-slate-950">Atalhos rápidos</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <Button asChild variant="outline" className="justify-start">
                <Link to={ROUTES.DASHBOARD_PRODUCTS}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Abrir meus produtos
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to={ROUTES.DASHBOARD_NOTIFICATIONS}>
                  <Bell className="mr-2 h-4 w-4" />
                  Ver notificações
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Notificações recentes</h2>
            {notifications.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Assim que houver comunicação relevante, ela vai aparecer aqui.
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
