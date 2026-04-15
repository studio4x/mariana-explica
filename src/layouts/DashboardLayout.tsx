import { Home, Bell, Download, FolderOpen, LifeBuoy, User } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { Navbar } from "@/components/common"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/constants"

const items = [
  { to: ROUTES.DASHBOARD, label: "Início", icon: Home },
  { to: ROUTES.DASHBOARD_PRODUCTS, label: "Meus produtos", icon: FolderOpen },
  { to: ROUTES.DASHBOARD_DOWNLOADS, label: "Downloads", icon: Download },
  { to: ROUTES.DASHBOARD_NOTIFICATIONS, label: "Notificações", icon: Bell },
  { to: ROUTES.DASHBOARD_SUPPORT, label: "Suporte", icon: LifeBuoy },
  { to: ROUTES.DASHBOARD_PROFILE, label: "Perfil", icon: User },
]

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#f5f7fa_100%)]">
      <Navbar />
      <div className="container grid gap-6 py-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border bg-white/90 p-4 shadow-sm backdrop-blur">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Área do aluno
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
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
