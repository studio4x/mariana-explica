import {
  Bell,
  BookOpen,
  CreditCard,
  Home,
  LifeBuoy,
  LogOut,
  User,
} from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { CookieConsentBanner, InstallPrompt, ScrollToTop, SiteAiPageEditorLauncher, SiteBrandingManager, SiteLogo, SiteThemeManager, SiteTrackingManager } from "@/components/common"
import { FloatingNotifications } from "@/components/notifications"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useProfilePreferences,
  useUnreadNotificationsCount,
} from "@/hooks/useDashboard"
import { BUILD_VERSION } from "@/lib/build"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/constants"

const items = [
  {
    to: ROUTES.DASHBOARD,
    label: "Inicio",
    description: "Resumo da tua jornada",
    icon: Home,
  },
  {
    to: ROUTES.DASHBOARD_PRODUCTS,
    label: "Materiais",
    description: "Materiais liberados",
    icon: BookOpen,
  },
  {
    to: ROUTES.DASHBOARD_PAYMENTS,
    label: "Pagamentos",
    description: "Histórico financeiro",
    icon: CreditCard,
  },
  {
    to: ROUTES.DASHBOARD_NOTIFICATIONS,
    label: "Notificações",
    description: "Avisos e novidades",
    icon: Bell,
  },
  {
    to: ROUTES.DASHBOARD_MESSAGES,
    label: "Chamados",
    description: "Chamados e conversas",
    icon: LifeBuoy,
  },
  {
    to: ROUTES.DASHBOARD_PROFILE,
    label: "Minha conta",
    description: "Perfil e senha",
    icon: User,
  },
]

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "Aluno"
  const parts = source.split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A"
}

export function DashboardLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const profilePreferencesQuery = useProfilePreferences()
  const unreadNotificationsQuery = useUnreadNotificationsCount()
  const notificationsQuery = useNotifications()
  const markAsRead = useMarkNotificationAsRead()
  const markAllAsRead = useMarkAllNotificationsAsRead()
  const profilePreferences = profilePreferencesQuery.data
  const displayName = profilePreferences?.full_name?.trim() || profile?.full_name?.trim() || profilePreferences?.email || profile?.email || "Aluno"
  const email = profilePreferences?.email || profile?.email || null
  const avatarUrl = profilePreferences?.avatar_url || profile?.avatar_url || null
  const initials = getInitials(profilePreferences?.full_name ?? profile?.full_name, email)
  const unreadNotificationsCount = notificationsQuery.data
    ? notificationsQuery.data.filter((notification) => notification.status === "unread").length
    : unreadNotificationsQuery.data ?? 0

  return (
    <div className="min-h-screen bg-[#F2F7F9] text-[#163138]">
      <ScrollToTop />
      <SiteBrandingManager />
      <SiteThemeManager />
      <SiteTrackingManager />
      <header className="sticky top-0 z-40 border-b border-[#D8E6EB] bg-[#F2F7F9]/95 backdrop-blur-md">
        <div className="container flex min-h-[68px] items-center justify-between gap-4 py-3">
          <Link
            to={ROUTES.HOME}
            className="flex min-w-0 items-center gap-3 rounded-2xl px-1 py-1 transition hover:bg-white/80"
            aria-label="Ir para a home pública"
          >
            <div className="min-w-0">
              <SiteLogo variant="dark" imageClassName="h-12 max-w-[190px]" />
              <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-[#1398B7] sm:block">
                Área do aluno
              </span>
            </div>
          </Link>

          <p className="hidden text-sm font-black uppercase tracking-[0.28em] text-[#5f7077] md:block">
            Meu aprendizado
          </p>

          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.HOME}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#163138] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              aria-label="Ir para a página pública"
            >
              <Home className="h-5 w-5" />
            </Link>
            <Link
              to={ROUTES.DASHBOARD_PROFILE}
              className="hidden rounded-2xl border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-bold text-[#163138] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md lg:inline-flex"
            >
              Minha conta
            </Link>
            <Button
              type="button"
              variant="outline"
              className="hidden rounded-2xl border-[#D8E6EB] bg-white text-[#163138] lg:inline-flex"
              onClick={() => void signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
        <div className="container pb-3 sm:hidden">
          <span className="text-xs font-black uppercase tracking-[0.22em] text-[#1398B7]">Área do aluno</span>
        </div>
      </header>

      <div className="container grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-[30px] border border-[#D8E6EB] bg-white p-4 shadow-[0_20px_50px_rgba(22,49,56,0.05)] lg:sticky lg:top-[100px] lg:self-start">
          <div className="rounded-[24px] bg-[#F2F7F9] p-4">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-sm font-black text-white">
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-black text-[#163138]">{displayName}</p>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1398B7]">
                  {isAdmin ? "Admin em preview" : "Aluno"}
                </p>
              </div>
            </div>
            {email ? (
              <p className="mt-3 truncate text-xs font-medium text-[#5f7077]">{email}</p>
            ) : null}
          </div>

          <nav className="mt-4 grid gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.DASHBOARD}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 transition",
                    isActive
                      ? "bg-[#1398B7] text-white shadow-[0_14px_30px_rgba(19,152,183,0.22)]"
                      : "text-[#5f7077] hover:bg-[#F2F7F9] hover:text-[#163138]",
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className="block truncate text-xs opacity-75">{item.description}</span>
                </span>
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-black text-[#163138] transition hover:bg-[#F2F7F9]"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </aside>

        <main className="min-w-0">
          <Outlet />
          <footer className="mt-5 rounded-[24px] border border-[#D8E6EB] bg-white px-5 py-4 text-xs text-[#5f7077] shadow-[0_20px_50px_rgba(22,49,56,0.04)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-3 font-bold">
                <Link to={ROUTES.HOME} className="hover:text-[#1398B7]">Site público</Link>
                <Link to={ROUTES.DASHBOARD_MESSAGES} className="hover:text-[#1398B7]">Chamados</Link>
                <Link to={ROUTES.DASHBOARD_PROFILE} className="hover:text-[#1398B7]">Conta</Link>
                <Link to={ROUTES.PRIVACY} className="hover:text-[#1398B7]">Privacidade</Link>
                <Link to={ROUTES.COOKIES} className="hover:text-[#1398B7]">Cookies</Link>
                <Link to={ROUTES.TERMS} className="hover:text-[#1398B7]">Termos de uso</Link>
              </div>
              <span className="font-semibold">Build {BUILD_VERSION}</span>
            </div>
          </footer>
        </main>
      </div>
      <CookieConsentBanner />
      <FloatingNotifications
        notifications={notificationsQuery.data ?? []}
        isLoading={notificationsQuery.isLoading}
        unreadCount={unreadNotificationsCount}
        onMarkAsRead={(notificationId) => void markAsRead.mutateAsync(notificationId)}
        onClearAll={() => void markAllAsRead.mutateAsync()}
        markAsReadPending={markAsRead.isPending}
        clearAllPending={markAllAsRead.isPending}
      />
      <SiteAiPageEditorLauncher />
      <InstallPrompt />
    </div>
  )
}
