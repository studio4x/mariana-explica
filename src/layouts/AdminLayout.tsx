import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  CircleHelp,
  FilePenLine,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ExternalLink,
  Package,
  MessageSquareText,
  Percent,
  TicketPercent,
  Users,
  CreditCard,
  ClipboardList,
  Settings,
  UserCircle2,
} from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { CookieConsentBanner, ScrollToTop, SiteBrandingManager, SiteLogo, SiteTrackingManager, StatusBadge } from "@/components/common"
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
  fetchAdminSitePages,
  fetchAdminPublicFormSubmissions,
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

interface AdminNavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

const items: AdminNavItem[] = [
  { to: ROUTES.ADMIN, label: "Visao geral", icon: LayoutDashboard },
  { to: ROUTES.ADMIN_PAYMENTS, label: "Pagamentos", icon: CreditCard },
  { to: ROUTES.ADMIN_NOTIFICATIONS, label: "Notificacoes", icon: Bell },
  { to: ROUTES.ADMIN_USERS, label: "Usuarios", icon: Users },
  { to: ROUTES.ADMIN_PRODUCTS, label: "Materiais", icon: Package },
  { to: ROUTES.ADMIN_REVIEWS, label: "Reviews", icon: MessageSquareText },
  { to: ROUTES.ADMIN_SUPPORT, label: "Tickets", icon: LifeBuoy },
  { to: ROUTES.ADMIN_PUBLIC_FORMS, label: "Formularios", icon: ClipboardList },
  { to: ROUTES.ADMIN_PAGE_EDITOR, label: "Editor de Paginas", icon: FilePenLine },
  { to: ROUTES.ADMIN_FAQ, label: "Perguntas frequentes", icon: CircleHelp },
  { to: ROUTES.ADMIN_AFFILIATES, label: "Afiliados", icon: Percent },
  { to: ROUTES.ADMIN_COUPONS, label: "Cupons", icon: TicketPercent },
  { to: ROUTES.ADMIN_ACCOUNT, label: "Minha Conta", icon: UserCircle2 },
  { to: ROUTES.ADMIN_SETTINGS, label: "Configuracoes", icon: Settings },
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
      queryKey: ["admin", "public-forms", "submissions"],
      queryFn: fetchAdminPublicFormSubmissions,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "operations"],
      queryFn: fetchAdminOperations,
      staleTime: 60_000,
    })
    void queryClient.prefetchQuery({
      queryKey: ["admin", "site-pages"],
      queryFn: fetchAdminSitePages,
      staleTime: 60_000,
    })
  }, [queryClient, profile?.id])

  const userMap = new Map((usersQuery.data ?? []).map((user) => [user.id, user]))
  const unreadNotificationsCount = (notificationsQuery.data ?? []).filter((notification) => notification.status === "unread").length

  return (
    <div className="min-h-screen bg-[#f3f7fa] text-slate-950">
      <ScrollToTop />
      <SiteBrandingManager />
      <SiteTrackingManager />
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="flex min-h-[64px] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to={ROUTES.ADMIN} className="flex items-center gap-3">
            <div className="min-w-0">
              <SiteLogo variant="dark" imageClassName="h-12 max-w-[210px]" />
              <span className="block text-[11px] font-black uppercase tracking-[0.26em] text-sky-700">
                Painel admin
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <StatusBadge label="Backend auditado" tone="success" />
            <StatusBadge label="Area protegida" tone="info" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              type="button"
              variant="outline"
              className="h-11 rounded-full border-slate-200 bg-white px-4 text-slate-700 shadow-sm"
            >
              <Link to={ROUTES.HOME}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Site publico
              </Link>
            </Button>

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

            <Link
              to={ROUTES.ADMIN_ACCOUNT}
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:flex"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Conta</span>
                <span className="block max-w-[240px] truncate text-sm font-bold text-slate-950">
                  {displayName}
                </span>
              </span>
            </Link>

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

      <div className="grid min-h-[calc(100vh-73px)] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden self-start lg:sticky lg:top-[92px] lg:block">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Navegacao</p>
              <p className="mt-2 text-lg font-black text-slate-950">Admin</p>
            </div>
            <nav className="space-y-1 p-3">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === ROUTES.ADMIN}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-2xl px-4 py-3 text-sm font-bold transition-all",
                      isActive
                        ? "bg-gradient-to-r from-sky-700 to-slate-950 text-white shadow-[0_14px_30px_rgba(2,132,199,0.22)]"
                        : "text-slate-600 hover:bg-[#F2F7F9] hover:text-[#163138]",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="min-h-[calc(100vh-225px)] p-4 sm:p-6 lg:p-7">
              <Outlet />
            </div>
          </div>

          <footer className="mt-5 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-[#5F7077]">
                <Link to={ROUTES.PRIVACY}>Privacidade</Link>
                <span aria-hidden="true" className="text-slate-300">/</span>
                <Link to={ROUTES.COOKIES}>Cookies</Link>
                <span aria-hidden="true" className="text-slate-300">/</span>
                <Link to={ROUTES.TERMS}>Termos de uso</Link>
              </div>
              <span className="text-[10px] font-medium tracking-[0.06em] text-slate-400/90 text-[#5F7077]">
                Build {BUILD_VERSION}
              </span>
            </div>
          </footer>
        </main>
      </div>
      <CookieConsentBanner />
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
