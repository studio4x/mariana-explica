import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  Bell,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Package,
  MessageSquareText,
  Percent,
  ShoppingCart,
  TicketPercent,
  Users,
  CreditCard,
  Settings,
  Shield,
} from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { StatusBadge } from "@/components/common"
import { FloatingNotifications } from "@/components/notifications"
import { Button } from "@/components/ui"
import { cn } from "@/lib/cn"
import { BUILD_VERSION } from "@/lib/build"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import {
  fetchAdminDashboardOverview,
  fetchAdminNotifications,
  fetchAdminOperations,
  fetchAdminOrdersView,
  fetchAdminProducts,
  fetchAdminSupportTickets,
  fetchAdminUsers,
} from "@/services"
import {
  useAdminNotifications,
  useAdminUsers,
  useMarkAdminNotificationAsRead,
  useMarkAllAdminNotificationsAsRead,
} from "@/hooks/useAdmin"

const items = [
  { to: ROUTES.ADMIN, label: "Visao geral", icon: LayoutDashboard },
  { to: ROUTES.ADMIN_OPERATIONS, label: "Operacoes", icon: Activity },
  { to: ROUTES.ADMIN_PAYMENTS, label: "Pagamentos", icon: CreditCard },
  { to: ROUTES.ADMIN_SETTINGS, label: "Configuracoes", icon: Settings },
  { to: ROUTES.ADMIN_NOTIFICATIONS, label: "Notificacoes", icon: Bell },
  { to: ROUTES.ADMIN_USERS, label: "Usuarios", icon: Users },
  { to: ROUTES.ADMIN_PRODUCTS, label: "Cursos", icon: Package },
  { to: ROUTES.ADMIN_ORDERS, label: "Pedidos", icon: ShoppingCart },
  { to: ROUTES.ADMIN_REVIEWS, label: "Reviews", icon: MessageSquareText },
  { to: ROUTES.ADMIN_SUPPORT, label: "Tickets", icon: LifeBuoy },
  { to: ROUTES.ADMIN_AFFILIATES, label: "Afiliados", icon: Percent },
  { to: ROUTES.ADMIN_COUPONS, label: "Cupons", icon: TicketPercent },
]

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "Admin"
  const parts = source.split(/\s+/).filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  )
}

export function AdminLayout() {
  const queryClient = useQueryClient()
  const { profile, signOut } = useAuth()
  const notificationsQuery = useAdminNotifications()
  const usersQuery = useAdminUsers()
  const markNotificationAsRead = useMarkAdminNotificationAsRead()
  const markAllNotificationsAsRead = useMarkAllAdminNotificationsAsRead()
  const displayName = profile?.full_name?.trim() || profile?.email || "Admin"
  const initials = getInitials(profile?.full_name, profile?.email)

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["admin", "overview"],
      queryFn: fetchAdminDashboardOverview,
      staleTime: 60_000,
    })
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
      queryKey: ["admin", "orders-view"],
      queryFn: fetchAdminOrdersView,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "notifications", "active", profile?.id],
      queryFn: () => fetchAdminNotifications(false, profile?.id),
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
  }, [queryClient, profile?.id])

  const userMap = new Map((usersQuery.data ?? []).map((user) => [user.id, user]))
  const unreadNotificationsCount = (notificationsQuery.data ?? []).filter((notification) => notification.status === "unread").length

  return (
    <div className="min-h-screen bg-[#f3f7fa] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="container flex min-h-[64px] items-center justify-between gap-4 py-3">
          <Link to={ROUTES.ADMIN} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Shield className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-black text-slate-950">Mariana Explica</span>
              <span className="block text-[11px] font-black uppercase tracking-[0.26em] text-sky-700">
                Painel admin
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <StatusBadge label="Backend auditado" tone="success" />
            <StatusBadge label="Area protegida" tone="info" />
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.ADMIN_NOTIFICATIONS}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              aria-label="Abrir notificacoes"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-sky-700 px-1.5 text-[10px] font-black text-white ring-2 ring-white">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </span>
              ) : null}
            </Link>

            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm md:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Conta</span>
                <span className="block max-w-[240px] truncate text-sm font-bold text-slate-950">
                  {displayName}
                </span>
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-slate-200 bg-white px-4 text-slate-700 shadow-sm"
              onClick={() => void signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container grid gap-6 py-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="hidden rounded-[30px] border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.05)] lg:sticky lg:top-6 lg:block lg:self-start">
          <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Navegacao</p>
            <p className="mt-2 text-lg font-black text-slate-950">Admin</p>
          </div>

          <nav className="mt-4 grid gap-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.ADMIN}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
                    isActive
                      ? "bg-gradient-to-r from-sky-700 to-slate-950 text-white shadow-[0_14px_30px_rgba(2,132,199,0.22)]"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="min-h-[calc(100vh-210px)] p-4 sm:p-6 lg:p-8">
              <Outlet />
            </div>
          </div>

          <footer className="mt-5 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 shadow-[0_18px_44px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 font-black uppercase tracking-[0.22em] text-sky-700">
                <Link to={ROUTES.ADMIN_SETTINGS}>Privacidade</Link>
                <span>/</span>
                <Link to={ROUTES.ADMIN_SETTINGS}>Cookies</Link>
                <span>/</span>
                <Link to={ROUTES.ADMIN_SETTINGS}>Termos de uso</Link>
              </div>
              <span className="font-semibold text-slate-400">Build {BUILD_VERSION}</span>
            </div>
          </footer>
        </main>
      </div>
      <FloatingNotifications
        notifications={notificationsQuery.data ?? []}
        isLoading={notificationsQuery.isLoading}
        unreadCount={unreadNotificationsCount}
        onMarkAsRead={(notificationId) => void markNotificationAsRead.mutateAsync(notificationId)}
        onClearAll={() => void markAllNotificationsAsRead.mutateAsync()}
        markAsReadPending={markNotificationAsRead.isPending}
        clearAllPending={markAllNotificationsAsRead.isPending}
        getAudienceLabel={(notification) => {
          if (!notification.user_id) return "Operacional"
          const user = userMap.get(notification.user_id)
          return user ? `${user.full_name} - ${user.email}` : notification.user_id
        }}
      />
    </div>
  )
}
