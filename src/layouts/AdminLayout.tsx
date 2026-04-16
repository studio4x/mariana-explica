import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Percent,
  ShoppingCart,
  TicketPercent,
  Users,
  CreditCard,
  Bell,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { Navbar, StatusBadge } from "@/components/common"
import { cn } from "@/lib/cn"
import { BUILD_VERSION } from "@/lib/build"
import { ROUTES } from "@/lib/constants"
import {
  fetchAdminNotifications,
  fetchAdminOperations,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchAdminSupportTickets,
  fetchAdminUsers,
} from "@/services"

const items = [
  { to: ROUTES.ADMIN, label: "Visao geral", icon: LayoutDashboard },
  { to: ROUTES.ADMIN_OPERATIONS, label: "Operacoes", icon: Activity },
  { to: ROUTES.ADMIN_PAYMENTS, label: "Pagamentos", icon: CreditCard },
  { to: ROUTES.ADMIN_NOTIFICATIONS, label: "Notificacoes", icon: Bell },
  { to: ROUTES.ADMIN_USERS, label: "Usuarios", icon: Users },
  { to: ROUTES.ADMIN_PRODUCTS, label: "Produtos", icon: Package },
  { to: ROUTES.ADMIN_ORDERS, label: "Pedidos", icon: ShoppingCart },
  { to: ROUTES.ADMIN_SUPPORT, label: "Suporte", icon: LifeBuoy },
  { to: ROUTES.ADMIN_AFFILIATES, label: "Afiliados", icon: Percent },
  { to: ROUTES.ADMIN_COUPONS, label: "Cupons", icon: TicketPercent },
]

export function AdminLayout() {
  const queryClient = useQueryClient()

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["admin", "users"],
      queryFn: fetchAdminUsers,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "products"],
      queryFn: fetchAdminProducts,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "orders"],
      queryFn: fetchAdminOrders,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "notifications"],
      queryFn: fetchAdminNotifications,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "support", "tickets"],
      queryFn: fetchAdminSupportTickets,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "operations"],
      queryFn: fetchAdminOperations,
      staleTime: 60_000,
    })
  }, [queryClient])

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#eef3f8_50%,#ffffff_100%)]">
      <Navbar />

      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="container flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Operacao</p>
            <h1 className="font-display text-3xl font-bold text-slate-950">Painel administrativo</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Gestao direta da operacao com contexto claro, acoes controladas e leitura rapida dos dados importantes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label="Ambiente protegido" tone="info" />
            <StatusBadge label="Backend auditado" tone="success" />
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="mb-5 flex gap-3 overflow-x-auto pb-2 lg:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.ADMIN}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-700",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden rounded-[1.75rem] border bg-white p-4 shadow-sm lg:block">
            <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Modulos principais
            </p>
            <nav className="grid gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === ROUTES.ADMIN}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0">
            <Outlet />
            <div className="mt-8 flex items-center justify-end px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Build {BUILD_VERSION}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
