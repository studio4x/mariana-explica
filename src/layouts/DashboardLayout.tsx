import { useState } from "react"
import {
  Bell,
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  LifeBuoy,
  LogOut,
  User,
} from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { InstallPrompt } from "@/components/common"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { useMarkNotificationAsRead, useNotifications, useUnreadNotificationsCount } from "@/hooks/useDashboard"
import { BUILD_VERSION } from "@/lib/build"
import { cn } from "@/lib/cn"
import { APP_NAME, ROUTES } from "@/lib/constants"
import { formatDateTime } from "@/utils/date"

const items = [
  {
    to: ROUTES.DASHBOARD,
    label: "Inicio",
    description: "Resumo da tua jornada",
    icon: Home,
  },
  {
    to: ROUTES.DASHBOARD_PRODUCTS,
    label: "Cursos",
    description: "Materiais liberados",
    icon: BookOpen,
  },
  {
    to: ROUTES.DASHBOARD_PAYMENTS,
    label: "Pagamentos",
    description: "Historico financeiro",
    icon: CreditCard,
  },
  {
    to: ROUTES.DASHBOARD_NOTIFICATIONS,
    label: "Notificacoes",
    description: "Avisos e novidades",
    icon: Bell,
  },
  {
    to: ROUTES.DASHBOARD_SUPPORT,
    label: "Suporte",
    description: "Pedidos e respostas",
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

function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const unreadNotificationsQuery = useUnreadNotificationsCount()
  const notificationsQuery = useNotifications()
  const markAsRead = useMarkNotificationAsRead()
  const unreadNotificationsCount = unreadNotificationsQuery.data ?? 0
  const notifications = (notificationsQuery.data ?? []).slice(0, 5)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#163138] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        aria-label={`Notificacoes${unreadNotificationsCount > 0 ? `, ${unreadNotificationsCount} por ler` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadNotificationsCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#1398B7] px-1 text-[10px] font-black text-white ring-2 ring-white">
            {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-3 w-[min(calc(100vw-2rem),420px)] overflow-hidden rounded-[1.5rem] border border-[#D8E6EB] bg-white shadow-[0_24px_70px_rgba(22,49,56,0.14)]">
          <div className="flex items-center justify-between gap-3 bg-[#F2F7F9] px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#1398B7]">Centro</p>
              <h2 className="text-sm font-black text-[#163138]">Notificacoes</h2>
            </div>
            <Link
              to={ROUTES.DASHBOARD_NOTIFICATIONS}
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#1398B7] hover:text-[#0A3640]"
            >
              Ver todas
            </Link>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-3">
            {notificationsQuery.isLoading ? (
              <p className="px-3 py-6 text-sm text-slate-500">A carregar notificacoes...</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-sm text-slate-500">Sem notificacoes por enquanto.</p>
            ) : (
              <div className="grid gap-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      if (notification.status === "unread") {
                        void markAsRead.mutateAsync(notification.id)
                      }
                    }}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition hover:bg-[#F2F7F9]",
                      notification.status === "unread"
                        ? "border-[#B9E5EF] bg-[#F2FBFD]"
                        : "border-slate-100 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-[#163138]">{notification.title}</p>
                      {notification.status === "unread" ? (
                        <span className="rounded-full bg-[#1398B7] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                          Nova
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DashboardLayout() {
  const { profile, signOut } = useAuth()
  const displayName = profile?.full_name?.trim() || profile?.email || "Aluno"
  const initials = getInitials(profile?.full_name, profile?.email)

  return (
    <div className="min-h-screen bg-[#F2F7F9] text-[#163138]">
      <header className="sticky top-0 z-40 border-b border-[#D8E6EB] bg-[#F2F7F9]/95 backdrop-blur-md">
        <div className="container flex min-h-[68px] items-center justify-between gap-4 py-3">
          <Link
            to={ROUTES.HOME}
            className="flex min-w-0 items-center gap-3 rounded-2xl px-1 py-1 transition hover:bg-white/80"
            aria-label="Ir para a home publica"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#242742] text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-black text-[#163138]">{APP_NAME}</span>
              <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-[#1398B7] sm:block">
                Area do aluno
              </span>
            </span>
          </Link>

          <p className="hidden text-sm font-black uppercase tracking-[0.28em] text-[#5f7077] md:block">
            Meu aprendizado
          </p>

          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.HOME}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#163138] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              aria-label="Ir para a pagina publica"
            >
              <Home className="h-5 w-5" />
            </Link>
            <NotificationCenter />
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
          <span className="text-xs font-black uppercase tracking-[0.22em] text-[#1398B7]">Area do aluno</span>
        </div>
      </header>

      <div className="container grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-[30px] border border-[#D8E6EB] bg-white p-4 shadow-[0_20px_50px_rgba(22,49,56,0.05)] lg:sticky lg:top-[100px] lg:self-start">
          <div className="rounded-[24px] bg-[#F2F7F9] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-sm font-black text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-black text-[#163138]">{displayName}</p>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1398B7]">Aluno</p>
              </div>
            </div>
            {profile?.email ? (
              <p className="mt-3 truncate text-xs font-medium text-[#5f7077]">{profile.email}</p>
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
                <Link to={ROUTES.HOME} className="hover:text-[#1398B7]">Site publico</Link>
                <Link to={ROUTES.DASHBOARD_SUPPORT} className="hover:text-[#1398B7]">Suporte</Link>
                <Link to={ROUTES.DASHBOARD_PROFILE} className="hover:text-[#1398B7]">Conta</Link>
              </div>
              <span className="font-semibold">Build {BUILD_VERSION}</span>
            </div>
          </footer>
        </main>
      </div>
      <InstallPrompt />
    </div>
  )
}
