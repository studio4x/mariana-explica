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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ola, ${profile?.full_name?.split(" ")[0] ?? "aluno"}`}
        description="Aqui tens um resumo rapido do teu acesso, das novidades mais recentes e dos proximos passos para continuar a estudar."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Produtos disponiveis</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tudo o que ja tens pronto para consultar.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Notificacoes recentes</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{notifications.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Mensagens, avisos e atualizacoes da tua conta.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Conta</p>
          <p className="mt-3 text-3xl font-bold">Pronta para estudar</p>
          <p className="mt-2 text-sm leading-6 text-white/82">
            Entra, abre os teus materiais e continua a partir do ponto onde paraste.
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

          {products.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Ainda sem produtos ativos"
                message="Assim que ativares um produto, ele aparece aqui para poderes comecar a estudar."
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
                        {product.short_description ?? product.description ?? "Conteudo disponivel para consulta."}
                      </p>
                    </div>
                    <StatusBadge label={product.product_type === "free" ? "Gratuito" : "Ativo"} tone="info" />
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Disponivel desde {formatDate(product.granted_at)}
                  </p>
                  <Button asChild className="mt-4 w-full rounded-full">
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
                <Link to={ROUTES.DASHBOARD_NOTIFICATIONS}>
                  <Bell className="mr-2 h-4 w-4" />
                  Ver notificacoes
                </Link>
              </Button>
            </div>
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
