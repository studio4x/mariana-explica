import { Bell, Download, FolderOpen, Home, LifeBuoy, User } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { Navbar, StatusBadge } from "@/components/common"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"

const items = [
  { to: ROUTES.DASHBOARD, label: "Inicio", icon: Home },
  { to: ROUTES.DASHBOARD_PRODUCTS, label: "Meus produtos", icon: FolderOpen },
  { to: ROUTES.DASHBOARD_DOWNLOADS, label: "Downloads", icon: Download },
  { to: ROUTES.DASHBOARD_NOTIFICATIONS, label: "Notificacoes", icon: Bell },
  { to: ROUTES.DASHBOARD_SUPPORT, label: "Suporte", icon: LifeBuoy },
  { to: ROUTES.DASHBOARD_PROFILE, label: "Perfil", icon: User },
]

export function DashboardLayout() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(" ")[0] ?? "Aluno"

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#eff8fb_48%,#ffffff_100%)]">
      <Navbar />

      <div className="border-b border-white/70 bg-white/72 backdrop-blur">
        <div className="container flex flex-col gap-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Area do aluno</p>
            <h1 className="font-display text-3xl font-bold text-slate-950">Bem-vindo, {firstName}</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Continua de onde paraste, encontra os teus materiais mais depressa e acompanha tudo num painel simples.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link to={ROUTES.DASHBOARD_PRODUCTS} className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="font-semibold text-slate-900">Continuar estudo</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">Produtos e modulos</p>
            </Link>
            <Link to={ROUTES.DASHBOARD_NOTIFICATIONS} className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="font-semibold text-slate-900">Ver novidades</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">Avisos e mensagens</p>
            </Link>
            <div className="flex items-center justify-between rounded-2xl border bg-slate-900 px-4 py-3 text-white shadow-sm">
              <div>
                <p className="font-semibold">Conta</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/65">Estado atual</p>
              </div>
              <StatusBadge label={profile?.status === "active" ? "Conta ativa" : profile?.status ?? "Conta"} tone={profile?.status === "active" ? "success" : "warning"} />
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="mb-5 flex gap-3 overflow-x-auto pb-2 lg:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.DASHBOARD}
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

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur lg:block">
            <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Estudo e suporte
            </p>
            <nav className="grid gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === ROUTES.DASHBOARD}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Foco do dashboard</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Menos distracao, mais continuidade. Os teus produtos, downloads e suporte ficam juntos para facilitar o estudo.
              </p>
            </div>
          </aside>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
